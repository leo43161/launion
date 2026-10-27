"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSesion } from "@/lib/sesion";
import { Icono, Logo } from "@/components/Icono";

export default function Pagina() {
  return <Suspense><Ingresar /></Suspense>;
}

function Ingresar() {
  const { usuario, ingresar } = useSesion();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const destino = next && next.startsWith("/admin/") && !next.startsWith("/admin/ingresar") ? next : "/admin/catalogo/";
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ver, setVer] = useState(false);
  const [olvido, setOlvido] = useState(false);

  useEffect(() => { if (usuario) router.replace(destino); }, [usuario, router, destino]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const datos = new FormData(f);
    setError("");
    setEnviando(true);
    try {
      await ingresar(String(datos.get("usuario")).trim(), String(datos.get("clave")));
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
      f.querySelector<HTMLInputElement>("[name=clave]")?.select();
    }
  }

  return (
    <div className="login-page">
      <title>Ingresar · La Unión</title>
      <div className="login-col">
        <form className="card login-card" onSubmit={enviar} noValidate>
          <Logo alto={54} className="logo" />
          <h1>Panel interno</h1>
          <p className="lead">Ingresá con tu usuario de La Unión.</p>
          <label className="field"><span>Usuario</span><input className="input" name="usuario" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus /></label>
          <label className="field"><span>Contraseña</span>
            <span className="pass-wrap">
              <input className="input" name="clave" type={ver ? "text" : "password"} autoComplete="current-password" required />
              <button type="button" className="icon-btn" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}><Icono n={ver ? "eyeoff" : "eye"} /></button>
            </span>
          </label>
          {error && <p className="alert bad" role="alert"><Icono n="alert" /><span>{error}</span></p>}
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={enviando}>{enviando ? "Ingresando…" : "Ingresar"}</button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOlvido(true)} style={{ justifySelf: "center" }}>¿Olvidaste tu contraseña?</button>
          {olvido && <p className="muted small" style={{ textAlign: "center" }}>Pedile al administrador que te la restablezca.</p>}
        </form>
      </div>
    </div>
  );
}
