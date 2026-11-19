"use client";
// Select con buscador y una miniatura en cada opción (el <select> del navegador no muestra fotos).
// Se abre con clic o con la flecha abajo; se escribe para buscar, las flechas recorren la lista, Enter elige y Escape cierra.
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { media } from "@/lib/api";
import { norm } from "@/lib/formato";
import { Icono } from "./Icono";

export interface OpcionFoto {
  valor: string;
  texto: string;
  detalle?: string; // segunda línea, en gris
  foto?: string | null;
  grupo?: string; // título arriba de las opciones del mismo grupo (vienen ordenadas por grupo)
}

interface Props {
  opciones: OpcionFoto[];
  valor: string; // "" = ninguna
  alCambiar: (valor: string) => void;
  etiqueta: string;
  vacio?: string; // la opción para no elegir ninguna
  buscar?: string; // placeholder del buscador
}

const Foto = ({ o }: { o: OpcionFoto }) => (o.foto ? <img className="thumb" src={media(o.foto)} alt="" loading="lazy" /> : <span className="thumb"><Icono n="image" /></span>);

export function SelectConFoto({ opciones, valor, alCambiar, etiqueta, vacio = "Ninguno", buscar = "Buscar…" }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const elegida = opciones.find((o) => o.valor === valor);
  const ninguna: OpcionFoto = { valor: "", texto: vacio };
  const t = norm(q.trim()).split(/\s+/).filter(Boolean);
  const lista = t.length ? opciones.filter((o) => t.every((x) => norm(`${o.texto} ${o.detalle ?? ""} ${o.grupo ?? ""}`).includes(x))) : [ninguna, ...opciones];

  // Se cierra al tocar afuera
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);
  useEffect(() => { if (abierto) document.getElementById(`${id}-${activo}`)?.scrollIntoView({ block: "nearest" }); }, [abierto, activo, id]);

  const abrir = () => {
    setQ("");
    setActivo(Math.max(0, [ninguna, ...opciones].findIndex((o) => o.valor === valor)));
    setAbierto(true);
  };
  const cerrar = () => { setAbierto(false); boton.current?.focus(); };
  const elegir = (o: OpcionFoto) => { alCambiar(o.valor); cerrar(); };

  return (
    <div className="combo" ref={raiz}>
      <button type="button" ref={boton} className="select combo-btn" aria-haspopup="listbox" aria-expanded={abierto} aria-label={`${etiqueta}: ${elegida?.texto ?? vacio}`}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !abierto) { e.preventDefault(); abrir(); } }}>
        {elegida ? <><Foto o={elegida} /><span className="grow combo-txt"><b>{elegida.texto}</b>{elegida.detalle && <small>{elegida.detalle}</small>}</span></> : <span className="grow muted">{vacio}</span>}
        <Icono n="right" />
      </button>
      {abierto && (
        <div className="combo-pop">
          <input className="input" type="search" role="combobox" aria-expanded="true" aria-controls={`${id}-lista`} aria-autocomplete="list" autoFocus autoComplete="off"
            aria-activedescendant={lista[activo] ? `${id}-${activo}` : undefined} aria-label={`Buscar ${etiqueta.toLowerCase()}`} placeholder={buscar} value={q}
            onChange={(e) => { setQ(e.target.value); setActivo(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActivo((x) => Math.min(Math.max(x + (e.key === "ArrowDown" ? 1 : -1), 0), lista.length - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); if (lista[activo]) elegir(lista[activo]); }
              else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar(); }
              else if (e.key === "Tab") setAbierto(false);
            }} />
          <ul role="listbox" id={`${id}-lista`} aria-label={etiqueta}>
            {lista.map((o, i) => (
              <Fragment key={o.valor}>
                {o.grupo && o.grupo !== lista[i - 1]?.grupo && <li role="presentation" className="combo-grupo">{o.grupo}</li>}
                <li id={`${id}-${i}`} role="option" aria-selected={o.valor === valor} className={i === activo ? "on" : undefined}
                  onPointerEnter={() => setActivo(i)} onClick={() => elegir(o)}>
                  {o.valor ? <Foto o={o} /> : null}
                  <span className="grow combo-txt">{o.valor ? <b>{o.texto}</b> : <span className="muted">{o.texto}</span>}{o.detalle && <small>{o.detalle}</small>}</span>
                  {o.valor === valor && <Icono n="check" />}
                </li>
              </Fragment>
            ))}
            {!lista.length && <li role="presentation" className="combo-nada">No hay nada con “{q.trim()}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
