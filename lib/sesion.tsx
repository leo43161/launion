"use client";
// Usuario que ingresó y sus permisos. Se valida el token con la API al abrir el panel.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, guardarToken, leerToken } from "./api";
import type { Permiso, Usuario } from "./tipos";

interface Sesion {
  /** undefined: cargando · null: sin sesión */
  usuario: Usuario | null | undefined;
  ingresar(nombre: string, clave: string): Promise<Usuario>;
  salir(): void;
  /** "*" = todos los permisos (Administrador) */
  puede(permiso: Permiso): boolean;
  claveCambiada(): void;
}

const Contexto = createContext<Sesion | null>(null);

export function useSesion(): Sesion {
  const sesion = useContext(Contexto);
  if (!sesion) throw new Error("useSesion se usa dentro de <SesionProvider>");
  return sesion;
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);

  useEffect(() => {
    const vencida = () => setUsuario(null);
    addEventListener("lu:sesion-vencida", vencida);
    if (!leerToken()) setUsuario(null);
    else api("auth/yo").then((r) => setUsuario(r.usuario), () => setUsuario(null));
    return () => removeEventListener("lu:sesion-vencida", vencida);
  }, []);

  const valor: Sesion = {
    usuario,
    async ingresar(nombre, clave) {
      const { token } = await api("auth/ingresar", { body: { usuario: nombre, clave } });
      guardarToken(token);
      const r = await api("auth/yo");
      setUsuario(r.usuario);
      return r.usuario;
    },
    salir() {
      guardarToken(null);
      setUsuario(null);
    },
    puede: (p) => !!usuario && (usuario.permisos.includes("*") || usuario.permisos.includes(p)),
    claveCambiada: () => setUsuario((u) => u && { ...u, debe_cambiar_clave: false }),
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
