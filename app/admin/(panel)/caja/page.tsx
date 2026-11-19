"use client";
// Caja: el efectivo del showroom. /admin/caja/ muestra la caja abierta o, si no hay, el formulario para abrirla; ?id=<id>, una caja ya cerrada.
// Los cobros en efectivo de las ventas entran solos (con la caja cerrada esperan y entran al abrir la próxima). Los egresos (flete,
// insumos, adelantos…) y otros ingresos se cargan a mano. Al cerrar se cuenta el efectivo, por billete o el total; si no cuadra, se anota por qué.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, fecha, fechaHora, numeroVenta, parsePesos, pesos } from "@/lib/formato";
import type { CajaRubro, CajaSesion, Respuestas } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { Modal } from "@/components/Modal";
import { useAviso } from "@/components/Avisos";

const BILLETES = [20000, 10000, 2000, 1000, 500, 200, 100];

/** Plata escrita ("150.000") → número; vacío o mal escrito = 0. */
const plata = (s: string) => { const v = parsePesos(s); return v != null && Number.isFinite(v) ? v : 0; };
const diferencia = (s: CajaSesion) => Math.round((Number(s.monto_contado) - Number(s.esperado)) * 100) / 100;
/** "Cuadra", "Faltan $ 1.000", "Sobran $ 500" */
const textoDiferencia = (d: number) => (d === 0 ? "Cuadra" : d < 0 ? `Faltan ${ars(-d)}` : `Sobran ${ars(d)}`);
const tonoDiferencia = (d: number) => (d === 0 ? "ok" : d > 0 ? "warn" : "bad");

export default function Pagina() {
  return <Suspense><Caja /></Suspense>;
}

function Caja() {
  const id = useSearchParams().get("id") ?? "";
  const { puede } = useSesion();
  const avisar = useAviso();
  const [d, setD] = useState<Respuestas["caja"] | null>(null);
  const [error, setError] = useState("");
  const [inicial, setInicial] = useState("");
  const [abriendo, setAbriendo] = useState(false);

  const cargar = () => api("caja", { query: id ? { id } : undefined }).then((r) => {
    setD(r);
    if (r.sesion?.cerrada_en) setInicial(r.sesion.monto_contado == null ? "" : pesos(r.sesion.monto_contado)); // arranca con lo que quedó
  }, (e: Error) => setError(e.message));
  useEffect(() => { setD(null); cargar(); }, [id]);

  if (!puede("caja.usar")) return <div className="empty card"><h2>Tu usuario no puede usar la caja</h2></div>;
  if (error) return <div className="empty card"><Icono n="alert" /><h2>{error}</h2><Link className="btn" href="/admin/caja/">Ir a la caja</Link></div>;
  if (!d) return <p className="muted">Cargando…</p>;

  const s = d.sesion;
  async function abrir() {
    const monto = parsePesos(inicial);
    if (monto == null || !Number.isFinite(monto)) return avisar("Poné con cuánto efectivo arranca la caja.", { tono: "bad" });
    setAbriendo(true);
    try {
      await api("caja/abrir", { body: { monto_inicial: monto } });
      avisar("Caja abierta");
      await cargar();
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
    }
    setAbriendo(false);
  }

  // Sin caja abierta (y sin ?id): abrirla, con el resumen de la última
  if (!id && (!s || s.cerrada_en)) return (
    <>
      <title>Caja · La Unión</title>
      <div className="page-head">
        <div><h1>Caja</h1><p>El efectivo del showroom. Está cerrada.</p></div>
        <Link className="btn" href="/admin/caja/historial/"><Icono n="calendar" />Historial</Link>
      </div>
      <div className="stack" style={{ maxWidth: 560 }}>
        {s && <Cierre s={s} ver />}
        <section className="card card-pad stack">
          <h2>Abrir la caja</h2>
          <p className="muted">Contá el efectivo con el que arranca: el cambio que quedó de la última caja.</p>
          <label className="field" style={{ maxWidth: 280 }}><span>Efectivo inicial *</span>
            <span className="input-money"><span>$</span><input inputMode="numeric" value={inicial} placeholder="0" autoFocus
              onChange={(e) => setInicial(e.target.value)} onBlur={(e) => { const v = parsePesos(e.target.value); if (v != null && Number.isFinite(v)) setInicial(pesos(v)); }} /></span></label>
          {d.pendientes.cobros > 0 && <div className="alert info"><Icono n="info" /><span>Hay {d.pendientes.cobros} {d.pendientes.cobros === 1 ? "cobro" : "cobros"} en efectivo de ventas por <b>{ars(d.pendientes.total)}</b> que se {d.pendientes.cobros === 1 ? "registró" : "registraron"} con la caja cerrada: entran a esta caja.</span></div>}
          <div><button type="button" className="btn btn-primary btn-lg" disabled={abriendo} onClick={abrir}><Icono n="check" />{abriendo ? "Abriendo…" : "Abrir la caja"}</button></div>
        </section>
      </div>
    </>
  );
  if (!s) return null;
  return <VerCaja d={d} s={s} recargar={cargar} />;
}

