"use client";
// Piezas de la web pública: íconos, botones, foto, tarjeta de modelo, banner y calculadora de cuotas.
import { createContext, useContext, useState, type ReactNode } from "react";
import { media } from "@/lib/api";
import { num, parseArs } from "@/lib/formato";
import { etiquetas, lineaMedidas, mensajeDe, precioTexto, type Modelo } from "@/lib/web";

/* ---------- íconos y logo ---------- */

// El logo usa --logo-line (cambia con el tema) y tiene un brillo que lo cruza cada 7 s.
const SPRITE = `<linearGradient id="lu-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2D58A"/><stop offset=".45" stop-color="#D6A548"/><stop offset="1" stop-color="#A9782C"/></linearGradient>
<linearGradient id="lu-bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C6B5D"/><stop offset="1" stop-color="#4A3E35"/></linearGradient>
<linearGradient id="lu-sheen" gradientUnits="userSpaceOnUse" x1="-120" y1="0" x2="0" y2="0" gradientTransform="rotate(18)"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#FFF6D8" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/><animateTransform attributeName="gradientTransform" type="translate" values="-60 0;-60 0;360 0;360 0" keyTimes="0;.55;.8;1" dur="7s" repeatCount="indefinite" additive="sum"/></linearGradient>
<symbol id="mark" viewBox="0 0 320 460"><g transform="translate(-14 -24)"><path d="M100 66 L157 98 L157 334 L208 360 L262 333 L262 100 L318 64 L318 354 L208 412 L100 372 Z" fill="url(#lu-bronze)" style="stroke:var(--logo-line)" stroke-width="7"/><path d="M38 38 L80 56 L80 370 L194 424 L194 472 L38 396 Z" fill="url(#lu-gold)" style="stroke:var(--logo-line)" stroke-width="7"/><path class="lu-sheen" d="M41.5 43 L76.5 58 L76.5 372 L190.5 426 L190.5 467 L41.5 394 Z" fill="url(#lu-sheen)"/><g style="stroke:var(--logo-line)" stroke-width="2.2" fill="none"><path d="M49 44 L49 418"/><path d="M20 360 L194 444"/></g></g></symbol>
<symbol id="i-chat" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M9 10.5h6M9 13.5h4"/></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m5 12.5 4.2 4.2L19 7"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></symbol>
<symbol id="i-photos" viewBox="0 0 24 24"><rect x="3" y="6" width="14" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
<symbol id="i-saw" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 15 15 3l6 6L9 21H3v-6Z"/><path stroke="currentColor" stroke-width="1.8" d="m7 11 2 2m1-5 2 2m1-5 2 2"/></symbol>
<symbol id="i-truck" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M2 6h12v10H2zM14 9h4l3 3v4h-7z"/><circle cx="6" cy="17.5" r="1.8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17.5" r="1.8" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
<symbol id="i-card" viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path stroke="currentColor" stroke-width="1.8" d="M2.5 10h19M6 15h4"/></symbol>
<symbol id="i-ruler" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="m3 17 14-14 4 4L7 21z"/><path stroke="currentColor" stroke-width="1.8" d="m7 13 2 2m1-5 2 2m1-5 2 2"/></symbol>
<symbol id="i-wa" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/><path fill="currentColor" d="M9.2 7.6c.3 0 .5 0 .7.5l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.5.9 1.3 1.7 2.3 2.2.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.7c.3.1.4.3.3.6-.1.8-.8 1.6-1.7 1.6-2.9-.2-6-3.2-6.1-6.1 0-.9.6-1.8 1.1-1.9Z"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="i-back" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 12H5m6-6-6 6 6 6"/></symbol>`;

export const Sprite = () => (
  <svg width="0" height="0" className="absolute" aria-hidden="true">
    <defs dangerouslySetInnerHTML={{ __html: SPRITE }} />
  </svg>
);

