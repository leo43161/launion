"use client";
// Alta y edición de un presupuesto: /admin/presupuestos/editar/?id=<id>. Sin id = nuevo; ?copiar=<id> = nuevo a partir de otro;
// ?producto=<id> = nuevo, vinculado a ese modelo del catálogo.
// Como en el Excel: total de un insumo = cantidad × costo unitario, costo = suma de los totales, precio = costo × multiplicador.
// El precio final se pone a mano (redondeado). El despiece no entra en el costo: da los m² de cada material para calcular la placa.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ChangeEvent } from "react";
import { api, media, subir } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, dec, fechaHora, medidas, norm, parseDec, parsePesos, pesos, precioPresupuesto } from "@/lib/formato";
import type { Presupuesto, PresupuestoGuardar, Respuestas } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { Modal } from "@/components/Modal";
import { useAviso } from "@/components/Avisos";

export default function Pagina() {
  return <Suspense><Editar /></Suspense>;
}

// ponytail: una placa de 183 × 260 cm para todos los materiales (con eso salen las cantidades del Excel); un tamaño por material si hace falta
const PLACA = { ancho: 183, alto: 260 };
const PLACA_M2 = (PLACA.ancho * PLACA.alto) / 10000;

/** El formulario guarda todo como texto, como lo escribe la persona. Se convierte al calcular y al guardar. */
interface FilaCorte { pieza: string; ancho_cm: string; alto_cm: string; cantidad: string; material: string; k: string }
interface FilaInsumo { insumo: string; cantidad: string; costo_unitario: string; k: string }
interface Formulario {
  nombre: string;
  grupo: string;
  producto_id: string;
  url_foto: string;
  notas: string;
  multiplicador: string;
  precio_final: string;
  cortes: FilaCorte[];
  insumos: FilaInsumo[];
}

const clave = () => String(Math.random());
const corteVacio = (): FilaCorte => ({ pieza: "", ancho_cm: "", alto_cm: "", cantidad: "1", material: "", k: clave() });
const insumoVacio = (): FilaInsumo => ({ insumo: "", cantidad: "", costo_unitario: "", k: clave() });
const NUEVO: Formulario = { nombre: "", grupo: "", producto_id: "", url_foto: "", notas: "", multiplicador: "2,2", precio_final: "", cortes: [corteVacio()], insumos: [insumoVacio()] };

const decTexto = (v: string | number | null) => (v == null ? "" : dec(v));
function aFormulario(p: Presupuesto): Formulario {
  return {
    nombre: p.nombre, grupo: p.grupo ?? "", producto_id: p.producto_id ? String(p.producto_id) : "", url_foto: p.url_foto ?? "", notas: p.notas ?? "",
    multiplicador: dec(p.multiplicador), precio_final: p.precio_final == null ? "" : pesos(p.precio_final),
    cortes: p.cortes.length ? p.cortes.map((c) => ({ pieza: c.pieza ?? "", ancho_cm: decTexto(c.ancho_cm), alto_cm: decTexto(c.alto_cm), cantidad: String(c.cantidad), material: c.material ?? "", k: clave() })) : [corteVacio()],
    insumos: p.insumos.length ? p.insumos.map((x) => ({ insumo: x.insumo, cantidad: dec(x.cantidad), costo_unitario: pesos(x.costo_unitario), k: clave() })) : [insumoVacio()],
  };
}

/** Para sumar: lo vacío o mal escrito cuenta 0 (y se marca en rojo). */
const n = (v: number | null) => (v != null && Number.isFinite(v) ? v : 0);
const malo = (v: number | null) => v != null && !Number.isFinite(v);

