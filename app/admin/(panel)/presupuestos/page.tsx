"use client";
// Presupuestos de fabricación: lo que antes era la planilla de Excel. Buscar por nombre o grupo; tocar uno lo abre.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, media } from "@/lib/api";
import { ars, fechaHora, norm, precioPresupuesto } from "@/lib/formato";
import type { PresupuestoFila } from "@/lib/tipos";
import { Icono } from "@/components/Icono";

const FILTROS = "lu-presupuestos-filtros"; // se guardan al abrir uno y volver


export default function Presupuestos() {
  const router = useRouter();
  const [lista, setLista] = useState<PresupuestoFila[] | null>(null);
  const [error, setError] = useState("");
  const [f, setF] = useState({ q: "", grupo: "" });

  const cargar = () => api("presupuestos").then((r) => setLista(r.presupuestos), (e: Error) => setError(e.message));
  useEffect(() => {
    try { setF((x) => ({ ...x, ...JSON.parse(sessionStorage.getItem(FILTROS) || "{}") })); } catch {}
    cargar();
  }, []);
  const filtrar = (cambio: Partial<typeof f>) => {
    const nuevo = { ...f, ...cambio };
    setF(nuevo);
    try { sessionStorage.setItem(FILTROS, JSON.stringify(nuevo)); } catch {}
  };

  const grupos = [...new Set((lista ?? []).map((p) => p.grupo).filter((g): g is string => !!g))];
  const filas = useMemo(() => {
    const q = norm(f.q.trim());
    return (lista ?? []).filter((p) =>
      (!f.grupo || p.grupo === f.grupo) &&
      (!q || q.split(/\s+/).every((t) => norm(`${p.nombre} ${p.grupo || ""} ${p.producto || ""}`).includes(t))));
  }, [lista, f]);

  return (
    <>
      <title>Presupuestos · La Unión</title>
      <div className="page-head">
        <div><h1>Presupuestos</h1><p>El costo de fabricar cada mueble y su precio: despiece, insumos y precio final.</p></div>
        <Link className="btn btn-primary" href="/admin/presupuestos/editar/"><Icono n="plus" />Nuevo presupuesto</Link>
      </div>

      <div className="card card-pad" style={{ marginBottom: 14, padding: 12 }}>
        <div className="row">
          <label className="gsearch grow" style={{ width: "auto", minWidth: 220 }}><Icono n="search" /><span className="sr">Buscar presupuestos</span>
            <input type="search" placeholder="Buscar por nombre, grupo o modelo" value={f.q} onChange={(e) => filtrar({ q: e.target.value })} />
          </label>
          <select className="select" style={{ width: "auto" }} aria-label="Grupo" value={f.grupo} onChange={(e) => filtrar({ grupo: e.target.value })}>
            <option value="">Todos los grupos</option>
            {grupos.map((g) => <option key={g}>{g}</option>)}
          </select>
          {lista && <span className="small muted">{filas.length} {filas.length === 1 ? "presupuesto" : "presupuestos"}</span>}
        </div>
      </div>

      <div className="card">
        {error ? <div className="empty"><Icono n="alert" /><p>No se pudieron cargar los presupuestos: {error}</p><button className="btn" onClick={() => { setError(""); cargar(); }}>Reintentar</button></div>
        : !lista ? <div className="empty"><p>Cargando…</p></div>
        : !lista.length ? <div className="empty"><Icono n="calc" /><p>Todavía no hay presupuestos.</p><Link className="btn btn-primary" href="/admin/presupuestos/editar/"><Icono n="plus" />Crear el primero</Link></div>
        : !filas.length ? <div className="empty"><Icono n="search" /><p>No hay presupuestos con estos filtros.</p></div>
        : (
          <div className="table-wrap"><table className="table cards">
            <thead><tr><th style={{ width: 56 }}></th><th>Mueble</th><th className="num">Costo</th><th className="num">Precio</th><th className="num">Precio final</th><th>Modificado</th></tr></thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id} className="click" onClick={() => router.push(`/admin/presupuestos/editar/?id=${p.id}`)}>
                  <td className="hide-m">{p.url_foto ? <img className="thumb" src={media(p.url_foto)} alt="" loading="lazy" /> : <span className="thumb" style={{ display: "grid", placeItems: "center", color: "var(--faint)" }}><Icono n="image" /></span>}</td>
                  <td className="full">
                    <Link className="cell-title" href={`/admin/presupuestos/editar/?id=${p.id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", color: "inherit" }}>{p.nombre}</Link>
                    <span className="cell-sub">{p.grupo || "Sin grupo"}{p.producto && ` · Modelo: ${p.producto}`}</span>
                  </td>
                  <td data-label="Costo" className="num">{ars(p.costo)}</td>
                  <td data-label={`Precio (× ${String(Number(p.multiplicador)).replace(".", ",")})`} className="num">{ars(precioPresupuesto(p.costo, p.multiplicador))}</td>
                  <td data-label="Precio final" className="num"><b>{p.precio_final ? ars(p.precio_final) : <span className="muted">—</span>}</b></td>
                  <td data-label="Modificado"><span className="small muted">{fechaHora(p.actualizado_en)}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
