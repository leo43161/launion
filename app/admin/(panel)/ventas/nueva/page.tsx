"use client";
// Nueva venta en 5 pasos, como la ficha en papel: vendedor y cliente, datos comerciales (solo si compra para un negocio),
// muebles, entrega y plan de pago, y revisar. El borrador queda en la pestaña (sessionStorage) hasta guardar.
// Solo los campos de la ficha que están en la base: sin lugar de venta, cónyuge, mapa ni "entregó".
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { api, media, subir } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, fecha, hoyISO, medidas, norm, normTelefono, numeroVenta, parsePesos, pesos, telefonoLindo } from "@/lib/formato";
import { ESTADO_CIVIL, FRECUENCIA, direccionTexto, textoCuotas } from "@/lib/ventas";
import type { Cliente, ClienteFila, EstadoCivil, Frecuencia, OpcionesVenta, PagoGuardar, ProductoFila, TipoEntrega, VentaGuardar } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { Modal } from "@/components/Modal";
import { useAviso } from "@/components/Avisos";

const BORRADOR = "lu-venta-borrador";
const clave = () => String(Math.random());

/** El formulario guarda todo como texto, como lo escribe la persona. Se convierte al calcular y al guardar. */
interface Dir { calle: string; numero: string; piso: string; departamento: string; barrio: string; localidad_id: string }
interface Tel { k: string; numero: string; es_whatsapp: boolean }
interface Item { k: string; producto_id: number | null; codigo: string; nombre: string; descripcion: string; cantidad: string; precio: string; notas_taller: string; adjuntos: string[]; foto: string | null }
interface Pago { k: string; medio_pago_id: string; monto: string; cuenta_bancaria_id: string; posnet_plan_id: string }
interface Form {
  paso: Paso;
  vendedor_id: string;
  cliente_id: number | null;
  anteriores: { id: number; numero: number }[]; // ventas anteriores del cliente elegido
  nombre: string; apellido: string; dni: string; estado_civil: EstadoCivil | ""; fecha_nacimiento: string; email: string; margen_credito: string;
  telefonos: Tel[];
  direccion: Dir;
  tipo: "casa" | "negocio";
  comercio: { nombre_comercio: string; rubro: string; direccion: Dir };
  items: Item[];
  fecha_entrega: string; tipo_entrega: TipoEntrega; descuento: string; notas: string;
  pagos: Pago[];
  financia: boolean;
  credito: { cuotas: string; monto_cuota: string; frecuencia_cuotas: Frecuencia | ""; fecha_primer_vencimiento: string; referencia: string };
}

type Paso = "cliente" | "comercio" | "muebles" | "pago" | "revisar";
const PASOS: Record<Paso, string> = { cliente: "Vendedor y cliente", comercio: "Datos comerciales", muebles: "Muebles", pago: "Entrega y pago", revisar: "Revisar y guardar" };
const pasosDe = (f: Form): Paso[] => (["cliente", "comercio", "muebles", "pago", "revisar"] as Paso[]).filter((p) => p !== "comercio" || f.tipo === "negocio");

const dirVacia = (localidad = ""): Dir => ({ calle: "", numero: "", piso: "", departamento: "", barrio: "", localidad_id: localidad });
const masDias = (dias: number) => new Date(new Date(hoyISO() + "T00:00").getTime() + dias * 864e5).toISOString().slice(0, 10);
function nuevo(op: OpcionesVenta, empleado: number | null): Form {
  const smt = String(op.localidades.find((l) => l.nombre === "San Miguel de Tucumán")?.id ?? "");
  return {
    paso: "cliente", vendedor_id: empleado ? String(empleado) : "", cliente_id: null, anteriores: [],
    nombre: "", apellido: "", dni: "", estado_civil: "", fecha_nacimiento: "", email: "", margen_credito: "",
    telefonos: [{ k: clave(), numero: "", es_whatsapp: true }], direccion: dirVacia(smt), tipo: "casa",
    comercio: { nombre_comercio: "", rubro: "", direccion: dirVacia() },
    items: [], fecha_entrega: masDias(21), tipo_entrega: "envio", descuento: "", notas: "",
    pagos: [pagoVacio(op)], financia: false,
    credito: { cuotas: "", monto_cuota: "", frecuencia_cuotas: "", fecha_primer_vencimiento: "", referencia: "" },
  };
}
const pagoVacio = (op: OpcionesVenta): Pago => ({ k: clave(), medio_pago_id: String(op.medios.find((m) => m.tipo === "efectivo")?.id ?? op.medios[0]?.id ?? ""), monto: "", cuenta_bancaria_id: String(op.cuentas[0]?.id ?? ""), posnet_plan_id: "" });

const aDir = (d: Cliente["direccion"]): Dir => (d ? { calle: d.calle, numero: d.numero ?? "", piso: d.piso ?? "", departamento: d.departamento ?? "", barrio: d.barrio ?? "", localidad_id: String(d.localidad_id) } : dirVacia());
const dirPedido = (d: Dir) => ({ ...d, localidad_id: Number(d.localidad_id) || null });

/** Plata escrita ("150.000") → número; vacío o mal escrito = 0. */
const plata = (s: string) => { const v = parsePesos(s); return v != null && Number.isFinite(v) ? v : 0; };
const entero = (s: string) => Math.max(0, Math.floor(Number(s.replace(/\D/g, "")) || 0));

/** Las cuentas del resumen, las mismas que hace la API. */
function cuentas(f: Form, op: OpcionesVenta) {
  const subtotal = f.items.reduce((s, x) => s + entero(x.cantidad) * plata(x.precio), 0);
  const total = subtotal - plata(f.descuento);
  const anticipo = f.pagos.reduce((s, p) => s + plata(p.monto), 0);
  const recargo = f.pagos.reduce((s, p) => {
    const plan = op.planes.find((x) => String(x.id) === p.posnet_plan_id);
    return s + (plan && esTarjeta(op, p) ? Math.round(plata(p.monto) * Number(plan.recargo_pct)) / 100 : 0);
  }, 0);
  const financiado = f.financia ? Math.max(0, total - anticipo) : 0;
  const cuotas = entero(f.credito.cuotas);
  const cuota = f.credito.monto_cuota.trim() ? plata(f.credito.monto_cuota) : financiado && cuotas ? Math.ceil(financiado / cuotas) : 0;
  return { subtotal, total, anticipo, recargo, financiado, cuotas, cuota, saldo: total - anticipo - financiado };
}
const tipoMedio = (op: OpcionesVenta, p: Pago) => op.medios.find((m) => String(m.id) === p.medio_pago_id)?.tipo;
const esTarjeta = (op: OpcionesVenta, p: Pago) => tipoMedio(op, p) === "tarjeta_debito" || tipoMedio(op, p) === "tarjeta_credito";
const planesDe = (op: OpcionesVenta, p: Pago) => op.planes.filter((x) => `tarjeta_${x.tipo_tarjeta}` === tipoMedio(op, p));
const planTexto = (x: OpcionesVenta["planes"][number]) => `${x.posnet}${x.marca_tarjeta ? ` · ${x.marca_tarjeta}` : ""} · ${x.cuotas} ${x.cuotas === 1 ? "pago" : "cuotas"}${Number(x.recargo_pct) ? ` · +${String(Number(x.recargo_pct)).replace(".", ",")} %` : ""}`;

