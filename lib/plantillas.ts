// Plantillas de mensajes de WhatsApp: el texto lleva variables entre llaves ({nombre}, {precio}, {cliente}…) que se completan
// con los datos de un modelo del catálogo, un presupuesto, una venta o un cliente (el botón de WhatsApp, components/Mensaje.tsx).
//   {NOMBRE}             en mayúsculas.
//   {precio +25% /6}     cuentas con la plata ({precio}, {precio_local}, {total}, {saldo}), de izquierda a derecha: +N% recargo,
//                        -N% descuento, N% esa parte (50% = la mitad), /N en N cuotas. Redondea para arriba a pesos enteros.
//                        Solo con un monto: con un precio "desde" o "de… a…" de la web no calcula cuotas (el renglón no sale).
//   ✔️ {caracteristicas}  el renglón se repite una vez por cada característica.
// Sin imports: se prueba con node --no-warnings scripts/prueba-plantillas.mjs

/** Dónde está el botón, y cómo se llama esa sección en el panel. */
export const LUGARES = { modelo: "Catálogo", presupuesto: "Presupuestos", venta: "Ventas", cliente: "Clientes" } as const;
export type Donde = keyof typeof LUGARES;

const MUEBLE = ["modelo", "presupuesto"] as const; // en un presupuesto, lo del modelo vinculado (menos el nombre, el precio y la foto)

/** Las variables que se pueden usar, dónde se completan y un ejemplo para la vista previa. */
export const VARIABLES = [
  { clave: "nombre", texto: "El nombre del modelo o del presupuesto", ejemplo: "Maquillador 110 cm LED – Modelo Golden", en: MUEBLE },
  { clave: "medidas", texto: "Las medidas", ejemplo: "110 × 80 × 40 cm", en: MUEBLE },
  { clave: "ancho", texto: "El ancho (el frente)", ejemplo: "110 cm", en: MUEBLE },
  { clave: "alto", texto: "El alto", ejemplo: "80 cm", en: MUEBLE },
  { clave: "profundidad", texto: "La profundidad", ejemplo: "40 cm", en: MUEBLE },
  { clave: "precio", texto: "El precio: en el Catálogo el del local o, si no, el de la web; el final en Presupuestos", ejemplo: "$ 529.999", en: MUEBLE },
  { clave: "precio_local", texto: "El precio del local", ejemplo: "$ 499.999", en: ["modelo"] },
  { clave: "codigo", texto: "El código del modelo", ejemplo: "05-147-0115", en: MUEBLE },
  { clave: "tipo", texto: "El tipo de mueble", ejemplo: "Maquilladores", en: MUEBLE },
  { clave: "descripcion", texto: "La frase corta de la web", ejemplo: "Tu rincón de maquillaje con luz LED", en: MUEBLE },
  { clave: "caracteristicas", texto: "Las características: el renglón se repite por cada una (✔️ {caracteristicas})", ejemplo: ["5 cajones con correderas telescópicas", "Espejo LED de 110 × 74 cm"], en: MUEBLE },
  { clave: "foto", texto: "El link a la foto: WhatsApp la muestra en el mensaje", ejemplo: "https://launionmuebles.com.ar/assets/productos/fotos/maquillador.jpg", en: MUEBLE },
  { clave: "link", texto: "El link a la web con los modelos de ese tipo", ejemplo: "https://launionmuebles.com.ar/?catalogo=dormitorio&tipo=maquilladores", en: ["modelo"] },
  { clave: "cliente", texto: "El nombre del cliente", ejemplo: "Laura", en: ["venta", "cliente"] },
  { clave: "venta", texto: "El número de la venta", ejemplo: "LU-0012", en: ["venta"] },
  { clave: "muebles", texto: "Los muebles de la venta", ejemplo: "Placard 3 puertas, 2× Mesa de luz", en: ["venta"] },
  { clave: "total", texto: "El total de la venta", ejemplo: "$ 1.250.000", en: ["venta"] },
  { clave: "saldo", texto: "Lo que falta pagar: de la venta, o en Clientes lo que debe en total. Si no debe, el renglón no sale", ejemplo: "$ 400.000", en: ["venta", "cliente"] },
  { clave: "entrega", texto: "La fecha de entrega prometida", ejemplo: "15 dic 2026", en: ["venta"] },
  { clave: "vendedor", texto: "Tu nombre", ejemplo: "Pilar", en: ["modelo", "presupuesto", "venta", "cliente"] },
] as const;

export type Clave = (typeof VARIABLES)[number]["clave"];
export type Valores = Partial<Record<Clave, string | readonly string[] | null>>; // lista: las características

const CLAVES = new Set<string>(VARIABLES.map((v) => v.clave));
const PLATA = new Set(["precio", "precio_local", "total", "saldo"]); // las que aceptan cuentas
export const EJEMPLO: Valores = Object.fromEntries(VARIABLES.map((v) => [v.clave, v.ejemplo]));

