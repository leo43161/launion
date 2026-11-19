<?php
/* CRM: la agenda de clientes y la ficha de cada uno, con sus compras, lo que pagó y lo que debe, y sus notas y recordatorios.
   Pide ventas.crear (Vendedor y Administrador). Las cuentas no cuentan las ventas canceladas, igual que la lista de ventas:
   lo financiado con el crédito de la casa cuenta como pagado (la deuda la siguen ellos) y se muestra aparte.
   Una nota con fecha (recordar_el) es un recordatorio: sale en "Para esta semana" hasta que alguien lo marca como hecho.
   La búsqueda del formulario de venta (clientes) y el cliente para cargarlo (cliente) están en ventas.php. */

const USUARIO_NOMBRE_SQL = "COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.nombre, p.apellido)), ''), u.nombre_usuario)"; // u = usuarios, p = su persona

/** Todos los clientes con sus cuentas, los recordatorios pendientes y las ventas que falta entregar. */
function clientes_agenda() {
  exigir('ventas.crear');
  salir([
    // ponytail: trae todos y la pantalla filtra; paginar cuando pasen de unos miles
    'clientes' => consulta("SELECT c.id, TRIM(CONCAT_WS(' ', pe.nombre, pe.apellido)) AS nombre, pe.dni, c.tipo,
        (SELECT cc.nombre_comercio FROM clientes_comercios cc WHERE cc.cliente_id = c.id ORDER BY cc.id LIMIT 1) AS comercio,
        (SELECT t.numero_completo FROM telefonos t WHERE t.persona_id = pe.id ORDER BY t.es_principal DESC, t.id LIMIT 1) AS telefono,
        (SELECT l.nombre FROM direcciones d JOIN localidades l ON l.id = d.localidad_id
          WHERE d.persona_id = pe.id AND d.tipo = 'particular' ORDER BY d.es_principal DESC, d.id DESC LIMIT 1) AS localidad,
        COALESCE(v.compras, 0) AS compras, COALESCE(v.comprado, 0) AS comprado, COALESCE(v.pagado, 0) AS pagado,
        COALESCE(v.financiado, 0) AS financiado, v.ultima_compra,
        (SELECT COUNT(*) FROM clientes_notas n WHERE n.cliente_id = c.id AND n.recordar_el IS NOT NULL AND n.hecho_en IS NULL) AS recordatorios
      FROM clientes c JOIN personas pe ON pe.id = c.persona_id
      LEFT JOIN (SELECT v.cliente_id, COUNT(*) AS compras, SUM(v.total) AS comprado, SUM(" . PAGADO_SQL . ") AS pagado,
          SUM(" . FINANCIADO_SQL . ") AS financiado, MAX(v.vendido_en) AS ultima_compra
        FROM ventas v WHERE v.estado <> 'cancelada' GROUP BY v.cliente_id) v ON v.cliente_id = c.id
      ORDER BY v.ultima_compra IS NULL, v.ultima_compra DESC, nombre")->fetchAll(),
    // La pantalla muestra los vencidos y los de los próximos 7 días
    'recordatorios' => consulta("SELECT n.id, n.cliente_id, TRIM(CONCAT_WS(' ', pe.nombre, pe.apellido)) AS cliente,
        (SELECT t.numero_completo FROM telefonos t WHERE t.persona_id = pe.id ORDER BY t.es_principal DESC, t.id LIMIT 1) AS telefono,
        n.texto, n.recordar_el, " . USUARIO_NOMBRE_SQL . " AS creado_por
      FROM clientes_notas n JOIN clientes c ON c.id = n.cliente_id JOIN personas pe ON pe.id = c.persona_id
      JOIN usuarios u ON u.id = n.creado_por LEFT JOIN empleados e ON e.id = u.empleado_id LEFT JOIN personas p ON p.id = e.persona_id
      WHERE n.recordar_el IS NOT NULL AND n.hecho_en IS NULL ORDER BY n.recordar_el, n.id")->fetchAll(),
    // Las que falta entregar: la pantalla muestra las atrasadas y las de los próximos 7 días, con el saldo a cobrar
    'entregas' => ventas_filas("v.estado <> 'cancelada' AND v.entregado_en IS NULL"),
  ]);
}

/** ?id=: los datos del cliente, todas sus compras (también las canceladas) y sus notas. */
function cliente_ficha() {
  exigir('ventas.crear');
  $id = (int)($_GET['id'] ?? 0);
  salir([
    'cliente' => cliente_datos($id),
    'ventas' => ventas_filas('v.cliente_id = ?', [$id]),
    'notas' => consulta("SELECT n.id, n.texto, n.recordar_el, n.hecho_en, n.creado_en, n.creado_por AS creado_por_id, " . USUARIO_NOMBRE_SQL . " AS creado_por,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', ph.nombre, ph.apellido)), ''), uh.nombre_usuario) AS hecho_por
      FROM clientes_notas n JOIN usuarios u ON u.id = n.creado_por LEFT JOIN empleados e ON e.id = u.empleado_id LEFT JOIN personas p ON p.id = e.persona_id
      LEFT JOIN usuarios uh ON uh.id = n.hecho_por LEFT JOIN empleados eh ON eh.id = uh.empleado_id LEFT JOIN personas ph ON ph.id = eh.persona_id
      WHERE n.cliente_id = ? ORDER BY n.creado_en DESC, n.id DESC", [$id])->fetchAll(),
  ]);
}

/** Los datos del cliente desde su ficha (VentaGuardar["cliente"] con id): se revisan y se guardan igual que al vender.
    Si cambió la dirección se agrega otra: las ventas anteriores conservan la suya. */
function cliente_editar() {
  exigir('ventas.crear');
  $c = entrada();
  $id = (int)($c['id'] ?? 0);
  if (!consulta('SELECT 1 FROM clientes WHERE id = ?', [$id])->fetchColumn()) fallar('No existe ese cliente.', 404);
  $datos = cliente_validar($c);
  db()->beginTransaction();
  cliente_guardar($id, $datos);
  db()->commit();
  salir(['ok' => true]);
}

/** {cliente_id, texto, recordar_el?}: una nota nueva; con fecha, un recordatorio. */
function cliente_nota() {
  exigir('ventas.crear');
  $e = entrada();
  $cliente = (int)($e['cliente_id'] ?? 0);
  if (!consulta('SELECT 1 FROM clientes WHERE id = ?', [$cliente])->fetchColumn()) fallar('No existe ese cliente.', 404);
  $texto = texto($e, 'texto', 2000, 'Nota') ?? fallar('Escribí la nota.');
  $fecha = fecha($e, 'recordar_el', 'Fecha del recordatorio');
  consulta('INSERT INTO clientes_notas (cliente_id, texto, recordar_el, creado_por) VALUES (?, ?, ?, ?)', [$cliente, $texto, $fecha, usuario()['id']]);
  salir(['id' => (int)db()->lastInsertId()]);
}

/** {id, hecha}: marca el recordatorio como hecho, o lo vuelve a dejar pendiente. */
function cliente_nota_estado() {
  exigir('ventas.crear');
  $e = entrada();
  $id = (int)($e['id'] ?? 0);
  if (!consulta('SELECT 1 FROM clientes_notas WHERE id = ?', [$id])->fetchColumn()) fallar('Esa nota ya no existe.', 404);
  if (!empty($e['hecha'])) consulta('UPDATE clientes_notas SET hecho_en = NOW(), hecho_por = ? WHERE id = ? AND hecho_en IS NULL', [usuario()['id'], $id]);
  else consulta('UPDATE clientes_notas SET hecho_en = NULL, hecho_por = NULL WHERE id = ?', [$id]);
  salir(['ok' => true]);
}

/** {id}: borra una nota. Solo quien la escribió, o quien puede anular ventas (el Administrador). */
function cliente_nota_eliminar() {
  exigir('ventas.crear');
  $n = consulta('SELECT id, creado_por FROM clientes_notas WHERE id = ?', [(int)(entrada()['id'] ?? 0)])->fetch() ?: fallar('Esa nota ya no existe.', 404);
  if ($n['creado_por'] != usuario()['id'] && !puede('ventas.anular')) fallar('Solo quien escribió la nota puede borrarla.', 403);
  consulta('DELETE FROM clientes_notas WHERE id = ?', [$n['id']]);
  salir(['ok' => true]);
}
