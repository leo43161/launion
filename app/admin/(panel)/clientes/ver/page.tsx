"use client";
// La ficha de un cliente (CRM): /admin/clientes/ver/?id=<id>. Lo que compró, lo que pagó y lo que debe, sus notas y recordatorios,
// y sus datos. Desde acá se le carga otra venta (/admin/ventas/nueva/?cliente=<id>) o se le escribe por WhatsApp.
// Las cuentas no incluyen las ventas canceladas, igual que la agenda.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, fecha, fechaHora, hoyISO, numeroVenta, telefonoLindo } from "@/lib/formato";
import { cuandoEntrega, diasHasta, saldo, situacion } from "@/lib/ventas";
import type { Cliente, NotaCliente, OpcionesVenta, Respuestas } from "@/lib/tipos";
import { DatosCliente } from "@/components/DatosCliente";
import { CamposCliente, CamposComercio, aClienteForm, clientePedido, faltanCliente, faltanComercio, type ClienteForm } from "@/components/FormCliente";
import { Icono } from "@/components/Icono";
import { Modal } from "@/components/Modal";
import { useAviso } from "@/components/Avisos";

export default function Pagina() {
  return <Suspense><FichaCliente /></Suspense>;
}

function FichaCliente() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { usuario, puede } = useSesion();
  const avisar = useAviso();
  const [d, setD] = useState<Respuestas["cliente/ficha"] | null>(null);
  const [error, setError] = useState("");
  const [nota, setNota] = useState({ texto: "", recordar_el: "" });
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState<NotaCliente | null>(null);
  const [editar, setEditar] = useState(false);

  const cargar = () => api("cliente/ficha", { query: { id } }).then(setD, (e: Error) => setError(e.message));
  useEffect(() => { cargar(); }, [id]);

  if (!puede("ventas.crear")) return <div className="empty card"><h2>Tu usuario no puede ver los clientes</h2></div>;
  if (error) return <div className="empty card"><Icono n="search" /><h2>{error}</h2><Link className="btn" href="/admin/clientes/">Ver los clientes</Link></div>;
  if (!d) return <p className="muted">Cargando…</p>;

  const c = d.cliente;
  const nombre = `${c.nombre} ${c.apellido}`.trim();
  const activas = d.ventas.filter((v) => v.estado !== "cancelada");
  const suma = (k: "total" | "pagado" | "financiado") => activas.reduce((s, v) => s + Number(v[k]), 0);
  const financiado = suma("financiado");
  const debe = saldo({ total: suma("total"), pagado: suma("pagado") });
  const wa = (c.telefonos.find((t) => t.es_whatsapp) ?? c.telefonos[0])?.numero_completo;
  // Arriba los recordatorios pendientes (el más próximo primero); después las notas y los ya hechos, del más nuevo al más viejo
  const pendiente = (n: NotaCliente) => !!n.recordar_el && !n.hecho_en;
  const notas = [...d.notas.filter(pendiente).sort((a, b) => a.recordar_el!.localeCompare(b.recordar_el!)), ...d.notas.filter((n) => !pendiente(n))];

  /** Guarda un cambio de las notas, avisa y recarga la ficha. */
  async function hacer(pedido: () => Promise<unknown>, texto: string) {
    try {
      await pedido();
      avisar(texto);
      await cargar();
      return true;
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
      return false;
    }
  }
  async function agregar(e: FormEvent) {
    e.preventDefault();
    if (!nota.texto.trim()) return avisar("Escribí la nota.", { tono: "bad" });
    setGuardando(true);
    if (await hacer(() => api("cliente/nota", { body: { cliente_id: c.id, ...nota } }), nota.recordar_el ? "Recordatorio agregado" : "Nota agregada")) setNota({ texto: "", recordar_el: "" });
    setGuardando(false);
  }

  return (
    <>
      <title>{`${nombre} · La Unión`}</title>
      <div className="crumb"><Link href="/admin/clientes/">Clientes</Link><Icono n="right" /><span>{nombre}</span></div>
      <div className="o-head">
        <div className="spread">
          <div>
            <div className="row"><h1>{nombre}</h1>{c.tipo === "negocio" && <span className="badge gold">{c.comercio?.nombre_comercio || "Negocio"}</span>}</div>
            <p className="muted small">{[c.dni && `DNI ${c.dni}`, c.telefonos[0] && telefonoLindo(c.telefonos[0].numero_completo), c.direccion?.localidad].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="row">
            <button type="button" className="btn" onClick={() => setEditar(true)}><Icono n="edit" />Editar datos</button>
            {wa && <a className="btn" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${c.nombre}, te escribimos de La Unión.`)}`} target="_blank" rel="noopener"><Icono n="chat" />WhatsApp</a>}
            <Link className="btn btn-primary" href={`/admin/ventas/nueva/?cliente=${c.id}`}><Icono n="plus" />Nueva venta</Link>
          </div>
        </div>
        <div className="money-sum">
          <div className="kpi"><span>Comprado</span><b className="tnum">{ars(suma("total"))}</b><small>{activas.length} {activas.length === 1 ? "compra" : "compras"}</small></div>
          <div className="kpi"><span>Cobrado</span><b className="tnum">{ars(suma("pagado") - financiado)}</b><small> </small></div>
          <div className="kpi"><span>En cuotas</span><b className="tnum">{ars(financiado)}</b><small>Crédito de la casa</small></div>
          <div className={`kpi ${debe > 0 ? "bad" : activas.length ? "ok" : ""}`}><span>Debe</span><b className="tnum">{debe > 0 ? ars(debe) : activas.length ? "Al día" : "—"}</b><small>{debe > 0 ? "Sin contar las cuotas" : " "}</small></div>
        </div>
      </div>

      <div className="dash-2">
        <div className="stack">
          <section className="card">
            <div className="card-head"><h2>Notas y recordatorios</h2>{d.notas.some(pendiente) && <span className="badge gold">{d.notas.filter(pendiente).length} por hacer</span>}</div>
            <form className="card-body stack-sm" onSubmit={agregar} noValidate>
              <label className="field"><span>Nota *</span>
                <textarea className="textarea" rows={2} style={{ minHeight: 64 }} placeholder="Ej: llamar el lunes para coordinar la entrega" value={nota.texto} onChange={(e) => setNota({ ...nota, texto: e.target.value })} /></label>
              <div className="row" style={{ alignItems: "end" }}>
                <label className="field"><span>Recordármelo el (opcional)</span>
                  <input className="input" type="date" min={hoyISO()} value={nota.recordar_el} onChange={(e) => setNota({ ...nota, recordar_el: e.target.value })} /></label>
                <button className="btn btn-primary" disabled={guardando}><Icono n="plus" />{nota.recordar_el ? "Agregar recordatorio" : "Agregar nota"}</button>
              </div>
              <small className="muted">Con fecha, sale en "Para esta semana" de Clientes hasta que alguien lo marca como hecho.</small>
            </form>
            {notas.length > 0 && <ul className="list" style={{ borderTop: "1px solid var(--line)" }}>{notas.map((n) => {
              const vencido = pendiente(n) && diasHasta(n.recordar_el!) < 0;
              return (
                <li key={n.id} className={`nota ${n.hecho_en ? "hecha" : ""}`}><div className="li" style={{ alignItems: "start" }}>
                  <span style={{ color: pendiente(n) ? "var(--gold-ink)" : "var(--faint)", paddingTop: 2 }}><Icono n={n.recordar_el ? "calendar" : "chat"} /></span>
                  <div className="grow">
                    {n.recordar_el && <div className="small" style={{ fontWeight: 700, color: vencido ? "var(--bad)" : pendiente(n) ? "var(--gold-ink)" : "var(--muted)" }}>Recordar el {fecha(n.recordar_el)}{vencido && " · vencido"}</div>}
                    <div className="nota-txt" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.texto}</div>
                    <span className="cell-sub">{n.creado_por} · {fechaHora(n.creado_en)}{n.hecho_en && ` · Hecho: ${n.hecho_por ?? ""}, ${fechaHora(n.hecho_en)}`}</span>
                  </div>
                  {n.recordar_el && (n.hecho_en
                    ? <button type="button" className="btn btn-sm btn-ghost" onClick={() => hacer(() => api("cliente/nota/estado", { body: { id: n.id, hecha: false } }), "Recordatorio pendiente otra vez")}><Icono n="undo" /><span className="hide-s">Pendiente</span></button>
                    : <button type="button" className="btn btn-sm" onClick={() => hacer(() => api("cliente/nota/estado", { body: { id: n.id, hecha: true } }), "Recordatorio hecho")}><Icono n="check" /><span className="hide-s">Hecho</span></button>)}
                  {(n.creado_por_id === usuario?.id || puede("ventas.anular")) && <button type="button" className="icon-btn" aria-label="Borrar la nota" title="Borrar" onClick={() => setBorrar(n)}><Icono n="trash" /></button>}
                </div></li>
              );
            })}</ul>}
          </section>

          <section className="card">
            <div className="card-head"><h2>Compras</h2><span className="small muted">{d.ventas.length} {d.ventas.length === 1 ? "venta" : "ventas"}</span></div>
            {d.ventas.length ? <div className="table-wrap"><table className="table cards">
              <thead><tr><th>Venta</th><th>Muebles</th><th>Entrega</th><th className="num">Total</th><th className="num">Saldo</th></tr></thead>
              <tbody>{d.ventas.map((v) => {
                const s = situacion(v);
                const falta = saldo(v);
                const href = `/admin/ventas/ver/?id=${v.id}`;
                return (
                  <tr key={v.id} className="click" onClick={() => router.push(href)}>
                    <td><Link className="cell-title" href={href} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none" }}>{numeroVenta(v.numero)}</Link><span className="cell-sub">{fecha(v.vendido_en)} · {v.vendedor}</span></td>
                    <td className="full"><span className="small">{v.muebles}</span></td>
                    <td data-label="Entrega"><span className="nowrap">{fecha(v.fecha_entrega)}</span>
                      <span className="cell-sub">{s.texto === "En curso" || s.texto === "Atrasada" ? <span style={s.texto === "Atrasada" ? { color: "var(--bad)", fontWeight: 700 } : undefined}>{cuandoEntrega(v.fecha_entrega)}</span>
                        : <span className={`badge ${s.tono}`}>{s.texto}</span>}</span></td>
                    <td className="num" data-label="Total">{ars(v.total)}</td>
                    <td className="num right" data-label="Saldo">{v.estado === "cancelada" ? "—" : falta > 0 ? <b>{ars(falta)}</b> : Number(v.financiado) > 0 ? <span className="badge gold">En cuotas</span> : <span className="badge ok">Pagada</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div> : <div className="empty"><p>Todavía no compró.</p></div>}
          </section>
        </div>

        <div className="stack"><DatosCliente c={c} /></div>
      </div>

      {borrar && (
        <Modal titulo="Borrar la nota" alCerrar={() => setBorrar(null)}
          pie={<><button className="btn" type="button" onClick={() => setBorrar(null)}>Cancelar</button>
            <button className="btn btn-dark" type="button" onClick={async () => { if (await hacer(() => api("cliente/nota/eliminar", { body: { id: borrar.id } }), "Nota borrada")) setBorrar(null); }}>Borrar</button></>}>
          <p>¿Borrar “{borrar.texto.length > 80 ? `${borrar.texto.slice(0, 80)}…` : borrar.texto}”? No se puede deshacer.</p>
        </Modal>
      )}
      {editar && <EditarCliente c={c} alCerrar={() => setEditar(false)} alGuardar={() => { setEditar(false); avisar("Datos guardados"); cargar(); }} />}
    </>
  );
}

/** Los mismos campos que el paso 1 (y el 2, si compra para un negocio) de la venta. */
function EditarCliente({ c, alGuardar, alCerrar }: { c: Cliente; alGuardar: () => void; alCerrar: () => void }) {
  const [op, setOp] = useState<OpcionesVenta | null>(null); // localidades y rubros
  const [d, setD] = useState<ClienteForm>(() => aClienteForm(c));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { api("venta/nueva").then(setOp, (e: Error) => setError(e.message)); }, []);
  const cambiar = (x: Partial<ClienteForm>) => { setD((y) => ({ ...y, ...x })); setError(""); };

  async function guardar() {
    const falta = [...faltanCliente(d), ...(d.tipo === "negocio" ? faltanComercio(d) : [])];
    if (falta.length) return setError(`Revisá ${falta.join(", ")}.`);
    setGuardando(true);
    try {
      await api("cliente/guardar", { body: clientePedido(d, c.id) });
      alGuardar();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }
  return (
    <Modal titulo={`Editar datos de ${c.nombre} ${c.apellido}`} ancho alCerrar={alCerrar}
      pie={<><button type="button" className="btn" onClick={alCerrar}>Cancelar</button><button type="button" className="btn btn-primary" disabled={!op || guardando} onClick={guardar}><Icono n="check" />{guardando ? "Guardando…" : "Guardar"}</button></>}>
      {!op ? <p className={error ? "alert bad" : "muted"}>{error || "Cargando…"}</p> : (
        <div className="stack">
          <CamposCliente d={d} op={op} cambiar={cambiar} />
          {d.tipo === "negocio" && <><h3>Datos comerciales</h3><CamposComercio d={d} op={op} cambiar={cambiar} /></>}
          <p className="small muted">Si cambia la dirección se guarda como una nueva: las ventas anteriores conservan la suya.</p>
          {error && <p className="alert bad" role="alert"><Icono n="alert" /><span>{error}</span></p>}
        </div>
      )}
    </Modal>
  );
}