export type NombreIcono = "chat" | "arrow" | "search" | "menu" | "x" | "check" | "plus" | "photos" | "saw" | "truck" | "card" | "ruler" | "wa" | "info" | "back";
export const I = ({ n, className }: { n: NombreIcono; className?: string }) => (
  <svg className={className} aria-hidden="true"><use href={`#i-${n}`} /></svg>
);
export const Marca = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 320 460" className={className} aria-hidden="true"><use href="#mark" /></svg>
);
/** Logo tenue detrás de cada foto: se ve mientras carga o si falta. */
export const MarcaFondo = () => (
  <div className="absolute inset-0 grid place-items-center opacity-20"><Marca className="w-[34%] h-auto" /></div>
);

/** Foto del catálogo (ruta relativa a la web). Si no carga, queda el logo de fondo. */
export function Foto({ src, alt, ya, className }: { src: string; alt: string; ya?: boolean; className?: string }) {
  return (
    <img src={media(src)} alt={alt} loading={ya ? undefined : "lazy"} decoding="async" className={className}
      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
  );
}

/* ---------- clases que se repiten ---------- */

const BOTON = "inline-flex items-center justify-center gap-[9px] rounded-full font-semibold whitespace-nowrap no-underline cursor-pointer transition-[transform,border-color] duration-200 active:[transform:scale(.98)] [&_svg]:size-[18px] [&_svg]:flex-none";
const CLARO = "border border-line bg-surface text-ink hover:border-gold";
// Dorado, con un reflejo que lo cruza cada 7 s
const ORO = "relative overflow-hidden text-on-gold bg-[linear-gradient(135deg,var(--gold-hi),var(--gold)_55%,var(--gold-deep))] after:absolute after:inset-0 after:bg-[linear-gradient(105deg,transparent_35%,rgba(255,250,232,.6)_50%,transparent_65%)] after:[transform:translateX(-120%)] after:animate-sweep";
export const BTN = `${BOTON} ${CLARO} min-h-12 px-[22px] text-[15px]`;
export const BTN_SM = `${BOTON} ${CLARO} min-h-10 px-4 text-[14px]`;
export const BTN_ORO = `${BOTON} ${ORO} min-h-12 px-[22px] text-[15px]`;
export const BTN_ORO_SM = `${BOTON} ${ORO} min-h-10 px-4 text-[14px]`;
export const BTN_ORO_CTA = `${BOTON} ${ORO} w-full min-h-[52px] px-[22px] text-[16px]`;
export const BTN_FOTO_SM = `${BOTON} min-h-10 px-4 text-[14px] border border-[color-mix(in_srgb,var(--on-photo)_60%,transparent)] bg-transparent text-on-photo hover:border-gold`;
const ICONO = "size-11 grid place-items-center rounded-full border-0 cursor-pointer text-ink no-underline flex-none hover:bg-surface-2 [&_svg]:size-[22px]";
export const BTN_ICONO = `${ICONO} bg-transparent`;
export const BTN_CERRAR = `${ICONO} bg-surface shadow-suave`;
export const LINK = "text-gold-ink font-semibold no-underline text-[14.5px] inline-flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer whitespace-nowrap flex-none hover:underline";
export const EYEBROW = "text-[11.5px] tracking-[.2em] uppercase font-bold text-gold-ink";
export const EYEBROW_CLARO = "text-[11.5px] tracking-[.2em] uppercase font-bold text-gold-hi";
export const MEDIA = "relative overflow-hidden bg-surface-2 max-w-full"; // + aspect-[…] y rounded-[…] en cada uso
export const CONTADOR = "absolute z-2 text-[11.5px] font-bold py-1 px-2 rounded-full bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] text-ink flex items-center gap-1 tabular-nums [&_svg]:size-3";
// Fila que se desliza de costado. Dentro de la columna principal, en la compu va sin el margen extra.
export const FILA = "flex gap-3 overflow-x-auto snap-x snap-mandatory pt-0.5 pb-2.5 px-(--gutter) mx-[calc(var(--gutter)*-1)] scroll-px-(--gutter) sin-barra";
export const FILA_PRINCIPAL = `${FILA} lg:mx-0 lg:px-0 lg:scroll-px-0`;
export const LISTA = "grid grid-cols-[minmax(0,1fr)] gap-3 [&>*]:min-w-0";
// Lista con tildes doradas
export const TICKS = "grid gap-2 text-[15px] [&_li]:flex [&_li]:gap-2.5 [&_li]:items-start [&_svg]:size-[17px] [&_svg]:text-gold [&_svg]:flex-none [&_svg]:mt-[3px]";
export const FLECHA = <svg width="14" height="14" aria-hidden="true"><use href="#i-arrow" /></svg>;

