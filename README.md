# La Unión · web y panel nuevos (Next.js + API PHP)

- `app/`, `components/`, `lib/`: la web y el panel, en Next.js con TypeScript, exportados en estático (`npm run build` revisa los tipos y deja todo en `out/`).
  - `app/(web)/` y `components/web/`: la **web pública**, con el mismo diseño de `muebleria/index.html` pasado a Tailwind (colores y temas en `app/(web)/web.css`). Lee el catálogo de la API (ruta `web`, sin token).
  - `app/admin/`: el **panel**, con su propio CSS (`app/admin.css`, sin Tailwind).
- `lib/tipos.ts`: lo que manda y devuelve cada ruta de la API. Si cambia algo en PHP, se cambia acá y TypeScript marca cada pantalla que hay que ajustar.
- `api/`: la API en PHP 7.4, con login por JWT. Lee y escribe la base `a0101073_launion`.
- Por ahora: la web pública, y en el panel ingreso, **Catálogo** (alta, edición, fotos, video, precios, ocultar, eliminar y restaurar) y **Vendedores**.

## Probar en la compu

Hace falta MySQL con la base cargada (`db/base-de-datos.sql` + `db/datos-iniciales.sql`), PHP con pdo_mysql (sirve el de XAMPP) y unos 500 MB libres para `npm install`.

1. Copiá `api/config.example.php` como `api/config.php`:
   - Completá los datos de la base local.
   - Generá el secreto con `php -r "echo bin2hex(random_bytes(32));"`.
   - Poné `'cors_origen' => 'http://localhost:3000'`.
2. Levantá la API: `php -S localhost:8000 -t api`
3. Copiá `.env.example` como `.env.local`. Después corré `npm install` y `npm run dev`, y abrí http://localhost:3000/ (la web) o http://localhost:3000/admin/ (el panel)

Para entrar se usa el usuario `admin`, con la misma contraseña de `/administracion`.

## Subir a Ferozo

La web está en `public_html/launion/`. El `.htaccess` de `public_html` manda `launionmuebles.com.ar` ahí, y en la dirección no se ve `/launion`.

| Qué | Carpeta en Ferozo | Dirección |
|---|---|---|
| API | `public_html/launion/api/` | launionmuebles.com.ar/api/index.php |
| Prueba (`npm run build:dev`) | `public_html/launion/dev/` | launionmuebles.com.ar/dev/ (web) y /dev/admin/ (panel) |
| Final (`npm run build`) | `public_html/launion/` | launionmuebles.com.ar/ y /admin/ |

### Automático: cada push a main

`.github/workflows/produccion.yml` corre `npm run build` y sube `out/` por FTP a `public_html/launion/`: es la web de la raíz.
- Sube solo lo que cambió y borra los archivos viejos que subió él. No toca `api/`, `assets/` ni nada que no haya subido.
- Necesita tres secretos en GitHub (Settings → Secrets and variables → Actions): `FTP_SERVIDOR`, `FTP_USUARIO` y `FTP_CLAVE`.
- La API no se sube sola: si cambia algo en `api/`, se sube a mano.
- Para volver a correrlo sin hacer push: Actions → Subir a producción → Run workflow.

### Primero: prueba en /dev

1. **Base**: en phpMyAdmin, base `a0101073_launion`, Importar, en este orden:
   1. `db/vaciar-base.sql`, solo mientras no haya datos reales.
   2. `db/base-de-datos.sql`.
   3. `db/datos-iniciales.sql`.
   4. `db/prueba-completa.sql`. Tiene que dar "35 de 35 · TODO OK".
2. **API**:
   1. Subí el contenido de `api/` a `public_html/launion/api/`. Incluye los ocultos `.htaccess` y `.user.ini`.
   2. Ahí mismo, copiá `config.example.php` como `config.php`.
   3. En `config.php` completá `db_usuario` y `db_clave`: son los de la base en el panel de Ferozo.
   4. En `jwt_secreto` pegá lo que da `C:\xampp\php\php.exe -r "echo bin2hex(random_bytes(32));"`.
   5. Comprobá que https://launionmuebles.com.ar/api/index.php?r=auth/yo muestra `{"error":"La sesión venció. Volvé a ingresar."}`.
3. **Fotos del catálogo**: subí `MUEBLERIA/productos/fotos/` a `public_html/launion/assets/productos/fotos/`. Hoy la web las toma de Lovable, pero el panel las busca acá. Conviene subirlas en un .zip, descomprimirlo en el servidor y borrar el .zip.
4. **Web y panel**: subí el contenido de `out/` a `public_html/launion/dev/` (y `api/` de nuevo, si cambió). El `out/` tiene que estar armado con `npm run build:dev`.
5. **Probá la web** en https://launionmuebles.com.ar/dev/: inicio, un ambiente, la búsqueda, un modelo (fotos, video, foto ampliada) y los colores. El link de vendedor (/valentina) recién anda en la raíz.
6. **Probá el panel** en https://launionmuebles.com.ar/dev/admin/, con `admin` y la contraseña de `/administracion`:
   - editar y guardar un modelo;
   - subir una foto;
   - ocultar un modelo;
   - los vendedores;
   - salir.

   Si después de ingresar te devuelve al ingreso, el servidor no le pasa el token a PHP: avisá.

### Después: pasar a la raíz

Es el día del cambio: desde ahí la web muestra lo que está en la base, y `/administracion` deja de usarse. Si en `/administracion` se cargaron cambios después de importar la base, regenerá los datos con el `productos.json` de ese día (abajo) e importalos.

1. **Armá** la versión final: `npm run build` (sin `:dev`).
2. **Guardá una copia** de `public_html/launion/index.html` y `public_html/launion/.htaccess` (la web anterior), por si hay que volver.
3. **Borrá** `public_html/launion/admin/`, que es el panel de demostración.
4. **Subí el contenido de `out/`** a `public_html/launion/`, reemplazando. Incluye:
   - el `index.html` nuevo, que reemplaza a la web anterior;
   - el `.htaccess` (sale de `public/.htaccess`), que es el anterior sin las reglas del panel de demostración.
5. **Borrá** `public_html/launion/dev/`.
6. Cuando la web nueva ande bien, borrá `public_html/launion/administracion/`, para que nadie cargue cambios ahí por error.

Mientras la web nueva esté solo en `/dev`, la de la raíz sigue leyendo `data/productos.json` (lo que se carga en `/administracion`). Lo que se cambie en el panel nuevo se ve en `/dev`, no en la raíz.

Para achicar las fotos del catálogo que pesan más de 500 KB (como hace la subida): `C:\xampp\php\php.exe api\herramientas\achicar-fotos.php ..\productos\fotos <salida>`. En la salida quedan solo las que cambiaron, con sus carpetas y nombres: se suben encima de `public_html/launion/assets/productos/fotos/`.

Para regenerar los datos con lo último de `/administracion`:
```
C:\xampp\php\php.exe api\herramientas\migrar-json.php <productos.json del servidor> ..\db\datos-iniciales.sql "<hash del admin en administracion/api.php>"
```
