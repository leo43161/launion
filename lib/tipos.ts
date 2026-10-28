// Lo que manda y devuelve la API PHP (api/rutas/*.php). Si cambia una consulta o un campo, se cambia acá
// y TypeScript marca cada pantalla que hay que ajustar.
// De MySQL, TINYINT llega como 0/1 y DECIMAL como texto ("850000.00"): por eso Bit y Monto. Los ids son números (AUTO_INCREMENT).

export type Bit = 0 | 1;
export type Monto = string;
export type Permiso = "*" | "catalogo.editar" | "precios.ver" | "usuarios.editar";

export interface Usuario {
  id: number;
  nombre_usuario: string;
  nombre: string;
  rol: string;
  permisos: Permiso[];
  debe_cambiar_clave: boolean;
}

export interface Categoria {
  id: number;
  padre_id: number | null; // null = ambiente; con valor = tipo de mueble dentro de ese ambiente
  nombre: string;
  slug: string;
  publico: "casa" | "negocio" | null;
  orden: number;
  visible: Bit;
}

export interface Medidas {
  ancho_cm: number | null;
  alto_cm: number | null;
  profundidad_cm: number | null;
  diametro_cm: number | null;
  texto_medidas: string | null;
}

/** Fila de la lista del catálogo (catalogo_listar). */
export interface ProductoFila extends Medidas {
  id: number;
  categoria_id: number;
  nombre: string;
  codigo: string | null;
  visible: Bit;
  destacado: Bit;
  tiene_video: Bit;
  eliminado: Bit;
  foto: string | null;
  fotos: number;
  precio_local: Monto | null; // null sin el permiso precios.ver
}

export type TipoPrecio = "fijo" | "desde" | "rango";

export interface Precio {
  tipo_precio: TipoPrecio;
  monto: Monto;
  monto_hasta: Monto | null; // solo en rangos
}

/** Ficha completa (producto_ver). */
export interface Producto extends Medidas {
  id: number;
  categoria_id: number;
  ambiente_id: number;
  tipo: string;
  codigo: string | null;
  nombre: string;
  descripcion_corta: string | null;
  descripcion: string | null;
  variante: string | null;
  detalle_medidas: string | null;
  caracteristicas: string[];
  nota: string | null;
  mensaje_whatsapp: string | null;
  visible: Bit;
  destacado: Bit;
  url_modelo_3d: string | null;
  url_video: string | null;
  creado_en: string;
  actualizado_en: string | null;
  actualizado_por: number | null; // id del usuario
  eliminado_en: string | null;
  fotos: string[];
  precio_web: Precio | null;
  precio_local: Monto | null;
}

/** Lo que recibe producto/guardar. Sin id = alta. Los textos vacíos se guardan como NULL. */
export interface ProductoGuardar {
  id: number | null;
  nombre: string;
  ambiente_id: number;
  tipo: string; // si no existe en el ambiente, la API lo crea
  codigo: string;
  descripcion_corta: string;
  variante: string;
  ancho_cm: number | null;
  alto_cm: number | null;
  profundidad_cm: number | null;
  diametro_cm: number | null;
  detalle_medidas: string;
  texto_medidas: string;
  caracteristicas: string[];
  nota: string;
  mensaje_whatsapp: string;
  visible: boolean;
  destacado: boolean;
  url_video: string;
  fotos: string[];
  precio_web: { tipo_precio: TipoPrecio; monto: number; monto_hasta: number | null } | null;
  precio_local: number | null; // se ignora sin el permiso precios.ver
}

export interface Vendedor {
  id: number;
  link_web: string;
  nombre: string;
  telefono: string | null; // 549 + área + número
}

export interface VendedorGuardar {
  id?: number;
  nombre: string;
  link_web: string;
  telefono: string;
}

/* ---------- presupuestos de fabricación ---------- */
// Total de un insumo = cantidad × costo unitario. Costo = suma (lo calcula la API). Precio = costo × multiplicador.

/** Fila de la lista (presupuestos_listar). */
export interface PresupuestoFila {
  id: number;
  nombre: string;
  grupo: string | null;
  url_foto: string | null;
  multiplicador: Monto;
  precio_final: Monto | null; // null = el calculado
  costo: Monto;
  actualizado_en: string;
}

/** Pieza del despiece. */
export interface Corte {
  pieza: string | null;
  ancho_cm: Monto | null;
  alto_cm: Monto | null;
  cantidad: number;
  material: string | null;
}

export interface Insumo {
  insumo: string;
  cantidad: Monto;
  costo_unitario: Monto;
}

