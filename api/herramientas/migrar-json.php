<?php
/* Pasa el catálogo de la web actual (data/productos.json) a la base: genera un .sql para importar en phpMyAdmin.
   Uso: php migrar-json.php <productos.json> <salida.sql> [hash de la contraseña del usuario admin]
   Sin hash, inventa una contraseña temporal, la muestra y el usuario la tiene que cambiar al entrar.
   Crea también los roles, las dos listas de precios y el usuario admin. La base tiene que tener esas tablas vacías.
   Los ids van escritos, 1, 2, 3… en cada tabla: así se lee qué foto o precio es de qué producto. */

if (PHP_SAPI !== 'cli') exit;
date_default_timezone_set('America/Argentina/Tucuman');
[, $origen, $destino] = $argv + [null, null, null];
if (!$origen || !$destino) exit("Uso: php migrar-json.php <productos.json> <salida.sql> [hash]\n");
$d = json_decode(file_get_contents($origen), true);
if (!is_array($d['products'] ?? null)) exit("No se pudo leer $origen\n");

function q($v) {
  if ($v === null) return 'NULL';
  if (is_bool($v)) return $v ? '1' : '0';
  if (is_int($v) || is_float($v)) return (string)$v;
  return "'" . str_replace(['\\', "'"], ['\\\\', "''"], $v) . "'";
}
function insertar($tabla, $filas) {
  if (!$filas) return '';
  return "INSERT INTO $tabla (" . implode(', ', array_keys($filas[0])) . ") VALUES\n"
    . implode(",\n", array_map(function ($f) { return '(' . implode(', ', array_map('q', $f)) . ')'; }, $filas)) . ";\n\n";
}
function slug($s) {
  $s = strtr(mb_strtolower($s), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
  return trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
}
// Las fotos del catálogo viejo vienen como "<carpeta>/<archivo>" dentro de assets/productos/fotos/; las subidas ya traen assets/…
function foto($p) { return strpos($p, 'assets/') === 0 ? $p : "assets/productos/fotos/$p"; }

$clave = null;
$hash = $argv[3] ?? null;
if (!$hash) {
  $clave = substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes(12))), 0, 12);
  $hash = password_hash($clave, PASSWORD_DEFAULT);
}

/* ambientes → categorías principales; sus tipos → subcategorías */
$categorias = [];
$tipo_id = []; // "ambiente|tipo" => id
$id = 0;
foreach ($d['rooms'] as $i => $r) {
  $categorias[] = ['id' => ++$id, 'padre_id' => null, 'nombre' => $r['l'], 'slug' => $r['id'], 'publico' => $r['side'],
    'frase' => $r['b'], 'url_portada' => foto($r['cover']), 'orden' => $i + 1, 'visible' => 1];
}
foreach ($d['rooms'] as $i => $r) {
  foreach ($r['types'] as $j => $t) {
    $categorias[] = ['id' => ++$id, 'padre_id' => $i + 1, 'nombre' => $t, 'slug' => $r['id'] . '-' . slug($t), 'publico' => null,
      'frase' => null, 'url_portada' => null, 'orden' => $j + 1, 'visible' => 1];
    $tipo_id[$r['id'] . '|' . $t] = $id;
  }
}

/* productos, fotos y precio de la web */
$productos = $fotos = $precios = [];
$base = strtotime('2026-10-01 09:00:00'); // creado_en en el orden del JSON: el panel los lista así
foreach ($d['products'] as $i => $p) {
  $pid = $i + 1;
  $dm = $p['d'] ?: [null, null, null, null];
  $productos[] = [
    'id' => $pid, 'categoria_id' => $tipo_id[$p['r'] . '|' . $p['t']], 'codigo' => $p['c'], 'nombre' => $p['n'],
    'descripcion_corta' => $p['k'] ?: null, 'variante' => $p['s'],
    'ancho_cm' => $dm[0], 'alto_cm' => $dm[1], 'profundidad_cm' => $dm[2], 'diametro_cm' => $dm[3],
    'detalle_medidas' => $p['dx'], 'texto_medidas' => $p['mt'],
    'caracteristicas' => json_encode($p['f'], JSON_UNESCAPED_UNICODE), 'nota' => $p['no'], 'mensaje_whatsapp' => $p['w'] ?: null,
    'visible' => empty($p['h']) && empty($p['del']) ? 1 : 0, 'destacado' => in_array($i, $d['featured'], true) ? 1 : 0,
    'url_video' => $p['v'] ?? null, 'creado_en' => date('Y-m-d H:i:s', $base + $i),
    'eliminado_en' => empty($p['del']) ? null : date('Y-m-d H:i:s'),
  ];
  foreach ($p['ph'] as $j => $f) $fotos[] = ['id' => count($fotos) + 1, 'producto_id' => $pid, 'url' => foto($f), 'orden' => $j];
  if ($p['pr']) {
    if (!preg_match('/^(Desde )?\$? ?([\d.]+)$/', $p['pr'], $m)) exit("Precio sin formato conocido en \"{$p['n']}\": {$p['pr']}\n");
    $precios[] = ['id' => count($precios) + 1, 'producto_id' => $pid, 'lista_precio_id' => 1, 'tipo_precio' => $m[1] ? 'desde' : 'fijo', 'monto' => (int)str_replace('.', '', $m[2])];
  }
}

