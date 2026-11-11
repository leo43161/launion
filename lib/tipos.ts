// Lo que manda y devuelve la API PHP (api/rutas/*.php). Si cambia una consulta o un campo, se cambia acá
// y TypeScript marca cada pantalla que hay que ajustar.
// De MySQL, TINYINT llega como 0/1 y DECIMAL como texto ("850000.00"): por eso Bit y Monto. Los ids son números (AUTO_INCREMENT).

export type Bit = 0 | 1;
export type Monto = string;
export type Permiso = "*" | "catalogo.editar" | "precios.ver" | "usuarios.editar" | "ventas.crear" | "ventas.anular" | "configuracion.editar";

export interface Usuario {
  id: number;
  empleado_id: number | null; // null = cuenta sin empleado (el admin inicial): al vender elige el vendedor
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
  presupuestos: { id: number; nombre: string; multiplicador: Monto; precio_final: Monto | null; costo: Monto }[]; // los vinculados a este modelo
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
  producto_id: number | null; // modelo del catálogo vinculado
  producto: string | null; // su nombre
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
  porcentaje: Monto | null; // porcentual: la parte del total que entra en el costo. null = 100 %
}

/** Presupuesto completo (presupuesto_ver). */
export interface Presupuesto {
  id: number;
  nombre: string;
  grupo: string | null;
  producto_id: number | null;
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
  producto_id: number | null;
  url_foto: string;
  notas: string;
  multiplicador: number;
  precio_final: number | null;
  cortes: { pieza: string; ancho_cm: number | null; alto_cm: number | null; cantidad: number | null; material: string }[];
  insumos: { insumo: string; cantidad: number | null; costo_unitario: number | null; porcentaje: number | null }[];
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

/* ---------- ventas (ventas.crear; cancelar y anular cobros: ventas.anular) ---------- */
// Total = renglones − descuento, sin recargos de tarjeta. Saldo = total − pagado. El crédito de la casa cuenta como pagado
// (la deuda la siguen ellos con el Crédito Nº): "financiado" es esa parte.

export type EstadoVenta = "activa" | "pausa" | "cancelada";
export type TipoEntrega = "envio" | "retiro";
export type EstadoCivil = "soltero" | "casado" | "union_convivencial" | "divorciado" | "viudo";
export type Frecuencia = "semanal" | "quincenal" | "mensual";
export type TipoMedio = "efectivo" | "transferencia" | "tarjeta_debito" | "tarjeta_credito" | "credito_casa" | "otro";

/** Fila de la lista (ventas_listar). */
export interface VentaFila {
  id: number;
  numero: number; // se muestra LU-0001: numeroVenta()
  vendido_en: string;
  fecha_entrega: string;
  tipo_entrega: TipoEntrega;
  estado: EstadoVenta;
  total: Monto;
  pagado: Monto;
  financiado: Monto; // la parte en cuotas del crédito de la casa (ya cuenta en pagado)
  entregado_en: string | null;
  vendedor_id: number;
  vendedor: string;
  cliente: string;
  dni: string | null;
  telefono: string | null;
  localidad: string | null;
  muebles: string | null; // "Cómoda · 2× Mesa de luz"
}

export interface Direccion {
  id: number;
  calle: string;
  numero: string | null;
  piso: string | null;
  departamento: string | null;
  barrio: string | null;
  localidad_id: number;
  localidad: string;
  provincia: string;
}

export interface Cliente {
  id: number;
  persona_id: number;
  tipo: "casa" | "negocio";
  margen_credito: Monto | null;
  nombre: string;
  apellido: string;
  dni: string | null;
  estado_civil: EstadoCivil | null;
  fecha_nacimiento: string | null;
  telefonos: { numero_completo: string; es_whatsapp: Bit }[]; // el primero es el principal
  email: string | null;
  direccion: Direccion | null;
  comercio: { nombre_comercio: string | null; rubro: string | null; direccion: Direccion | null } | null;
}

/** Resultado de la búsqueda por nombre, DNI o teléfono. */
export interface ClienteFila {
  id: number;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  localidad: string | null;
}

export interface VentaItem {
  id: number;
  producto_id: number | null; // null = a medida
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  cantidad: number;
  precio_unitario: Monto;
  notas_taller: string | null;
  url_foto: string | null; // la del catálogo
  adjuntos: string[]; // fotos o croquis del cliente
}

export interface Cobro {
  id: number;
  concepto: "sena" | "anticipo" | "saldo" | "pago_total" | "pago_a_cuenta";
  monto: Monto; // lo que cancela de la venta
  recargo_pct: Monto;
  recargo_monto: Monto;
  total_cobrado: Monto; // monto + recargo
  cuotas: number | null;
  monto_cuota: Monto | null;
  frecuencia_cuotas: Frecuencia | null;
  fecha_primer_vencimiento: string | null;
  referencia: string | null; // Nº de operación, cupón o Crédito Nº
  cobrado_en: string;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  medio: string;
  medio_tipo: TipoMedio;
  cuenta: string | null;
  posnet: string | null;
  cobrado_por: string;
}

/** La venta completa (venta_ver). */
export interface Venta {
  id: number;
  numero: number;
  codigo_seguimiento: string;
  cliente_id: number;
  vendedor_id: number;
  vendedor: string;
  vendido_en: string;
  fecha_entrega: string;
  tipo_entrega: TipoEntrega;
  direccion_entrega: Direccion | null; // null si retira
  estado: EstadoVenta;
  motivo_estado: string | null;
  subtotal: Monto;
  descuento: Monto;
  total: Monto;
  pagado: Monto;
  financiado: Monto;
  notas: string | null;
  entregado_en: string | null;
  cancelado_en: string | null;
  cliente: Cliente;
  items: VentaItem[];
  cobros: Cobro[];
  historial: { texto: string; creado_en: string; usuario: string }[];
}

export interface PlanVenta { id: number; posnet: string; tipo_tarjeta: TipoTarjeta; marca_tarjeta: string | null; cuotas: number; recargo_pct: Monto }

/** Las listas del formulario (venta/nueva). */
export interface OpcionesVenta {
  localidades: Omit<Localidad, "codigo_postal">[];
  medios: { id: number; nombre: string; tipo: TipoMedio }[];
  cuentas: { id: number; nombre: string }[];
  planes: PlanVenta[];
  vendedores: { id: number; nombre: string }[];
  rubros: string[];
}

export interface DireccionGuardar { calle: string; numero: string; piso: string; departamento: string; barrio: string; localidad_id: number | null }
/** Un pago: anticipo al vender o cobro después. Con transferencia, la cuenta; con tarjeta, el plan del posnet (da el recargo). */
export interface PagoGuardar { medio_pago_id: number; monto: number | null; cuenta_bancaria_id: number | null; posnet_plan_id: number | null; referencia: string }

/** Lo que recibe venta/guardar. cliente.id null = cliente nuevo (si el DNI ya existe, es esa persona). */
export interface VentaGuardar {
  vendedor_id: number | null;
  cliente: {
    id: number | null;
    nombre: string;
    apellido: string;
    dni: string;
    estado_civil: EstadoCivil | "";
    fecha_nacimiento: string;
    telefonos: { numero_completo: string; es_whatsapp: boolean }[];
    email: string;
    direccion: DireccionGuardar;
    margen_credito: number | null;
    tipo: "casa" | "negocio";
    comercio: { nombre_comercio: string; rubro: string; direccion: DireccionGuardar } | null;
  };
  items: { producto_id: number | null; codigo: string; nombre: string; descripcion: string; cantidad: number | null; precio_unitario: number | null; notas_taller: string; adjuntos: string[] }[];
  fecha_entrega: string;
  tipo_entrega: TipoEntrega;
  descuento: number | null;
  notas: string;
  pagos: PagoGuardar[];
  credito: { cuotas: number | null; monto_cuota: number | null; frecuencia_cuotas: Frecuencia | ""; fecha_primer_vencimiento: string; referencia: string } | null;
}

/* ---------- configuración del negocio (solo con configuracion.editar) ---------- */

export interface CuentaBancaria {
  id: number;
  nombre: string; // nombre corto: Macro, Mercado Pago
  banco: string | null;
  titular: string | null;
  cbu_cvu: string | null;
  alias: string | null;
  activo: Bit;
}

export type TipoTarjeta = "debito" | "credito";

/** Recargo de un posnet según la tarjeta y las cuotas. */
export interface PlanPosnet {
  id: number;
  posnet_id: number;
  tipo_tarjeta: TipoTarjeta;
  marca_tarjeta: string | null; // null = todas
  cuotas: number;
  recargo_pct: Monto;
  activo: Bit;
}

export interface Posnet {
  id: number;
  nombre: string;
  proveedor: string | null;
  cuenta_liquidacion_id: number | null;
  activo: Bit;
  planes: PlanPosnet[];
}

export interface Localidad {
  id: number;
  nombre: string;
  provincia: string;
  codigo_area: string | null; // sin el 0: "381"
  codigo_postal: string | null;
}

export interface Configuracion {
  cuentas: CuentaBancaria[];
  posnets: Posnet[];
  localidades: Localidad[];
}

/** Cada lista se manda completa: sin id = nueva; la que no viene se borra (o se desactiva si ya la usa una venta). */
export interface CuentaGuardar { id?: number; nombre: string; banco: string; titular: string; cbu_cvu: string; alias: string; activo: boolean }
export interface PosnetGuardar {
  id?: number;
  nombre: string;
  proveedor: string;
  cuenta_liquidacion_id: number | null;
  activo: boolean;
  planes: { id?: number; tipo_tarjeta: TipoTarjeta; marca_tarjeta: string; cuotas: number | null; recargo_pct: number | null; activo: boolean }[];
}
export interface LocalidadGuardar { id?: number; nombre: string; provincia: string; codigo_area: string; codigo_postal: string }

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
  ventas: { ventas: VentaFila[] };
  venta: { venta: Venta };
  "venta/nueva": OpcionesVenta;
  "venta/guardar": { id: number; numero: number };
  "venta/cobro": { ok: true };
  "venta/anular-cobro": { ok: true };
  "venta/estado": { ok: true };
  clientes: { clientes: ClienteFila[] };
  cliente: { cliente: Cliente; ventas: { id: number; numero: number }[] }; // sus ventas anteriores
  configuracion: Configuracion;
  "configuracion/cuentas": Configuracion;
  "configuracion/posnets": Configuracion;
  "configuracion/localidades": Configuracion;
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
  "venta/guardar": VentaGuardar;
  "venta/cobro": PagoGuardar & { venta_id: number };
  "venta/anular-cobro": { cobro_id: number; motivo: string };
  "venta/estado": { id: number; estado?: EstadoVenta; motivo?: string; fecha_entrega?: string; entregada?: boolean };
  "configuracion/cuentas": { cuentas: CuentaGuardar[] };
  "configuracion/posnets": { posnets: PosnetGuardar[] };
  "configuracion/localidades": { localidades: LocalidadGuardar[] };
}
