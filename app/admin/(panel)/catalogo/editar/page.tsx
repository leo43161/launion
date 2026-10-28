"use client";
// Alta y edición de un modelo: /admin/catalogo/editar/?id=<id> (sin id = nuevo). Fotos y video se suben al elegirlos.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ChangeEvent } from "react";
import { api, media, subir } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, fechaHora, medidas, mensajeWhatsapp, num, parseArs, precioPresupuesto } from "@/lib/formato";
import type { Categoria, Producto, ProductoGuardar, TipoPrecio } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { useAviso } from "@/components/Avisos";

export default function Pagina() {
  return <Suspense><Editar /></Suspense>;
}

/** El formulario guarda todo como texto, como lo escribe la persona. Se convierte al guardar. */
interface Formulario {
  nombre: string;
  ambiente_id: string;
  tipo: string;
  descripcion_corta: string;
  variante: string;
  ancho_cm: string;
  alto_cm: string;
  profundidad_cm: string;
  diametro_cm: string;
  detalle_medidas: string;
  texto_medidas: string;
  caracteristicas: string; // una por línea
  nota: string;
  codigo: string;
  precio_web: { tipo_precio: TipoPrecio | ""; monto: string; monto_hasta: string }; // "" = sin precio ("Consultar")
  precio_local: string;
  visible: boolean;
  destacado: boolean;
  fotos: string[];
  url_video: string;
  mensaje_whatsapp: string;
}
type CampoTexto = { [K in keyof Formulario]: Formulario[K] extends string ? K : never }[keyof Formulario];

const NUEVO: Formulario = {
  nombre: "", ambiente_id: "", tipo: "", descripcion_corta: "", variante: "",
  ancho_cm: "", alto_cm: "", profundidad_cm: "", diametro_cm: "", detalle_medidas: "", texto_medidas: "",
  caracteristicas: "", nota: "", codigo: "", precio_web: { tipo_precio: "", monto: "", monto_hasta: "" }, precio_local: "",
  visible: false, destacado: false, fotos: [], url_video: "", mensaje_whatsapp: "",
};

const texto = (v: string | number | null) => (v == null ? "" : String(v));
function aFormulario(p: Producto): Formulario {
  return {
    nombre: p.nombre, ambiente_id: String(p.ambiente_id), tipo: p.tipo, descripcion_corta: texto(p.descripcion_corta), variante: texto(p.variante),
    ancho_cm: texto(p.ancho_cm), alto_cm: texto(p.alto_cm), profundidad_cm: texto(p.profundidad_cm), diametro_cm: texto(p.diametro_cm),
    detalle_medidas: texto(p.detalle_medidas), texto_medidas: texto(p.texto_medidas),
    caracteristicas: p.caracteristicas.join("\n"), nota: texto(p.nota), codigo: texto(p.codigo),
    precio_web: p.precio_web
      ? { tipo_precio: p.precio_web.tipo_precio, monto: num(p.precio_web.monto), monto_hasta: p.precio_web.monto_hasta ? num(p.precio_web.monto_hasta) : "" }
      : NUEVO.precio_web,
    precio_local: p.precio_local ? num(p.precio_local) : "",
    visible: !!p.visible, destacado: !!p.destacado, fotos: p.fotos, url_video: texto(p.url_video), mensaje_whatsapp: texto(p.mensaje_whatsapp),
  };
}
/** "180" → 180; vacío → null. */
const entero = (v: string): number | null => (v.trim() ? +v.replace(/\D/g, "") || null : null);

