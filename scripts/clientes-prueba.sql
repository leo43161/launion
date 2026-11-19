-- Clientes de prueba que ya compraron, SOLO para la copia local: lo carga scripts/local.mjs (npm run local) si no están.
-- No se importa en Ferozo: son datos inventados (DNI 991000xx, teléfonos 549…000000x, emails @example.com).
-- Las fechas son relativas a hoy, así que siempre son "compras anteriores". Los muebles se buscan por nombre en el catálogo:
-- si alguno ya no está, queda como mueble a medida. Usa los vendedores de prueba vendedor1 y vendedor2.
--   María José Gómez (Yerba Buena): 2 compras, una pagada y entregada, otra reciente con saldo.
--   Carlos Medina (Tafí Viejo): anticipo y crédito de la casa en 8 cuotas, con un mueble a medida.
--   Ramón Herrera, Kiosco El Paso (negocio): 2 compras, la última en pausa con saldo.
--   Lucía Fernández (Banda del Río Salí): pagó con tarjeta y retiró en el showroom.
--   Silvia Costilla (Concepción): crédito de la casa en cuotas quincenales y una venta cancelada con la seña anulada.
SET NAMES utf8mb4;
START TRANSACTION;

SET @u1 = (SELECT id FROM usuarios WHERE nombre_usuario = 'vendedor1');
SET @v1 = (SELECT empleado_id FROM usuarios WHERE id = @u1);
SET @u2 = (SELECT id FROM usuarios WHERE nombre_usuario = 'vendedor2');
SET @v2 = (SELECT empleado_id FROM usuarios WHERE id = @u2);
SET @admin = (SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE r.nombre = 'Administrador' AND u.activo = 1 ORDER BY u.id LIMIT 1);
SET @efectivo = (SELECT id FROM medios_pago WHERE tipo = 'efectivo' ORDER BY orden LIMIT 1);
SET @transferencia = (SELECT id FROM medios_pago WHERE tipo = 'transferencia' ORDER BY orden LIMIT 1);
SET @debito = (SELECT id FROM medios_pago WHERE tipo = 'tarjeta_debito' ORDER BY orden LIMIT 1);
SET @credito = (SELECT id FROM medios_pago WHERE tipo = 'tarjeta_credito' ORDER BY orden LIMIT 1);
SET @casa = (SELECT id FROM medios_pago WHERE tipo = 'credito_casa' ORDER BY orden LIMIT 1);
SET @a381 = (SELECT id FROM codigos_area WHERE codigo = '381');
SET @a3865 = (SELECT id FROM codigos_area WHERE codigo = '3865');

-- ---------- Clientes ----------

INSERT INTO personas (nombre, apellido, dni, fecha_nacimiento, estado_civil, creado_en) VALUES ('María José', 'Gómez', '99100001', '1978-04-12', 'casado', CURDATE() - INTERVAL 300 DAY);
SET @p = LAST_INSERT_ID();
INSERT INTO telefonos (persona_id, codigo_area_id, numero_local, numero_completo, es_whatsapp, es_principal) VALUES (@p, @a381, '3810000001', '5493810000001', 1, 1);
INSERT INTO emails (persona_id, email, es_principal) VALUES (@p, 'mariajose.gomez@example.com', 1);
INSERT INTO direcciones (persona_id, tipo, calle, numero, barrio, localidad_id, es_principal) VALUES (@p, 'particular', 'Av. Aconquija', '1450', 'Los Pinos', (SELECT id FROM localidades WHERE nombre = 'Yerba Buena'), 1);
SET @d1 = LAST_INSERT_ID();
INSERT INTO clientes (persona_id, tipo, creado_por, creado_en) VALUES (@p, 'casa', @u1, CURDATE() - INTERVAL 300 DAY);
SET @c1 = LAST_INSERT_ID();

INSERT INTO personas (nombre, apellido, dni, fecha_nacimiento, estado_civil, creado_en) VALUES ('Carlos Alberto', 'Medina', '99100002', '1985-09-30', 'soltero', CURDATE() - INTERVAL 180 DAY);
SET @p = LAST_INSERT_ID();
INSERT INTO telefonos (persona_id, codigo_area_id, numero_local, numero_completo, es_whatsapp, es_principal) VALUES
  (@p, @a381, '3810000002', '5493810000002', 1, 1),
  (@p, @a381, '3810000012', '5493810000012', 0, 0);
