// La web pública: el catálogo que devuelve la ruta "web", listo para mostrar, y los textos de cada modelo.
import { ars, mensajeWhatsapp } from "./formato";
import type { AmbienteWeb, ModeloWeb, Precio, Respuestas, TrabajoWeb } from "./tipos";

export type Publico = "casa" | "negocio";
export type Modelo = ModeloWeb & { i: number }; // i: posición en el catálogo (el orden en que se cargaron), para desempatar
export type Ambiente = AmbienteWeb & { n: number; rel: string[] }; // n: modelos visibles; rel: ambientes que combinan
export type Catalogo = { P: Modelo[]; ambientes: Ambiente[]; R: Record<string, Ambiente>; trabajos: TrabajoWeb[]; vendedores: Record<string, string> };

export const PUBLICOS: Record<Publico, string> = { casa: "Para tu casa", negocio: "Para tu negocio" };
export const TELEFONO = "5493812194874"; // el de la mueblería, sin link de vendedor

/** Qué ambientes se sugieren en el listado después de cada uno ("Combina bien"). */
const RELACIONADOS: Record<string, string[]> = {
  dormitorio: ["belleza", "living"], belleza: ["dormitorio", "unas"], living: ["dormitorio", "cocina"], cocina: ["living", "dormitorio"],
  estudio: ["belleza", "dormitorio"], kiosco: ["panaderia", "local"], local: ["kiosco", "oficina"], panaderia: ["kiosco", "local"],
  unas: ["belleza", "oficina"], ropa: ["local", "oficina"], oficina: ["local", "estudio"], libreria: ["kiosco", "local"],
};

/** Fotos fijas de la página (están en assets/productos/fotos, como las del catálogo). */
const F = "assets/productos/fotos/";
export const FOTOS = {
  hero: F + "a54fce4c-a09b-484b-adc2-befdc27a32e4/hero-showroom.jpg",
  familia: F + "1b59df01-e203-4979-a920-1cb076861504/familia.jpg",
  fabrica: F + "625e25e5-faf5-4c90-940e-7abc0cd6b4b0/fabrica.jpg",
  showroom: F + "952079fd-0e81-4036-a6dd-38d5bb78c2f5/showroom.jpg",
  taller: F + "66ced53d-e080-465e-b641-b49f9b94feb5/footer-taller.jpg",
  cocina: F + "81a52854-d097-4a74-89dd-5b10ad14f149/cocina-1.jpg",
  placard13: F + "75fd7596-2dc6-4ff8-a155-620b57364728/placard-13-a.jpg",
  placard14: F + "e852c466-4536-4855-808b-afe5bda6e89a/placard-14-a.jpg",
  placard15: F + "c6adfb36-56f5-47fd-b95c-66cef54169e6/placard-15.jpg",
};

/** Trabajos: el título sin el número es el grupo de la pestaña. */
export const GRUPOS_TRABAJO = [["Placard a medida", "Placares"], ["Cocina a medida", "Cocinas"], ["Salón a medida", "Salones"]] as const;
export const grupoDe = (t: TrabajoWeb): string => t.titulo.replace(/\s+\d+$/, "");
/** "Placard a medida 03" → "Placard a medida · 03" */
export const tituloTrabajo = (t: TrabajoWeb): string => t.titulo.replace(/\s+(\d+)$/, " · $1");

export function armarCatalogo(d: Respuestas["web"]): Catalogo {
  const P = d.modelos.map((m, i) => ({ ...m, i }));
  const ambientes = d.ambientes.map((a) => ({ ...a, n: P.filter((p) => p.ambiente === a.slug).length, rel: RELACIONADOS[a.slug] || [] }));
  return { P, ambientes, R: Object.fromEntries(ambientes.map((a) => [a.slug, a])), trabajos: d.trabajos, vendedores: d.vendedores };
}

export const tieneMedidas = (p: Modelo): boolean => [p.ancho_cm, p.alto_cm, p.profundidad_cm, p.diametro_cm].some((v) => v != null);
/** Ancho para filtrar y ordenar por medida (o el diámetro). */
export const anchoDe = (p: Modelo): number | null => p.ancho_cm || p.diametro_cm || null;
export const esLed = (p: Modelo): boolean => /led|luz|focos/i.test(`${p.nombre} ${p.variante || ""} ${p.caracteristicas.join(" ")}`);

/** "Ancho 80 · Alto 160 · Prof. 40 cm" para la tarjeta. */
export function lineaMedidas(p: Modelo): string {
  if (!tieneMedidas(p)) return p.texto_medidas || "";
  const { ancho_cm: f, alto_cm: a, profundidad_cm: pr, diametro_cm: di } = p;
  if (di) return `${a ? `Alto ${a} · ` : ""}Diámetro ${di} cm`;
  return [f && `Ancho ${f}`, a && `Alto ${a}`, pr && `Prof. ${pr}`].filter(Boolean).join(" · ") + " cm";
}

/** Etiquetas: las características, o si no tiene, la nota o el detalle de medidas cortados en partes. */
export const etiquetas = (p: Modelo): string[] =>
  (p.caracteristicas.length ? p.caracteristicas : (p.nota || p.detalle_medidas || "").split(/\s·\s|\s—\s/).filter(Boolean)).map((s) => s.replace(/^\w/, (m) => m.toUpperCase()));

/** "$ 850.000", "Desde $ 850.000" o "$ 850.000 a $ 1.200.000". Sin precio: null (la tarjeta dice "Consultar"). */
export function precioTexto(pr: Precio | null): string | null {
  if (!pr) return null;
  if (pr.tipo_precio === "rango") return `${ars(pr.monto)} a ${ars(pr.monto_hasta ?? 0)}`;
  return (pr.tipo_precio === "desde" ? "Desde " : "") + ars(pr.monto);
}

export const mensajeDe = (p: Modelo): string => p.mensaje_whatsapp || mensajeWhatsapp(p);
