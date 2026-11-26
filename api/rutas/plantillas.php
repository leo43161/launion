<?php
/* Plantillas de mensajes de WhatsApp. Las usa cualquier usuario (el botón "Mensaje" de un modelo del catálogo, de una venta
   o de un cliente) y las edita quien puede editar el catálogo. El texto lleva variables entre llaves ({nombre}, {cliente}…):
   las completa el panel, que muestra cada una donde se completan todas sus variables (lib/plantillas.ts). */

function plantillas_listar() {
  usuario();
  salir(['plantillas' => consulta('SELECT id, nombre, texto FROM plantillas_mensajes ORDER BY orden, id')->fetchAll()]);
}

/** {plantillas: [{id?, nombre, texto}]}: la lista completa, en orden. La que no viene se borra. */
function plantillas_guardar() {
  exigir('catalogo.editar');
  $lista = entrada()['plantillas'] ?? null;
  if (!is_array($lista)) fallar('Datos inválidos.');
  $nombres = [];
  foreach ($lista as $i => &$pl) {
    $n = $i + 1;
    $pl['nombre'] = texto($pl, 'nombre', 80, "Plantilla $n: el nombre");
    $pl['texto'] = texto($pl, 'texto', 4000, "Plantilla $n: el texto");
    if (!$pl['nombre']) fallar("Plantilla $n: falta el nombre.");
    if (!$pl['texto']) fallar("{$pl['nombre']}: falta el texto.");
    $clave = mb_strtolower($pl['nombre']);
    if (isset($nombres[$clave])) fallar("Hay dos plantillas “{$pl['nombre']}”: cambiale el nombre a una.");
    $nombres[$clave] = true;
  }
  unset($pl);

  db()->beginTransaction();
  $ids = array_filter(array_map(function ($pl) { return (int)($pl['id'] ?? 0); }, $lista));
  consulta('DELETE FROM plantillas_mensajes' . ($ids ? ' WHERE id NOT IN (' . implode(',', $ids) . ')' : ''));
  foreach ($lista as $i => $pl) {
    if (!empty($pl['id'])) consulta('UPDATE plantillas_mensajes SET nombre = ?, texto = ?, orden = ? WHERE id = ?', [$pl['nombre'], $pl['texto'], $i + 1, (int)$pl['id']]);
    else consulta('INSERT INTO plantillas_mensajes (nombre, texto, orden) VALUES (?, ?, ?)', [$pl['nombre'], $pl['texto'], $i + 1]);
  }
  db()->commit();
  plantillas_listar();
}
