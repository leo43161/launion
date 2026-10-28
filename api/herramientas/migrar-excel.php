<?php
/* Pasa los presupuestos de la planilla de Excel (doc-presupuesto/LISTA COMODAS.xlsx) a la base: genera un .sql para importar en
   phpMyAdmin y deja las fotos de cada mueble en una carpeta, para subirlas a assets/presupuestos/.
   Uso: php migrar-excel.php <planilla.xlsx> <salida.sql> <carpeta para las fotos>

   Cada bloque de la planilla es un presupuesto: el título arriba de la fila "ANCHO | ALTO | INSUMO | CORTE…", a la izquierda
   el despiece (ancho, alto, cantidad, pieza, material) y a la derecha los insumos (cantidad, insumo, costo unitario), hasta
   las filas COSTO, PRECIO (=costo × multiplicador) y PRECIO FINAL. La foto es la imagen que está al lado del bloque.
   Verifica que la suma de los insumos dé el COSTO que calculó Excel. */

if (PHP_SAPI !== 'cli') exit;
require __DIR__ . '/../rutas/subir.php'; // foto_liviana(), para las fotos de más de 500 KB
[, $origen, $destino, $carpeta_fotos] = $argv + [null, null, null, null];
if (!$origen || !$destino || !$carpeta_fotos) exit("Uso: php migrar-excel.php <planilla.xlsx> <salida.sql> <carpeta para las fotos>\n");
$zip = new ZipArchive();
if ($zip->open($origen) !== true) exit("No se pudo abrir $origen\n");

// Las hojas son los grupos
const GRUPOS = ['COMODAS' => 'Cómodas', 'VAJILLEROS' => 'Vajilleros', 'DESPENSEROS' => 'Despenseros', 'Hoja4' => 'Mesas de luz'];

