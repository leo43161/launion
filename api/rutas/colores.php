<?php
/* Colores de la web (la vista Colores y "Elegí el color" del inicio). Los cargan y ordenan ellos desde el panel.
   visible = en stock: el que no está, no se ve en la web. activo = 0 es un color borrado (hoy no hay cómo borrar).
   proveedor y línea quedan de los de Faplac (herramientas/colores-faplac.php), pero la web ya no los muestra. */

function colores_listar() {
  exigir('catalogo.editar');
  $colores = consulta('SELECT id, nombre, material_id, textura, codigo_proveedor AS codigo, descripcion, url_imagen AS muestra, fotos, visible
    FROM colores WHERE activo = 1 ORDER BY orden, id')->fetchAll();
  foreach ($colores as &$c) $c['fotos'] = json_decode($c['fotos'] ?? '[]', true) ?: [];
  unset($c);
  salir(['colores' => $colores, 'materiales' => consulta('SELECT id, nombre FROM materiales WHERE activo = 1 ORDER BY orden, nombre')->fetchAll()]);
}

/** {id?, nombre, material_id, textura, codigo, descripcion, muestra, fotos, visible}. Sin id = color nuevo: va primero. */
function color_guardar() {
  exigir('catalogo.editar');
  $e = entrada();
  $id = (int)($e['id'] ?? 0);
  $nombre = texto($e, 'nombre', 60, 'Nombre');
  if (!$nombre) fallar('Falta el nombre del color.');
  if (consulta('SELECT 1 FROM colores WHERE nombre = ? AND activo = 1 AND id <> ?', [$nombre, $id])->fetchColumn()) fallar("Ya hay un color “{$nombre}”.");
  $material = (int)($e['material_id'] ?? 0) ?: null;
  if ($material && !consulta('SELECT 1 FROM materiales WHERE id = ?', [$material])->fetchColumn()) fallar('Ese material no existe.');
  $fotos = array_values(array_filter(array_map(function ($v) { return trim((string)$v); }, (array)($e['fotos'] ?? [])), 'strlen'));
  $datos = [
    $nombre, $material, texto($e, 'textura', 40, 'Textura'), texto($e, 'codigo', 30, 'Código'), texto($e, 'descripcion', 2000, 'Descripción'),
    texto($e, 'muestra', 500, 'Muestra'), json_encode($fotos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), empty($e['visible']) ? 0 : 1,
  ];
  if ($id) {
    consulta('UPDATE colores SET nombre = ?, material_id = ?, textura = ?, codigo_proveedor = ?, descripcion = ?, url_imagen = ?, fotos = ?, visible = ?
      WHERE id = ? AND activo = 1', array_merge($datos, [$id]));
  } else {
    // orden: uno menos que el primero, así el nuevo queda arriba de todo
    consulta('INSERT INTO colores (nombre, material_id, textura, codigo_proveedor, descripcion, url_imagen, fotos, visible, orden)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, IFNULL(MIN(orden), 1) - 1 FROM colores', $datos);
  }
  colores_listar();
}

/** {id, visible}: en stock (se ve en la web) o no. */
function color_estado() {
  exigir('catalogo.editar');
  $e = entrada();
  consulta('UPDATE colores SET visible = ? WHERE id = ?', [empty($e['visible']) ? 0 : 1, (int)($e['id'] ?? 0)]);
  salir(['ok' => true]);
}

/** {ids: [...]}: todos los colores en el orden nuevo. La web los muestra así. */
function colores_orden() {
  exigir('catalogo.editar');
  $ids = array_map('intval', (array)(entrada()['ids'] ?? []));
  db()->beginTransaction();
  foreach ($ids as $i => $id) consulta('UPDATE colores SET orden = ? WHERE id = ?', [$i + 1, $id]);
  db()->commit();
  salir(['ok' => true]);
}