function Editar() {
  const parametros = useSearchParams();
  const id = Number(parametros.get("id")) || null; // null = nuevo
  const copiar = Number(parametros.get("copiar")) || null;
  const producto = parametros.get("producto") ?? "";
  const router = useRouter();
  const avisar = useAviso();
  const { puede } = useSesion();
  const [p, setP] = useState<Formulario | null>(null);
  const [guardado, setGuardado] = useState<Presupuesto | null>(null); // lo último guardado: nombre y fecha del encabezado
  const [otros, setOtros] = useState<Respuestas["presupuestos"] | null>(null); // grupos e insumos ya usados, para sugerirlos
  const [catalogo, setCatalogo] = useState<Respuestas["catalogo"] | null>(null); // para vincular un modelo
  const [error, setError] = useState("");
  const [cambios, setCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState("");
  const [eliminar, setEliminar] = useState(false);

  useEffect(() => {
    setP(null);
    setCambios(false);
    const desde = id ?? copiar;
    Promise.all([api("presupuestos"), api("catalogo"), desde ? api("presupuesto", { query: { id: String(desde) } }) : null]).then(([lista, c, r]) => {
      setOtros(lista);
      setCatalogo(c);
      setGuardado(id ? r?.presupuesto ?? null : null);
      if (!r) return setP({ ...NUEVO, producto_id: producto, cortes: [corteVacio()], insumos: [insumoVacio()] });
      const f = aFormulario(r.presupuesto);
      setP(copiar ? { ...f, nombre: `${f.nombre} (copia)` } : f);
      setCambios(!!copiar);
    }, (e: Error) => setError(e.message));
  }, [id, copiar, producto]);

  useEffect(() => {
    if (!cambios) return;
    const avisarSalida = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    addEventListener("beforeunload", avisarSalida);
    return () => removeEventListener("beforeunload", avisarSalida);
  }, [cambios]);

  if (error) return <div className="empty card"><h2>{error}</h2><Link className="btn" href="/admin/presupuestos/">Volver a presupuestos</Link></div>;
  if (!p || !otros || !catalogo) return <p className="muted">Cargando…</p>;

  const cambiar = (cambio: Partial<Formulario>) => { setP((x) => x && { ...x, ...cambio }); setCambios(true); };
  const campo = (k: "nombre" | "grupo" | "notas") => ({
    value: p[k],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => cambiar({ [k]: e.target.value }),
  });
  const cambiarCorte = (i: number, c: Partial<FilaCorte>) => cambiar({ cortes: p.cortes.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  const cambiarInsumo = (i: number, c: Partial<FilaInsumo>) => cambiar({ insumos: p.insumos.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  /** Al elegir un insumo ya usado, trae su último costo si todavía no tiene uno. */
  const nombreInsumo = (i: number, insumo: string) => {
    const conocido = otros.insumos.find((x) => norm(x.insumo) === norm(insumo.trim()));
    cambiarInsumo(i, conocido && !p.insumos[i].costo_unitario.trim() ? { insumo, costo_unitario: pesos(conocido.costo_unitario) } : { insumo });
  };

  // Cuentas: las mismas del Excel
  const insumos = p.insumos.map((x) => ({ cantidad: parseDec(x.cantidad), costo: parsePesos(x.costo_unitario) }));
  const totales = insumos.map((x) => n(x.cantidad) * n(x.costo));
  const costo = Math.round(totales.reduce((a, b) => a + b, 0) * 100) / 100;
  const multiplicador = parseDec(p.multiplicador);
  const precio = precioPresupuesto(costo, n(multiplicador));
  const redondeado = Math.ceil(precio / 1000) * 1000;
  const precioFinal = parsePesos(p.precio_final);

  const cortes = p.cortes.map((c) => ({ ancho: parseDec(c.ancho_cm), alto: parseDec(c.alto_cm), cantidad: parseDec(c.cantidad) }));
  const m2 = cortes.map((c) => (n(c.ancho) * n(c.alto) * n(c.cantidad)) / 10000);
  const porMaterial = new Map<string, { nombre: string; m2: number }>();
  p.cortes.forEach((c, i) => {
    if (!m2[i]) return;
    const nombre = c.material.trim() || "Sin material";
    const x = porMaterial.get(norm(nombre)) ?? { nombre, m2: 0 };
    porMaterial.set(norm(nombre), { ...x, m2: x.m2 + m2[i] });
  });
  const materiales = [...new Set(p.cortes.map((c) => c.material.trim()).filter(Boolean))];
  const grupos = [...new Set(otros.presupuestos.map((x) => x.grupo).filter(Boolean))];
  // Modelos por ambiente; los eliminados no se ofrecen, salvo el que ya está vinculado
  const ambienteDe = (categoria: number) => catalogo.categorias.find((c) => c.id === categoria)?.padre_id ?? categoria;
  const modelos = catalogo.productos.filter((m) => !m.eliminado || String(m.id) === p.producto_id).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const modelo = catalogo.productos.find((m) => String(m.id) === p.producto_id);

  const hayMalos = malo(multiplicador) || malo(precioFinal) || insumos.some((x) => malo(x.cantidad) || malo(x.costo)) || cortes.some((c) => malo(c.ancho) || malo(c.alto) || malo(c.cantidad));

  async function subirFoto(archivo: File) {
    try {
      const url = await subir(archivo, (x) => setSubiendo(`Subiendo ${archivo.name}: ${Math.round(x * 100)} %`));
      cambiar({ url_foto: url });
    } catch (e) {
      avisar(`No se subió ${archivo.name}: ${(e as Error).message}`, { tono: "bad", ms: 6000 });
    }
    setSubiendo("");
  }

  async function guardar() {
    if (!p) return;
    if (!p.nombre.trim()) return avisar("Poné el nombre del mueble.", { tono: "bad" });
    if (hayMalos) return avisar("Hay números mal escritos (marcados en rojo). Usá la coma para los decimales: 0,65.", { tono: "bad", ms: 6000 });
    if (!multiplicador) return avisar("Poné el multiplicador del precio (en el Excel, 2,2).", { tono: "bad" });
    const cuerpo: PresupuestoGuardar = {
      id,
      nombre: p.nombre,
      grupo: p.grupo,
      producto_id: +p.producto_id || null,
      url_foto: p.url_foto,
      notas: p.notas,
      multiplicador,
      precio_final: precioFinal,
      cortes: p.cortes.map((c, i) => ({ pieza: c.pieza, ancho_cm: cortes[i].ancho, alto_cm: cortes[i].alto, cantidad: cortes[i].cantidad, material: c.material })),
      insumos: p.insumos.map((x, i) => ({ insumo: x.insumo, cantidad: insumos[i].cantidad, costo_unitario: insumos[i].costo })),
    };
    setGuardando(true);
    try {
      const r = await api("presupuesto/guardar", { body: cuerpo });
      setCambios(false);
      avisar(id ? "Cambios guardados" : "Presupuesto creado");
      if (!id) router.replace(`/admin/presupuestos/editar/?id=${r.id}`);
      else api("presupuesto", { query: { id: String(id) } }).then((x) => setGuardado(x.presupuesto));
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
    }
    setGuardando(false);
  }

  async function borrar() {
    if (!id) return;
    try {
      await api("presupuesto/eliminar", { body: { id } });
      setCambios(false);
      avisar("Presupuesto eliminado");
      router.replace("/admin/presupuestos/");
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
    }
    setEliminar(false);
  }

  const titulo = id ? guardado?.nombre ?? "Presupuesto" : "Nuevo presupuesto";
  const numeroMalo = (v: number | null) => (malo(v) ? { "aria-invalid": true } : {});

  return (
    <>
      <title>{`${titulo} · La Unión`}</title>
      <div className="crumb"><Link href="/admin/presupuestos/">Presupuestos</Link><Icono n="right" /><span>{titulo}</span></div>
      <div className="page-head">
        <div><h1>{titulo}</h1>{guardado && <p>Última modificación: {fechaHora(guardado.actualizado_en ?? guardado.creado_en)}</p>}</div>
        <div className="row">
          <Link className="btn" href="/admin/presupuestos/">{cambios ? "Cancelar" : "Volver"}</Link>
          {id && <>
            <Link className="btn" href={`/admin/presupuestos/editar/?copiar=${id}`} aria-disabled={cambios} onClick={(e) => { if (cambios) { e.preventDefault(); avisar("Guardá los cambios antes de duplicar."); } }}><Icono n="copy" />Duplicar</Link>
            <button className="btn btn-danger" type="button" onClick={() => setEliminar(true)}><Icono n="trash" /><span className="hide-s">Eliminar</span></button>
          </>}
          <button className="btn btn-primary" type="button" onClick={guardar} disabled={guardando || !!subiendo}><Icono n="check" />{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>

      <form className="cat-form pres" noValidate onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <div className="stack">
          <section className="card card-pad stack">
            <label className="field"><span>Mueble *</span><input className="input" required placeholder="Ej: Cómoda 4 cajones 80-90-40 todo blanco aglomerado" {...campo("nombre")} /></label>
            <label className="field"><span>Grupo</span>
              <input className="input" list="grupos" placeholder="Ej: Cómodas" {...campo("grupo")} />
              <datalist id="grupos">{grupos.map((g) => <option key={g} value={g!} />)}</datalist>
              <small>Para ordenar la lista, como las hojas del Excel.</small>
            </label>
            <label className="field"><span>Modelo del catálogo</span>
              <select className="select" value={p.producto_id} onChange={(e) => cambiar({ producto_id: e.target.value })}>
                <option value="">Ninguno</option>
                {catalogo.categorias.filter((a) => a.padre_id === null).map((a) => (
                  <optgroup key={a.id} label={a.nombre}>
                    {modelos.filter((m) => ambienteDe(m.categoria_id) === a.id).map((m) => (
                      <option key={m.id} value={m.id}>{[m.nombre, medidas(m), m.eliminado ? "eliminado" : ""].filter(Boolean).join(" · ")}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <small>El mueble de la web que se fabrica con este presupuesto. Desde el modelo se ve su costo y su precio final.</small>
            </label>
            {modelo && (
              <div className="row" style={{ flexWrap: "nowrap" }}>
                {modelo.foto ? <img className="thumb" src={media(modelo.foto)} alt="" /> : <span className="thumb" />}
                <span className="small grow">
                  {puede("catalogo.editar") ? <Link href={`/admin/catalogo/editar/?id=${modelo.id}`}>{modelo.nombre}</Link> : <b>{modelo.nombre}</b>}
                  {modelo.precio_local && <span className="muted"> · Precio del local: {ars(modelo.precio_local)}</span>}
                </span>
              </div>
            )}
          </section>

          <section className="card card-pad stack">
            <div className="spread"><h2>Insumos</h2><span className="small muted">Total = cantidad × costo unitario</span></div>
            <div className="lineas insumos">
              <div className="ln cab" aria-hidden="true"><span style={{ gridArea: "c" }}>Cant.</span><span style={{ gridArea: "n" }}>Insumo</span><span style={{ gridArea: "u" }}>Costo unit.</span><span style={{ gridArea: "t" }} className="tot">Total</span></div>
              {p.insumos.map((x, i) => (
                <div className="ln" key={x.k}>
                  <input className="input" style={{ gridArea: "c" }} inputMode="decimal" placeholder="Cant." aria-label={`Cantidad del insumo ${i + 1}`} value={x.cantidad} {...numeroMalo(insumos[i].cantidad)}
                    onChange={(e) => cambiarInsumo(i, { cantidad: e.target.value })} />
                  <input className="input" style={{ gridArea: "n" }} list="insumos" placeholder="Ej: Melamina" aria-label={`Insumo ${i + 1}`} value={x.insumo}
                    onChange={(e) => nombreInsumo(i, e.target.value)} />
                  <span className="input-money" style={{ gridArea: "u" }}><span>$</span>
                    <input inputMode="decimal" placeholder="Costo unit." aria-label={`Costo unitario del insumo ${i + 1}`} value={x.costo_unitario} {...numeroMalo(insumos[i].costo)}
                      onChange={(e) => cambiarInsumo(i, { costo_unitario: e.target.value })}
                      onBlur={(e) => { const v = parsePesos(e.target.value); if (v != null && Number.isFinite(v)) cambiarInsumo(i, { costo_unitario: pesos(v) }); }} /></span>
                  <span className="tot" style={{ gridArea: "t" }}>{ars(totales[i])}</span>
                  <button className="icon-btn" style={{ gridArea: "x" }} type="button" title="Quitar" aria-label={`Quitar insumo ${i + 1}`}
                    onClick={() => cambiar({ insumos: p.insumos.length > 1 ? p.insumos.filter((_, j) => j !== i) : [insumoVacio()] })}><Icono n="trash" /></button>
                </div>
              ))}
              <datalist id="insumos">{otros.insumos.map((x) => <option key={x.insumo} value={x.insumo}>{`$ ${pesos(x.costo_unitario)}`}</option>)}</datalist>
            </div>
            <div className="spread">
              <button type="button" className="btn btn-sm" onClick={() => cambiar({ insumos: [...p.insumos, insumoVacio()] })}><Icono n="plus" />Agregar insumo</button>
              <span>Costo <b className="tnum" style={{ marginLeft: 8 }}>{ars(costo)}</b></span>
            </div>
          </section>

          <section className="card card-pad stack">
            <div className="spread"><h2>Despiece</h2><span className="small muted">Medidas en cm</span></div>
            <div className="lineas cortes">
              <div className="ln cab" aria-hidden="true"><span style={{ gridArea: "p" }}>Pieza</span><span style={{ gridArea: "a" }}>Ancho</span><span style={{ gridArea: "h" }}>Alto</span><span style={{ gridArea: "c" }}>Cant.</span><span style={{ gridArea: "m" }}>Material</span><span style={{ gridArea: "s" }} className="tot">m²</span></div>
              {p.cortes.map((c, i) => (
                <div className="ln" key={c.k}>
                  <input className="input" style={{ gridArea: "p" }} placeholder="Ej: Lateral" aria-label={`Pieza ${i + 1}`} value={c.pieza} onChange={(e) => cambiarCorte(i, { pieza: e.target.value })} />
                  <input className="input" style={{ gridArea: "a" }} inputMode="decimal" placeholder="Ancho" aria-label={`Ancho de la pieza ${i + 1}`} value={c.ancho_cm} {...numeroMalo(cortes[i].ancho)} onChange={(e) => cambiarCorte(i, { ancho_cm: e.target.value })} />
                  <input className="input" style={{ gridArea: "h" }} inputMode="decimal" placeholder="Alto" aria-label={`Alto de la pieza ${i + 1}`} value={c.alto_cm} {...numeroMalo(cortes[i].alto)} onChange={(e) => cambiarCorte(i, { alto_cm: e.target.value })} />
                  <input className="input" style={{ gridArea: "c" }} inputMode="numeric" placeholder="Cant." aria-label={`Cantidad de la pieza ${i + 1}`} value={c.cantidad} {...numeroMalo(cortes[i].cantidad)} onChange={(e) => cambiarCorte(i, { cantidad: e.target.value })} />
                  <input className="input" style={{ gridArea: "m" }} list="materiales" placeholder="Ej: Aglo blanco" aria-label={`Material de la pieza ${i + 1}`} value={c.material} onChange={(e) => cambiarCorte(i, { material: e.target.value })} />
                  <span className="tot" style={{ gridArea: "s" }}>{m2[i] ? dec(Math.round(m2[i] * 100) / 100) : "—"}</span>
                  <button className="icon-btn" style={{ gridArea: "x" }} type="button" title="Quitar" aria-label={`Quitar pieza ${i + 1}`}
                    onClick={() => cambiar({ cortes: p.cortes.length > 1 ? p.cortes.filter((_, j) => j !== i) : [corteVacio()] })}><Icono n="trash" /></button>
                </div>
              ))}
              <datalist id="materiales">{materiales.map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            <button type="button" className="btn btn-sm" style={{ justifySelf: "start" }} onClick={() => cambiar({ cortes: [...p.cortes, corteVacio()] })}><Icono n="plus" />Agregar pieza</button>
            {porMaterial.size > 0 && (
              <div className="stack-sm">
                {[...porMaterial.values()].map((x) => (
                  <div key={x.nombre} className="spread small"><span>{x.nombre}</span><span className="tnum">{dec(Math.round(x.m2 * 100) / 100)} m² · <b>{dec(Math.round((x.m2 / PLACA_M2) * 100) / 100)} placas</b></span></div>
                ))}
                <small className="muted">Placas de {PLACA.ancho} × {PLACA.alto} cm ({dec(Math.round(PLACA_M2 * 100) / 100)} m²), sin contar el desperdicio del corte. Es la cantidad que va en el insumo (ej: melamina 0,65).</small>
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card card-pad stack">
            <h2>Foto del mueble</h2>
            <label className="photo-pick">
              {p.url_foto ? <img src={media(p.url_foto)} alt="Foto del mueble" /> : <><Icono n="upload" /><span>Subir una foto</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { if (e.target.files?.[0]) subirFoto(e.target.files[0]); e.target.value = ""; }} />
            </label>
            {p.url_foto && <button type="button" className="btn btn-sm" style={{ justifySelf: "start" }} onClick={() => cambiar({ url_foto: "" })}><Icono n="trash" />Quitar foto</button>}
            {subiendo && <p className="small" role="status">{subiendo}</p>}
          </section>

          <section className="card card-pad stack summary">
            <h2>Precio</h2>
            <dl>
              <dt>Costo</dt><dd>{ars(costo)}</dd>
              <dt><label htmlFor="mult">Multiplicador</label></dt>
              <dd><input id="mult" className="input" inputMode="decimal" style={{ width: 80, textAlign: "right" }} value={p.multiplicador} {...numeroMalo(multiplicador)} onChange={(e) => cambiar({ multiplicador: e.target.value })} /></dd>
              <dt>Precio (costo × {p.multiplicador || "…"})</dt><dd>{ars(precio)}</dd>
            </dl>
            <label className="field"><span>Precio final</span>
              <span className="input-money"><span>$</span><input inputMode="decimal" placeholder={pesos(precio)} value={p.precio_final} {...numeroMalo(precioFinal)}
                onChange={(e) => cambiar({ precio_final: e.target.value })}
                onBlur={(e) => { const v = parsePesos(e.target.value); if (v != null && Number.isFinite(v)) cambiar({ precio_final: pesos(v) }); }} /></span>
              <small>El que se usa, redondeado a mano. {precio > 0 && <button type="button" className="btn btn-sm btn-ghost" style={{ padding: "0 6px" }} onClick={() => cambiar({ precio_final: pesos(redondeado) })}>Usar {ars(redondeado)}</button>}</small>
            </label>
            {precioFinal != null && Number.isFinite(precioFinal) && costo > 0 && <p className="small muted">Queda {ars(precioFinal - costo)} sobre el costo (× {dec(Math.round((precioFinal / costo) * 100) / 100)}).</p>}
          </section>

          <section className="card card-pad stack">
            <label className="field"><span>Notas</span><textarea className="textarea" rows={3} placeholder="Ej: colores a elección, herrajes especiales…" {...campo("notas")} /></label>
          </section>
        </div>
      </form>

      {eliminar && (
        <Modal titulo="Eliminar presupuesto" alCerrar={() => setEliminar(false)}
          pie={<><button className="btn" type="button" onClick={() => setEliminar(false)}>Cancelar</button>
            <button className="btn btn-dark" type="button" onClick={borrar}>Eliminar</button></>}>
          <p>¿Eliminar “{guardado?.nombre}” con su despiece e insumos? No se puede deshacer.</p>
        </Modal>
      )}
    </>
  );
}
