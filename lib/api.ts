// Llamadas a la API PHP (api/index.php?r=<ruta>). El token del ingreso viaja en Authorization;
// si vence (401) se borra y se avisa con el evento "lu:sesion-vencida" para volver al ingreso.
import type { Pedidos, Respuestas } from "./tipos";

const API = process.env.NEXT_PUBLIC_API_URL || "/api/index.php";
const WEB = process.env.NEXT_PUBLIC_WEB_URL || "/";
const CLAVE_TOKEN = "lu-token";

export const leerToken = (): string | null => {
  try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; }
};
export const guardarToken = (token: string | null): void => {
  try { token ? localStorage.setItem(CLAVE_TOKEN, token) : localStorage.removeItem(CLAVE_TOKEN); } catch {}
};
function vencida() {
  guardarToken(null);
  dispatchEvent(new Event("lu:sesion-vencida"));
}

const direccion = (ruta: string, query?: Record<string, string>) => `${API}?${new URLSearchParams({ r: ruta, ...query })}`;

type RutaGet = Exclude<keyof Respuestas, keyof Pedidos>;

/** GET para las rutas sin cuerpo y POST para las de Pedidos. Devuelve el JSON tipado o lanza un Error con el mensaje del servidor. */
export function api<R extends RutaGet>(ruta: R, opciones?: { query?: Record<string, string> }): Promise<Respuestas[R]>;
export function api<R extends keyof Pedidos>(ruta: R, opciones: { body: Pedidos[R] }): Promise<Respuestas[R]>;
export async function api(ruta: keyof Respuestas, { body, query }: { body?: unknown; query?: Record<string, string> } = {}): Promise<unknown> {
  const token = leerToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let r: Response;
  try {
    r = await fetch(direccion(ruta, query), {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("No hay conexión con el servidor.");
  }
  const datos = (await r.json().catch(() => ({ error: `El servidor respondió ${r.status}.` }))) as { error?: string };
  if (r.status === 401 && ruta !== "auth/ingresar") vencida();
  if (!r.ok) throw new Error(datos.error || `Error ${r.status}`);
  return datos;
}

/** Sube una foto o video y devuelve su ruta. XHR y no fetch: fetch no informa el avance de la subida, y un video tarda. */
export function subir(archivo: File, alAvanzar?: (fraccion: number) => void): Promise<string> {
  return new Promise((ok, mal) => {
    const x = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", archivo);
    x.open("POST", direccion("subir"));
    const token = leerToken();
    if (token) x.setRequestHeader("Authorization", `Bearer ${token}`);
    x.upload.onprogress = (e) => e.lengthComputable && alAvanzar?.(e.loaded / e.total);
    x.onerror = () => mal(new Error("Se cortó la conexión."));
    x.onload = () => {
      let j: { url?: string; error?: string };
      try { j = JSON.parse(x.responseText); } catch { j = { error: `El servidor respondió ${x.status}.` }; }
      if (x.status === 401) vencida();
      if (x.status === 200 && j.url) ok(j.url);
      else mal(new Error(j.error || `Error ${x.status}`));
    };
    x.send(fd);
  });
}

/** Fotos y videos se guardan relativos a la web pública (assets/productos/...). */
export const media = (ruta: string): string => (/^(https?:|\/|data:|blob:)/.test(ruta) ? ruta : WEB + ruta);

/** La web pública, con dirección completa (para los links de vendedores). */
export const webPublica = (): string => new URL(WEB, location.href).href;
