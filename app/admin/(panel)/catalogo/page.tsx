"use client";
// Catálogo: buscar, filtrar, mostrar u ocultar en la web, eliminar y restaurar. Tocar un modelo lo abre para editar.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, media } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, medidas, norm } from "@/lib/formato";
import type { Pedidos, Producto, ProductoFila, Respuestas } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { Modal } from "@/components/Modal";
import { useAviso } from "@/components/Avisos";

const PAGINA = 40;
const FILTROS = "lu-catalogo-filtros"; // se guardan al ir a editar un modelo y volver

interface Filtros {
  q: string;
  ambiente: string; // id del ambiente, "" = todos
  tipo: string;
  vis: "" | "1" | "0" | "nofoto";
  eliminados: boolean;
}
const SIN_FILTROS: Filtros = { q: "", ambiente: "", tipo: "", vis: "", eliminados: false };

type CambioEstado = Omit<Pedidos["producto/estado"], "id">;

export default function Catalogo() {
  const { puede } = useSesion();
  const avisar = useAviso();
  const router = useRouter();
  const editar = puede("catalogo.editar");
  const precios = puede("precios.ver");
  const [datos, setDatos] = useState<Respuestas["catalogo"] | null>(null);
  const [error, setError] = useState("");
  const [f, setF] = useState<Filtros>(SIN_FILTROS);
  const [mostrar, setMostrar] = useState(PAGINA);
  const [aEliminar, setAEliminar] = useState<ProductoFila | null>(null);
  const [aVer, setAVer] = useState<ProductoFila | null>(null);

  const cargar = () => api("catalogo").then(setDatos, (e: Error) => setError(e.message));
  useEffect(() => {
    try { setF({ ...SIN_FILTROS, ...JSON.parse(sessionStorage.getItem(FILTROS) || "{}") }); } catch {}
    cargar();
  }, []);
  const filtrar = (cambio: Partial<Filtros>) => {
    const nuevo = { ...f, ...cambio };
    setF(nuevo);
    setMostrar(PAGINA);
    try { sessionStorage.setItem(FILTROS, JSON.stringify(nuevo)); } catch {}
  };

  const categorias = datos?.categorias ?? [];
  const cat = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const ambientes = categorias.filter((c) => c.padre_id === null);
  const ambienteDe = (p: ProductoFila) => cat.get(p.categoria_id)?.padre_id ?? p.categoria_id;
  const tipoDe = (p: ProductoFila) => (cat.get(p.categoria_id)?.padre_id ? cat.get(p.categoria_id)!.nombre : "");
  const tipos = [...new Set(categorias.filter((c) => c.padre_id !== null && (!f.ambiente || c.padre_id === +f.ambiente)).map((c) => c.nombre))];

  const lista = useMemo(() => {
    if (!datos) return [];
    const q = norm(f.q.trim());
    return datos.productos.filter((p) =>
      !!p.eliminado === f.eliminados &&
      (!f.ambiente || ambienteDe(p) === +f.ambiente) &&
      (!f.tipo || tipoDe(p) === f.tipo) &&
      (f.vis === "" || (f.vis === "nofoto" ? !p.fotos : String(p.visible) === f.vis)) &&
      (!q || q.split(/\s+/).every((t) => norm(`${p.nombre} ${tipoDe(p)} ${p.codigo || ""}`).includes(t)))
    );
  }, [datos, f, cat]);

  // Cambio al instante en la pantalla; si el servidor no lo acepta, se avisa y se recarga lo que hay guardado.
  function cambiarEstado(p: ProductoFila, cambio: CambioEstado, texto: string) {
    setDatos((d) => d && { ...d, productos: d.productos.map((x) => (x.id === p.id ? { ...x, ...cambio } : x)) });
    api("producto/estado", { body: { id: p.id, ...cambio } }).then(
      () => avisar(texto),
      (e: Error) => { avisar(`No se guardó: ${e.message}`, { tono: "bad", ms: 6000 }); cargar(); }
    );
  }
  const abrir = (p: ProductoFila) => (editar ? router.push(`/admin/catalogo/editar/?id=${p.id}`) : setAVer(p));

  return (
    <>
      <title>Catálogo · La Unión</title>
      <div className="page-head">
        <div><h1>Catálogo</h1><p>{editar ? "Lo que cambies acá es lo que va a mostrar la web pública." : "Consultá modelos, medidas y fotos."}</p></div>
        {editar && <Link className="btn btn-primary" href="/admin/catalogo/editar/"><Icono n="plus" />Nuevo modelo</Link>}
      </div>

      <div className="card card-pad" style={{ marginBottom: 14, padding: 12 }}>
        <div className="row">
          <label className="gsearch grow" style={{ width: "auto", minWidth: 220 }}><Icono n="search" /><span className="sr">Buscar modelos</span>
            <input type="search" placeholder="Buscar por nombre, tipo o código" value={f.q} onChange={(e) => filtrar({ q: e.target.value })} />
          </label>
          <select className="select" style={{ width: "auto" }} aria-label="Ambiente" value={f.ambiente} onChange={(e) => filtrar({ ambiente: e.target.value, tipo: "" })}>
            <option value="">Todos los ambientes</option>
            {ambientes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <select className="select" style={{ width: "auto" }} aria-label="Tipo" value={f.tipo} onChange={(e) => filtrar({ tipo: e.target.value })}>
            <option value="">Todos los tipos</option>
            {tipos.map((t) => <option key={t}>{t}</option>)}
          </select>
          {editar && (
            <>
              <select className="select" style={{ width: "auto" }} aria-label="Visibilidad" value={f.vis} onChange={(e) => filtrar({ vis: e.target.value as Filtros["vis"] })}>
                <option value="">Visibles y ocultos</option><option value="1">Solo visibles</option><option value="0">Solo ocultos</option><option value="nofoto">Sin fotos</option>
              </select>
              <label className="check"><input type="checkbox" checked={f.eliminados} onChange={(e) => filtrar({ eliminados: e.target.checked })} />Ver eliminados</label>
            </>
          )}
          {datos && <span className="small muted">{lista.length} {lista.length === 1 ? "modelo" : "modelos"}{f.eliminados ? " eliminados" : ""}</span>}
        </div>
      </div>

      <div className="card">
        {error ? <div className="empty"><Icono n="alert" /><p>No se pudo cargar el catálogo: {error}</p><button className="btn" onClick={() => { setError(""); cargar(); }}>Reintentar</button></div>
        : !datos ? <div className="empty"><p>Cargando…</p></div>
        : !lista.length ? <div className="empty"><Icono n="search" /><p>No hay modelos con estos filtros.</p></div>
        : (
          <div className="table-wrap"><table className="table cards">
            <thead><tr><th style={{ width: 56 }}></th><th>Modelo</th><th>Ambiente</th><th>Medidas</th><th>Fotos</th>{precios && <th>Precio local</th>}{editar && <th>En la web</th>}</tr></thead>
            <tbody>
              {lista.slice(0, mostrar).map((p) => (
                <tr key={p.id} className={p.eliminado ? "" : "click"} onClick={() => !p.eliminado && abrir(p)}>
                  <td className="hide-m">{p.foto ? <img className="thumb" src={media(p.foto)} alt="" loading="lazy" /> : <span className="thumb" style={{ display: "grid", placeItems: "center", color: "var(--warn)" }}><Icono n="image" /></span>}</td>
                  <td className="full">
                    <span className="cell-title">{p.nombre}</span>
                    <span className="cell-sub">{tipoDe(p)}{p.codigo && ` · Cód. ${p.codigo}`}{p.destacado ? " · Destacado" : ""}{p.tiene_video ? " · Video" : ""}</span>
                  </td>
                  <td data-label="Ambiente"><span className="small">{cat.get(ambienteDe(p))?.nombre}</span></td>
                  <td data-label="Medidas"><span className="small tnum">{medidas(p)}</span></td>
                  <td data-label="Fotos">{p.fotos ? <span className="tnum">{p.fotos}</span> : <span className="badge warn">Sin fotos</span>}</td>
                  {precios && <td data-label="Precio local">{p.precio_local ? <span className="tnum">{ars(p.precio_local)}</span> : <span className="muted">—</span>}</td>}
                  {editar && (
                    <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                      {p.eliminado ? (
                        <button className="btn btn-sm" onClick={() => cambiarEstado(p, { eliminado: 0 }, "Modelo restaurado")}><Icono n="undo" />Restaurar</button>
                      ) : (
                        <span className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <label className="switch" title="Visible en la web">
                            <input type="checkbox" checked={!!p.visible} onChange={(e) => cambiarEstado(p, { visible: e.target.checked ? 1 : 0 }, e.target.checked ? "Visible en la web" : "Oculto en la web")} />
                            <span className="sr">Visible en la web</span>
                          </label>
                          <button className="icon-btn" type="button" title="Eliminar" aria-label={`Eliminar ${p.nombre}`} onClick={() => setAEliminar(p)}><Icono n="trash" /></button>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {lista.length > mostrar && (
        <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
          <button className="btn" onClick={() => setMostrar(mostrar + PAGINA)}>Ver más modelos ({lista.length - mostrar} más)</button>
        </div>
      )}

      {aEliminar && (
        <Modal titulo="Eliminar modelo" alCerrar={() => setAEliminar(null)}
          pie={<><button className="btn" type="button" onClick={() => setAEliminar(null)}>Cancelar</button>
            <button className="btn btn-dark" type="button" onClick={() => { cambiarEstado(aEliminar, { eliminado: 1 }, "Modelo eliminado"); setAEliminar(null); }}>Eliminar</button></>}>
          <p>¿Eliminar “{aEliminar.nombre}”? Deja de verse en la web. Se puede restaurar desde “Ver eliminados”.</p>
        </Modal>
      )}
      {aVer && <VerModelo fila={aVer} precios={precios} alCerrar={() => setAVer(null)} />}
    </>
  );
}

/** Para quien no edita el catálogo (taller, vendedores): la ficha del modelo. */
function VerModelo({ fila, precios, alCerrar }: { fila: ProductoFila; precios: boolean; alCerrar: () => void }) {
  const [p, setP] = useState<Producto | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api("producto", { query: { id: String(fila.id) } }).then((r) => setP(r.producto), (e: Error) => setError(e.message)); }, [fila.id]);
  return (
    <Modal titulo={fila.nombre} ancho alCerrar={alCerrar}>
      {error ? <p>{error}</p> : !p ? <p className="muted">Cargando…</p> : (
        <div className="cat-form">
          <div className="photo-grid">
            {p.fotos.length ? p.fotos.map((x) => <div className="ph" key={x}><img src={media(x)} alt="" /></div>) : <p className="muted">Sin fotos.</p>}
          </div>
          <dl className="specs">
            <dt>Tipo</dt><dd>{p.tipo}</dd>
            {p.descripcion_corta && <><dt>Para qué sirve</dt><dd>{p.descripcion_corta}</dd></>}
            <dt>Medidas</dt><dd>{medidas(p) || "—"}{p.detalle_medidas && ` · ${p.detalle_medidas}`}</dd>
            {p.caracteristicas.length > 0 && <><dt>Características</dt><dd>{p.caracteristicas.join(" · ")}</dd></>}
            {p.nota && <><dt>Nota</dt><dd>{p.nota}</dd></>}
            {p.codigo && <><dt>Código</dt><dd>{p.codigo}</dd></>}
            {precios && p.precio_local && <><dt>Precio del local</dt><dd className="tnum">{ars(p.precio_local)}</dd></>}
          </dl>
        </div>
      )}
    </Modal>
  );
}