// {clave} o {clave +25% /6}: la clave (en minúsculas o en mayúsculas) y las cuentas
const VARIABLE = /\{(\w+)((?:\s*(?:[+-]?\d+(?:[.,]\d+)?\s*%|\/\s*\d+))*)\s*\}/g;
const CUENTA = /([+-]?)(\d+(?:[.,]\d+)?)\s*%|\/\s*(\d+)/g;
const NF = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** "$ 529.999" → 529999. Un precio "Desde $ 529.999" o "$ 500.000 a $ 600.000" (de la web) no es un monto: las cuotas
 *  sobre el mínimo le prometerían al cliente menos de lo que va a pagar. */
const aNumero = (s: string): number | null => {
  const m = s.match(/^\$\s*(\d[\d.]*(?:,\d+)?)$/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : null;
};
function cuenta(monto: number, cuentas: string): number {
  for (const [, signo, pct, cuotas] of cuentas.matchAll(CUENTA)) {
    if (cuotas) monto /= Number(cuotas) || 1;
    else {
      const p = Number(pct.replace(",", ".")) / 100;
      monto *= signo === "+" ? 1 + p : signo === "-" ? 1 - p : p;
    }
  }
  return Math.ceil(Math.round(monto * 100) / 100); // primero al centavo (el error de coma flotante), después para arriba a pesos
}

/** Si la plantilla sale en ese lugar: todas sus variables se completan ahí. La que no tiene variables sale en todos. */
export function sirve(texto: string, donde: Donde): boolean {
  return [...texto.matchAll(VARIABLE)].every((m) => {
    const v = VARIABLES.find((x) => x.clave === m[1].toLowerCase());
    return !v || (v.en as readonly string[]).includes(donde);
  });
}

/** Completa las variables. Si todas las de un renglón quedan vacías (o sus cuentas no se pueden hacer), se saca el renglón
 *  ("Medidas: {medidas}" sin medidas). Y si en un bloque (los renglones entre líneas en blanco) se sacaron todos los que tenían
 *  variables, se saca el bloque entero: así no queda el título solo ("⚙️ CARACTERÍSTICAS" sin características, los planes de
 *  pago sin precio). Lo que está entre llaves y no es una variable queda como está. */
export function armarMensaje(texto: string, valores: Valores): string {
  const v = valores as Record<string, string | readonly string[] | null | undefined>;
  /** Lo que va en lugar de una variable: el valor, con las cuentas hechas y en mayúsculas si va {ASÍ}. */
  const valor = (clave: string, cuentas: string, x: string | readonly string[] | null | undefined): string => {
    const k = clave.toLowerCase();
    let s = (Array.isArray(x) ? x.join(" · ") : String(x ?? "")).trim();
    if (cuentas.trim() && PLATA.has(k)) {
      const n = aNumero(s);
      s = n === null ? "" : `$ ${NF.format(cuenta(n, cuentas))}`;
    }
    return clave !== k && clave === clave.toUpperCase() ? s.toLocaleUpperCase("es-AR") : s;
  };
  /** Los renglones que salen de uno de la plantilla (ninguno, uno, o uno por característica) y si tenía variables. */
  const armar = (renglon: string): { sale: string[]; variables: boolean } => {
    const usadas = [...renglon.matchAll(VARIABLE)].map((m) => m[1].toLowerCase()).filter((k) => CLAVES.has(k));
    if (!usadas.length) return { sale: [renglon], variables: false };
    const lista = usadas.find((k) => Array.isArray(v[k])); // el renglón se repite por cada elemento
    const items = lista ? (v[lista] as readonly string[]).filter((s) => s.trim()) : [];
    const sale = (items.length ? items : [""]).flatMap((item) => {
      let alguna = false; // si alguna variable del renglón quedó con algo
      const r = renglon.replace(VARIABLE, (todo, clave: string, cuentas: string) => {
        const k = clave.toLowerCase();
        if (!CLAVES.has(k)) return todo;
        const s = valor(clave, cuentas, k === lista ? item : v[k]);
        if (s) alguna = true;
        return s;
      });
      return alguna ? [r] : [];
    });
    return { sale, variables: true };
  };
  const renglones = texto.split("\n");
  const salida: string[] = [];
  let blancos: string[] = []; // las líneas en blanco antes del bloque que sigue: si el bloque se saca, se van con él
  for (let i = 0; i < renglones.length;) {
    if (!renglones[i].trim()) { blancos.push(renglones[i++]); continue; }
    const desde = i;
    while (i < renglones.length && renglones[i].trim()) i++;
    const armados = renglones.slice(desde, i).map(armar);
    const conVariables = armados.filter((a) => a.variables);
    if (conVariables.length && conVariables.every((a) => !a.sale.length)) { blancos = []; continue; }
    // Las del principio solo si eran las del principio de la plantilla (y no las de después de un bloque que se sacó)
    salida.push(...(salida.length || blancos.length === desde ? blancos : []), ...armados.flatMap((a) => a.sale));
    blancos = [];
  }
  const resultado = [...salida, ...blancos].join("\n");
  // Si no quedó nada (p. ej. una plantilla toda de {precio} y el mueble no tiene ningún precio), se dejan los textos con las
  // variables en blanco: queda listo para escribir los precios a mano y mandarlo, en vez de un mensaje vacío.
  if (resultado.trim()) return resultado;
  return texto.replace(VARIABLE, (todo, clave: string) => (CLAVES.has(clave.toLowerCase()) ? "" : todo));
}
