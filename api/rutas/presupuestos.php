<?php
/* Presupuestos de fabricación: despiece e insumos de un mueble, con su costo y precio. Reemplazan la planilla de Excel.
   Total de un insumo = cantidad × costo unitario. Costo = suma de los totales. Precio = costo × multiplicador (2,2 en el Excel).
   El precio final se redondea a mano. Los ve y los edita cualquier usuario del panel. */

const COSTO_SQL = '(SELECT ROUND(COALESCE(SUM(i.cantidad * i.costo_unitario), 0), 2) FROM presupuestos_insumos i WHERE i.presupuesto_id = p.id)';

function presupuestos_listar() {
  usuario();
  salir([
    'presupuestos' => consulta('SELECT p.id, p.nombre, p.grupo, p.url_foto, p.multiplicador, p.precio_final, ' . COSTO_SQL . ' AS costo,
        COALESCE(p.actualizado_en, p.creado_en) AS actualizado_en
      FROM presupuestos p ORDER BY p.grupo IS NULL, p.grupo, p.id')->fetchAll(), // en cada grupo, en el orden en que se cargaron (el del Excel)
    // El último costo de cada insumo: el editor lo completa al elegir el nombre
    'insumos' => consulta('SELECT insumo, costo_unitario FROM (
        SELECT i.insumo, i.costo_unitario, ROW_NUMBER() OVER (PARTITION BY i.insumo ORDER BY COALESCE(p.actualizado_en, p.creado_en) DESC, i.id DESC) AS n
        FROM presupuestos_insumos i JOIN presupuestos p ON p.id = i.presupuesto_id) x
      WHERE n = 1 ORDER BY insumo')->fetchAll(),
  ]);
}

function presupuesto_ver() {
  usuario();
  $id = (int)($_GET['id'] ?? 0);
  $p = consulta('SELECT p.*, ' . COSTO_SQL . ' AS costo FROM presupuestos p WHERE p.id = ?', [$id])->fetch();
  if (!$p) fallar('No existe ese presupuesto.', 404);
  $p['cortes'] = consulta('SELECT pieza, ancho_cm, alto_cm, cantidad, material FROM presupuestos_cortes WHERE presupuesto_id = ? ORDER BY orden, id', [$id])->fetchAll();
  $p['insumos'] = consulta('SELECT insumo, cantidad, costo_unitario FROM presupuestos_insumos WHERE presupuesto_id = ? ORDER BY orden, id', [$id])->fetchAll();
  salir(['presupuesto' => $p]);
}

/** Número del cuerpo: null si viene vacío, error si no es número o se pasa de los límites. */
function numero($datos, $clave, $min, $max, $nombre) {
  $v = $datos[$clave] ?? null;
  if ($v === null || $v === '') return null;
  if (!is_numeric($v) || $v < $min || $v > $max) fallar("$nombre: tiene que ser un número entre " . str_replace(".", ",", $min) . " y $max.");
  return (float)$v;
}

/** Alta o modificación (con "id"). Cortes e insumos llegan completos y se reemplazan en la misma transacción. */
function presupuesto_guardar() {
  usuario();
  $e = entrada();
  $nombre = texto($e, 'nombre', 160, 'Nombre');
  if (!$nombre) fallar('Poné el nombre del mueble.');
  $datos = [
    'nombre' => $nombre,
    'grupo' => texto($e, 'grupo', 60, 'Grupo'),
    'url_foto' => texto($e, 'url_foto', 500, 'Foto'),
    'notas' => texto($e, 'notas', 2000, 'Notas'),
    'multiplicador' => numero($e, 'multiplicador', 0.01, 999, 'Multiplicador') ?? fallar('Poné el multiplicador del precio (en el Excel, 2,2).'),
    'precio_final' => numero($e, 'precio_final', 0, 999999999999, 'Precio final'),
    'actualizado_por' => usuario()['id'],
  ];

  $cortes = [];
  foreach ((array)($e['cortes'] ?? []) as $i => $c) {
    $n = $i + 1;
    $fila = [
      'pieza' => texto($c, 'pieza', 80, "Pieza $n"),
      'ancho_cm' => numero($c, 'ancho_cm', 0, 99999, "Pieza $n, ancho"),
      'alto_cm' => numero($c, 'alto_cm', 0, 99999, "Pieza $n, alto"),
      'cantidad' => (int)(numero($c, 'cantidad', 0, 9999, "Pieza $n, cantidad") ?? 1),
      'material' => texto($c, 'material', 80, "Pieza $n, material"),
    ];
    if ($fila['pieza'] !== null || $fila['ancho_cm'] !== null || $fila['alto_cm'] !== null || $fila['material'] !== null) $cortes[] = $fila; // las filas vacías no se guardan
  }
  $insumos = [];
  foreach ((array)($e['insumos'] ?? []) as $i => $x) {
    $n = $i + 1;
    $fila = [
      'insumo' => texto($x, 'insumo', 80, "Insumo $n"),
      'cantidad' => numero($x, 'cantidad', 0, 9999999, "Insumo $n, cantidad") ?? 0,
      'costo_unitario' => numero($x, 'costo_unitario', 0, 999999999999, "Insumo $n, costo unitario") ?? 0,
    ];
    if ($fila['insumo'] === null) {
      if ($fila['cantidad'] || $fila['costo_unitario']) fallar("Insumo $n: falta el nombre.");
      continue;
    }
    $insumos[] = $fila;
  }

  $id = (int)($e['id'] ?? 0); // 0 = alta
  db()->beginTransaction();
  if ($id) {
    if (!consulta('SELECT 1 FROM presupuestos WHERE id = ? FOR UPDATE', [$id])->fetchColumn()) fallar('No existe ese presupuesto. Puede que otro usuario lo haya eliminado.', 404);
    // actualizado_en a mano: si solo cambiaron los insumos, la fila no cambia y MySQL no la actualiza sola
    consulta('UPDATE presupuestos SET ' . implode(', ', array_map(function ($k) { return "$k = ?"; }, array_keys($datos))) . ', actualizado_en = NOW() WHERE id = ?',
      array_merge(array_values($datos), [$id]));
  } else {
    consulta('INSERT INTO presupuestos (' . implode(', ', array_keys($datos)) . ') VALUES (' . implode(', ', array_fill(0, count($datos), '?')) . ')', array_values($datos));
    $id = (int)db()->lastInsertId();
  }
  consulta('DELETE FROM presupuestos_cortes WHERE presupuesto_id = ?', [$id]);
  consulta('DELETE FROM presupuestos_insumos WHERE presupuesto_id = ?', [$id]);
  foreach ($cortes as $i => $c)
    consulta('INSERT INTO presupuestos_cortes (presupuesto_id, orden, pieza, ancho_cm, alto_cm, cantidad, material) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [$id, $i, $c['pieza'], $c['ancho_cm'], $c['alto_cm'], $c['cantidad'], $c['material']]);
  foreach ($insumos as $i => $x)
    consulta('INSERT INTO presupuestos_insumos (presupuesto_id, orden, insumo, cantidad, costo_unitario) VALUES (?, ?, ?, ?, ?)',
      [$id, $i, $x['insumo'], $x['cantidad'], $x['costo_unitario']]);
  db()->commit();
  salir(['id' => $id]);
}

/** {id}: se borra con su despiece e insumos. La foto queda en el servidor (puede usarla otro presupuesto, como al duplicar). */
function presupuesto_eliminar() {
  usuario();
  consulta('DELETE FROM presupuestos WHERE id = ?', [(int)(entrada()['id'] ?? 0)]);
  salir(['ok' => true]);
}
