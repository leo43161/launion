// Íconos y logo: un solo <svg> con todos los símbolos (<Sprite/>, una vez por página) y <use> en cada uso.
// Los mismos trazos del panel anterior (muebleria/assets/js/ui.js).

const P = (d: string) => `<path d="${d}"/>`;
const ICONOS = {
  home: P("M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9"),
  plus: P("M12 5v14M5 12h14"),
  catalog: P("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"),
  users: P("M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M20 19v-1a4 4 0 0 0-3-3.9M15 3.2a4 4 0 0 1 0 7.6") + `<circle cx="9" cy="7" r="4"/>`,
  search: `<circle cx="11" cy="11" r="7"/>` + P("m20 20-3.5-3.5"),
  logout: P("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"),
  right: P("m9 6 6 6-6 6"),
  x: P("M6 6l12 12M18 6 6 18"),
  check: P("m5 12.5 4.2 4.2L19 7"),
  alert: P("M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"),
  image: P("M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4") + `<circle cx="15.5" cy="9" r="1.5"/>`,
  upload: P("M12 16V4M7 9l5-5 5 5M4 20h16"),
  eye: P("M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z") + `<circle cx="12" cy="12" r="3"/>`,
  eyeoff: P("M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"),
  up: P("m6 15 6-6 6 6"),
  trash: P("M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"),
  undo: P("M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"),
  sun: `<circle cx="12" cy="12" r="4"/>` + P("M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"),
  moon: P("M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"),
  menu: P("M4 7h16M4 12h16M4 17h16"),
  link: P("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"),
  ext: P("M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"),
  calc: `<rect x="5" y="3" width="14" height="18" rx="2"/>` + P("M8.5 7h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01"),
  key: `<circle cx="8" cy="15" r="4"/>` + P("M10.8 12.2 20 3M17 6l3 3M14.5 8.5l2 2"),
  copy: `<rect x="9" y="9" width="11" height="11" rx="2"/>` + P("M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"),
  edit: P("M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"),
};
export type NombreIcono = keyof typeof ICONOS;

const LOGO = `<linearGradient id="lu-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2D58A"/><stop offset=".45" stop-color="#D6A548"/><stop offset="1" stop-color="#A9782C"/></linearGradient>
<linearGradient id="lu-bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C6B5D"/><stop offset="1" stop-color="#4A3E35"/></linearGradient>
<symbol id="lu-mark" viewBox="0 0 320 460"><g transform="translate(-14 -24)"><path d="M100 66 L157 98 L157 334 L208 360 L262 333 L262 100 L318 64 L318 354 L208 412 L100 372 Z" fill="url(#lu-bronze)" stroke="#231E1A" stroke-width="7"/><path d="M38 38 L80 56 L80 370 L194 424 L194 472 L38 396 Z" fill="url(#lu-gold)" stroke="#231E1A" stroke-width="7"/><g stroke="#231E1A" stroke-width="2.2" fill="none"><path d="M49 44 L49 418"/><path d="M20 360 L194 444"/></g></g></symbol>`;

const SIMBOLOS = Object.entries(ICONOS)
  .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`)
  .join("") + LOGO;

export const Sprite = () => (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <defs dangerouslySetInnerHTML={{ __html: SIMBOLOS }} />
  </svg>
);

export const Icono = ({ n, className = "" }: { n: NombreIcono; className?: string }) => (
  <svg className={`i ${className}`} aria-hidden="true"><use href={`#i-${n}`} /></svg>
);

export const Logo = ({ alto = 34, className = "" }: { alto?: number; className?: string }) => (
  <svg className={className} viewBox="0 0 320 460" style={{ height: alto, width: "auto" }} aria-hidden="true"><use href="#lu-mark" /></svg>
);