/** Lo que falta en cada paso, para avisar antes de seguir. La API vuelve a revisar todo al guardar. */
function faltan(paso: Paso, f: Form, op: OpcionesVenta): string[] {
  const e: string[] = [];
  if (paso === "cliente") {
    if (!f.vendedor_id) e.push("el vendedor");
    if (!f.nombre.trim()) e.push("el nombre");
    if (!f.apellido.trim()) e.push("el apellido");
    if (!/^[0-9A-Za-z]{6,12}$/.test(f.dni.replace(/[\s.-]/g, ""))) e.push("el DNI");
    const tels = f.telefonos.filter((t) => t.numero.trim());
    if (!tels.length || tels.some((t) => !/^549\d{10}$/.test(normTelefono(t.numero)))) e.push("los teléfonos (con código de área, sin 0 ni 15)");
    if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.push("el email");
    if (!f.direccion.calle.trim()) e.push("la calle");
    if (!f.direccion.localidad_id) e.push("la localidad");
  }
  if (paso === "comercio") {
    if (!f.comercio.nombre_comercio.trim()) e.push("el nombre del comercio");
    if (!f.comercio.rubro.trim()) e.push("el rubro");
    const d = f.comercio.direccion;
    if ((d.numero.trim() || d.barrio.trim() || d.localidad_id) && (!d.calle.trim() || !d.localidad_id)) e.push("la calle y la localidad del domicilio comercial (o dejalo vacío)");
  }
  if (paso === "muebles" && !f.items.length) e.push("al menos un mueble");
  if (paso === "pago") {
    const c = cuentas(f, op);
    if (!f.fecha_entrega) e.push("la fecha de entrega");
    if (!f.pagos.length || f.pagos.some((p) => !p.medio_pago_id || plata(p.monto) <= 0)) e.push("el anticipo: cuánto paga hoy y cómo");
    if (c.anticipo > c.total) e.push("el anticipo: supera el total");
    if (plata(f.descuento) > c.subtotal) e.push("el descuento: supera el subtotal");
    if (f.financia) {
      if (c.financiado <= 0) e.push("las cuotas: no queda saldo para financiar");
      if (!c.cuotas) e.push("la cantidad de cuotas");
      if (!f.credito.fecha_primer_vencimiento) e.push("la fecha de la primera cuota");
    }
  }
  if (paso === "revisar") return pasosDe(f).filter((p) => p !== "revisar").flatMap((p) => faltan(p, f, op));
  return e;
}

function aPedido(f: Form): VentaGuardar {
  const pago = (p: Pago): PagoGuardar => ({ medio_pago_id: Number(p.medio_pago_id), monto: parsePesos(p.monto), cuenta_bancaria_id: Number(p.cuenta_bancaria_id) || null, posnet_plan_id: Number(p.posnet_plan_id) || null, referencia: "" });
  return {
    vendedor_id: Number(f.vendedor_id) || null,
    cliente: {
      id: f.cliente_id, nombre: f.nombre, apellido: f.apellido, dni: f.dni, estado_civil: f.estado_civil, fecha_nacimiento: f.fecha_nacimiento,
      telefonos: f.telefonos.filter((t) => t.numero.trim()).map((t) => ({ numero_completo: normTelefono(t.numero), es_whatsapp: t.es_whatsapp })),
      email: f.email, direccion: dirPedido(f.direccion), margen_credito: parsePesos(f.margen_credito), tipo: f.tipo,
      comercio: f.tipo === "negocio" ? { ...f.comercio, direccion: dirPedido(f.comercio.direccion) } : null,
    },
    items: f.items.map((x) => ({ producto_id: x.producto_id, codigo: x.codigo, nombre: x.nombre, descripcion: x.descripcion, cantidad: entero(x.cantidad) || null, precio_unitario: parsePesos(x.precio), notas_taller: x.notas_taller, adjuntos: x.adjuntos })),
    fecha_entrega: f.fecha_entrega, tipo_entrega: f.tipo_entrega, descuento: parsePesos(f.descuento), notas: f.notas,
    pagos: f.pagos.map(pago),
    credito: f.financia ? { cuotas: entero(f.credito.cuotas) || null, monto_cuota: parsePesos(f.credito.monto_cuota), frecuencia_cuotas: f.credito.frecuencia_cuotas, fecha_primer_vencimiento: f.credito.fecha_primer_vencimiento, referencia: f.credito.referencia } : null,
  };
}

