# Fase 6 — Dashboard, estadísticas, reportes y auditoría

## Fuentes de verdad

- **Actividad operativa:** `Appointment.startAt` y `Appointment.status`. Los turnos se agrupan en la zona IANA configurada para el negocio.
- **Ventas e ingresos por servicios:** únicamente `Payment` con `status = REGISTRADO`, usando `Payment.createdAt` como fecha efectiva del cobro y `Payment.amount` como importe. Un turno `COMPLETADO` anterior a la Fase 5 sin `Payment` sigue siendo histórico operativo, pero nunca se convierte en una venta ficticia.
- **Caja:** `CashMovement.occurredAt`, `type` y `amount`. Los movimientos manuales no se mezclan con ventas en las estadísticas de servicios.
- **Clientes nuevos:** `Client.createdAt`; clientes atendidos son clientes distintos de turnos completados en el período.
- **Históricos de servicio:** duración y precio del turno provienen del snapshot de `Appointment`. Las estadísticas agrupan servicios por el `serviceId` estable; para la etiqueta prefieren el nombre actual del catálogo y usan el menor snapshot histórico como fallback determinista si el registro no está disponible. Un renombrado no divide el historial y un servicio inactivo continúa sumando.

Todos los importes se agregan como `Decimal` en PostgreSQL/Prisma y la API los serializa como strings con dos decimales. El frontend sólo transforma esas cadenas al formatear para presentación.

## Rangos y comparación

Los filtros `from`/`to` representan días locales inclusivos. El backend los convierte a un intervalo UTC semiabierto `[inicio, fin)` mediante la zona horaria IANA del negocio; así se respetan también cambios de horario estacional. El máximo es 366 días. La comparación usa el intervalo inmediatamente anterior con igual cantidad de días locales. Cuando la base anterior es cero, la variación porcentual es `null` y la interfaz informa que no existe base comparable.

Las series de tiempo se agregan en una consulta SQL por fuente y el servicio sólo completa en memoria los días sin actividad. No se realizan consultas por cada día ni por cada fila.

## Seguridad y aislamiento

- Toda consulta toma `businessId` exclusivamente de la sesión autenticada; nunca de parámetros enviados por el cliente.
- `dashboard.view` permite el panel operativo. Sus cifras financieras sólo se incluyen si la sesión también posee `statistics.view`.
- `statistics.view`, `reports.view` y `audit.view` protegen sus respectivos endpoints en backend y rutas en frontend.
- Las exportaciones vuelven a comprobar `reports.view`; no dependen de que el botón esté oculto.
- La auditoría sanea recursivamente claves asociadas con contraseñas, tokens, secretos, cookies, hashes o credenciales antes de responder.

## Reportes y CSV

Ventas, turnos, movimientos, clientes y servicios se consultan con paginación backend (`pageSize` máximo 100). Ventas separa el precio original del turno, el monto efectivamente cobrado y el usuario registrador. Turnos conserva precio histórico y representa la ausencia de un `Payment` como dato desconocido, nunca como cobro cero. Movimientos incluye responsable y apertura de caja; Clientes incluye cantidad de turnos y última visita sin exportar notas. Cada reporte puede exportarse con exactamente el mismo rango y filtros. La exportación:

- usa UTF-8 con BOM, `;` como separador y `CRLF`;
- conserva importes como campos numéricos decimales;
- formatea fechas en la zona horaria del negocio;
- escapa comillas y encierra texto entre comillas;
- antepone una comilla simple a texto que comienza con `=`, `+`, `-` o `@`, evitando inyección de fórmulas;
- limita cada archivo a 20.000 filas y pide acotar filtros si se supera ese volumen;
- responde con `Cache-Control: private, no-store` y nombre descriptivo.

## Índices de Fase 6

La migración agrega índices para las rutas críticas de fecha/estado: clientes por alta, pagos por estado y fecha, pagos por método/estado/fecha, movimientos por tipo/fecha y auditoría por usuario/fecha. Se conservan los índices previos de turnos, caja y auditoría.

## Actualización de datos

Dashboard usa una frescura de 15 segundos y los demás análisis entre 10 y 15 segundos. Las mutaciones de agenda, cobro y caja invalidan explícitamente las consultas de análisis, reportes y auditoría para no mostrar información obsoleta tras una operación local.