INSERT INTO direcciones (persona_id, tipo, calle, numero, localidad_id, es_principal) VALUES (@p, 'particular', 'Av. Alem', '320', (SELECT id FROM localidades WHERE nombre = 'Tafí Viejo'), 1);
SET @d2 = LAST_INSERT_ID();
INSERT INTO clientes (persona_id, tipo, margen_credito, creado_por, creado_en) VALUES (@p, 'casa', 1000000, @u1, CURDATE() - INTERVAL 180 DAY);
SET @c2 = LAST_INSERT_ID();

INSERT INTO personas (nombre, apellido, dni, fecha_nacimiento, estado_civil, creado_en) VALUES ('Ramón', 'Herrera', '99100003', '1970-01-22', 'casado', CURDATE() - INTERVAL 120 DAY);
SET @p = LAST_INSERT_ID();
INSERT INTO telefonos (persona_id, codigo_area_id, numero_local, numero_completo, es_whatsapp, es_principal) VALUES (@p, @a381, '3810000003', '5493810000003', 1, 1);
INSERT INTO direcciones (persona_id, tipo, calle, numero, localidad_id, es_principal) VALUES (@p, 'particular', 'Mendoza', '1820', (SELECT id FROM localidades WHERE nombre = 'San Miguel de Tucumán'), 1);
SET @d3 = LAST_INSERT_ID();
INSERT INTO direcciones (persona_id, tipo, calle, numero, localidad_id) VALUES (@p, 'comercial', 'Av. Mate de Luna', '2950', (SELECT id FROM localidades WHERE nombre = 'San Miguel de Tucumán'));
SET @dc3 = LAST_INSERT_ID();
INSERT INTO clientes (persona_id, tipo, margen_credito, creado_por, creado_en) VALUES (@p, 'negocio', 1500000, @u2, CURDATE() - INTERVAL 120 DAY);
SET @c3 = LAST_INSERT_ID();
INSERT INTO clientes_comercios (cliente_id, nombre_comercio, rubro, direccion_id) VALUES (@c3, 'Kiosco El Paso', 'Kiosco', @dc3);

INSERT INTO personas (nombre, apellido, dni, fecha_nacimiento, estado_civil, creado_en) VALUES ('Lucía', 'Fernández', '99100004', '1994-06-08', 'union_convivencial', CURDATE() - INTERVAL 60 DAY);
SET @p = LAST_INSERT_ID();
INSERT INTO telefonos (persona_id, codigo_area_id, numero_local, numero_completo, es_whatsapp, es_principal) VALUES (@p, @a381, '3810000004', '5493810000004', 1, 1);
INSERT INTO emails (persona_id, email, es_principal) VALUES (@p, 'lucia.fernandez@example.com', 1);
INSERT INTO direcciones (persona_id, tipo, calle, numero, localidad_id, es_principal) VALUES (@p, 'particular', 'Belgrano', '455', (SELECT id FROM localidades WHERE nombre = 'Banda del Río Salí'), 1);
SET @d4 = LAST_INSERT_ID();
INSERT INTO clientes (persona_id, tipo, creado_por, creado_en) VALUES (@p, 'casa', @u1, CURDATE() - INTERVAL 60 DAY);
SET @c4 = LAST_INSERT_ID();

INSERT INTO personas (nombre, apellido, dni, fecha_nacimiento, estado_civil, creado_en) VALUES ('Silvia', 'Costilla', '99100005', '1962-11-03', 'viudo', CURDATE() - INTERVAL 365 DAY);
SET @p = LAST_INSERT_ID();
INSERT INTO telefonos (persona_id, codigo_area_id, numero_local, numero_completo, es_whatsapp, es_principal) VALUES (@p, @a3865, '3865000005', '5493865000005', 1, 1);
INSERT INTO direcciones (persona_id, tipo, calle, numero, localidad_id, es_principal) VALUES (@p, 'particular', 'San Martín', '1234', (SELECT id FROM localidades WHERE nombre = 'Concepción'), 1);
SET @d5 = LAST_INSERT_ID();
INSERT INTO clientes (persona_id, tipo, creado_por, creado_en) VALUES (@p, 'casa', @u2, CURDATE() - INTERVAL 365 DAY);
SET @c5 = LAST_INSERT_ID();

