// Prueba de subir precios en bloque (subirPrecio de lib/formato.ts, la misma cuenta que precio_subido() en api/rutas/precios.php):
// node --no-warnings scripts/prueba-precios.mjs
import assert from "node:assert/strict";
import { subirPrecio } from "../lib/formato.ts";

assert.equal(subirPrecio(850000, 10, true), 935000); // justo en el mil: no sube a 936.000 por el error de coma flotante
assert.equal(subirPrecio("850000.00", 10, true), 935000); // DECIMAL llega como texto
assert.equal(subirPrecio(988152, 10, true), 1087000); // 1.086.967,2 → para arriba al mil
assert.equal(subirPrecio(988152, 10, false), 1086967); // sin redondear: a pesos enteros
assert.equal(subirPrecio(399999, 7.5, true), 430000); // 429.998,93
assert.equal(subirPrecio(100000, -10, true), 90000); // también baja
console.log("Precios: todo OK");
