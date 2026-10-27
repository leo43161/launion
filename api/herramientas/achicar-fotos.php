<?php
/* Achica las fotos del catálogo que pesan más de 500 KB, con la misma función que la subida (foto_liviana()).
   Uso: php achicar-fotos.php <carpeta de fotos> <carpeta de salida>
   En la salida quedan solo las que cambiaron, con las mismas subcarpetas y el mismo nombre, para subirlas encima de
   assets/productos/fotos/ sin tocar la base. Una .png queda con su nombre pero adentro es JPEG: los navegadores la abren igual. */

if (PHP_SAPI !== 'cli') exit;
require __DIR__ . '/../rutas/subir.php';
[, $origen, $salida] = $argv + [null, null, null];
if (!$origen || !$salida) exit("Uso: php achicar-fotos.php <carpeta de fotos> <carpeta de salida>\n");
$origen = rtrim($origen, '/\\');

$cuantas = 0;
foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($origen, FilesystemIterator::SKIP_DOTS)) as $f) {
  if (!preg_match('/\.(jpe?g|png|webp)$/i', $f->getFilename()) || $f->getSize() <= FOTO_MAXIMO) continue;
  $relativa = substr($f->getPathname(), strlen($origen) + 1);
  $jpg = foto_liviana($f->getPathname());
  if ($jpg === null) { echo "No se pudo achicar: $relativa\n"; continue; }
  @mkdir(dirname("$salida/$relativa"), 0777, true);
  file_put_contents("$salida/$relativa", $jpg);
  printf("%5d KB → %3d KB  %s\n", $f->getSize() / 1024, strlen($jpg) / 1024, $relativa);
  $cuantas++;
}
echo "$cuantas fotos achicadas en $salida\n";
