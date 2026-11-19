"use client";
// Clientes (CRM): arriba, lo de esta semana (recordatorios y entregas, con lo que falta cobrar); abajo, la agenda con lo que
// compró cada cliente y lo que debe. Se busca por nombre, DNI o teléfono; tocar un cliente abre su ficha.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ars, fecha, norm, numeroVenta, telefonoLindo } from "@/lib/formato";
import { cuandoEntrega, diasHasta, saldo } from "@/lib/ventas";
import type { ClienteAgenda, Respuestas } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { useAviso } from "@/components/Avisos";

const FILTROS_GUARDADOS = "lu-clientes-filtros"; // se guardan al abrir uno y volver
const SEMANA = 7; // "esta semana": lo vencido y lo de los próximos 7 días

const debe = (c: ClienteAgenda) => saldo({ total: c.comprado, pagado: c.pagado });
const FILTROS: [string, string, (c: ClienteAgenda) => boolean][] = [
  ["todos", "Todos", () => true],
  ["deben", "Deben", (c) => debe(c) > 0],
  ["recordatorios", "Con recordatorios", (c) => c.recordatorios > 0],
  ["negocios", "Negocios", (c) => c.tipo === "negocio"],
];

/** "Hoy", "Mañana", "Hace 3 días", "Lun 16 nov" */
function cuandoRecordar(f: string): string {
  const dias = diasHasta(f);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias < 0) return `Hace ${-dias} ${dias === -1 ? "día" : "días"}`;
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(f + "T00:00")).replace(/\./g, "");
}

