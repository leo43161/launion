<?php
/* Ventas: el formulario de 5 pasos, la ficha de cada venta y sus cobros. Pide ventas.crear (Vendedor y Administrador).
   Cancelar una venta o anular un cobro pide ventas.anular (solo el Administrador, por "*").
   Total = suma de los renglones − descuento, sin recargos de tarjeta. Saldo = total − cobros no anulados.
   El crédito de la casa es un cobro más con los datos de la ficha (cuotas, valor, frecuencia, fecha de inicio, Crédito Nº):
   la deuda la siguen ellos en su sistema, así que para la app lo financiado queda cubierto (FINANCIADO_SQL lo muestra aparte). */

const PAGADO_SQL = '(SELECT COALESCE(SUM(co.monto), 0) FROM cobros co WHERE co.venta_id = v.id AND co.anulado_en IS NULL)';
const FINANCIADO_SQL = "(SELECT COALESCE(SUM(co.monto), 0) FROM cobros co JOIN medios_pago m ON m.id = co.medio_pago_id
  WHERE co.venta_id = v.id AND co.anulado_en IS NULL AND m.tipo = 'credito_casa')";
const ESTADOS_CIVILES = ['soltero', 'casado', 'union_convivencial', 'divorciado', 'viudo'];

function ventas_listar() {
  exigir('ventas.crear');
  // ponytail: trae todas y la pantalla filtra; paginar cuando pasen de unos miles
  salir(['ventas' => consulta("SELECT v.id, v.numero, v.vendido_en, v.fecha_entrega, v.tipo_entrega, v.estado, v.total, v.entregado_en, v.vendedor_id,
      TRIM(CONCAT_WS(' ', pe.nombre, pe.apellido)) AS cliente, pe.dni,
      (SELECT t.numero_completo FROM telefonos t WHERE t.persona_id = pe.id ORDER BY t.es_principal DESC, t.id LIMIT 1) AS telefono,
      (SELECT l.nombre FROM direcciones d JOIN localidades l ON l.id = d.localidad_id
        WHERE d.persona_id = pe.id AND d.tipo = 'particular' ORDER BY d.es_principal DESC, d.id DESC LIMIT 1) AS localidad,
      TRIM(CONCAT_WS(' ', pv.nombre, pv.apellido)) AS vendedor,
      (SELECT GROUP_CONCAT(IF(i.cantidad > 1, CONCAT(i.cantidad, '× ', i.nombre), i.nombre) ORDER BY i.id SEPARATOR ' · ')
        FROM ventas_items i WHERE i.venta_id = v.id) AS muebles,
      " . PAGADO_SQL . ' AS pagado, ' . FINANCIADO_SQL . " AS financiado
    FROM ventas v JOIN clientes c ON c.id = v.cliente_id JOIN personas pe ON pe.id = c.persona_id
    JOIN empleados ev ON ev.id = v.vendedor_id JOIN personas pv ON pv.id = ev.persona_id
    ORDER BY v.numero DESC")->fetchAll()]);
}

function direccion_ver($id) {
  if (!$id) return null;
  return consulta('SELECT d.id, d.calle, d.numero, d.piso, d.departamento, d.barrio, d.localidad_id, l.nombre AS localidad, pr.nombre AS provincia
    FROM direcciones d JOIN localidades l ON l.id = d.localidad_id JOIN provincias pr ON pr.id = l.provincia_id WHERE d.id = ?', [$id])->fetch() ?: null;
}

/** Todo lo de un cliente para el formulario y la ficha: datos de la persona, teléfonos, email, dirección y comercio. */
function cliente_datos($id) {
  $c = consulta('SELECT c.id, c.persona_id, c.tipo, c.margen_credito, p.nombre, p.apellido, p.dni, p.estado_civil, p.fecha_nacimiento
    FROM clientes c JOIN personas p ON p.id = c.persona_id WHERE c.id = ?', [$id])->fetch();
  if (!$c) fallar('No existe ese cliente.', 404);
  $c['telefonos'] = consulta('SELECT numero_completo, es_whatsapp FROM telefonos WHERE persona_id = ? ORDER BY es_principal DESC, id', [$c['persona_id']])->fetchAll();
  $c['email'] = consulta('SELECT email FROM emails WHERE persona_id = ? ORDER BY es_principal DESC, id LIMIT 1', [$c['persona_id']])->fetchColumn() ?: null;
  $c['direccion'] = direccion_ver(consulta("SELECT id FROM direcciones WHERE persona_id = ? AND tipo = 'particular' ORDER BY es_principal DESC, id DESC LIMIT 1", [$c['persona_id']])->fetchColumn());
  $m = consulta('SELECT nombre_comercio, rubro, direccion_id FROM clientes_comercios WHERE cliente_id = ? ORDER BY id LIMIT 1', [$id])->fetch();
  $c['comercio'] = $m ? ['nombre_comercio' => $m['nombre_comercio'], 'rubro' => $m['rubro'], 'direccion' => direccion_ver($m['direccion_id'])] : null;
  return $c;
}

function venta_ver() {
  exigir('ventas.crear');
  $id = (int)($_GET['id'] ?? 0);
  $v = consulta("SELECT v.id, v.numero, v.codigo_seguimiento, v.cliente_id, v.vendedor_id, v.vendido_en, v.fecha_entrega, v.tipo_entrega, v.direccion_entrega_id,
      v.estado, v.motivo_estado, v.subtotal, v.descuento, v.total, v.notas, v.entregado_en, v.cancelado_en,
      TRIM(CONCAT_WS(' ', pv.nombre, pv.apellido)) AS vendedor, " . PAGADO_SQL . ' AS pagado, ' . FINANCIADO_SQL . " AS financiado
    FROM ventas v JOIN empleados ev ON ev.id = v.vendedor_id JOIN personas pv ON pv.id = ev.persona_id WHERE v.id = ?", [$id])->fetch();
  if (!$v) fallar('No existe esa venta.', 404);
  $v['cliente'] = cliente_datos($v['cliente_id']);
  $v['direccion_entrega'] = direccion_ver($v['direccion_entrega_id']);
  $v['items'] = consulta('SELECT id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, notas_taller, url_foto FROM ventas_items WHERE venta_id = ? ORDER BY id', [$id])->fetchAll();
  $adjuntos = consulta('SELECT a.venta_item_id, a.url FROM ventas_items_adjuntos a JOIN ventas_items i ON i.id = a.venta_item_id WHERE i.venta_id = ? ORDER BY a.id', [$id])->fetchAll();
  foreach ($v['items'] as &$i) $i['adjuntos'] = array_values(array_map(function ($a) { return $a['url']; }, array_filter($adjuntos, function ($a) use ($i) { return $a['venta_item_id'] === $i['id']; })));
  unset($i);
  $v['cobros'] = consulta("SELECT co.id, co.concepto, co.monto, co.recargo_pct, co.recargo_monto, co.total_cobrado, co.cuotas, co.monto_cuota, co.frecuencia_cuotas,
      co.fecha_primer_vencimiento, co.referencia, co.cobrado_en, co.anulado_en, co.motivo_anulacion,
      m.nombre AS medio, m.tipo AS medio_tipo, cb.nombre AS cuenta, pn.nombre AS posnet, TRIM(CONCAT_WS(' ', pc.nombre, pc.apellido)) AS cobrado_por
    FROM cobros co JOIN medios_pago m ON m.id = co.medio_pago_id
    LEFT JOIN cuentas_bancarias cb ON cb.id = co.cuenta_bancaria_id
    LEFT JOIN posnets_planes pp ON pp.id = co.posnet_plan_id LEFT JOIN posnets pn ON pn.id = pp.posnet_id
    JOIN empleados ec ON ec.id = co.cobrado_por JOIN personas pc ON pc.id = ec.persona_id
    WHERE co.venta_id = ? ORDER BY co.cobrado_en, co.id", [$id])->fetchAll();
  $v['historial'] = consulta("SELECT h.texto, h.creado_en, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.nombre, p.apellido)), ''), u.nombre_usuario, 'Sistema') AS usuario
    FROM ventas_historial h LEFT JOIN usuarios u ON u.id = h.usuario_id LEFT JOIN empleados e ON e.id = u.empleado_id LEFT JOIN personas p ON p.id = e.persona_id
    WHERE h.venta_id = ? ORDER BY h.creado_en, h.id", [$id])->fetchAll();
  salir(['venta' => $v]);
}

/** Las listas del formulario. Los modelos del catálogo salen de la ruta catalogo. */
function venta_opciones() {
  exigir('ventas.crear');
  salir([
    'localidades' => consulta('SELECT l.id, l.nombre, pr.nombre AS provincia, c.codigo AS codigo_area
      FROM localidades l JOIN provincias pr ON pr.id = l.provincia_id LEFT JOIN codigos_area c ON c.id = l.codigo_area_id ORDER BY pr.nombre, l.nombre')->fetchAll(),
    'medios' => consulta('SELECT id, nombre, tipo FROM medios_pago WHERE activo = 1 ORDER BY orden, nombre')->fetchAll(),
    'cuentas' => consulta('SELECT id, nombre FROM cuentas_bancarias WHERE activo = 1 ORDER BY nombre')->fetchAll(),
    'planes' => consulta('SELECT pp.id, pn.nombre AS posnet, pp.tipo_tarjeta, pp.marca_tarjeta, pp.cuotas, pp.recargo_pct
      FROM posnets_planes pp JOIN posnets pn ON pn.id = pp.posnet_id WHERE pp.activo = 1 AND pn.activo = 1 ORDER BY pn.nombre, pp.tipo_tarjeta, pp.cuotas, pp.marca_tarjeta')->fetchAll(),
    // Los que venden: todos los empleados que no son solo de la fábrica
    'vendedores' => consulta("SELECT e.id, TRIM(CONCAT_WS(' ', p.nombre, p.apellido)) AS nombre FROM empleados e JOIN personas p ON p.id = e.persona_id
      WHERE e.fecha_egreso IS NULL AND e.lugar_trabajo <> 'fabrica' ORDER BY nombre")->fetchAll(),
    'rubros' => consulta('SELECT DISTINCT rubro FROM clientes_comercios WHERE rubro IS NOT NULL ORDER BY rubro')->fetchAll(PDO::FETCH_COLUMN),
  ]);
}

/** ?q= nombre, DNI o teléfono (desde 3 números). */
function clientes_buscar() {
  exigir('ventas.crear');
  $q = trim((string)($_GET['q'] ?? ''));
  if (mb_strlen($q) < 2) salir(['clientes' => []]);
  $digitos = preg_replace('/\D/', '', $q);
  $donde = "CONCAT_WS(' ', pe.nombre, pe.apellido) LIKE ?";
  $params = ['%' . addcslashes($q, '%_\\') . '%'];
  if (strlen($digitos) >= 3) {
    $donde .= ' OR pe.dni LIKE ? OR EXISTS (SELECT 1 FROM telefonos t WHERE t.persona_id = pe.id AND t.numero_completo LIKE ?)';
    array_push($params, "$digitos%", "%$digitos%");
  }
  salir(['clientes' => consulta("SELECT c.id, TRIM(CONCAT_WS(' ', pe.nombre, pe.apellido)) AS nombre, pe.dni,
      (SELECT t.numero_completo FROM telefonos t WHERE t.persona_id = pe.id ORDER BY t.es_principal DESC, t.id LIMIT 1) AS telefono,
      (SELECT l.nombre FROM direcciones d JOIN localidades l ON l.id = d.localidad_id
        WHERE d.persona_id = pe.id AND d.tipo = 'particular' ORDER BY d.es_principal DESC, d.id DESC LIMIT 1) AS localidad
    FROM clientes c JOIN personas pe ON pe.id = c.persona_id WHERE $donde ORDER BY pe.apellido, pe.nombre LIMIT 20", $params)->fetchAll()]);
}

/** ?id=: el cliente completo para cargarlo en el formulario, con los números de sus ventas anteriores. */
function cliente_ver() {
  exigir('ventas.crear');
  $id = (int)($_GET['id'] ?? 0);
  salir(['cliente' => cliente_datos($id), 'ventas' => consulta('SELECT id, numero FROM ventas WHERE cliente_id = ? ORDER BY numero', [$id])->fetchAll()]);
}

/* ---------- validaciones ---------- */

/** Fecha "2026-11-11" del cuerpo: null si viene vacía, error si no existe. */
function fecha($datos, $clave, $nombre) {
  $v = trim((string)($datos[$clave] ?? ''));
  if ($v === '') return null;
  $d = DateTime::createFromFormat('!Y-m-d', $v);
  if (!$d || $d->format('Y-m-d') !== $v) fallar("$nombre: la fecha no es válida.");
  return $v;
}

/** Calle, número, piso, depto., barrio y localidad. null si viene vacía y no es obligatoria. */
function direccion_datos($d, $nombre, $obligatoria) {
  $r = [
    'calle' => texto($d, 'calle', 120, "$nombre, calle"),
    'numero' => texto($d, 'numero', 10, "$nombre, número"),
    'piso' => texto($d, 'piso', 10, "$nombre, piso"),
    'departamento' => texto($d, 'departamento', 10, "$nombre, departamento"),
    'barrio' => texto($d, 'barrio', 80, "$nombre, barrio"),
    'localidad_id' => (int)($d['localidad_id'] ?? 0) ?: null,
  ];
  if (!$obligatoria && !array_filter($r)) return null;
  if (!$r['calle']) fallar("$nombre: falta la calle.");
  if (!$r['localidad_id'] || !consulta('SELECT 1 FROM localidades WHERE id = ?', [$r['localidad_id']])->fetchColumn()) fallar("$nombre: elegí la localidad.");
  return $r;
}

/** Un pago (anticipo o cobro posterior) listo para insertar. Con tarjeta, el recargo sale del plan del posnet. */
function cobro_datos($p, $nombre) {
  $medios = consulta('SELECT id, tipo FROM medios_pago WHERE activo = 1')->fetchAll(PDO::FETCH_KEY_PAIR);
  $medio = (int)($p['medio_pago_id'] ?? 0);
  $tipo = $medios[$medio] ?? fallar("$nombre: elegí cómo paga.");
  if ($tipo === 'credito_casa') fallar("$nombre: el crédito de la casa se carga en las cuotas.");
  $monto = round(numero($p, 'monto', 0.01, 999999999999, "$nombre, monto") ?? fallar("$nombre: falta el monto."), 2);
  $cuenta = null;
  if ($tipo === 'transferencia' && ($cuenta = (int)($p['cuenta_bancaria_id'] ?? 0) ?: null)
    && !consulta('SELECT 1 FROM cuentas_bancarias WHERE id = ? AND activo = 1', [$cuenta])->fetchColumn()) fallar("$nombre: esa cuenta ya no está activa.");
  $plan = null;
  if (in_array($tipo, ['tarjeta_debito', 'tarjeta_credito'], true) && ($id = (int)($p['posnet_plan_id'] ?? 0))) {
    $plan = consulta('SELECT id, tipo_tarjeta, cuotas, recargo_pct FROM posnets_planes WHERE id = ? AND activo = 1', [$id])->fetch() ?: fallar("$nombre: ese plan del posnet ya no está activo.");
    if ("tarjeta_{$plan['tipo_tarjeta']}" !== $tipo) fallar("$nombre: el plan del posnet es de otro tipo de tarjeta.");
  }
  $pct = $plan ? (float)$plan['recargo_pct'] : 0;
  $recargo = round($monto * $pct / 100, 2);
  return [
    'medio_pago_id' => $medio, 'monto' => $monto, 'recargo_pct' => $pct, 'recargo_monto' => $recargo, 'total_cobrado' => round($monto + $recargo, 2),
    'posnet_plan_id' => $plan['id'] ?? null, 'cuotas' => $plan['cuotas'] ?? null, 'monto_cuota' => $plan ? round(($monto + $recargo) / $plan['cuotas'], 2) : null,
    'frecuencia_cuotas' => null, 'fecha_primer_vencimiento' => null, 'cuenta_bancaria_id' => $cuenta, 'referencia' => texto($p, 'referencia', 60, "$nombre, referencia"),
  ];
}

function cobro_insertar($venta, $concepto, $c, $cobrado_por) {
  consulta('INSERT INTO cobros (venta_id, concepto, cobrado_por, creado_por, ' . implode(', ', array_keys($c)) . ') VALUES (?, ?, ?, ?' . str_repeat(', ?', count($c)) . ')',
    array_merge([$venta, $concepto, $cobrado_por, usuario()['id']], array_values($c)));
}

function historial($venta, $texto) {
  consulta('INSERT INTO ventas_historial (venta_id, usuario_id, texto) VALUES (?, ?, ?)', [$venta, usuario()['id'], $texto]);
}
function plata($n) { return '$ ' . number_format($n, fmod($n, 1) ? 2 : 0, ',', '.'); }

/* ---------- guardar ---------- */

/** La venta completa del formulario (ver VentaGuardar en lib/tipos.ts). Todo en una transacción: cliente, venta, muebles, cobros e historial. */
function venta_guardar() {
  exigir('ventas.crear');
  $e = entrada();
  $c = (array)($e['cliente'] ?? []);

  // Paso 1 · vendedor y cliente
  $vendedor = (int)($e['vendedor_id'] ?? 0);
  if (!consulta('SELECT 1 FROM empleados WHERE id = ? AND fecha_egreso IS NULL', [$vendedor])->fetchColumn()) fallar('Elegí el vendedor.');
  $dni = preg_replace('/[\s.\-]/', '', (string)($c['dni'] ?? ''));
  if (!preg_match('/^[0-9A-Za-z]{6,12}$/', $dni)) fallar('Revisá el DNI: de 6 a 12 números, sin puntos.');
  $estado_civil = (string)($c['estado_civil'] ?? '');
  if ($estado_civil !== '' && !in_array($estado_civil, ESTADOS_CIVILES, true)) fallar('Elegí el estado civil de la lista.');
  $persona = [
    'nombre' => texto($c, 'nombre', 80, 'Nombre') ?? fallar('Falta el nombre del cliente.'),
    'apellido' => texto($c, 'apellido', 80, 'Apellido') ?? fallar('Falta el apellido del cliente.'),
    'dni' => $dni,
    'fecha_nacimiento' => fecha($c, 'fecha_nacimiento', 'Fecha de nacimiento'),
    'estado_civil' => $estado_civil ?: null,
  ];
  $telefonos = [];
  foreach ((array)($c['telefonos'] ?? []) as $t) {
    $n = preg_replace('/\D/', '', (string)($t['numero_completo'] ?? ''));
    if ($n === '' || in_array($n, array_column($telefonos, 'numero'), true)) continue;
    if (!preg_match('/^549\d{10}$/', $n)) fallar('Revisá los teléfonos: van con código de área, sin 0 ni 15. Ej: 381 555-1203');
    $telefonos[] = ['numero' => $n, 'es_whatsapp' => empty($t['es_whatsapp']) ? 0 : 1];
  }
  if (!$telefonos) fallar('Cargá al menos un teléfono del cliente.');
  $email = texto($c, 'email', 160, 'Email');
  if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) fallar('Revisá el email.');
  $direccion = direccion_datos((array)($c['direccion'] ?? []), 'Dirección', true);
  $tipo = ($c['tipo'] ?? '') === 'negocio' ? 'negocio' : 'casa';
  $margen = numero($c, 'margen_credito', 0, 999999999999, 'Margen de crédito');

  // Paso 2 · datos comerciales, solo si compra para un negocio
  $comercio = null;
  if ($tipo === 'negocio') {
    $m = (array)($c['comercio'] ?? []);
    $comercio = [
      'nombre_comercio' => texto($m, 'nombre_comercio', 120, 'Comercio') ?? fallar('Falta el nombre del comercio.'),
      'rubro' => texto($m, 'rubro', 80, 'Rubro') ?? fallar('Falta el rubro del comercio.'),
      'direccion' => direccion_datos((array)($m['direccion'] ?? []), 'Domicilio comercial', false),
    ];
  }

  // Paso 3 · muebles
  $items = [];
  $subtotal = 0;
  foreach ((array)($e['items'] ?? []) as $i => $x) {
    $n = 'Mueble ' . ($i + 1);
    $producto = (int)($x['producto_id'] ?? 0) ?: null;
    if ($producto && !consulta('SELECT 1 FROM productos WHERE id = ?', [$producto])->fetchColumn()) fallar("$n: ese modelo ya no está en el catálogo.");
    $cantidad = numero($x, 'cantidad', 1, 999, "$n, cantidad") ?? fallar("$n: falta la cantidad.");
    if ($cantidad != (int)$cantidad) fallar("$n: la cantidad va sin decimales.");
    $fila = [
      'producto_id' => $producto,
      'codigo' => texto($x, 'codigo', 30, "$n, código"),
      'nombre' => texto($x, 'nombre', 160, "$n, nombre") ?? fallar("$n: falta qué se fabrica."),
      'descripcion' => texto($x, 'descripcion', 5000, "$n, descripción") ?? fallar("$n: falta la descripción."),
      'cantidad' => (int)$cantidad,
      'precio_unitario' => round(numero($x, 'precio_unitario', 0, 999999999999, "$n, precio") ?? fallar("$n: falta el precio."), 2),
      'notas_taller' => texto($x, 'notas_taller', 5000, "$n, notas para el taller"),
    ];
    // Solo lo que subió el formulario (subir con carpeta=ventas)
    $adjuntos = array_values(array_filter((array)($x['adjuntos'] ?? []), function ($u) { return is_string($u) && preg_match('#^assets/ventas/[a-f0-9]{32}\.[a-z0-9]{2,4}$#', $u); }));
    $subtotal += $fila['cantidad'] * $fila['precio_unitario'];
    $items[] = ['fila' => $fila, 'adjuntos' => $adjuntos];
  }
  if (!$items) fallar('Agregá al menos un mueble.');

  // Paso 4 · entrega y plan de pago
  $fecha_entrega = fecha($e, 'fecha_entrega', 'Fecha de entrega') ?? fallar('Poné la fecha de entrega prometida.');
  $tipo_entrega = in_array($e['tipo_entrega'] ?? '', ['envio', 'retiro'], true) ? $e['tipo_entrega'] : fallar('Elegí si es con envío o si retira en el showroom.');
  $subtotal = round($subtotal, 2);
  $descuento = round(numero($e, 'descuento', 0, $subtotal, 'Descuento') ?? 0, 2);
  $total = round($subtotal - $descuento, 2);
  $notas = texto($e, 'notas', 5000, 'Notas de la venta');
  $pagos = [];
  foreach ((array)($e['pagos'] ?? []) as $i => $p) $pagos[] = cobro_datos($p, 'Anticipo ' . ($i + 1));
  if (!$pagos) fallar('Cargá el anticipo: cuánto paga hoy y cómo.');
  $pagado = round(array_sum(array_column($pagos, 'monto')), 2);
  if ($pagado > $total) fallar('El anticipo (' . plata($pagado) . ') supera el total de la venta (' . plata($total) . ').');
  $credito = null;
  if (!empty($e['credito'])) {
    $k = (array)$e['credito'];
    $resto = round($total - $pagado, 2);
    if ($resto <= 0) fallar('No queda saldo para financiar: el anticipo cubre el total.');
    $cuotas = numero($k, 'cuotas', 1, 999, 'Cantidad de cuotas') ?? fallar('Poné la cantidad de cuotas.');
    if ($cuotas != (int)$cuotas) fallar('La cantidad de cuotas va sin decimales.');
    $frecuencia = (string)($k['frecuencia_cuotas'] ?? '');
    if ($frecuencia !== '' && !in_array($frecuencia, ['semanal', 'quincenal', 'mensual'], true)) fallar('Elegí si las cuotas son semanales, quincenales o mensuales.');
    $credito = [
      'medio_pago_id' => consulta("SELECT id FROM medios_pago WHERE tipo = 'credito_casa' AND activo = 1 ORDER BY orden LIMIT 1")->fetchColumn() ?: fallar('El crédito de la casa no está activo en los medios de pago.'),
      'monto' => $resto, 'recargo_pct' => 0, 'recargo_monto' => 0, 'total_cobrado' => $resto, 'posnet_plan_id' => null,
      'cuotas' => (int)$cuotas,
      'monto_cuota' => round(numero($k, 'monto_cuota', 0.01, 999999999999, 'Valor de cada cuota') ?? ceil($resto / $cuotas), 2),
      'frecuencia_cuotas' => $frecuencia ?: null,
      'fecha_primer_vencimiento' => fecha($k, 'fecha_primer_vencimiento', 'Fecha de inicio') ?? fallar('Poné cuándo vence la primera cuota.'),
      'cuenta_bancaria_id' => null,
      'referencia' => texto($k, 'referencia', 60, 'Crédito Nº'),
    ];
  }

  // El número es el último + 1 en el mismo INSERT: si otra venta se guarda a la vez (1062 o 1213), se vuelve a intentar todo
  for ($intento = 1; ; $intento++) {
    try {
      db()->beginTransaction();
      $cliente = cliente_guardar((int)($c['id'] ?? 0), $persona, $telefonos, $email, $direccion, $tipo, $margen, $comercio);
      consulta('INSERT INTO ventas (numero, cliente_id, vendedor_id, creado_por, fecha_entrega, tipo_entrega, direccion_entrega_id, subtotal, descuento, total, notas)
        SELECT IFNULL(MAX(numero), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM ventas',
        [$cliente['id'], $vendedor, usuario()['id'], $fecha_entrega, $tipo_entrega, $tipo_entrega === 'envio' ? $cliente['direccion_id'] : null, $subtotal, $descuento, $total, $notas]);
      $venta = (int)db()->lastInsertId();
      foreach ($items as $x) {
        $f = $x['fila'];
        consulta('INSERT INTO ventas_items (venta_id, ' . implode(', ', array_keys($f)) . ', url_foto) VALUES (?' . str_repeat(', ?', count($f)) . ',
          (SELECT pf.url FROM productos_fotos pf WHERE pf.producto_id = ? ORDER BY pf.orden LIMIT 1))', array_merge([$venta], array_values($f), [$f['producto_id']]));
        $item = (int)db()->lastInsertId();
        foreach ($x['adjuntos'] as $url) consulta('INSERT INTO ventas_items_adjuntos (venta_item_id, url, subido_por) VALUES (?, ?, ?)', [$item, $url, usuario()['id']]);
      }
      foreach ($pagos as $p) cobro_insertar($venta, $pagado == $total && count($pagos) === 1 ? 'pago_total' : 'anticipo', $p, $vendedor);
      if ($credito) cobro_insertar($venta, 'saldo', $credito, $vendedor);
      historial($venta, 'Venta registrada');
      $numero = (int)consulta('SELECT numero FROM ventas WHERE id = ?', [$venta])->fetchColumn();
      db()->commit();
      salir(['id' => $venta, 'numero' => $numero]);
    } catch (PDOException $ex) {
      db()->rollBack();
      if (!in_array($ex->errorInfo[1] ?? 0, [1062, 1213], true) || $intento === 3) throw $ex;
    }
  }
}

/** Crea o actualiza al cliente con los datos de la ficha. Devuelve [id, direccion_id]. */
function cliente_guardar($cliente_id, $persona, $telefonos, $email, $direccion, $tipo, $margen, $comercio) {
  // La persona: la del cliente elegido; si no, la que ya tenga ese DNI (puede ser un empleado); si no, una nueva
  $con_dni = consulta('SELECT id FROM personas WHERE dni = ?', [$persona['dni']])->fetchColumn();
  $persona_id = $cliente_id ? consulta('SELECT persona_id FROM clientes WHERE id = ?', [$cliente_id])->fetchColumn() : $con_dni;
  if ($cliente_id && !$persona_id) fallar('No existe ese cliente. Puede que lo hayan borrado: buscalo de nuevo.', 404);
  if ($con_dni && $con_dni != $persona_id) fallar('Ese DNI ya es de otro cliente. Buscalo por el DNI.', 409);
  if ($persona_id) {
    consulta('UPDATE personas SET nombre = ?, apellido = ?, dni = ?, fecha_nacimiento = ?, estado_civil = ? WHERE id = ?', array_merge(array_values($persona), [$persona_id]));
  } else {
    consulta('INSERT INTO personas (nombre, apellido, dni, fecha_nacimiento, estado_civil) VALUES (?, ?, ?, ?, ?)', array_values($persona));
    $persona_id = (int)db()->lastInsertId();
  }

  consulta('DELETE FROM telefonos WHERE persona_id = ?', [$persona_id]);
  foreach ($telefonos as $i => $t)
    consulta("INSERT INTO telefonos (persona_id, codigo_area_id, numero_local, numero_completo, es_whatsapp, es_principal)
      VALUES (?, (SELECT a.id FROM codigos_area a WHERE ? LIKE CONCAT(a.codigo, '%') ORDER BY LENGTH(a.codigo) DESC LIMIT 1), ?, ?, ?, ?)",
      [$persona_id, substr($t['numero'], 3), substr($t['numero'], 3), $t['numero'], $t['es_whatsapp'], $i === 0 ? 1 : 0]);
  consulta('DELETE FROM emails WHERE persona_id = ?', [$persona_id]);
  if ($email) consulta('INSERT INTO emails (persona_id, email, es_principal) VALUES (?, ?, 1)', [$persona_id, $email]);

  // Si cambió la dirección se agrega una nueva: las ventas anteriores conservan la suya
  $actual = consulta("SELECT id, calle, numero, piso, departamento, barrio, localidad_id FROM direcciones
    WHERE persona_id = ? AND tipo = 'particular' ORDER BY es_principal DESC, id DESC LIMIT 1", [$persona_id])->fetch();
  if ($actual && array_slice($actual, 1) == $direccion) {
    $direccion_id = $actual['id'];
  } else {
    consulta("UPDATE direcciones SET es_principal = 0 WHERE persona_id = ? AND tipo = 'particular'", [$persona_id]);
    consulta("INSERT INTO direcciones (persona_id, tipo, calle, numero, piso, departamento, barrio, localidad_id, es_principal) VALUES (?, 'particular', ?, ?, ?, ?, ?, ?, 1)",
      array_merge([$persona_id], array_values($direccion)));
    $direccion_id = (int)db()->lastInsertId();
  }

  $id = consulta('SELECT id FROM clientes WHERE persona_id = ?', [$persona_id])->fetchColumn();
  if ($id) consulta('UPDATE clientes SET tipo = ?, margen_credito = ? WHERE id = ?', [$tipo, $margen, $id]);
  else {
    consulta('INSERT INTO clientes (persona_id, tipo, margen_credito, creado_por) VALUES (?, ?, ?, ?)', [$persona_id, $tipo, $margen, usuario()['id']]);
    $id = (int)db()->lastInsertId();
  }

  if ($comercio) {
    $m = consulta('SELECT id, direccion_id FROM clientes_comercios WHERE cliente_id = ? ORDER BY id LIMIT 1', [$id])->fetch();
    $dir = null;
    if ($comercio['direccion']) {
      $d = $comercio['direccion'];
      if ($m && $m['direccion_id']) {
        consulta('UPDATE direcciones SET calle = ?, numero = ?, piso = ?, departamento = ?, barrio = ?, localidad_id = ? WHERE id = ?', array_merge(array_values($d), [$m['direccion_id']]));
        $dir = $m['direccion_id'];
      } else {
        consulta("INSERT INTO direcciones (persona_id, tipo, calle, numero, piso, departamento, barrio, localidad_id) VALUES (?, 'comercial', ?, ?, ?, ?, ?, ?)", array_merge([$persona_id], array_values($d)));
        $dir = (int)db()->lastInsertId();
      }
    }
    if ($m) consulta('UPDATE clientes_comercios SET nombre_comercio = ?, rubro = ?, direccion_id = ? WHERE id = ?', [$comercio['nombre_comercio'], $comercio['rubro'], $dir, $m['id']]);
    else consulta('INSERT INTO clientes_comercios (cliente_id, nombre_comercio, rubro, direccion_id) VALUES (?, ?, ?, ?)', [$id, $comercio['nombre_comercio'], $comercio['rubro'], $dir]);
  }
  return ['id' => (int)$id, 'direccion_id' => $direccion_id];
}

/* ---------- después de la venta ---------- */

/** {venta_id, medio_pago_id, monto, cuenta_bancaria_id?, posnet_plan_id?, referencia?}: un cobro del saldo. */
function venta_cobrar() {
  exigir('ventas.crear');
  $e = entrada();
  $c = cobro_datos($e, 'Cobro');
  db()->beginTransaction();
  $v = consulta('SELECT v.id, v.estado, v.vendedor_id, v.total, ' . PAGADO_SQL . ' AS pagado FROM ventas v WHERE v.id = ? FOR UPDATE', [(int)($e['venta_id'] ?? 0)])->fetch();
  if (!$v) fallar('No existe esa venta.', 404);
  if ($v['estado'] === 'cancelada') fallar('La venta está cancelada.');
  $saldo = round($v['total'] - $v['pagado'], 2);
  if ($c['monto'] > $saldo) fallar('El monto supera el saldo (' . plata($saldo) . ').');
  cobro_insertar($v['id'], $c['monto'] == $saldo ? 'saldo' : 'pago_a_cuenta', $c, usuario()['empleado_id'] ?: $v['vendedor_id']);
  $medio = consulta('SELECT nombre FROM medios_pago WHERE id = ?', [$c['medio_pago_id']])->fetchColumn();
  historial($v['id'], 'Cobro de ' . plata($c['monto']) . " ($medio)" . ($c['recargo_monto'] > 0 ? ', más ' . plata($c['recargo_monto']) . ' de recargo' : ''));
  db()->commit();
  salir(['ok' => true]);
}

/** {cobro_id, motivo}. Los cobros no se borran: quedan anulados con el motivo. */
function venta_anular_cobro() {
  exigir('ventas.anular');
  $e = entrada();
  $motivo = texto($e, 'motivo', 2000, 'Motivo') ?? fallar('Escribí por qué se anula el cobro.');
  $c = consulta('SELECT id, venta_id, monto FROM cobros WHERE id = ? AND anulado_en IS NULL', [(int)($e['cobro_id'] ?? 0)])->fetch() ?: fallar('Ese cobro no existe o ya está anulado.', 404);
  db()->beginTransaction();
  consulta('UPDATE cobros SET anulado_en = NOW(), anulado_por = ?, motivo_anulacion = ? WHERE id = ?', [usuario()['id'], $motivo, $c['id']]);
  historial($c['venta_id'], 'Cobro de ' . plata($c['monto']) . " anulado: $motivo");
  db()->commit();
  salir(['ok' => true]);
}

/** {id, estado?, motivo?, fecha_entrega?, entregada?}: pausa, cancelación, nueva fecha de entrega o marca de entregada. */
function venta_estado() {
  exigir('ventas.crear');
  $e = entrada();
  $v = consulta('SELECT id, estado, fecha_entrega FROM ventas WHERE id = ?', [(int)($e['id'] ?? 0)])->fetch() ?: fallar('No existe esa venta.', 404);
  if ($v['estado'] === 'cancelada') fallar('La venta está cancelada.');
  db()->beginTransaction();
  if (isset($e['estado'])) {
    $estado = $e['estado'];
    $textos = ['activa' => 'Venta reanudada', 'pausa' => 'Venta en pausa', 'cancelada' => 'Venta cancelada'];
    if (!isset($textos[$estado])) fallar('Estado inválido.');
    if ($estado === 'cancelada') exigir('ventas.anular');
    $motivo = texto($e, 'motivo', 2000, 'Motivo');
    if ($estado === 'cancelada' && !$motivo) fallar('Escribí el motivo de la cancelación.');
    consulta("UPDATE ventas SET estado = ?, motivo_estado = ?, cancelado_en = IF(? = 'cancelada', NOW(), NULL) WHERE id = ?", [$estado, $motivo, $estado, $v['id']]);
    historial($v['id'], $textos[$estado] . ($motivo ? ": $motivo" : ''));
  }
  if (isset($e['fecha_entrega'])) {
    $f = fecha($e, 'fecha_entrega', 'Fecha de entrega') ?? fallar('Poné la nueva fecha de entrega.');
    consulta('UPDATE ventas SET fecha_entrega = ? WHERE id = ?', [$f, $v['id']]);
    historial($v['id'], 'Fecha de entrega: ' . date('d/m/Y', strtotime($v['fecha_entrega'])) . ' → ' . date('d/m/Y', strtotime($f)));
  }
  if (isset($e['entregada'])) {
    consulta('UPDATE ventas SET entregado_en = IF(?, NOW(), NULL) WHERE id = ?', [$e['entregada'] ? 1 : 0, $v['id']]);
    historial($v['id'], $e['entregada'] ? 'Marcada como entregada' : 'Se quitó la marca de entregada');
  }
  db()->commit();
  salir(['ok' => true]);
}
