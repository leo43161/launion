"use client";
// Vendedores con link propio: con launionmuebles.com.ar/<link>, todos los botones de WhatsApp de la web van a su número.
import { useEffect, useState, type FormEvent } from "react";
import { api, webPublica } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { norm, normTelefono, telefonoLindo } from "@/lib/formato";
import type { Vendedor } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { useAviso } from "@/components/Avisos";

interface Fila {
  id?: number; // sin id = vendedor nuevo
  nombre: string;
  link_web: string;
  telefono: string; // como se escribe: "381 319-6842"
  clave: string; // para React: el id, o uno provisorio hasta guardar
}

const aFilas = (lista: Vendedor[]): Fila[] => lista.map((v) => ({ ...v, telefono: telefonoLindo(v.telefono), clave: String(v.id) }));

export default function Vendedores() {
  const { puede } = useSesion();
  const avisar = useAviso();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);

  useEffect(() => { api("vendedores").then((r) => setFilas(aFilas(r.vendedores)), (e: Error) => setError(e.message)); }, []);

  if (!puede("catalogo.editar")) return <div className="empty card"><h2>Tu usuario no puede editar los vendedores</h2></div>;
  if (error) return <div className="empty card"><h2>{error}</h2></div>;
  if (!filas) return <p className="muted">Cargando…</p>;

  const lista = filas;
  const cambiar = (i: number, cambio: Partial<Fila>) => { setFilas(lista.map((f, j) => (j === i ? { ...f, ...cambio } : f))); setCambios(true); };
  const web = webPublica();

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await api("vendedores/guardar", { body: { vendedores: lista.map((f) => ({ id: f.id, nombre: f.nombre, link_web: f.link_web, telefono: normTelefono(f.telefono) })) } });
      setFilas(aFilas(r.vendedores));
      setCambios(false);
      avisar("Vendedores guardados");
    } catch (err) {
      avisar((err as Error).message, { tono: "bad", ms: 6000 });
    }
    setGuardando(false);
  }

  return (
    <>
      <title>Vendedores · La Unión</title>
      <div className="page-head">
        <div><h1>Vendedores</h1><p>Con el link de un vendedor, todos los botones de WhatsApp de la web van a su número. Sin vendedor en el link, van al número de la mueblería.</p></div>
      </div>
      <form className="card card-pad stack" onSubmit={guardar} style={{ maxWidth: 720 }}>
        {!lista.length && <p className="muted">Todavía no hay vendedores.</p>}
        {lista.map((f, i) => (
          <div key={f.clave} className="stack-sm" style={{ paddingBottom: 14, borderBottom: "1px solid var(--line-2)" }}>
            <div className="grid-3" style={{ alignItems: "end" }}>
              <label className="field"><span>Nombre</span><input className="input" value={f.nombre} required onChange={(e) => cambiar(i, { nombre: e.target.value })} /></label>
              <label className="field"><span>Link</span><input className="input" value={f.link_web} required placeholder="pilar" autoComplete="off"
                onChange={(e) => cambiar(i, { link_web: norm(e.target.value).replace(/[^a-z0-9-]/g, "") })} /></label>
              <label className="field"><span>WhatsApp</span><input className="input" value={f.telefono} required inputMode="tel" placeholder="381 319-6842" autoComplete="off"
                onChange={(e) => cambiar(i, { telefono: e.target.value })}
                onBlur={(e) => { const t = normTelefono(e.target.value); if (/^549\d{10}$/.test(t)) cambiar(i, { telefono: telefonoLindo(t) }); }} /></label>
            </div>
            <div className="spread">
              {f.link_web ? <a className="small" href={web + f.link_web} target="_blank" rel="noopener"><Icono n="link" /> {web + f.link_web}</a> : <span />}
              <button type="button" className="btn btn-sm btn-danger" onClick={() => { setFilas(lista.filter((_, j) => j !== i)); setCambios(true); }}>Quitar</button>
            </div>
          </div>
        ))}
        <div className="spread">
          <button type="button" className="btn btn-sm" onClick={() => setFilas([...lista, { nombre: "", link_web: "", telefono: "", clave: String(Math.random()) }])}><Icono n="plus" />Agregar vendedor</button>
          <button className="btn btn-primary" disabled={guardando || !cambios}><Icono n="check" />{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </>
  );
}
