"use client";
// Plantillas de mensajes de WhatsApp: el botón verde de un modelo del catálogo, un presupuesto, una venta o un cliente las
// completa con sus datos. Cada una sale donde se completan todas sus variables (lib/plantillas.ts).
// La lista se guarda entera: la que se quita, se borra.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { armarMensaje, EJEMPLO, LUGARES, sirve, VARIABLES, type Donde } from "@/lib/plantillas";
import type { Plantilla } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { useAviso } from "@/components/Avisos";

interface Fila {
  id?: number; // sin id = plantilla nueva
  nombre: string;
  texto: string;
  clave: string; // para React: el id, o uno provisorio hasta guardar
}

const aFilas = (lista: Plantilla[]): Fila[] => lista.map((x) => ({ ...x, clave: String(x.id) }));

export default function Plantillas() {
  const { puede, usuario } = useSesion();
  const avisar = useAviso();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);
  const textos = useRef<Record<string, HTMLTextAreaElement | null>>({}); // para meter la variable donde está el cursor

  useEffect(() => { api("plantillas").then((r) => setFilas(aFilas(r.plantillas)), (e: Error) => setError(e.message)); }, []);

  if (!puede("catalogo.editar")) return <div className="empty card"><h2>Tu usuario no puede editar las plantillas</h2></div>;
  if (error) return <div className="empty card"><h2>{error}</h2></div>;
  if (!filas) return <p className="muted">Cargando…</p>;

  const lista = filas;
  const poner = (nueva: Fila[]) => { setFilas(nueva); setCambios(true); };
  const cambiar = (i: number, cambio: Partial<Fila>) => poner(lista.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  const insertar = (i: number, clave: string) => {
    const f = lista[i], ta = textos.current[f.clave], variable = `{${clave}}`;
    const ini = ta?.selectionStart ?? f.texto.length, fin = ta?.selectionEnd ?? ini;
    cambiar(i, { texto: f.texto.slice(0, ini) + variable + f.texto.slice(fin) });
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(ini + variable.length, ini + variable.length); });
  };
  const ejemplo = { ...EJEMPLO, vendedor: usuario?.nombre };

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await api("plantillas/guardar", { body: { plantillas: lista.map((f) => ({ id: f.id, nombre: f.nombre, texto: f.texto })) } });
      setFilas(aFilas(r.plantillas));
      setCambios(false);
      avisar("Plantillas guardadas");
    } catch (err) {
      avisar((err as Error).message, { tono: "bad", ms: 6000 });
    }
    setGuardando(false);
  }

  return (
    <>
      <title>Plantillas · La Unión</title>
      <div className="page-head">
        <div><h1>Plantillas</h1><p>Mensajes de WhatsApp: el botón verde de un modelo del catálogo, un presupuesto, una venta o un cliente los completa con sus datos y los abre en WhatsApp. Cada plantilla sale donde se completan todas sus variables. Si todas las variables de un renglón quedan vacías (un modelo sin medidas), ese renglón no sale.</p></div>
      </div>
      <form className="stack" onSubmit={guardar} style={{ maxWidth: 980 }}>
        <details className="card card-pad">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Qué pone cada variable</summary>
          <dl className="specs" style={{ marginTop: 12 }}>
            {VARIABLES.map((v) => <div key={v.clave} style={{ display: "contents" }}><dt className="tnum">{`{${v.clave}}`}</dt>
              <dd>{v.texto} <span className="muted">· {v.en.map((d) => LUGARES[d]).join(", ")}</span></dd></div>)}
          </dl>
          <div className="stack-sm small" style={{ marginTop: 12 }}>
            <p><b>{"{NOMBRE}"}</b>: en mayúsculas, con cualquier variable.</p>
            <p><b>{"{precio +25% /6}"}</b>: cuentas con {"{precio}"}, {"{precio_local}"}, {"{total}"} y {"{saldo}"}, de izquierda a derecha. <b>+25%</b> le suma el 25 %, <b>-10%</b> le resta el 10 %, <b>50%</b> es la mitad y <b>/6</b> lo divide en 6 cuotas. Se redondea para arriba a pesos enteros. Por ejemplo, 50 % de entrega y el resto con 8 % en 3 semanas: {"{precio 50%}"} y 3 semanas de {"{precio 50% +8% /3}"}. Con un precio “desde” de la web no se calculan cuotas (serían sobre el mínimo) y esos renglones no salen: la financiación se manda desde Presupuestos.</p>
            <p><b>✔️ {"{caracteristicas}"}</b>: el renglón se repite una vez por cada característica.</p>
            <p>En Presupuestos, el nombre, el precio y la foto son los del presupuesto; lo demás (medidas, código, características) sale del modelo vinculado.</p>
          </div>
        </details>
        {!lista.length && <div className="card card-pad"><p className="muted">Todavía no hay plantillas.</p></div>}
        {lista.map((f, i) => (
          <section key={f.clave} className="card card-pad stack">
            <div className="grid-2" style={{ alignItems: "start" }}>
              <div className="stack-sm">
                <label className="field"><span>Nombre *</span><input className="input" value={f.nombre} required placeholder="Ej: Precio y medidas" onChange={(e) => cambiar(i, { nombre: e.target.value })} /></label>
                <label className="field"><span>Mensaje *</span>
                  <textarea ref={(el) => { textos.current[f.clave] = el; }} className="textarea" rows={9} required value={f.texto}
                    placeholder={"Hola! Te paso el {nombre}.\nPrecio: {precio}"} onChange={(e) => cambiar(i, { texto: e.target.value })} />
                </label>
                <div className="chips" role="group" aria-label="Agregar una variable donde está el cursor">
                  {VARIABLES.map((v) => <button key={v.clave} type="button" className="chip" title={`${v.texto} (${v.en.map((d) => LUGARES[d]).join(", ")})`} onClick={() => insertar(i, v.clave)}>{`{${v.clave}}`}</button>)}
                  <button type="button" className="chip" title="El precio con 25 % de recargo, en 6 cuotas (cambiá los números)" onClick={() => insertar(i, "precio +25% /6")}>{"{precio +25% /6}"}</button>
                </div>
                <small className="muted">{(() => {
                  const en = (Object.keys(LUGARES) as Donde[]).filter((d) => sirve(f.texto, d)).map((d) => LUGARES[d]);
                  return en.length ? `Sale en: ${en.join(", ")}.` : "No sale en ningún lado: mezcla variables del modelo con las de la venta o el cliente.";
                })()}</small>
              </div>
              <div className="field"><span>Así queda (con un ejemplo)</span>
                <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: "var(--surface-2)", borderRadius: 12, padding: 12, fontSize: 14, minHeight: 80 }}>
                  {armarMensaje(f.texto, ejemplo) || <span className="muted">Escribí el mensaje.</span>}
                </div>
              </div>
            </div>
            <div className="spread">
              {i > 0 ? <button type="button" className="btn btn-sm" onClick={() => poner([...lista.slice(0, i - 1), f, lista[i - 1], ...lista.slice(i + 1)])}><Icono n="up" />Subir</button> : <span />}
              <button type="button" className="btn btn-sm btn-danger" onClick={() => poner(lista.filter((_, j) => j !== i))}>Quitar</button>
            </div>
          </section>
        ))}
        <div className="spread">
          <button type="button" className="btn btn-sm" onClick={() => poner([...lista, { nombre: "", texto: "", clave: String(Math.random()) }])}><Icono n="plus" />Agregar plantilla</button>
          <button className="btn btn-primary" disabled={guardando || !cambios}><Icono n="check" />{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </>
  );
}
