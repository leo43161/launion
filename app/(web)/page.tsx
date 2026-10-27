"use client";
// La web pública: inicio, listado (por ambiente, para casa o negocio, o búsqueda) y el detalle de cada modelo.
// El mismo diseño de muebleria/index.html, aprobado por el cliente, con Tailwind. Los datos salen de la API (ruta "web").
import { useEffect, useMemo, useRef, useState, type FormEvent, type Ref } from "react";
import { flushSync } from "react-dom";
import { DetalleModelo, DetalleTrabajo } from "@/components/web/Detalle";
import {
  AccionesCtx, BTN_CERRAR, BTN_ICONO, BTN_ORO, BTN_ORO_SM, BTN_SM, Banner, Cabeza, Calculadora, EYEBROW, EYEBROW_CLARO, FILA_PRINCIPAL,
  FLECHA, Foto, I, LINK, LISTA, MEDIA, Marca, MarcaFondo, Sprite, TICKS, Tarjeta, CONTADOR, type Acciones, type NombreIcono,
} from "@/components/web/ui";
import { api } from "@/lib/api";
import { norm, normTelefono, telefonoLindo } from "@/lib/formato";
import type { TrabajoWeb } from "@/lib/tipos";
import { FOTOS, GRUPOS_TRABAJO, PUBLICOS, TELEFONO, anchoDe, armarCatalogo, esLed, grupoDe, type Catalogo, type Modelo, type Publico } from "@/lib/web";

// Link de vendedor (…/pilar, …/juan): todos los WhatsApp de la página van a su número. Se lee apenas carga la página.
// Sin vendedor, o con uno que no existe: el número de la mueblería.
const VENDEDOR = typeof location === "undefined" ? "" : (location.pathname.split("/").filter(Boolean).pop() || "").toLowerCase();

const TEMAS = [["claro", "Claro"], ["gris", "Gris"], ["oscuro", "Oscuro"]] as const;
type Tema = (typeof TEMAS)[number][0];
type Medida = "all" | "s" | "m" | "l";
type Orden = "rec" | "wa" | "wd";
type Estado = { vista: "inicio" | "resultados"; publico: Publico | null; ambiente: string | null; tipo: string | null; medida: Medida; orden: Orden; q: string };
type Hoja = { modelo: Modelo } | { trabajo: TrabajoWeb } | null;

const MEDIDAS: [Medida, string][] = [["all", "Cualquier medida"], ["s", "Chico · hasta 80 cm"], ["m", "Mediano · 81 a 150 cm"], ["l", "Grande · más de 150 cm"]];
const BANNERS = [
  { titulo: "¿No encontrás la medida justa?", sub: "Mandanos las medidas de tu espacio y lo fabricamos para que entre perfecto.", cta: "Consultar por WhatsApp",
    texto: "Hola! Necesito un mueble a medida. Les paso las medidas de mi espacio.", fotos: [FOTOS.fabrica, FOTOS.cocina, FOTOS.placard15] },
  { titulo: "Llevalo con la primera cuota", sub: "Cuotas semanales de 6 a 18 semanas, con pocos requisitos.", cta: "Ver cuotas", ancla: "#financiacion",
    fotos: [FOTOS.showroom, FOTOS.placard13, FOTOS.placard14] },
];

const WRAP = "max-w-[1280px] mx-auto px-(--gutter)";
const WRAP_P = `${WRAP} lg:max-w-none lg:px-0`; // dentro de la columna principal: en la compu el margen lo pone la columna
const SECCION = "pt-10";
const CUADROS = "grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4";
const SEG = "inline-flex p-1 rounded-full bg-surface-2 gap-0.5 flex-wrap";
const SEG_BTN = "border-0 bg-transparent py-[9px] px-4 rounded-full cursor-pointer font-semibold text-[14px] text-muted aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-suave";
const CHIPS = "relative flex gap-2 overflow-x-auto sin-barra pb-0.5";
const CHIP = "flex-none border border-line bg-surface rounded-full py-2 pl-[15px] text-[14px] font-semibold cursor-pointer whitespace-nowrap";
const CHIP_BTN = `${CHIP} pr-[15px] aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg`;
const H4 = "font-body text-[11.5px] tracking-[.18em] uppercase text-muted font-bold mb-2";
const CBOX = "bg-surface border border-line rounded-md p-[18px] grid gap-1 min-w-0";
const CBOX_EYEBROW = "text-[15px] tracking-[.2em] uppercase font-bold text-muted"; // en estas cajas el texto chico va gris y a 15 px, como en la web aprobada
const CBOX_B = "font-display font-normal text-[20px]";
const CBOX_TXT = "text-muted text-[15px]";
// Mobile: lista de hasta 4 tarjetas horizontales; desde tablet, fila que se desliza
const LISTA_INICIO = "max-sm:grid max-sm:grid-cols-[minmax(0,1fr)] max-sm:gap-3 max-sm:overflow-visible max-sm:mx-0 max-sm:p-0 max-sm:snap-none";

/* ---------- filtros y listado ---------- */

const medidaOk = (p: Modelo, m: Medida): boolean => {
  if (m === "all") return true;
  const w = anchoDe(p);
  if (w == null) return false;
  return m === "s" ? w <= 80 : m === "m" ? w > 80 && w <= 150 : w > 150;
};
function ordenar(l: Modelo[], o: Orden): Modelo[] {
  if (o === "rec") l.sort((a, b) => +(b.fotos.length > 0) - +(a.fotos.length > 0) || b.fotos.length - a.fotos.length || a.i - b.i);
  if (o === "wa") l.sort((a, b) => (anchoDe(a) ?? 1e9) - (anchoDe(b) ?? 1e9));
  if (o === "wd") l.sort((a, b) => (anchoDe(b) ?? -1) - (anchoDe(a) ?? -1));
  return l;
}
function filtrar(c: Catalogo, e: Estado): Modelo[] {
  const q = norm(e.q.trim());
  return ordenar(c.P.filter((p) => {
    if (q) {
      const hay = norm([p.nombre, p.descripcion_corta, p.tipo, c.R[p.ambiente].nombre, p.variante, p.caracteristicas.join(" "), p.codigo].join(" "));
      return q.split(/\s+/).every((t) => hay.includes(t)) && medidaOk(p, e.medida);
    }
    if (e.ambiente && p.ambiente !== e.ambiente) return false;
    if (e.publico && c.R[p.ambiente].publico !== e.publico) return false;
    if (e.tipo && p.tipo !== e.tipo) return false;
    return medidaOk(p, e.medida);
  }), e.orden);
}

