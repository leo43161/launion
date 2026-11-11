// Textos y cuentas de las ventas que comparten la lista, el formulario, la ficha y la hoja impresa.
import type { Cobro, Direccion, EstadoCivil, EstadoVenta, Frecuencia, Monto } from "./tipos";
import { ars, fecha, hoyISO } from "./formato";

export const ESTADO_CIVIL: Record<EstadoCivil, string> = {
  soltero: "Soltero/a", casado: "Casado/a", union_convivencial: "Unión convivencial", divorciado: "Divorciado/a", viudo: "Viudo/a",
};
export const FRECUENCIA: Record<Frecuencia, string> = { semanal: "Semanal", quincenal: "Quincenal", mensual: "Mensual" };
export const CONCEPTO: Record<Cobro["concepto"], string> = { sena: "Seña", anticipo: "Anticipo", saldo: "Saldo", pago_total: "Pago total", pago_a_cuenta: "Pago a cuenta" };

/** "6 cuotas mensuales", "1 cuota", "3 cuotas" */
export const textoCuotas = (n: number | null, frecuencia: Frecuencia | "" | null): string =>
  `${n ?? "?"} ${n === 1 ? "cuota" : "cuotas"}${frecuencia ? ` ${FRECUENCIA[frecuencia].toLowerCase()}${n === 1 ? "" : "es"}` : ""}`;

/** "Macro", "Payway · 6 cuotas de $ 10.383 · +24,6 %", "6 cuotas mensuales de $ 166.667 · desde el 3 dic 2026 · Crédito Nº 4512" */
export function detalleCobro(c: Cobro): string {
  if (c.medio_tipo === "credito_casa")
    return [`${textoCuotas(c.cuotas, c.frecuencia_cuotas)} de ${ars(c.monto_cuota ?? 0)}`, c.fecha_primer_vencimiento && `desde el ${fecha(c.fecha_primer_vencimiento)}`, c.referencia && `Crédito Nº ${c.referencia}`].filter(Boolean).join(" · ");
  return [c.cuenta, c.posnet, c.cuotas && c.cuotas > 1 && `${c.cuotas} cuotas de ${ars(c.monto_cuota ?? 0)}`, Number(c.recargo_pct) > 0 && `+${String(Number(c.recargo_pct)).replace(".", ",")} %`, c.referencia].filter(Boolean).join(" · ");
}

/** "Laprida 980, piso 4 B · Barrio Norte · San Miguel de Tucumán" */
export function direccionTexto(d: Omit<Direccion, "id" | "localidad_id" | "provincia"> | null): string {
  if (!d) return "";
  const piso = [d.piso && `piso ${d.piso}`, d.departamento].filter(Boolean).join(" ");
  return [[`${d.calle} ${d.numero ?? ""}`.trim(), piso].filter(Boolean).join(", "), d.barrio, d.localidad].filter(Boolean).join(" · ");
}

export const saldo = (v: { total: Monto; pagado: Monto }): number => Math.round((Number(v.total) - Number(v.pagado)) * 100) / 100;

/** Cómo está la venta: cancelada y en pausa salen del estado; entregada, de la marca; atrasada, de la fecha prometida. */
export function situacion(v: { estado: EstadoVenta; entregado_en: string | null; fecha_entrega: string }): { texto: string; tono: "ok" | "bad" | "warn" | "info" } {
  if (v.estado === "cancelada") return { texto: "Cancelada", tono: "bad" };
  if (v.entregado_en) return { texto: "Entregada", tono: "ok" };
  if (v.estado === "pausa") return { texto: "En pausa", tono: "warn" };
  if (v.fecha_entrega < hoyISO()) return { texto: "Atrasada", tono: "bad" };
  return { texto: "En curso", tono: "info" };
}

/** "Faltan 5 días", "Hoy", "Atrasada 3 días" */
export function cuandoEntrega(fecha: string): string {
  const dias = Math.round((new Date(fecha + "T00:00").getTime() - new Date(hoyISO() + "T00:00").getTime()) / 864e5);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return dias > 0 ? `Faltan ${dias} días` : `Atrasada ${-dias} ${dias === -1 ? "día" : "días"}`;
}
