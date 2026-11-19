// Todo para probar en la compu con un solo comando: npm run local
//   1. La base: una copia de la real en Docker (contenedor lu_mysql_local, puerto 3307). La primera vez se arma con
//      ../db/base-de-datos.sql (el esquema) y los datos del último export de phpMyAdmin (../db/a0101073_launion.sql).
//   2. La API: el PHP de XAMPP en localhost:8000. El panel la llama en /api/index.php y next dev se la pasa (next.config.ts).
//   3. La web y el panel: next dev en localhost:5057, o en la IP de la compu desde otra de la red. Se entra con los mismos usuarios que en la web real.
// npm run local:base borra la copia y la vuelve a armar con el export que haya en db/ (primero bajá uno nuevo de phpMyAdmin).
// Ctrl+C corta la API y el panel. La base queda prendida (es liviana) y arranca sola con Docker.
// Si falta api/config.php o .env.local, los arma (no se suben al repo).
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";

const DB = "../db/";
const CONTENEDOR = "lu_mysql_local";

const correr = (cmd, args, input) => spawnSync(cmd, args, { input, encoding: "utf8", maxBuffer: 1 << 28 });
const docker = (...args) => correr("docker", args);
// mysql adentro del contenedor, con la clave que ya tiene: el script no la necesita
const mysql = (sql, opciones = "") =>
  correr("docker", ["exec", "-i", CONTENEDOR, "sh", "-c", `mysql -uroot -p"$MYSQL_ROOT_PASSWORD" ${opciones} a0101073_launion`], sql);
const errores = (texto) => texto.split("\n").filter((l) => l.trim() && !l.includes("[Warning]")).join("\n");
function cortar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

if (docker("version", "--format", "{{.Server.Version}}").status !== 0) cortar("Docker no está prendido: abrí Docker Desktop y probá de nuevo.");

if (!existsSync("api/config.php")) {
  const env = docker("exec", CONTENEDOR, "printenv", "MYSQL_ROOT_PASSWORD");
  const clave = env.status === 0 ? env.stdout.trim() : randomBytes(15).toString("base64url");
  writeFileSync("api/config.php", `<?php
/* Solo para la compu (no se sube: está en .gitignore). Lo armó scripts/local.mjs: la API usa la copia de la base en Docker
   (contenedor ${CONTENEDOR}, puerto 3307). Todo se levanta con: npm run local */
return [
  'db_host' => '127.0.0.1;port=3307',
  'db_nombre' => 'a0101073_launion',
  'db_usuario' => 'root',
  'db_clave' => '${clave}',
  'jwt_secreto' => '${randomBytes(32).toString("hex")}',
  'token_horas' => 12,
  'cors_origen' => 'http://localhost:5057',
  // Fuera del repo: lo que se sube en la compu no se mezcla con el código. En pantalla no se ve (las fotos se leen de la web real)
  'carpeta_subidos' => __DIR__ . '/../../subidos-local/productos/subidos',
];
`);
}
if (!existsSync(".env.local")) copyFileSync(".env.example", ".env.local");
const clave = readFileSync("api/config.php", "utf8").match(/'db_clave' => '([^']*)'/)?.[1];
if (!clave) cortar("No encuentro db_clave en api/config.php.");

if (process.argv.includes("--base-nueva")) {
  console.log("Borrando la copia local de la base…");
  docker("rm", "-f", CONTENEDOR);
  docker("volume", "rm", CONTENEDOR);
}
const estado = docker("ps", "-a", "--filter", `name=^${CONTENEDOR}$`, "--format", "{{.State}}").stdout.trim();
if (!estado) {
  console.log("Creando la base local (la primera vez tarda unos minutos)…");
  const r = docker("run", "-d", "--name", CONTENEDOR, "--restart", "unless-stopped", "-e", `MYSQL_ROOT_PASSWORD=${clave}`,
    "-e", "MYSQL_DATABASE=a0101073_launion", "-p", "127.0.0.1:3307:3306", "-v", `${CONTENEDOR}:/var/lib/mysql`,
    "mysql:8.0", "--auto-increment-increment=3", "--auto-increment-offset=2"); // de a 3, como en Ferozo
  if (r.status !== 0) cortar(r.stderr);
} else if (estado !== "running") docker("start", CONTENEDOR);

// Está lista cuando atiende por red: la primera vez, MySQL arranca uno provisorio sin red para inicializarse
for (let i = 0; correr("docker", ["exec", CONTENEDOR, "sh", "-c", 'mysql -h127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1"']).status !== 0; i++) {
  if (i === 150) cortar(`La base local no arrancó. Mirá qué dice: docker logs ${CONTENEDOR}`);
  await new Promise((listo) => setTimeout(listo, 2000));
}