-- ---------- Ventas, de la más vieja a la más nueva (el número es el último + 1, como en la API) ----------

-- Silvia, hace un año: anticipo y crédito de la casa en 7 cuotas quincenales. Entregada
INSERT INTO ventas (numero, cliente_id, vendedor_id, creado_por, vendido_en, fecha_entrega, tipo_entrega, direccion_entrega_id, subtotal, descuento, total, entregado_en)
  SELECT IFNULL(MAX(numero), 0) + 1, @c5, @v2, @u2, CURDATE() - INTERVAL 365 DAY + INTERVAL 11 HOUR, CURDATE() - INTERVAL 335 DAY, 'envio', @d5, 380000, 0, 380000, CURDATE() - INTERVAL 336 DAY + INTERVAL 15 HOUR FROM ventas;
SET @venta = LAST_INSERT_ID();
SET @prod = (SELECT id FROM productos WHERE nombre = 'Vajillero Minimalista' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Vajillero Minimalista', '140 x 90 x 40 cm. Melamina blanca con frentes en roble.', 1, 380000, (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
INSERT INTO cobros (venta_id, medio_pago_id, concepto, monto, total_cobrado, cobrado_por, creado_por, cobrado_en) VALUES
  (@venta, @efectivo, 'anticipo', 100000, 100000, @v2, @u2, CURDATE() - INTERVAL 365 DAY + INTERVAL 11 HOUR);
INSERT INTO cobros (venta_id, medio_pago_id, concepto, monto, total_cobrado, cuotas, monto_cuota, frecuencia_cuotas, fecha_primer_vencimiento, referencia, cobrado_por, creado_por, cobrado_en) VALUES
  (@venta, @casa, 'saldo', 280000, 280000, 7, 40000, 'quincenal', CURDATE() - INTERVAL 350 DAY, 'C-0398', @v2, @u2, CURDATE() - INTERVAL 365 DAY + INTERVAL 11 HOUR);
INSERT INTO ventas_historial (venta_id, usuario_id, texto, creado_en) VALUES
  (@venta, @u2, 'Venta registrada', CURDATE() - INTERVAL 365 DAY + INTERVAL 11 HOUR),
  (@venta, @u2, 'Marcada como entregada', CURDATE() - INTERVAL 336 DAY + INTERVAL 15 HOUR);

-- María José, hace 10 meses: placard y 2 mesas de luz con descuento, todo en efectivo. Entregada
INSERT INTO ventas (numero, cliente_id, vendedor_id, creado_por, vendido_en, fecha_entrega, tipo_entrega, direccion_entrega_id, subtotal, descuento, total, entregado_en)
  SELECT IFNULL(MAX(numero), 0) + 1, @c1, @v1, @u1, CURDATE() - INTERVAL 300 DAY + INTERVAL 10 HOUR, CURDATE() - INTERVAL 280 DAY, 'envio', @d1, 657000, 7000, 650000, CURDATE() - INTERVAL 282 DAY + INTERVAL 16 HOUR FROM ventas;
SET @venta = LAST_INSERT_ID();
SET @prod = (SELECT id FROM productos WHERE nombre = 'Placard Alaska 2 Puertas' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Placard Alaska 2 Puertas', '125 x 183 x 55 cm. Melamina blanca, 2 puertas corredizas.', 1, 499000, (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
SET @prod = (SELECT id FROM productos WHERE nombre = 'Mesa de Luz Nature' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Mesa de Luz Nature', '50 x 65 cm. Haciendo juego con el placard.', 2, 79000, (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
INSERT INTO cobros (venta_id, medio_pago_id, concepto, monto, total_cobrado, cobrado_por, creado_por, cobrado_en) VALUES
  (@venta, @efectivo, 'pago_total', 650000, 650000, @v1, @u1, CURDATE() - INTERVAL 300 DAY + INTERVAL 10 HOUR);
INSERT INTO ventas_historial (venta_id, usuario_id, texto, creado_en) VALUES
  (@venta, @u1, 'Venta registrada', CURDATE() - INTERVAL 300 DAY + INTERVAL 10 HOUR),
  (@venta, @u1, 'Marcada como entregada', CURDATE() - INTERVAL 282 DAY + INTERVAL 16 HOUR);

-- Carlos, hace 6 meses: placard y un escritorio a medida, anticipo y crédito de la casa en 8 cuotas mensuales. Entregada
INSERT INTO ventas (numero, cliente_id, vendedor_id, creado_por, vendido_en, fecha_entrega, tipo_entrega, direccion_entrega_id, subtotal, descuento, total, entregado_en)
  SELECT IFNULL(MAX(numero), 0) + 1, @c2, @v1, @u1, CURDATE() - INTERVAL 180 DAY + INTERVAL 12 HOUR, CURDATE() - INTERVAL 150 DAY, 'envio', @d2, 1110000, 0, 1110000, CURDATE() - INTERVAL 152 DAY + INTERVAL 11 HOUR FROM ventas;
SET @venta = LAST_INSERT_ID();
SET @prod = (SELECT id FROM productos WHERE nombre = 'Placard Turín sin Puertas' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Placard Turín sin Puertas', '200 x 183 x 55 cm. Melamina gris humo.', 1, 850000, (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
INSERT INTO ventas_items (venta_id, nombre, descripcion, cantidad, precio_unitario, notas_taller) VALUES
  (@venta, 'Escritorio a medida', '140 x 75 x 50 cm, con 2 estantes arriba. Melamina gris humo, como el placard.', 1, 260000, 'Va contra la pared de la ventana: medir antes de cortar.');
INSERT INTO cobros (venta_id, medio_pago_id, concepto, monto, total_cobrado, cobrado_por, creado_por, cobrado_en) VALUES
  (@venta, @efectivo, 'anticipo', 310000, 310000, @v1, @u1, CURDATE() - INTERVAL 180 DAY + INTERVAL 12 HOUR);
INSERT INTO cobros (venta_id, medio_pago_id, concepto, monto, total_cobrado, cuotas, monto_cuota, frecuencia_cuotas, fecha_primer_vencimiento, referencia, cobrado_por, creado_por, cobrado_en) VALUES
  (@venta, @casa, 'saldo', 800000, 800000, 8, 100000, 'mensual', CURDATE() - INTERVAL 150 DAY, 'C-0451', @v1, @u1, CURDATE() - INTERVAL 180 DAY + INTERVAL 12 HOUR);
INSERT INTO ventas_historial (venta_id, usuario_id, texto, creado_en) VALUES
  (@venta, @u1, 'Venta registrada', CURDATE() - INTERVAL 180 DAY + INTERVAL 12 HOUR),
  (@venta, @u1, 'Marcada como entregada', CURDATE() - INTERVAL 152 DAY + INTERVAL 11 HOUR);

-- Silvia, hace 5 meses: cancelada, y la seña anulada porque se la devolvieron
INSERT INTO ventas (numero, cliente_id, vendedor_id, creado_por, vendido_en, fecha_entrega, tipo_entrega, direccion_entrega_id, estado, motivo_estado, subtotal, descuento, total, cancelado_en)
  SELECT IFNULL(MAX(numero), 0) + 1, @c5, @v1, @u1, CURDATE() - INTERVAL 150 DAY + INTERVAL 17 HOUR, CURDATE() - INTERVAL 130 DAY, 'envio', @d5, 'cancelada', 'Se mudó y ya no lo necesita', 150000, 0, 150000, CURDATE() - INTERVAL 140 DAY + INTERVAL 10 HOUR FROM ventas;
SET @venta = LAST_INSERT_ID();
SET @prod = (SELECT id FROM productos WHERE nombre = 'Respaldo Pétalos' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Respaldo Pétalos', 'Para cama de 2 plazas. Pana gris topo.', 1, 150000, (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
INSERT INTO cobros (venta_id, medio_pago_id, concepto, monto, total_cobrado, cobrado_por, creado_por, cobrado_en, anulado_en, anulado_por, motivo_anulacion) VALUES
  (@venta, @efectivo, 'anticipo', 50000, 50000, @v1, @u1, CURDATE() - INTERVAL 150 DAY + INTERVAL 17 HOUR, CURDATE() - INTERVAL 140 DAY + INTERVAL 10 HOUR, @admin, 'Se le devolvió la seña');
INSERT INTO ventas_historial (venta_id, usuario_id, texto, creado_en) VALUES
  (@venta, @u1, 'Venta registrada', CURDATE() - INTERVAL 150 DAY + INTERVAL 17 HOUR),
  (@venta, @admin, 'Venta cancelada: Se mudó y ya no lo necesita', CURDATE() - INTERVAL 140 DAY + INTERVAL 10 HOUR),
  (@venta, @admin, 'Cobro de $ 50.000 anulado: Se le devolvió la seña', CURDATE() - INTERVAL 140 DAY + INTERVAL 10 HOUR);

-- Kiosco El Paso, hace 4 meses: caramelera y cigarrera, mitad débito y mitad transferencia. Entregada
INSERT INTO ventas (numero, cliente_id, vendedor_id, creado_por, vendido_en, fecha_entrega, tipo_entrega, direccion_entrega_id, subtotal, descuento, total, notas, entregado_en)
  SELECT IFNULL(MAX(numero), 0) + 1, @c3, @v2, @u2, CURDATE() - INTERVAL 120 DAY + INTERVAL 9 HOUR, CURDATE() - INTERVAL 95 DAY, 'envio', @d3, 920000, 0, 920000, 'Entregar en el kiosco (Av. Mate de Luna 2950), antes de las 9.', CURDATE() - INTERVAL 96 DAY + INTERVAL 8 HOUR FROM ventas;
SET @venta = LAST_INSERT_ID();
SET @prod = (SELECT id FROM productos WHERE nombre = 'Caramelera Cascada Baja' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Caramelera Cascada Baja', '94 x 90 x 60 cm. Blanca con frente de vidrio.', 1, 380000, (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
SET @prod = (SELECT id FROM productos WHERE nombre = 'Cigarrera Vertical 180 cm LED y Ploteo' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, notas_taller, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Cigarrera Vertical 180 cm LED y Ploteo', '60 x 183 x 35 cm. LED blanco frío, ploteo con el nombre del kiosco.', 1, 540000, 'El logo para el ploteo lo manda por WhatsApp.', (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
INSERT INTO cobros (venta_id, medio_pago_id, concepto, monto, total_cobrado, cobrado_por, creado_por, cobrado_en) VALUES
  (@venta, @debito, 'anticipo', 420000, 420000, @v2, @u2, CURDATE() - INTERVAL 120 DAY + INTERVAL 9 HOUR),
  (@venta, @transferencia, 'anticipo', 500000, 500000, @v2, @u2, CURDATE() - INTERVAL 120 DAY + INTERVAL 9 HOUR);
INSERT INTO ventas_historial (venta_id, usuario_id, texto, creado_en) VALUES
  (@venta, @u2, 'Venta registrada', CURDATE() - INTERVAL 120 DAY + INTERVAL 9 HOUR),
  (@venta, @u2, 'Marcada como entregada', CURDATE() - INTERVAL 96 DAY + INTERVAL 8 HOUR);

-- Lucía, hace 2 meses: cómoda y chifonier con descuento, tarjeta de crédito, retiró en el showroom
INSERT INTO ventas (numero, cliente_id, vendedor_id, creado_por, vendido_en, fecha_entrega, tipo_entrega, subtotal, descuento, total, entregado_en)
  SELECT IFNULL(MAX(numero), 0) + 1, @c4, @v1, @u1, CURDATE() - INTERVAL 60 DAY + INTERVAL 18 HOUR, CURDATE() - INTERVAL 45 DAY, 'retiro', 610000, 10000, 600000, CURDATE() - INTERVAL 46 DAY + INTERVAL 17 HOUR FROM ventas;
SET @venta = LAST_INSERT_ID();
SET @prod = (SELECT id FROM productos WHERE nombre = 'Cómoda 8 Cajones en blanco' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Cómoda 8 Cajones en blanco', '140 x 90 x 45 cm. Blanca, tiradores negros.', 1, 360000, (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
SET @prod = (SELECT id FROM productos WHERE nombre = 'Chifonier 4 Cajones con Puerta' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Chifonier 4 Cajones con Puerta', '85 x 95 x 45 cm. Blanco, como la cómoda.', 1, 250000, (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
INSERT INTO cobros (venta_id, medio_pago_id, concepto, monto, total_cobrado, cobrado_por, creado_por, cobrado_en) VALUES
  (@venta, @credito, 'pago_total', 600000, 600000, @v1, @u1, CURDATE() - INTERVAL 60 DAY + INTERVAL 18 HOUR);
INSERT INTO ventas_historial (venta_id, usuario_id, texto, creado_en) VALUES
  (@venta, @u1, 'Venta registrada', CURDATE() - INTERVAL 60 DAY + INTERVAL 18 HOUR),
  (@venta, @u1, 'Marcada como entregada', CURDATE() - INTERVAL 46 DAY + INTERVAL 17 HOUR);

-- Kiosco El Paso, hace 3 semanas: 2 góndolas, anticipo y un pago a cuenta. En pausa, con saldo de $ 320.000
INSERT INTO ventas (numero, cliente_id, vendedor_id, creado_por, vendido_en, fecha_entrega, tipo_entrega, direccion_entrega_id, estado, motivo_estado, subtotal, descuento, total)
  SELECT IFNULL(MAX(numero), 0) + 1, @c3, @v2, @u2, CURDATE() - INTERVAL 21 DAY + INTERVAL 10 HOUR, CURDATE() + INTERVAL 15 DAY, 'envio', @d3, 'pausa', 'Está refaccionando el local: avisa cuándo entregar', 620000, 0, 620000 FROM ventas;
SET @venta = LAST_INSERT_ID();
SET @prod = (SELECT id FROM productos WHERE nombre = 'Góndola Doble' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Góndola Doble', '120 x 183 x 35 cm. Blancas, con 5 estantes cada una.', 2, 310000, (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
INSERT INTO cobros (venta_id, medio_pago_id, concepto, monto, total_cobrado, cobrado_por, creado_por, cobrado_en) VALUES
  (@venta, @efectivo, 'anticipo', 200000, 200000, @v2, @u2, CURDATE() - INTERVAL 21 DAY + INTERVAL 10 HOUR),
  (@venta, @transferencia, 'pago_a_cuenta', 100000, 100000, @v2, @u2, CURDATE() - INTERVAL 14 DAY + INTERVAL 12 HOUR);
INSERT INTO ventas_historial (venta_id, usuario_id, texto, creado_en) VALUES
  (@venta, @u2, 'Venta registrada', CURDATE() - INTERVAL 21 DAY + INTERVAL 10 HOUR),
  (@venta, @u2, 'Cobro de $ 100.000 (Transferencia)', CURDATE() - INTERVAL 14 DAY + INTERVAL 12 HOUR),
  (@venta, @u2, 'Venta en pausa: Está refaccionando el local: avisa cuándo entregar', CURDATE() - INTERVAL 10 DAY + INTERVAL 9 HOUR);

-- María José, hace 12 días: rack de TV con anticipo por transferencia. Falta entregar y cobrar $ 270.000
INSERT INTO ventas (numero, cliente_id, vendedor_id, creado_por, vendido_en, fecha_entrega, tipo_entrega, direccion_entrega_id, subtotal, descuento, total, notas)
  SELECT IFNULL(MAX(numero), 0) + 1, @c1, @v2, @u2, CURDATE() - INTERVAL 12 DAY + INTERVAL 19 HOUR, CURDATE() + INTERVAL 18 DAY, 'envio', @d1, 420000, 0, 420000, 'Entregar después de las 17.' FROM ventas;
SET @venta = LAST_INSERT_ID();
SET @prod = (SELECT id FROM productos WHERE nombre = 'Rack de TV Firenze' ORDER BY id LIMIT 1);
INSERT INTO ventas_items (venta_id, producto_id, codigo, nombre, descripcion, cantidad, precio_unitario, url_foto) VALUES
  (@venta, @prod, (SELECT codigo FROM productos WHERE id = @prod), 'Rack de TV Firenze', '180 x 65 x 40 cm. Roble con blanco, para TV de 65".', 1, 420000, (SELECT url FROM productos_fotos WHERE producto_id = @prod ORDER BY orden LIMIT 1));
INSERT INTO cobros (venta_id, medio_pago_id, concepto, monto, total_cobrado, cobrado_por, creado_por, cobrado_en) VALUES
  (@venta, @transferencia, 'anticipo', 150000, 150000, @v2, @u2, CURDATE() - INTERVAL 12 DAY + INTERVAL 19 HOUR);
INSERT INTO ventas_historial (venta_id, usuario_id, texto, creado_en) VALUES
  (@venta, @u2, 'Venta registrada', CURDATE() - INTERVAL 12 DAY + INTERVAL 19 HOUR);

COMMIT;