function xml($zip, $ruta) {
  $s = $zip->getFromName($ruta);
  return $s === false ? null : simplexml_load_string($s);
}
/** "xl/worksheets/sheet1.xml" + "../drawings/drawing1.xml" → "xl/drawings/drawing1.xml" */
function ruta_relativa($base, $rel) {
  $partes = explode('/', dirname($base));
  foreach (explode('/', $rel) as $p) $p === '..' ? array_pop($partes) : $partes[] = $p;
  return implode('/', $partes);
}
/** Destinos de un archivo .rels: Id → ruta. */
function relaciones($zip, $archivo) {
  $r = [];
  $x = xml($zip, dirname($archivo) . '/_rels/' . basename($archivo) . '.rels');
  if ($x) foreach ($x->Relationship as $rel) $r[(string)$rel['Id']] = ruta_relativa($archivo, (string)$rel['Target']);
  return $r;
}
function columna($ref) { // "AB12" → 27 (A = 0)
  preg_match('/^([A-Z]+)/', $ref, $m);
  $n = 0;
  foreach (str_split($m[1]) as $l) $n = $n * 26 + ord($l) - 64;
  return $n - 1;
}
function q($v) {
  if ($v === null) return 'NULL';
  if (is_int($v) || is_float($v)) return (string)$v;
  return "'" . str_replace(['\\', "'"], ['\\\\', "''"], $v) . "'";
}
function slug($s) {
  $s = strtr(mb_strtolower($s), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
  return trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
}

$textos = [];
foreach (xml($zip, 'xl/sharedStrings.xml')->si as $si) {
  $t = (string)$si->t;
  foreach ($si->r as $r) $t .= (string)$r->t;
  $textos[] = $t;
}
$hojas_rel = relaciones($zip, 'xl/workbook.xml');
$wb = xml($zip, 'xl/workbook.xml');
$wb->registerXPathNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships');

$presupuestos = [];
$fotos = []; // ruta en el xlsx → nombre en assets/presupuestos/
$errores = 0;
foreach ($wb->sheets->sheet as $hoja) {
  $nombre_hoja = trim((string)$hoja['name']);
  $archivo = $hojas_rel[(string)$hoja->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['id']];

  // Celdas: [fila][columna] = ['v' => valor, 'f' => fórmula]
  $c = [];
  foreach (xml($zip, $archivo)->sheetData->row as $fila) foreach ($fila->c as $celda) {
    $v = isset($celda->v) ? (string)$celda->v : null;
    if ((string)$celda['t'] === 's') $v = $textos[(int)$v];
    $c[(int)$fila['r']][columna((string)$celda['r'])] = ['v' => $v, 'f' => isset($celda->f) ? (string)$celda->f : ''];
  }
  $txt = function ($f, $col) use (&$c) { return trim(preg_replace('/\s+/', ' ', (string)($c[$f][$col]['v'] ?? ''))); };
  $num = function ($f, $col) use (&$c) { $v = $c[$f][$col]['v'] ?? null; return is_numeric($v) ? (float)$v : null; };

  // Imágenes de la hoja con la celda donde empiezan (fila de Excel, columna desde 0)
  $imagenes = [];
  foreach (relaciones($zip, $archivo) as $dibujo) {
    if (strpos($dibujo, 'drawings/') === false) continue;
    $rels = relaciones($zip, $dibujo);
    $d = xml($zip, $dibujo);
    foreach ($d->children('http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing') as $ancla) {
      $desde = $ancla->from;
      $blip = $ancla->xpath('.//*[local-name()="blip"]');
      if (!$desde || !$blip) continue;
      $id = (string)$blip[0]->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['embed'];
      $imagenes[] = ['fila' => (int)$desde->row + 1, 'col' => (int)$desde->col, 'ruta' => $rels[$id]];
    }
  }

  $fin_anterior = 0;
  $seccion = '';
  $bloques = []; // índices en $presupuestos de los de esta hoja
  foreach ($c as $f => $fila) foreach ($fila as $k => $celda) {
    if (trim((string)$celda['v']) !== 'ANCHO' || $txt($f, $k + 3) !== 'CORTE') continue;
    // El título: el primer texto en las 3 filas de arriba. Más arriba, entre el bloque anterior y este, puede haber una sección ("COMODAS 4 CAJONES")
    $titulo = '';
    for ($t = $f - 1; $t >= $f - 3 && $titulo === ''; $t--) $titulo = $txt($t, $k) ?: $txt($t, $k + 1);
    for (; $t > $fin_anterior; $t--) if ($txt($t, $k) !== '') { $seccion = $txt($t, $k); break; }
    $titulo = $titulo ?: "Sin nombre (Excel, hoja $nombre_hoja, fila $f)";
    // Las filas de COSTO, PRECIO y PRECIO FINAL están en la columna del costo unitario
    for ($fc = $f + 1; $fc < $f + 60 && $txt($fc, $k + 7) !== 'COSTO'; $fc++);
    if ($fc === $f + 60) { echo "Sin fila COSTO: $titulo\n"; $errores++; continue; }
    $fin = $fc + 2;
    preg_match('/\*\s*([\d.]+)/', $c[$fc + 1][$k + 8]['f'] ?? '', $m);
    $multiplicador = isset($m[1]) ? (float)$m[1] : 2.2;
    $precio_final = stripos($txt($fin, $k + 7), 'PRECIO F') === 0 ? $num($fin, $k + 8) : null;

    $cortes = [];
    for ($r = $f + 1; $r <= $fin; $r++) {
      $pieza = $txt($r, $k + 3);
      if ($pieza === '' && $num($r, $k) === null && $num($r, $k + 1) === null) continue;
      $cortes[] = ['pieza' => $pieza ?: null, 'ancho_cm' => $num($r, $k) === null ? null : round($num($r, $k), 1),
        'alto_cm' => $num($r, $k + 1) === null ? null : round($num($r, $k + 1), 1), 'cantidad' => (int)($num($r, $k + 2) ?? 1),
        'material' => $txt($r, $k + 4) ?: null];
    }
    $insumos = [];
    $costo = 0;
    for ($r = $f + 1; $r < $fc; $r++) {
      $nombre = $txt($r, $k + 6);
      if ($nombre === '' && $num($r, $k + 5) === null) continue;
      $x = ['insumo' => $nombre ?: 'Sin nombre', 'cantidad' => round($num($r, $k + 5) ?? 0, 3), 'costo_unitario' => round($num($r, $k + 7) ?? 0, 2)];
      $insumos[] = $x;
      $costo += $x['cantidad'] * $x['costo_unitario'];
    }
    $costo_excel = $num($fc, $k + 8);
    if ($costo_excel === null || abs($costo - $costo_excel) > 0.01) { printf("El costo no coincide: %s (suma %.2f, Excel %s)\n", $titulo, $costo, $costo_excel); $errores++; }

    $fin_anterior = $fin;

    $bloques[] = count($presupuestos);
    $presupuestos[] = ['fila' => $f, 'k' => $k, 'imagen' => null, 'nombre' => mb_substr($titulo, 0, 160), 'grupo' => GRUPOS[$nombre_hoja] ?? $nombre_hoja, 'notas' => "Del Excel LISTA COMODAS, hoja $nombre_hoja" . ($seccion ? ", sección $seccion" : '') . '.',
      'multiplicador' => $multiplicador, 'precio_final' => $precio_final, 'cortes' => $cortes, 'insumos' => $insumos, 'costo' => $costo];
  }

  // La foto de cada bloque: la imagen de al lado de la tabla (las de más a la derecha son otras) que empieza más cerca de su título.
  // Algunas empiezan unas filas más arriba, todavía en el bloque anterior.
  foreach ($imagenes as $img) {
    $cerca = null;
    foreach ($bloques as $i) {
      $b = $presupuestos[$i];
      if ($img['col'] >= $b['k'] + 8 && $img['col'] <= $b['k'] + 14 && abs($img['fila'] - $b['fila']) <= 10
        && ($cerca === null || abs($img['fila'] - $b['fila']) < abs($img['fila'] - $presupuestos[$cerca]['fila']))) $cerca = $i;
    }
    if ($cerca !== null && !$presupuestos[$cerca]['imagen']) $presupuestos[$cerca]['imagen'] = $img['ruta'];
  }
}

// Cada foto con un nombre distinto (el Excel repite títulos), y una sola vez aunque la usen dos presupuestos
foreach ($presupuestos as &$p) {
  if ($p['imagen'] && !isset($fotos[$p['imagen']])) {
    $base = 'excel-' . rtrim(substr(slug($p['nombre']), 0, 80), '-');
    $ext = '.' . pathinfo($p['imagen'], PATHINFO_EXTENSION);
    for ($nombre = $base, $n = 2; in_array($nombre . $ext, $fotos, true); $n++) $nombre = "$base-$n";
    $fotos[$p['imagen']] = $nombre . $ext;
  }
  $p['url_foto'] = $p['imagen'] ? 'assets/presupuestos/' . $fotos[$p['imagen']] : null;
}
unset($p);

// Las fotos: las de más de 500 KB se achican como en la subida (quedan JPEG aunque se llamen .png: los navegadores las abren igual)
if (!is_dir($carpeta_fotos)) mkdir($carpeta_fotos, 0777, true);
foreach ($fotos as $ruta => $nombre) {
  $datos = $zip->getFromName($ruta);
  if (strlen($datos) > FOTO_MAXIMO) {
    $tmp = tempnam(sys_get_temp_dir(), 'xl');
    file_put_contents($tmp, $datos);
    $datos = foto_liviana($tmp) ?? $datos;
    unlink($tmp);
  }
  file_put_contents("$carpeta_fotos/$nombre", $datos);
}

$sql = "-- Presupuestos de la planilla de Excel LISTA COMODAS, generados con muebleria-next/api/herramientas/migrar-excel.php.\n"
  . "-- Se importan una sola vez en phpMyAdmin (base a0101073_launion), después de arreglo-presupuestos.sql: si se corre dos veces, quedan repetidos.\n"
  . "-- Las fotos (assets/presupuestos/excel-*) van en public_html/launion/assets/presupuestos/.\n"
  . "-- " . count($presupuestos) . " presupuestos.\n\nSET NAMES utf8mb4;\nSET time_zone = '-03:00'; -- la fecha de alta en hora de Tucumán, como la pone la API\nSTART TRANSACTION;\n\n";
foreach ($presupuestos as $p) {
  $sql .= sprintf("INSERT INTO presupuestos (nombre, grupo, url_foto, notas, multiplicador, precio_final) VALUES (%s, %s, %s, %s, %s, %s);\nSET @p = LAST_INSERT_ID();\n",
    q($p['nombre']), q($p['grupo']), q($p['url_foto']), q($p['notas']), q($p['multiplicador']), q($p['precio_final']));
  if ($p['cortes']) $sql .= "INSERT INTO presupuestos_cortes (presupuesto_id, orden, pieza, ancho_cm, alto_cm, cantidad, material) VALUES\n" . implode(",\n", array_map(function ($x, $i) {
    return '(@p, ' . implode(', ', array_map('q', [$i, $x['pieza'], $x['ancho_cm'], $x['alto_cm'], $x['cantidad'], $x['material']])) . ')';
  }, $p['cortes'], array_keys($p['cortes']))) . ";\n";
  if ($p['insumos']) $sql .= "INSERT INTO presupuestos_insumos (presupuesto_id, orden, insumo, cantidad, costo_unitario) VALUES\n" . implode(",\n", array_map(function ($x, $i) {
    return '(@p, ' . implode(', ', array_map('q', [$i, $x['insumo'], $x['cantidad'], $x['costo_unitario']])) . ')';
  }, $p['insumos'], array_keys($p['insumos']))) . ";\n";
  $sql .= "\n";
}
file_put_contents($destino, $sql . "COMMIT;\n");

foreach ($presupuestos as $p) printf("%-12s %-80s costo %10s  × %-4s final %9s  %2d cortes  %2d insumos  %s\n", $p['grupo'], mb_strimwidth($p['nombre'], 0, 80), number_format($p['costo'], 0, ',', '.'),
  $p['multiplicador'], $p['precio_final'] === null ? '—' : number_format($p['precio_final'], 0, ',', '.'), count($p['cortes']), count($p['insumos']), $p['url_foto'] ? 'foto' : 'SIN FOTO');
printf("\n%d presupuestos y %d fotos. %s\n", count($presupuestos), count($fotos), $errores ? "$errores ERRORES" : 'Todos los costos coinciden con el Excel.');
