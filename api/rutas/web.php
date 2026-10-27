<?php
/* Web pública: todo lo que muestra la página, en un pedido y sin token.
   Solo lo visible y el precio de la lista Web: el precio del local nunca sale de acá. */

function web_catalogo() {
  $ambientes = consulta('SELECT id, slug, nombre, publico, frase, url_portada AS portada FROM categorias
    WHERE padre_id IS NULL AND visible = 1 ORDER BY orden, nombre')->fetchAll();
  $modelos = consulta('SELECT p.id, a.slug AS ambiente, c.nombre AS tipo, p.nombre, p.codigo, p.descripcion_corta, p.variante,
      p.ancho_cm, p.alto_cm, p.profundidad_cm, p.diametro_cm, p.detalle_medidas, p.texto_medidas, p.caracteristicas, p.nota,
      p.mensaje_whatsapp, p.url_video, p.destacado
    FROM productos p JOIN categorias c ON c.id = p.categoria_id JOIN categorias a ON a.id = c.padre_id
    WHERE p.visible = 1 AND p.eliminado_en IS NULL AND c.visible = 1 AND a.visible = 1
    ORDER BY p.creado_en, p.id')->fetchAll();

  $fotos = [];
  foreach (consulta('SELECT producto_id, url FROM productos_fotos ORDER BY producto_id, orden') as $f) $fotos[$f['producto_id']][] = $f['url'];
  $precios = []; // en orden de vigencia: el último que queda es el vigente
  foreach (consulta('SELECT producto_id, tipo_precio, monto, monto_hasta FROM productos_precios
    WHERE lista_precio_id = ? AND vigente_desde <= CURDATE() ORDER BY vigente_desde', [LISTA_WEB]) as $p) $precios[$p['producto_id']] = $p;

  $tipos = []; // los tipos de cada ambiente que tienen algo para mostrar, en el orden del panel
  foreach ($modelos as &$m) {
    $m['caracteristicas'] = json_decode($m['caracteristicas'] ?? '[]', true) ?: [];
    $m['fotos'] = $fotos[$m['id']] ?? [];
    $p = $precios[$m['id']] ?? null;
    $m['precio'] = $p ? ['tipo_precio' => $p['tipo_precio'], 'monto' => $p['monto'], 'monto_hasta' => $p['monto_hasta']] : null;
    $tipos[$m['ambiente']][$m['tipo']] = true;
  }
  unset($m);
  $orden_tipos = consulta('SELECT a.slug, c.nombre FROM categorias c JOIN categorias a ON a.id = c.padre_id ORDER BY c.orden, c.nombre')->fetchAll();
  foreach ($ambientes as &$a) {
    $a['tipos'] = [];
    foreach ($orden_tipos as $t) if ($t['slug'] === $a['slug'] && isset($tipos[$a['slug']][$t['nombre']])) $a['tipos'][] = $t['nombre'];
    unset($a['id']);
  }
  unset($a);

  $trabajos = consulta('SELECT id, titulo FROM trabajos WHERE visible = 1 ORDER BY creado_en, id')->fetchAll();
  $fotos = [];
  foreach (consulta('SELECT trabajo_id, url FROM trabajos_fotos ORDER BY trabajo_id, orden') as $f) $fotos[$f['trabajo_id']][] = $f['url'];
  foreach ($trabajos as &$t) $t['fotos'] = $fotos[$t['id']] ?? [];
  unset($t);

  $vendedores = consulta('SELECT e.link_web, t.numero_completo FROM empleados e
    JOIN telefonos t ON t.persona_id = e.persona_id AND t.es_principal = 1 WHERE e.link_web IS NOT NULL')->fetchAll(PDO::FETCH_KEY_PAIR);

  salir(['ambientes' => $ambientes, 'modelos' => $modelos, 'trabajos' => $trabajos, 'vendedores' => (object)$vendedores]);
}
