"use client";
// Ficha de venta para imprimir en A4 y que el cliente la firme: /admin/ventas/imprimir/?id=<id>.
// Los 4 bloques de la ficha en papel (solicitante, datos comerciales, descripción de la compra y plan de pago) y las firmas.
// Lo que no se completó sale vacío, como en el papel. Al imprimir se ocultan el menú y los botones (admin.css, @media print).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { ars, fecha, numeroVenta, telefonoLindo } from "@/lib/formato";
import { CONCEPTO, ESTADO_CIVIL, FRECUENCIA, saldo } from "@/lib/ventas";
import type { Direccion, Venta } from "@/lib/tipos";
import { Icono, Logo } from "@/components/Icono";

export default function Pagina() {
  return <Suspense><Imprimir /></Suspense>;
}

const D = ({ t, children, ancho = false }: { t: string; children?: ReactNode; ancho?: boolean }) => <div className={ancho ? "ancho" : undefined}><span>{t}:</span><b>{children}</b></div>;
const calle = (d: Direccion | null) => (d ? [`${d.calle} ${d.numero ?? ""}`.trim(), d.piso && `piso ${d.piso}`, d.departamento && `depto. ${d.departamento}`].filter(Boolean).join(", ") : "");

function Imprimir() {
  const id = useSearchParams().get("id") ?? "";
  const [v, setV] = useState<Venta | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api("venta", { query: { id } }).then((r) => setV(r.venta), (e: Error) => setError(e.message)); }, [id]);
  if (error) return <div className="empty card"><h2>{error}</h2></div>;
  if (!v) return <p className="muted">Cargando…</p>;

  const c = v.cliente;
  const m = c.tipo === "negocio" ? c.comercio : null;
  const cobros = v.cobros.filter((x) => !x.anulado_en);
  const anticipo = cobros.filter((x) => x.concepto === "anticipo" || x.concepto === "pago_total" || x.concepto === "sena");
  const credito = cobros.find((x) => x.medio_tipo === "credito_casa");

  return (
    <>
      <title>{`Ficha ${numeroVenta(v.numero)} · La Unión`}</title>
      <div className="print-bar">
        <Link className="btn" href={`/admin/ventas/ver/?id=${v.id}`}><Icono n="left" />Volver a la venta</Link>
        <button type="button" className="btn btn-primary" onClick={() => print()}><Icono n="print" />Imprimir</button>
      </div>
      <article className="print-page ficha">
        <header className="wo-head">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Logo alto={40} /><div><b style={{ fontFamily: "var(--f-brand)", letterSpacing: ".1em", fontSize: 16 }}>LA UNIÓN</b><div style={{ fontSize: 11 }}>Ficha de venta</div></div></div>
          <div style={{ textAlign: "right" }}><h1>{numeroVenta(v.numero)}</h1><div>Fecha: <b>{fecha(v.vendido_en)}</b></div><div>Vendedor: <b>{v.vendedor}</b></div></div>
        </header>

        <h2>Solicitante</h2>
        <div className="datos">
          <D t="Nombre y apellido" ancho>{c.nombre} {c.apellido}</D>
          <D t="DNI">{c.dni}</D>
          <D t="Estado civil">{c.estado_civil && ESTADO_CIVIL[c.estado_civil]}</D>
          <D t="Fecha de nacimiento">{c.fecha_nacimiento && fecha(c.fecha_nacimiento)}</D>
          <D t="Teléfonos">{c.telefonos.map((t) => telefonoLindo(t.numero_completo)).join(" / ")}</D>
          <D t="Email" ancho>{c.email}</D>
          <D t="Dirección">{calle(c.direccion)}</D>
          <D t="Barrio">{c.direccion?.barrio}</D>
          <D t="Localidad">{c.direccion?.localidad}</D>
          <D t="Provincia">{c.direccion?.provincia}</D>
          <D t="Margen de crédito">{c.margen_credito && ars(c.margen_credito)}</D>
        </div>

        <h2>Datos comerciales</h2>
        <div className="datos">
          <D t="Comercio">{m?.nombre_comercio}</D>
          <D t="Rubro">{m?.rubro}</D>
          <D t="Domicilio comercial">{calle(m?.direccion ?? null)}</D>
          <D t="Barrio">{m?.direccion?.barrio}</D>
          <D t="Localidad">{m?.direccion?.localidad}</D>
          <D t="Provincia">{m?.direccion?.provincia}</D>
        </div>

        <h2>Descripción de la compra</h2>
        <table>
          <thead><tr><th>Código</th><th>Descripción</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
          <tbody>
            {v.items.map((x) => <tr key={x.id}><td>{x.codigo}</td><td><b>{x.nombre}</b>{x.descripcion && <div>{x.descripcion}</div>}</td><td className="num">{x.cantidad}</td><td className="num">{ars(x.precio_unitario)}</td><td className="num">{ars(x.cantidad * Number(x.precio_unitario))}</td></tr>)}
            {Number(v.descuento) > 0 && <tr><td colSpan={4} className="num">Descuento</td><td className="num">− {ars(v.descuento)}</td></tr>}
            <tr><td colSpan={4} className="num"><b>Total</b></td><td className="num"><b>{ars(v.total)}</b></td></tr>
          </tbody>
        </table>

        <h2>Plan de pago</h2>
        <div className="datos">
          <D t="Anticipo" ancho>{anticipo.map((x) => `${ars(x.monto)} (${x.medio}${x.cuotas && x.cuotas > 1 ? `, ${x.cuotas} cuotas` : ""}${Number(x.recargo_monto) > 0 ? `, cobrado ${ars(x.total_cobrado)} con recargo` : ""})`).join(" + ")}</D>
          <D t="Cantidad de cuotas">{credito?.cuotas}</D>
          <D t="Valor de cada cuota">{credito?.monto_cuota && ars(credito.monto_cuota)}</D>
          <D t="Tipo">{credito?.frecuencia_cuotas && FRECUENCIA[credito.frecuencia_cuotas]}</D>
          <D t="Fecha de inicio">{credito?.fecha_primer_vencimiento && fecha(credito.fecha_primer_vencimiento)}</D>
          <D t="Crédito Nº">{credito?.referencia}</D>
          <D t="Saldo">{v.estado === "cancelada" ? "Venta cancelada" : ars(saldo(v))}</D>
          <D t="Entrega prometida">{fecha(v.fecha_entrega)}</D>
          <D t="Entrega">{v.tipo_entrega === "retiro" ? "Retira en el showroom" : "Envío e instalación"}</D>
          {cobros.some((x) => !anticipo.includes(x) && x !== credito) && <D t="Otros pagos" ancho>{cobros.filter((x) => !anticipo.includes(x) && x !== credito).map((x) => `${fecha(x.cobrado_en)}: ${ars(x.monto)} (${CONCEPTO[x.concepto].toLowerCase()}, ${x.medio})`).join(" · ")}</D>}
          {v.notas && <D t="Notas" ancho>{v.notas}</D>}
        </div>

        <div className="firmas"><div>Firma del cliente</div><div>Aclaración y DNI</div><div>Firma del vendedor</div></div>
      </article>
    </>
  );
}
