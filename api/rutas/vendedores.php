<?php
/* Vendedores con link propio: launionmuebles.com.ar/<link> abre la web con todos los WhatsApp yendo a su número.
   Son empleados con link_web; su teléfono es el principal de la persona. */

// Rutas y carpetas que ya existen en la web
const LINKS_RESERVADOS = ['admin', 'administracion', 'api', 'assets', 'data', 'dev', 'index', 'seguimiento', '_next'];

function vendedores_listar() {
  usuario();
  salir(['vendedores' => consulta(
    'SELECT e.id, e.link_web, p.nombre, t.numero_completo AS telefono
     FROM empleados e JOIN personas p ON p.id = e.persona_id
     LEFT JOIN telefonos t ON t.persona_id = p.id AND t.es_principal = 1
     WHERE e.link_web IS NOT NULL ORDER BY p.nombre')->fetchAll()]);
}

/** {vendedores: [{id?, nombre, link_web, telefono}]}: la lista completa. Al que no viene se le quita el link (sigue como empleado). */
function vendedores_guardar() {
  exigir('catalogo.editar');
  $lista = entrada()['vendedores'] ?? null;
  if (!is_array($lista)) fallar('Datos inválidos.');
  $links = [];
  foreach ($lista as $i => &$v) {
    $n = $i + 1;
    $v['nombre'] = texto($v, 'nombre', 80, "Vendedor $n");
    $v['link_web'] = strtolower(trim((string)($v['link_web'] ?? '')));
    $v['telefono'] = preg_replace('/\D/', '', (string)($v['telefono'] ?? ''));
    if (!$v['nombre']) fallar("Vendedor $n: falta el nombre.");
    if (!preg_match('/^[a-z0-9-]{1,30}$/', $v['link_web'])) fallar("{$v['nombre']}: el link va en una sola palabra, sin espacios, tildes ni símbolos.");
    if (in_array($v['link_web'], LINKS_RESERVADOS, true)) fallar("{$v['nombre']}: “{$v['link_web']}” es una sección de la web. Elegí otro link.");
    if (isset($links[$v['link_web']])) fallar("El link “{$v['link_web']}” está repetido.");
    if (!preg_match('/^549\d{10}$/', $v['telefono'])) fallar("{$v['nombre']}: el WhatsApp va con código de área, sin 0 ni 15. Ej: 381 319-6842");
    $links[$v['link_web']] = true;
  }
  unset($v);

  db()->beginTransaction();
  consulta('UPDATE empleados SET link_web = NULL WHERE link_web IS NOT NULL'); // primero se liberan: dos vendedores pueden intercambiar links
  foreach ($lista as $v) {
    $persona = !empty($v['id']) ? consulta('SELECT persona_id FROM empleados WHERE id = ?', [$v['id']])->fetchColumn() : null;
    if ($persona) {
      consulta('UPDATE personas SET nombre = ? WHERE id = ?', [$v['nombre'], $persona]);
      consulta('UPDATE empleados SET link_web = ? WHERE id = ?', [$v['link_web'], $v['id']]);
    } else {
      consulta("INSERT INTO personas (nombre, apellido) VALUES (?, '')", [$v['nombre']]);
      $persona = (int)db()->lastInsertId();
      consulta("INSERT INTO empleados (persona_id, puesto, lugar_trabajo, link_web) VALUES (?, 'Vendedor', 'showroom', ?)", [$persona, $v['link_web']]);
    }
    $numero_local = substr($v['telefono'], 3); // sin el 549: código de área + número
    $tel = consulta('SELECT id FROM telefonos WHERE persona_id = ? AND es_principal = 1', [$persona])->fetchColumn();
    if ($tel) consulta('UPDATE telefonos SET numero_local = ?, numero_completo = ?, es_whatsapp = 1 WHERE id = ?', [$numero_local, $v['telefono'], $tel]);
    else consulta('INSERT INTO telefonos (persona_id, numero_local, numero_completo, es_whatsapp, es_principal) VALUES (?, ?, ?, 1, 1)', [$persona, $numero_local, $v['telefono']]);
  }
  db()->commit();
  vendedores_listar();
}