/** Presupuesto completo (presupuesto_ver). */
export interface Presupuesto {
  id: number;
  nombre: string;
  grupo: string | null;
  url_foto: string | null;
  notas: string | null;
  multiplicador: Monto;
  precio_final: Monto | null;
  costo: Monto;
  creado_en: string;
  actualizado_en: string | null;
  actualizado_por: number | null;
  cortes: Corte[];
  insumos: Insumo[];
}

/** Lo que recibe presupuesto/guardar. Sin id = alta. Las filas vacías no se guardan. */
export interface PresupuestoGuardar {
  id: number | null;
  nombre: string;
  grupo: string;
  url_foto: string;
  notas: string;
  multiplicador: number;
  precio_final: number | null;
  cortes: { pieza: string; ancho_cm: number | null; alto_cm: number | null; cantidad: number | null; material: string }[];
  insumos: { insumo: string; cantidad: number | null; costo_unitario: number | null }[];
}

/* ---------- usuarios (solo con usuarios.editar) ---------- */

export interface UsuarioFila {
  id: number;
  nombre_usuario: string;
  nombre: string; // "" si la cuenta no tiene empleado (el admin inicial)
  rol_id: number;
  rol: string;
  activo: Bit;
  debe_cambiar_clave: Bit;
  ultimo_ingreso_en: string | null;
}

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
}

/** Empleado sin cuenta: al crear un usuario se puede elegir para no cargar dos veces a la misma persona. */
export interface EmpleadoLibre {
  id: number;
  nombre: string;
  puesto: string;
}

/** Lo que recibe usuario/guardar. Sin id = alta. La clave es obligatoria en el alta; al editar, vacía = no se cambia. */
export interface UsuarioGuardar {
  id: number | null;
  nombre: string;
  nombre_usuario: string;
  rol_id: number;
  clave: string;
  activo: boolean;
  empleado_id: number | null; // solo en el alta
}

/* ---------- web pública (ruta "web", sin token) ---------- */

/** Ambiente con los tipos de mueble que tienen modelos visibles, en orden. */
export interface AmbienteWeb {
  slug: string;
  nombre: string;
  publico: "casa" | "negocio";
  frase: string | null;
  portada: string | null;
  tipos: string[];
}

/** Modelo visible, con sus fotos y el precio de la lista Web (null = "Consultar"). */
export interface ModeloWeb extends Medidas {
  id: number;
  ambiente: string; // slug del ambiente
  tipo: string;
  nombre: string;
  codigo: string | null;
  descripcion_corta: string | null;
  variante: string | null;
  detalle_medidas: string | null;
  caracteristicas: string[];
  nota: string | null;
  mensaje_whatsapp: string | null;
  url_video: string | null;
  destacado: Bit;
  fotos: string[];
  precio: Precio | null;
}

/** Trabajo realizado. El título es "<tipo> <número>": "Placard a medida 03". */
export interface TrabajoWeb {
  id: number;
  titulo: string;
  fotos: string[];
}

/** Respuesta de cada ruta. */
export interface Respuestas {
  "auth/ingresar": { token: string };
  "auth/yo": { usuario: Usuario };
  "auth/clave": { ok: true };
  catalogo: { categorias: Categoria[]; productos: ProductoFila[] };
  producto: { producto: Producto };
  "producto/guardar": { id: number };
  "producto/estado": { ok: true };
  vendedores: { vendedores: Vendedor[] };
  "vendedores/guardar": { vendedores: Vendedor[] };
  presupuestos: { presupuestos: PresupuestoFila[]; insumos: { insumo: string; costo_unitario: Monto }[] }; // insumos: el último costo de cada uno
  presupuesto: { presupuesto: Presupuesto };
  "presupuesto/guardar": { id: number };
  "presupuesto/eliminar": { ok: true };
  usuarios: { usuarios: UsuarioFila[]; roles: Rol[]; empleados: EmpleadoLibre[] };
  "usuario/guardar": { id: number };
  "usuario/eliminar": { eliminado: boolean }; // false = tenía cambios a su nombre: quedó desactivado
  web: { ambientes: AmbienteWeb[]; modelos: ModeloWeb[]; trabajos: TrabajoWeb[]; vendedores: Record<string, string> }; // vendedores: link → WhatsApp
}

/** Cuerpo de las rutas POST; las que no están acá son GET. La subida de archivos va aparte: subir(). */
export interface Pedidos {
  "auth/ingresar": { usuario: string; clave: string };
  "auth/clave": { actual: string; nueva: string };
  "producto/guardar": ProductoGuardar;
  "producto/estado": { id: number; visible?: Bit; eliminado?: Bit };
  "vendedores/guardar": { vendedores: VendedorGuardar[] };
  "presupuesto/guardar": PresupuestoGuardar;
  "presupuesto/eliminar": { id: number };
  "usuario/guardar": UsuarioGuardar;
  "usuario/eliminar": { id: number };
}
