<?php
/* Trae los colores de Faplac (faplaconline.com.ar): las melaminas y los polímeros, sin los discontinuos. Genera un .sql para
   importar en phpMyAdmin y deja las fotos achicadas en una carpeta, para subirlas a assets/colores/faplac/.
   Uso: php colores-faplac.php <salida.sql> <carpeta para las fotos>

   De cada color: nombre, código, línea y textura (los filtros del listado), la descripción de su ficha, la muestra y las fotos
   de ambientes. Las revestimientos y fondos de Faplac son los mismos diseños: no se traen.
   Se puede volver a correr cuando Faplac saque diseños nuevos: el .sql agrega los nuevos y actualiza los que ya están
   (no les cambia visible ni activo, que se eligen acá). */

if (PHP_SAPI !== 'cli') exit;
[, $destino, $carpeta_fotos] = $argv + [null, null, null];
if (!$destino || !$carpeta_fotos) exit("Uso: php colores-faplac.php <salida.sql> <carpeta para las fotos>\n");

const SITIO = 'https://www.faplaconline.com.ar';
const CATEGORIAS = ['ar-melaminas' => 'Melamina', 'ar-polimeros' => 'Polímero'];
const LADO_MUESTRA = 600;   // la tarjeta y la primera foto del detalle
const LADO_AMBIENTE = 1200; // las fotos de ambientes, solo en el detalle

function bajar($url) {
  usleep(250000); // de a una y despacio: es la web de otro
  $s = @file_get_contents(SITIO . $url, false, stream_context_create(['http' => ['header' => "User-Agent: Mozilla/5.0\r\n"]]));
  if ($s === false) exit("No se pudo bajar $url\n");
  return $s;
}
function texto($s) { return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($s), ENT_QUOTES | ENT_HTML5, 'UTF-8'))); }
function q($v) {
  if ($v === null) return 'NULL';
  if (is_int($v)) return (string)$v;
  return "'" . str_replace(['\\', "'"], ['\\\\', "''"], $v) . "'";
}

/** Las tarjetas de un listado, página por página (de a 20). */
function listado($categoria, $filtro) {
  $out = [];
  for ($p = 0; $p < 20; $p++) {
    preg_match_all('#<div class="product-item.*?href="/home/p/([^"]+)" title="[^"]*">.*?<div class="fs-02 color-01">(.*?)</div>#s',
      bajar("/home/c/ar-faplac/$categoria?q=" . urlencode(":releaseDate$filtro") . "&page=$p"), $m, PREG_SET_ORDER);
    foreach ($m as $x) $out[$x[1]] = preg_replace('/^Línea\s+/u', '', texto($x[2]));
    if (count($m) < 20) break;
  }
  return $out; // slug → línea
}

/** Una imagen JPEG de hasta $lado px, progresiva. */
function achicar($datos, $lado) {
  $img = imagecreatefromstring($datos);
  $w = imagesx($img);
  $h = imagesy($img);
  $e = min(1, $lado / max($w, $h));
  $nueva = imagecreatetruecolor((int)round($w * $e), (int)round($h * $e));
  imagecopyresampled($nueva, $img, 0, 0, 0, 0, imagesx($nueva), imagesy($nueva), $w, $h);
  imageinterlace($nueva, true);
  ob_start();
  imagejpeg($nueva, null, 80);
  return ob_get_clean();
}

