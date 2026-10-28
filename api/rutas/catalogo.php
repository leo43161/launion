<?php
/* Catálogo: ambientes (categorías principales), tipos (subcategorías) y productos con fotos y precios. */

// Las dos listas de precios las crea db/datos-iniciales.sql con estos ids.
const LISTA_WEB = 1;   // la que muestra la web: fijo, "desde" o rango
const LISTA_LOCAL = 2; // precio del local, interno: solo con el permiso precios.ver

function precio_vigente_sql($lista) {
  return "(SELECT pp.monto FROM productos_precios pp WHERE pp.producto_id = p.id AND pp.lista_precio_id = $lista
    AND pp.vigente_desde <= CURDATE() ORDER BY pp.vigente_desde DESC LIMIT 1)";
}
function precio_vigente($producto, $lista) {
  return consulta('SELECT tipo_precio, monto, monto_hasta FROM productos_precios
    WHERE producto_id = ? AND lista_precio_id = ? AND vigente_desde <= CURDATE() ORDER BY vigente_desde DESC LIMIT 1', [$producto, $lista])->fetch() ?: null;
}

/** Todo lo que necesita la lista del panel, en un pedido. */
function catalogo_listar() {
  usuario();
  $categorias = consulta('SELECT id, padre_id, nombre, slug, publico, orden, visible FROM categorias ORDER BY orden, nombre')->fetchAll();
  $productos = consulta(
    'SELECT p.id, p.categoria_id, p.nombre, p.codigo, p.ancho_cm, p.alto_cm, p.profundidad_cm, p.diametro_cm, p.texto_medidas,
       p.visible, p.destacado, p.url_video IS NOT NULL AS tiene_video, p.eliminado_en IS NOT NULL AS eliminado,
       (SELECT f.url FROM productos_fotos f WHERE f.producto_id = p.id ORDER BY f.orden LIMIT 1) AS foto,
       (SELECT COUNT(*) FROM productos_fotos f WHERE f.producto_id = p.id) AS fotos, '
    . (puede('precios.ver') ? precio_vigente_sql(LISTA_LOCAL) : 'NULL') . ' AS precio_local
     FROM productos p ORDER BY p.creado_en, p.nombre')->fetchAll();
  salir(['categorias' => $categorias, 'productos' => $productos]);
}

function producto_ver() {
  usuario();
  $id = (int)($_GET['id'] ?? 0);
  $p = consulta('SELECT p.*, COALESCE(c.padre_id, c.id) AS ambiente_id, c.nombre AS tipo
    FROM productos p JOIN categorias c ON c.id = p.categoria_id WHERE p.id = ?', [$id])->fetch();
  if (!$p) fallar('No existe ese producto.', 404);
  $p['caracteristicas'] = json_decode($p['caracteristicas'] ?? '[]', true) ?: [];
  $p['fotos'] = consulta('SELECT url FROM productos_fotos WHERE producto_id = ? ORDER BY orden', [$id])->fetchAll(PDO::FETCH_COLUMN);
  $p['precio_web'] = precio_vigente($id, LISTA_WEB);
  $p['precio_local'] = puede('precios.ver') ? (precio_vigente($id, LISTA_LOCAL)['monto'] ?? null) : null;
  $p['presupuestos'] = consulta('SELECT p.id, p.nombre, p.multiplicador, p.precio_final, ' . COSTO_SQL . ' AS costo FROM presupuestos p WHERE p.producto_id = ? ORDER BY p.id', [$id])->fetchAll();
  salir(['producto' => $p]);
}

/** Alta o modificación (con "id"). Fotos y precios llegan completos y se guardan en la misma transacción. */
function producto_guardar() {
  exigir('catalogo.editar');
  $e = entrada();
  $nombre = texto($e, 'nombre', 120, 'Nombre');
  $tipo = texto($e, 'tipo', 80, 'Tipo de mueble');
  if (!$nombre || !$tipo) fallar('Completá el nombre y el tipo de mueble.');
  $ambiente = consulta('SELECT id, slug FROM categorias WHERE id = ? AND padre_id IS NULL', [(int)($e['ambiente_id'] ?? 0)])->fetch();
  if (!$ambiente) fallar('Elegí un ambiente.');
  $cm = function ($k) use ($e) {
    $v = $e[$k] ?? null;
    return $v === null || $v === '' ? null : max(0, min(9999, (int)$v));
  };
  $lista = function ($k) use ($e) {
    return array_values(array_filter(array_map(function ($v) { return trim((string)$v); }, (array)($e[$k] ?? [])), 'strlen'));
  };
  $caracteristicas = $lista('caracteristicas');
  $fotos = $lista('fotos');

  $datos = [
    'codigo' => texto($e, 'codigo', 30, 'Código'),
    'nombre' => $nombre,
    'descripcion_corta' => texto($e, 'descripcion_corta', 160, 'Frase corta'),
    'variante' => texto($e, 'variante', 80, 'Etiqueta de la foto'),
    'ancho_cm' => $cm('ancho_cm'), 'alto_cm' => $cm('alto_cm'), 'profundidad_cm' => $cm('profundidad_cm'), 'diametro_cm' => $cm('diametro_cm'),
    'detalle_medidas' => texto($e, 'detalle_medidas', 120, 'Detalle de medidas'),
    'texto_medidas' => texto($e, 'texto_medidas', 120, 'Texto de medidas'),
    'caracteristicas' => json_encode($caracteristicas, JSON_UNESCAPED_UNICODE),
    'nota' => texto($e, 'nota', 160, 'Nota'),
    'mensaje_whatsapp' => texto($e, 'mensaje_whatsapp', 1000, 'Mensaje de WhatsApp'),
    'visible' => empty($e['visible']) ? 0 : 1,
    'destacado' => empty($e['destacado']) ? 0 : 1,
    'url_video' => texto($e, 'url_video', 500, 'Video'),
    'actualizado_por' => usuario()['id'],
  ];
  $id = (int)($e['id'] ?? 0); // 0 = alta

  db()->beginTransaction();
  $datos['categoria_id'] = subcategoria($ambiente, $tipo);
  try {
    if ($id) {
      if (!consulta('SELECT 1 FROM productos WHERE id = ?', [$id])->fetchColumn()) fallar('No existe ese producto.', 404);
      consulta('UPDATE productos SET ' . implode(', ', array_map(function ($k) { return "$k = ?"; }, array_keys($datos))) . ' WHERE id = ?',
        array_merge(array_values($datos), [$id]));
    } else {
      consulta('INSERT INTO productos (' . implode(', ', array_keys($datos)) . ') VALUES (' . implode(', ', array_fill(0, count($datos), '?')) . ')', array_values($datos));
      $id = (int)db()->lastInsertId();
    }
  } catch (PDOException $ex) {
    if (!es_duplicado($ex)) throw $ex;
    db()->rollBack();
    fallar("Ya hay otro producto con el código {$datos['codigo']}.", 409);
  }
  consulta('DELETE FROM productos_fotos WHERE producto_id = ?', [$id]);
  foreach ($fotos as $i => $url) consulta('INSERT INTO productos_fotos (producto_id, url, orden) VALUES (?, ?, ?)', [$id, $url, $i]);
  guardar_precio($id, LISTA_WEB, $e['precio_web'] ?? null);
  if (puede('precios.ver')) guardar_precio($id, LISTA_LOCAL, ['tipo_precio' => 'fijo', 'monto' => $e['precio_local'] ?? null]);
  db()->commit();
  salir(['id' => $id]);
}

/** El tipo de mueble es una subcategoría del ambiente. Si es nuevo, se crea: así aparece como filtro en la web. */
function subcategoria($ambiente, $tipo) {
  $id = consulta('SELECT id FROM categorias WHERE padre_id = ? AND nombre = ?', [$ambiente['id'], $tipo])->fetchColumn();
  if ($id) return (int)$id;
  $base = $ambiente['slug'] . '-' . slug($tipo);
  $slug = $base;
  for ($n = 2; consulta('SELECT 1 FROM categorias WHERE slug = ?', [$slug])->fetchColumn(); $n++) $slug = "$base-$n";
  $orden = consulta('SELECT COALESCE(MAX(orden), 0) + 1 FROM categorias WHERE padre_id = ?', [$ambiente['id']])->fetchColumn();
  consulta('INSERT INTO categorias (padre_id, nombre, slug, orden) VALUES (?, ?, ?, ?)', [$ambiente['id'], $tipo, $slug, $orden]);
  return (int)db()->lastInsertId();
}

/** Precios con historial: si cambió, fila nueva desde hoy (si ya cambió hoy, se corrige esa).
    Sin monto = sin precio en esa lista: se borran sus filas. */
function guardar_precio($producto, $lista, $p) {
  $monto = is_array($p) && is_numeric($p['monto'] ?? null) ? round((float)$p['monto'], 2) : null;
  if ($monto === null) {
    consulta('DELETE FROM productos_precios WHERE producto_id = ? AND lista_precio_id = ?', [$producto, $lista]);
    return;
  }
  $tipo = in_array($p['tipo_precio'] ?? '', ['fijo', 'rango', 'desde'], true) ? $p['tipo_precio'] : 'fijo';
  $hasta = $tipo === 'rango' && is_numeric($p['monto_hasta'] ?? null) ? round((float)$p['monto_hasta'], 2) : null;
  if ($monto < 0) fallar('El precio no puede ser negativo.');
  if ($tipo === 'rango' && ($hasta === null || $hasta <= $monto)) fallar('En un rango de precios, el "hasta" tiene que ser mayor que el "desde".');
  $actual = precio_vigente($producto, $lista);
  if ($actual && $actual['tipo_precio'] === $tipo && (float)$actual['monto'] === $monto
    && ($actual['monto_hasta'] === null ? null : (float)$actual['monto_hasta']) === $hasta) return;
  consulta('INSERT INTO productos_precios (producto_id, lista_precio_id, tipo_precio, monto, monto_hasta, creado_por) VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE tipo_precio = VALUES(tipo_precio), monto = VALUES(monto), monto_hasta = VALUES(monto_hasta), creado_por = VALUES(creado_por)',
    [$producto, $lista, $tipo, $monto, $hasta, usuario()['id']]);
}

/** {id, visible} muestra u oculta en la web. {id, eliminado} elimina o restaura (nunca se borra: puede estar en ventas). */
function producto_estado() {
  exigir('catalogo.editar');
  $e = entrada();
  $id = (int)($e['id'] ?? 0);
  if (array_key_exists('visible', $e)) consulta('UPDATE productos SET visible = ?, actualizado_por = ? WHERE id = ?', [$e['visible'] ? 1 : 0, usuario()['id'], $id]);
  if (array_key_exists('eliminado', $e)) consulta('UPDATE productos SET eliminado_en = ' . ($e['eliminado'] ? 'NOW()' : 'NULL') . ', actualizado_por = ? WHERE id = ?', [usuario()['id'], $id]);
  salir(['ok' => true]);
}
