import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// Sin "title" acá: cada página pone el suyo con <title>. Si estuvieran los dos, el navegador usa el primero (este).
// El ícono de la pestaña es app/icon.svg: Next le pone solo el /dev cuando hace falta.
// Estilos, tema y color de la barra van en cada sección: app/(web)/layout.tsx (la web, con Tailwind) y app/admin/layout.tsx (el panel).
export const metadata: Metadata = {};
export const viewport: Viewport = { viewportFit: "cover" };

export default function Raiz({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Marcellus&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
