"use client";
// Lo que se abre al tocar un modelo o un trabajo: galería con video y foto ampliada, medidas dibujadas, preguntas y WhatsApp.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { media } from "@/lib/api";
import type { TrabajoWeb } from "@/lib/tipos";
import { etiquetas, mensajeDe, precioTexto, tieneMedidas, tituloTrabajo, type Catalogo, type Modelo } from "@/lib/web";
import { BTN_CERRAR, BTN_ORO_CTA, CONTADOR, Calculadora, Diapositivas, EYEBROW, FILA, Foto, I, MEDIA, MarcaFondo, TICKS, Tarjeta, useAcciones } from "./ui";

const PRINCIPAL = "grid gap-5 pt-3 px-(--gutter) [&>*]:min-w-0 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-7 lg:px-8 lg:items-start";
// En notebooks bajas la galería se achica para que sus miniaturas entren en pantalla
const GALERIA = "lg:sticky lg:top-5 lg:w-[min(100%,calc((90vh-150px)*.8))] lg:justify-self-center";
const TITULO = "text-[clamp(28px,7vw,42px)] leading-[1.08] mt-2";
// En el celular el botón de WhatsApp queda fijo abajo; en la compu va en su lugar
const CTA = "fixed inset-x-0 bottom-0 z-4 pt-3 px-(--gutter) pb-[calc(12px+env(safe-area-inset-bottom,0px))] bg-[color-mix(in_srgb,var(--bg)_94%,transparent)] backdrop-blur-[12px] border-t border-line lg:static lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:p-0";
const NAV = "absolute top-1/2 -mt-[22px] z-3 size-11 grid place-items-center rounded-full border-0 cursor-pointer text-ink bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] shadow-suave hover:bg-surface [&_svg]:size-5";

const comportamiento = (): ScrollBehavior => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/* ---------- galería: fotos y video, flechas, miniaturas y foto ampliada ---------- */

type Pieza = { foto: string; alt: string } | { video: string };