// Base vacía (recién creada): el esquema de base-de-datos.sql (sin sus datos fijos: ya vienen en el export) y los datos del export
if (mysql("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE();", "-N").stdout.trim() === "0") {
  for (const f of ["base-de-datos.sql", "a0101073_launion.sql", "prueba-completa.sql"]) if (!existsSync(DB + f)) cortar(`Falta db/${f}.`);
  const base = readFileSync(DB + "base-de-datos.sql", "utf8");
  const exportado = readFileSync(DB + "a0101073_launion.sql", "utf8");
  console.log(`Cargando la copia de la base: export del ${exportado.match(/Tiempo de generación: (.*)/)?.[1].trim() ?? "?"}…`);
  const datos = [];
  let adentro = false;
  for (const l of exportado.split("\n")) {
    if (l.startsWith("INSERT INTO")) adentro = true;
    if (adentro) datos.push(l);
    if (adentro && /\);\r?$/.test(l)) adentro = false;
  }
  const esquema = base.slice(base.indexOf("SET FOREIGN_KEY_CHECKS = 0;"), base.indexOf("SET FOREIGN_KEY_CHECKS = 1;"));
  const r = mysql(`SET NAMES utf8mb4;\nSET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n${esquema}\n${datos.join("\n")}\nSET FOREIGN_KEY_CHECKS = 1;\n`);
  if (r.status !== 0) cortar(`No se pudo cargar la base:\n${errores(r.stderr)}\nSi el export tiene columnas que db/base-de-datos.sql no, actualizalo y corré npm run local:base.`);
  console.log(`Prueba de la base: ${mysql(readFileSync(DB + "prueba-completa.sql", "utf8")).stdout.trim().split("\n").pop()}`);
}

// Dos vendedores de prueba, solo en la copia local: para asignarles ventas y para entrar como Vendedor.
// Usuarios vendedor1 y vendedor2, contraseña prueba1234. Si se borran, vuelven en el próximo npm run local
if (mysql("SELECT COUNT(*) FROM usuarios WHERE nombre_usuario = 'vendedor1';", "-N").stdout.trim() === "0") {
  const hash = "$2y$10$vA6k5o6FEPx9F08nD1oi/uo8QRKr1KdHHQwU4PUr4gylECTnSOHVu"; // password_hash('prueba1234')
  const r = mysql(`START TRANSACTION;\n${[1, 2].map((n) => `
INSERT INTO personas (nombre, apellido) VALUES ('Vendedor Prueba ${n}', '');
INSERT INTO empleados (persona_id, puesto, lugar_trabajo) VALUES (LAST_INSERT_ID(), 'Vendedor', 'showroom');
INSERT INTO usuarios (empleado_id, rol_id, nombre_usuario, clave_hash, debe_cambiar_clave)
  SELECT LAST_INSERT_ID(), id, 'vendedor${n}', '${hash}', 0 FROM roles WHERE nombre = 'Vendedor';`).join("")}\nCOMMIT;\n`);
  console.log(r.status ? `No se pudieron crear los vendedores de prueba:\n${errores(r.stderr)}` : "Vendedores de prueba: vendedor1 y vendedor2.");
}
// Clientes que ya compraron (scripts/clientes-prueba.sql), también solo en la copia local
if (mysql("SELECT COUNT(*) FROM personas WHERE dni = '99100001';", "-N").stdout.trim() === "0") {
  const r = mysql(readFileSync("scripts/clientes-prueba.sql", "utf8"));
  console.log(r.status ? `No se pudieron cargar los clientes de prueba:\n${errores(r.stderr)}` : "Clientes de prueba: 5, con 8 ventas anteriores (DNI 99100001 a 99100005).");
}

// La API y el panel. Del PHP solo se muestran los errores, no cada pedido que sale bien
const php = existsSync("C:/xampp/php/php.exe") ? "C:/xampp/php/php.exe" : "php";
// Sin los avisos de "obsoleto" del PHP nuevo de XAMPP (8.5): salen antes del JSON y lo rompen. Ferozo es 7.4 y no los da
const api = spawn(php, ["-d", "error_reporting=E_ALL & ~E_DEPRECATED", "-S", "localhost:8000", "-t", "api"]);
api.on("error", () => cortar("No encuentro PHP: instalá XAMPP en C:\\xampp o poné php en el PATH."));
for (const salida of [api.stdout, api.stderr]) salida.on("data", (d) => String(d).split("\n").map((l) => l.trim())
  .filter((l) => l && !/ (Accepted|Closing)$| \[[234]\d\d\]: /.test(l)).forEach((l) => console.log(`[api] ${l}`)));
const web = spawn("npm run dev -- -p 5057", { stdio: "inherit", shell: true });
for (const p of [api, web]) p.on("exit", (codigo) => {
  api.kill();
  web.kill();
  process.exit(codigo ?? 0);
});
console.log("\n  Panel: http://localhost:5057/admin/ (con tu usuario de siempre)   Web: http://localhost:5057/   Ctrl+C para cortar");
const ips = Object.values(networkInterfaces()).flat().filter((i) => i?.family === "IPv4" && !i.internal).map((i) => `http://${i.address}:5057/admin/`);
console.log(`  Desde otra compu de la red: ${ips.join("   ")}\n`);