export default function NuevaVenta() {
  const { usuario, puede } = useSesion();
  const avisar = useAviso();
  const [op, setOp] = useState<OpcionesVenta | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState(""); // lo que falta para seguir
  const [guardando, setGuardando] = useState(false);
  const [hecha, setHecha] = useState<{ id: number; numero: number } | null>(null);
  const [mueble, setMueble] = useState<{ i: number | null; item: Item } | null>(null); // el que se edita en la ventana
  const [catalogo, setCatalogo] = useState(false);

  useEffect(() => {
    api("venta/nueva").then((r) => {
      setOp(r);
      let borrador: Form | null = null;
      try { borrador = JSON.parse(sessionStorage.getItem(BORRADOR) || "null"); } catch {}
      setF(borrador?.paso ? borrador : nuevo(r, usuario?.empleado_id ?? null));
    }, (e: Error) => setError(e.message));
  }, [usuario?.empleado_id]);
  useEffect(() => { if (f) try { sessionStorage.setItem(BORRADOR, JSON.stringify(f)); } catch {} }, [f]);

  if (!puede("ventas.crear")) return <div className="empty card"><h2>Tu usuario no puede cargar ventas</h2></div>;
  if (error) return <div className="empty card"><h2>{error}</h2><Link className="btn" href="/admin/ventas/">Volver a ventas</Link></div>;
  if (hecha) return <Guardada id={hecha.id} numero={hecha.numero} otra={() => { setHecha(null); setF(nuevo(op!, usuario?.empleado_id ?? null)); }} />;
  if (!f || !op) return <p className="muted">Cargando…</p>;

  const form = f;
  const cambiar = (c: Partial<Form>) => { setF({ ...form, ...c }); setAviso(""); };
  const pasos = pasosDe(form);
  const i = pasos.indexOf(form.paso);
  const ir = (paso: Paso) => { setF({ ...form, paso }); setAviso(""); scrollTo(0, 0); };
  const siguiente = () => {
    const e = faltan(form.paso, form, op);
    if (e.length) return setAviso(`Revisá ${e.join(", ")}.`);
    ir(pasos[i + 1]);
  };
  const c = cuentas(form, op);

  async function guardar() {
    const e = faltan("revisar", form, op!);
    if (e.length) return setAviso(`Revisá ${e.join(", ")}.`);
    setGuardando(true);
    try {
      const r = await api("venta/guardar", { body: aPedido(form) });
      try { sessionStorage.removeItem(BORRADOR); } catch {}
      setHecha(r);
      scrollTo(0, 0);
    } catch (err) {
      setAviso((err as Error).message);
    }
    setGuardando(false);
  }

  const pantalla: Record<Paso, ReactNode> = {
    cliente: <PasoCliente f={form} op={op} cambiar={cambiar} />,
    comercio: <PasoComercio f={form} op={op} cambiar={cambiar} />,
    muebles: (
      <div className="stack">
        <div><h2>Muebles</h2><p className="muted small">Cada mueble que se vende. Del catálogo se completan el código, la descripción, la foto y el precio; a medida, se escriben a mano.</p></div>
        {form.items.length ? form.items.map((x, n) => (
          <div key={x.k} className="card" style={{ display: "grid", gridTemplateColumns: "64px minmax(0,1fr) auto", gap: 12, padding: 12, alignItems: "center" }}>
            {x.foto ? <img className="thumb-lg" src={media(x.foto)} alt="" /> : <span className="thumb-lg" style={{ display: "grid", placeItems: "center", color: "var(--faint)" }}><Icono n="edit" /></span>}
            <div style={{ minWidth: 0 }}>
              <b>{entero(x.cantidad) > 1 && `${entero(x.cantidad)}× `}{x.nombre}</b>{x.codigo && <span className="small muted"> · {x.codigo}</span>}
              <div className="small muted" style={{ overflowWrap: "anywhere" }}>{x.descripcion}</div>
              <div className="small"><b className="tnum">{ars(entero(x.cantidad) * plata(x.precio))}</b>{entero(x.cantidad) > 1 && <span className="muted"> ({ars(plata(x.precio))} c/u)</span>}{x.adjuntos.length > 0 && <span className="muted"> · {x.adjuntos.length} {x.adjuntos.length === 1 ? "foto" : "fotos"}</span>}</div>
            </div>
            <div className="row">
              <button type="button" className="btn btn-sm" onClick={() => setMueble({ i: n, item: x })}><Icono n="edit" /><span className="sr">Editar</span></button>
              <button type="button" className="btn btn-sm btn-ghost" aria-label="Quitar" onClick={() => cambiar({ items: form.items.filter((_, j) => j !== n) })}><Icono n="trash" /></button>
            </div>
          </div>
        )) : <div className="empty" style={{ border: "1.5px dashed var(--line-2)", borderRadius: 14 }}><Icono n="catalog" /><p>Todavía no agregaste muebles.</p></div>}
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => setCatalogo(true)}><Icono n="catalog" />Agregar del catálogo</button>
          <button type="button" className="btn" onClick={() => setMueble({ i: null, item: { k: clave(), producto_id: null, codigo: "", nombre: "", descripcion: "", cantidad: "1", precio: "", notas_taller: "", adjuntos: [], foto: null } })}><Icono n="plus" />Mueble a medida</button>
        </div>
      </div>
    ),
    pago: <PasoPago f={form} op={op} cambiar={cambiar} />,
    revisar: <PasoRevisar f={form} op={op} />,
  };

  return (
    <>
      <title>Nueva venta · La Unión</title>
      <div className="page-head">
        <div><h1>Nueva venta</h1><p>Se carga como la ficha en papel. Al guardar, recibe su número y se puede imprimir para que el cliente la firme.</p></div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (confirm("¿Borrar todo lo cargado y empezar de nuevo?")) { setF(nuevo(op, usuario?.empleado_id ?? null)); setAviso(""); } }}>Empezar de nuevo</button>
      </div>
      <div className="steps"><ol>{pasos.map((p, n) => (
        <li key={p} className={n === i ? "on" : n < i ? "done" : ""}>
          <b>{n < i ? <Icono n="check" /> : n + 1}</b>
          {n < i ? <a href="#" onClick={(e) => { e.preventDefault(); ir(p); }} style={{ color: "inherit" }}>{PASOS[p]}</a> : PASOS[p]}
        </li>
      ))}</ol></div>
      <div className="wiz">
        <div className="card card-pad stack">
          {pantalla[form.paso]}
          {aviso && <p className="alert bad" role="alert"><Icono n="alert" /><span>{aviso}</span></p>}
          <div className="spread" style={{ marginTop: 6 }}>
            {i > 0 ? <button type="button" className="btn" onClick={() => ir(pasos[i - 1])}><Icono n="left" />Volver</button> : <span />}
            {form.paso === "revisar"
              ? <button type="button" className="btn btn-primary btn-lg" disabled={guardando} onClick={guardar}><Icono n="check" />{guardando ? "Guardando…" : "Guardar venta"}</button>
              : <button type="button" className="btn btn-primary btn-lg" onClick={siguiente}>Siguiente: {PASOS[pasos[i + 1]].toLowerCase()}<Icono n="right" /></button>}
          </div>
        </div>
        <aside className="card card-pad summary" aria-label="Resumen de la venta">
          <h2 style={{ marginBottom: 12 }}>Resumen</h2>
          <dl>
            <dt>Cliente</dt><dd>{`${form.nombre} ${form.apellido}`.trim() || "—"}</dd>
            <dt>Muebles</dt><dd>{form.items.reduce((s, x) => s + entero(x.cantidad), 0) || "—"}</dd>
            <dt>Entrega</dt><dd>{fecha(form.fecha_entrega)}</dd>
            <dt>Subtotal</dt><dd>{ars(c.subtotal)}</dd>
            {plata(form.descuento) > 0 && <><dt>Descuento</dt><dd>− {ars(plata(form.descuento))}</dd></>}
            <dt><b>Total</b></dt><dd><b>{ars(c.total)}</b></dd>
            <dt>Anticipo hoy</dt><dd>{c.anticipo ? ars(c.anticipo) : "—"}</dd>
            {c.recargo > 0 && <><dt>Recargo de tarjeta</dt><dd>{ars(c.recargo)}</dd></>}
            {form.financia && <><dt>En {c.cuotas || "?"} cuotas</dt><dd>{ars(c.financiado)}</dd></>}
            <dt><b>Saldo</b></dt><dd><b>{ars(c.saldo)}</b></dd>
          </dl>
        </aside>
      </div>

      {catalogo && <ElegirModelo alCerrar={() => setCatalogo(false)} alElegir={async (p) => {
        setCatalogo(false);
        let descripcion = "";
        try { descripcion = (await api("producto", { query: { id: String(p.id) } })).producto.descripcion ?? ""; } catch {}
        const med = medidas(p);
        setMueble({ i: null, item: { k: clave(), producto_id: p.id, codigo: p.codigo ?? "", nombre: p.nombre, descripcion: descripcion || [p.nombre, med].filter(Boolean).join(" · "),
          cantidad: "1", precio: p.precio_local ? pesos(p.precio_local) : "", notas_taller: "", adjuntos: [], foto: p.foto } });
      }} />}
      {mueble && <EditarMueble inicial={mueble.item} alCerrar={() => setMueble(null)} alGuardar={(x) => {
        cambiar({ items: mueble.i === null ? [...form.items, x] : form.items.map((y, j) => (j === mueble.i ? x : y)) });
        setMueble(null);
        avisar(mueble.i === null ? "Mueble agregado" : "Mueble actualizado");
      }} />}
    </>
  );
}

