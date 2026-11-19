// Prueba de los teléfonos de lib/formato.ts (código de área, 0, 15 y formato para WhatsApp): node --no-warnings scripts/prueba-telefonos.mjs
import assert from "node:assert/strict";
import { largoArea, normTelefono, numeroLocal, telefonoLindo } from "../lib/formato.ts";

// Pasar a 549 + 10 cifras, como lo pide WhatsApp
assert.equal(normTelefono("381 319-6842"), "5493813196842");
assert.equal(normTelefono("0381 15 319-6842"), "5493813196842"); // con 0 y 15
assert.equal(normTelefono("+54 9 381 319-6842"), "5493813196842");
assert.equal(normTelefono("+54 381 319-6842"), "5493813196842"); // sin el 9
assert.equal(normTelefono("03865 15 12-3456"), "5493865123456"); // Concepción, 4 cifras
assert.equal(normTelefono("011 15 5555-1234"), "5491155551234"); // Buenos Aires, 2 cifras
assert.equal(normTelefono("319-6842"), "3196842"); // sin código de área: no lo inventa (la validación lo rechaza)

// Partir el código de área
assert.equal(largoArea("3813196842"), 3);
assert.equal(largoArea("3865123456"), 4);
assert.equal(largoArea("3858421234"), 4); // Termas: empieza como Santiago (385) pero es de 4
assert.equal(largoArea("3854211234"), 4);
assert.equal(largoArea("3851211234"), 3); // Santiago, 385
assert.equal(largoArea("1155551234"), 2);

// Mostrar
assert.equal(telefonoLindo("5493813196842"), "381 319-6842");
assert.equal(telefonoLindo("5493865123456"), "3865 12-3456");
assert.equal(telefonoLindo("5491155551234"), "11 5555-1234");
assert.equal(numeroLocal("3196", 7), "319-6"); // el guión va donde va a quedar mientras se escribe
assert.equal(numeroLocal("319", 7), "319");

console.log("Teléfonos: todo OK");
