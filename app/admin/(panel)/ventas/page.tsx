"use client";
// Ventas: la lista con filtros (abiertas, mías, atrasadas, con saldo…) y búsqueda por número, cliente, DNI, teléfono o mueble.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, fecha, norm, numeroVenta } from "@/lib/formato";
import { cuandoEntrega, saldo, situacion } from "@/lib/ventas";
import type { VentaFila } from "@/lib/tipos";
import { Icono } from "@/components/Icono";

const FILTROS_GUARDADOS = "lu-ventas-filtros"; // se guardan al abrir una y volver

const FILTROS: [string, string, (v: VentaFila, empleado: number | null) => boolean][] = [
  ["abiertas", "Abiertas", (v) => v.estado !== "cancelada" && !v.entregado_en],
  ["mias", "Mías", (v, e) => v.vendedor_id === e && v.estado !== "cancelada"],
  ["atrasadas", "Atrasadas", (v) => situacion(v).texto === "Atrasada"],
  ["saldo", "Con saldo", (v) => v.estado !== "cancelada" && saldo(v) > 0],
  ["pausa", "En pausa", (v) => v.estado === "pausa"],
  ["entregadas", "Entregadas", (v) => v.estado !== "cancelada" && !!v.entregado_en],
  ["canceladas", "Canceladas", (v) => v.estado === "cancelada"],
  ["todas", "Todas", () => true],
];

export default function Ventas() {
  const router = useRouter();
  const { usuario, puede } = useSesion();
  const empleado = usuario?.empleado_id ?? null;
  const [lista, setLista] = useState<VentaFila[] | null>(null);
  const [error, setError] = useState("");
  const [f, setF] = useState({ q: "", filtro: "abiertas" });

  const cargar = () => api("ventas").then((r) => setLista(r.ventas), (e: Error) => setError(e.message));
  useEffect(() => {
    try { setF((x) => ({ ...x, ...JSON.parse(sessionStorage.getItem(FILTROS_GUARDADOS) || "{}") })); } catch {}
    cargar();
  }, []);
  const filtrar = (cambio: Partial<typeof f>) => {
    const nuevo = { ...f, ...cambio };
    setF(nuevo);
    try { sessionStorage.setItem(FILTROS_GUARDADOS, JSON.stringify(nuevo)); } catch {}
  };

  const filas = useMemo(() => {
    const todas = lista ?? [];
    const q = norm(f.q.trim());
    if (!q) return todas.filter((v) => FILTROS.find(([k]) => k === f.filtro)![2](v, empleado));
    const digitos = q.replace(/\D/g, "");
    return todas.filter((v) => // la búsqueda mira todas, sin el filtro
      q.split(/\s+/).every((t) => norm(`${numeroVenta(v.numero)} ${v.cliente} ${v.muebles ?? ""} ${v.localidad ?? ""}`).includes(t))
      || (digitos.length >= 3 && (`${v.dni ?? ""}`.includes(digitos) || `${v.telefono ?? ""}`.includes(digitos)))
      || (digitos && Number(digitos) === v.numero));
  }, [lista, f, empleado]);

  if (!puede("ventas.crear")) return <div className="empty card"><h2>Tu usuario no puede ver las ventas</h2></div>;

  return (
    <>
      <title>Ventas · La Unión</title>
      <div className="page-head">
        <div><h1>Ventas</h1><p>Cada venta con su cliente, sus muebles, la entrega prometida y lo que falta cobrar.</p></div>
        <Link className="btn btn-primary" href="/admin/ventas/nueva/"><Icono n="plus" />Nueva venta</Link>
      </div>

      <div className="stack-sm" style={{ marginBottom: 14 }}>
        <label className="gsearch" style={{ width: "100%", maxWidth: 520 }}><Icono n="search" /><span className="sr">Buscar ventas</span>
          <input type="search" placeholder="Buscar por número, cliente, DNI, teléfono o mueble" value={f.q} onChange={(e) => filtrar({ q: e.target.value })} />
        </label>
        {!f.q && (
          <div className="chips" role="group" aria-label="Filtrar ventas">
            {FILTROS.filter(([k]) => k !== "mias" || empleado).map(([k, texto, cumple]) => (
              <button key={k} type="button" className="chip" aria-pressed={f.filtro === k} onClick={() => filtrar({ filtro: k })}>
                {texto}<span className="n">{(lista ?? []).filter((v) => cumple(v, empleado)).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        {error ? <div className="empty"><Icono n="alert" /><p>No se pudieron cargar las ventas: {error}</p><button className="btn" onClick={() => { setError(""); cargar(); }}>Reintentar</button></div>
        : !lista ? <div className="empty"><p>Cargando…</p></div>
        : !lista.length ? <div className="empty"><Icono n="orders" /><p>Todavía no hay ventas.</p><Link className="btn btn-primary" href="/admin/ventas/nueva/"><Icono n="plus" />Cargar la primera</Link></div>
        : !filas.length ? <div className="empty"><Icono n="search" /><p>{f.q ? `No hay ventas para “${f.q}”.` : "No hay ventas con este filtro."}</p></div>
        : (
          <div className="table-wrap"><table className="table cards">
            <thead><tr><th>Venta</th><th>Cliente</th><th>Muebles</th><th>Vendedor</th><th>Entrega</th><th className="num">Saldo</th></tr></thead>
            <tbody>
              {filas.map((v) => {
                const s = situacion(v);
                const debe = saldo(v);
                const href = `/admin/ventas/ver/?id=${v.id}`;
                return (
                  <tr key={v.id} className={`click ${s.texto === "Atrasada" ? "late" : ""}`} onClick={() => router.push(href)}>
                    <td><Link className="cell-title" href={href} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none" }}>{numeroVenta(v.numero)}</Link><span className="cell-sub">{fecha(v.vendido_en)}</span></td>
                    <td className="right"><span className="cell-title">{v.cliente}</span><span className="cell-sub">{v.localidad}</span></td>
                    <td className="full"><span className="small">{v.muebles}</span></td>
                    <td className="hide-m"><span className="small">{v.vendedor}</span></td>
                    <td data-label="Entrega">
                      <span className="nowrap">{fecha(v.fecha_entrega)}</span>
                      <span className="cell-sub">{s.texto === "En curso" || s.texto === "Atrasada" ? <span style={s.texto === "Atrasada" ? { color: "var(--bad)", fontWeight: 700 } : undefined}>{cuandoEntrega(v.fecha_entrega)}</span>
                        : <span className={`badge ${s.tono}`}>{s.texto}</span>}{v.tipo_entrega === "retiro" && " · Retira"}</span>
                    </td>
                    <td className="num right" data-label="Saldo">{v.estado === "cancelada" ? "—" : debe > 0 ? ars(debe) : Number(v.financiado) > 0 ? <span className="badge gold">En cuotas</span> : <span className="badge ok">Pagada</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