/* ---------- paso 1 · vendedor y cliente ---------- */

function PasoCliente({ f, op, cambiar }: { f: Form; op: OpcionesVenta; cambiar: (c: Partial<Form>) => void }) {
  const [q, setQ] = useState("");
  const [encontrados, setEncontrados] = useState<ClienteFila[] | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) return setEncontrados(null);
    const t = setTimeout(() => api("clientes", { query: { q } }).then((r) => setEncontrados(r.clientes), () => setEncontrados([])), 250);
    return () => clearTimeout(t);
  }, [q]);

  async function elegir(id: number) {
    const { cliente: x, ventas } = await api("cliente", { query: { id: String(id) } });
    cambiar({
      cliente_id: x.id, anteriores: ventas, nombre: x.nombre, apellido: x.apellido, dni: x.dni ?? "", estado_civil: x.estado_civil ?? "", fecha_nacimiento: x.fecha_nacimiento ?? "",
      email: x.email ?? "", margen_credito: x.margen_credito == null ? "" : pesos(x.margen_credito),
      telefonos: x.telefonos.length ? x.telefonos.map((t) => ({ k: clave(), numero: telefonoLindo(t.numero_completo), es_whatsapp: !!t.es_whatsapp })) : [{ k: clave(), numero: "", es_whatsapp: true }],
      direccion: aDir(x.direccion), tipo: x.tipo,
      comercio: x.comercio ? { nombre_comercio: x.comercio.nombre_comercio ?? "", rubro: x.comercio.rubro ?? "", direccion: aDir(x.comercio.direccion) } : f.comercio,
    });
    setQ("");
  }
  const campo = (k: "nombre" | "apellido" | "dni" | "email" | "fecha_nacimiento") => ({ value: f[k], onChange: (e: { target: { value: string } }) => cambiar({ [k]: e.target.value }) });
  const tel = (n: number, c: Partial<Tel>) => cambiar({ telefonos: f.telefonos.map((t, j) => (j === n ? { ...t, ...c } : t)) });
  const area = op.localidades.find((l) => String(l.id) === f.direccion.localidad_id)?.codigo_area ?? "381";

  return (
    <div className="stack">
      <h2>Vendedor y cliente</h2>
      <label className="field" style={{ maxWidth: 360 }}><span>Vendedor</span>
        <select className="select" value={f.vendedor_id} onChange={(e) => cambiar({ vendedor_id: e.target.value })}>
          <option value="">Elegí quién vendió</option>
          {op.vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
        </select></label>

      {f.cliente_id ? (
        <div className="alert info"><Icono n="info" /><div className="grow">
          <b>Cliente de la agenda.</b> Si cambiás algún dato, se actualiza al guardar la venta.
          {f.anteriores.length > 0 && <div className="small">Compró antes: {f.anteriores.map((v, n) => <span key={v.id}>{n > 0 && ", "}<Link href={`/admin/ventas/ver/?id=${v.id}`} target="_blank">{numeroVenta(v.numero)}</Link></span>)}</div>}
        </div><button type="button" className="btn btn-sm" onClick={() => { const n = nuevo(op, null); cambiar({ ...n, paso: f.paso, vendedor_id: f.vendedor_id, items: f.items, pagos: f.pagos, fecha_entrega: f.fecha_entrega }); }}>Es otro cliente</button></div>
      ) : (
        <div className="stack-sm">
          <label className="gsearch" style={{ width: "100%" }}><Icono n="search" /><span className="sr">Buscar cliente</span>
            <input type="search" placeholder="¿Ya compró? Buscalo por nombre, DNI o teléfono" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" /></label>
          {encontrados && (encontrados.length ? (
            <div className="pick">{encontrados.map((x) => (
              <button key={x.id} type="button" onClick={() => elegir(x.id)}>
                <span className="grow" style={{ textAlign: "left" }}><b>{x.nombre}</b><br /><span className="small muted">{[x.dni && `DNI ${x.dni}`, telefonoLindo(x.telefono), x.localidad].filter(Boolean).join(" · ")}</span></span><Icono n="right" />
              </button>))}</div>
          ) : <p className="small muted">No hay clientes con “{q}”. Cargalo abajo como cliente nuevo.</p>)}
        </div>
      )}

      <div className="grid-2">
        <label className="field"><span>Nombre</span><input className="input" autoComplete="off" {...campo("nombre")} /></label>
        <label className="field"><span>Apellido</span><input className="input" autoComplete="off" {...campo("apellido")} /></label>
        <label className="field"><span>DNI</span><input className="input" inputMode="numeric" placeholder="30123456" autoComplete="off" {...campo("dni")} /></label>
        <label className="field"><span>Estado civil (opcional)</span>
          <select className="select" value={f.estado_civil} onChange={(e) => cambiar({ estado_civil: e.target.value as EstadoCivil | "" })}>
            <option value="">—</option>{Object.entries(ESTADO_CIVIL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="field"><span>Fecha de nacimiento (opcional)</span><input className="input" type="date" max={hoyISO()} {...campo("fecha_nacimiento")} /></label>
        <label className="field"><span>Email (opcional)</span><input className="input" type="email" autoComplete="off" placeholder="Para mandarle las novedades del pedido" {...campo("email")} /></label>
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 6 }}>Teléfonos</legend>
        <div className="stack-sm">{f.telefonos.map((t, n) => (
          <div key={t.k} className="row" style={{ flexWrap: "nowrap" }}>
            <input className="input" inputMode="tel" placeholder={`${area} 555-1203`} aria-label={`Teléfono ${n + 1}`} value={t.numero} style={{ maxWidth: 220 }}
              onChange={(e) => tel(n, { numero: e.target.value })}
              onBlur={(e) => { const v = normTelefono(e.target.value); if (/^549\d{10}$/.test(v)) tel(n, { numero: telefonoLindo(v) }); }} />
            <label className="check"><input type="checkbox" checked={t.es_whatsapp} onChange={(e) => tel(n, { es_whatsapp: e.target.checked })} />WhatsApp</label>
            {f.telefonos.length > 1 && <button type="button" className="icon-btn" aria-label={`Quitar teléfono ${n + 1}`} onClick={() => cambiar({ telefonos: f.telefonos.filter((_, j) => j !== n) })}><Icono n="trash" /></button>}
          </div>))}
          <div><button type="button" className="btn btn-sm" onClick={() => cambiar({ telefonos: [...f.telefonos, { k: clave(), numero: "", es_whatsapp: false }] })}><Icono n="plus" />Otro teléfono</button></div>
          <small className="muted">Con código de área, sin 0 ni 15. El primero es el principal.</small>
        </div>
      </fieldset>

      <CamposDireccion titulo="Dirección" d={f.direccion} op={op} piso cambiar={(d) => cambiar({ direccion: d })} />

      <div className="grid-2" style={{ alignItems: "end" }}>
        <label className="field"><span>Margen de crédito (opcional)</span>
          <span className="input-money"><span>$</span><input inputMode="numeric" value={f.margen_credito} placeholder="0"
            onChange={(e) => cambiar({ margen_credito: e.target.value })} onBlur={(e) => { const v = parsePesos(e.target.value); if (v != null && Number.isFinite(v)) cambiar({ margen_credito: pesos(v) }); }} /></span></label>
        <div className="field"><span>Compra para</span>
          <div className="seg" role="group">
            <button type="button" aria-pressed={f.tipo === "casa"} onClick={() => cambiar({ tipo: "casa" })}>Su casa</button>
            <button type="button" aria-pressed={f.tipo === "negocio"} onClick={() => cambiar({ tipo: "negocio" })}>Un negocio</button>
          </div></div>
      </div>
    </div>
  );
}