/** Una caja: la abierta (con sus acciones) o una ya cerrada. */
function VerCaja({ d, s, recargar }: { d: Respuestas["caja"]; s: CajaSesion; recargar: () => Promise<unknown> }) {
  const { usuario, puede } = useSesion();
  const avisar = useAviso();
  const [ventana, setVentana] = useState<null | "movimiento" | "cerrar">(null);
  const abierta = !s.cerrada_en;
  const cobros = d.movimientos.filter((m) => m.cobro_id && !m.anulado_en).length;
  const entro = Number(s.cobros) + Number(s.otros_ingresos);

  async function borrar(id: number) {
    try {
      await api("caja/movimiento/eliminar", { body: { id } });
      avisar("Movimiento borrado");
      recargar();
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
    }
  }

  return (
    <>
      <title>{abierta ? "Caja · La Unión" : `Caja del ${fecha(s.abierta_en)} · La Unión`}</title>
      {!abierta && <div className="crumb"><Link href="/admin/caja/historial/">Historial de caja</Link><Icono n="right" /><span>{fecha(s.abierta_en)}</span></div>}
      <div className="page-head">
        <div>
          <div className="row"><h1>{abierta ? "Caja" : `Caja del ${fecha(s.abierta_en)}`}</h1><span className={`badge ${abierta ? "ok" : ""}`}>{abierta ? "Abierta" : "Cerrada"}</span></div>
          <p>Abrió {s.abierta_por} el {fechaHora(s.abierta_en)}{s.cerrada_en && ` · cerró ${s.cerrada_por} el ${fechaHora(s.cerrada_en)}`}.</p>
        </div>
        <div className="row">
          <Link className="btn" href="/admin/caja/historial/"><Icono n="calendar" />Historial</Link>
          {abierta && <>
            <button type="button" className="btn" onClick={() => setVentana("movimiento")}><Icono n="plus" />Registrar movimiento</button>
            <button type="button" className="btn btn-primary" onClick={() => setVentana("cerrar")}><Icono n="check" />Cerrar la caja</button>
          </>}
        </div>
      </div>

      <div className="stack">
        {!abierta && <Cierre s={s} otros={d.otros_medios} />}
        <div className="kpis">
          <div className="kpi"><span>Efectivo inicial</span><b className="tnum">{ars(s.monto_inicial)}</b><small> </small></div>
          <div className="kpi"><span>Entró</span><b className="tnum">{ars(entro)}</b><small>{cobros} {cobros === 1 ? "cobro" : "cobros"} de ventas{Number(s.otros_ingresos) > 0 && ` y ${ars(s.otros_ingresos)} más`}</small></div>
          <div className="kpi"><span>Salió</span><b className="tnum">{ars(s.egresos)}</b><small>Egresos</small></div>
          <div className="kpi"><span>{abierta ? "Tiene que haber" : "Tenía que haber"}</span><b className="tnum">{ars(s.esperado)}</b><small>{abierta ? "En efectivo, ahora" : `Se contó ${ars(s.monto_contado ?? 0)}`}</small></div>
        </div>
        {d.otros_medios.length > 0 && (
          <p className="small muted">Además, mientras estuvo abierta se cobró con otros medios, que no pasan por la caja (se controlan en el banco):{" "}
            {d.otros_medios.map((x) => `${x.medio} ${ars(x.total)} (${x.cobros})`).join(" · ")}.</p>
        )}

        <section className="card">
          <div className="card-head"><h2>Movimientos</h2><span className="small muted">{d.movimientos.length}</span></div>
          {d.movimientos.length ? <div className="table-wrap"><table className="table cards">
            <thead><tr><th>Hora</th><th>Concepto</th><th>Registró</th><th className="num">Monto</th>{abierta && <th />}</tr></thead>
            <tbody>{d.movimientos.map((m) => {
              const negativo = m.tipo === "egreso";
              return (
                <tr key={m.id} style={m.anulado_en ? { opacity: .55 } : undefined}>
                  <td className="nowrap">{fechaHora(m.hora)}</td>
                  <td className="full">
                    {m.venta_id ? <><Link className="cell-title" href={`/admin/ventas/ver/?id=${m.venta_id}`}>Cobro {numeroVenta(m.venta_numero ?? 0)}</Link><span className="cell-sub">{m.cliente}{m.anulado_en && <span style={{ color: "var(--bad)" }}> · Anulado: no suma</span>}</span></>
                      : <><span className="cell-title">{m.rubro}</span>{m.descripcion && <span className="cell-sub">{m.descripcion}</span>}</>}
                  </td>
                  <td className="hide-m small">{m.creado_por}</td>
                  <td className="num right" data-label="Monto"><b className="tnum" style={{ color: negativo ? "var(--bad)" : undefined, textDecoration: m.anulado_en ? "line-through" : undefined }}>{negativo ? "− " : "+ "}{ars(m.monto)}</b></td>
                  {abierta && <td>{!m.cobro_id && (m.creado_por_id === usuario?.id || puede("caja.anular")) &&
                    <button type="button" className="icon-btn" aria-label={`Borrar ${m.rubro}`} title="Borrar" onClick={() => borrar(m.id)}><Icono n="trash" /></button>}</td>}
                </tr>
              );
            })}</tbody>
          </table></div> : <div className="empty"><p>Todavía no hay movimientos. Los cobros en efectivo de las ventas entran solos.</p></div>}
        </section>
      </div>

      {ventana === "movimiento" && <Movimiento rubros={d.rubros} esperado={Number(s.esperado)} alCerrar={() => setVentana(null)} alGuardar={() => { setVentana(null); avisar("Movimiento registrado"); recargar(); }} />}
      {ventana === "cerrar" && <Cerrar s={s} alCerrar={() => setVentana(null)} alGuardar={() => { setVentana(null); avisar("Caja cerrada"); recargar(); }} />}
    </>
  );
}