/* trabajos realizados: cada grupo de fotos es un trabajo. Títulos como los muestra la web. */
$titulos = ['placares-a-medida' => 'Placard a medida', 'cocinas-a-medida' => 'Cocina a medida', 'estetica-proyectos' => 'Salón a medida'];
$trabajos = $trabajos_fotos = [];
foreach ($d['projects'] as $clave_grupo => $grupo) {
  foreach ($grupo as $i => $imgs) {
    $tid = count($trabajos) + 1;
    $trabajos[] = ['id' => $tid, 'titulo' => ($titulos[$clave_grupo] ?? $clave_grupo) . ' ' . str_pad($i + 1, 2, '0', STR_PAD_LEFT), 'visible' => 1,
      'creado_en' => date('Y-m-d H:i:s', $base + count($trabajos))];
    foreach ($imgs as $j => $f) $trabajos_fotos[] = ['id' => count($trabajos_fotos) + 1, 'trabajo_id' => $tid, 'url' => foto($f), 'orden' => $j];
  }
}

/* vendedores: persona + empleado con link + teléfono principal */
$personas = $empleados = $telefonos = [];
foreach ($d['sellers'] ?? [] as $link => $tel) {
  $per = count($personas) + 1;
  $personas[] = ['id' => $per, 'nombre' => mb_convert_case($link, MB_CASE_TITLE), 'apellido' => ''];
  $empleados[] = ['id' => $per, 'persona_id' => $per, 'puesto' => 'Vendedor', 'lugar_trabajo' => 'showroom', 'link_web' => $link];
  $telefonos[] = ['id' => $per, 'persona_id' => $per, 'numero_local' => substr($tel, 3), 'numero_completo' => $tel, 'es_whatsapp' => 1, 'es_principal' => 1];
}

$sql = "-- Datos iniciales de La Unión: generado por muebleria-next/api/herramientas/migrar-json.php el " . date('d/m/Y H:i') . "
-- desde " . basename($origen) . ": " . count($productos) . " productos, " . count($categorias) . " categorías, " . count($trabajos) . " trabajos, " . count($empleados) . " vendedores.
-- Importar una sola vez en phpMyAdmin, después de base-de-datos.sql. Si algo falla no queda nada a medias (ROLLBACK).

USE `a0101073_launion`;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
START TRANSACTION;

"
  . insertar('roles', [
    ['id' => 1, 'nombre' => 'Administrador', 'descripcion' => 'Todo el sistema', 'permisos' => '["*"]', 'es_sistema' => 1],
    ['id' => 2, 'nombre' => 'Vendedor', 'descripcion' => 'Catálogo con precios del local', 'permisos' => '["precios.ver"]', 'es_sistema' => 1],
    ['id' => 3, 'nombre' => 'Taller', 'descripcion' => 'Catálogo sin precios', 'permisos' => '[]', 'es_sistema' => 1],
  ])
  . insertar('usuarios', [['id' => 1, 'rol_id' => 1, 'nombre_usuario' => 'admin', 'clave_hash' => $hash, 'debe_cambiar_clave' => $clave ? 1 : 0]])
  . insertar('listas_precios', [
    ['id' => 1, 'nombre' => 'Web', 'descripcion' => 'El precio que muestra la web: fijo, desde o rango', 'mostrar_en_web' => 1, 'orden' => 1],
    ['id' => 2, 'nombre' => 'Local', 'descripcion' => 'Precio del local. Interno: no aparece en la web', 'mostrar_en_web' => 0, 'orden' => 2],
  ])
  . insertar('categorias', $categorias)
  . insertar('productos', $productos)
  . insertar('productos_fotos', $fotos)
  . insertar('productos_precios', $precios)
  . insertar('trabajos', $trabajos)
  . insertar('trabajos_fotos', $trabajos_fotos)
  . insertar('personas', $personas)
  . insertar('empleados', $empleados)
  . insertar('telefonos', $telefonos)
  . "COMMIT;\n";

file_put_contents($destino, $sql);
echo "Listo: $destino (" . count($productos) . " productos, " . count($fotos) . " fotos, " . count($precios) . " precios)\n";
if ($clave) echo "Usuario: admin · contraseña temporal: $clave\n";
