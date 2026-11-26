"use client";
// Colores de la web: los que están en stock se ven en la página Colores y en "Elegí el color" del inicio, en el orden de esta grilla.
// El stock y el orden se guardan al instante. La web no nombra a los proveedores: el código es solo para pedirlo.
import { useEffect, useRef, useState } from "react";
import { api, media, subir } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import type { Color, Respuestas } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { Modal } from "@/components/Modal";
import { useAviso } from "@/components/Avisos";

type Datos = Respuestas["colores"];
const NUEVO: Color = { id: 0, nombre: "", material_id: null, textura: null, codigo: null, descripcion: null, muestra: null, fotos: [], visible: 1 };

export default function Colores() {
  const { puede } = useSesion();
  const avisar = useAviso();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [editar, setEditar] = useState<Color | null>(null);
  const [arrastrado, setArrastrado] = useState<number | null>(null);
  const cola = useRef<Promise<unknown>>(Promise.resolve()); // el orden se guarda de a uno: el último cambio es el que queda

  const cargar = () => api("colores").then(setDatos, (e: Error) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  if (!puede("catalogo.editar")) return <div className="empty card"><h2>Tu usuario no puede editar los colores</h2></div>;
  if (error) return <div className="empty card"><h2>{error}</h2></div>;
  if (!datos) return <p className="muted">Cargando…</p>;

  const { colores, materiales } = datos;
  const material = new Map(materiales.map((m) => [m.id, m.nombre]));
  // Cambio al instante en la pantalla; si el servidor no lo acepta, se avisa y se recarga lo guardado.
  const fallo = (e: Error) => { avisar(`No se guardó: ${e.message}`, { tono: "bad", ms: 6000 }); cargar(); };

  const enStock = (c: Color, si: boolean) => {
    setDatos({ ...datos, colores: colores.map((x) => (x.id === c.id ? { ...x, visible: si ? 1 : 0 } : x)) });
    api("color/estado", { body: { id: c.id, visible: si ? 1 : 0 } }).then(() => avisar(si ? `${c.nombre}: en stock, se ve en la web` : `${c.nombre}: sin stock, no se ve en la web`), fallo);
  };
  const mover = (de: number, a: number) => {
    if (a === de) return;
    const lista = [...colores];
    lista.splice(a, 0, ...lista.splice(de, 1));
    setDatos({ ...datos, colores: lista });
    const ids = lista.map((x) => x.id);
    cola.current = cola.current.then(() => api("colores/orden", { body: { ids } })).catch(fallo);
  };

  return (
    <>
      <title>Colores · La Unión</title>
      <div className="page-head">
        <div>
          <h1>Colores</h1>
          <p>Los que están en stock se ven en la web, en este orden: los primeros también salen en el inicio. Arrastrá o usá las flechas para ordenar.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setEditar(NUEVO)}><Icono n="plus" />Nuevo color</button>
      </div>
      <p className="small muted" style={{ marginBottom: 12 }}>{colores.filter((c) => c.visible).length} en stock de {colores.length}</p>

      <div className="photo-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
        {colores.map((c, i) => (
          <div key={c.id} className="stack-sm" draggable style={{ cursor: "grab" }} onDragStart={() => setArrastrado(i)} onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (arrastrado !== null) mover(arrastrado, i); setArrastrado(null); }}>
            <div className="ph" style={{ aspectRatio: "1", opacity: c.visible ? 1 : 0.4 }}>
              {c.muestra ? <img src={media(c.muestra)} alt="" loading="lazy" draggable={false} />
                : <span style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--warn)" }}><Icono n="image" /></span>}
              <span className="tag tnum">{i + 1}</span>
              <div className="tools">
                {i > 0 && <button type="button" title="Antes" aria-label={`Poner ${c.nombre} antes`} onClick={() => mover(i, i - 1)}><Icono n="left" /></button>}
                {i < colores.length - 1 && <button type="button" title="Después" aria-label={`Poner ${c.nombre} después`} onClick={() => mover(i, i + 1)}><Icono n="right" /></button>}
                <button type="button" title="Editar" aria-label={`Editar ${c.nombre}`} onClick={() => setEditar(c)}><Icono n="edit" /></button>
              </div>
            </div>
            <span>
              <span className="cell-title">{c.nombre}</span>
              <span className="cell-sub">{[c.material_id && material.get(c.material_id), c.textura].filter(Boolean).join(" · ")}</span>
            </span>
            <label className="switch"><input type="checkbox" checked={!!c.visible} onChange={(e) => enStock(c, e.target.checked)} />En stock</label>
          </div>
        ))}
      </div>

      {editar && (
        <EditarColor color={editar} datos={datos} alCerrar={() => setEditar(null)}
          alGuardar={(r) => { setDatos(r); setEditar(null); avisar(editar.id ? "Color guardado" : "Color agregado: quedó primero"); }} />
      )}
    </>
  );
}

