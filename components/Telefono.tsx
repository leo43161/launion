"use client";
// Teléfono listo para WhatsApp: +54 9, el código de área y el número, sin 0 ni 15. Entre los dos suman 10 cifras y no deja escribir de más.
// valor: como lo muestra telefonoLindo ("381 319-6842"), o "" si no tiene número. normTelefono lo pasa a 5493813196842 para guardarlo.
// Mientras no tenga número, el código de área es `area` (el de la localidad del cliente), salvo que lo cambien a mano.
// Si pegan el número entero (+54 9 381 319-6842, 0381 15 319-6842…), se acomoda solo.
import { useState } from "react";
import { largoArea, normTelefono, numeroLocal } from "@/lib/formato";

interface Props {
  valor: string;
  alCambiar: (valor: string) => void;
  area?: string; // el código de área de la localidad
  etiqueta?: string;
  required?: boolean;
}

/** "381 319-6842" → ["381", "3196842"]. Sin espacio (5493813196842, como viene de la base), lo parte largoArea. */
function partes(v: string): [string, string] | null {
  if (!v.trim()) return null;
  const i = v.indexOf(" ");
  if (i >= 0) return [v.slice(0, i).replace(/\D/g, ""), v.slice(i + 1).replace(/\D/g, "")];
  const d = normTelefono(v).replace(/^549/, "");
  return [d.slice(0, largoArea(d)), d.slice(largoArea(d))];
}

/** Las 10 cifras si el texto es un número entero (con o sin +54 9, 0 o 15); si no, null. */
const entero = (texto: string) => {
  const d = normTelefono(texto);
  return /^549\d{10}$/.test(d) ? d.slice(3) : null;
};

export function Telefono({ valor, alCambiar, area = "381", etiqueta = "Teléfono", required }: Props) {
  const [propia, setPropia] = useState<string | null>(null); // el código de área que escribieron mientras no hay número
  const [visto, setVisto] = useState(false); // ya salió del campo: recién ahí avisa si está incompleto
  const [a, n] = partes(valor) ?? [propia ?? area, ""];
  const largo = 10 - a.length; // las cifras que lleva el número
  const falta = largo - n.length;
  const error = !n ? "" : !a ? "Falta el código de área" : falta ? `${falta > 0 ? "Faltan" : "Sobran"} ${Math.abs(falta)} ${Math.abs(falta) === 1 ? "número" : "números"}` : "";

  const poner = (a2: string, n2: string) => {
    if (!n2) {
      setPropia(a2);
      return alCambiar("");
    }
    alCambiar(`${a2} ${numeroLocal(n2, 10 - a2.length)}`);
  };
  const ponerEntero = (d: string) => poner(d.slice(0, largoArea(d)), d.slice(largoArea(d)));

  return (
    <span className="tel-wrap">
      <span className="input-money tel">
        <span>+54 9</span>
        <input className="tel-area" inputMode="numeric" autoComplete="off" aria-label={`${etiqueta}: código de área`} placeholder={area} value={a}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "");
            const todo = d.length > 4 && entero(e.target.value);
            if (todo) return ponerEntero(todo);
            poner(d.replace(/^0+/, "").slice(0, 4), n);
          }} />
        <input inputMode="tel" autoComplete="off" aria-label={`${etiqueta}: número`} required={required} placeholder={numeroLocal("45551203".slice(-largo), largo)}
          value={numeroLocal(n, largo)} aria-invalid={visto && !!error}
          onChange={(e) => {
            let d = e.target.value.replace(/\D/g, "");
            if (d.length > largo) {
              const todo = entero(e.target.value);
              if (todo) return ponerEntero(todo);
              if (d.startsWith("15")) d = d.slice(2); // el 15 de los celulares no va
              d = d.slice(0, largo);
            }
            poner(a, d);
          }}
          onBlur={() => {
            setVisto(true);
            if (a.length + n.length === 10 && largoArea(a + n) !== a.length) ponerEntero(a + n); // código de área mal partido: 38 + 13196842 → 381 319-6842
          }} />
      </span>
      {visto && error && <small className="err">{error}</small>}
    </span>
  );
}
