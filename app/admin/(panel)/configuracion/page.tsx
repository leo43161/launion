"use client";
// Configuración del negocio para las ventas: cuentas donde entran las transferencias, posnets con sus recargos y localidades.
// Cada lista se guarda entera. Lo que ya usa una venta no se borra: queda desactivado.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { dec, parseDec } from "@/lib/formato";
import type { Configuracion, TipoTarjeta } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { useAviso } from "@/components/Avisos";

const nueva = () => String(Math.random()); // clave para React de una fila sin guardar

interface CuentaFila { k: string; id?: number; nombre: string; banco: string; titular: string; cbu_cvu: string; alias: string; activo: boolean }
interface PlanFila { k: string; id?: number; tipo_tarjeta: TipoTarjeta; marca_tarjeta: string; cuotas: string; recargo_pct: string; activo: boolean }
interface PosnetFila { k: string; id?: number; nombre: string; proveedor: string; cuenta_liquidacion_id: number | null; activo: boolean; planes: PlanFila[] }
interface LocalidadFila { k: string; id?: number; nombre: string; provincia: string; codigo_area: string; codigo_postal: string }
interface Filas { cuentas: CuentaFila[]; posnets: PosnetFila[]; localidades: LocalidadFila[] }

const aFilas = (c: Configuracion): Filas => ({
  cuentas: c.cuentas.map((x) => ({ k: String(x.id), id: x.id, nombre: x.nombre, banco: x.banco ?? "", titular: x.titular ?? "", cbu_cvu: x.cbu_cvu ?? "", alias: x.alias ?? "", activo: !!x.activo })),
  posnets: c.posnets.map((p) => ({
    k: String(p.id), id: p.id, nombre: p.nombre, proveedor: p.proveedor ?? "", cuenta_liquidacion_id: p.cuenta_liquidacion_id, activo: !!p.activo,
    planes: p.planes.map((x) => ({ k: String(x.id), id: x.id, tipo_tarjeta: x.tipo_tarjeta, marca_tarjeta: x.marca_tarjeta ?? "", cuotas: String(x.cuotas), recargo_pct: dec(x.recargo_pct), activo: !!x.activo })),
  })),
  localidades: c.localidades.map((x) => ({ k: String(x.id), id: x.id, nombre: x.nombre, provincia: x.provincia, codigo_area: x.codigo_area ?? "", codigo_postal: x.codigo_postal ?? "" })),
});

const planVacio = (): PlanFila => ({ k: nueva(), tipo_tarjeta: "credito", marca_tarjeta: "", cuotas: "1", recargo_pct: "", activo: true });

function Seccion({ titulo, texto, cambios, guardando, alGuardar, agregar, children }:
  { titulo: string; texto: string; cambios: boolean; guardando: boolean; alGuardar: () => void; agregar: ReactNode; children: ReactNode }) {
  return (
    <form className="card card-pad stack" noValidate onSubmit={(e: FormEvent) => { e.preventDefault(); alGuardar(); }}>
      <div><h2>{titulo}</h2><p className="small muted">{texto}</p></div>
      {children}
      <div className="spread">
        {agregar}
        <button className="btn btn-primary" disabled={guardando || !cambios}><Icono n="check" />{guardando ? "Guardando…" : "Guardar"}</button>
      </div>
    </form>
  );
}

