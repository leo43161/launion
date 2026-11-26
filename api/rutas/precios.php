<?php
/* Subir precios en bloque (pantalla /admin/precios/): un porcentaje para todos los elegidos, sobre el precio final.
   Modelos: el de la web y/o el del local, con historial (guardar_precio: fila nueva desde hoy). Presupuestos: el precio final
   (si no tenía, el calculado). Costos e insumos no se tocan. */

/** El precio × el factor, redondeado para arriba a $ 1.000 o a pesos enteros. Igual que subirPrecio() en lib/formato.ts. */
function precio_subido($monto, $factor, $redondear) {
  $v = round((float)$monto * $factor, 2);
  return $redondear ? ceil($v / 1000) * 1000 : round($v);
}

/** Lo común a las dos rutas: los ids elegidos y el factor (10 % = 1,10). */
function precios_pedido() {
  $e = entrada();
  $ids = array_values(array_unique(array_filter(array_map('intval', (array)($e['ids'] ?? [])))));
  if (!$ids) fallar('Elegí al menos uno.');
  $p = is_numeric($e['porcentaje'] ?? null) ? (float)$e['porcentaje'] : 0;
  if (!$p || $p <= -100 || $p > 1000) fallar('Poné el porcentaje: 10 para subir un 10 %.');
  return [$e, $ids, 1 + $p / 100, !empty($e['redondear'])];
}

/** {ids, porcentaje, redondear, listas: ["web", "local"]}. Un modelo sin precio en esa lista queda sin precio. */
function precios_modelos() {
  exigir('catalogo.editar');
  [$e, $ids, $factor, $redondear] = precios_pedido();
  $pedidas = (array)($e['listas'] ?? []);
  $listas = [];
  if (in_array('web', $pedidas, true)) $listas[] = LISTA_WEB;
  if (in_array('local', $pedidas, true) && puede('precios.ver')) $listas[] = LISTA_LOCAL;
  if (!$listas) fallar('Elegí qué precio subir: el de la web, el del local o los dos.');
  $n = 0;
  db()->beginTransaction();
  foreach ($ids as $id) foreach ($listas as $lista) {
    $actual = precio_vigente($id, $lista);
    if (!$actual) continue;
    guardar_precio($id, $lista, ['tipo_precio' => $actual['tipo_precio'], 'monto' => precio_subido($actual['monto'], $factor, $redondear),
      'monto_hasta' => $actual['monto_hasta'] === null ? null : precio_subido($actual['monto_hasta'], $factor, $redondear)]);
    $n++;
  }
  db()->commit();
  salir(['cambiados' => $n]);
}

/** {ids, porcentaje, redondear}. El que no tenía precio final queda con el calculado (costo × multiplicador) × el porcentaje. */
function precios_presupuestos() {
  exigir('catalogo.editar');
  [, $ids, $factor, $redondear] = precios_pedido();
  $filas = consulta('SELECT p.id, COALESCE(p.precio_final, ROUND(' . COSTO_SQL . ' * p.multiplicador, 2)) AS precio
    FROM presupuestos p WHERE p.id IN (' . implode(',', $ids) . ')')->fetchAll();
  $n = 0;
  db()->beginTransaction();
  foreach ($filas as $x) {
    if ((float)$x['precio'] <= 0) continue; // sin insumos: no hay precio que subir
    consulta('UPDATE presupuestos SET precio_final = ?, actualizado_por = ? WHERE id = ?', [precio_subido($x['precio'], $factor, $redondear), usuario()['id'], $x['id']]);
    $n++;
  }
  db()->commit();
  salir(['cambiados' => $n]);
}
