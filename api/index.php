<?php
/* API del panel y de la web. Se llama api/index.php?r=<ruta> y responde JSON.
   Todas las rutas piden el token del ingreso en "Authorization: Bearer <token>", menos auth/ingresar y web (la web pública). */
require __DIR__ . '/lib.php';
foreach (glob(__DIR__ . '/rutas/*.php') as $archivo) require $archivo;

if (strlen(CFG['jwt_secreto']) < 32 || CFG['jwt_secreto'] === CFG['db_clave'])
  fallar('jwt_secreto en api/config.php tiene que ser una clave propia de al menos 32 caracteres (no la de la base). Generala con: php -r "echo bin2hex(random_bytes(32));"', 500);

$rutas = [
  'POST auth/ingresar' => 'auth_ingresar',
  'GET auth/yo' => 'auth_yo',
  'POST auth/clave' => 'auth_clave',
  'GET catalogo' => 'catalogo_listar',
  'GET producto' => 'producto_ver',
  'POST producto/guardar' => 'producto_guardar',
  'POST producto/estado' => 'producto_estado',
  'POST subir' => 'subir_archivo',
  'GET vendedores' => 'vendedores_listar',
  'POST vendedores/guardar' => 'vendedores_guardar',
  'GET web' => 'web_catalogo',
];
$funcion = $rutas[$_SERVER['REQUEST_METHOD'] . ' ' . ($_GET['r'] ?? '')] ?? null;
if (!$funcion) fallar('No existe esa ruta.', 404);
$funcion();