function CamposDireccion({ titulo, d, op, piso = false, cambiar }: { titulo: string; d: Dir; op: OpcionesVenta; piso?: boolean; cambiar: (d: Dir) => void }) {
  const campo = (k: keyof Dir) => ({ value: d[k], onChange: (e: { target: { value: string } }) => cambiar({ ...d, [k]: e.target.value }) });
  const loc = op.localidades.find((l) => String(l.id) === d.localidad_id);
  const provincias = [...new Set(op.localidades.map((l) => l.provincia))];
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ marginBottom: 6 }}>{titulo}</legend>
      <div className="grid-4">
        <label className="field" style={{ gridColumn: "span 2" }}><span>Calle</span><input className="input" autoComplete="off" {...campo("calle")} /></label>
        <label className="field"><span>Número</span><input className="input" autoComplete="off" {...campo("numero")} /></label>
        {piso ? <>
          <label className="field"><span>Piso y depto.</span>
            <span className="row" style={{ flexWrap: "nowrap", gap: 6 }}><input className="input" aria-label="Piso" placeholder="Piso" {...campo("piso")} /><input className="input" aria-label="Departamento" placeholder="Depto." {...campo("departamento")} /></span></label>
        </> : <span />}
        <label className="field" style={{ gridColumn: "span 2" }}><span>Barrio</span><input className="input" autoComplete="off" {...campo("barrio")} /></label>
        <label className="field" style={{ gridColumn: "span 2" }}><span>Localidad</span>
          <select className="select" {...campo("localidad_id")}>
            <option value="">Elegí la localidad</option>
            {provincias.map((p) => <optgroup key={p} label={p}>{op.localidades.filter((l) => l.provincia === p).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</optgroup>)}
          </select>
          {loc && <small>{loc.provincia}{loc.codigo_area && ` · código de área ${loc.codigo_area}`}</small>}</label>
      </div>
    </fieldset>
  );
}

/* ---------- paso 2 · datos comerciales ---------- */

function PasoComercio({ f, op, cambiar }: { f: Form; op: OpcionesVenta; cambiar: (c: Partial<Form>) => void }) {
  const m = f.comercio;
  const poner = (c: Partial<Form["comercio"]>) => cambiar({ comercio: { ...m, ...c } });
  return (
    <div className="stack">
      <div><h2>Datos comerciales</h2><p className="muted small">El cliente compra para su negocio.</p></div>
      <div className="grid-2">
        <label className="field"><span>Nombre del comercio</span><input className="input" placeholder="Kiosco El Paso" value={m.nombre_comercio} onChange={(e) => poner({ nombre_comercio: e.target.value })} /></label>
        <label className="field"><span>Rubro</span><input className="input" list="rubros" placeholder="Kiosco" value={m.rubro} onChange={(e) => poner({ rubro: e.target.value })} />
          <datalist id="rubros">{op.rubros.map((r) => <option key={r} value={r} />)}</datalist></label>
      </div>
      <CamposDireccion titulo="Domicilio comercial (opcional, si es distinto del de la casa)" d={m.direccion} op={op} cambiar={(d) => poner({ direccion: d })} />
    </div>
  );
}