/** El resultado de una caja cerrada: si cuadró, y para mandarlo por WhatsApp. ver: con link a la caja (desde "Abrir la caja"). */
function Cierre({ s, otros = [], ver = false }: { s: CajaSesion; otros?: Respuestas["caja"]["otros_medios"]; ver?: boolean }) {
  const dif = diferencia(s);
  const texto = [
    `Cierre de caja La Unión · ${fecha(s.abierta_en)}`,
    `Efectivo inicial: ${ars(s.monto_inicial)}`,
    `Cobros en efectivo: ${ars(s.cobros)}`,
    Number(s.otros_ingresos) > 0 && `Otros ingresos: ${ars(s.otros_ingresos)}`,
    `Egresos: ${ars(s.egresos)}`,
    `Tenía que haber: ${ars(s.esperado)}`,
    `Se contó: ${ars(s.monto_contado ?? 0)} (${textoDiferencia(dif).toLowerCase()})`,
    s.motivo_diferencia && `Motivo: ${s.motivo_diferencia}`,
    ...otros.map((x) => `${x.medio}: ${ars(x.total)}`),
    `Cerró ${s.cerrada_por}`,
  ].filter(Boolean).join("\n");
  return (
    <div className={`alert ${dif === 0 ? "ok" : dif > 0 ? "warn" : "bad"}`}>
      <Icono n={dif === 0 ? "check" : "alert"} />
      <div className="grow">
        <b>{ver ? "La última caja" : "La caja"} cerró el {fechaHora(s.cerrada_en)}: {textoDiferencia(dif).toLowerCase()}.</b>
        {" "}Se contaron {ars(s.monto_contado ?? 0)} de {ars(s.esperado)}.{s.motivo_diferencia && ` Motivo: ${s.motivo_diferencia}`}
      </div>
      <div className="row">
        {ver && <Link className="btn btn-sm" href={`/admin/caja/?id=${s.id}`}>Ver</Link>}
        <a className="btn btn-sm" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener"><Icono n="chat" />Compartir</a>
      </div>
    </div>
  );
}

