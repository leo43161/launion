<?php
/* Subida de fotos y videos (catálogo y presupuestos). Cualquier usuario del panel. Multipart con el campo "file" → {url: "assets/productos/subidos/<archivo>"} */

const TIPOS_SUBIDA = ['jpg' => 'image/', 'jpeg' => 'image/', 'png' => 'image/', 'webp' => 'image/', 'mp4' => 'video/', 'webm' => 'video/'];
const FOTO_MAXIMO = 500 * 1024; // las fotos más pesadas se recomprimen: la web tiene que cargar rápido con datos móviles

function subir_archivo() {
  usuario();
  $f = $_FILES['file'] ?? null;
  if (!$f) fallar('El archivo es más grande que el máximo del servidor (' . ini_get('post_max_size') . ').', 413);
  if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE)
    fallar('El archivo es más grande que el máximo del servidor (' . ini_get('upload_max_filesize') . ').', 413);
  if ($f['error'] !== UPLOAD_ERR_OK) fallar('No se pudo subir el archivo (código ' . $f['error'] . ').');

  $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
  $mime = class_exists('finfo') ? (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']) : (TIPOS_SUBIDA[$ext] ?? '');
  if (!array_key_exists($ext, TIPOS_SUBIDA) || strpos($mime, TIPOS_SUBIDA[$ext]) !== 0)
    fallar('Solo fotos JPG, PNG o WebP y videos MP4 o WebM.', 415);

  $liviana = TIPOS_SUBIDA[$ext] === 'image/' && filesize($f['tmp_name']) > FOTO_MAXIMO ? foto_liviana($f['tmp_name']) : null;
  if ($liviana !== null) $ext = 'jpg';

  // Nombre nuevo: solo a-z, 0-9 y guiones + extensión permitida (nunca puede quedar algo ejecutable como .php)
  $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(pathinfo($f['name'], PATHINFO_FILENAME))), '-') ?: 'archivo';
  $nombre = substr($base, 0, 60) . '-' . bin2hex(random_bytes(3)) . '.' . $ext;
  $destino = CFG['carpeta_subidos'] . '/' . $nombre;
  if (!is_dir(CFG['carpeta_subidos'])) mkdir(CFG['carpeta_subidos'], 0755, true);
  if (!($liviana !== null ? file_put_contents($destino, $liviana) : move_uploaded_file($f['tmp_name'], $destino)))
    fallar('No se pudo guardar el archivo. Revisá los permisos de assets/productos.', 500);
  salir(['url' => "assets/productos/subidos/$nombre"]);
}

/** La foto como JPEG de hasta FOTO_MAXIMO, perdiendo lo menos posible: primero prueba en su tamaño con calidad 90, 85 y 80
    (a 80 todavía no se nota), y si no alcanza la achica de a poco (2560, 2048, 1600 px de lado mayor…), que en pantalla
    se nota menos que bajar más la calidad. null = no se pudo (sin GD o foto enorme): se guarda como vino. */
function foto_liviana($ruta) {
  $tam = @getimagesize($ruta);
  if (!function_exists('imagecreatefromstring') || !$tam || $tam[0] * $tam[1] > 50e6) return null; // más de 50 MP no entra en memoria
  @ini_set('memory_limit', '512M');
  $img = @imagecreatefromstring(file_get_contents($ruta));
  if (!$img) return null;

  // Las fotos del celular vienen guardadas de costado con una marca de "girar al mostrar": el JPEG nuevo no la lleva, así que se gira acá
  $giro = 1;
  if ($tam[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) $giro = (int)(@exif_read_data($ruta)['Orientation'] ?? 1);
  $grados = [3 => 180, 5 => 270, 6 => 270, 7 => 270, 8 => 90][$giro] ?? 0;
  $espejo = [2 => IMG_FLIP_HORIZONTAL, 4 => IMG_FLIP_VERTICAL, 5 => IMG_FLIP_HORIZONTAL, 7 => IMG_FLIP_VERTICAL][$giro] ?? 0;
  if ($grados) { $girada = imagerotate($img, $grados, 0); imagedestroy($img); $img = $girada; }
  if ($espejo) imageflip($img, $espejo);

  // El perfil de color (los iPhone guardan en Display P3): sin él los colores salen más apagados
  $icc = $tam[2] === IMAGETYPE_JPEG ? perfil_icc(file_get_contents($ruta)) : '';

  $ancho = imagesx($img);
  $alto = imagesy($img);
  $jpg = null;
  foreach ([0, 2560, 2048, 1600, 1280, 1024] as $lado) { // 0 = su tamaño
    $escala = $lado ? $lado / max($ancho, $alto) : 1;
    if ($escala >= 1 && $lado) continue;
    $w = (int)round($ancho * $escala);
    $h = (int)round($alto * $escala);
    $lienzo = imagecreatetruecolor($w, $h);
    imagefill($lienzo, 0, 0, imagecolorallocate($lienzo, 255, 255, 255)); // lo transparente (PNG recortados) queda blanco: JPEG no tiene transparencia
    imagecopyresampled($lienzo, $img, 0, 0, 0, 0, $w, $h, $ancho, $alto);
    imageinterlace($lienzo, true); // progresivo: en conexiones lentas aparece entera y se va definiendo
    foreach ([90, 85, 80] as $calidad) {
      ob_start();
      imagejpeg($lienzo, null, $calidad);
      $jpg = con_perfil_icc(ob_get_clean(), $icc);
      if (strlen($jpg) <= FOTO_MAXIMO) break 2;
    }
    imagedestroy($lienzo);
  }
  imagedestroy($img);
  return $jpg; // si ni a 1024 px entra (casi imposible), queda esa: igual es mucho más liviana que la original
}

/** Los segmentos ICC_PROFILE (APP2) de un JPEG, tal cual, para pasarlos al nuevo. */
function perfil_icc($jpg) {
  $icc = '';
  for ($i = 2; $i + 4 <= strlen($jpg) && $jpg[$i] === "\xFF"; $i += 2 + $largo) {
    $marca = ord($jpg[$i + 1]);
    $largo = unpack('n', substr($jpg, $i + 2, 2))[1];
    if ($marca === 0xDA) break; // empiezan los datos de la imagen
    if ($marca === 0xE2 && substr($jpg, $i + 4, 12) === "ICC_PROFILE\0") $icc .= substr($jpg, $i, 2 + $largo);
  }
  return $icc;
}

/** Inserta el perfil después del encabezado JFIF que escribe GD. */
function con_perfil_icc($jpg, $icc) {
  if ($icc === '') return $jpg;
  $p = substr($jpg, 2, 2) === "\xFF\xE0" ? 4 + unpack('n', substr($jpg, 4, 2))[1] : 2;
  return substr($jpg, 0, $p) . $icc . substr($jpg, $p);
}
