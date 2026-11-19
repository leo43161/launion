<?php
/* Caja chica del showroom: el efectivo. Se abre con el efectivo inicial y se cierra contando; si no cuadra, se anota por qué.
   Cada cobro en efectivo de una venta entra solo a la caja abierta (caja_cobro, desde cobro_insertar en ventas.php). Si no hay
   ninguna abierta, espera y entra a la próxima que se abra. Un cobro anulado deja de sumar; si su caja ya cerró, lo que se le
   devuelve al cliente se carga como egreso. Transferencias y tarjetas no pasan por la caja: se muestran aparte, para controlarlas
   en el banco. Pide caja.usar (Vendedor y Administrador). Borrar el movimiento de otro pide caja.anular (el Administrador, por "*"). */

/** Lo que entró menos lo que salió de la caja s, sin los cobros anulados. */
const NETO_SQL = "(SELECT COALESCE(SUM(IF(m.tipo = 'ingreso', m.monto, -m.monto)), 0) FROM caja_movimientos m
  LEFT JOIN cobros co ON co.id = m.cobro_id WHERE m.caja_sesion_id = s.id AND co.anulado_en IS NULL)";
/** Los cobros en efectivo que todavía no entraron a una caja: los de después de que se abrió la última (o de hoy, si nunca hubo una). */
const PENDIENTES_SQL = "FROM cobros co JOIN medios_pago mp ON mp.id = co.medio_pago_id
  WHERE mp.tipo = 'efectivo' AND co.anulado_en IS NULL AND NOT EXISTS (SELECT 1 FROM caja_movimientos m WHERE m.cobro_id = co.id)
    AND co.cobrado_en >= COALESCE((SELECT MAX(abierta_en) FROM caja_sesiones), CURDATE())";

/** El nombre del usuario de la columna (abierta_por, creado_por…). */
function quien_sql($columna) {
  return "(SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.nombre, p.apellido)), ''), u.nombre_usuario) FROM usuarios u
    LEFT JOIN empleados e ON e.id = u.empleado_id LEFT JOIN personas p ON p.id = e.persona_id WHERE u.id = $columna)";
}

/** Las cajas con sus cuentas (CajaSesion en lib/tipos.ts). Cerrada, "esperado" es el que se guardó al cerrar. */
function cajas_sql() {
  return "SELECT s.id, s.abierta_en, s.cerrada_en, s.monto_inicial, s.monto_contado, s.motivo_diferencia,
      " . quien_sql('s.abierta_por') . " AS abierta_por, " . quien_sql('s.cerrada_por') . " AS cerrada_por,
      (SELECT COALESCE(SUM(m.monto), 0) FROM caja_movimientos m JOIN cobros co ON co.id = m.cobro_id WHERE m.caja_sesion_id = s.id AND co.anulado_en IS NULL) AS cobros,
      (SELECT COALESCE(SUM(m.monto), 0) FROM caja_movimientos m WHERE m.caja_sesion_id = s.id AND m.tipo = 'ingreso' AND m.cobro_id IS NULL) AS otros_ingresos,
      (SELECT COALESCE(SUM(m.monto), 0) FROM caja_movimientos m WHERE m.caja_sesion_id = s.id AND m.tipo = 'egreso') AS egresos,
      COALESCE(s.monto_esperado, s.monto_inicial + " . NETO_SQL . ") AS esperado
    FROM caja_sesiones s";
}

function rubro_cobro() {
  return consulta("SELECT id FROM caja_rubros WHERE nombre = 'Cobro de venta'")->fetchColumn() ?: fallar('Faltan los rubros de la caja: hay que importar db/arreglo-caja.sql.', 500);
}

