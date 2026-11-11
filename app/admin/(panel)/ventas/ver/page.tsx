"use client";
// Una venta: /admin/ventas/ver/?id=<id>. Ficha (cliente y muebles), pagos (cobros, registrar y anular) e historial.
// Acciones: nueva fecha de entrega, pausa, entregada y cancelar (cancelar y anular cobros: solo con ventas.anular).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { api, media } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, fecha, fechaHora, parsePesos, pesos, telefonoLindo, numeroVenta } from "@/lib/formato";
import { CONCEPTO, ESTADO_CIVIL, cuandoEntrega, detalleCobro, direccionTexto, saldo, situacion } from "@/lib/ventas";
import type { Cobro, OpcionesVenta, Venta } from "@/lib/tipos";
import { Icono, type NombreIcono } from "@/components/Icono";
import { Modal } from "@/components/Modal";
import { useAviso } from "@/components/Avisos";

export default function Pagina() {
  return <Suspense><VerVenta /></Suspense>;
}

type Pestana = "ficha" | "pagos" | "historial";
type Ventana = null | "cobrar" | "fecha" | "pausa" | "cancelar" | { anular: Cobro };

function VerVenta() {
  const id = useSearchParams().get("id") ?? "";
  const { puede } = useSesion();
  const avisar = useAviso();
  const [v, setV] = useState<Venta | null>(null);
  const [error, setError] = useState("");
  const [pestana, setPestana] = useState<Pestana>("ficha");
  const [ventana, setVentana] = useState<Ventana>(null);
  const [foto, setFoto] = useState<string | null>(null);

  const cargar = () => api("venta", { query: { id } }).then((r) => setV(r.venta), (e: Error) => setError(e.message));
  useEffect(() => { cargar(); }, [id]);

  if (error) return <div className="empty card"><Icono n="search" /><h2>{error}</h2><Link className="btn" href="/admin/ventas/">Ver las ventas</Link></div>;
  if (!v) return <p className="muted">Cargando…</p>;

  const s = situacion(v);
  const debe = saldo(v);
  const abierta = v.estado !== "cancelada";
  const pagada = debe <= 0 && Number(v.financiado) <= 0; // con crédito de la casa no está "pagada": la deuda la siguen ellos
  const textoSaldo = debe > 0 ? ars(debe) : pagada ? "Pagada" : "En cuotas";
  const cobrados = v.cobros.filter((c) => !c.anulado_en && c.medio_tipo !== "credito_casa").length;
  const tel = v.cliente.telefonos[0]?.numero_completo;
  /** Cambio de estado o de fecha: lo guarda, recarga la venta y avisa. */
  async function estado(cambio: { estado?: Venta["estado"]; motivo?: string; fecha_entrega?: string; entregada?: boolean }, texto: string) {
    try {
      await api("venta/estado", { body: { id: v!.id, ...cambio } });
      setVentana(null);
      avisar(texto);
      cargar();
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
    }
  }
  const accion = (icono: NombreIcono, texto: string, hacer: () => void) => <button type="button" className="btn btn-sm" onClick={hacer}><Icono n={icono} />{texto}</button>;

  return (
    <>
      <title>{`${numeroVenta(v.numero)} · La Unión`}</title>
      <div className="crumb"><Link href="/admin/ventas/">Ventas</Link><Icono n="right" /><span>{numeroVenta(v.numero)}</span></div>
      <div className="o-head">
        <div className="spread">
          <div className="row"><h1 className="tnum">{numeroVenta(v.numero)}</h1><span className={`badge ${s.tono}`}>{s.texto}</span></div>
          <div className="row">
            <Link className="btn" href={`/admin/ventas/imprimir/?id=${v.id}`}><Icono n="print" />Imprimir ficha</Link>
          </div>
        </div>
        {v.estado === "pausa" && <div className="alert warn"><Icono n="pause" /><div><b>Venta en pausa.</b> {v.motivo_estado}</div></div>}
        {v.estado === "cancelada" && <div className="alert bad"><Icono n="ban" /><div><b>Venta cancelada el {fecha(v.cancelado_en)}.</b> {v.motivo_estado}</div></div>}
        <div className="o-meta">
          <div><span>Cliente</span><b>{v.cliente.nombre} {v.cliente.apellido}</b>
            {tel && <a className="small" style={{ color: "var(--gold-ink)", fontWeight: 600 }} href={`https://wa.me/${tel}?text=${encodeURIComponent(`Hola ${v.cliente.nombre}, te escribimos de La Unión por tu compra ${numeroVenta(v.numero)}.`)}`} target="_blank" rel="noopener">{telefonoLindo(tel)}</a>}</div>
          <div><span>Entrega prometida</span><b>{fecha(v.fecha_entrega)}</b><span className="small" style={s.texto === "Atrasada" ? { color: "var(--bad)", fontWeight: 700 } : undefined}>
            {v.entregado_en ? `Entregada el ${fecha(v.entregado_en)}` : abierta ? cuandoEntrega(v.fecha_entrega) : ""} · {v.tipo_entrega === "retiro" ? "Retira en el showroom" : "Envío e instalación"}</span></div>
          <div><span>Vendedor</span><b>{v.vendedor}</b><span className="small muted">Venta del {fecha(v.vendido_en)}</span></div>
          <div><span>Saldo</span><b className="tnum" style={pagada && abierta ? { color: "var(--ok)" } : undefined}>{abierta ? textoSaldo : "—"}</b><span className="small muted">de {ars(v.total)}</span></div>
        </div>
        {abierta && (
          <div className="row">
            {accion("calendar", "Cambiar fecha de entrega", () => setVentana("fecha"))}
            {v.entregado_en ? accion("undo", "No está entregada", () => estado({ entregada: false }, "Se quitó la marca de entregada"))
              : accion("truck", "Marcar como entregada", () => estado({ entregada: true }, "Venta entregada"))}
            {v.estado === "pausa" ? accion("play", "Reanudar", () => estado({ estado: "activa" }, "Venta reanudada")) : accion("pause", "Poner en pausa", () => setVentana("pausa"))}
            {puede("ventas.anular") && <button type="button" className="btn btn-sm btn-danger" onClick={() => setVentana("cancelar")}><Icono n="ban" />Cancelar la venta</button>}
          </div>
        )}
      </div>

      <nav className="tabs" aria-label="Secciones de la venta">
        {(["ficha", "pagos", "historial"] as Pestana[]).map((p) => (
          <a key={p} href="#" aria-current={pestana === p ? "page" : undefined} onClick={(e) => { e.preventDefault(); setPestana(p); }}>
            {{ ficha: "Ficha", pagos: "Pagos", historial: "Historial" }[p]}{p === "pagos" && <span className="n">{v.cobros.filter((c) => !c.anulado_en).length}</span>}
          </a>))}
      </nav>

      {pestana === "ficha" && <Ficha v={v} verFoto={setFoto} />}
      {pestana === "pagos" && (
        <div className="stack">
          <div className="money-sum">
            <div className="kpi"><span>Total</span><b className="tnum">{ars(v.total)}</b><small>{Number(v.descuento) > 0 ? `Con ${ars(v.descuento)} de descuento` : " "}</small></div>
            <div className="kpi"><span>Cobrado</span><b className="tnum">{ars(Number(v.pagado) - Number(v.financiado))}</b><small>{cobrados} {cobrados === 1 ? "cobro" : "cobros"}</small></div>
            <div className="kpi"><span>En cuotas</span><b className="tnum">{ars(v.financiado)}</b><small>Crédito de la casa</small></div>
            <div className={`kpi ${pagada ? "ok" : ""}`}><span>Saldo</span><b className="tnum">{textoSaldo}</b><small> </small></div>
          </div>
          {abierta && debe > 0 && <div><button type="button" className="btn btn-primary" onClick={() => setVentana("cobrar")}><Icono n="plus" />Registrar cobro</button></div>}
          <section className="card">
            <div className="card-head"><h2>Cobros</h2></div>
            {v.cobros.length ? <div className="table-wrap"><table className="table cards">
              <thead><tr><th>Fecha</th><th>Concepto</th><th>Medio</th><th>Cobró</th><th className="num">Monto</th>{puede("ventas.anular") && <th />}</tr></thead>
              <tbody>{v.cobros.map((c) => (
                <tr key={c.id} style={c.anulado_en ? { opacity: .55 } : undefined}>
                  <td>{fechaHora(c.cobrado_en)}</td>
                  <td className="right">{CONCEPTO[c.concepto]}{c.anulado_en && <span className="cell-sub" style={{ color: "var(--bad)" }}>Anulado: {c.motivo_anulacion}</span>}</td>
                  <td data-label="Medio">{c.medio}<span className="cell-sub">{detalleCobro(c)}</span></td>
                  <td className="hide-m">{c.cobrado_por}</td>
                  <td className="num right" data-label="Monto"><b style={c.anulado_en ? { textDecoration: "line-through" } : undefined}>{ars(c.monto)}</b>
                    {Number(c.recargo_monto) > 0 && <span className="cell-sub">Cobrado con recargo: {ars(c.total_cobrado)}</span>}</td>
                  {puede("ventas.anular") && <td>{!c.anulado_en && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setVentana({ anular: c })}>Anular</button>}</td>}
                </tr>))}</tbody>
            </table></div> : <div className="empty"><p>Todavía no hay cobros.</p></div>}
          </section>
        </div>
      )}
      {pestana === "historial" && (
        <section className="card"><ul className="list">{[...v.historial].reverse().map((h, n) => (
          <li key={n}><div className="li"><div className="grow"><div>{h.texto}</div><div className="small muted">{fechaHora(h.creado_en)} · {h.usuario}</div></div></div></li>
        ))}</ul></section>
      )}

      {ventana === "cobrar" && <Cobrar v={v} alCerrar={() => setVentana(null)} alGuardar={() => { setVentana(null); avisar("Cobro registrado"); cargar(); }} />}
      {ventana === "fecha" && <Motivo titulo="Cambiar fecha de entrega" etiqueta="Nueva fecha prometida" fecha={v.fecha_entrega} boton="Guardar" alCerrar={() => setVentana(null)}
        alGuardar={(f) => estado({ fecha_entrega: f }, "Fecha de entrega actualizada")} />}
      {ventana === "pausa" && <Motivo titulo={`Poner en pausa ${numeroVenta(v.numero)}`} etiqueta="Motivo (opcional)" boton="Poner en pausa" alCerrar={() => setVentana(null)}
        alGuardar={(m) => estado({ estado: "pausa", motivo: m }, "Venta en pausa")} />}
      {ventana === "cancelar" && <Motivo titulo={`Cancelar ${numeroVenta(v.numero)}`} etiqueta="Motivo" obligatorio boton="Cancelar la venta" ayuda="Los cobros ya registrados quedan como están. Si hay que devolver plata, anulá el cobro."
        alCerrar={() => setVentana(null)} alGuardar={(m) => estado({ estado: "cancelada", motivo: m }, "Venta cancelada")} />}
      {ventana && typeof ventana === "object" && <Motivo titulo={`Anular cobro de ${ars(ventana.anular.monto)}`} etiqueta="Motivo" obligatorio boton="Anular el cobro" ayuda="El cobro no se borra: queda tachado, con el motivo, y el saldo vuelve a subir."
        alCerrar={() => setVentana(null)} alGuardar={async (m) => {
          try { await api("venta/anular-cobro", { body: { cobro_id: ventana.anular.id, motivo: m } }); setVentana(null); avisar("Cobro anulado"); cargar(); }
          catch (e) { avisar((e as Error).message, { tono: "bad", ms: 6000 }); }
        }} />}
      {foto && <Modal titulo="Foto" ancho alCerrar={() => setFoto(null)}><img src={media(foto)} alt="" style={{ width: "100%", borderRadius: 10 }} /></Modal>}
    </>
  );
}