/* ---------- paso 3 · muebles ---------- */

function ElegirModelo({ alElegir, alCerrar }: { alElegir: (p: ProductoFila) => void; alCerrar: () => void }) {
  const [datos, setDatos] = useState<{ productos: ProductoFila[]; tipos: Map<number, string> } | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    api("catalogo").then((r) => setDatos({ productos: r.productos.filter((p) => !p.eliminado), tipos: new Map(r.categorias.map((c): [number, string] => [c.id, c.nombre])) }), () => setDatos({ productos: [], tipos: new Map() }));
  }, []);
  const nq = norm(q.trim());
  const lista = (datos?.productos ?? []).filter((p) => !nq || nq.split(/\s+/).every((t) => norm(`${p.nombre} ${p.codigo ?? ""} ${datos?.tipos.get(p.categoria_id) ?? ""}`).includes(t))).slice(0, 40);
  return (
    <Modal titulo="Elegí del catálogo" ancho alCerrar={alCerrar}>
      <div className="stack-sm">
        <input className="input" placeholder="Buscar: cómoda, maquillador, caramelera, código…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        {!datos ? <p className="muted">Cargando…</p> : lista.length ? (
          <div className="pick">{lista.map((p) => (
            <button key={p.id} type="button" onClick={() => alElegir(p)}>
              {p.foto ? <img className="thumb" src={media(p.foto)} alt="" loading="lazy" /> : <span className="thumb" />}
              <span className="grow" style={{ textAlign: "left" }}><b>{p.nombre}</b><br /><span className="small muted">{[p.codigo, datos.tipos.get(p.categoria_id), medidas(p)].filter(Boolean).join(" · ")}</span></span>
              <span className="tnum small">{p.precio_local ? ars(p.precio_local) : ""}</span>
            </button>))}</div>
        ) : <p className="muted">No hay modelos con esa búsqueda. Cargalo como mueble a medida.</p>}
      </div>
    </Modal>
  );
}

function EditarMueble({ inicial, alGuardar, alCerrar }: { inicial: Item; alGuardar: (x: Item) => void; alCerrar: () => void }) {
  const avisar = useAviso();
  const [x, setX] = useState(inicial);
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState("");
  const poner = (c: Partial<Item>) => { setX((y) => ({ ...y, ...c })); setError(""); };
  async function fotos(archivos: FileList) {
    for (const a of Array.from(archivos)) {
      setSubiendo((n) => n + 1);
      try { const url = await subir(a, undefined, "ventas"); setX((y) => ({ ...y, adjuntos: [...y.adjuntos, url] })); }
      catch (e) { avisar((e as Error).message, { tono: "bad", ms: 6000 }); }
      setSubiendo((n) => n - 1);
    }
  }
  function listo() {
    if (!x.nombre.trim()) return setError("Escribí qué se fabrica.");
    if (!x.descripcion.trim()) return setError("Escribí la descripción: medidas, materiales y colores.");
    if (entero(x.cantidad) < 1) return setError("La cantidad tiene que ser 1 o más.");
    const p = parsePesos(x.precio);
    if (p == null || !Number.isFinite(p)) return setError("Escribí el precio de una unidad.");
    alGuardar(x);
  }
  return (
    <Modal titulo={x.producto_id ? x.nombre : inicial.nombre ? "Editar mueble" : "Mueble a medida"} ancho alCerrar={alCerrar}
      pie={<><button type="button" className="btn" onClick={alCerrar}>Cancelar</button><button type="button" className="btn btn-primary" disabled={subiendo > 0} onClick={listo}>{subiendo ? "Subiendo fotos…" : "Listo"}</button></>}>
      <div className="stack">
        {x.foto && <div className="row"><img className="thumb-lg" src={media(x.foto)} alt="" /><span className="small muted">Del catálogo. Cambiá lo que el cliente pida distinto.</span></div>}
        <div className="grid-4">
          <label className="field" style={{ gridColumn: "span 3" }}><span>Qué se fabrica</span><input className="input" value={x.nombre} placeholder="Placard a medida" onChange={(e) => poner({ nombre: e.target.value })} /></label>
          <label className="field"><span>Código</span><input className="input" value={x.codigo} placeholder="CO-8C" onChange={(e) => poner({ codigo: e.target.value })} /></label>
        </div>
        <label className="field"><span>Descripción</span><textarea className="textarea" rows={3} value={x.descripcion} placeholder="Cómoda 8 cajones, 140 × 90 × 40 cm, melamina blanca y roble Dakar" onChange={(e) => poner({ descripcion: e.target.value })} /></label>
        <div className="grid-3">
          <label className="field"><span>Cantidad</span><input className="input" inputMode="numeric" value={x.cantidad} onChange={(e) => poner({ cantidad: e.target.value.replace(/\D/g, "") })} /></label>
          <label className="field"><span>Precio de una unidad</span><span className="input-money"><span>$</span><input inputMode="numeric" value={x.precio} placeholder="0"
            onChange={(e) => poner({ precio: e.target.value })} onBlur={(e) => { const v = parsePesos(e.target.value); if (v != null && Number.isFinite(v)) poner({ precio: pesos(v) }); }} /></span></label>
          <div className="field"><span>Subtotal</span><div className="input" style={{ display: "flex", alignItems: "center", background: "var(--surface-2)" }}><b className="tnum">{ars(entero(x.cantidad) * plata(x.precio))}</b></div></div>
        </div>
        <label className="field"><span>Notas para el taller (opcional)</span><textarea className="textarea" rows={2} value={x.notas_taller} placeholder="Tiradores negros, espejo del lado derecho…" onChange={(e) => poner({ notas_taller: e.target.value })} /></label>
        <div className="field"><span>Fotos del lugar o croquis (opcional)</span>
          <div className="attach">
            {x.adjuntos.map((a, n) => (
              <span key={a} style={{ position: "relative" }}><img src={media(a)} alt={`Foto ${n + 1}`} />
                <button type="button" className="icon-btn" aria-label={`Quitar foto ${n + 1}`} onClick={() => poner({ adjuntos: x.adjuntos.filter((y) => y !== a) })}
                  style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, background: "var(--ink)", color: "var(--bg)", borderRadius: "50%" }}><Icono n="x" /></button></span>))}
            <label className="btn" style={{ height: 72 }}><Icono n="upload" />{subiendo ? "Subiendo…" : "Subir fotos"}
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) fotos(e.target.files); e.target.value = ""; }} /></label>
          </div></div>
        {error && <p className="alert bad" role="alert"><Icono n="alert" /><span>{error}</span></p>}
      </div>
    </Modal>
  );
}

