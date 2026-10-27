import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./web.css";

// Vista previa al compartir. Sin og:url ni canonical a propósito: el link de vendedor (/pilar…) tiene que seguir siendo /pilar.
export const metadata: Metadata = {
  description: "Muebles a tu medida, hechos en Tucumán. Elegí el modelo, la medida y el color: lo fabricamos y te lo instalamos. Showroom en Lomas de Tafí.",
  openGraph: {
    type: "website", locale: "es_AR", siteName: "La Unión Muebles",
    title: "La Unión Muebles · Muebles a tu medida en Tucumán",
    description: "Elegí el modelo, la medida y el color: lo fabricamos y te lo instalamos. Showroom en Lomas de Tafí.",
    images: [{ url: "https://launionmuebles.com.ar/assets/brand/compartir.jpg", width: 900, height: 472 }],
  },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = { themeColor: "#1F1B17" };

// Colores elegidos (claro, gris u oscuro): se ponen antes de pintar para que no parpadee.
const TEMA = `try{var t=localStorage.getItem("lu-theme");if(t==="gris"||t==="oscuro")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
const GA = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","G-SFSL5MTP1F");`;

export default function LayoutWeb({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-SFSL5MTP1F" />
      <script dangerouslySetInnerHTML={{ __html: GA }} />
      {children}
    </>
  );
}