/** El cobro en efectivo entra a la caja abierta. Si es con otro medio o no hay caja abierta, no hace nada (entra al abrir la próxima). */
function caja_cobro($cobro) {
  consulta("INSERT INTO caja_movimientos (caja_sesion_id, tipo, caja_rubro_id, monto, cobro_id, creado_por)
    SELECT s.id, 'ingreso', r.id, co.monto, co.id, ? FROM cobros co JOIN medios_pago mp ON mp.id = co.medio_pago_id AND mp.tipo = 'efectivo'
      JOIN caja_sesiones s ON s.cerrada_en IS NULL JOIN caja_rubros r ON r.nombre = 'Cobro de venta'
    WHERE co.id = ? LIMIT 1", [usuario()['id'], $cobro]);
}

/** ?id=: esa caja. Sin id: la abierta o, si no hay, la última. Con sus movimientos, lo cobrado con otros medios mientras estuvo
    abierta, los cobros en efectivo que esperan una caja y los rubros para cargar movimientos. */
function caja_ver() {
  exigir('caja.usar');
  $id = (int)($_GET['id'] ?? 0);
  $s = consulta(cajas_sql() . ($id ? ' WHERE s.id = ?' : ' ORDER BY s.cerrada_en IS NULL DESC, s.id DESC LIMIT 1'), $id ? [$id] : [])->fetch() ?: null;
  if ($id && !$s) fallar('No existe esa caja.', 404);
  salir([
    'sesion' => $s,
    'movimientos' => $s ? consulta("SELECT m.id, m.tipo, r.nombre AS rubro, m.monto, m.descripcion, COALESCE(co.cobrado_en, m.creado_en) AS hora,
        m.creado_por AS creado_por_id, " . quien_sql('COALESCE(co.creado_por, m.creado_por)') . " AS creado_por, m.cobro_id, co.anulado_en,
        v.id AS venta_id, v.numero AS venta_numero, TRIM(CONCAT_WS(' ', pe.nombre, pe.apellido)) AS cliente
      FROM caja_movimientos m JOIN caja_rubros r ON r.id = m.caja_rubro_id
      LEFT JOIN cobros co ON co.id = m.cobro_id LEFT JOIN ventas v ON v.id = co.venta_id
      LEFT JOIN clientes c ON c.id = v.cliente_id LEFT JOIN personas pe ON pe.id = c.persona_id
      WHERE m.caja_sesion_id = ? ORDER BY hora DESC, m.id DESC", [$s['id']])->fetchAll() : [],
    // Lo que se cobró con transferencia o tarjeta mientras la caja estuvo abierta (con el recargo: lo que se le cobró al cliente)
    'otros_medios' => $s ? consulta("SELECT mp.nombre AS medio, COUNT(*) AS cobros, SUM(co.total_cobrado) AS total
      FROM cobros co JOIN medios_pago mp ON mp.id = co.medio_pago_id
      WHERE mp.tipo NOT IN ('efectivo', 'credito_casa') AND co.anulado_en IS NULL AND co.cobrado_en >= ? AND co.cobrado_en <= COALESCE(?, NOW())
      GROUP BY mp.id, mp.nombre ORDER BY mp.orden", [$s['abierta_en'], $s['cerrada_en']])->fetchAll() : [],
    'pendientes' => consulta('SELECT COUNT(*) AS cobros, COALESCE(SUM(co.monto), 0) AS total ' . PENDIENTES_SQL)->fetch(),
    'rubros' => consulta("SELECT id, nombre, tipo FROM caja_rubros WHERE activo = 1 AND nombre <> 'Cobro de venta' ORDER BY tipo DESC, id")->fetchAll(),
  ]);
}

/** {monto_inicial}: abre la caja. Los cobros en efectivo que esperaban entran a esta. */
function caja_abrir() {
  exigir('caja.usar');
  $inicial = round(numero(entrada(), 'monto_inicial', 0, 999999999999, 'Efectivo inicial') ?? fallar('Poné con cuánto efectivo arranca la caja.'), 2);
  $rubro = rubro_cobro();
  db()->beginTransaction();
  // ponytail: si dos la abren en el mismo instante pueden quedar dos abiertas; poco probable con un solo showroom
  if (consulta('SELECT id FROM caja_sesiones WHERE cerrada_en IS NULL FOR UPDATE')->fetchColumn()) fallar('La caja ya está abierta.', 409);
  $pendientes = consulta('SELECT co.id ' . PENDIENTES_SQL)->fetchAll(PDO::FETCH_COLUMN); // antes de abrir: miran cuándo se abrió la última
  consulta('INSERT INTO caja_sesiones (abierta_por, monto_inicial) VALUES (?, ?)', [usuario()['id'], $inicial]);
  $id = (int)db()->lastInsertId();
  foreach ($pendientes as $cobro)
    consulta("INSERT INTO caja_movimientos (caja_sesion_id, tipo, caja_rubro_id, monto, cobro_id, creado_por) SELECT ?, 'ingreso', ?, monto, id, ? FROM cobros WHERE id = ?",
      [$id, $rubro, usuario()['id'], $cobro]);
  db()->commit();
  salir(['id' => $id]);
}

/** {tipo, caja_rubro_id, monto, descripcion}: un ingreso o un egreso cargado a mano en la caja abierta. */
function caja_movimiento() {
  exigir('caja.usar');
  $e = entrada();
  $tipo = in_array($e['tipo'] ?? '', ['ingreso', 'egreso'], true) ? $e['tipo'] : fallar('Elegí si entra o sale plata.');
  $rubro = consulta("SELECT id FROM caja_rubros WHERE id = ? AND tipo = ? AND activo = 1 AND nombre <> 'Cobro de venta'", [(int)($e['caja_rubro_id'] ?? 0), $tipo])->fetchColumn() ?: fallar('Elegí el rubro.');
  $monto = round(numero($e, 'monto', 0.01, 999999999999, 'Monto') ?? fallar('Poné el monto.'), 2);
  $descripcion = texto($e, 'descripcion', 160, 'Detalle');
  db()->beginTransaction();
  $s = consulta('SELECT s.id, s.monto_inicial + ' . NETO_SQL . ' AS esperado FROM caja_sesiones s WHERE s.cerrada_en IS NULL FOR UPDATE')->fetch()
    ?: fallar('La caja está cerrada: abrila para cargar movimientos.');
  if ($tipo === 'egreso' && $monto > $s['esperado']) fallar('En la caja tiene que haber ' . plata($s['esperado']) . ': no alcanza para sacar ' . plata($monto) . '.');
  consulta('INSERT INTO caja_movimientos (caja_sesion_id, tipo, caja_rubro_id, monto, descripcion, creado_por) VALUES (?, ?, ?, ?, ?, ?)',
    [$s['id'], $tipo, $rubro, $monto, $descripcion, usuario()['id']]);
  db()->commit();
  salir(['ok' => true]);
}

/** {id}: borra un movimiento cargado a mano, mientras la caja siga abierta. Los cobros de las ventas se anulan desde la venta. */
function caja_movimiento_eliminar() {
  exigir('caja.usar');
  $m = consulta('SELECT m.id, m.cobro_id, m.creado_por, s.cerrada_en FROM caja_movimientos m JOIN caja_sesiones s ON s.id = m.caja_sesion_id WHERE m.id = ?',
    [(int)(entrada()['id'] ?? 0)])->fetch() ?: fallar('Ese movimiento ya no existe.', 404);
  if ($m['cobro_id']) fallar('Es el cobro de una venta: se anula desde la venta.');
  if ($m['cerrada_en']) fallar('Esa caja ya cerró: para corregirlo, cargá un movimiento en la caja abierta.');
  if ($m['creado_por'] != usuario()['id'] && !puede('caja.anular')) fallar('Solo quien cargó el movimiento puede borrarlo.', 403);
  consulta('DELETE FROM caja_movimientos WHERE id = ?', [$m['id']]);
  salir(['ok' => true]);
}

/** {monto_contado, motivo}: cierra la caja abierta. Si lo contado no es lo esperado, pide el motivo. */
function caja_cerrar() {
  exigir('caja.usar');
  $e = entrada();
  $contado = round(numero($e, 'monto_contado', 0, 999999999999, 'Efectivo contado') ?? fallar('Poné cuánto efectivo contaste.'), 2);
  $motivo = texto($e, 'motivo', 2000, 'Motivo');
  db()->beginTransaction();
  $s = consulta('SELECT s.id, s.monto_inicial + ' . NETO_SQL . ' AS esperado FROM caja_sesiones s WHERE s.cerrada_en IS NULL FOR UPDATE')->fetch()
    ?: fallar('La caja ya está cerrada.', 409);
  $esperado = round($s['esperado'], 2);
  $diferencia = round($contado - $esperado, 2);
  if ($diferencia && !$motivo) fallar('No cuadra: ' . ($diferencia > 0 ? 'sobran ' : 'faltan ') . plata(abs($diferencia)) . '. Escribí por qué.');
  consulta('UPDATE caja_sesiones SET cerrada_en = NOW(), cerrada_por = ?, monto_esperado = ?, monto_contado = ?, motivo_diferencia = ? WHERE id = ?',
    [usuario()['id'], $esperado, $contado, $diferencia ? $motivo : null, $s['id']]);
  db()->commit();
  salir(['id' => (int)$s['id']]);
}

/** Todas las cajas, de la más nueva a la más vieja. La pantalla las agrupa por mes. */
function caja_historial() {
  exigir('caja.usar');
  // ponytail: trae todas (una por día); filtrar por mes en la API cuando pasen de unos miles
  salir(['cajas' => consulta(cajas_sql() . ' ORDER BY s.id DESC')->fetchAll()]);
}
