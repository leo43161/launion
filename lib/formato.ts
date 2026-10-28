// Montos, medidas, teléfonos y textos (es-AR). Sin dependencias.
import type { Medidas, Monto } from "./tipos";

const NF = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
export const num = (n: number | Monto): string => NF.format(Math.round(Number(n) || 0));
export const ars = (n: number | Monto): string => (Number(n) < 0 ? "− $ " : "$ ") + num(Math.abs(Number(n)));
export const parseArs = (s: string): number => +s.replace(/\D/g, "") || 0;

const FH = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
/** "2026-10-26 10:46:00" (como lo manda MySQL) → "26 oct, 10:46" */
export const fechaHora = (v: string | null): string => (v ? FH.format(new Date(v.replace(" ", "T"))).replace(".", "") : "—");

/** "80 × 160 × 40 cm", "Alto 75 · Ø 60 cm" o el texto si no tiene medidas fijas. */
export function medidas(p: Medidas): string {
  if (p.diametro_cm) return [p.alto_cm && `Alto ${p.alto_cm}`, `Ø ${p.diametro_cm}`].filter(Boolean).join(" · ") + " cm";
  const partes = [p.ancho_cm, p.alto_cm, p.profundidad_cm].filter(Boolean);
  return partes.length ? partes.join(" × ") + " cm" : p.texto_medidas || "";
}

/** Mensaje de WhatsApp que arma la web cuando el producto no tiene uno propio. */
export function mensajeWhatsapp(p: Medidas & { nombre: string; detalle_medidas: string | null }): string {
  const med = [p.ancho_cm && `Frente ${p.ancho_cm} cm`, p.alto_cm && `Alto ${p.alto_cm} cm`, p.profundidad_cm && `Profundidad ${p.profundidad_cm} cm`, p.diametro_cm && `Diámetro ${p.diametro_cm} cm`]
    .filter(Boolean).join(" · ") || p.texto_medidas;
  const extra = [med, p.detalle_medidas].filter(Boolean).join(" — ");
  return `Hola! Vi el ${p.nombre}${extra ? ` (${extra})` : ""} en la web y quiero consultar precio y financiación.`;
}

/** "5493813196842" → "381 319-6842" */
export const telefonoLindo = (p: string | null): string => {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("549")) return `${d.slice(3, 6)} ${d.slice(6, 9)}-${d.slice(9)}`;
  return d;
};
/** A formato WhatsApp: 549 + código de área + número, sin 0 ni 15. */
export const normTelefono = (p: string): string => {
  let d = p.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "549" + d;
  if (d.length === 12 && d.startsWith("54") && !d.startsWith("549")) d = "549" + d.slice(2);
  return d;
};

export const norm = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const iniciales = (n: string): string => n.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";

const ND = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3, useGrouping: false });
/** Cantidades y medidas con decimales, sin puntos de miles (así parseDec las vuelve a leer igual): 0.65 → "0,65", 1250 → "1250". */
export const dec = (n: number | Monto): string => ND.format(Number(n) || 0);
/** "0,65" o "0.65" → 0.65 (con coma, los puntos son de miles: "1.250,5" → 1250.5). Vacío → null; si no es un número, NaN. */
export const parseDec = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
};
/** Presupuestos: precio = costo × multiplicador, al centavo. */
export const precioPresupuesto = (costo: number | Monto, multiplicador: number | Monto): number => Math.round(Number(costo) * Number(multiplicador) * 100) / 100;

const NP = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
/** Pesos con centavos si los tiene, sin "$": 77000 → "77.000", 12.5 → "12,5". */
export const pesos = (n: number | Monto): string => NP.format(Number(n) || 0);
/** "77.000", "$ 77000" o "12,50" → número: los puntos son de miles y la coma, de los centavos. Vacío → null; si no es un número, NaN. */
export const parsePesos = (s: string): number | null => {
  const t = s.replace(/[$\s]/g, "");
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