function Editar() {
  const id = Number(useSearchParams().get("id")) || null; // null = modelo nuevo
  const router = useRouter();
  const avisar = useAviso();
  const { puede } = useSesion();
  const [p, setP] = useState<Formulario | null>(null);
  const [guardado, setGuardado] = useState<Producto | null>(null); // lo último guardado: nombre y fecha del encabezado
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [error, setError] = useState("");
  const [cambios, setCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState("");
  const [arrastrada, setArrastrada] = useState<number | null>(null);

  useEffect(() => {
    setP(null);
    setCambios(false);
    Promise.all([api("catalogo"), id ? api("producto", { query: { id: String(id) } }) : null]).then(([c, r]) => {
      setCategorias(c.categorias);
      setGuardado(r?.producto ?? null);
      setP(r ? aFormulario(r.producto) : { ...NUEVO, ambiente_id: String(c.categorias.find((x) => x.padre_id === null)?.id ?? "") });
    }, (e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!cambios) return;
    const avisarSalida = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    addEventListener("beforeunload", avisarSalida);
    return () => removeEventListener("beforeunload", avisarSalida);
  }, [cambios]);

  if (!puede("catalogo.editar")) return <div className="empty card"><h2>Tu usuario no puede editar el catálogo</h2><Link className="btn" href="/admin/catalogo/">Volver al catálogo</Link></div>;
  if (error) return <div className="empty card"><h2>{error}</h2><Link className="btn" href="/admin/catalogo/">Volver al catálogo</Link></div>;
  if (!p) return <p className="muted">Cargando…</p>;

  const cambiar = (cambio: Partial<Formulario>) => { setP((x) => x && { ...x, ...cambio }); setCambios(true); };
  const campo = (k: CampoTexto) => ({
    name: k,
    value: p[k],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => cambiar({ [k]: e.target.value } as Partial<Formulario>),
  });
  const pw = p.precio_web;
  const precioWeb = (cambio: Partial<Formulario["precio_web"]>) => cambiar({ precio_web: { ...pw, ...cambio } });
  const ambientes = categorias.filter((c) => c.padre_id === null);
  const tipos = categorias.filter((c) => c.padre_id === +p.ambiente_id).map((c) => c.nombre);
  const caracteristicas = p.caracteristicas.split("\n").map((s) => s.trim()).filter(Boolean);
  // Lo mismo con números: para la vista previa, el mensaje de WhatsApp y lo que se manda a la API.
  const vista = {
    nombre: p.nombre, detalle_medidas: p.detalle_medidas, texto_medidas: p.texto_medidas,
    ancho_cm: entero(p.ancho_cm), alto_cm: entero(p.alto_cm), profundidad_cm: entero(p.profundidad_cm), diametro_cm: entero(p.diametro_cm),
  };

  async function subirArchivos(archivos: FileList, alSubir: (url: string) => void) {
    const lista = [...archivos];
    for (const [i, archivo] of lista.entries()) {
      try {
        alSubir(await subir(archivo, (x) => setSubiendo(`Subiendo ${archivo.name}${lista.length > 1 ? ` (${i + 1} de ${lista.length})` : ""}: ${Math.round(x * 100)} %`)));
      } catch (e) {
        avisar(`No se subió ${archivo.name}: ${(e as Error).message}`, { tono: "bad", ms: 6000 });
      }
    }
    setSubiendo("");
  }
  const moverFoto = (de: number, a: number) => {
    const fotos = [...p.fotos];
    fotos.splice(a, 0, ...fotos.splice(de, 1));
    cambiar({ fotos });
  };

  async function guardar() {
    if (!p) return;
    if (!p.nombre.trim() || !p.tipo.trim()) return avisar("Completá el nombre y el tipo de mueble.", { tono: "bad" });
    if (pw.tipo_precio && !parseArs(pw.monto)) return avisar("Poné el monto del precio de la web, o elegí “Sin precio”.", { tono: "bad" });
    if (!p.fotos.length && p.visible) avisar("Ojo: el modelo está visible y no tiene fotos.");
    const cuerpo: ProductoGuardar = {
      ...vista,
      id,
      ambiente_id: +p.ambiente_id,
      tipo: p.tipo,
      codigo: p.codigo,
      descripcion_corta: p.descripcion_corta,
      variante: p.variante,
      caracteristicas,
      nota: p.nota,
      mensaje_whatsapp: p.mensaje_whatsapp,
      visible: p.visible,
      destacado: p.destacado,
      url_video: p.url_video,
      fotos: p.fotos,
      precio_web: pw.tipo_precio ? { tipo_precio: pw.tipo_precio, monto: parseArs(pw.monto), monto_hasta: pw.tipo_precio === "rango" ? parseArs(pw.monto_hasta) : null } : null,
      precio_local: parseArs(p.precio_local) || null,
    };
    setGuardando(true);
    try {
      const r = await api("producto/guardar", { body: cuerpo });
      setCambios(false);
      avisar(id ? "Cambios guardados" : "Modelo creado");
      if (!id) router.replace(`/admin/catalogo/editar/?id=${r.id}`);
      else api("producto", { query: { id: String(id) } }).then((x) => setGuardado(x.producto));
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
    }
    setGuardando(false);
  }

  const chips = (caracteristicas.length ? caracteristicas : p.nota ? [p.nota] : []).slice(0, 2);
  const textoPrecio = !pw.tipo_precio ? "" : pw.tipo_precio === "rango" ? `$ ${pw.monto} a $ ${pw.monto_hasta}` : `${pw.tipo_precio === "desde" ? "Desde " : ""}$ ${pw.monto}`;
  const titulo = id ? guardado?.nombre ?? "Modelo" : "Nuevo modelo";

  return (
    <>
      <title>{`${titulo} · La Unión`}</title>
      <div className="crumb"><Link href="/admin/catalogo/">Catálogo</Link><Icono n="right" /><span>{titulo}</span></div>
      <div className="page-head">
        <div><h1>{titulo}</h1>{guardado?.actualizado_en && <p>Última modificación: {fechaHora(guardado.actualizado_en)}</p>}</div>
        <div className="row">
          <Link className="btn" href="/admin/catalogo/">{cambios ? "Cancelar" : "Volver"}</Link>
          <button className="btn btn-primary" type="button" onClick={guardar} disabled={guardando || !!subiendo}><Icono n="check" />{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>

      <form className="cat-form" noValidate onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <div className="stack">
          <section className="card card-pad stack">
            <div className="row" style={{ gap: 20 }}>
              <label className="switch"><input type="checkbox" checked={p.visible} onChange={(e) => cambiar({ visible: e.target.checked })} />Visible en la web</label>
              <label className="switch"><input type="checkbox" checked={p.destacado} onChange={(e) => cambiar({ destacado: e.target.checked })} />Destacado en la home</label>
            </div>
            <label className="field"><span>Nombre *</span><input className="input" required {...campo("nombre")} /></label>
            <div className="grid-2">
              <label className="field"><span>Ambiente *</span>
                <select className="select" {...campo("ambiente_id")}>{ambientes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
              </label>
              <label className="field"><span>Tipo de mueble *</span>
                <input className="input" list="tipos" placeholder="Ej: Cómodas" required {...campo("tipo")} />
                <datalist id="tipos">{tipos.map((t) => <option key={t} value={t} />)}</datalist>
              </label>
            </div>
            <label className="field"><span>Frase corta</span><input className="input" placeholder="Ej: Para exhibir golosinas a la vista" {...campo("descripcion_corta")} /><small>Se muestra debajo del nombre en la web. Hablale al cliente: para qué le sirve.</small></label>
            <label className="field"><span>Etiqueta de la foto (opcional)</span><input className="input" placeholder="Ej: Luz LED en el marco" {...campo("variante")} /><small>Vacío = se muestra el tipo.</small></label>
          </section>

          <section className="card card-pad stack">
            <h2>Medidas</h2>
            <div className="grid-4">
              <label className="field"><span>Ancho (cm)</span><input className="input" inputMode="numeric" {...campo("ancho_cm")} /></label>
              <label className="field"><span>Alto (cm)</span><input className="input" inputMode="numeric" {...campo("alto_cm")} /></label>
              <label className="field"><span>Profundidad (cm)</span><input className="input" inputMode="numeric" {...campo("profundidad_cm")} /></label>
              <label className="field"><span>Diámetro (cm)</span><input className="input" inputMode="numeric" {...campo("diametro_cm")} /></label>
            </div>
            <label className="field"><span>Detalle de medidas (opcional)</span><input className="input" placeholder="Ej: 1 cajón con corredera telescópica" {...campo("detalle_medidas")} /></label>
            <label className="field"><span>Si no tiene medidas fijas</span><input className="input" placeholder="Ej: Medidas a consultar" {...campo("texto_medidas")} /></label>
          </section>

          <section className="card card-pad stack">
            <h2>Características y precio</h2>
            <label className="field"><span>Características (una por línea)</span><textarea className="textarea" rows={4} placeholder={"4 cajones con correderas telescópicas\nPatas regulables"} {...campo("caracteristicas")} /><small>Las dos primeras aparecen como etiquetas en la tarjeta del celular.</small></label>
            <label className="field"><span>Nota (opcional)</span><input className="input" placeholder="Ej: colores a elección" {...campo("nota")} /></label>
            <label className="field" style={{ maxWidth: 280 }}><span>Código de producto (opcional)</span><input className="input" {...campo("codigo")} /></label>
            <div className="grid-3">
              <label className="field"><span>Precio en la web</span>
                <select className="select" value={pw.tipo_precio} onChange={(e) => precioWeb({ tipo_precio: e.target.value as TipoPrecio | "" })}>
                  <option value="">Sin precio (“Consultar”)</option><option value="fijo">Precio fijo</option><option value="desde">Desde…</option><option value="rango">Rango (de… a…)</option>
                </select>
              </label>
              {pw.tipo_precio && (
                <label className="field"><span>{pw.tipo_precio === "fijo" ? "Precio" : "Desde"}</span>
                  <span className="input-money"><span>$</span><input inputMode="numeric" value={pw.monto} onChange={(e) => precioWeb({ monto: e.target.value })} /></span></label>
              )}
              {pw.tipo_precio === "rango" && (
                <label className="field"><span>Hasta</span>
                  <span className="input-money"><span>$</span><input inputMode="numeric" value={pw.monto_hasta} onChange={(e) => precioWeb({ monto_hasta: e.target.value })} /></span></label>
              )}
            </div>
            {puede("precios.ver") && (
              <label className="field" style={{ maxWidth: 280 }}><span>Precio del local (interno)</span>
                <span className="input-money"><span>$</span><input inputMode="numeric" {...campo("precio_local")} /></span>
                <small>Lo ven administradores y vendedores. No aparece en la web ni en el taller.</small></label>
            )}
          </section>

          {guardado && (
            <section className="card card-pad stack">
              <div className="spread"><h2>Presupuestos de fabricación</h2>
                <Link className="btn btn-sm" href={`/admin/presupuestos/editar/?producto=${guardado.id}`}><Icono n="plus" />Nuevo presupuesto</Link></div>
              {guardado.presupuestos.length ? guardado.presupuestos.map((x) => (
                <div key={x.id} className="spread small">
                  <Link href={`/admin/presupuestos/editar/?id=${x.id}`}>{x.nombre}</Link>
                  <span className="tnum">Costo {ars(x.costo)} · Precio <b>{ars(x.precio_final ?? precioPresupuesto(x.costo, x.multiplicador))}</b></span>
                </div>
              )) : <p className="small muted">Ninguno. Para vincular uno que ya existe, abrilo y elegí este modelo en “Modelo del catálogo”.</p>}
            </section>
          )}
        </div>

        <div className="stack">
          <section className="card card-pad stack">
            <div className="spread"><h2>Fotos</h2><span className="small muted">La primera es la principal. Arrastrá para ordenar.</span></div>
            <div className="photo-grid">
              {p.fotos.map((x, i) => (
                <div key={x} className={`ph ${i === 0 ? "first" : ""}`} draggable onDragStart={() => setArrastrada(i)} onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (arrastrada !== null && arrastrada !== i) moverFoto(arrastrada, i); setArrastrada(null); }}>
                  <img src={media(x)} alt={`Foto ${i + 1}`} />
                  {i === 0 && <span className="tag">Principal</span>}
                  <div className="tools">
                    {i > 0 && <button type="button" title="Hacer principal" aria-label="Hacer principal" onClick={() => moverFoto(i, 0)}><Icono n="up" /></button>}
                    <button type="button" title="Quitar" aria-label="Quitar foto" onClick={() => cambiar({ fotos: p.fotos.filter((_, j) => j !== i) })}><Icono n="trash" /></button>
                  </div>
                </div>
              ))}
              <label className="add" style={{ cursor: "pointer" }}><Icono n="upload" /><span>Subir fotos</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => {
                  if (e.target.files) subirArchivos(e.target.files, (url) => { setP((x) => x && { ...x, fotos: [...x.fotos, url] }); setCambios(true); });
                  e.target.value = "";
                }} />
              </label>
            </div>
            <div className="field"><span>Video (opcional)</span>
              {p.url_video ? (
                <div className="row">
                  <video src={media(p.url_video)} controls preload="metadata" style={{ width: 160, borderRadius: 10, background: "#000" }} />
                  <button type="button" className="btn btn-sm" onClick={() => cambiar({ url_video: "" })}><Icono n="trash" />Quitar video</button>
                </div>
              ) : (
                <label className="btn btn-sm" style={{ justifySelf: "start", cursor: "pointer" }}><Icono n="upload" />Subir video
                  <input type="file" accept="video/mp4,video/webm" hidden onChange={(e) => {
                    if (e.target.files) subirArchivos(e.target.files, (url) => cambiar({ url_video: url }));
                    e.target.value = "";
                  }} />
                </label>
              )}
              <small>MP4 o WebM, hasta 100 MB (mejor menos de 20 MB: se ve desde el celular). Se muestra después de la primera foto.</small>
            </div>
            {subiendo && <p className="small" role="status">{subiendo}</p>}
          </section>

          <section className="card card-pad stack">
            <h2>Mensaje de WhatsApp</h2>
            <label className="field"><span className="sr">Mensaje de WhatsApp</span>
              <textarea className="textarea" rows={3} placeholder={mensajeWhatsapp(vista)} {...campo("mensaje_whatsapp")} />
              <small>Vacío = se arma solo con el nombre y las medidas (como el ejemplo gris). Si cambiás el nombre, borralo para que se regenere.</small>
            </label>
          </section>

          <section className="card card-pad stack">
            <h2>Así se ve en el celular</h2>
            <div className="preview-card">
              {p.fotos[0] ? <img src={media(p.fotos[0])} alt="" />
                : <div style={{ aspectRatio: "3/4", borderRadius: 12, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--faint)" }}><Icono n="image" /></div>}
              <div className="stack-sm" style={{ alignContent: "center" }}>
                <h4>{p.nombre || "Nombre del modelo"}</h4>
                <span className="small muted">{p.descripcion_corta || "Frase corta"}</span>
                <span className="small tnum">{medidas(vista) || "Medidas"}</span>
                {chips.length > 0 && <div className="row">{chips.map((c) => <span key={c} className="badge plain">{c}</span>)}</div>}
                {textoPrecio && <b className="small">{textoPrecio}</b>}
                <span className="btn btn-primary btn-sm" style={{ pointerEvents: "none" }}>Consultar</span>
              </div>
            </div>
            {!p.visible && <p className="small muted"><Icono n="eyeoff" /> Oculto: no aparece en la web hasta que lo actives.</p>}
          </section>
        </div>
      </form>
    </>
  );
}