/** Un ingreso o un egreso cargado a mano. */
function Movimiento({ rubros, esperado, alGuardar, alCerrar }: { rubros: CajaRubro[]; esperado: number; alGuardar: () => void; alCerrar: () => void }) {
  const [f, setF] = useState({ tipo: "egreso" as CajaRubro["tipo"], rubro: "", monto: "", descripcion: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const lista = rubros.filter((r) => r.tipo === f.tipo);
  async function guardar() {
    const monto = plata(f.monto);
    if (!f.rubro) return setError("Elegí el rubro.");
    if (monto <= 0) return setError("Poné el monto.");
    if (f.tipo === "egreso" && monto > esperado) return setError(`En la caja tiene que haber ${ars(esperado)}: no alcanza.`);
    setGuardando(true);
    try {
      await api("caja/movimiento", { body: { tipo: f.tipo, caja_rubro_id: Number(f.rubro), monto, descripcion: f.descripcion } });
      alGuardar();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }
  return (
    <Modal titulo="Registrar movimiento" alCerrar={alCerrar}
      pie={<><button type="button" className="btn" onClick={alCerrar}>Cancelar</button><button type="button" className="btn btn-primary" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : f.tipo === "egreso" ? "Registrar egreso" : "Registrar ingreso"}</button></>}>
      <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <div className="seg" role="group" aria-label="Tipo de movimiento" style={{ justifySelf: "start" }}>
          <button type="button" aria-pressed={f.tipo === "egreso"} onClick={() => setF({ ...f, tipo: "egreso", rubro: "" })}>Sale plata</button>
          <button type="button" aria-pressed={f.tipo === "ingreso"} onClick={() => setF({ ...f, tipo: "ingreso", rubro: "" })}>Entra plata</button>
        </div>
        <label className="field"><span>Rubro *</span>
          <select className="select" value={f.rubro} onChange={(e) => { setF({ ...f, rubro: e.target.value }); setError(""); }}>
            <option value="">Elegí el rubro</option>{lista.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select></label>
        <label className="field"><span>Monto en efectivo *</span>
          <span className="input-money"><span>$</span><input inputMode="numeric" value={f.monto} placeholder="0"
            onChange={(e) => { setF({ ...f, monto: e.target.value }); setError(""); }} onBlur={(e) => { const v = parsePesos(e.target.value); if (v != null && Number.isFinite(v)) setF({ ...f, monto: pesos(v) }); }} /></span></label>
        <label className="field"><span>Detalle (opcional)</span><input className="input" maxLength={160} value={f.descripcion} placeholder={f.tipo === "egreso" ? "Ej: flete a Yerba Buena, tornillos…" : "Ej: cambio que trajo el dueño"}
          onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></label>
        {error && <p className="alert bad" role="alert"><Icono n="alert" /><span>{error}</span></p>}
      </form>
    </Modal>
  );
}

/** Contar el efectivo (por billete o el total), compararlo con lo esperado y cerrar. Si no cuadra, pide el motivo. */
function Cerrar({ s, alGuardar, alCerrar }: { s: CajaSesion; alGuardar: () => void; alCerrar: () => void }) {
  const [modo, setModo] = useState<"billetes" | "total">("billetes");
  const [billetes, setBilletes] = useState<Record<number, string>>({});
  const [otros, setOtros] = useState(""); // monedas y billetes que no están en la lista
  const [total, setTotal] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const contado = modo === "billetes" ? BILLETES.reduce((t, b) => t + b * (Number(billetes[b]) || 0), 0) + plata(otros) : plata(total);
  const esperado = Number(s.esperado);
  const dif = Math.round((contado - esperado) * 100) / 100;

  async function cerrar() {
    if (dif !== 0 && !motivo.trim()) return setError("No cuadra: escribí por qué.");
    setGuardando(true);
    try {
      await api("caja/cerrar", { body: { monto_contado: contado, motivo } });
      alGuardar();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }
  const dinero = (valor: string, poner: (v: string) => void, etiqueta: string) => (
    <span className="input-money"><span>$</span><input inputMode="numeric" aria-label={etiqueta} value={valor} placeholder="0"
      onChange={(e) => { poner(e.target.value); setError(""); }} onBlur={(e) => { const v = parsePesos(e.target.value); if (v != null && Number.isFinite(v)) poner(pesos(v)); }} /></span>
  );
  return (
    <Modal titulo="Cerrar la caja" ancho alCerrar={alCerrar}
      pie={<><button type="button" className="btn" onClick={alCerrar}>Cancelar</button><button type="button" className="btn btn-primary" disabled={guardando} onClick={cerrar}><Icono n="check" />{guardando ? "Cerrando…" : "Cerrar la caja"}</button></>}>
      <div className="stack">
        <p className="muted">Contá el efectivo que hay en la caja. Transferencias y tarjetas no se cuentan: se controlan en el banco.</p>
        <div className="seg" role="group" aria-label="Cómo contar" style={{ justifySelf: "start" }}>
          <button type="button" aria-pressed={modo === "billetes"} onClick={() => setModo("billetes")}>Por billete</button>
          <button type="button" aria-pressed={modo === "total"} onClick={() => setModo("total")}>El total</button>
        </div>
        {modo === "billetes" ? (
          <div className="bills">
            {BILLETES.map((b) => (
              <label key={b}><span className="tnum"><b>{ars(b)}</b></span>
                <input className="input tnum" type="number" min={0} inputMode="numeric" placeholder="0" aria-label={`Cantidad de billetes de ${ars(b)}`} value={billetes[b] ?? ""}
                  onChange={(e) => { setBilletes({ ...billetes, [b]: e.target.value.replace(/\D/g, "") }); setError(""); }} />
                <span className="sub">{ars(b * (Number(billetes[b]) || 0))}</span></label>
            ))}
            <label><span>Monedas y otros</span>{dinero(otros, setOtros, "Monedas y otros")}<span /></label>
          </div>
        ) : <label className="field" style={{ maxWidth: 280 }}><span>Efectivo contado *</span>{dinero(total, setTotal, "Efectivo contado")}</label>}
        <div className="compare">
          <div><span>Efectivo inicial</span><span>{ars(s.monto_inicial)}</span></div>
          <div><span>+ Entró</span><span>{ars(Number(s.cobros) + Number(s.otros_ingresos))}</span></div>
          <div><span>− Salió</span><span>{ars(s.egresos)}</span></div>
          <div className="total"><span>Tiene que haber</span><span>{ars(esperado)}</span></div>
          <div className="total"><span>Contaste</span><span>{ars(contado)}</span></div>
        </div>
        <div className={`diff ${tonoDiferencia(dif)}`}>{textoDiferencia(dif)}</div>
        {dif !== 0 && <label className="field"><span>¿Por qué no cuadra? *</span><textarea className="textarea" rows={2} value={motivo} placeholder="Ej: faltan $ 1.000 del vuelto del flete" onChange={(e) => { setMotivo(e.target.value); setError(""); }} /></label>}
        <p className="small muted">Después de cerrar, los movimientos de esta caja no se pueden cambiar: una corrección se carga en la caja siguiente.</p>
        {error && <p className="alert bad" role="alert"><Icono n="alert" /><span>{error}</span></p>}
      </div>
    </Modal>
  );
}
