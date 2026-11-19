"use client";
// Historial de caja: cada caja del mes elegido con lo que entró, lo que salió y si cuadró al cerrar. Tocar una la abre (/admin/caja/?id=).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, fechaHora, hoyISO } from "@/lib/formato";
import type { CajaSesion } from "@/lib/tipos";
import { Icono } from "@/components/Icono";

const diferencia = (s: CajaSesion) => (s.cerrada_en ? Math.round((Number(s.monto_contado) - Number(s.esperado)) * 100) / 100 : null);
const nombreMes = (m: string) => new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(m + "-15T12:00")).replace(/^./, (c) => c.toUpperCase());
const dia = (f: string) => new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(f.replace(" ", "T"))).replace(/\./g, "");

export default function HistorialCaja() {
  const router = useRouter();
  const { puede } = useSesion();
  const [cajas, setCajas] = useState<CajaSesion[] | null>(null);
  const [error, setError] = useState("");
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  useEffect(() => { api("caja/historial").then((r) => setCajas(r.cajas), (e: Error) => setError(e.message)); }, []);

  if (!puede("caja.usar")) return <div className="empty card"><h2>Tu usuario no puede usar la caja</h2></div>;

  const meses = [...new Set([hoyISO().slice(0, 7), ...(cajas ?? []).map((s) => s.abierta_en.slice(0, 7))])].sort().reverse();
  const lista = (cajas ?? []).filter((s) => s.abierta_en.startsWith(mes));
  const cobros = lista.reduce((t, s) => t + Number(s.cobros), 0);
  const egresos = lista.reduce((t, s) => t + Number(s.egresos), 0);
  const diferencias = lista.reduce((t, s) => t + (diferencia(s) ?? 0), 0);

  return (
    <>
      <title>Historial de caja · La Unión</title>
      <div className="crumb"><Link href="/admin/caja/">Caja</Link><Icono n="right" /><span>Historial</span></div>
      <div className="page-head">
        <div><h1>Historial de caja</h1><p>{lista.length} {lista.length === 1 ? "caja" : "cajas"} · {ars(cobros)} cobrados en efectivo · {ars(egresos)} de egresos · diferencias {ars(diferencias)}</p></div>
        <select className="select" style={{ width: "auto" }} aria-label="Mes" value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
        </select>
      </div>
      <section className="card">
        {error ? <div className="empty"><Icono n="alert" /><p>No se pudo cargar el historial: {error}</p></div>
        : !cajas ? <div className="empty"><p>Cargando…</p></div>
        : !lista.length ? <div className="empty"><Icono n="cash" /><p>No hay cajas en {nombreMes(mes).toLowerCase()}.</p></div>
        : (
          <div className="table-wrap"><table className="table cards">
            <thead><tr><th>Día</th><th className="num">Inicial</th><th className="num">Cobros</th><th className="num">Egresos</th><th className="num">Tenía que haber</th><th className="num">Se contó</th><th className="num">Diferencia</th><th>Cerró</th></tr></thead>
            <tbody>{lista.map((s) => {
              const d = diferencia(s);
              const href = `/admin/caja/?id=${s.id}`;
              return (
                <tr key={s.id} className="click" onClick={() => router.push(s.cerrada_en ? href : "/admin/caja/")}>
                  <td className="full"><Link className="cell-title" href={s.cerrada_en ? href : "/admin/caja/"} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", color: "inherit", textTransform: "capitalize" }}>{dia(s.abierta_en)}</Link>
                    <span className="cell-sub">Abrió {s.abierta_por}{!s.cerrada_en && " · abierta"}</span></td>
                  <td className="num hide-m">{ars(s.monto_inicial)}</td>
                  <td className="num" data-label="Cobros">{ars(Number(s.cobros) + Number(s.otros_ingresos))}</td>
                  <td className="num" data-label="Egresos">{ars(s.egresos)}</td>
                  <td className="num hide-m">{ars(s.esperado)}</td>
                  <td className="num" data-label="Se contó">{s.cerrada_en ? ars(s.monto_contado ?? 0) : "—"}</td>
                  <td className="num right" data-label="Diferencia">{d == null ? <span className="badge ok">Abierta</span> : d === 0 ? <span className="badge ok">Cuadra</span>
                    : <span className={`badge ${d > 0 ? "warn" : "bad"}`} title={s.motivo_diferencia ?? undefined}>{d > 0 ? "+ " : ""}{ars(d)}</span>}</td>
                  <td className="hide-m small">{s.cerrada_en ? `${s.cerrada_por} · ${fechaHora(s.cerrada_en)}` : ""}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