export default function ConfiguracionPagina() {
  const { puede } = useSesion();
  const avisar = useAviso();
  const [f, setF] = useState<Filas | null>(null);
  const [error, setError] = useState("");
  const [cambios, setCambios] = useState<Record<keyof Filas, boolean>>({ cuentas: false, posnets: false, localidades: false });
  const [guardando, setGuardando] = useState<keyof Filas | null>(null);

  useEffect(() => { api("configuracion").then((r) => setF(aFilas(r)), (e: Error) => setError(e.message)); }, []);

  if (!puede("configuracion.editar")) return <div className="empty card"><h2>Solo el administrador puede cambiar la configuración</h2></div>;
  if (error) return <div className="empty card"><h2>{error}</h2></div>;
  if (!f) return <p className="muted">Cargando…</p>;
  const filas = f;

  const poner = (cambio: Partial<Filas>) => {
    setF({ ...filas, ...cambio });
    setCambios({ ...cambios, ...Object.fromEntries(Object.keys(cambio).map((k) => [k, true])) });
  };
  const cuenta = (i: number, c: Partial<CuentaFila>) => poner({ cuentas: filas.cuentas.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  const posnet = (i: number, c: Partial<PosnetFila>) => poner({ posnets: filas.posnets.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  const plan = (i: number, n: number, c: Partial<PlanFila>) => posnet(i, { planes: filas.posnets[i].planes.map((x, j) => (j === n ? { ...x, ...c } : x)) });
  const localidad = (i: number, c: Partial<LocalidadFila>) => poner({ localidades: filas.localidades.map((x, j) => (j === i ? { ...x, ...c } : x)) });

  async function guardar(lista: keyof Filas, enviar: () => Promise<Configuracion>) {
    setGuardando(lista);
    try {
      const r = aFilas(await enviar());
      setF({ ...filas, [lista]: r[lista] }); // las otras listas pueden tener cambios sin guardar
      setCambios({ ...cambios, [lista]: false });
      avisar("Cambios guardados");
    } catch (err) {
      avisar((err as Error).message, { tono: "bad", ms: 6000 });
    }
    setGuardando(null);
  }
  const numero = (s: string) => { const n = parseDec(s); return n === null || Number.isNaN(n) ? null : n; };
  const cuentasGuardadas = filas.cuentas.filter((c) => c.id);

  return (
    <>
      <title>Configuración · La Unión</title>
      <div className="page-head">
        <div><h1>Configuración</h1><p>Los datos del negocio que usa el formulario de venta. Lo que ya usa una venta no se borra: al quitarlo, queda desactivado.</p></div>
      </div>
      <div className="stack" style={{ maxWidth: 900 }}>
        <Seccion titulo="Cuentas bancarias" texto="Donde entran las transferencias y lo que liquidan los posnets." cambios={cambios.cuentas} guardando={guardando === "cuentas"}
          alGuardar={() => guardar("cuentas", () => api("configuracion/cuentas", { body: { cuentas: filas.cuentas } }))}
          agregar={<button type="button" className="btn btn-sm" onClick={() => poner({ cuentas: [...filas.cuentas, { k: nueva(), nombre: "", banco: "", titular: "", cbu_cvu: "", alias: "", activo: true }] })}><Icono n="plus" />Agregar cuenta</button>}>
          {!filas.cuentas.length && <p className="muted">Todavía no hay cuentas.</p>}
          {filas.cuentas.map((c, i) => (
            <div key={c.k} className="stack-sm" style={{ paddingBottom: 14, borderBottom: "1px solid var(--line-2)" }}>
              <div className="grid-3">
                <label className="field"><span>Nombre corto</span><input className="input" value={c.nombre} placeholder="Macro" onChange={(e) => cuenta(i, { nombre: e.target.value })} /></label>
                <label className="field"><span>Banco</span><input className="input" value={c.banco} onChange={(e) => cuenta(i, { banco: e.target.value })} /></label>
                <label className="field"><span>Titular</span><input className="input" value={c.titular} onChange={(e) => cuenta(i, { titular: e.target.value })} /></label>
                <label className="field"><span>CBU o CVU</span><input className="input" value={c.cbu_cvu} inputMode="numeric" maxLength={22} onChange={(e) => cuenta(i, { cbu_cvu: e.target.value.replace(/\D/g, "") })} /></label>
                <label className="field"><span>Alias</span><input className="input" value={c.alias} onChange={(e) => cuenta(i, { alias: e.target.value })} /></label>
              </div>
              <div className="spread">
                <label className="check"><input type="checkbox" checked={c.activo} onChange={(e) => cuenta(i, { activo: e.target.checked })} />Activa</label>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => poner({ cuentas: filas.cuentas.filter((_, j) => j !== i) })}>Quitar</button>
              </div>
            </div>
          ))}
        </Seccion>

        <Seccion titulo="Posnets" texto="Con el recargo que se le cobra al cliente según la tarjeta y las cuotas. Sin marca, el plan vale para todas las tarjetas." cambios={cambios.posnets} guardando={guardando === "posnets"}
          alGuardar={() => guardar("posnets", () => api("configuracion/posnets", { body: { posnets: filas.posnets.map((p) => ({
            ...p, planes: p.planes.map((x) => ({ ...x, cuotas: numero(x.cuotas), recargo_pct: numero(x.recargo_pct) })) })) } }))}
          agregar={<button type="button" className="btn btn-sm" onClick={() => poner({ posnets: [...filas.posnets, { k: nueva(), nombre: "", proveedor: "", cuenta_liquidacion_id: null, activo: true, planes: [planVacio()] }] })}><Icono n="plus" />Agregar posnet</button>}>
          {!filas.posnets.length && <p className="muted">Todavía no hay posnets.</p>}
          {filas.posnets.map((p, i) => (
            <div key={p.k} className="stack-sm" style={{ paddingBottom: 14, borderBottom: "1px solid var(--line-2)" }}>
              <div className="grid-3">
                <label className="field"><span>Nombre</span><input className="input" value={p.nombre} placeholder="Posnet Payway" onChange={(e) => posnet(i, { nombre: e.target.value })} /></label>
                <label className="field"><span>Proveedor</span><input className="input" value={p.proveedor} onChange={(e) => posnet(i, { proveedor: e.target.value })} /></label>
                <label className="field"><span>Liquida en la cuenta</span>
                  <select className="select" value={p.cuenta_liquidacion_id ?? ""} onChange={(e) => posnet(i, { cuenta_liquidacion_id: Number(e.target.value) || null })}>
                    <option value="">—</option>
                    {cuentasGuardadas.map((c) => <option key={c.k} value={c.id}>{c.nombre}</option>)}
                  </select></label>
              </div>
              <div className="lineas planes">
                <div className="ln cab" aria-hidden="true">
                  <span style={{ gridArea: "t" }}>Tarjeta</span><span style={{ gridArea: "m" }}>Marca</span><span style={{ gridArea: "c" }}>Cuotas</span><span style={{ gridArea: "r" }}>Recargo</span>
                </div>
                {p.planes.map((x, n) => (
                  <div className="ln" key={x.k}>
                    <select className="select" style={{ gridArea: "t" }} aria-label={`Tarjeta del plan ${n + 1}`} value={x.tipo_tarjeta} onChange={(e) => plan(i, n, { tipo_tarjeta: e.target.value as TipoTarjeta })}>
                      <option value="credito">Crédito</option><option value="debito">Débito</option>
                    </select>
                    <input className="input" style={{ gridArea: "m" }} placeholder="Todas" aria-label={`Marca del plan ${n + 1}`} value={x.marca_tarjeta} onChange={(e) => plan(i, n, { marca_tarjeta: e.target.value })} />
                    <input className="input" style={{ gridArea: "c" }} inputMode="numeric" aria-label={`Cuotas del plan ${n + 1}`} value={x.cuotas} onChange={(e) => plan(i, n, { cuotas: e.target.value.replace(/\D/g, "") })} />
                    <span className="input-money" style={{ gridArea: "r" }}>
                      <input inputMode="decimal" placeholder="0" aria-label={`Recargo del plan ${n + 1}`} value={x.recargo_pct} aria-invalid={Number.isNaN(parseDec(x.recargo_pct))}
                        onChange={(e) => plan(i, n, { recargo_pct: e.target.value })} /><span>%</span></span>
                    <label className="check" style={{ gridArea: "a" }}><input type="checkbox" checked={x.activo} onChange={(e) => plan(i, n, { activo: e.target.checked })} />Activo</label>
                    <button className="icon-btn" style={{ gridArea: "x" }} type="button" title="Quitar" aria-label={`Quitar plan ${n + 1}`}
                      onClick={() => posnet(i, { planes: p.planes.filter((_, j) => j !== n) })}><Icono n="trash" /></button>
                  </div>
                ))}
              </div>
              <div className="spread">
                <div className="row">
                  <button type="button" className="btn btn-sm" onClick={() => posnet(i, { planes: [...p.planes, planVacio()] })}><Icono n="plus" />Agregar plan</button>
                  <label className="check"><input type="checkbox" checked={p.activo} onChange={(e) => posnet(i, { activo: e.target.checked })} />Activo</label>
                </div>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => poner({ posnets: filas.posnets.filter((_, j) => j !== i) })}>Quitar posnet</button>
              </div>
            </div>
          ))}
        </Seccion>

        <Seccion titulo="Localidades" texto="La lista que se elige en la dirección del cliente. Con la localidad se completan la provincia y el código de área." cambios={cambios.localidades} guardando={guardando === "localidades"}
          alGuardar={() => guardar("localidades", () => api("configuracion/localidades", { body: { localidades: filas.localidades } }))}
          agregar={<button type="button" className="btn btn-sm" onClick={() => poner({ localidades: [...filas.localidades, { k: nueva(), nombre: "", provincia: filas.localidades.at(-1)?.provincia ?? "Tucumán", codigo_area: "", codigo_postal: "" }] })}><Icono n="plus" />Agregar localidad</button>}>
          <div className="lineas localidades">
            <div className="ln cab" aria-hidden="true">
              <span style={{ gridArea: "n" }}>Localidad</span><span style={{ gridArea: "p" }}>Provincia</span><span style={{ gridArea: "a" }}>Cód. área</span><span style={{ gridArea: "c" }}>Cód. postal</span>
            </div>
            {filas.localidades.map((x, i) => (
              <div className="ln" key={x.k}>
                <input className="input" style={{ gridArea: "n" }} aria-label={`Localidad ${i + 1}`} value={x.nombre} onChange={(e) => localidad(i, { nombre: e.target.value })} />
                <input className="input" style={{ gridArea: "p" }} aria-label={`Provincia de la localidad ${i + 1}`} value={x.provincia} onChange={(e) => localidad(i, { provincia: e.target.value })} />
                <input className="input" style={{ gridArea: "a" }} inputMode="numeric" placeholder="381" aria-label={`Código de área de la localidad ${i + 1}`} value={x.codigo_area} onChange={(e) => localidad(i, { codigo_area: e.target.value.replace(/\D/g, "") })} />
                <input className="input" style={{ gridArea: "c" }} aria-label={`Código postal de la localidad ${i + 1}`} value={x.codigo_postal} onChange={(e) => localidad(i, { codigo_postal: e.target.value })} />
                <button className="icon-btn" style={{ gridArea: "x" }} type="button" title="Quitar" aria-label={`Quitar localidad ${i + 1}`}
                  onClick={() => poner({ localidades: filas.localidades.filter((_, j) => j !== i) })}><Icono n="trash" /></button>
              </div>
            ))}
          </div>
        </Seccion>
      </div>
    </>
  );
}