/* ---------- paso 4 · entrega y plan de pago ---------- */

function PasoPago({ f, op, cambiar }: { f: Form; op: OpcionesVenta; cambiar: (c: Partial<Form>) => void }) {
  const c = cuentas(f, op);
  const pago = (n: number, cambio: Partial<Pago>) => cambiar({ pagos: f.pagos.map((p, j) => (j === n ? { ...p, ...cambio } : p)) });
  const credito = (cambio: Partial<Form["credito"]>) => cambiar({ credito: { ...f.credito, ...cambio } });
  const hayCredito = op.medios.some((m) => m.tipo === "credito_casa");
  const dinero = (valor: string, poner: (v: string) => void, etiqueta: string) => (
    <span className="input-money"><span>$</span><input inputMode="numeric" aria-label={etiqueta} value={valor} placeholder="0"
      onChange={(e) => poner(e.target.value)} onBlur={(e) => { const v = parsePesos(e.target.value); if (v != null && Number.isFinite(v)) poner(pesos(v)); }} /></span>
  );
  return (
    <div className="stack">
      <h2>Entrega y plan de pago</h2>
      <div className="grid-2">
        <label className="field"><span>Entrega prometida</span><input className="input" type="date" value={f.fecha_entrega} onChange={(e) => cambiar({ fecha_entrega: e.target.value })} /></label>
        <div className="field"><span>Entrega</span>
          <div className="seg" role="group">
            <button type="button" aria-pressed={f.tipo_entrega === "envio"} onClick={() => cambiar({ tipo_entrega: "envio" })}><Icono n="truck" /> Envío e instalación</button>
            <button type="button" aria-pressed={f.tipo_entrega === "retiro"} onClick={() => cambiar({ tipo_entrega: "retiro" })}><Icono n="store" /> Retira en el showroom</button>
          </div>
          {f.tipo_entrega === "envio" && <small>En {direccionTexto({ ...f.direccion, numero: f.direccion.numero || null, piso: f.direccion.piso || null, departamento: f.direccion.departamento || null, barrio: f.direccion.barrio || null, localidad: op.localidades.find((l) => String(l.id) === f.direccion.localidad_id)?.nombre ?? "" })}</small>}
        </div>
      </div>
      <label className="field" style={{ maxWidth: 280 }}><span>Descuento (opcional)</span>{dinero(f.descuento, (v) => cambiar({ descuento: v }), "Descuento")}<small>Total: <b className="tnum">{ars(c.total)}</b></small></label>

      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "4px 0" }} />
      <div><h3>Anticipo</h3><p className="small muted">Lo que paga hoy. Se puede repartir: una parte en efectivo y otra con tarjeta, por ejemplo.</p></div>
      {f.pagos.map((p, n) => {
        const tipo = tipoMedio(op, p);
        const planes = planesDe(op, p);
        const plan = op.planes.find((x) => String(x.id) === p.posnet_plan_id);
        const recargo = plan && esTarjeta(op, p) ? Math.round(plata(p.monto) * Number(plan.recargo_pct)) / 100 : 0;
        return (
          <div key={p.k} className="stack-sm" style={{ paddingBottom: 10, borderBottom: "1px solid var(--line-2)" }}>
            <div className="grid-3" style={{ alignItems: "end" }}>
              <label className="field"><span>Cómo paga</span>
                <select className="select" value={p.medio_pago_id} onChange={(e) => pago(n, { medio_pago_id: e.target.value, posnet_plan_id: "" })}>
                  {op.medios.filter((m) => m.tipo !== "credito_casa").map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select></label>
              <label className="field"><span>Monto</span>{dinero(p.monto, (v) => pago(n, { monto: v }), `Monto del anticipo ${n + 1}`)}</label>
              {tipo === "transferencia" && op.cuentas.length > 0 && <label className="field"><span>A qué cuenta entró</span>
                <select className="select" value={p.cuenta_bancaria_id} onChange={(e) => pago(n, { cuenta_bancaria_id: e.target.value })}>
                  {op.cuentas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </select></label>}
              {esTarjeta(op, p) && planes.length > 0 && <label className="field"><span>Posnet y cuotas</span>
                <select className="select" value={p.posnet_plan_id} onChange={(e) => pago(n, { posnet_plan_id: e.target.value })}>
                  <option value="">Sin recargo</option>
                  {planes.map((x) => <option key={x.id} value={x.id}>{planTexto(x)}</option>)}
                </select></label>}
            </div>
            <div className="spread">
              <span className="small muted">{recargo > 0 && plan ? `Con recargo se cobran ${ars(plata(p.monto) + recargo)}${plan.cuotas > 1 ? `: ${plan.cuotas} cuotas de ${ars((plata(p.monto) + recargo) / plan.cuotas)}` : ""}` : ""}</span>
              {f.pagos.length > 1 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => cambiar({ pagos: f.pagos.filter((_, j) => j !== n) })}><Icono n="trash" />Quitar</button>}
            </div>
          </div>
        );
      })}
      <div><button type="button" className="btn btn-sm" onClick={() => cambiar({ pagos: [...f.pagos, pagoVacio(op)] })}><Icono n="plus" />Otra forma de pago</button></div>

      {hayCredito && <>
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "4px 0" }} />
        <label className="check"><input type="checkbox" checked={f.financia} onChange={(e) => cambiar({ financia: e.target.checked })} />
          <span>Paga el resto en cuotas (crédito de la casa){c.total - c.anticipo > 0 && <>: <b className="tnum">{ars(c.total - c.anticipo)}</b></>}</span></label>
        {f.financia && (
          <div className="grid-3">
            <label className="field"><span>Cantidad de cuotas</span><input className="input" inputMode="numeric" value={f.credito.cuotas} onChange={(e) => credito({ cuotas: e.target.value.replace(/\D/g, "") })} /></label>
            <label className="field"><span>Valor de cada cuota</span>
              <span className="input-money"><span>$</span><input inputMode="numeric" value={f.credito.monto_cuota} placeholder={c.financiado && c.cuotas ? pesos(Math.ceil(c.financiado / c.cuotas)) : "0"}
                onChange={(e) => credito({ monto_cuota: e.target.value })} onBlur={(e) => { const v = parsePesos(e.target.value); if (v != null && Number.isFinite(v)) credito({ monto_cuota: pesos(v) }); }} /></span>
              <small>Vacío: el resto dividido por las cuotas.</small></label>
            <label className="field"><span>Tipo (opcional)</span>
              <select className="select" value={f.credito.frecuencia_cuotas} onChange={(e) => credito({ frecuencia_cuotas: e.target.value as Frecuencia | "" })}>
                <option value="">—</option>{Object.entries(FRECUENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="field"><span>Fecha de inicio</span><input className="input" type="date" value={f.credito.fecha_primer_vencimiento} onChange={(e) => credito({ fecha_primer_vencimiento: e.target.value })} /><small>Cuándo vence la primera cuota.</small></label>
            <label className="field"><span>Crédito Nº (opcional)</span><input className="input" value={f.credito.referencia} onChange={(e) => credito({ referencia: e.target.value })} /></label>
          </div>
        )}
      </>}

      <label className="field"><span>Notas de la venta (opcional)</span><textarea className="textarea" rows={2} value={f.notas} placeholder="Ej: llamar antes de ir" onChange={(e) => cambiar({ notas: e.target.value })} /></label>
    </div>
  );
}