if (!is_dir($carpeta_fotos)) mkdir($carpeta_fotos, 0777, true);
$colores = [];
foreach (CATEGORIAS as $categoria => $material) {
  $lineas = listado($categoria, '');
  // La textura sale del filtro "Textura": se pide el listado de cada una
  $texturas = [];
  $pagina = bajar("/home/c/ar-faplac/$categoria");
  preg_match_all('#name="q" value=":releaseDate:productFinishment:([^"]+)"#', $pagina, $f);
  foreach (array_unique($f[1]) as $t) {
    $t = urldecode($t);
    foreach (listado($categoria, ":productFinishment:$t") as $slug => $_) $texturas[$slug] = mb_convert_case($t, MB_CASE_TITLE, 'UTF-8'); // EXTREME MATT → Extreme Matt
  }
  foreach ($lineas as $slug => $linea) {
    $h = bajar("/home/p/$slug");
    preg_match('#<input type="hidden" class="js-product-name" value="([^"]*)"#', $h, $nombre);
    $nombre = texto($nombre[1]);
    if (stripos($nombre, 'discontinuo') !== false) { echo "Discontinuo, no va: $nombre\n"; continue; }
    preg_match('#<span class="code hidden">([^<]+)<#', $h, $codigo);
    preg_match('#<meta name="description" content="([^"]*)"#', $h, $descripcion);
    preg_match_all('#data-class-zoomit="([^"]+)"#', $h, $fotos);
    $fotos = array_values(array_unique($fotos[1]));
    $codigo = trim($codigo[1]);
    $urls = [];
    foreach ($fotos as $j => $url) { // la primera es la muestra; las demás, ambientes
      $archivo = $codigo . ($j ? "-$j" : '') . '.jpg';
      file_put_contents("$carpeta_fotos/$archivo", achicar(bajar(html_entity_decode($url)), $j ? LADO_AMBIENTE : LADO_MUESTRA));
      $urls[] = "assets/colores/faplac/$archivo";
    }
    $colores[] = ['nombre' => $nombre, 'material' => $material, 'linea' => $linea, 'textura' => $texturas[$slug] ?? null, 'codigo' => $codigo,
      'descripcion' => texto($descripcion[1] ?? '') ?: null, 'muestra' => $urls[0] ?? null, 'fotos' => array_slice($urls, 1)];
    printf("%-12s %-11s %-16s %-24s %d fotos\n", $codigo, $material, $linea, $nombre, count($urls));
  }
}
// Las líneas en el orden del menú de Faplac (Imperial, Mesopotamia… Lisos, Táctil); adentro, del diseño más nuevo al más viejo
preg_match_all('#<h4 class="fw-bold">Líneas</h4>\s*<ul[^>]*>(.*?)</ul>#s', $pagina, $menu);
preg_match_all('#title="([^"]+)"#', implode('', $menu[1]), $menu);
$orden = array_values(array_unique(array_map(function ($t) { return mb_strtoupper(texto($t)); }, $menu[1])));
$lugar = function ($c) use ($orden) { $i = array_search(mb_strtoupper($c['linea']), $orden, true); return $i === false ? 99 : $i; };
$i = 0;
foreach ($colores as &$c) $c['i'] = $i++;
unset($c);
usort($colores, function ($a, $b) use ($lugar) { return [$lugar($a), $a['i']] <=> [$lugar($b), $b['i']]; });

$sql = "-- Colores de Faplac (faplaconline.com.ar), generados con muebleria-next/api/herramientas/colores-faplac.php el " . date('d/m/Y') . ".\n"
  . "-- Se importa en phpMyAdmin (base a0101073_launion) después de arreglo-colores.sql. Se puede volver a importar: agrega los nuevos\n"
  . "-- y actualiza los que ya están, sin cambiarles visible ni activo.\n"
  . "-- Las fotos van en public_html/launion/assets/colores/faplac/.\n"
  . "-- " . count($colores) . " colores.\n\nUSE a0101073_launion;\nSET NAMES utf8mb4;\n\n"
  . "INSERT IGNORE INTO materiales (nombre) VALUES ('Melamina'), ('Polímero');\n"
  . "SET @melamina = (SELECT id FROM materiales WHERE nombre = 'Melamina'), @polimero = (SELECT id FROM materiales WHERE nombre = 'Polímero');\n\n"
  . "INSERT INTO colores (material_id, proveedor, linea, nombre, codigo_proveedor, textura, descripcion, url_imagen, fotos, orden) VALUES\n";
$filas = [];
foreach ($colores as $i => $c) $filas[] = '(' . ($c['material'] === 'Melamina' ? '@melamina' : '@polimero') . ", 'Faplac', " . implode(', ', array_map('q', [
  $c['linea'], $c['nombre'], $c['codigo'], $c['textura'], $c['descripcion'], $c['muestra'], json_encode($c['fotos'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $i + 1])) . ')';
$sql .= implode(",\n", $filas) . "\nAS nuevo ON DUPLICATE KEY UPDATE linea = nuevo.linea, codigo_proveedor = nuevo.codigo_proveedor, textura = nuevo.textura,\n"
  . "  descripcion = nuevo.descripcion, url_imagen = nuevo.url_imagen, fotos = nuevo.fotos, orden = nuevo.orden;\n\n"
  . "SELECT proveedor, linea, COUNT(*) AS colores FROM colores GROUP BY proveedor, linea ORDER BY MIN(orden);\n";
file_put_contents($destino, $sql);
printf("\n%d colores en %s y sus fotos en %s\n", count($colores), $destino, $carpeta_fotos);