function Ficha({ v, verFoto }: { v: Venta; verFoto: (url: string) => void }) {
  const c = v.cliente;
  const fila = (dt: string, dd: ReactNode) => (dd ? <><dt>{dt}</dt><dd>{dd}</dd></> : null);
  return (
    <div className="stack">
      <section className="card"><div className="card-head"><h2>Cliente</h2></div>
        <div className="card-body"><dl className="specs">
          {fila("Nombre", `${c.nombre} ${c.apellido}`)}
          {fila("DNI", c.dni)}
          {fila("Estado civil", c.estado_civil && ESTADO_CIVIL[c.estado_civil])}
          {fila("Nacimiento", c.fecha_nacimiento && fecha(c.fecha_nacimiento))}
          {fila("Teléfonos", c.telefonos.map((t) => `${telefonoLindo(t.numero_completo)}${t.es_whatsapp ? " (WhatsApp)" : ""}`).join(", "))}
          {fila("Email", c.email)}
          {fila("Dirección", c.direccion && `${direccionTexto(c.direccion)}, ${c.direccion.provincia}`)}
          {fila("Entrega en", v.tipo_entrega === "retiro" ? "Retira en el showroom" : v.direccion_entrega && direccionTexto(v.direccion_entrega))}
          {fila("Margen de crédito", c.margen_credito && ars(c.margen_credito))}
        </dl></div>
      </section>
      {c.tipo === "negocio" && c.comercio && (
        <section className="card"><div className="card-head"><h2>Datos comerciales</h2></div>
          <div className="card-body"><dl className="specs">
            {fila("Comercio", c.comercio.nombre_comercio)}
            {fila("Rubro", c.comercio.rubro)}
            {fila("Domicilio", c.comercio.direccion && `${direccionTexto(c.comercio.direccion)}, ${c.comercio.direccion.provincia}`)}
          </dl></div>
        </section>
      )}
      {v.items.map((x) => (
        <section key={x.id} className="card"><div className="item-card">
          {x.url_foto ? <img className="cover" src={media(x.url_foto)} alt="" /> : <div className="cover" style={{ width: 96, height: 120, borderRadius: 10, background: "var(--surface-2)" }} />}
          <div className="stack-sm" style={{ minWidth: 0 }}>
            <div><h2>{x.cantidad > 1 && `${x.cantidad}× `}{x.nombre}</h2><span className="small muted">{x.producto_id ? "Del catálogo" : "A medida"}{x.codigo && ` · ${x.codigo}`}</span></div>
            <dl className="specs">
              {fila("Descripción", x.descripcion)}
              {fila("Precio", `${ars(x.precio_unitario)}${x.cantidad > 1 ? ` c/u · ${ars(x.cantidad * Number(x.precio_unitario))}` : ""}`)}
              {fila("Notas para el taller", x.notas_taller)}
            </dl>
            {x.adjuntos.length > 0 && <div><span className="label">Fotos y croquis del cliente</span>
              <div className="attach" style={{ marginTop: 6 }}>{x.adjuntos.map((a) => <img key={a} src={media(a)} alt="Foto del cliente" onClick={() => verFoto(a)} />)}</div></div>}
          </div>
        </div></section>
      ))}
      <section className="card card-pad"><dl className="specs">
        {fila("Subtotal", ars(v.subtotal))}
        {Number(v.descuento) > 0 && fila("Descuento", `− ${ars(v.descuento)}`)}
        {fila("Total", <b>{ars(v.total)}</b>)}
        {fila("Notas de la venta", v.notas)}
      </dl></section>
    </div>
  );
}

