"use client";
// PDF de un presupuesto para imprimir: /admin/presupuestos/imprimir/?id=<id>&tipo=cliente|taller.
// - cliente (default): hoja presentable con foto, datos y precio final. Lo que se le entrega al cliente.
// - taller: foto de referencia, datos básicos, tabla de insumos y de despiece (con placas) y las notas para el taller.
// Reusa los estilos de impresión de la ficha de venta (.print-page .ficha, @media print en admin.css).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { api, media } from "@/lib/api";
import { ars, dec, fecha, norm, precioPresupuesto } from "@/lib/formato";
import type { Presupuesto } from "@/lib/tipos";
import { Icono, Logo } from "@/components/Icono";

export default function Pagina() {
  return <Suspense><Imprimir /></Suspense>;
}

// ponytail: misma placa única del editor (183 × 260 cm); un tamaño por material si alguna vez hace falta
const PLACA_M2 = (183 * 260) / 10000;
const num = (v: string | number | null) => (v != null && Number.isFinite(Number(v)) ? Number(v) : 0);

const Fila = ({ t, children }: { t: string; children?: ReactNode }) =>
  <div style={{ display: "flex", gap: 6, padding: "2px 0" }}><span style={{ color: "#555" }}>{t}:</span><b>{children || "—"}</b></div>;

function Imprimir() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const taller = params.get("tipo") === "taller";
  const [p, setP] = useState<Presupuesto | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api("presupuesto", { query: { id } }).then((r) => setP(r.presupuesto), (e: Error) => setError(e.message)); }, [id]);
  if (error) return <div className="empty card"><h2>{error}</h2></div>;
  if (!p) return <p className="muted">Cargando…</p>;

  const foto = p.foto ? media(p.foto) : null;
  const encabezado = (
    <header className="wo-head">
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <Logo alto={40} /><div><b style={{ fontFamily: "var(--f-brand)", letterSpacing: ".1em", fontSize: 16 }}>LA UNIÓN</b>
            <div style={{ fontSize: 11 }}>{taller ? "Orden de taller" : "Presupuesto"}</div></div>
        </div>
        <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>{p.nombre}</h1>
        <Fila t="Grupo">{p.grupo}</Fila>
        <Fila t="Código">{p.codigo}</Fila>
        <Fila t="Fecha">{fecha(p.actualizado_en ?? p.creado_en)}</Fila>
      </div>
      {foto && <img src={foto} alt="" style={{ width: 150, maxHeight: 150, objectFit: "contain", border: "1px solid #ccc", borderRadius: 6 }} />}
    </header>
  );

  return (
    <>
      <title>{`${taller ? "Taller" : "Presupuesto"} · ${p.nombre} · La Unión`}</title>
      <div className="print-bar">
        <Link className="btn" href={`/admin/presupuestos/editar/?id=${p.id}`}><Icono n="left" />Volver</Link>
        <button type="button" className="btn btn-primary" onClick={() => print()}><Icono n="print" />Imprimir</button>
      </div>
      <article className="print-page ficha">
        {encabezado}
        {taller ? <Taller p={p} /> : <Cliente p={p} />}
      </article>
    </>
  );
}

/** Hoja para el cliente: foto grande y precio. */
function Cliente({ p }: { p: Presupuesto }) {
  const precio = p.precio_final != null ? Number(p.precio_final) : precioPresupuesto(p.costo, p.multiplicador);
  const foto = p.foto ? media(p.foto) : null;
  return (
    <>
      {foto && <img src={foto} alt="" style={{ display: "block", width: "100%", maxHeight: 420, objectFit: "contain", margin: "8px 0 16px" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "2px solid #111", paddingTop: 10 }}>
        <b style={{ fontSize: 16 }}>Precio</b>
        <b style={{ fontSize: 26 }}>{ars(precio)}</b>
      </div>
      <p className="small" style={{ color: "#555", marginTop: 16 }}>Presupuesto sin cargo. Los precios pueden variar según disponibilidad de materiales.</p>
    </>
  );
}

/** Hoja para el taller: insumos, despiece y notas. */
function Taller({ p }: { p: Presupuesto }) {
  // El costo total lo calcula la API (p.costo); acá solo el total por fila para mostrar la columna.
  const conPorc = p.insumos.map((x) => {
    const total = num(x.cantidad) * num(x.costo_unitario);
    return x.porcentaje == null ? total : (total * num(x.porcentaje)) / 100;
  });

  const porMaterial = new Map<string, { nombre: string; m2: number }>();
  p.cortes.forEach((c) => {
    const m2 = (num(c.ancho_cm) * num(c.alto_cm) * c.cantidad) / 10000;
    if (!m2) return;
    const nombre = (c.material ?? "").trim() || "Sin material";
    const x = porMaterial.get(norm(nombre)) ?? { nombre, m2: 0 };
    porMaterial.set(norm(nombre), { ...x, m2: x.m2 + m2 });
  });

  return (
    <>
      <h2>Insumos</h2>
      {p.insumos.length ? (
        <table>
          <thead><tr><th className="num">Cant.</th><th>Insumo</th><th className="num">Costo unit.</th><th className="num">Porc.</th><th className="num">Total</th></tr></thead>
          <tbody>
            {p.insumos.map((x, i) => (
              <tr key={i}><td className="num">{dec(x.cantidad)}</td><td>{x.insumo}</td><td className="num">{ars(x.costo_unitario)}</td>
                <td className="num">{x.porcentaje == null ? "100 %" : `${dec(x.porcentaje)} %`}</td><td className="num">{ars(conPorc[i])}</td></tr>
            ))}
            <tr><td colSpan={4} className="num"><b>Costo de materiales</b></td><td className="num"><b>{ars(p.costo)}</b></td></tr>
          </tbody>
        </table>
      ) : <p className="muted">Sin insumos cargados.</p>}

      <h2>Despiece</h2>
      {p.cortes.length ? (
        <table>
          <thead><tr><th>Pieza</th><th className="num">Ancho</th><th className="num">Alto</th><th className="num">Cant.</th><th>Material</th><th className="num">m²</th></tr></thead>
          <tbody>
            {p.cortes.map((c, i) => {
              const m2 = (num(c.ancho_cm) * num(c.alto_cm) * c.cantidad) / 10000;
              return <tr key={i}><td>{c.pieza || "—"}</td><td className="num">{c.ancho_cm != null ? dec(c.ancho_cm) : "—"}</td><td className="num">{c.alto_cm != null ? dec(c.alto_cm) : "—"}</td>
                <td className="num">{c.cantidad}</td><td>{c.material || "—"}</td><td className="num">{m2 ? dec(Math.round(m2 * 100) / 100) : "—"}</td></tr>;
            })}
          </tbody>
        </table>
      ) : <p className="muted">Sin despiece cargado.</p>}
      {porMaterial.size > 0 && (
        <div style={{ marginTop: 6 }}>
          {[...porMaterial.values()].map((x) => (
            <div key={x.nombre} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
              <span>{x.nombre}</span><span>{dec(Math.round(x.m2 * 100) / 100)} m² · <b>{dec(Math.round((x.m2 / PLACA_M2) * 100) / 100)} placas</b></span>
            </div>
          ))}
          <small style={{ color: "#555" }}>Placas de 183 × 260 cm, sin contar el desperdicio del corte.</small>
        </div>
      )}

      <h2>Notas para el taller</h2>
      <div style={{ border: "1px solid #bbb", borderRadius: 8, padding: 10, minHeight: 80, whiteSpace: "pre-wrap" }}>{p.notas || "—"}</div>
    </>
  );
}
