<?php
/* Copiá este archivo como config.php y completalo. config.php no se sube al repositorio.
   Secreto del token: php -r "echo bin2hex(random_bytes(32));" */
return [
  'db_host' => 'localhost',
  'db_nombre' => 'a0101073_launion',
  'db_usuario' => 'a0101073_launion',
  'db_clave' => '',
  'jwt_secreto' => '', // 64 letras y números, distinta de db_clave: php -r "echo bin2hex(random_bytes(32));"
  'token_horas' => 12, // una jornada: después hay que volver a ingresar
  // Solo para probar en la compu (Next en localhost:3000 y PHP en otro puerto). En el servidor va vacío: es la misma web.
  'cors_origen' => '',
  // Donde se guardan las fotos y videos subidos. Se devuelven como assets/productos/subidos/<archivo>, relativo a la web.
  'carpeta_subidos' => __DIR__ . '/../assets/productos/subidos',
];
