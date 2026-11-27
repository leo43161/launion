"use client";
// Los datos del cliente como en la ficha en papel: los usan los pasos 1 y 2 de la venta y "Editar datos" en la ficha del cliente.
// El formulario guarda todo como texto, como lo escribe la persona; clientePedido() lo convierte para la API (cliente_validar en ventas.php).
import type { ChangeEvent } from "react";
import { hoyISO, normTelefono, parsePesos, pesos, telefonoLindo } from "@/lib/formato";
import { ESTADO_CIVIL } from "@/lib/ventas";
import type { Cliente, EstadoCivil, OpcionesVenta, VentaGuardar } from "@/lib/tipos";
import { Icono } from "./Icono";
import { Telefono } from "./Telefono";

export interface Dir { calle: string; numero: string; piso: string; departamento: string; barrio: string; localidad_id: string }
export interface Tel { k: string; numero: string; es_whatsapp: boolean } // numero: "381 319-6842" (components/Telefono)
export interface ClienteForm {
  nombre: string; apellido: string; dni: string; estado_civil: EstadoCivil | ""; fecha_nacimiento: string; email: string; margen_credito: string;
  telefonos: Tel[];
  direccion: Dir;
  tipo: "casa" | "negocio";
  comercio: { nombre_comercio: string; rubro: string; direccion: Dir };
}

export const clave = () => String(Math.random());
export const dirVacia = (localidad = ""): Dir => ({ calle: "", numero: "", piso: "", departamento: "", barrio: "", localidad_id: localidad });
const aDir = (d: Cliente["direccion"]): Dir => (d ? { calle: d.calle, numero: d.numero ?? "", piso: d.piso ?? "", departamento: d.departamento ?? "", barrio: d.barrio ?? "", localidad_id: String(d.localidad_id) } : dirVacia());
const dirPedido = (d: Dir) => ({ ...d, localidad_id: Number(d.localidad_id) || null });

/** Cliente nuevo: vive en San Miguel de Tucumán hasta que digan otra cosa. */
export function clienteVacio(op: OpcionesVenta): ClienteForm {
  const smt = String(op.localidades.find((l) => l.nombre === "San Miguel de Tucumán")?.id ?? "");
  return {
    nombre: "", apellido: "", dni: "", estado_civil: "", fecha_nacimiento: "", email: "", margen_credito: "",
    telefonos: [{ k: clave(), numero: "", es_whatsapp: true }], direccion: dirVacia(smt), tipo: "casa",
    comercio: { nombre_comercio: "", rubro: "", direccion: dirVacia() },
  };
}

/** Un cliente de la agenda, para el formulario. comercio: el que ya estaba cargado, si el cliente no tiene uno. */
export const aClienteForm = (x: Cliente, comercio: ClienteForm["comercio"] = { nombre_comercio: "", rubro: "", direccion: dirVacia() }): ClienteForm => ({
  nombre: x.nombre, apellido: x.apellido, dni: x.dni ?? "", estado_civil: x.estado_civil ?? "", fecha_nacimiento: x.fecha_nacimiento ?? "",
  email: x.email ?? "", margen_credito: x.margen_credito == null ? "" : pesos(x.margen_credito),
  telefonos: x.telefonos.length ? x.telefonos.map((t) => ({ k: clave(), numero: telefonoLindo(t.numero_completo), es_whatsapp: !!t.es_whatsapp })) : [{ k: clave(), numero: "", es_whatsapp: true }],
  direccion: aDir(x.direccion), tipo: x.tipo,
  comercio: x.comercio ? { nombre_comercio: x.comercio.nombre_comercio ?? "", rubro: x.comercio.rubro ?? "", direccion: aDir(x.comercio.direccion) } : comercio,
});

/** Lo que falta o está mal en los datos personales, para avisar antes de seguir. La API vuelve a revisar todo.
    estricto: campos obligatorios extra del formulario de ventas (no del CRM). */
export function faltanCliente(d: ClienteForm, estricto = false): string[] {
  const e: string[] = [];
  if (!d.nombre.trim()) e.push("el nombre");
  if (!d.apellido.trim()) e.push("el apellido");
  if (!/^[0-9A-Za-z]{6,12}$/.test(d.dni.replace(/[\s.-]/g, ""))) e.push("el DNI");
  if (estricto && !d.fecha_nacimiento) e.push("la fecha de nacimiento");
  const tels = d.telefonos.filter((t) => t.numero.trim());
  if (!tels.length || tels.some((t) => !/^549\d{10}$/.test(normTelefono(t.numero)))) e.push("los teléfonos (con código de área, sin 0 ni 15)");
  if (d.email.trim() && !/^\S+@\S+\.\S+$/.test(d.email.trim())) e.push("el email");
  if (!d.direccion.calle.trim()) e.push("la calle");
  if (!d.direccion.localidad_id) e.push("la localidad");
  return e;
}