function EditarColor({ color, datos, alGuardar, alCerrar }: { color: Color; datos: Datos; alGuardar: (r: Datos) => void; alCerrar: () => void }) {
  const avisar = useAviso();
  const [c, setC] = useState(color);
  const [subiendo, setSubiendo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const cambiar = (x: Partial<Color>) => setC((v) => ({ ...v, ...x }));
  const texturas = [...new Set(datos.colores.map((x) => x.textura).filter(Boolean))];

  async function subirFotos(archivos: FileList, alSubir: (url: string) => void) {
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

  async function guardar() {
    if (!c.nombre.trim()) return avisar("Poné el nombre del color.", { tono: "bad" });
    if (!c.muestra && c.visible) avisar("Ojo: el color está en stock y no tiene la foto de la muestra.");
    setGuardando(true);
    try {
      alGuardar(await api("color/guardar", { body: { ...c, id: c.id || undefined, visible: !!c.visible } }));
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={color.id ? color.nombre : "Nuevo color"} ancho alCerrar={alCerrar}
      pie={<><button className="btn" type="button" onClick={alCerrar}>Cancelar</button>
        <button className="btn btn-primary" type="button" disabled={guardando || !!subiendo} onClick={guardar}><Icono n="check" />{guardando ? "Guardando…" : "Guardar"}</button></>}>
      <div className="cat-form">
        <div className="stack">
          <label className="field"><span>Nombre *</span><input className="input" value={c.nombre} required onChange={(e) => cambiar({ nombre: e.target.value })} /></label>
          <div className="grid-2">
            <label className="field"><span>Material (opcional)</span>
              <select className="select" value={c.material_id ?? ""} onChange={(e) => cambiar({ material_id: +e.target.value || null })}>
                <option value="">—</option>
                {datos.materiales.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </label>
            <label className="field"><span>Textura (opcional)</span>
              <input className="input" list="texturas" placeholder="Supermate, Hilado…" value={c.textura ?? ""} onChange={(e) => cambiar({ textura: e.target.value })} />
              <datalist id="texturas">{texturas.map((t) => <option key={t} value={t ?? ""} />)}</datalist>
            </label>
          </div>
          <label className="field"><span>Código para pedirlo (opcional, no se ve en la web)</span>
            <input className="input" value={c.codigo ?? ""} onChange={(e) => cambiar({ codigo: e.target.value })} />
          </label>
          <label className="field"><span>Descripción (opcional)</span>
            <textarea className="textarea" rows={3} placeholder="Texto que muestra la web en el detalle del color" value={c.descripcion ?? ""} onChange={(e) => cambiar({ descripcion: e.target.value })} />
          </label>
          <label className="check"><input type="checkbox" checked={!!c.visible} onChange={(e) => cambiar({ visible: e.target.checked ? 1 : 0 })} />En stock: se ve en la web</label>
        </div>

        <div className="stack">
          <div className="field"><span>Foto de la muestra</span>
            <label className="photo-pick">
              {c.muestra ? <img src={media(c.muestra)} alt="Muestra" /> : <><Icono n="upload" /><span>Subir la foto de la textura</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
                if (e.target.files?.length) subirFotos(e.target.files, (url) => cambiar({ muestra: url }));
                e.target.value = "";
              }} />
            </label>
          </div>
          <div className="field"><span>Fotos en ambientes (opcional)</span>
            <div className="photo-grid">
              {c.fotos.map((x, i) => (
                <div key={x} className="ph">
                  <img src={media(x)} alt={`Foto ${i + 1}`} />
                  <div className="tools"><button type="button" title="Quitar" aria-label="Quitar foto" onClick={() => cambiar({ fotos: c.fotos.filter((_, j) => j !== i) })}><Icono n="trash" /></button></div>
                </div>
              ))}
              <label className="add"><Icono n="upload" /><span>Subir fotos</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => {
                  if (e.target.files?.length) subirFotos(e.target.files, (url) => setC((v) => ({ ...v, fotos: [...v.fotos, url] })));
                  e.target.value = "";
                }} />
              </label>
            </div>
          </div>
          {subiendo && <p className="small muted">{subiendo}</p>}
        </div>
      </div>
    </Modal>
  );
}