/** Después de lo pedido, el listado sigue con los otros ambientes ("Seguí mirando"): primero los del mismo público. */
type Segmento = { primero?: true; ambiente?: string; titulo?: string; items: Modelo[] };
function segmentos(c: Catalogo, e: Estado, primeros: Modelo[]): Segmento[] {
  const usados = new Set(primeros.map((p) => p.id)), segs: Segmento[] = [{ primero: true, items: primeros }];
  const amb = e.ambiente ? c.R[e.ambiente] : null;
  let orden: string[] = [];
  if (e.q) orden = c.ambientes.map((r) => r.slug);
  else if (amb) {
    const mismos = c.ambientes.filter((r) => r.publico === amb.publico).map((r) => r.slug), i = mismos.indexOf(amb.slug);
    orden = [...(e.tipo ? [amb.slug] : []), ...mismos.slice(i + 1), ...mismos.slice(0, i), ...c.ambientes.filter((r) => r.publico !== amb.publico).map((r) => r.slug)];
  } else if (e.publico) orden = c.ambientes.filter((r) => r.publico !== e.publico).map((r) => r.slug);
  for (const id of orden) {
    const items = ordenar(c.P.filter((p) => p.ambiente === id && !usados.has(p.id) && medidaOk(p, e.medida)), e.orden);
    if (!items.length) continue;
    items.forEach((p) => usados.add(p.id));
    segs.push({ ambiente: id, titulo: id === e.ambiente ? `Más de ${c.R[id].nombre.toLowerCase()}` : c.R[id].nombre, items });
  }
  return segs;
}

/** Las primeras `total` tarjetas del listado, con un corte cada 8: un ambiente que combina o un banner, alternados. */
type Pieza = { k: "modelo"; p: Modelo } | { k: "seccion"; s: Segmento } | { k: "banner"; n: number } | { k: "combina"; ambiente: string } | { k: "fin" };
function armarFeed(c: Catalogo, e: Estado, segs: Segmento[], total: number): Pieza[] {
  const out: Pieza[] = [], mostrados = new Set<string>();
  let s = 0, k = 0, n = 0, cortes = 0, quedan = total;
  const corte = () => {
    const b = cortes++;
    if (b % 2 === 1) { out.push({ k: "banner", n: Math.floor(b / 2) % BANNERS.length }); return; }
    const base = segs[Math.min(s, segs.length - 1)].ambiente || e.ambiente || (e.publico === "negocio" ? "kiosco" : "dormitorio");
    const id = [...(c.R[base]?.rel || []), ...c.ambientes.map((r) => r.slug)].find((x) => !mostrados.has(x) && x !== base);
    if (!id) return;
    mostrados.add(id);
    if (c.R[id] && c.P.some((p) => p.ambiente === id && p.fotos.length)) out.push({ k: "combina", ambiente: id });
  };
  while (quedan > 0 && s < segs.length) {
    const seg = segs[s];
    if (k === 0 && !seg.primero) out.push({ k: "seccion", s: seg });
    if (!seg.items.length) { s++; k = 0; continue; }
    out.push({ k: "modelo", p: seg.items[k++] });
    n++; quedan--;
    if (n % 8 === 0) corte();
    if (k >= seg.items.length) { s++; k = 0; }
  }
  if (s >= segs.length) out.push({ k: "fin" });
  return out;
}

/* ---------- piezas de la página ---------- */

function Buscador({ id, placeholder, valor, cambiar, enviar, enCajon, entrada }: {
  id: string; placeholder: string; valor: string; cambiar: (v: string) => void; enviar: (e: FormEvent) => void; enCajon?: boolean; entrada?: Ref<HTMLInputElement>;
}) {
  return (
    <form role="search" onSubmit={enviar}
      className={`flex items-center gap-2 h-[46px] rounded-full border-[1.5px] border-line pl-4 pr-1.5 transition-[border-color] duration-200 min-w-0 focus-within:border-gold ${enCajon ? "bg-bg" : "bg-surface"}`}>
      <I n="search" className="size-[19px] text-muted flex-none" />
      <label className="sr-only" htmlFor={id}>Buscar muebles</label>
      <input id={id} ref={entrada} type="search" placeholder={placeholder} autoComplete="off" enterKeyHint="search" value={valor} onChange={(e) => cambiar(e.target.value)}
        className="border-0 bg-transparent outline-none w-full min-w-0 text-[15.5px] placeholder:text-muted" />
      <button type="submit" className="border-0 rounded-full h-[34px] px-3.5 font-bold text-[13.5px] cursor-pointer text-on-gold bg-[linear-gradient(135deg,var(--gold-hi),var(--gold))]">Buscar</button>
    </form>
  );
}

