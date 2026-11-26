// Prueba de las plantillas de mensajes (lib/plantillas.ts): node --no-warnings scripts/prueba-plantillas.mjs
import assert from "node:assert/strict";
import { armarMensaje, sirve } from "../lib/plantillas.ts";

const texto = "Hola! Te paso el {nombre}.\nMedidas: {medidas}\nPrecio: {precio}\n{foto}\n{vendedor} · La Unión";

// Todo completo
assert.equal(armarMensaje(texto, { nombre: "Placard", medidas: "180 × 220 cm", precio: "$ 850.000", foto: "https://x/f.jpg", vendedor: "Pilar" }),
  "Hola! Te paso el Placard.\nMedidas: 180 × 220 cm\nPrecio: $ 850.000\nhttps://x/f.jpg\nPilar · La Unión");

// Sin medidas ni foto: esos renglones se sacan; con null o espacios, también
assert.equal(armarMensaje(texto, { nombre: "Placard", medidas: null, precio: "$ 850.000", foto: "  ", vendedor: "Pilar" }),
  "Hola! Te paso el Placard.\nPrecio: $ 850.000\nPilar · La Unión");

// Un renglón con una variable llena y otra vacía se queda, con la vacía en blanco
assert.equal(armarMensaje("{nombre} {codigo}", { nombre: "Cómoda" }), "Cómoda ");

// Lo que no es una variable queda como está, y los renglones sin variables (aunque estén vacíos) también
assert.equal(armarMensaje("Precio {precio} {hola}\n\nChau", { precio: "$ 1" }), "Precio $ 1 {hola}\n\nChau");
assert.equal(armarMensaje("{hola}", {}), "{hola}");

// En mayúsculas
assert.equal(armarMensaje("✨ {NOMBRE} · {Nombre}", { nombre: "Maquillador 110 cm LED – Modelo Golden" }),
  "✨ MAQUILLADOR 110 CM LED – MODELO GOLDEN · Maquillador 110 cm LED – Modelo Golden");

// Las características: el renglón se repite por cada una; sin ninguna, se saca; sola en un renglón con otra variable llena, queda vacía
const car = ["5 cajones con correderas telescópicas", " ", "Patas regulables"];
assert.equal(armarMensaje("⚙️ CARACTERÍSTICAS\n✔️ {caracteristicas}\nFin", { caracteristicas: car }),
  "⚙️ CARACTERÍSTICAS\n✔️ 5 cajones con correderas telescópicas\n✔️ Patas regulables\nFin");
assert.equal(armarMensaje("{nombre}: {caracteristicas}", { nombre: "Cómoda", caracteristicas: [] }), "Cómoda: ");

// Un bloque (entre líneas en blanco) al que se le sacaron todos los renglones con variables se saca entero, con su título y su
// línea en blanco; el que tiene alguno lleno queda, y el que no tiene variables también
assert.equal(armarMensaje("✨ {NOMBRE}\n\n⚙️ CARACTERÍSTICAS\n✔️ {caracteristicas}\n\n💳 TARJETA\n💳 3 cuotas: {precio +19% /3}\n\nGracias",
  { nombre: "Cómoda", caracteristicas: [], precio: null }), "✨ CÓMODA\n\nGracias");
assert.equal(armarMensaje("📏 MEDIDAS\n▪️ Frente: {ancho}\n▪️ Alto: {alto}", { alto: "80 cm" }), "📏 MEDIDAS\n▪️ Alto: 80 cm");
assert.equal(armarMensaje("Código: {codigo}\n\nHola\n\n\nChau {nombre}", { nombre: "Ana" }), "Hola\n\n\nChau Ana"); // sin el blanco del bloque sacado
assert.equal(armarMensaje("\nHola {nombre}\n", { nombre: "Ana" }), "\nHola Ana\n"); // los blancos del principio y del final quedan
assert.equal(armarMensaje("Hola\n\n{nombre}\n", {}), "Hola\n");

// Las cuentas, con los números del mensaje de ejemplo del Maquillador Golden ($ 529.999)
const precio = { precio: "$ 529.999" };
const plan = (t) => armarMensaje(t, precio);
assert.equal(plan("{precio 50%}"), "$ 265.000"); // entrega inicial
assert.equal(plan("{precio 50% +8% /3}"), "$ 95.400"); // el saldo en 3 semanas
assert.equal(plan("{precio +15% /4}"), "$ 152.375");
assert.equal(plan("{precio +50% /6}"), "$ 132.500");
assert.equal(plan("{precio +40% /10}"), "$ 74.200");
assert.equal(plan("{precio+25%/6} {precio +19,5% /3} {precio -10%} {precio /0}"), "$ 110.417 $ 211.117 $ 477.000 $ 529.999");
// Con el precio "desde" o "de… a…" de la web no hay cuotas: sale el contado, y los renglones y bloques de cuotas no
const planes = "🔥 {precio}\n\n💰 50% + 3 SEMANAS\n✔️ Entrega: {precio 50%} y 3 semanas de {precio 50% +8% /3}\n\n💳 TARJETA\n💳 3 cuotas: {precio +19% /3}";
assert.equal(armarMensaje(planes, { precio: "Desde $ 529.999" }), "🔥 Desde $ 529.999");
assert.equal(armarMensaje(planes, { precio: "$ 500.000 a $ 600.000" }), "🔥 $ 500.000 a $ 600.000");
assert.equal(armarMensaje(planes, { precio: "$529.999" }),
  "🔥 $529.999\n\n💰 50% + 3 SEMANAS\n✔️ Entrega: $ 265.000 y 3 semanas de $ 95.400\n\n💳 TARJETA\n💳 3 cuotas: $ 210.233");
assert.equal(armarMensaje("{saldo /3}", { saldo: "$ 400.000" }), "$ 133.334");
assert.equal(armarMensaje("Cuotas: {precio +25% /6}", { precio: null }), ""); // sin precio, el renglón se saca
assert.equal(armarMensaje("{codigo 50%} {precio +x}", { codigo: "05-147", precio: "$ 1" }), "05-147 {precio +x}"); // sin cuentas o mal escritas

// Dónde sale cada plantilla: donde se completan todas sus variables
assert.equal(sirve(texto, "modelo"), true);
assert.equal(sirve(texto, "presupuesto"), true);
assert.equal(sirve(texto, "venta"), false);
assert.equal(sirve("{NOMBRE} {precio +25% /6} ✔️ {caracteristicas}", "presupuesto"), true);
assert.equal(sirve("{precio_local}", "presupuesto"), false);
const saldo = "Hola {cliente}, tu compra {venta} se entrega el {entrega}.\nTe queda por pagar {saldo}.\n{vendedor}";
assert.equal(sirve(saldo, "venta"), true);
assert.equal(sirve(saldo, "cliente"), false); // {venta} y {entrega} no están en Clientes
assert.equal(sirve("Hola {cliente}, debés {saldo /3}. {vendedor}", "cliente"), true);
assert.equal(sirve("Hola {cliente}, te paso el {nombre}", "venta"), false); // mezcla: no sale en ningún lado
assert.equal(sirve("Hola {cliente}, te paso el {nombre}", "modelo"), false);
for (const d of ["modelo", "presupuesto", "venta", "cliente"]) assert.equal(sirve("Gracias por elegirnos {hola}", d), true); // sin variables: en todos

console.log("Plantillas: todo OK");
