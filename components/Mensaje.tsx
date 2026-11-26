"use client";
// Botón verde de WhatsApp de un modelo del catálogo, un presupuesto, una venta o un cliente: elige una plantilla (pestaña
// Plantillas; solo las que se completan ahí), la completa con sus datos, y el mensaje se puede retocar antes de copiarlo o
// abrirlo en WhatsApp: con el teléfono del cliente abre su chat, y si no, el contacto se elige ahí.
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, media, webPublica } from "@/lib/api";
import { ars, medidas, precioPresupuesto } from "@/lib/formato";
import { armarMensaje, LUGARES, sirve, type Donde, type Valores } from "@/lib/plantillas";
import { useSesion } from "@/lib/sesion";
import type { Categoria, Plantilla, PresupuestoFila, Producto } from "@/lib/tipos";
import { precioTexto } from "@/lib/web";
import { Icono } from "./Icono";
import { Modal } from "./Modal";
import { useAviso } from "./Avisos";

const ULTIMA = "lu-plantilla"; // la última plantilla usada: la próxima vez arranca con esa
const linkFoto = (url: string) => new URL(media(url), location.href).href; // la dirección completa: WhatsApp muestra la foto
const cm = (n: number | null) => (n ? `${n} cm` : null);

/** Las variables de un modelo del catálogo. Sin categorías, sin {link}. */
export function valoresModelo(p: Producto, categorias: Categoria[]): Valores {
  const tipo = categorias.find((c) => c.id === p.categoria_id); // categoria_id es el tipo; su padre, el ambiente
  const ambiente = tipo && categorias.find((c) => c.id === tipo.padre_id);
  return {
    nombre: p.nombre,
    medidas: [medidas(p), p.detalle_medidas].filter(Boolean).join(" · "), // "80 × 160 × 40 cm · maquillador 100"
    ancho: cm(p.ancho_cm),
    alto: cm(p.alto_cm),
    profundidad: cm(p.profundidad_cm),
    precio: precioTexto(p.precio_web),
    precio_local: p.precio_local && ars(p.precio_local),
    codigo: p.codigo,
    tipo: p.tipo,
    descripcion: p.descripcion_corta,
    caracteristicas: p.caracteristicas,
    foto: p.fotos[0] ? linkFoto(p.fotos[0]) : null,
    link: ambiente ? `${webPublica()}?catalogo=${ambiente.slug}&tipo=${tipo.slug}` : null, // la web no tiene link a un modelo solo
  };
}

/** Las de un presupuesto: su nombre, su precio (el final, o costo × multiplicador) y su foto; lo demás, del modelo vinculado. */
export async function valoresPresupuesto(p: PresupuestoFila): Promise<Valores> {
  const modelo = p.producto_id ? (await api("producto", { query: { id: String(p.producto_id) } })).producto : null;
  return {
    ...(modelo && valoresModelo(modelo, [])),
    nombre: p.nombre,
    precio: ars(p.precio_final ?? precioPresupuesto(p.costo, p.multiplicador)),
    precio_local: null,
    foto: p.foto ? linkFoto(p.foto) : null,
  };
}

/** telefono: el del cliente (5493813196842), para abrir su chat. solo: el ícono, para las listas. */
export function BotonMensaje({ valores, donde = "modelo", telefono, solo = false }:
  { valores: () => Valores | Promise<Valores>; donde?: Donde; telefono?: string; solo?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      {solo
        ? <button className="btn btn-sm btn-wa solo" type="button" title="Mandar por WhatsApp" aria-label="Mandar por WhatsApp" onClick={() => setAbierto(true)}><Icono n="whatsapp" /></button>
        : <button className="btn btn-wa" type="button" onClick={() => setAbierto(true)}><Icono n="whatsapp" /><span className="hide-s">Mensaje</span></button>}
      {/* Afuera de la tabla: adentro de una celda heredaría su alineación */}
      {abierto && createPortal(<VentanaMensaje valores={valores} donde={donde} telefono={telefono} alCerrar={() => setAbierto(false)} />, document.body)}
    </>
  );
}

function VentanaMensaje({ valores, donde, telefono, alCerrar }:
  { valores: () => Valores | Promise<Valores>; donde: Donde; telefono?: string; alCerrar: () => void }) {
  const { usuario, puede } = useSesion();
  const avisar = useAviso();
  const [datos, setDatos] = useState<{ plantillas: Plantilla[]; valores: Valores } | null>(null);
  const [error, setError] = useState("");
  const [elegida, setElegida] = useState<number | null>(null);
  const [texto, setTexto] = useState("");

  const usar = (pl: Plantilla, v: Valores) => {
    setElegida(pl.id);
    setTexto(armarMensaje(pl.texto, { ...v, vendedor: usuario?.nombre }));
    try { localStorage.setItem(ULTIMA, String(pl.id)); } catch {}
  };
  useEffect(() => {
    Promise.all([api("plantillas"), valores()]).then(([r, v]) => {
      const lista = r.plantillas.filter((x) => sirve(x.texto, donde));
      setDatos({ plantillas: lista, valores: v });
      let ultima: string | null = null;
      try { ultima = localStorage.getItem(ULTIMA); } catch {}
      const pl = lista.find((x) => String(x.id) === ultima) ?? lista[0];
      if (pl) usar(pl, v);
    }, (e: Error) => setError(e.message));
  }, []);

  const copiar = () => Promise.resolve().then(() => navigator.clipboard.writeText(texto)).then(
    () => avisar("Mensaje copiado"),
    () => avisar("No se pudo copiar: seleccioná el texto y copialo a mano.", { tono: "bad" })
  );

  return (
    <Modal titulo="Mensaje por WhatsApp" alCerrar={alCerrar}
      pie={texto && <>
        <button className="btn" type="button" onClick={copiar}><Icono n="copy" />Copiar</button>
        <a className="btn btn-wa" href={`https://wa.me/${telefono ?? ""}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener"><Icono n="whatsapp" />Abrir WhatsApp</a>
      </>}>
      {error ? <p>{error}</p> : !datos ? <p className="muted">Cargando…</p> : !datos.plantillas.length ? (
        <div className="stack">
          <p className="muted">Todavía no hay plantillas para {LUGARES[donde]}.</p>
          {puede("catalogo.editar") && <Link className="btn" href="/admin/plantillas/" style={{ justifySelf: "start" }}><Icono n="plus" />Crear una plantilla</Link>}
        </div>
      ) : (
        <div className="stack">
          <div className="chips" role="group" aria-label="Plantillas">
            {datos.plantillas.map((pl) => <button key={pl.id} type="button" className="chip" aria-pressed={elegida === pl.id} onClick={() => usar(pl, datos.valores)}>{pl.nombre}</button>)}
          </div>
          <label className="field"><span>Mensaje</span>
            <textarea className="textarea" rows={12} value={texto} onChange={(e) => setTexto(e.target.value)} />
            <small>Podés cambiarlo antes de mandarlo. {telefono ? "WhatsApp abre el chat del cliente." : "Al abrir WhatsApp, elegís a quién."}</small>
          </label>
        </div>
      )}
    </Modal>
  );
}