function Cobrar({ v, alGuardar, alCerrar }: { v: Venta; alGuardar: () => void; alCerrar: () => void }) {
  const [op, setOp] = useState<OpcionesVenta | null>(null);
  const [f, setF] = useState({ medio: "", monto: pesos(saldo(v)), cuenta: "", plan: "", referencia: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    api("venta/nueva").then((r) => { setOp(r); setF((x) => ({ ...x, medio: String(r.medios.find((m) => m.tipo === "efectivo")?.id ?? r.medios[0]?.id ?? ""), cuenta: String(r.cuentas[0]?.id ?? "") })); }, (e: Error) => setError(e.message));
  }, []);
  const tipo = op?.medios.find((m) => String(m.id) === f.medio)?.tipo;
  const planes = (op?.planes ?? []).filter((x) => `tarjeta_${x.tipo_tarjeta}` === tipo);
  async function guardar() {
    const monto = parsePesos(f.monto);
    if (!monto || !Number.isFinite(monto)) return setError("Escribí el monto que cobraste.");
    if (monto > saldo(v)) return setError(`El monto supera el saldo (${ars(saldo(v))}).`);
    setGuardando(true);
    try {
      await api("venta/cobro", { body: { venta_id: v.id, medio_pago_id: Number(f.medio), monto, cuenta_bancaria_id: tipo === "transferencia" ? Number(f.cuenta) || null : null, posnet_plan_id: Number(f.plan) || null, referencia: f.referencia } });
      alGuardar();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }
  return (
    <Modal titulo={`Registrar cobro · ${numeroVenta(v.numero)}`} alCerrar={alCerrar}
      pie={<><button type="button" className="btn" onClick={alCerrar}>Cancelar</button><button type="button" className="btn btn-primary" disabled={!op || guardando} onClick={guardar}>{guardando ? "Guardando…" : "Registrar cobro"}</button></>}>
      <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <p className="muted">Saldo: <b className="tnum">{ars(saldo(v))}</b></p>
        <div className="grid-2">
          <label className="field"><span>Monto</span><span className="input-money"><span>$</span><input inputMode="numeric" value={f.monto}
            onChange={(e) => setF({ ...f, monto: e.target.value })} onBlur={(e) => { const n = parsePesos(e.target.value); if (n != null && Number.isFinite(n)) setF({ ...f, monto: pesos(n) }); }} /></span></label>
          <label className="field"><span>Cómo paga</span>
            <select className="select" value={f.medio} onChange={(e) => setF({ ...f, medio: e.target.value, plan: "" })}>
              {op?.medios.filter((m) => m.tipo !== "credito_casa").map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select></label>
          {tipo === "transferencia" && (op?.cuentas.length ?? 0) > 0 && <label className="field"><span>A qué cuenta entró</span>
            <select className="select" value={f.cuenta} onChange={(e) => setF({ ...f, cuenta: e.target.value })}>{op!.cuentas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>}
          {planes.length > 0 && <label className="field"><span>Posnet y cuotas</span>
            <select className="select" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
              <option value="">Sin recargo</option>
              {planes.map((x) => <option key={x.id} value={x.id}>{x.posnet} · {x.cuotas} {x.cuotas === 1 ? "pago" : "cuotas"}{Number(x.recargo_pct) ? ` · +${String(Number(x.recargo_pct)).replace(".", ",")} %` : ""}</option>)}
            </select></label>}
          <label className="field"><span>Nº de operación o cupón (opcional)</span><input className="input" value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} /></label>
        </div>
        {error && <p className="alert bad" role="alert"><Icono n="alert" /><span>{error}</span></p>}
      </form>
    </Modal>
  );
}

/** Ventana con un texto (motivo) o una fecha. */
function Motivo({ titulo, etiqueta, boton, ayuda, obligatorio = false, fecha: inicial, alGuardar, alCerrar }:
  { titulo: string; etiqueta: string; boton: string; ayuda?: string; obligatorio?: boolean; fecha?: string; alGuardar: (valor: string) => void; alCerrar: () => void }) {
  const [valor, setValor] = useState(inicial ?? "");
  const [error, setError] = useState("");
  const listo = () => (obligatorio && !valor.trim() ? setError("Escribí el motivo.") : !valor && inicial !== undefined ? setError("Elegí la fecha.") : alGuardar(valor.trim()));
  return (
    <Modal titulo={titulo} alCerrar={alCerrar} pie={<><button type="button" className="btn" onClick={alCerrar}>Volver</button><button type="button" className="btn btn-primary" onClick={listo}>{boton}</button></>}>
      <label className="field"><span>{etiqueta}</span>
        {inicial !== undefined ? <input className="input" type="date" value={valor} onChange={(e) => setValor(e.target.value)} />
          : <textarea className="textarea" rows={3} value={valor} onChange={(e) => { setValor(e.target.value); setError(""); }} />}
        {ayuda && <small>{ayuda}</small>}</label>
      {error && <p className="small" style={{ color: "var(--bad)", marginTop: 8 }} role="alert">{error}</p>}
    </Modal>
  );
}
