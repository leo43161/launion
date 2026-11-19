// Los datos del cliente, y los comerciales si compra para un negocio. Los muestran la ficha de la venta y la del cliente.
// children: filas de más, después de la dirección (la venta suma "Entrega en").
import type { ReactNode } from "react";
import { ars, fecha, telefonoLindo } from "@/lib/formato";
import { ESTADO_CIVIL, direccionTexto } from "@/lib/ventas";
import type { Cliente } from "@/lib/tipos";

/** Una fila de una lista dt/dd; sin dato, no se muestra. */
export const fila = (dt: string, dd: ReactNode) => (dd ? <><dt>{dt}</dt><dd>{dd}</dd></> : null);

export function DatosCliente({ c, children }: { c: Cliente; children?: ReactNode }) {
  return (
    <>
      <section className="card"><div className="card-head"><h2>Cliente</h2></div>
        <div className="card-body"><dl className="specs">
          {fila("Nombre", `${c.nombre} ${c.apellido}`)}
          {fila("DNI", c.dni)}
          {fila("Estado civil", c.estado_civil && ESTADO_CIVIL[c.estado_civil])}
          {fila("Nacimiento", c.fecha_nacimiento && fecha(c.fecha_nacimiento))}
          {fila("Teléfonos", c.telefonos.map((t) => `${telefonoLindo(t.numero_completo)}${t.es_whatsapp ? " (WhatsApp)" : ""}`).join(", "))}
          {fila("Email", c.email)}
          {fila("Dirección", c.direccion && `${direccionTexto(c.direccion)}, ${c.direccion.provincia}`)}
          {children}
          {fila("Margen de crédito", c.margen_credito && ars(c.margen_credito))}
        </dl></div>
      </section>
      {c.tipo === "negocio" && c.comercio && (
        <section className="card"><div className="card-head"><h2>Datos comerciales</h2></div>
          <div className="card-body"><dl className="specs">
            {fila("Comercio", c.comercio.nombre_comercio)}
            {fila("Rubro", c.comercio.rubro)}
            {fila("Domicilio", c.comercio.direccion && `${direccionTexto(c.comercio.direccion)}, ${c.comercio.direccion.provincia}`)}
          </dl></div>
        </section>
      )}
    </>
  );
}
