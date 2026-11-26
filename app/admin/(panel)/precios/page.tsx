"use client";
// Subir precios en bloque, por separado: modelos del catálogo (/admin/precios/) o presupuestos (?de=presupuestos).
// Se eligen con tildes ("Elegir todos" toma lo que se ve con el filtro), se pone un porcentaje y sube el precio final de todos.
// Modelos: el de la web y/o el del local, con historial. Presupuestos: el precio final (si no tenía, el calculado). Costos e insumos no cambian.
// La cuenta la hace la API (api/rutas/precios.php); acá se ve antes con la misma (subirPrecio).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, media } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, dec, norm, parseDec, precioPresupuesto, subirPrecio } from "@/lib/formato";
import { Icono } from "@/components/Icono";
import { Modal } from "@/components/Modal";
import { useAviso } from "@/components/Avisos";

type De = "modelos" | "presupuestos";
/** Un renglón: modelo o presupuesto. precios: [web, local] o [final]; null = no tiene en esa lista. */
interface Item { id: number; nombre: string; grupo: string; foto: string | null; precios: (number | null)[] }

export default function Pagina() {
  return <Suspense><Precios /></Suspense>;
}

function Precios() {
  const de: De = useSearchParams().get("de") === "presupuestos" ? "presupuestos" : "modelos";
  const { puede } = useSesion();
  const avisar = useAviso();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [grupo, setGrupo] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [redondear, setRedondear] = useState(true);
  const [listas, setListas] = useState({ web: true, local: true });
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    setItems(null);
    const pedido: Promise<Item[]> = de === "modelos"
      ? api("catalogo").then((c) => {
          const cat = new Map(c.categorias.map((x) => [x.id, x]));
          const ambiente = (id: number) => { const t = cat.get(id); return (t?.padre_id ? cat.get(t.padre_id) : t)?.nombre ?? ""; };
          return c.productos.filter((p) => !p.eliminado && (p.precio_web || p.precio_local)).map((p) => ({
            id: p.id, nombre: p.nombre, grupo: ambiente(p.categoria_id), foto: p.foto,
            precios: [p.precio_web ? Number(p.precio_web) : null, p.precio_local ? Number(p.precio_local) : null],
          }));
        })
      : api("presupuestos").then((r) => r.presupuestos.map((p) => ({
          id: p.id, nombre: p.nombre, grupo: p.grupo ?? "Sin grupo", foto: p.foto,
          precios: [p.precio_final != null ? Number(p.precio_final) : precioPresupuesto(p.costo, p.multiplicador)],
        })).filter((p) => (p.precios[0] ?? 0) > 0)); // sin insumos no hay precio que subir
    pedido.then(setItems, (e: Error) => setError(e.message));
  };
  useEffect(() => { setElegidos(new Set()); setQ(""); setGrupo(""); cargar(); }, [de]);

  if (!puede("catalogo.editar")) return <div className="empty card"><h2>Tu usuario no puede cambiar los precios</h2></div>;
  if (error) return <div className="empty card"><h2>{error}</h2></div>;

  const conLocal = puede("precios.ver");
  const columnas = de === "modelos"
    ? [{ titulo: "Precio web", activa: listas.web }, ...(conLocal ? [{ titulo: "Precio local", activa: listas.local }] : [])]
    : [{ titulo: "Precio final", activa: true }];
  const pct = parseDec(porcentaje) ?? NaN;
  const valido = Number.isFinite(pct) && pct !== 0 && pct > -100 && pct <= 1000;
  const lista = items ?? [];
  const grupos = [...new Set(lista.map((x) => x.grupo))];
  const palabras = norm(q.trim()).split(/\s+/).filter(Boolean);
  const vistos = lista.filter((x) => (!grupo || x.grupo === grupo) && palabras.every((w) => norm(x.nombre).includes(w)));
  const todos = vistos.length > 0 && vistos.every((x) => elegidos.has(x.id));
  const algunos = vistos.some((x) => elegidos.has(x.id));
  const fuera = [...elegidos].filter((id) => !vistos.some((x) => x.id === id)).length; // elegidos que el filtro esconde
  const n = elegidos.size;
  const elegir = (id: number, si: boolean) => setElegidos((s) => { const c = new Set(s); if (si) c.add(id); else c.delete(id); return c; });
  const elegirTodos = () => setElegidos((s) => { const c = new Set(s); for (const x of vistos) if (todos) c.delete(x.id); else c.add(x.id); return c; });
  const sinLista = de === "modelos" && !listas.web && !(conLocal && listas.local);
  const verbo = valido && pct < 0 ? "Bajar" : "Subir";
  const cuanto = valido ? `${dec(Math.abs(pct))} % (× ${dec(Math.round((1 + pct / 100) * 10000) / 10000)})` : "";
  const que = de === "modelos"
    ? `el precio ${[listas.web && "de la web", conLocal && listas.local && "del local"].filter(Boolean).join(" y el ")} de ${n} ${n === 1 ? "modelo" : "modelos"}`
    : `el precio final de ${n} ${n === 1 ? "presupuesto" : "presupuestos"}`;

  async function aplicar() {
    if (!valido) return;
    setGuardando(true);
    try {
      const ids = [...elegidos];
      const r = de === "modelos"
        ? await api("precios/modelos", { body: { ids, porcentaje: pct, redondear, listas: (["web", "local"] as const).filter((l) => listas[l]) } })
        : await api("precios/presupuestos", { body: { ids, porcentaje: pct, redondear } });
      avisar(`Listo: ${r.cambiados} ${r.cambiados === 1 ? "precio cambiado" : "precios cambiados"}`);
      setElegidos(new Set());
      setPorcentaje(""); // para no aplicarlo dos veces sin querer
      setConfirmar(false);
      cargar();
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
    }
    setGuardando(false);
  }

  return (
    <>
      <title>Subir precios · La Unión</title>
      <div className="crumb"><Link href={de === "modelos" ? "/admin/catalogo/" : "/admin/presupuestos/"}>{de === "modelos" ? "Catálogo" : "Presupuestos"}</Link><Icono n="right" /><span>Subir precios</span></div>
      <div className="page-head">
        <div><h1>Subir precios</h1><p>Elegí {de === "modelos" ? "los modelos" : "los presupuestos"} y el porcentaje: sube el precio final de todos. Los costos y los insumos no cambian.</p></div>
      </div>
      <nav className="tabs" aria-label="Qué precios">
        <Link href="/admin/precios/" aria-current={de === "modelos" ? "page" : undefined}>Modelos del catálogo</Link>
        <Link href="/admin/precios/?de=presupuestos" aria-current={de === "presupuestos" ? "page" : undefined}>Presupuestos</Link>
      </nav>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ alignItems: "flex-end", gap: 18 }}>
          <label className="field" style={{ width: 170 }}><span>Porcentaje *</span>
            <input className="input" inputMode="decimal" placeholder="Ej: 10" value={porcentaje} aria-invalid={porcentaje !== "" && !valido} onChange={(e) => setPorcentaje(e.target.value)} />
            <small>{valido ? `× ${dec(Math.round((1 + pct / 100) * 10000) / 10000)}` : "Para bajar, con menos: -5"}</small>
          </label>
          {de === "modelos" && (
            <div className="field"><span>Qué precio</span>
              <div className="row" style={{ minHeight: 40 }}>
                <label className="check"><input type="checkbox" checked={listas.web} onChange={(e) => setListas({ ...listas, web: e.target.checked })} />El de la web</label>
                {conLocal && <label className="check"><input type="checkbox" checked={listas.local} onChange={(e) => setListas({ ...listas, local: e.target.checked })} />El del local</label>}
              </div>
            </div>
          )}
          <label className="check" style={{ minHeight: 40 }}><input type="checkbox" checked={redondear} onChange={(e) => setRedondear(e.target.checked)} />Redondear para arriba a $ 1.000</label>
          <div className="grow" />
          <button className="btn btn-primary" type="button" disabled={!n || !valido || sinLista} onClick={() => setConfirmar(true)}>
            <Icono n="up" />{verbo} {n ? `${n} ${n === 1 ? "precio" : "precios"}` : "precios"}
          </button>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 14, padding: 12 }}>
        <div className="row">
          <label className="check"><input type="checkbox" checked={todos} disabled={!vistos.length} ref={(el) => { if (el) el.indeterminate = algunos && !todos; }} onChange={elegirTodos} />Elegir todos ({vistos.length})</label>
          <label className="gsearch grow" style={{ width: "auto", minWidth: 200 }}><Icono n="search" /><span className="sr">Buscar</span>
            <input type="search" placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="select" style={{ width: "auto" }} aria-label={de === "modelos" ? "Ambiente" : "Grupo"} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            <option value="">{de === "modelos" ? "Todos los ambientes" : "Todos los grupos"}</option>
            {grupos.map((g) => <option key={g}>{g}</option>)}
          </select>
          {n > 0 && <span className="small muted">{n} {n === 1 ? "elegido" : "elegidos"}{fuera > 0 && ` (${fuera} no se ${fuera === 1 ? "ve" : "ven"} con el filtro)`} · <button type="button" className="btn btn-sm btn-ghost" style={{ padding: "0 6px" }} onClick={() => setElegidos(new Set())}>Ninguno</button></span>}
        </div>
      </div>

      <div className="card">
        {!items ? <div className="empty"><p>Cargando…</p></div>
        : !lista.length ? <div className="empty"><p>{de === "modelos" ? "Ningún modelo tiene precio cargado." : "No hay presupuestos con precio."}</p></div>
        : !vistos.length ? <div className="empty"><Icono n="search" /><p>No hay {de === "modelos" ? "modelos" : "presupuestos"} con estos filtros.</p></div>
        : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th style={{ width: 44 }}></th><th>{de === "modelos" ? "Modelo" : "Presupuesto"}</th>{columnas.map((c) => <th key={c.titulo} className="num">{c.titulo}</th>)}</tr></thead>
            <tbody>
              {vistos.map((x) => {
                const si = elegidos.has(x.id);
                return (
                  <tr key={x.id} className="click" onClick={() => elegir(x.id, !si)}>
                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" style={{ width: 18, height: 18, accentColor: "var(--gold)" }} aria-label={`Elegir ${x.nombre}`} checked={si} onChange={(e) => elegir(x.id, e.target.checked)} /></td>
                    <td>
                      <span className="row" style={{ flexWrap: "nowrap", gap: 10 }}>
                        {x.foto ? <img className="thumb hide-s" src={media(x.foto)} alt="" loading="lazy" /> : <span className="thumb hide-s" />}
                        <span><span className="cell-title">{x.nombre}</span><span className="cell-sub">{x.grupo}</span></span>
                      </span>
                    </td>
                    {columnas.map((c, k) => {
                      const monto = x.precios[k];
                      const nuevo = si && valido && c.activa && monto ? subirPrecio(monto, pct, redondear) : null;
                      return (
                        <td key={c.titulo} className="num">
                          {monto == null ? <span className="muted">—</span> : nuevo == null ? ars(monto) : <><span className="muted">{ars(monto)} →</span> <b>{ars(nuevo)}</b></>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {confirmar && valido && (
        <Modal titulo={`${verbo} precios`} alCerrar={() => setConfirmar(false)}
          pie={<><button className="btn" type="button" onClick={() => setConfirmar(false)}>Cancelar</button>
            <button className="btn btn-primary" type="button" disabled={guardando} onClick={aplicar}><Icono n="check" />{guardando ? "Guardando…" : `${verbo} ${cuanto}`}</button></>}>
          <div className="stack-sm">
            <p>{verbo} {cuanto} {que}{redondear ? ", redondeado para arriba a $ 1.000" : ""}.</p>
            <p className="small muted">{de === "modelos"
              ? "Se guarda como precio nuevo desde hoy: el anterior queda en el historial. Los que no tienen precio en esa lista siguen sin precio."
              : "Los que no tenían precio final quedan con el calculado (costo × multiplicador) subido. No se puede deshacer: el precio final anterior no se guarda."}</p>
          </div>
        </Modal>
      )}
    </>
  );
}
