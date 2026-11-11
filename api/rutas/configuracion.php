<?php
/* Configuración del negocio para las ventas: cuentas bancarias, posnets con sus recargos y localidades.
   Solo el Administrador (configuracion.editar: lo tiene por "*"). Cada lista se guarda completa, como la de vendedores:
   lo que no viene se borra, y si ya lo usa una venta (error 1451) queda desactivado. */

function configuracion_ver() {
  exigir('configuracion.editar');
  $posnets = consulta('SELECT id, nombre, proveedor, cuenta_liquidacion_id, activo FROM posnets ORDER BY activo DESC, nombre')->fetchAll();
  $planes = consulta('SELECT id, posnet_id, tipo_tarjeta, marca_tarjeta, cuotas, recargo_pct, activo FROM posnets_planes ORDER BY tipo_tarjeta, cuotas, marca_tarjeta')->fetchAll();
  foreach ($posnets as &$p) $p['planes'] = array_values(array_filter($planes, function ($x) use ($p) { return $x['posnet_id'] === $p['id']; }));
  unset($p);
  salir([
    'cuentas' => consulta('SELECT id, nombre, banco, titular, cbu_cvu, alias, activo FROM cuentas_bancarias ORDER BY activo DESC, nombre')->fetchAll(),
    'posnets' => $posnets,
    'localidades' => consulta('SELECT l.id, l.nombre, pr.nombre AS provincia, c.codigo AS codigo_area, l.codigo_postal
      FROM localidades l JOIN provincias pr ON pr.id = l.provincia_id LEFT JOIN codigos_area c ON c.id = l.codigo_area_id
      ORDER BY pr.nombre, l.nombre')->fetchAll(),
  ]);
}

/** Guarda la lista completa de $tabla: actualiza las filas con id, agrega las nuevas y borra las que no vinieron.
    $fijas acota la lista (los planes de un posnet: ['posnet_id' => 3]) y se guarda en cada fila.
    Lo que no se puede borrar porque ya lo usa otra tabla queda desactivado; si la tabla no tiene "activo", es un error. */
function guardar_lista($tabla, $filas, $fijas = []) {
  $donde = implode(' AND ', array_map(function ($k) { return "$k = ?"; }, array_keys($fijas))) ?: '1';
  $ids = [];
  foreach ($filas as $f) {
    $id = (int)($f['id'] ?? 0);
    unset($f['id']);
    $f += $fijas;
    $set = implode(', ', array_map(function ($k) { return "$k = ?"; }, array_keys($f)));
    try {
      if ($id) consulta("UPDATE $tabla SET $set WHERE id = ? AND $donde", array_merge(array_values($f), [$id], array_values($fijas)));
      else {
        consulta("INSERT INTO $tabla (" . implode(', ', array_keys($f)) . ') VALUES (' . implode(', ', array_fill(0, count($f), '?')) . ')', array_values($f));
        $id = (int)db()->lastInsertId();
      }
    } catch (PDOException $ex) {
      if (!es_duplicado($ex)) throw $ex;
      fallar(isset($f['nombre']) ? "“{$f['nombre']}” está repetido." : 'Hay dos planes iguales: mismo tipo de tarjeta, marca y cuotas.', 409);
    }
    $ids[] = $id;
  }
  $sobran = consulta("SELECT id FROM $tabla WHERE $donde" . ($ids ? ' AND id NOT IN (' . implode(',', $ids) . ')' : ''), array_values($fijas))->fetchAll(PDO::FETCH_COLUMN);
  foreach ($sobran as $id) {
    try {
      consulta("DELETE FROM $tabla WHERE id = ?", [$id]);
    } catch (PDOException $ex) {
      if (($ex->errorInfo[1] ?? 0) !== 1451) throw $ex; // 1451: lo usa una venta, un cobro o una dirección
      if ($tabla === 'localidades') fallar('No se puede quitar “' . consulta('SELECT nombre FROM localidades WHERE id = ?', [$id])->fetchColumn() . '”: hay clientes con esa localidad.', 409);
      consulta("UPDATE $tabla SET activo = 0 WHERE id = ?", [$id]);
    }
  }
  return $ids; // en el orden de $filas
}

/** {cuentas: [{id?, nombre, banco, titular, cbu_cvu, alias, activo}]} */
function configuracion_cuentas() {
  exigir('configuracion.editar');
  $filas = [];
  foreach ((array)(entrada()['cuentas'] ?? []) as $i => $c) {
    $n = 'Cuenta ' . ($i + 1);
    $cbu = preg_replace('/\D/', '', (string)($c['cbu_cvu'] ?? ''));
    if ($cbu !== '' && strlen($cbu) !== 22) fallar("$n: el CBU o CVU tiene 22 números.");
    $filas[] = [
      'id' => $c['id'] ?? 0,
      'nombre' => texto($c, 'nombre', 60, $n) ?? fallar("$n: poné un nombre corto, por ejemplo Macro o Mercado Pago."),
      'banco' => texto($c, 'banco', 60, "$n, banco"),
      'titular' => texto($c, 'titular', 120, "$n, titular"),
      'cbu_cvu' => $cbu === '' ? null : $cbu,
      'alias' => texto($c, 'alias', 40, "$n, alias"),
      'activo' => empty($c['activo']) ? 0 : 1,
    ];
  }
  db()->beginTransaction();
  guardar_lista('cuentas_bancarias', $filas);
  db()->commit();
  configuracion_ver();
}

/** {posnets: [{id?, nombre, proveedor, cuenta_liquidacion_id, activo, planes: [{id?, tipo_tarjeta, marca_tarjeta, cuotas, recargo_pct, activo}]}]} */
function configuracion_posnets() {
  exigir('configuracion.editar');
  $cuentas = consulta('SELECT id FROM cuentas_bancarias')->fetchAll(PDO::FETCH_COLUMN);
  $posnets = [];
  foreach ((array)(entrada()['posnets'] ?? []) as $i => $p) {
    $n = 'Posnet ' . ($i + 1);
    $cuenta = (int)($p['cuenta_liquidacion_id'] ?? 0) ?: null;
    if ($cuenta && !in_array($cuenta, $cuentas, true)) fallar("$n: no existe esa cuenta.");
    $nombre = texto($p, 'nombre', 60, $n) ?? fallar("$n: poné el nombre, por ejemplo Posnet Payway.");
    $planes = [];
    $vistos = []; // la clave única de la base no ataja "todas las marcas" repetido: con marca NULL, MySQL no los ve iguales
    foreach ((array)($p['planes'] ?? []) as $x) {
      if (!in_array($x['tipo_tarjeta'] ?? '', ['debito', 'credito'], true)) fallar("$nombre: elegí débito o crédito en cada plan.");
      $clave = $x['tipo_tarjeta'] . '|' . mb_strtolower(trim((string)($x['marca_tarjeta'] ?? ''))) . '|' . (int)($x['cuotas'] ?? 1);
      if (isset($vistos[$clave])) fallar("$nombre: hay dos planes iguales (mismo tipo de tarjeta, marca y cuotas).", 409);
      $vistos[$clave] = true;
      $planes[] = [
        'id' => $x['id'] ?? 0,
        'tipo_tarjeta' => $x['tipo_tarjeta'],
        'marca_tarjeta' => texto($x, 'marca_tarjeta', 30, "$nombre, marca"),
        'cuotas' => (int)(numero($x, 'cuotas', 1, 99, "$nombre, cuotas") ?? 1),
        'recargo_pct' => numero($x, 'recargo_pct', 0, 999, "$nombre, recargo") ?? 0,
        'activo' => empty($x['activo']) ? 0 : 1,
      ];
    }
    $posnets[] = ['fila' => ['id' => $p['id'] ?? 0, 'nombre' => $nombre, 'proveedor' => texto($p, 'proveedor', 60, "$n, proveedor"),
      'cuenta_liquidacion_id' => $cuenta, 'activo' => empty($p['activo']) ? 0 : 1], 'planes' => $planes];
  }
  db()->beginTransaction();
  // Primero los posnets (los nuevos reciben su id) y después los planes de cada uno
  $ids = guardar_lista('posnets', array_column($posnets, 'fila'));
  foreach ($posnets as $i => $p) guardar_lista('posnets_planes', $p['planes'], ['posnet_id' => $ids[$i]]);
  db()->commit();
  configuracion_ver();
}

/** {localidades: [{id?, nombre, provincia, codigo_area, codigo_postal}]}. Provincia y código de área van como texto: si no existen, se crean. */
function configuracion_localidades() {
  exigir('configuracion.editar');
  db()->beginTransaction();
  $buscar = function ($tabla, $columna, $valor) {
    if ($valor === null) return null;
    $id = consulta("SELECT id FROM $tabla WHERE $columna = ?", [$valor])->fetchColumn();
    if ($id) return (int)$id;
    consulta("INSERT INTO $tabla ($columna) VALUES (?)", [$valor]);
    return (int)db()->lastInsertId();
  };
  $filas = [];
  foreach ((array)(entrada()['localidades'] ?? []) as $i => $l) {
    $n = 'Localidad ' . ($i + 1);
    $area = preg_replace('/\D/', '', (string)($l['codigo_area'] ?? ''));
    if ($area !== '' && !preg_match('/^[1-9]\d{1,4}$/', $area)) fallar("$n: el código de área va sin el 0, por ejemplo 381.");
    $filas[] = [
      'id' => $l['id'] ?? 0,
      'nombre' => texto($l, 'nombre', 80, $n) ?? fallar("$n: falta el nombre."),
      'provincia_id' => $buscar('provincias', 'nombre', texto($l, 'provincia', 60, "$n, provincia") ?? fallar("$n: falta la provincia.")),
      'codigo_area_id' => $buscar('codigos_area', 'codigo', $area === '' ? null : $area),
      'codigo_postal' => texto($l, 'codigo_postal', 8, "$n, código postal"),
    ];
  }
  guardar_lista('localidades', $filas);
  db()->commit();
  configuracion_ver();
}