export default function Clientes() {
  const router = useRouter();
  const avisar = useAviso();
  const { puede } = useSesion();
  const [datos, setDatos] = useState<Respuestas["clientes/agenda"] | null>(null);
  const [error, setError] = useState("");
  const [f, setF] = useState({ q: "", filtro: "todos" });

  const cargar = () => api("clientes/agenda").then(setDatos, (e: Error) => setError(e.message));
  useEffect(() => {
    try { setF((x) => ({ ...x, ...JSON.parse(sessionStorage.getItem(FILTROS_GUARDADOS) || "{}") })); } catch {}
    cargar();
  }, []);
  const filtrar = (cambio: Partial<typeof f>) => {
    const nuevo = { ...f, ...cambio };
    setF(nuevo);
    try { sessionStorage.setItem(FILTROS_GUARDADOS, JSON.stringify(nuevo)); } catch {}
  };

  const filas = useMemo(() => {
    const todos = datos?.clientes ?? [];
    const q = norm(f.q.trim());
    if (!q) {
      const lista = todos.filter(FILTROS.find(([k]) => k === f.filtro)![2]);
      return f.filtro === "deben" ? [...lista].sort((a, b) => debe(b) - debe(a)) : lista;
    }
    const digitos = q.replace(/\D/g, "");
    return todos.filter((c) => // la búsqueda mira todos, sin el filtro
      q.split(/\s+/).every((t) => norm(`${c.nombre} ${c.comercio ?? ""} ${c.localidad ?? ""}`).includes(t))
      || (digitos.length >= 3 && (`${c.dni ?? ""}`.includes(digitos) || `${c.telefono ?? ""}`.includes(digitos))));
  }, [datos, f]);

  if (!puede("ventas.crear")) return <div className="empty card"><h2>Tu usuario no puede ver los clientes</h2></div>;

  const recordatorios = (datos?.recordatorios ?? []).filter((r) => diasHasta(r.recordar_el) <= SEMANA);
  const entregas = (datos?.entregas ?? []).filter((v) => diasHasta(v.fecha_entrega) <= SEMANA).sort((a, b) => a.fecha_entrega.localeCompare(b.fecha_entrega));
  const totalDeuda = (datos?.clientes ?? []).reduce((s, c) => s + Math.max(0, debe(c)), 0);

  async function hecho(id: number) {
    try {
      await api("cliente/nota/estado", { body: { id, hecha: true } });
      avisar("Recordatorio hecho");
      cargar();
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
    }
  }

  return (
    <>
      <title>Clientes · La Unión</title>
      <div className="page-head">
        <div><h1>Clientes</h1><p>La agenda: lo que compró cada cliente, lo que pagó y lo que debe, con sus notas y recordatorios.</p></div>
        <Link className="btn btn-primary" href="/admin/ventas/nueva/"><Icono n="plus" />Nueva venta</Link>
      </div>

      {datos && (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="card-head"><h2>Para esta semana</h2><span className="small muted">Lo vencido y lo de los próximos {SEMANA} días</span></div>
          {!recordatorios.length && !entregas.length ? <div className="card-body"><p className="muted">No hay recordatorios ni entregas para esta semana.</p></div> : (
            <div className="semana">
              <div>
                <h3 className="semana-tit"><Icono n="calendar" />Recordatorios<span className="n">{recordatorios.length}</span></h3>
                {recordatorios.length ? <ul className="list">{recordatorios.map((r) => {
                  const vencido = diasHasta(r.recordar_el) < 0;
                  return (
                    <li key={r.id}><div className="li" style={{ alignItems: "start" }}>
                      <span className="semana-cuando" style={vencido ? { color: "var(--bad)" } : undefined}>{cuandoRecordar(r.recordar_el)}</span>
                      <div className="grow">
                        <Link href={`/admin/clientes/ver/?id=${r.cliente_id}`} className="cell-title" style={{ color: "inherit" }}>{r.cliente}</Link>
                        <div style={{ overflowWrap: "anywhere" }}>{r.texto}</div>
                        <span className="cell-sub">{r.telefono && <><a href={`https://wa.me/${r.telefono}`} target="_blank" rel="noopener" style={{ color: "var(--gold-ink)" }}>{telefonoLindo(r.telefono)}</a> · </>}Lo anotó {r.creado_por}</span>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => hecho(r.id)}><Icono n="check" /><span className="hide-s">Hecho</span></button>
                    </div></li>
                  );
                })}</ul> : <p className="small muted" style={{ padding: "0 18px 14px" }}>Nada para recordar.</p>}
              </div>
              <div>
                <h3 className="semana-tit"><Icono n="truck" />Entregas<span className="n">{entregas.length}</span></h3>
                {entregas.length ? <ul className="list">{entregas.map((v) => {
                  const atrasada = diasHasta(v.fecha_entrega) < 0;
                  const cobrar = saldo(v);
                  return (
                    <li key={v.id}><div className="li" style={{ alignItems: "start" }}>
                      <span className="semana-cuando" style={atrasada ? { color: "var(--bad)" } : undefined}>{cuandoEntrega(v.fecha_entrega)}</span>
                      <div className="grow">
                        <Link href={`/admin/ventas/ver/?id=${v.id}`} className="cell-title" style={{ color: "inherit" }}>{numeroVenta(v.numero)} · {v.cliente}</Link>
                        <div className="small">{v.muebles}</div>
                        <span className="cell-sub">{fecha(v.fecha_entrega)} · {v.tipo_entrega === "retiro" ? "Retira en el showroom" : v.localidad ?? "Envío"}{v.estado === "pausa" && " · En pausa"}</span>
                      </div>
                      {cobrar > 0 ? <span className="badge bad plain" title="Lo que falta cobrar">Cobrar {ars(cobrar)}</span>
                        : Number(v.financiado) > 0 ? <span className="badge gold plain">En cuotas</span> : <span className="badge ok plain">Pagada</span>}
                    </div></li>
                  );
                })}</ul> : <p className="small muted" style={{ padding: "0 18px 14px" }}>No hay entregas esta semana.</p>}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="stack-sm" style={{ marginBottom: 14 }}>
        <label className="gsearch" style={{ width: "100%", maxWidth: 520 }}><Icono n="search" /><span className="sr">Buscar clientes</span>
          <input type="search" placeholder="Buscar por nombre, DNI, teléfono o comercio" value={f.q} onChange={(e) => filtrar({ q: e.target.value })} />
        </label>
        {!f.q && (
          <div className="row">
            <div className="chips" role="group" aria-label="Filtrar clientes">
              {FILTROS.map(([k, texto, cumple]) => (
                <button key={k} type="button" className="chip" aria-pressed={f.filtro === k} onClick={() => filtrar({ filtro: k })}>
                  {texto}<span className="n">{(datos?.clientes ?? []).filter(cumple).length}</span>
                </button>
              ))}
            </div>
            {f.filtro === "deben" && totalDeuda > 0 && <span className="small muted">Deben <b className="tnum">{ars(totalDeuda)}</b> en total, sin contar las cuotas del crédito de la casa.</span>}
          </div>
        )}
      </div>

      <div className="card">
        {error ? <div className="empty"><Icono n="alert" /><p>No se pudieron cargar los clientes: {error}</p><button className="btn" onClick={() => { setError(""); cargar(); }}>Reintentar</button></div>
        : !datos ? <div className="empty"><p>Cargando…</p></div>
        : !datos.clientes.length ? <div className="empty"><Icono n="users" /><p>Todavía no hay clientes. Cada cliente queda en la agenda al cargar su primera venta.</p><Link className="btn btn-primary" href="/admin/ventas/nueva/"><Icono n="plus" />Nueva venta</Link></div>
        : !filas.length ? <div className="empty"><Icono n="search" /><p>{f.q ? `No hay clientes para “${f.q}”.` : "No hay clientes con este filtro."}</p></div>
        : (
          <div className="table-wrap"><table className="table cards">
            <thead><tr><th>Cliente</th><th>Teléfono</th><th>Compras</th><th className="num">Comprado</th><th className="num">Debe</th></tr></thead>
            <tbody>
              {filas.map((c) => {
                const href = `/admin/clientes/ver/?id=${c.id}`;
                const d = debe(c);
                return (
                  <tr key={c.id} className="click" onClick={() => router.push(href)}>
                    <td className="full">
                      <Link className="cell-title" href={href} onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", color: "inherit" }}>{c.nombre}</Link>
                      <span className="cell-sub">{[c.dni && `DNI ${c.dni}`, c.comercio, c.localidad].filter(Boolean).join(" · ")}
                        {c.recordatorios > 0 && <> · <span style={{ color: "var(--gold-ink)", fontWeight: 600 }}>{c.recordatorios} {c.recordatorios === 1 ? "recordatorio" : "recordatorios"}</span></>}</span>
                    </td>
                    <td data-label="Teléfono">{c.telefono ? <a className="nowrap" href={`https://wa.me/${c.telefono}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>{telefonoLindo(c.telefono)}</a> : "—"}</td>
                    <td data-label="Compras"><span className="nowrap">{c.compras} {c.compras === 1 ? "compra" : "compras"}</span>{c.ultima_compra && <span className="cell-sub">Última: {fecha(c.ultima_compra)}</span>}</td>
                    <td className="num" data-label="Comprado">{ars(c.comprado)}</td>
                    <td className="num right" data-label="Debe">{d > 0 ? <b className="tnum">{ars(d)}</b> : Number(c.financiado) > 0 ? <span className="badge gold">En cuotas</span> : c.compras ? <span className="badge ok">Al día</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
