import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Proveedores } from "@/components/Proveedores";
import "../admin.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#F6F5F2" };

// El tema se pone antes de pintar: si no, el modo oscuro parpadea en claro al cargar.
const TEMA = `try{var t=localStorage.getItem("lu-admin-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function LayoutAdmin({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      <Proveedores>{children}</Proveedores>
    </>
  );
}