function Galeria({ fotos, nombre, video }: { fotos: string[]; nombre: string; video: string | null }) {
  const piezas: Pieza[] = fotos.map((f, j) => ({ foto: f, alt: `${nombre}, foto ${j + 1}` }));
  if (video) piezas.splice(Math.min(1, piezas.length), 0, { video }); // el video va segundo: se ve en las miniaturas sin tapar la foto principal
  const n = piezas.length;
  const soloFotos = piezas.flatMap((x, j) => ("foto" in x ? [j] : []));
  const [i, setI] = useState(0);
  const pista = useRef<HTMLDivElement>(null), minis = useRef<HTMLDivElement>(null), lb = useRef<HTMLDialogElement>(null), vid = useRef<HTMLVideoElement>(null);
  const espera = useRef(0);
  const actual = piezas[i] as Pieza | undefined;

  // La miniatura activa queda centrada, y el video se pausa al pasar a otra foto
  useEffect(() => {
    const th = minis.current?.children[i];
    if (th) {
      const r = minis.current!.getBoundingClientRect(), b = th.getBoundingClientRect();
      minis.current!.scrollBy({ left: b.left - r.left - (r.width - b.width) / 2, behavior: comportamiento() });
    }
    if (actual && !("video" in actual)) vid.current?.pause();
  }, [i]);

  function ir(k: number) {
    if (n < 2) return;
    k = (k + n) % n;
    if (k === i) return;
    setI(k);
    pista.current!.scrollTo({ left: k * pista.current!.clientWidth, behavior: comportamiento() });
  }
  function pasoAmpliada(d: number) {
    let k = i;
    do k = (k + d + n) % n; while (!("foto" in piezas[k]));
    ir(k);
  }

  // Flechas del teclado: mueven la galería, o la foto ampliada si está abierta (en el video adelantan el video)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as Element).closest?.("input, textarea, select, video")) return;
      e.preventDefault();
      const d = e.key === "ArrowRight" ? 1 : -1;
      if (lb.current?.open) pasoAmpliada(d); else ir(i + d);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  });
  useEffect(() => () => clearTimeout(espera.current), []);

  return (
    <>
      <div className={`${MEDIA} aspect-[4/5] rounded-[20px]`}>
        <MarcaFondo />
        {/* Deslizar = scroll con imán; la foto activa se decide cuando el scroll se detiene */}
        <div ref={pista} className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory sin-barra"
          onScroll={(e) => {
            const el = e.currentTarget;
            clearTimeout(espera.current);
            espera.current = window.setTimeout(() => setI(Math.round(el.scrollLeft / el.clientWidth)), 90);
          }}>
          {piezas.map((x, j) => "video" in x ? (
            <div key="video" className="flex-[0_0_100%] relative h-full snap-start" role="group" aria-label={`Video de ${nombre}`}>
              <video ref={vid} src={media(x.video)} controls playsInline preload="metadata" className="w-full h-full object-contain bg-night" />
            </div>
          ) : (
            <button key={j} tabIndex={j === i ? 0 : -1} aria-label={`Ampliar: ${x.alt}`} onClick={() => { setI(j); lb.current!.showModal(); }}
              className="flex-[0_0_100%] relative h-full snap-start m-0 p-0 border-0 bg-transparent cursor-zoom-in focus-visible:outline-offset-[-4px]">
              <Foto src={x.foto} alt={x.alt} ya={j === 0} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        {n > 1 && (
          <>
            <span className={`${CONTADOR} top-[9px] left-[9px]`} aria-hidden="true">{i + 1} / {n}</span>
            <button className={`${NAV} left-2.5`} aria-label="Anterior" onClick={() => ir(i - 1)}><I n="back" /></button>
            <button className={`${NAV} right-2.5`} aria-label="Siguiente" onClick={() => ir(i + 1)}><I n="arrow" /></button>
          </>
        )}
      </div>
      {n > 1 && (
        <div ref={minis} className="flex gap-2 overflow-x-auto mt-2.5 sin-barra">
          {piezas.map((x, j) => (
            <button key={j} aria-current={j === i} aria-label={"video" in x ? "Ver el video" : `Ver ${x.alt}`} onClick={() => ir(j)}
              className="relative flex-[0_0_58px] h-[72px] rounded-[10px] overflow-hidden border-2 border-transparent p-0 bg-surface-2 cursor-pointer aria-[current=true]:border-gold">
              {"video" in x ? (
                <>
                  <video src={`${media(x.video)}#t=0.1`} preload="metadata" muted playsInline className="w-full h-full object-cover pointer-events-none" />
                  <span className="absolute left-1 bottom-1 py-px px-1.5 rounded-full text-[10.5px] font-bold tracking-[.04em] text-on-gold bg-[linear-gradient(135deg,var(--gold-hi),var(--gold))]">Video</span>
                </>
              ) : <Foto src={x.foto} alt="" className="w-full h-full object-cover" />}
            </button>
          ))}
        </div>
      )}
      {/* Foto ampliada: ocupa toda la pantalla y la foto entra entera. Escape la cierra (lo hace el navegador). */}
      <dialog ref={lb} aria-label="Foto ampliada" onClick={(e) => { if (e.target === e.currentTarget) lb.current!.close(); }}
        className="w-full h-full max-w-none max-h-none m-0 p-0 border-0 text-ink bg-night overflow-hidden backdrop:bg-scrim">
        {actual && "foto" in actual && (
          <img src={media(actual.foto)} alt={actual.alt} className="absolute inset-0 w-full h-full max-w-none object-contain py-16 px-3" />
        )}
        <button className={`${BTN_CERRAR} absolute top-[calc(12px+env(safe-area-inset-top,0px))] right-3 z-5`} aria-label="Cerrar" onClick={() => lb.current!.close()}><I n="x" /></button>
        {soloFotos.length > 1 && (
          <>
            <button className={`${NAV} left-2.5`} aria-label="Foto anterior" onClick={() => pasoAmpliada(-1)}><I n="back" /></button>
            <button className={`${NAV} right-2.5`} aria-label="Foto siguiente" onClick={() => pasoAmpliada(1)}><I n="arrow" /></button>
            <span className={`${CONTADOR} left-1/2 bottom-[calc(18px+env(safe-area-inset-bottom,0px))] -translate-x-1/2`} aria-live="polite">
              {soloFotos.indexOf(i) + 1} / {soloFotos.length}
            </span>
          </>
        )}
      </dialog>
    </>
  );
}

/* ---------- medidas dibujadas ---------- */

const TX = "font-body text-[11px] fill-muted";
const TXV = "font-body text-[12px] fill-ink font-bold"; // los valores
const CUERPO = "fill-surface-2 stroke-bronze [stroke-width:1.3]";
const TAPA = "fill-surface stroke-bronze [stroke-width:1.3]";
const COSTADO = "fill-[color-mix(in_srgb,var(--bronze)_22%,var(--surface-2))] stroke-bronze [stroke-width:1.3]";
const COTA = "stroke-gold [stroke-width:1.4]";
const SVG = "w-full h-auto max-h-[240px]";

/** Redondo (con diámetro), visto desde arriba (sin alto) o en perspectiva. */
function Dibujo({ p }: { p: Modelo }) {
  const { ancho_cm: F, alto_cm: A, profundidad_cm: Pr, diametro_cm: Di } = p;
  if (Di) {
    const h = A || Di, s = 150 / Math.max(Di, h), w = Di * s, hh = h * s, ry = w * .18, x = 60, y = 30 + ry;
    return (
      <svg className={SVG} viewBox={`0 0 ${w + 120} ${hh + ry * 2 + 60}`} role="img" aria-label={`Diámetro ${Di} cm${A ? `, alto ${A} cm` : ""}`}>
        <ellipse cx={x + w / 2} cy={y + hh} rx={w / 2} ry={ry} className={CUERPO} />
        <rect x={x} y={y} width={w} height={hh} className="fill-surface-2 stroke-none" />
        <line x1={x} y1={y} x2={x} y2={y + hh} className="stroke-bronze [stroke-width:1.4]" />
        <line x1={x + w} y1={y} x2={x + w} y2={y + hh} className="stroke-bronze [stroke-width:1.4]" />
        <ellipse cx={x + w / 2} cy={y} rx={w / 2} ry={ry} className={TAPA} />
        <line x1={x} y1={y} x2={x + w} y2={y} className="stroke-gold [stroke-width:1.6] [stroke-dasharray:4_3]" />
        <text className={TXV} x={x + w / 2} y={y - ry - 8} textAnchor="middle">Ø {Di} cm</text>
        {A ? (
          <>
            <line x1={x - 18} y1={y} x2={x - 18} y2={y + hh} className={COTA} />
            <text className={TXV} x={x - 24} y={y + hh / 2} textAnchor="end" dominantBaseline="middle">{A}</text>
          </>
        ) : null}
      </svg>
    );
  }
  if (!A && F && Pr) {
    const s = 170 / Math.max(F, Pr), W = F * s, Dp = Pr * s, ox = 30, oy = 34;
    return (
      <svg className={SVG} viewBox={`0 0 ${W + 110} ${Dp + 80}`} role="img" aria-label={`Vista desde arriba: ancho ${F} cm, profundidad ${Pr} cm`}>
        <text className={TX} x={ox} y={18}>Vista desde arriba</text>
        <rect x={ox} y={oy} width={W} height={Dp} rx={2} className={CUERPO} />
        <line x1={ox} y1={oy + Dp + 16} x2={ox + W} y2={oy + Dp + 16} className={COTA} />
        <text className={TXV} x={ox + W / 2} y={oy + Dp + 36} textAnchor="middle">{F} cm</text>
        <line x1={ox + W + 16} y1={oy} x2={ox + W + 16} y2={oy + Dp} className={COTA} />
        <text className={TXV} x={ox + W + 26} y={oy + Dp / 2} dominantBaseline="middle">{Pr} cm</text>
      </svg>
    );
  }
  const f = F || 0, a = A || 0, pr = Pr || 0, M = Math.max(f, a, pr * .6) || 1, s = 170 / M;
  const W = f * s, H = a * s, D = pr * s * .45, ox = 54, oy = 26 + D * .7;
  const tapa = `${ox},${oy} ${ox + D},${oy - D * .7} ${ox + W + D},${oy - D * .7} ${ox + W},${oy}`;
  const costado = `${ox + W},${oy} ${ox + W + D},${oy - D * .7} ${ox + W + D},${oy + H - D * .7} ${ox + W},${oy + H}`;
  return (
    <svg className={SVG} viewBox={`0 0 ${W + D + 110} ${H + oy + 44}`} role="img" aria-label={`Medidas: ancho ${f} cm, alto ${a} cm${pr ? `, profundidad ${pr} cm` : ""}`}>
      {pr ? <><polygon points={tapa} className={TAPA} /><polygon points={costado} className={COSTADO} /></> : null}
      <rect x={ox} y={oy} width={W} height={H} className={CUERPO} />
      {f ? <><line x1={ox} y1={oy + H + 16} x2={ox + W} y2={oy + H + 16} className={COTA} /><text className={TXV} x={ox + W / 2} y={oy + H + 34} textAnchor="middle">{f} cm</text></> : null}
      {a ? <><line x1={ox - 16} y1={oy} x2={ox - 16} y2={oy + H} className={COTA} /><text className={TXV} x={ox - 24} y={oy + H / 2} textAnchor="end" dominantBaseline="middle">{a}</text></> : null}
      {pr ? <><line x1={ox + W + 8} y1={oy + H + 4} x2={ox + W + D + 8} y2={oy + H - D * .7 + 4} className={COTA} /><text className={TXV} x={ox + W + D + 14} y={oy + H - D * .7 + 10}>{pr} cm</text></> : null}
    </svg>
  );
}

/* ---------- detalle de un modelo ---------- */

function Pregunta({ titulo, abierta, children }: { titulo: string; abierta?: boolean; children: ReactNode }) {
  return (
    <details open={abierta} className="group border-b border-line">
      <summary className="list-none cursor-pointer flex justify-between items-center py-4 font-bold text-[15.5px] [&::-webkit-details-marker]:hidden">
        {titulo}<I n="plus" className="size-4 transition-transform duration-[.25s] group-open:rotate-45" />
      </summary>
      <div className="pb-[18px] text-muted text-[15px] grid gap-3">{children}</div>
    </details>
  );
}

export function DetalleModelo({ p, cat }: { p: Modelo; cat: Catalogo }) {
  const { wa } = useAcciones();
  const r = cat.R[p.ambiente], chips = etiquetas(p), precio = precioTexto(p.precio);
  const relacionados = cat.P.filter((x) => x.ambiente === p.ambiente && x.id !== p.id && x.fotos.length)
    .sort((a, b) => +(b.tipo === p.tipo) - +(a.tipo === p.tipo) || b.fotos.length - a.fotos.length).slice(0, 10);
  const valores = (!tieneMedidas(p) ? [] : p.diametro_cm ? [["Alto", p.alto_cm], ["Diámetro", p.diametro_cm]] : [["Ancho", p.ancho_cm], ["Alto", p.alto_cm], ["Profundidad", p.profundidad_cm]])
    .filter((x) => x[1] != null) as [string, number][];
  return (
    <>
      <div className={PRINCIPAL}>
        <div className={GALERIA}>
          <Galeria fotos={p.fotos} nombre={p.nombre} video={p.url_video} />
          {!p.fotos.length && <p className="text-[13px] text-muted mt-2.5">Todavía no subimos fotos de este modelo. Pedilas por WhatsApp y te las mandamos.</p>}
        </div>
        <div className="grid gap-4">
          <div>
            <span className={EYEBROW}>{r.nombre} · {p.tipo}</span>
            <h2 id="dName" className={TITULO}>{p.nombre}</h2>
            <p className="text-[16px] text-muted mt-1.5">{p.descripcion_corta}</p>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
            {precio && <b className="text-[16px] text-gold-ink">{precio}</b>}
            <span className="text-[14px] text-muted">Hecho en nuestro taller de Tucumán{p.codigo ? ` · Código ${p.codigo}` : ""}</span>
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => <span key={c} className="text-[13.5px] py-1.5 px-3 rounded-full bg-surface border border-line">{c}</span>)}
            </div>
          )}
          <div className="bg-surface border border-line rounded-lg p-4 grid gap-3">
            <span className={EYEBROW}>Medidas</span>
            {tieneMedidas(p) ? <Dibujo p={p} /> : <p>{p.texto_medidas}</p>}
            {valores.length > 0 && (
              <div className="grid gap-px bg-line rounded-xl overflow-hidden" style={{ gridTemplateColumns: `repeat(${valores.length},1fr)` }}>
                {valores.map(([l, v]) => (
                  <div key={l} className="bg-surface p-2.5 text-center">
                    <small className="block text-[11px] tracking-[.12em] uppercase text-muted font-semibold">{l}</small>
                    <b className="font-display font-normal text-[22px] tabular-nums">{v}</b>
                  </div>
                ))}
              </div>
            )}
            {p.detalle_medidas && p.caracteristicas.length > 0 && <p className="text-[13px] text-muted">{p.detalle_medidas}</p>}
            <p className="text-[13px] text-muted">Medidas en centímetros. ¿Necesitás otra? Lo hacemos a tu medida.</p>
          </div>
          <div className="border-t border-line">
            <Pregunta titulo="Qué trae" abierta>
              {p.caracteristicas.length > 0 && <ul className={TICKS}>{p.caracteristicas.map((x) => <li key={x}><I n="check" />{x}</li>)}</ul>}
              {p.nota && <p>{p.nota.replace(/^\w/, (m) => m.toUpperCase())}.</p>}
              {!p.caracteristicas.length && !p.nota && <p>Consultanos cuántos cajones, estantes y qué herrajes querés: lo armamos a tu gusto.</p>}
            </Pregunta>
            <Pregunta titulo="Materiales y colores">
              <p>Lo hacemos en melamina o MDF. Elegís el color y la combinación, y en el showroom de Lomas de Tafí podés ver las muestras.</p>
            </Pregunta>
            <Pregunta titulo="Envío e instalación">
              <p>Lo llevamos y lo instalamos en toda la provincia de Tucumán. Te confirmamos la fecha con el presupuesto.</p>
            </Pregunta>
            <Pregunta titulo="Formas de pago">
              <ul className={TICKS}>
                <li><I n="check" />Cuotas semanales propias, de 6 a 18 semanas, y te lo llevás con la primera cuota</li>
                <li><I n="check" />Tarjetas Visa, Mastercard y Naranja, de 3 a 12 cuotas</li>
              </ul>
              <Calculadora id="amountSheet" compacta />
            </Pregunta>
          </div>
          <div className={CTA}><a className={BTN_ORO_CTA} target="_blank" rel="noopener" href={wa(mensajeDe(p))}><I n="chat" />Consultar por WhatsApp</a></div>
        </div>
      </div>
      {relacionados.length > 0 && (
        <div className="pt-[30px] px-(--gutter) lg:pt-9 lg:px-8">
          <div className="flex justify-between items-end gap-3 mb-3.5">
            <div><span className={EYEBROW}>Para el mismo espacio</span><h2 className="text-[26px] leading-[1.1]">Más de {r.nombre.toLowerCase()}</h2></div>
          </div>
          <div className={`${FILA} lg:-mx-8 lg:px-8 lg:scroll-px-8`}>{relacionados.map((x) => <Tarjeta key={x.id} p={x} modo="relacionado" />)}</div>
        </div>
      )}
    </>
  );
}

/* ---------- detalle de un trabajo realizado ---------- */

export function DetalleTrabajo({ t }: { t: TrabajoWeb }) {
  const { wa } = useAcciones();
  const titulo = tituloTrabajo(t);
  return (
    <div className={PRINCIPAL}>
      <div className={GALERIA}>
        <div className={`${MEDIA} aspect-[4/5] rounded-[20px]`}>
          <MarcaFondo />
          <Diapositivas fotos={t.fotos} alt={(j) => `${titulo}, foto ${j + 1}`} ya />
        </div>
      </div>
      <div className="grid gap-4">
        <div><span className={EYEBROW}>Trabajo realizado</span><h2 id="dName" className={TITULO}>{titulo}</h2></div>
        <p className="text-muted max-w-[58ch]">Lo diseñamos y fabricamos para un cliente, con colores, herrajes y divisiones a elección. El presupuesto sale del diseño y las medidas de tu ambiente.</p>
        <div className={CTA}><a className={BTN_ORO_CTA} target="_blank" rel="noopener" href={wa(`Hola! Vi el trabajo ${t.titulo} en la web y quiero algo parecido.`)}><I n="chat" />Quiero algo así</a></div>
      </div>
    </div>
  );
}
