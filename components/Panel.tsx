"use client";
// Estructura del panel: menú lateral (computadora), barra de abajo (celular), tema claro/oscuro y salir.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useSesion } from "@/lib/sesion";
import { api, webPublica } from "@/lib/api";
import { iniciales } from "@/lib/formato";
import type { Permiso } from "@/lib/tipos";
import { Icono, Logo, type NombreIcono } from "./Icono";
import { Modal } from "./Modal";
import { useAviso } from "./Avisos";

interface ItemMenu {
  href: string;
  texto: string;
  icono: NombreIcono;
  permiso?: Permiso; // solo la ve quien lo tiene
}

// Cada sección nueva se suma acá.
const MENU: ItemMenu[] = [
  { href: "/admin/catalogo/", texto: "Catálogo", icono: "catalog" },
  { href: "/admin/vendedores/", texto: "Vendedores", icono: "users", permiso: "catalogo.editar" },
];

function useTema(): [boolean, () => void] {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => setOscuro(document.documentElement.getAttribute("data-theme") === "dark"), []);
  const cambiar = () => {
    const nuevo = !oscuro;
    if (nuevo) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem("lu-admin-theme", nuevo ? "dark" : ""); } catch {}
    setOscuro(nuevo);
  };
  return [oscuro, cambiar];
}

export function Panel({ children }: { children: ReactNode }) {
  const { usuario, puede, salir } = useSesion();
  const ruta = usePathname();
  const [oscuro, cambiarTema] = useTema();
  const [mas, setMas] = useState(false);
  if (!usuario) return null;
  const items = MENU.filter((m) => !m.permiso || puede(m.permiso));
  const actual = (m: ItemMenu) => (ruta.startsWith(m.href) ? "page" : undefined);
  const tema = <><Icono n={oscuro ? "sun" : "moon"} />{oscuro ? "Modo claro" : "Modo oscuro"}</>;

  return (
    <div className="app">
      <aside className="side" aria-label="Menú principal">
        <Link className="brand" href="/admin/catalogo/"><Logo alto={34} /><span><b>La Unión</b><small>Panel interno</small></span></Link>
        <nav className="nav">
          {items.map((m) => <Link key={m.href} href={m.href} aria-current={actual(m)}><Icono n={m.icono} /><span>{m.texto}</span></Link>)}
        </nav>
        <div className="foot">
          <div className="me"><span className="avatar">{iniciales(usuario.nombre)}</span><span className="grow"><b>{usuario.nombre}</b><span>{usuario.rol}</span></span></div>
          <div className="row" style={{ padding: "0 4px" }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={cambiarTema}>{tema}</button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={salir}><Icono n="logout" />Salir</button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Link className="m-brand" href="/admin/catalogo/" aria-label="Inicio"><Logo alto={30} /></Link>
          <div className="grow" />
          <div className="actions">
            <a className="btn btn-ghost btn-sm" href={webPublica()} target="_blank" rel="noopener" title="Abrir la web pública"><Icono n="ext" /><span className="hide-s">Ver web</span></a>
          </div>
        </header>
        <main className="content" id="view" tabIndex={-1}>{children}</main>
      </div>
      <nav className="bottom-nav" style={{ "--n": items.length + 1 } as CSSProperties} aria-label="Menú">
        {items.map((m) => <Link key={m.href} href={m.href} aria-current={actual(m)}><Icono n={m.icono} /><span>{m.texto}</span></Link>)}
        <button type="button" onClick={() => setMas(true)}><Icono n="menu" /><span>Más</span></button>
      </nav>

      {mas && (
        <Modal titulo={usuario.nombre} alCerrar={() => setMas(false)}>
          <p className="muted" style={{ marginBottom: 12 }}>{usuario.rol}</p>
          <nav className="nav" style={{ display: "grid", gap: 2 }}>
            <a href={webPublica()} target="_blank" rel="noopener"><Icono n="ext" /><span>Ver la web pública</span></a>
          </nav>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" type="button" onClick={() => { setMas(false); cambiarTema(); }}>{tema}</button>
            <button className="btn" type="button" onClick={salir}><Icono n="logout" />Cerrar sesión</button>
          </div>
        </Modal>
      )}
      {usuario.debe_cambiar_clave && <NuevaClave />}
    </div>
  );
}

/** Primer ingreso con contraseña temporal: hay que elegir una propia. */
function NuevaClave() {
  const { claveCambiada } = useSesion();
  const avisar = useAviso();
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const actual = String(datos.get("actual")), nueva = String(datos.get("nueva"));
    if (nueva.length < 8) return setError("Usá al menos 8 caracteres.");
    if (nueva !== datos.get("repetida")) return setError("Las dos contraseñas no coinciden.");
    setEnviando(true);
    try {
      await api("auth/clave", { body: { actual, nueva } });
      claveCambiada();
      avisar("Contraseña guardada");
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  }
  return (
    <Modal titulo="Elegí tu contraseña" alCerrar={() => {}}>
      <form className="stack" onSubmit={guardar} noValidate>
        <p className="muted">Es tu primer ingreso. Cambiá la contraseña temporal por una propia.</p>
        <label className="field"><span>Contraseña temporal</span><input className="input" type="password" name="actual" autoComplete="current-password" required /></label>
        <label className="field"><span>Nueva contraseña</span><input className="input" type="password" name="nueva" minLength={8} autoComplete="new-password" required /></label>
        <label className="field"><span>Repetila</span><input className="input" type="password" name="repetida" autoComplete="new-password" required /></label>
        {error && <p className="small" style={{ color: "var(--bad)" }} role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={enviando}>Guardar contraseña</button>
      </form>
    </Modal>
  );
}
