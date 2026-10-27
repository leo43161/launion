"use client";
// Todo lo que está dentro de (panel) pide sesión: sin usuario, va al ingreso y después vuelve acá.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSesion } from "@/lib/sesion";
import { Panel } from "@/components/Panel";

export default function LayoutPanel({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const router = useRouter();
  const ruta = usePathname();
  useEffect(() => {
    if (usuario === null) router.replace(`/admin/ingresar/?next=${encodeURIComponent(ruta + location.search)}`);
  }, [usuario, router, ruta]);
  if (!usuario) return <p style={{ padding: 24, color: "var(--muted)" }}><title>Panel interno · La Unión</title>Cargando el panel…</p>;
  return <Panel>{children}</Panel>;
}