/* ---------- paso 5 · revisar ---------- */

function PasoRevisar({ f, op }: { f: Form; op: OpcionesVenta }) {
  const c = cuentas(f, op);
  const loc = (d: Dir) => op.localidades.find((l) => String(l.id) === d.localidad_id);
  const dir = (d: Dir) => direccionTexto({ calle: d.calle, numero: d.numero || null, piso: d.piso || null, departamento: d.departamento || null, barrio: d.barrio || null, localidad: loc(d)?.nombre ?? "" });
  const medio = (p: Pago) => {
    const plan = op.planes.find((x) => String(x.id) === p.posnet_plan_id);
    const cuenta = op.cuentas.find((x) => String(x.id) === p.cuenta_bancaria_id);
    return [op.medios.find((m) => String(m.id) === p.medio_pago_id)?.nombre, tipoMedio(op, p) === "transferencia" && cuenta?.nombre, esTarjeta(op, p) && plan && planTexto(plan)].filter(Boolean).join(" · ");
  };
  return (
    <div className="stack">
      <div><h2>Revisá con el cliente</h2><p className="muted small">Si algo no está bien, tocá el paso arriba para corregirlo.</p></div>
      <dl className="specs">
        <dt>Vendedor</dt><dd>{op.vendedores.find((v) => String(v.id) === f.vendedor_id)?.nombre}</dd>
        <dt>Cliente</dt><dd>{f.nombre} {f.apellido} · DNI {f.dni}{f.estado_civil && ` · ${ESTADO_CIVIL[f.estado_civil]}`}{f.fecha_nacimiento && ` · nació el ${fecha(f.fecha_nacimiento)}`}</dd>
        <dt>Teléfonos</dt><dd>{f.telefonos.filter((t) => t.numero.trim()).map((t) => `${t.numero}${t.es_whatsapp ? " (WhatsApp)" : ""}`).join(", ")}</dd>
        {f.email && <><dt>Email</dt><dd>{f.email}</dd></>}
        <dt>Dirección</dt><dd>{dir(f.direccion)}{loc(f.direccion) && `, ${loc(f.direccion)!.provincia}`}</dd>
        {f.margen_credito && <><dt>Margen de crédito</dt><dd>{ars(plata(f.margen_credito))}</dd></>}
        {f.tipo === "negocio" && <><dt>Comercio</dt><dd>{f.comercio.nombre_comercio} · {f.comercio.rubro}{f.comercio.direccion.calle && ` · ${dir(f.comercio.direccion)}`}</dd></>}
      </dl>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Mueble</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
        <tbody>{f.items.map((x) => (
          <tr key={x.k}><td><b>{x.nombre}</b>{x.codigo && <span className="muted"> · {x.codigo}</span>}<div className="small muted">{x.descripcion}</div>{x.notas_taller && <div className="small">Taller: {x.notas_taller}</div>}</td>
            <td className="num">{entero(x.cantidad)}</td><td className="num">{ars(plata(x.precio))}</td><td className="num">{ars(entero(x.cantidad) * plata(x.precio))}</td></tr>))}
        </tbody>
      </table></div>
      <dl className="specs">
        {plata(f.descuento) > 0 && <><dt>Descuento</dt><dd>− {ars(plata(f.descuento))}</dd></>}
        <dt>Total</dt><dd><b>{ars(c.total)}</b></dd>
        <dt>Anticipo</dt><dd>{f.pagos.map((p) => `${ars(plata(p.monto))} (${medio(p)})`).join(" + ")}</dd>
        {f.financia && <><dt>Cuotas</dt><dd>{textoCuotas(c.cuotas, f.credito.frecuencia_cuotas)} de {ars(c.cuota)}, desde el {fecha(f.credito.fecha_primer_vencimiento)}{f.credito.referencia && ` · Crédito Nº ${f.credito.referencia}`}</dd></>}
        {c.saldo > 0 && <><dt>Saldo</dt><dd>{ars(c.saldo)}, a cobrar después</dd></>}
        <dt>Entrega</dt><dd>{fecha(f.fecha_entrega)} · {f.tipo_entrega === "retiro" ? "Retira en el showroom" : "Envío e instalación"}</dd>
        {f.notas && <><dt>Notas</dt><dd>{f.notas}</dd></>}
      </dl>
      <div className="alert info"><Icono n="info" /><span>Al guardar, la venta recibe su número, el cliente queda en la agenda con sus datos y se registran los cobros del anticipo. Después se puede imprimir la ficha para que el cliente la firme.</span></div>
    </div>
  );
}

/* ---------- guardada ---------- */

function Guardada({ id, numero, otra }: { id: number; numero: number; otra: () => void }) {
  return (
    <div className="card success">
      <title>Venta registrada · La Unión</title>
      <span className="big-check"><Icono n="check" /></span>
      <h1>Venta registrada</h1>
      <p className="muted">Número de venta</p>
      <div className="num">{numeroVenta(numero)}</div>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link className="btn btn-primary btn-lg" href={`/admin/ventas/imprimir/?id=${id}`}><Icono n="print" />Imprimir la ficha</Link>
        <Link className="btn btn-lg" href={`/admin/ventas/ver/?id=${id}`}>Ver la venta</Link>
      </div>
      <button type="button" className="btn btn-ghost" onClick={otra}><Icono n="plus" />Otra venta</button>
    </div>
  );
}