/** Lo que falta en los datos comerciales (solo si compra para un negocio).
    estricto (ventas): el domicilio comercial y el barrio son obligatorios. */
export function faltanComercio(d: ClienteForm, estricto = false): string[] {
  const e: string[] = [];
  if (!d.comercio.nombre_comercio.trim()) e.push("el nombre del comercio");
  if (!d.comercio.rubro.trim()) e.push("el rubro");
  const x = d.comercio.direccion;
  if (estricto) {
    if (!x.calle.trim()) e.push("la calle del domicilio comercial");
    if (!x.barrio.trim()) e.push("el barrio del comercio");
    if (!x.localidad_id) e.push("la localidad del comercio");
  } else if ((x.numero.trim() || x.barrio.trim() || x.localidad_id) && (!x.calle.trim() || !x.localidad_id)) {
    e.push("la calle y la localidad del domicilio comercial (o dejalo vacío)");
  }
  return e;
}

export const clientePedido = (d: ClienteForm, id: number | null): VentaGuardar["cliente"] => ({
  id, nombre: d.nombre, apellido: d.apellido, dni: d.dni, estado_civil: d.estado_civil, fecha_nacimiento: d.fecha_nacimiento,
  telefonos: d.telefonos.filter((t) => t.numero.trim()).map((t) => ({ numero_completo: normTelefono(t.numero), es_whatsapp: t.es_whatsapp })),
  email: d.email, direccion: dirPedido(d.direccion), margen_credito: parsePesos(d.margen_credito), tipo: d.tipo,
  comercio: d.tipo === "negocio" ? { ...d.comercio, direccion: dirPedido(d.comercio.direccion) } : null,
});

interface Props { d: ClienteForm; op: OpcionesVenta; cambiar: (c: Partial<ClienteForm>) => void; estricto?: boolean }

/** Nombre, DNI, teléfonos, dirección, margen de crédito y si compra para la casa o para un negocio.
    estricto (ventas): marca como obligatorios la fecha de nacimiento y, en el comercio, el domicilio y el barrio. */
export function CamposCliente({ d, op, cambiar, estricto = false }: Props) {
  const campo = (k: "nombre" | "apellido" | "dni" | "email" | "fecha_nacimiento") => ({ value: d[k], onChange: (e: ChangeEvent<HTMLInputElement>) => cambiar({ [k]: e.target.value }) });
  const tel = (n: number, c: Partial<Tel>) => cambiar({ telefonos: d.telefonos.map((t, j) => (j === n ? { ...t, ...c } : t)) });
  const area = op.localidades.find((l) => String(l.id) === d.direccion.localidad_id)?.codigo_area ?? "381";
  return (
    <>
      <div className="grid-2">
        <label className="field"><span>Nombre *</span><input className="input" autoComplete="off" {...campo("nombre")} /></label>
        <label className="field"><span>Apellido *</span><input className="input" autoComplete="off" {...campo("apellido")} /></label>
        <label className="field"><span>DNI *</span><input className="input" inputMode="numeric" placeholder="30123456" autoComplete="off" {...campo("dni")} /></label>
        <label className="field"><span>Estado civil (opcional)</span>
          <select className="select" value={d.estado_civil} onChange={(e) => cambiar({ estado_civil: e.target.value as EstadoCivil | "" })}>
            <option value="">—</option>{Object.entries(ESTADO_CIVIL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <label className="field"><span>Fecha de nacimiento{estricto ? " *" : " (opcional)"}</span><input className="input" type="date" max={hoyISO()} {...campo("fecha_nacimiento")} /></label>
        <label className="field"><span>Email (opcional)</span><input className="input" type="email" autoComplete="off" placeholder="Para mandarle las novedades del pedido" {...campo("email")} /></label>
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 6 }}>Teléfonos *</legend>
        <div className="stack-sm">{d.telefonos.map((t, n) => (
          <div key={t.k} className="row" style={{ flexWrap: "nowrap", alignItems: "start" }}>
            <Telefono valor={t.numero} area={area} etiqueta={`Teléfono ${n + 1}`} alCambiar={(v) => tel(n, { numero: v })} />
            <label className="check" style={{ height: 40 }}><input type="checkbox" checked={t.es_whatsapp} onChange={(e) => tel(n, { es_whatsapp: e.target.checked })} />WhatsApp</label>
            {d.telefonos.length > 1 && <button type="button" className="icon-btn" style={{ marginTop: 2 }} aria-label={`Quitar teléfono ${n + 1}`} onClick={() => cambiar({ telefonos: d.telefonos.filter((_, j) => j !== n) })}><Icono n="trash" /></button>}
          </div>))}
          <div><button type="button" className="btn btn-sm" onClick={() => cambiar({ telefonos: [...d.telefonos, { k: clave(), numero: "", es_whatsapp: false }] })}><Icono n="plus" />Otro teléfono</button></div>
          <small className="muted">El código de área es el de la localidad: cambialo si el número es de otro lado. Sin 0 ni 15. El primero es el principal.</small>
        </div>
      </fieldset>

      <CamposDireccion titulo="Dirección" d={d.direccion} op={op} piso obligatorias={["calle", "localidad_id"]} cambiar={(x) => cambiar({ direccion: x })} />

      <div className="grid-2" style={{ alignItems: "end" }}>
        <label className="field"><span>Margen de crédito (opcional)</span>
          <span className="input-money"><span>$</span><input inputMode="numeric" value={d.margen_credito} placeholder="0"
            onChange={(e) => cambiar({ margen_credito: e.target.value })} onBlur={(e) => { const v = parsePesos(e.target.value); if (v != null && Number.isFinite(v)) cambiar({ margen_credito: pesos(v) }); }} /></span></label>
        <div className="field"><span>Compra para</span>
          <div className="seg" role="group">
            <button type="button" aria-pressed={d.tipo === "casa"} onClick={() => cambiar({ tipo: "casa" })}>Su casa</button>
            <button type="button" aria-pressed={d.tipo === "negocio"} onClick={() => cambiar({ tipo: "negocio" })}>Un negocio</button>
          </div></div>
      </div>
    </>
  );
}

