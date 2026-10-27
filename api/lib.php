<?php
/* Piezas compartidas de la API: respuestas, base de datos, token y permisos. PHP 7.4, sin dependencias. */

date_default_timezone_set('America/Argentina/Tucuman');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (!is_file(__DIR__ . '/config.php')) {
  http_response_code(500);
  exit('{"error":"Falta api/config.php: copiá config.example.php como config.php y completalo."}');
}
define('CFG', require __DIR__ . '/config.php');

if (CFG['cors_origen'] !== '') {
  header('Access-Control-Allow-Origin: ' . CFG['cors_origen']);
  header('Access-Control-Allow-Headers: Authorization, Content-Type');
  header('Access-Control-Allow-Methods: GET, POST');
  header('Vary: Origin');
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

function salir($datos, $codigo = 200) {
  http_response_code($codigo);
  echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function fallar($mensaje, $codigo = 400) { salir(['error' => $mensaje], $codigo); }

// Lo que no se esperaba (base caída, error de SQL): al registro del servidor, y al usuario un mensaje sin detalles.
set_exception_handler(function ($e) {
  error_log((string)$e);
  if (db_conectada() && db()->inTransaction()) db()->rollBack();
  fallar('Error del servidor. Probá de nuevo en un rato.', 500);
});

/** El cuerpo JSON del pedido. */
function entrada() {
  static $d;
  return $d ?? ($d = json_decode(file_get_contents('php://input'), true) ?: []);
}

/* ---------- base de datos ---------- */

function db_conectada() { return isset($GLOBALS['__pdo']); }
function db() {
  return $GLOBALS['__pdo'] ?? ($GLOBALS['__pdo'] = new PDO(
    'mysql:host=' . CFG['db_host'] . ';dbname=' . CFG['db_nombre'] . ';charset=utf8mb4', CFG['db_usuario'], CFG['db_clave'], [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false, // números como números
      // Mismo orden de texto que las tablas (la base de Ferozo viene con otro: error 1267) y hora de Tucumán para CURRENT_TIMESTAMP y CURDATE()
      PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '-03:00'",
    ]));
}
function consulta($sql, $params = []) {
  $s = db()->prepare($sql);
  $s->execute($params);
  return $s;
}
function es_duplicado($e) { return $e instanceof PDOException && ($e->errorInfo[1] ?? 0) === 1062; }

/* ---------- token (JWT HS256) ---------- */

function b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function firma($cuerpo) { return b64u(hash_hmac('sha256', $cuerpo, CFG['jwt_secreto'], true)); }

function token_crear($usuario_id) {
  $cuerpo = b64u('{"alg":"HS256","typ":"JWT"}') . '.' . b64u(json_encode(['sub' => $usuario_id, 'iat' => time(), 'exp' => time() + CFG['token_horas'] * 3600]));
  return $cuerpo . '.' . firma($cuerpo);
}
/** Los datos del token si la firma es nuestra y no venció. El "alg" del encabezado no se lee: siempre HS256. */
function token_leer($token) {
  $p = explode('.', $token);
  if (count($p) !== 3 || !hash_equals(firma("$p[0].$p[1]"), $p[2])) return null;
  $d = json_decode(base64_decode(strtr($p[1], '-_', '+/')), true);
  return is_array($d) && ($d['exp'] ?? 0) > time() ? $d : null;
}

/* ---------- usuario y permisos ---------- */

/** El usuario del token, con los permisos de su rol. Se lee de la base en cada pedido: si lo desactivan, se corta al instante. */
function usuario() {
  static $u;
  if ($u) return $u;
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  $d = preg_match('/^Bearer\s+(\S+)$/', $h, $m) ? token_leer($m[1]) : null;
  if ($d) $u = consulta(
    "SELECT u.id, u.nombre_usuario, u.debe_cambiar_clave, r.nombre AS rol, r.permisos, TRIM(CONCAT_WS(' ', p.nombre, p.apellido)) AS nombre
     FROM usuarios u JOIN roles r ON r.id = u.rol_id
     LEFT JOIN empleados e ON e.id = u.empleado_id LEFT JOIN personas p ON p.id = e.persona_id
     WHERE u.id = ? AND u.activo = 1", [$d['sub']])->fetch();
  if (!$u) fallar('La sesión venció. Volvé a ingresar.', 401);
  $u['permisos'] = json_decode($u['permisos'], true) ?: [];
  $u['debe_cambiar_clave'] = (bool)$u['debe_cambiar_clave'];
  $u['nombre'] = $u['nombre'] ?: $u['nombre_usuario'];
  return $u;
}
/** "*" = todos los permisos (el rol Administrador). */
function puede($permiso) {
  $p = usuario()['permisos'];
  return in_array('*', $p, true) || in_array($permiso, $p, true);
}
function exigir($permiso) {
  if (!puede($permiso)) fallar('Tu usuario no tiene permiso para esto.', 403);
}

/* ---------- textos ---------- */

/** Texto del cuerpo: recortado, null si está vacío, y error si pasa el largo de la columna. */
function texto($datos, $clave, $max, $nombre) {
  $v = trim((string)($datos[$clave] ?? ''));
  if (mb_strlen($v) > $max) fallar("$nombre: hasta $max caracteres.");
  return $v === '' ? null : $v;
}
function slug($s) {
  $s = strtr(mb_strtolower($s), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
  return trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-');
}
