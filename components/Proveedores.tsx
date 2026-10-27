"use client";
import type { ReactNode } from "react";
import { SesionProvider } from "@/lib/sesion";
import { AvisosProvider } from "./Avisos";
import { Sprite } from "./Icono";

export function Proveedores({ children }: { children: ReactNode }) {
  return (
    <SesionProvider>
      <AvisosProvider>
        <Sprite />
        {children}
      </AvisosProvider>
    </SesionProvider>
  );
}