/** Nombre del comercio, rubro y domicilio comercial. */
export function CamposComercio({ d, op, cambiar, estricto = false }: Props) {
  const m = d.comercio;
  const poner = (c: Partial<ClienteForm["comercio"]>) => cambiar({ comercio: { ...m, ...c } });
  return (
    <>
      <div className="grid-2">
        <label className="field"><span>Nombre del comercio *</span><input className="input" placeholder="Kiosco El Paso" value={m.nombre_comercio} onChange={(e) => poner({ nombre_comercio: e.target.value })} /></label>
        <label className="field"><span>Rubro *</span><input className="input" list="rubros" placeholder="Kiosco" value={m.rubro} onChange={(e) => poner({ rubro: e.target.value })} />
          <datalist id="rubros">{op.rubros.map((r) => <option key={r} value={r} />)}</datalist></label>
      </div>
      <CamposDireccion titulo={estricto ? "Domicilio comercial" : "Domicilio comercial (opcional, si es distinto del de la casa)"} d={m.direccion} op={op}
        obligatorias={estricto ? ["calle", "barrio", "localidad_id"] : []} cambiar={(x) => poner({ direccion: x })} />
    </>
  );
}

function CamposDireccion({ titulo, d, op, piso = false, obligatorias = [], cambiar }: { titulo: string; d: Dir; op: OpcionesVenta; piso?: boolean; obligatorias?: (keyof Dir)[]; cambiar: (d: Dir) => void }) {
  const campo = (k: keyof Dir) => ({ value: d[k], onChange: (e: { target: { value: string } }) => cambiar({ ...d, [k]: e.target.value }) });
  const req = (k: keyof Dir) => (obligatorias.includes(k) ? " *" : "");
  const loc = op.localidades.find((l) => String(l.id) === d.localidad_id);
  const provincias = [...new Set(op.localidades.map((l) => l.provincia))];
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ marginBottom: 6 }}>{titulo}</legend>
      <div className="grid-4">
        <label className="field" style={{ gridColumn: "span 2" }}><span>Calle{req("calle")}</span><input className="input" autoComplete="off" {...campo("calle")} /></label>
        <label className="field"><span>Número</span><input className="input" autoComplete="off" {...campo("numero")} /></label>
        {piso ? <>
          <label className="field"><span>Piso y depto.</span>
            <span className="row" style={{ flexWrap: "nowrap", gap: 6 }}><input className="input" aria-label="Piso" placeholder="Piso" {...campo("piso")} /><input className="input" aria-label="Departamento" placeholder="Depto." {...campo("departamento")} /></span></label>
        </> : <span />}
        <label className="field" style={{ gridColumn: "span 2" }}><span>Barrio{req("barrio")}</span><input className="input" autoComplete="off" {...campo("barrio")} /></label>
        <label className="field" style={{ gridColumn: "span 2" }}><span>Localidad{req("localidad_id")}</span>
          <select className="select" {...campo("localidad_id")}>
            <option value="">Elegí la localidad</option>
            {provincias.map((p) => <optgroup key={p} label={p}>{op.localidades.filter((l) => l.provincia === p).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</optgroup>)}
          </select>
          {loc && <small>{loc.provincia}{loc.codigo_area && ` · código de área ${loc.codigo_area}`}</small>}</label>
      </div>
    </fieldset>
  );
}
