<?php
/* Usuarios del panel: alta, edición, contraseña temporal y eliminación. Solo con el permiso usuarios.editar
   (el Administrador lo tiene por "*"). Cada usuario es un empleado: su nombre está en la persona.
   Para cambiar la contraseña propia está auth/clave, que la puede usar cualquiera. */

function usuarios_listar() {
  exigir('usuarios.editar');
  salir([
    'usuarios' => consulta("SELECT u.id, u.nombre_usuario, u.rol_id, r.nombre AS rol, u.activo, u.debe_cambiar_clave, u.ultimo_ingreso_en,
        TRIM(CONCAT_WS(' ', p.nombre, p.apellido)) AS nombre
      FROM usuarios u JOIN roles r ON r.id = u.rol_id
      LEFT JOIN empleados e ON e.id = u.empleado_id LEFT JOIN personas p ON p.id = e.persona_id
      ORDER BY u.activo DESC, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.nombre, p.apellido)), ''), u.nombre_usuario)")->fetchAll(),
    'roles' => consulta('SELECT id, nombre, descripcion FROM roles ORDER BY id')->fetchAll(),
    // Empleados sin cuenta (los vendedores con link, por ejemplo): al crear el usuario se elige uno para no cargar dos veces a la misma persona
    'empleados' => consulta("SELECT e.id, TRIM(CONCAT_WS(' ', p.nombre, p.apellido)) AS nombre, e.puesto
      FROM empleados e JOIN personas p ON p.id = e.persona_id
      WHERE e.fecha_egreso IS NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.empleado_id = e.id) ORDER BY nombre")->fetchAll(),
  ]);
}

/** {id?, nombre, nombre_usuario, rol_id, clave, activo, empleado_id?}. Con clave, queda como temporal: la persona elige una propia al ingresar. */
function usuario_guardar() {
  exigir('usuarios.editar');
  $e = entrada();
  $id = (int)($e['id'] ?? 0); // 0 = alta
  $yo = usuario()['id'];
  $nombre = texto($e, 'nombre', 80, 'Nombre');
  $nombre_usuario = strtolower(trim((string)($e['nombre_usuario'] ?? '')));
  $rol = consulta('SELECT id, nombre FROM roles WHERE id = ?', [(int)($e['rol_id'] ?? 0)])->fetch();
  $clave = (string)($e['clave'] ?? '');
  $activo = !empty($e['activo']) ? 1 : 0;
  if (!$nombre) fallar('Escribí el nombre de la persona.');
  if (!preg_match('/^[a-z0-9._-]{3,30}$/', $nombre_usuario)) fallar('El usuario va en una sola palabra de 3 a 30 letras o números, sin espacios ni tildes. Ej: martin');
  if (!$rol) fallar('Elegí el rol.');
  if ((!$id || $clave !== '') && mb_strlen($clave) < 8) fallar('La contraseña tiene que tener al menos 8 caracteres.');

  db()->beginTransaction();
  $actual = $id ? consulta('SELECT rol_id, empleado_id FROM usuarios WHERE id = ? FOR UPDATE', [$id])->fetch() : null;
  if ($id && !$actual) fallar('No existe ese usuario.', 404);
  if ($id === $yo && ((int)$actual['rol_id'] !== (int)$rol['id'] || !$activo)) fallar('No podés cambiar tu propio rol ni desactivarte: pedíselo a otro administrador.');

  // La persona: la del usuario, la del empleado elegido o una nueva
  $empleado = $actual['empleado_id'] ?? (!$id && !empty($e['empleado_id']) ? (int)$e['empleado_id'] : null);
  if ($empleado && !$id && consulta('SELECT 1 FROM usuarios WHERE empleado_id = ?', [$empleado])->fetchColumn()) fallar('Ese empleado ya tiene usuario.');
  $persona = $empleado ? consulta('SELECT persona_id FROM empleados WHERE id = ?', [$empleado])->fetchColumn() : null;
  if ($persona) {
    consulta("UPDATE personas SET nombre = ?, apellido = '' WHERE id = ?", [$nombre, $persona]);
  } else {
    consulta("INSERT INTO personas (nombre, apellido) VALUES (?, '')", [$nombre]);
    $lugar = ['Vendedor' => 'showroom', 'Taller' => 'fabrica'][$rol['nombre']] ?? 'ambos';
    consulta('INSERT INTO empleados (persona_id, puesto, lugar_trabajo) VALUES (?, ?, ?)', [(int)db()->lastInsertId(), $rol['nombre'], $lugar]);
    $empleado = (int)db()->lastInsertId();
  }

  try {
    if ($id) {
      consulta('UPDATE usuarios SET empleado_id = ?, rol_id = ?, nombre_usuario = ?, activo = ? WHERE id = ?', [$empleado, $rol['id'], $nombre_usuario, $activo, $id]);
    } else {
      consulta('INSERT INTO usuarios (empleado_id, rol_id, nombre_usuario, clave_hash, activo) VALUES (?, ?, ?, ?, ?)',
        [$empleado, $rol['id'], $nombre_usuario, password_hash($clave, PASSWORD_DEFAULT), $activo]);
      $id = (int)db()->lastInsertId();
    }
  } catch (PDOException $ex) {
    if (!es_duplicado($ex)) throw $ex;
    db()->rollBack();
    fallar("Ya existe el usuario “{$nombre_usuario}”. Elegí otro.", 409);
  }
  // Contraseña nueva de alguien que ya existía. La propia no queda temporal: es la que uno eligió
  if ($actual && $clave !== '') consulta('UPDATE usuarios SET clave_hash = ?, debe_cambiar_clave = ? WHERE id = ?', [password_hash($clave, PASSWORD_DEFAULT), $id === $yo ? 0 : 1, $id]);
  db()->commit();
  salir(['id' => $id]);
}

/** {id}. Si ya hizo cambios en el sistema (modelos, precios, presupuestos…), no se puede borrar sin perder a quién fueron:
    se desactiva y no puede ingresar más. Devuelve {eliminado: false} en ese caso. */
function usuario_eliminar() {
  exigir('usuarios.editar');
  $id = (int)(entrada()['id'] ?? 0);
  if ($id === usuario()['id']) fallar('No podés eliminar tu propio usuario.');
  try {
    consulta('DELETE FROM usuarios WHERE id = ?', [$id]);
    salir(['eliminado' => true]);
  } catch (PDOException $ex) {
    if (($ex->errorInfo[1] ?? 0) !== 1451) throw $ex; // 1451: otra tabla lo nombra
    consulta('UPDATE usuarios SET activo = 0 WHERE id = ?', [$id]);
    salir(['eliminado' => false]);
  }
}
