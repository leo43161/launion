"use client";
// Usuarios del panel, solo para administradores: alta, edición, contraseña temporal y eliminación.
// La contraseña propia se cambia desde "Cambiar mi contraseña" (pide la actual).
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { fechaHora, iniciales } from "@/lib/formato";
import type { Respuestas, UsuarioFila } from "@/lib/tipos";
import { Icono } from "@/components/Icono";
import { Modal } from "@/components/Modal";
import { useAviso } from "@/components/Avisos";

type Datos = Respuestas["usuarios"];

/** Contraseña temporal fácil de dictar: sin letras que se confunden (l, 1, o, 0). */
const temporal = () => Array.from(crypto.getRandomValues(new Uint32Array(10)), (x) => "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]).join("");
const nombreDe = (u: UsuarioFila) => u.nombre || u.nombre_usuario;

export default function Usuarios() {
  const { usuario: yo, puede } = useSesion();
  const avisar = useAviso();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [editar, setEditar] = useState<UsuarioFila | "nuevo" | null>(null);
  const [aEliminar, setAEliminar] = useState<UsuarioFila | null>(null);

  const cargar = () => api("usuarios").then(setDatos, (e: Error) => setError(e.message));
  useEffect(() => { if (puede("usuarios.editar")) cargar(); }, []);

  if (!puede("usuarios.editar")) return <div className="empty card"><h2>Solo los administradores pueden ver los usuarios</h2></div>;
  if (error) return <div className="empty card"><h2>{error}</h2></div>;
  if (!datos) return <p className="muted">Cargando…</p>;

  async function eliminar(u: UsuarioFila) {
    setAEliminar(null);
    try {
      const r = await api("usuario/eliminar", { body: { id: u.id } });
      avisar(r.eliminado ? "Usuario eliminado" : `${nombreDe(u)} ya hizo cambios en el sistema: quedó desactivado y no puede ingresar`, { ms: 6000 });
    } catch (e) {
      avisar((e as Error).message, { tono: "bad", ms: 6000 });
    }
    cargar();
  }

  return (
    <>
      <title>Usuarios · La Unión</title>
      <div className="page-head">
        <div><h1>Usuarios</h1><p>Cada persona entra con su usuario. Lo que puede hacer depende del rol.</p></div>
        <button className="btn btn-primary" type="button" onClick={() => setEditar("nuevo")}><Icono n="plus" />Nuevo usuario</button>
      </div>
      <section className="card"><div className="table-wrap"><table className="table cards">
        <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Último ingreso</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {datos.usuarios.map((u) => (
            <tr key={u.id} style={u.activo ? undefined : { opacity: 0.6 }}>
              <td className="full"><div className="row" style={{ flexWrap: "nowrap" }}><span className="avatar">{iniciales(nombreDe(u))}</span>
                <span className="cell-title">{nombreDe(u)}{u.id === yo?.id && <> <span className="badge plain">Vos</span></>}</span></div></td>
              <td data-label="Usuario"><code>{u.nombre_usuario}</code></td>
              <td data-label="Rol">{u.rol}</td>
              <td data-label="Último ingreso" className="small muted">{u.ultimo_ingreso_en ? fechaHora(u.ultimo_ingreso_en) : "Nunca"}</td>
              <td data-label="Estado">{u.activo ? <span className="badge ok">Activo</span> : <span className="badge">Desactivado</span>}
                {u.activo && u.debe_cambiar_clave ? <> <span className="badge warn plain">Contraseña temporal</span></> : null}</td>
              <td className="right full"><div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                <button className="btn btn-sm" type="button" onClick={() => setEditar(u)}><Icono n="edit" />Editar</button>
                {u.id !== yo?.id && <button className="btn btn-sm btn-ghost btn-danger" type="button" onClick={() => setAEliminar(u)}><Icono n="trash" />Eliminar</button>}
              </div></td>
            </tr>
          ))}
        </tbody>
      </table></div></section>

      {editar && <FormUsuario datos={datos} u={editar === "nuevo" ? null : editar} propio={editar !== "nuevo" && editar.id === yo?.id}
        alCerrar={() => setEditar(null)} alGuardar={() => { setEditar(null); cargar(); }} />}
      {aEliminar && (
        <Modal titulo={`Eliminar a ${nombreDe(aEliminar)}`} alCerrar={() => setAEliminar(null)}
          pie={<><button className="btn" type="button" onClick={() => setAEliminar(null)}>Cancelar</button>
            <button className="btn btn-dark" type="button" onClick={() => eliminar(aEliminar)}>Eliminar</button></>}>
          <p>No va a poder ingresar más al panel. Si ya hizo cambios en el sistema (modelos, precios, presupuestos…), el usuario queda desactivado en vez de borrarse, para no perder quién los hizo.</p>
        </Modal>
      )}
    </>
  );
}

function FormUsuario({ datos, u, propio, alCerrar, alGuardar }: { datos: Datos; u: UsuarioFila | null; propio: boolean; alCerrar: () => void; alGuardar: () => void }) {
  const avisar = useAviso();
  const [f, setF] = useState({
    empleado_id: "",
    nombre: u?.nombre ?? "",
    nombre_usuario: u?.nombre_usuario ?? "",
    rol_id: String(u?.rol_id ?? datos.roles.find((r) => r.nombre === "Vendedor")?.id ?? datos.roles[0]?.id ?? ""),
    clave: u ? "" : temporal(),
    activo: u ? !!u.activo : true,
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c: Partial<typeof f>) => setF((x) => ({ ...x, ...c }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (f.nombre.trim().length < 2) return setError("Escribí el nombre de la persona.");
    if (!/^[a-z0-9._-]{3,30}$/.test(f.nombre_usuario.trim().toLowerCase())) return setError("El usuario va en una sola palabra de 3 a 30 letras o números, sin espacios ni tildes. Ej: martin");
    if ((!u || f.clave) && f.clave.length < 8) return setError("La contraseña tiene que tener al menos 8 caracteres.");
    setEnviando(true);
    try {
      await api("usuario/guardar", { body: { id: u?.id ?? null, nombre: f.nombre, nombre_usuario: f.nombre_usuario, rol_id: +f.rol_id, clave: f.clave, activo: f.activo, empleado_id: +f.empleado_id || null } });
      const usuario = f.nombre_usuario.trim().toLowerCase();
      avisar(!u ? `Usuario creado. Pasale: ${usuario} / ${f.clave}` : f.clave ? `Contraseña cambiada. Pasale: ${usuario} / ${f.clave}` : "Usuario guardado", { ms: f.clave ? 12000 : 3500 });
      alGuardar();
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={u ? `Editar · ${u.nombre || u.nombre_usuario}` : "Nuevo usuario"} alCerrar={alCerrar}
      pie={<><button className="btn" type="button" onClick={alCerrar}>Cancelar</button>
        <button className="btn btn-primary" type="submit" form="form-usuario" disabled={enviando}>{u ? "Guardar" : "Crear usuario"}</button></>}>
      <form id="form-usuario" className="stack" onSubmit={guardar} noValidate>
        {!u && datos.empleados.length > 0 && (
          <label className="field"><span>¿Ya está cargado como empleado?</span>
            <select className="select" value={f.empleado_id} onChange={(e) => {
              const emp = datos.empleados.find((x) => String(x.id) === e.target.value);
              cambiar({ empleado_id: e.target.value, ...(emp ? { nombre: emp.nombre, nombre_usuario: emp.nombre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "") } : {}) });
            }}>
              <option value="">No, es una persona nueva</option>
              {datos.empleados.map((x) => <option key={x.id} value={x.id}>{x.nombre} ({x.puesto})</option>)}
            </select>
            <small>Por ejemplo, un vendedor que ya tiene su link en la web.</small>
          </label>
        )}
        <label className="field"><span>Nombre y apellido</span><input className="input" value={f.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} autoFocus /></label>
        <label className="field"><span>Usuario</span><input className="input" value={f.nombre_usuario} autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="Ej: martin"
          onChange={(e) => cambiar({ nombre_usuario: e.target.value })} /><small>Con esto ingresa. Una sola palabra, sin espacios ni tildes.</small></label>
        <div className="field"><span>Rol</span>
          <div className="radio-cards">
            {datos.roles.map((r) => (
              <label key={r.id} title={propio ? "No podés cambiar tu propio rol" : undefined}>
                <input type="radio" name="rol" value={r.id} checked={f.rol_id === String(r.id)} disabled={propio} onChange={(e) => cambiar({ rol_id: e.target.value })} />
                <b>{r.nombre}</b><small>{r.descripcion}</small>
              </label>
            ))}
          </div>
        </div>
        {propio ? (
          <p className="small muted">Tu contraseña la cambiás desde “Cambiar mi contraseña”, en el menú.</p>
        ) : (
          <label className="field"><span>{u ? "Nueva contraseña temporal (opcional)" : "Contraseña temporal"}</span>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input className="input" value={f.clave} autoComplete="off" spellCheck={false} placeholder={u ? "Dejar vacío para no cambiarla" : ""} onChange={(e) => cambiar({ clave: e.target.value })} />
              <button type="button" className="btn" onClick={() => cambiar({ clave: temporal() })}>Generar</button>
            </div>
            <small>{u ? "Si se olvidó la suya, poné una nueva y pasásela." : "Pasásela a la persona."} La cambia por una propia cuando ingresa.</small>
          </label>
        )}
        {u && !propio && <label className="switch"><input type="checkbox" checked={f.activo} onChange={(e) => cambiar({ activo: e.target.checked })} />Puede ingresar al panel</label>}
        {error && <p className="alert bad" role="alert"><Icono n="alert" /><span>{error}</span></p>}
      </form>
    </Modal>
  );
}
