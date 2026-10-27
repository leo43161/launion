"use client";
// Ventana sobre la página. Se cierra con la X, tocando afuera o con Escape; al cerrar, el foco vuelve a donde estaba.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icono } from "./Icono";

interface Props {
  titulo: string;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: boolean;
  alCerrar: () => void;
}

export function Modal({ titulo, children, pie, ancho = false, alCerrar }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => raiz.current?.querySelector<HTMLElement>("[autofocus], input, select, textarea, .modal-foot .btn-primary, .modal-head button")?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      previo?.focus?.({ preventScroll: true });
    };
  }, []);
  return (
    <div className="modal-root" ref={raiz} onKeyDown={(e) => e.key === "Escape" && alCerrar()}>
      <div className="modal-scrim" onClick={alCerrar} />
      <div className={`modal ${ancho ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="modal-head">
          <h2 id={id}>{titulo}</h2>
          <button className="icon-btn" type="button" onClick={alCerrar} aria-label="Cerrar"><Icono n="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {pie && <div className="modal-foot">{pie}</div>}
      </div>
    </div>
  );
}