type ItemCuadro = { label: string; img: string | null; n: number; slug: string; tipo?: string };
/** Cuadro de 4 fotos, como los de Amazon. */
function Cuadro({ titulo, items, link, alLink, irAmbiente, soloCompu }: {
  titulo: string; items: ItemCuadro[]; link: string; alLink: () => void; irAmbiente: (slug: string, tipo?: string) => void; soloCompu?: boolean;
}) {
  return (
    <div className={`bg-surface border border-line rounded-lg p-[18px] gap-3 min-w-0 content-start ${soloCompu ? "hidden lg:grid" : "grid"}`}>
      <h3 className="text-[23px]">{titulo}</h3>
      <div className="grid grid-cols-2 gap-2.5 items-start">
        {items.map((it) => (
          <button key={it.label} onClick={() => irAmbiente(it.slug, it.tipo)}
            className="group cursor-pointer grid gap-1.5 text-[14px] font-semibold leading-[1.25] text-left focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:rounded-[10px]">
            <div className="aspect-square rounded-xl overflow-hidden bg-surface-2 relative">
              <MarcaFondo />
              {it.img && <Foto src={it.img} alt={it.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />}
            </div>
            <span>{it.label}<small className="block font-medium text-muted text-[12.5px]">{it.n} modelos</small></span>
          </button>
        ))}
      </div>
      <button className={LINK} onClick={alLink}>{link} {FLECHA}</button>
    </div>
  );
}

/** Ambientes con foto, para la columna de la compu y el menú del celular. */
function Lateral({ cat, e, enCajon, hecho, irAmbiente, irPublico, irInicio }: {
  cat: Catalogo | null; e: Estado; enCajon?: boolean; hecho?: () => void;
  irAmbiente: (slug: string) => void; irPublico: (p: Publico) => void; irInicio: (ancla?: string) => void;
}) {
  const fondo = enCajon ? "hover:bg-surface-2 aria-[current=true]:bg-surface-2" : "hover:bg-surface aria-[current=true]:bg-surface";
  return (
    <>
      {(["casa", "negocio"] as const).map((pub) => (
        <div key={pub} className="grid gap-0.5 mb-[22px]">
          <h4 className={H4}>{PUBLICOS[pub]}</h4>
          {cat?.ambientes.filter((r) => r.publico === pub).map((r) => (
            <button key={r.slug} aria-current={e.vista === "resultados" && e.ambiente === r.slug && !e.q} onClick={() => { hecho?.(); irAmbiente(r.slug); }}
              className={`cursor-pointer flex items-center gap-3 py-1.5 px-2 rounded-xl w-full text-ink text-left focus-visible:outline-2 aria-[current=true]:shadow-[inset_0_0_0_1.5px_var(--gold)] ${fondo}`}>
              <span className="size-[46px] rounded-[10px] overflow-hidden bg-surface-2 flex-none">{r.portada && <Foto src={r.portada} alt="" className="w-full h-full object-cover" />}</span>
              <span className="text-[15px] font-semibold leading-[1.25]">{r.nombre}<small className="block font-medium text-[12.5px] text-muted">{r.n} modelos</small></span>
            </button>
          ))}
          <button className={`${LINK} mt-2 mx-2`} onClick={() => { hecho?.(); irPublico(pub); }}>Ver todo {pub === "casa" ? "para tu casa" : "para tu negocio"} {FLECHA}</button>
        </div>
      ))}
      <div className="grid gap-0.5 mb-[22px]">
        <h4 className={H4}>La Unión</h4>
        <div className="grid">
          {[["#proyectos", "Trabajos a medida"], ["#financiacion", "Cuotas y formas de pago"], ["#nosotros", "Quiénes somos"], ["#contacto", "Dónde estamos"]].map(([a, t]) => (
            <button key={a} onClick={() => { hecho?.(); irInicio(a); }}
              className="cursor-pointer py-[9px] px-2 rounded-[10px] text-[15px] text-muted text-left hover:text-ink hover:bg-surface">{t}</button>
          ))}
        </div>
      </div>
    </>
  );
}

/** Bloque "Combina bien" dentro del listado: otro ambiente que va con lo que se está mirando. */
function Combina({ cat, slug, irAmbiente }: { cat: Catalogo; slug: string; irAmbiente: (slug: string) => void }) {
  const items = cat.P.filter((p) => p.ambiente === slug && p.fotos.length).sort((a, b) => b.fotos.length - a.fotos.length).slice(0, 8);
  return (
    <div className="col-span-full bg-surface-2 rounded-lg pt-[18px] px-(--gutter) pb-1.5 mx-[calc(var(--gutter)*-1)] lg:mx-0 lg:px-6">
      <div className="flex justify-between items-end gap-3 mb-3.5">
        <div><span className={EYEBROW}>Combina bien</span><h3 className="text-[22px]">{cat.R[slug].nombre}</h3></div>
        <button className={LINK} onClick={() => irAmbiente(slug)}>Ver todo {FLECHA}</button>
      </div>
      <div className={FILA_PRINCIPAL}>{items.map((p) => <Tarjeta key={p.id} p={p} modo="carrusel" />)}</div>
    </div>
  );
}

/* ---------- la página ---------- */

export default function Web() {
  const [cat, setCat] = useState<Catalogo | null>(null);
  const [e, setE] = useState<Estado>({ vista: "inicio", publico: null, ambiente: null, tipo: null, medida: "all", orden: "rec", q: "" });
  const [cuantos, setCuantos] = useState(12); // tarjetas mostradas en el listado: suben de a 12 al bajar
  const [busqueda, setBusqueda] = useState("");
  const [cajon, setCajon] = useState(false); // el menú del celular
  const [hoja, setHoja] = useState<Hoja>(null); // el detalle abierto
  const [tema, setTemaActual] = useState<Tema>("claro");
  const [aviso, setAviso] = useState({ texto: "", on: false });
  const [navOculta, setNavOculta] = useState(false); // celular: el encabezado se va al bajar y quedan dos botones flotantes
  const [pista, setPista] = useState(false); // "Decime lo que estás buscando" al lado de la lupa
  const [grupo, setGrupo] = useState<string>(GRUPOS_TRABAJO[0][0]);
  const caja = useRef<HTMLDivElement>(null), btnCerrar = useRef<HTMLButtonElement>(null), centinela = useRef<HTMLDivElement>(null);
  const q2 = useRef<HTMLInputElement>(null), galeria = useRef<HTMLDivElement>(null);
  const foco = useRef<HTMLElement | null>(null), avisoT = useRef(0);

  function mostrarAviso(texto: string) {
    setAviso({ texto, on: true });
    clearTimeout(avisoT.current);
    avisoT.current = window.setTimeout(() => setAviso((a) => ({ ...a, on: false })), 1600);
  }

  useEffect(() => {
    api("web").then((d) => setCat(armarCatalogo(d))).catch((err: Error) => mostrarAviso(err.message));
    let t = "claro";
    try { t = localStorage.getItem("lu-theme") || "claro"; } catch {}
    setTema(TEMAS.some((x) => x[0] === t) ? (t as Tema) : "claro");
  }, []);

  function setTema(t: Tema, anunciar?: boolean) {
    document.documentElement.setAttribute("data-theme", t);
    setTemaActual(t);
    try { localStorage.setItem("lu-theme", t); } catch {}
    if (anunciar) mostrarAviso(`Colores: ${TEMAS.find((x) => x[0] === t)![1]}`);
  }

  const telefono = normTelefono(cat && Object.hasOwn(cat.vendedores, VENDEDOR) ? cat.vendedores[VENDEDOR] : TELEFONO);
  const wa = (texto: string) => `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;

  /* navegación: sin cambiar la dirección, como la web anterior */
  function navegar(cambios: Partial<Estado>, ancla?: string) {
    flushSync(() => { setE((x) => ({ ...x, ...cambios })); setCuantos(12); });
    if (ancla) document.querySelector(ancla)?.scrollIntoView({ block: "start" });
    else scrollTo({ top: 0 });
  }
  function irAmbiente(slug: string, tipo?: string) {
    if (!cat?.R[slug]) return;
    cerrarHoja(); setBusqueda("");
    navegar({ vista: "resultados", ambiente: slug, publico: cat.R[slug].publico, tipo: tipo || null, q: "", medida: "all" });
  }
  function irPublico(publico: Publico) {
    setBusqueda("");
    navegar({ vista: "resultados", ambiente: null, publico, tipo: null, q: "", medida: "all" });
  }
  function irChicos() {
    setBusqueda("");
    navegar({ vista: "resultados", ambiente: null, publico: "casa", tipo: null, q: "", medida: "s", orden: "wa" });
  }
  function irInicio(ancla?: string) {
    cerrarHoja();
    navegar({ vista: "inicio" }, ancla);
  }
  function buscar(ev: FormEvent) {
    ev.preventDefault();
    const v = busqueda.trim();
    setBusqueda(v);
    if (!v) return;
    setCajon(false);
    navegar({ vista: "resultados", q: v, ambiente: null, publico: null, tipo: null, medida: "all" });
  }
  const filtro = (cambios: Partial<Estado>) => { setE((x) => ({ ...x, ...cambios })); setCuantos(12); };

  /* detalle */
  function abrirHoja(h: NonNullable<Hoja>) {
    if (!hoja) foco.current = document.activeElement as HTMLElement | null;
    setHoja(h);
  }
  function cerrarHoja() {
    if (!hoja) return;
    setHoja(null);
    foco.current?.focus?.({ preventScroll: true });
  }
  useEffect(() => {
    document.body.style.overflow = hoja ? "hidden" : "";
    if (!hoja) return;
    caja.current!.scrollTop = 0;
    const t = setTimeout(() => btnCerrar.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, [hoja]);

  function abrirCajon(aBuscar?: boolean) {
    setCajon(true);
    if (aBuscar) setTimeout(() => q2.current?.focus(), 320);
  }

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && !document.querySelector("dialog[open]")) { cerrarHoja(); setCajon(false); } // con la foto ampliada abierta, Escape cierra solo eso
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  });

  /* celular: al bajar se va el encabezado y aparece la lupa flotante, con un cartelito cada tanto */
  useEffect(() => {
    let ultimoY = scrollY, ultimaPista = 0, pistaT = 0, oculta = false;
    const mover = () => {
      const y = scrollY;
      if (!oculta && y > 160 && y > ultimoY + 4) {
        oculta = true; setNavOculta(true);
        if (Date.now() - ultimaPista > 20000) {
          ultimaPista = Date.now(); clearTimeout(pistaT);
          setTimeout(() => setPista(true), 650);
          pistaT = window.setTimeout(() => setPista(false), 3400);
        }
      } else if (oculta && y < 90) {
        oculta = false; setNavOculta(false); setPista(false);
      }
      ultimoY = y;
    };
    addEventListener("scroll", mover, { passive: true });
    return () => removeEventListener("scroll", mover);
  }, []);

  /* listado */
  const lista = useMemo(() => (cat && e.vista === "resultados" ? filtrar(cat, e) : []), [cat, e]);
  const segs = useMemo(() => (cat ? segmentos(cat, e, lista) : []), [cat, e, lista]);
  const feed = useMemo(() => (cat && e.vista === "resultados" ? armarFeed(cat, e, segs, cuantos) : []), [cat, e, segs, cuantos]);
  const terminado = feed.at(-1)?.k === "fin";
  useEffect(() => {
    if (e.vista !== "resultados" || terminado || !centinela.current) return;
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) setCuantos((c) => c + 12); }, { rootMargin: "900px 0px" });
    io.observe(centinela.current);
    return () => io.disconnect();
  }, [e.vista, terminado, feed.length]);

  /* inicio */
  const inicio = useMemo(() => {
    if (!cat) return null;
    const { P, R } = cat;
    const porFotos = (a: Modelo, b: Modelo) => b.fotos.length - a.fotos.length;
    const ambiente = (slug: string): ItemCuadro[] => (R[slug] ? [{ label: R[slug].nombre, img: R[slug].portada, n: R[slug].n, slug }] : []);
    const tipo = (slug: string, t: string): ItemCuadro[] => {
      if (!R[slug]) return [];
      const conFoto = P.filter((p) => p.ambiente === slug && p.tipo === t && p.fotos.length).sort(porFotos)[0];
      return [{ label: t, img: conFoto ? conFoto.fotos[0] : R[slug].portada, n: P.filter((p) => p.ambiente === slug && p.tipo === t).length, slug, tipo: t }];
    };
    return {
      casa: ["dormitorio", "belleza", "living", "cocina"].flatMap(ambiente),
      negocio: ["kiosco", "local", "panaderia", "unas"].flatMap(ambiente),
      dormitorio: ["Placares", "Cómodas", "Mesas de luz", "Respaldos de cama"].flatMap((t) => tipo("dormitorio", t)),
      kiosco: ["Carameleras", "Góndolas", "Cigarreras", "Mostradores multifunción"].flatMap((t) => tipo("kiosco", t)),
      destacados: P.filter((p) => p.destacado),
      chicos: P.filter((p) => R[p.ambiente].publico === "casa" && (anchoDe(p) ?? 61) <= 60 && p.fotos.length).slice(0, 3),
      led: P.filter((p) => R[p.ambiente].publico === "casa" && esLed(p) && p.fotos.length).sort(porFotos).slice(0, 10),
      negocios: ["kiosco", "local", "panaderia", "unas", "ropa", "oficina"].flatMap((r) => P.filter((p) => p.ambiente === r && p.fotos.length).sort(porFotos).slice(0, 2)),
    };
  }, [cat]);

  const acciones: Acciones = { wa, abrir: (p) => abrirHoja({ modelo: p }), irAmbiente, irInicio };
  const amb = e.ambiente && cat ? cat.R[e.ambiente] : null;
  const pub = amb ? amb.publico : e.publico;
  const tipos = amb && !e.q ? amb.tipos : [];
  const trabajos = cat ? cat.trabajos.filter((t) => grupoDe(t) === grupo) : [];
  const cuadro = (titulo: string, items: ItemCuadro[] | undefined, link: string, alLink: () => void, soloCompu?: boolean) =>
    <Cuadro titulo={titulo} items={items || []} link={link} alLink={alLink} irAmbiente={irAmbiente} soloCompu={soloCompu} />;
  const lateral = { cat, e, irAmbiente, irPublico, irInicio };

  return (
    <AccionesCtx.Provider value={acciones}>
      <title>La Unión Muebles</title>
      <Sprite />

      <div className="bg-night text-night-ink text-[12px] tracking-[.12em] uppercase text-center py-[7px] px-(--gutter)">
        Fabricamos en Tucumán · <b className="text-gold-hi font-semibold">Cuotas semanales</b> · Te lo llevamos e instalamos
      </div>

      <header id="top" className={`sticky top-[env(safe-area-inset-top,0px)] z-40 bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] backdrop-blur-[14px] backdrop-saturate-[1.3] border-b border-line transition-transform duration-[.35s] ease-[cubic-bezier(.2,.8,.2,1)] ${navOculta ? "max-lg:-translate-y-[110%]" : ""}`}>
        <div className={WRAP}>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1.5 h-[60px] lg:grid-cols-[auto_minmax(280px,560px)_1fr] lg:h-[72px] lg:gap-6">
            <div className="flex items-center gap-0.5">
              <button className={`${BTN_ICONO} lg:hidden`} aria-label="Abrir menú" onClick={() => abrirCajon()}><I n="menu" /></button>
              <button className="cursor-pointer flex items-center gap-2.5" aria-label="La Unión Muebles, ir al inicio" onClick={() => irInicio()}>
                <Marca className="h-9 w-auto" />
                <span className="hidden lg:block font-display text-[19px] tracking-[.14em] uppercase">La Unión</span>
              </button>
            </div>
            <div className="hidden lg:block">
              <Buscador id="q1" placeholder="¿Qué estás buscando? Ej: cómoda, mesa de luz…" valor={busqueda} cambiar={setBusqueda} enviar={buscar} />
            </div>
            <div className="flex items-center gap-0.5 col-start-3 justify-end lg:gap-2">
              <button className={`${BTN_ICONO} lg:hidden`} aria-label="Buscar" onClick={() => abrirCajon(true)}><I n="search" /></button>
              <button className="flex items-center gap-1.5 h-11 px-2.5 rounded-full border-0 bg-transparent cursor-pointer text-ink text-[13px] font-semibold hover:bg-surface-2"
                aria-label="Cambiar colores de la página" onClick={() => setTema(TEMAS[(TEMAS.findIndex((x) => x[0] === document.documentElement.getAttribute("data-theme")) + 1) % TEMAS.length][0], true)}>
                <span className="size-5 rounded-full border-[1.5px] border-line bg-[linear-gradient(135deg,var(--surface)_50%,var(--ink)_50%)]" />
                <span className="hidden lg:inline">{TEMAS.find((x) => x[0] === tema)![1]}</span>
              </button>
              <div className="hidden lg:contents">
                <a className={BTN_ICONO} target="_blank" rel="noopener" href={wa("Hola! Quisiera más información.")} aria-label="Escribir por WhatsApp"><I n="chat" /></a>
                <a className={`${BTN_ORO_SM} lg:min-h-[46px]`} target="_blank" rel="noopener" href={wa("Hola La Unión! Quiero pedir un presupuesto.")}>Pedir presupuesto</a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* menú del celular: ambientes, colores y buscador abajo, a mano */}
      <div aria-hidden={!cajon} className={`fixed inset-0 z-60 grid grid-cols-[80vw_1fr] lg:grid-cols-[min(86vw,370px)_1fr] ${cajon ? "visible" : "invisible"}`}>
        <div role="dialog" aria-label="Menú" className={`bg-surface flex flex-col overflow-hidden transition-transform duration-[.35s] ease-[cubic-bezier(.2,.8,.2,1)] ${cajon ? "" : "-translate-x-full"}`}>
          <div className="flex-1 overflow-auto pt-[calc(16px+env(safe-area-inset-top,0px))] px-[22px] pb-5 flex flex-col gap-5 overscroll-contain">
            <div className="flex justify-between items-center">
              <Marca className="h-11 w-auto" />
              <button className={BTN_ICONO} aria-label="Cerrar menú" onClick={() => setCajon(false)}><I n="x" /></button>
            </div>
            <div><Lateral {...lateral} enCajon hecho={() => setCajon(false)} /></div>
            <div>
              <h4 className="font-body text-[12px] tracking-[.16em] uppercase text-muted font-bold mb-1.5">Colores de la página</h4>
              <div className={SEG} role="group" aria-label="Colores de la página">
                {TEMAS.map(([k, l]) => <button key={k} className={SEG_BTN} aria-pressed={tema === k} onClick={() => setTema(k, true)}>{l}</button>)}
              </div>
            </div>
          </div>
          <div className="pt-3 px-4 pb-[calc(14px+env(safe-area-inset-bottom,0px))] border-t border-line bg-surface">
            <Buscador id="q2" placeholder="Decime qué estás buscando" valor={busqueda} cambiar={setBusqueda} enviar={buscar} enCajon entrada={q2} />
          </div>
        </div>
        <div className={`bg-scrim transition-opacity duration-300 ${cajon ? "opacity-100" : "opacity-0"}`} onClick={() => setCajon(false)} />
      </div>

      <div className="lg:max-w-[1280px] lg:mx-auto lg:px-(--gutter) lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-9 lg:items-start">
        <aside aria-label="Categorías" className="hidden lg:block lg:sticky lg:top-[calc(var(--hdr)+18px)] lg:max-h-[calc(100vh-var(--hdr)-36px)] lg:overflow-auto lg:pt-4 lg:pr-1 lg:pb-6 [scrollbar-width:thin]">
          <Lateral {...lateral} />
        </aside>
        <main>
          {/* ---------- INICIO ---------- */}
          <div hidden={e.vista !== "inicio"}>
            <section className="pt-4">
              <div className={WRAP_P}>
                <div className="relative rounded-lg overflow-hidden bg-surface-2 w-full min-h-[340px] flex items-end sm:min-h-[380px] lg:min-h-[420px] after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(0,0,0,0)_25%,var(--scrim)_100%)]">
                  <MarcaFondo />
                  <Foto src={FOTOS.hero} alt="Showroom de La Unión Muebles en Lomas de Tafí" ya className="absolute inset-0 w-full h-full object-cover object-[50%_62%] lg:object-[50%_55%]" />
                  <div className="relative z-2 text-on-photo grid gap-2.5 py-[22px] px-[18px] w-full sm:p-8 lg:p-11 lg:max-w-[680px]">
                    <span className={EYEBROW_CLARO}>Fábrica familiar en Tafí Viejo</span>
                    <h1 className="text-[clamp(30px,8.2vw,64px)] leading-[1.04] lg:text-[clamp(38px,3.9vw,60px)]">Muebles <span className="shine">a tu medida</span>, hechos en Tucumán.</h1>
                    <p className="text-[15px] opacity-[.92] max-w-[44ch]">Elegí el modelo, decinos la medida y el color, y nosotros lo fabricamos y te lo instalamos.</p>
                    <div className="flex gap-2.5 flex-wrap"><button className={BTN_ORO} onClick={() => irInicio("#amoblar")}>¿Qué querés amoblar? <I n="arrow" /></button></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mt-3 lg:grid-cols-4">
                  {([["saw", "Lo fabricamos nosotros", "Sin intermediarios"], ["ruler", "A la medida que necesites", "Medida y color a elección"],
                    ["truck", "Te lo llevamos e instalamos", "En toda la provincia"], ["card", "Cuotas semanales", "Y hasta 12 con tarjeta"]] as [NombreIcono, string, string][]).map(([ic, b, s]) => (
                    <div key={b} className="flex gap-2.5 items-start min-w-0 bg-surface border border-line rounded-md p-3 text-[14px] leading-[1.3]">
                      <I n={ic} className="size-[22px] text-gold flex-none" />
                      <p><b className="block font-bold text-[14px]">{b}</b><span className="text-muted text-[12.5px]">{s}</span></p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={SECCION} id="amoblar">
              <div className={WRAP_P}>
                <Cabeza titulo="¿Qué querés amoblar?" bajada="Elegí el ambiente y te mostramos lo que hacemos para ese espacio." />
                {inicio && (
                  <div className={CUADROS}>
                    {cuadro("Para tu casa", inicio.casa, "Ver todo para tu casa", () => irPublico("casa"))}
                    {cuadro("Para tu negocio", inicio.negocio, "Ver todo para tu negocio", () => irPublico("negocio"))}
                    {cuadro("Armá tu dormitorio", inicio.dormitorio, "Ver todo el dormitorio", () => irAmbiente("dormitorio"), true)}
                    {cuadro("Equipá tu kiosco", inicio.kiosco, "Ver todo para kioscos", () => irAmbiente("kiosco"), true)}
                  </div>
                )}
              </div>
            </section>

            <section className={SECCION}>
              <div className={WRAP_P}>
                <Cabeza titulo="Destacados del taller" bajada="Modelos que fabricamos seguido, con varias fotos de trabajos reales." />
                <div className={`${FILA_PRINCIPAL} ${LISTA_INICIO}`}>{inicio?.destacados.map((p) => <Tarjeta key={p.id} p={p} modo="inicio" />)}</div>
              </div>
            </section>

            <section className={SECCION}>
              <div className={WRAP_P}>
                <Banner titulo="Lo hacemos en nuestro taller, a tu medida" sub="Diseñamos, cortamos, armamos y te lo instalamos. Sin intermediarios." cta="Ver cómo se pide" ancla="#proceso"
                  fotos={[FOTOS.taller, FOTOS.showroom, FOTOS.placard14]} />
              </div>
            </section>

            <section className={SECCION}>
              <div className={WRAP_P}>
                <Cabeza titulo="¿Poco espacio? Estos entran" bajada="Muebles de hasta 60 cm de ancho para departamentos y rincones chicos.">
                  <button className={LINK} onClick={irChicos}>Ver todos {FLECHA}</button>
                </Cabeza>
                <div className={`${LISTA} sm:grid-cols-3 sm:gap-3.5 lg:gap-5`}>{inicio?.chicos.map((p) => <Tarjeta key={p.id} p={p} modo="chicos" />)}</div>
              </div>
            </section>

            <section className={`${SECCION} lg:hidden`}>
              <div className={WRAP_P}>
                {inicio && (
                  <div className={CUADROS}>
                    {cuadro("Armá tu dormitorio", inicio.dormitorio, "Ver todo el dormitorio", () => irAmbiente("dormitorio"))}
                    {cuadro("Equipá tu kiosco", inicio.kiosco, "Ver todo para kioscos", () => irAmbiente("kiosco"))}
                  </div>
                )}
              </div>
            </section>

            <section className={SECCION}>
              <div className={WRAP_P}>
                <Cabeza titulo="Con luz LED" bajada="Maquilladores, espejos y organizadores con luz para ver cada detalle.">
                  <button className={LINK} onClick={() => irAmbiente("belleza")}>Ver más {FLECHA}</button>
                </Cabeza>
                <div className={`${FILA_PRINCIPAL} ${LISTA_INICIO}`}>{inicio?.led.map((p) => <Tarjeta key={p.id} p={p} modo="inicio" />)}</div>
              </div>
            </section>

            <section className={SECCION}>
              <div className={WRAP_P}>
                <Cabeza titulo="Para que tu negocio venda más" bajada="Kioscos, panaderías, salones y locales de toda la provincia ya los usan.">
                  <button className={LINK} onClick={() => irPublico("negocio")}>Ver todo {FLECHA}</button>
                </Cabeza>
                <div className={`${FILA_PRINCIPAL} ${LISTA_INICIO}`}>{inicio?.negocios.map((p) => <Tarjeta key={p.id} p={p} modo="inicio" />)}</div>
              </div>
            </section>

            <section className={SECCION} id="proyectos">
              <div className={WRAP_P}>
                <Cabeza titulo="Trabajos hechos a medida" bajada="Cada uno se diseñó para un ambiente puntual. El presupuesto sale del diseño y las medidas de tu espacio." />
                <div className={`${SEG} mb-3.5`} role="group" aria-label="Tipo de trabajo">
                  {GRUPOS_TRABAJO.map(([g, l]) => (
                    <button key={g} className={SEG_BTN} aria-pressed={grupo === g} onClick={() => { setGrupo(g); galeria.current!.scrollLeft = 0; }}>{l}</button>
                  ))}
                </div>
                <div ref={galeria} className={FILA_PRINCIPAL}>
                  {trabajos.map((t, k) => (
                    <button key={t.id} className="flex-[0_0_62%] max-w-[300px] snap-start border-0 p-0 bg-transparent cursor-pointer text-left sm:basis-[280px]" onClick={() => abrirHoja({ trabajo: t })}>
                      <div className={`${MEDIA} rounded-2xl aspect-[3/4]`}>
                        <MarcaFondo />
                        {t.fotos[0] && <Foto src={t.fotos[0]} alt={`Trabajo ${k + 1}`} />}
                        {t.fotos.length > 1 && <span className={`${CONTADOR} top-[9px] right-[9px]`}><I n="photos" />{t.fotos.length}</span>}
                      </div>
                      <div className="flex justify-between text-[13px] text-muted mt-2">
                        <b className="font-display font-normal text-ink text-[16px]">Trabajo {String(k + 1).padStart(2, "0")}</b>
                        <span>{t.fotos.length} {t.fotos.length > 1 ? "fotos" : "foto"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className={SECCION} id="proceso">
              <div className={WRAP_P}>
                <Cabeza titulo="Así de fácil es pedirlo" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[["01", "Nos escribís", "Mandanos por WhatsApp el modelo que te gustó o una foto de tu idea, con las medidas del espacio."],
                    ["02", "Te pasamos el presupuesto", "Te ayudamos a elegir materiales y colores, sin compromiso."],
                    ["03", "Lo fabricamos", "Lo hacemos en nuestro taller de General Paz 2552."],
                    ["04", "Te lo instalamos", "Lo llevamos y lo dejamos armado, en toda la provincia de Tucumán."]].map(([n, h, t]) => (
                    <div key={n} className="bg-surface rounded-md p-5 grid gap-1.5 border border-line">
                      <span className="font-display text-[30px] leading-none shine">{n}</span>
                      <h3 className="text-[21px]">{h}</h3>
                      <p className="text-muted text-[15px]">{t}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={SECCION} id="financiacion">
              <div className={WRAP_P}>
                <Cabeza titulo="Pagalo como te quede cómodo" bajada="Para tu casa o tu negocio, sin complicaciones." />
                <div className="grid gap-3.5 lg:grid-cols-[1fr_1.25fr]">
                  <div className="bg-surface border border-line rounded-lg p-[22px] grid gap-3.5 min-w-0">
                    <span className={EYEBROW}>Financiación propia</span>
                    <h3 className="text-[24px]">Cuotas semanales, de 6 a 18 semanas</h3>
                    <ul className={TICKS}>
                      <li><I n="check" />Te llevás el mueble pagando la primera cuota</li>
                      <li><I n="check" />Cuotas fijas, sin sorpresas</li>
                      <li><I n="check" />Pedimos pocos requisitos</li>
                      <li><I n="check" />También para negocios de cualquier rubro</li>
                    </ul>
                    <a className={BTN_ORO} target="_blank" rel="noopener" href={wa("Hola! Quiero consultar por las cuotas semanales.")}><I n="chat" />Consultar cuotas semanales</a>
                  </div>
                  <div className="bg-surface border border-line rounded-lg p-[22px] grid gap-3.5 min-w-0"><Calculadora id="amountHome" /></div>
                </div>
              </div>
            </section>

            <section className={SECCION} id="nosotros">
              <div className={`${WRAP_P} grid gap-[22px] lg:grid-cols-2 lg:gap-14 lg:items-center`}>
                <div className="grid grid-cols-[1.25fr_1fr] gap-2.5">
                  <div className={`${MEDIA} rounded-2xl row-span-2 min-h-full`}><MarcaFondo /><Foto src={FOTOS.familia} alt="La familia de La Unión Muebles" ya /></div>
                  <div className={`${MEDIA} rounded-2xl aspect-[3/4]`}><MarcaFondo /><Foto src={FOTOS.fabrica} alt="Taller de fabricación en General Paz" ya /></div>
                  <div className={`${MEDIA} rounded-2xl aspect-[3/4]`}><MarcaFondo /><Foto src={FOTOS.showroom} alt="Showroom en Lomas de Tafí" ya /></div>
                </div>
                <div>
                  <span className={EYEBROW}>Quiénes somos</span>
                  <h2 className="text-[clamp(30px,7.4vw,50px)] leading-[1.05] mt-2 mb-[18px]">Una familia que soñó <span className="shine">La Unión</span>.</h2>
                  <p className="mb-3.5 max-w-[60ch]">Fernando Sanabria y Patricia Díaz, junto a sus hijos y a Valentina Sánchez, formaron La Unión: una fábrica de muebles hechos con dedicación y oficio.</p>
                  <p className="font-display text-[clamp(22px,5.4vw,30px)] leading-[1.25] my-[18px] max-w-[60ch]">Cada pieza que sale del taller de General Paz lleva el compromiso de una familia que trabaja unida.</p>
                  <p className="mb-3.5 max-w-[60ch]">Equipamos casas y negocios de toda la provincia, desde un rincón de maquillaje hasta el local completo.</p>
                  <div className="grid border-t border-line">
                    {["Diseño pensado para tu espacio", "Fabricación propia, sin intermediarios", "Instalación y asesoramiento", "Envíos a toda la provincia de Tucumán"].map((v) => (
                      <div key={v} className="flex gap-3 py-3 border-b border-line text-[15px]"><I n="check" className="size-[18px] text-gold flex-none mt-[3px]" />{v}</div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className={SECCION} id="contacto">
              <div className={`${WRAP_P} grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]`}>
                <div className="bg-night text-night-ink rounded-lg py-7 px-[22px] grid gap-3.5 relative overflow-hidden sm:col-span-full sm:p-10 lg:col-auto lg:row-span-2">
                  <Marca className="absolute -right-[30px] -bottom-10 h-[220px] w-auto opacity-[.18]" />
                  <span className={EYEBROW_CLARO}>Hablemos</span>
                  <h2 className="text-[clamp(30px,7.6vw,48px)]">Contanos qué <span className="shine">necesitás</span>.</h2>
                  <p className="opacity-80 max-w-[46ch]">Escribinos por WhatsApp y te asesoramos sin compromiso. Te pasamos diseño, materiales y presupuesto.</p>
                  <div><a className={BTN_ORO} target="_blank" rel="noopener" href={wa("Hola La Unión! Quiero pedir un presupuesto.")}><I n="chat" />Consultar por WhatsApp</a></div>
                  <span className="text-[18px] tabular-nums select-all">+54 9 {telefonoLindo(telefono)}</span>
                </div>
                <div className={CBOX}>
                  <span className={CBOX_EYEBROW}>Showroom</span><b className={CBOX_B}>Lomas de Tafí</b><span className={CBOX_TXT}>Av. Raya y Juan Leoncio Carbajal, Tafí Viejo</span>
                  <a className={`${LINK} mt-1.5`} target="_blank" rel="noopener" href="https://maps.app.goo.gl/bnna2HMRmvibRxdc6">Cómo llegar {FLECHA}</a>
                </div>
                <div className={CBOX}><span className={CBOX_EYEBROW}>Fábrica</span><b className={CBOX_B}>General Paz 2552</b><span className={CBOX_TXT}>San Miguel de Tucumán</span></div>
                <div className={CBOX}>
                  <span className={CBOX_EYEBROW}>Horarios</span><b className={CBOX_B}>Lunes a viernes</b><span className={CBOX_TXT}>9 a 19 h</span>
                  <b className={`${CBOX_B} mt-1.5`}>Sábados</b><span className={CBOX_TXT}>9 a 14 h</span>
                </div>
                <div className={CBOX}>
                  <span className={CBOX_EYEBROW}>Instagram</span><b className={CBOX_B}>@launionmuebles_</b><span className={CBOX_TXT}>Trabajos nuevos todas las semanas</span>
                  <a className={`${LINK} mt-1.5`} target="_blank" rel="noopener" href="https://www.instagram.com/launionmuebles_">Ver perfil {FLECHA}</a>
                </div>
              </div>
            </section>
          </div>

          {/* ---------- LISTADO ---------- */}
          <div hidden={e.vista !== "resultados"}>
            <div className={WRAP_P}>
              <nav className="flex gap-1.5 flex-wrap text-[13.5px] text-muted pt-[18px]" aria-label="Estás en">
                <button className="cursor-pointer text-gold-ink font-semibold" onClick={() => irInicio()}>Inicio</button>
                {e.q ? <><span>›</span><span>Búsqueda</span></> : (
                  <>
                    {pub && <><span>›</span>{amb ? <button className="cursor-pointer text-gold-ink font-semibold" onClick={() => irPublico(pub)}>{PUBLICOS[pub]}</button> : <span>{PUBLICOS[pub]}</span>}</>}
                    {amb && <><span>›</span><span>{amb.nombre}</span></>}
                  </>
                )}
              </nav>
              <div className="grid gap-1.5 mt-2.5 mb-3.5">
                <h1 className="text-[clamp(30px,7.6vw,52px)] leading-[1.05]">{e.q ? `Resultados para “${e.q}”` : amb ? e.tipo || amb.nombre : pub ? PUBLICOS[pub] : "Todo el catálogo"}</h1>
                <p className="text-muted max-w-[58ch]">
                  {e.q ? "Buscamos en todo el catálogo, para casa y para negocios." : amb ? amb.frase : pub === "casa" ? "Todo lo que hacemos para tu casa, ambiente por ambiente." : "Todo lo que hacemos para negocios, rubro por rubro."}
                </p>
              </div>
              <button className={`${BTN_SM} mb-3 lg:hidden`} onClick={() => abrirCajon()}><I n="menu" />Ver categorías</button>
              <div className="grid gap-2.5 mb-3 [&>*]:min-w-0">
                {tipos.length > 1 && (
                  <div className={CHIPS}>
                    <button className={CHIP_BTN} aria-pressed={!e.tipo} onClick={() => filtro({ tipo: null })}>Todo</button>
                    {tipos.map((t) => <button key={t} className={CHIP_BTN} aria-pressed={e.tipo === t} onClick={() => filtro({ tipo: t })}>{t}</button>)}
                  </div>
                )}
                <div className={CHIPS}>
                  {MEDIDAS.map(([k, l]) => <button key={k} className={CHIP_BTN} aria-pressed={e.medida === k} onClick={() => filtro({ medida: k })}>{l}</button>)}
                  <label className={`${CHIP} inline-flex items-center pr-2`}>
                    <span className="sr-only">Ordenar</span>
                    <select className="border-0 bg-transparent outline-none cursor-pointer font-semibold" value={e.orden} onChange={(x) => filtro({ orden: x.target.value as Orden })}>
                      <option value="rec">Recomendados</option><option value="wa">Más angostos primero</option><option value="wd">Más anchos primero</option>
                    </select>
                  </label>
                </div>
                <span className="text-[13.5px] text-muted tabular-nums">
                  {lista.length} {lista.length === 1 ? "modelo" : "modelos"}{e.q ? "" : amb ? ` en ${amb.nombre.toLowerCase()}` : ""}
                </span>
              </div>
              <div className={`${LISTA} sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-5`}>
                {cat && !lista.length && (
                  <div className="col-span-full text-center py-9 px-3 text-muted grid gap-3 justify-items-center">
                    <p>No encontramos “{e.q || "eso"}”, pero lo podemos fabricar a medida.</p>
                    <a className={BTN_ORO} target="_blank" rel="noopener" href={wa(`Hola! Busco ${e.q || "un mueble"} y no lo encontré en la web.`)}><I n="chat" />Consultar por WhatsApp</a>
                  </div>
                )}
                {cat && feed.map((x, j) =>
                  x.k === "modelo" ? <Tarjeta key={`m${x.p.id}`} p={x.p} modo="lista" />
                  : x.k === "seccion" ? (
                    <div key={`s${x.s.ambiente}`} className="col-span-full flex justify-between items-end gap-3 pt-6 mt-2.5 border-t border-line">
                      <div>
                        <span className={EYEBROW}>Seguí mirando</span>
                        <h2 className="text-[clamp(24px,6vw,34px)] leading-[1.1] mt-1">{x.s.titulo}</h2>
                        <p className="text-muted text-[14px] mt-1 max-w-[52ch]">{cat.R[x.s.ambiente!].frase}</p>
                      </div>
                      <button className={LINK} onClick={() => irAmbiente(x.s.ambiente!)}>Ver solo esto {FLECHA}</button>
                    </div>
                  )
                  : x.k === "banner" ? <Banner key={`b${j}`} {...BANNERS[x.n]} />
                  : x.k === "combina" ? <Combina key={`c${x.ambiente}`} cat={cat} slug={x.ambiente} irAmbiente={irAmbiente} />
                  : (
                    <div key="fin" className="col-span-full grid justify-items-center gap-3 text-center py-9 px-3 text-muted">
                      <Marca className="h-14 w-auto" />
                      <p>Viste todo el catálogo. ¿Buscás algo distinto? Lo hacemos a medida.</p>
                      <a className={BTN_ORO} target="_blank" rel="noopener" href={wa("Hola! Busco un mueble que no vi en la web.")}><I n="chat" />Consultar por WhatsApp</a>
                    </div>
                  ))}
              </div>
              <div ref={centinela} aria-hidden="true" className="h-px" />
              <div className="flex mt-[26px]" />{/* el espacio que dejaba el botón "Ver más" (flex: así el margen no se pierde) */}
            </div>
          </div>
        </main>
      </div>

      <footer className="pt-11 pb-[calc(96px+env(safe-area-inset-bottom,0px))] mt-12 border-t border-line">
        <div className={`${WRAP} grid gap-[22px] lg:grid-cols-[1.4fr_1fr_1fr]`}>
          <div className="flex gap-3.5 items-center">
            <Marca className="h-14 w-auto" />
            <div>
              <b className="font-display font-normal text-[24px] tracking-[.12em] uppercase block">La Unión</b>
              <span className="text-[13px] text-muted">Muebles a medida para tu casa y tu negocio · Tafí Viejo, Tucumán</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[15px] [&>button]:cursor-pointer [&>button]:text-muted [&>button]:text-left">
            <button onClick={() => irPublico("casa")}>Para tu casa</button>
            <button onClick={() => irPublico("negocio")}>Para tu negocio</button>
            <button onClick={() => irInicio("#financiacion")}>Cuotas</button>
            <button onClick={() => irInicio("#nosotros")}>Quiénes somos</button>
            <button onClick={() => irInicio("#contacto")}>Dónde estamos</button>
            <button onClick={() => irInicio("#proyectos")}>Trabajos a medida</button>
            <a className="cursor-pointer text-gold-ink font-semibold" href="/seguimiento/">Seguí tu pedido</a>
          </div>
          <small className="text-[13px] text-muted">© 2026 La Unión Muebles. Fotos de trabajos reales del taller.</small>
        </div>
      </footer>

      {/* botones flotantes: WhatsApp y, en el celular con el encabezado escondido, la lupa */}
      <a target="_blank" rel="noopener" href={wa("Hola! Quisiera más información.")} aria-label="Consultar por WhatsApp"
        className={`fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom,0px))] z-50 items-center justify-center size-[58px] rounded-full no-underline text-[#14110E] bg-[linear-gradient(135deg,var(--gold-hi),var(--gold)_55%,var(--gold-deep))] [box-shadow:0_10px_28px_rgba(138,98,36,.32)] overflow-hidden after:absolute after:inset-0 after:bg-[linear-gradient(105deg,transparent_35%,rgba(255,250,232,.65)_50%,transparent_65%)] after:[transform:translateX(-120%)] after:animate-[sweep_7s_1.5s_ease-in-out_infinite] lg:right-7 lg:bottom-7 ${hoja ? "hidden" : "flex"}`}>
        <I n="wa" className="size-7" />
      </a>
      <div className={`fixed left-4 bottom-[calc(16px+env(safe-area-inset-bottom,0px))] z-50 items-center gap-2.5 pointer-events-none lg:hidden ${hoja ? "hidden" : "flex"} ${navOculta ? "max-lg:visible" : "invisible"}`}>
        <button aria-label="Buscar en el catálogo" onClick={() => abrirCajon(true)}
          className={`pointer-events-auto size-[58px] rounded-full grid place-items-center cursor-pointer bg-surface text-gold-ink border-2 border-gold [box-shadow:var(--shadow),0_0_0_4px_color-mix(in_srgb,var(--gold)_14%,transparent)] [&_svg]:size-6 ${navOculta ? "max-lg:animate-drop" : ""}`}>
          <I n="search" />
        </button>
        <button tabIndex={-1} onClick={() => abrirCajon(true)}
          className={`pointer-events-auto cursor-pointer border border-line bg-surface text-ink font-semibold text-[14px] py-2.5 px-3.5 rounded-[14px] shadow-suave whitespace-nowrap transition-[opacity,transform] duration-300 ${pista ? "opacity-100 [transform:none]" : "opacity-0 [transform:translateX(-8px)]"}`}>
          Decime lo que estás buscando
        </button>
      </div>

      {/* detalle: hoja que sube en el celular, ventana centrada en la compu */}
      <div aria-hidden={!hoja} className={`fixed inset-0 z-70 grid items-end lg:items-center lg:justify-items-center ${hoja ? "visible" : "invisible"}`}>
        <div className={`absolute inset-0 bg-scrim transition-opacity duration-300 ${hoja ? "opacity-100" : "opacity-0"}`} onClick={cerrarHoja} />
        <div ref={caja} role="dialog" aria-modal="true" aria-labelledby="dName"
          className={`relative bg-bg rounded-t-[24px] max-h-[94svh] overflow-auto overscroll-contain pb-[calc(96px+env(safe-area-inset-bottom,0px))] transition-transform duration-[.42s] ease-[cubic-bezier(.2,.8,.2,1)] lg:w-[min(1140px,calc(100vw-64px))] lg:rounded-[26px] lg:max-h-[90vh] lg:pb-8 lg:transition-[transform,opacity] lg:duration-[.35s,.3s] lg:ease-[ease] ${hoja ? "[transform:none] lg:opacity-100" : "[transform:translateY(100%)] lg:[transform:translateY(30px)_scale(.98)] lg:opacity-0"}`}>
          <div className="sticky top-0 z-3 flex justify-end py-2.5 px-3 h-0 overflow-visible lg:p-4">
            <button ref={btnCerrar} className={BTN_CERRAR} aria-label="Cerrar" onClick={cerrarHoja}><I n="x" /></button>
          </div>
          {hoja && cat && ("modelo" in hoja ? <DetalleModelo key={hoja.modelo.id} p={hoja.modelo} cat={cat} /> : <DetalleTrabajo key={hoja.trabajo.id} t={hoja.trabajo} />)}
        </div>
      </div>

      <div role="status" className={`fixed left-1/2 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-90 bg-ink text-bg py-2.5 px-4 rounded-full text-[14px] pointer-events-none transition-[opacity,transform] duration-[.25s] ${aviso.on ? "opacity-100 [transform:translate(-50%,0)]" : "opacity-0 [transform:translate(-50%,20px)]"}`}>
        {aviso.texto}
      </div>
    </AccionesCtx.Provider>
  );
}
