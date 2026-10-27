"use client";
// Avisos cortos abajo de la pantalla ("Cambios guardados"). useAviso()(texto, { tono: "bad" }).
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Avisar = (texto: string, opciones?: { tono?: "bad"; ms?: number }) => void;

const Contexto = createContext<Avisar>(() => {});
export const useAviso = () => useContext(Contexto);

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<{ id: number; texto: string; tono: string }[]>([]);
  const avisar = useCallback<Avisar>((texto, { tono, ms = 3500 } = {}) => {
    const id = Math.random();
    setLista((l) => [...l, { id, texto, tono: tono || "" }]);
    setTimeout(() => setLista((l) => l.filter((a) => a.id !== id)), ms);
  }, []);
  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {lista.map((a) => <div key={a.id} className={`toast ${a.tono}`}><span>{a.texto}</span></div>)}
      </div>
    </Contexto.Provider>
  );
}
