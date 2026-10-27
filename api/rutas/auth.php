<?php
/* Ingreso al panel y contraseña. */

/** {usuario, clave} → {token} */
function auth_ingresar() {
  $e = entrada();
  $u = consulta('SELECT id, clave_hash FROM usuarios WHERE nombre_usuario = ? AND activo = 1', [trim((string)($e['usuario'] ?? ''))])->fetch();
  if (!$u || !password_verify((string)($e['clave'] ?? ''), $u['clave_hash'])) {
    sleep(1); // ponytail: freno simple contra fuerza bruta; bloqueo por IP e intentos si hace falta
    fallar('Usuario o contraseña incorrectos.', 401);
  }
  consulta('UPDATE usuarios SET ultimo_ingreso_en = NOW() WHERE id = ?', [$u['id']]);
  salir(['token' => token_crear($u['id'])]);
}

function auth_yo() {
  salir(['usuario' => usuario()]);
}

/** {actual, nueva}. También la usa el primer ingreso, cuando la contraseña es temporal. */
function auth_clave() {
  $u = usuario();
  $e = entrada();
  $nueva = (string)($e['nueva'] ?? '');
  if (mb_strlen($nueva) < 8) fallar('La contraseña nueva tiene que tener al menos 8 caracteres.');
  $hash = consulta('SELECT clave_hash FROM usuarios WHERE id = ?', [$u['id']])->fetchColumn();
  if (!password_verify((string)($e['actual'] ?? ''), $hash)) fallar('La contraseña actual no es correcta.');
  consulta('UPDATE usuarios SET clave_hash = ?, debe_cambiar_clave = 0 WHERE id = ?', [password_hash($nueva, PASSWORD_DEFAULT), $u['id']]);
  salir(['ok' => true]);
}