/* ---------- acciones de la página (navegar, abrir un modelo, armar el WhatsApp) ---------- */

export type Acciones = {
  wa: (texto: string) => string;
  abrir: (p: Modelo) => void;
  irAmbiente: (slug: string, tipo?: string) => void;
  irInicio: (ancla?: string) => void;
};
export const AccionesCtx = createContext<Acciones | null>(null);
export const useAcciones = (): Acciones => useContext(AccionesCtx)!;

/* ---------- fotos que se deslizan, con puntitos ---------- */

export function Diapositivas({ fotos, alt, ya }: { fotos: string[]; alt: (j: number) => string; ya?: boolean }) {
  const [k, setK] = useState(0);
  return (
    <>
      <div className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory sin-barra"
        onScroll={(e) => setK(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {fotos.map((f, j) => <Foto key={j} src={f} alt={alt(j)} ya={ya && j === 0} className="flex-[0_0_100%] w-full h-full object-cover snap-start" />)}
      </div>
      {fotos.length > 1 && (
        <div className="absolute inset-x-0 bottom-[9px] flex justify-center gap-[5px] pointer-events-none">
          {fotos.map((_, j) => (
            <i key={j} className={`h-[5px] transition-[width] duration-[.25s] ${j === k ? "w-3.5 rounded-[3px] bg-on-photo" : "w-[5px] rounded-full bg-[color-mix(in_srgb,var(--on-photo)_55%,transparent)]"}`} />
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- tarjeta de modelo ---------- */

/** Dónde va la tarjeta: cambia su forma.
    inicio: filas de la home (en el celular, lista de hasta 4). carrusel / relacionado: filas del listado y del detalle.
    lista: el listado (horizontal en el celular). chicos: "¿Poco espacio?" (horizontal en el celular y en la compu). */
export type ModoTarjeta = "inicio" | "carrusel" | "relacionado" | "lista" | "chicos";
const CAJA: Record<ModoTarjeta, string> = {
  inicio: "flex flex-col gap-2.5 shrink-0 snap-start basis-[66%] max-w-[260px] sm:basis-[240px] lg:basis-[calc((100%-48px)/5)] lg:max-w-none max-sm:grid max-sm:grid-cols-[46%_minmax(0,1fr)] max-sm:gap-3 max-sm:items-stretch max-sm:max-w-none max-sm:nth-[n+5]:hidden",
  carrusel: "flex flex-col gap-2.5 shrink-0 snap-start basis-[56%] max-w-[260px] sm:basis-[220px] lg:basis-[calc((100%-48px)/5)] lg:max-w-none",
  relacionado: "flex flex-col gap-2.5 shrink-0 snap-start basis-[46%] max-w-[220px] lg:basis-[calc((100%-48px)/5)]",
  lista: "grid grid-cols-[46%_minmax(0,1fr)] gap-3 items-stretch sm:flex sm:flex-col",
  chicos: "grid grid-cols-[46%_minmax(0,1fr)] gap-3 items-stretch sm:flex sm:flex-col lg:grid lg:grid-cols-[42%_minmax(0,1fr)] lg:items-start",
};
const FOTO: Record<ModoTarjeta, string> = {
  inicio: "aspect-[4/5] max-sm:aspect-auto max-sm:h-full max-sm:min-h-[210px]",
  carrusel: "aspect-[4/5]",
  relacionado: "aspect-[4/5]",
  lista: "aspect-auto h-full min-h-[210px] sm:aspect-[4/5] sm:h-auto sm:min-h-0",
  chicos: "aspect-auto h-full min-h-[210px] sm:aspect-[4/5] sm:h-auto sm:min-h-0 lg:aspect-[3/4]",
};

export function Tarjeta({ p, modo }: { p: Modelo; modo: ModoTarjeta }) {
  const { wa, abrir } = useAcciones();
  const chips = etiquetas(p), precio = precioTexto(p.precio);
  const enFila = modo === "carrusel" || modo === "relacionado"; // en las filas va más compacta: sin frase ni etiquetas
  return (
    <article tabIndex={0} aria-label={p.nombre}
      className={`relative min-w-0 cursor-pointer bg-surface border border-line rounded-lg p-2.5 transition-[box-shadow,border-color] duration-[.25s] hover:shadow-suave hover:border-[color-mix(in_srgb,var(--gold)_45%,var(--line))] ${CAJA[modo]}`}
      onClick={(e) => { if (!(e.target as Element).closest("a")) abrir(p); }}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); abrir(p); } }}>
      <div className={`${MEDIA} rounded-2xl ${FOTO[modo]}`}>
        <MarcaFondo />
        <span className="absolute top-[9px] left-[9px] z-2 text-[11px] font-bold tracking-[.03em] py-1 px-[9px] rounded-full bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] text-ink max-w-[calc(100%-60px)] whitespace-nowrap overflow-hidden text-ellipsis">{p.variante || p.tipo}</span>
        {p.fotos.length > 1 && <span className={`${CONTADOR} top-[9px] right-[9px]`} aria-label={`${p.fotos.length} fotos`}><I n="photos" />{p.fotos.length}</span>}
        <Diapositivas fotos={p.fotos.slice(0, 6)} alt={(j) => `${p.nombre}, foto ${j + 1}`} />
      </div>
      <div className="flex flex-col gap-[5px] min-w-0 pt-0.5 px-1 pb-1 flex-1 max-lg:justify-center">
        <h3 className={`leading-[1.2] ${enFila ? "text-[16.5px]" : modo === "inicio" ? "text-[16.5px] max-sm:text-[18px]" : "text-[18px]"}`}>{p.nombre}</h3>
        <p className={`text-[13.5px] text-muted leading-[1.35] ${enFila ? "hidden" : modo === "inicio" ? "hidden max-sm:block" : ""}`}>{p.descripcion_corta}</p>
        <p className="text-[13px] tabular-nums text-ink">{lineaMedidas(p)}</p>
        {chips.length > 0 && (
          <div className={`flex-wrap gap-[5px] mt-0.5 ${enFila ? "hidden" : modo === "inicio" ? "hidden max-sm:flex" : "flex"}`}>
            {chips.slice(0, 2).map((c) => <span key={c} className="text-[12px] py-[3px] px-[9px] rounded-full bg-surface-2 whitespace-nowrap max-w-full overflow-hidden text-ellipsis">{c}</span>)}
          </div>
        )}
        {precio && <p className="font-bold text-[15px] mt-auto pt-1">{precio}</p>}
        <a className={`${BTN_ORO_SM} w-full mt-1.5`} target="_blank" rel="noopener" href={wa(mensajeDe(p))}>Consultar</a>
      </div>
    </article>
  );
}

/* ---------- banner con fotos en movimiento ---------- */

export function Banner({ titulo, sub, cta, ancla, texto, fotos }: { titulo: string; sub?: string; cta: string; ancla?: string; texto?: string; fotos: string[] }) {
  const { wa, irInicio } = useAcciones();
  return (
    <div className="col-span-full relative rounded-lg overflow-hidden bg-night aspect-[16/10] min-h-[220px] max-h-[440px] w-full text-on-photo lg:aspect-[21/7] after:absolute after:inset-0 after:bg-[linear-gradient(90deg,rgba(10,8,6,.62),rgba(10,8,6,.1)_70%)]">
      <div className="absolute inset-0" aria-hidden="true">
        {fotos.map((f, j) => <Foto key={j} src={f} alt="" ya={j === 0} className="absolute inset-0 w-full h-full object-cover opacity-0 animate-kb nth-2:[animation-delay:6s] nth-3:[animation-delay:12s] motion-reduce:first:opacity-100" />)}
      </div>
      <div className="absolute left-5 bottom-5 right-5 z-2 grid gap-3 justify-items-start lg:left-11 lg:bottom-10">
        <h3 className="text-[clamp(24px,6vw,40px)] leading-[1.1] max-w-[18ch]">{titulo}</h3>
        {sub && <p className="opacity-90 max-w-[42ch]">{sub}</p>}
        {texto
          ? <a className={BTN_FOTO_SM} target="_blank" rel="noopener" href={wa(texto)}>{cta}</a>
          : <button className={BTN_FOTO_SM} onClick={() => irInicio(ancla)}>{cta}</button>}
      </div>
    </div>
  );
}

/* ---------- calculadora de cuotas con tarjeta ---------- */

const RECARGOS = [[3, .174], [6, .246], [9, .348], [12, .447]] as const;

export function Calculadora({ id, compacta }: { id: string; compacta?: boolean }) {
  const [monto, setMonto] = useState("200.000");
  const v = parseArs(monto);
  return (
    <div className="grid gap-2.5">
      {!compacta && <><span className={EYEBROW}>Tarjetas · Visa, Mastercard y Naranja</span><h3 className="text-[24px]">Calculá tus cuotas</h3></>}
      <label htmlFor={id} className="text-[12px] tracking-[.14em] uppercase text-muted font-bold">
        {compacta ? "Si ya tenés tu presupuesto, calculá las cuotas con tarjeta" : "Monto de tu presupuesto"}
      </label>
      <div className="flex items-center h-[52px] border-[1.5px] border-line rounded-md px-3.5 bg-bg gap-1.5 focus-within:border-gold">
        <span className="font-display text-[22px] text-muted">$</span>
        <input id={id} inputMode="numeric" value={monto} aria-label="Monto en pesos"
          className="border-0 outline-none bg-transparent font-display text-[24px] w-full min-w-0 tabular-nums"
          onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 10); setMonto(d ? num(+d) : ""); }} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {RECARGOS.map(([n, r]) => (
          <div key={n} className="border border-line rounded-md p-3 grid gap-0.5 tabular-nums bg-surface">
            <small className="text-[12px] text-muted">{n} cuotas de</small>
            <b className="font-display font-normal text-[19px]">$ {num(v * (1 + r) / n)}</b>
            <em className="not-italic text-[12px] text-gold-ink font-bold">Total $ {num(v * (1 + r))}</em>
          </div>
        ))}
      </div>
      <p className="text-[13px] text-muted">Recargos con tarjeta: 3 cuotas +17,4% · 6 cuotas +24,6% · 9 cuotas +34,8% · 12 cuotas +44,7%.</p>
      <p className="flex gap-2 items-start text-[13.5px] text-ink bg-surface-2 rounded-xl py-2.5 px-3" role="note">
        <I n="info" className="size-[17px] flex-none text-gold-ink mt-px" />Los precios son únicos por proyecto. Esto es solo una calculadora de ejemplo.
      </p>
    </div>
  );
}

/** Encabezado de bloque: título, bajada y un link a la derecha. */
export function Cabeza({ titulo, bajada, children }: { titulo: string; bajada?: string; children?: ReactNode }) {
  return (
    <div className="flex justify-between items-end gap-3 mb-3.5">
      <div><h2 className="text-[clamp(25px,6vw,38px)] leading-[1.1]">{titulo}</h2>{bajada && <p className="text-muted text-[14.5px] mt-1">{bajada}</p>}</div>
      {children}
    </div>
  );
}
