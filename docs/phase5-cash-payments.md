# Fase 5: caja y cobros

## Invariantes

- Existe una sola caja `ABIERTA` por negocio. La aplicación serializa la apertura con un advisory lock por `businessId` y PostgreSQL lo garantiza con el índice parcial `CashRegister_one_open_per_business`.
- Todo cobro operativo requiere una caja abierta, incluso si el método es tarjeta o transferencia. La caja funciona como sesión financiera, no sólo como conteo de billetes.
- Finalizar y cobrar es una única transacción: bloquea la caja del negocio y luego el turno, valida estado/caja/método/importe, crea `Payment` y `CashMovement`, completa `Appointment`, crea `AppointmentStatusEvent` y audita. Cualquier error revierte todo.
- Los importes persistidos usan PostgreSQL `numeric(14,2)` y `Prisma.Decimal`. El backend suma, resta y compara con Decimal; no usa `Number`, floats, `parseFloat` ni `Math.round` en lógica financiera.
- Los movimientos guardan `amount > 0`; su tipo determina la dirección. No existen importes negativos con doble semántica.
- Una caja cerrada no vuelve a utilizarse. No hay endpoints para editar caja, pagos ni movimientos históricos, ni para borrar pagos/movimientos.

## Apertura y efectivo esperado

`openingAmount` es el efectivo físico al inicio y no genera un movimiento: no es una venta ni un ingreso comercial. La nota de apertura queda en `openingNotes` y la acción se audita como `CASH_OPENED`.

La autoridad de cálculo es el backend:

```text
expectedCash = openingAmount
             + ventas cuyo PaymentMethod.kind = CASH
             + INGRESO_MANUAL
             - EGRESO
             - RETIRO
```

Todas las ventas, incluidas débito, crédito, transferencia y otros métodos, integran `totalSales`. Sólo `PaymentMethodKind.CASH` integra `cashSales`; nunca se infiere efectivo por el nombre del método. Los ingresos manuales de V1 representan efectivo físico. Egresos y retiros se diferencian porque un retiro no es gasto comercial.

## Payment y CashMovement

La relación permanece `Appointment 1:N Payment`. Cada `Payment` tiene su método, importe, caja, usuario y un `CashMovement` `VENTA`. Esto permite pagos divididos futuros sin rediseñar la relación.

V1 permite como máximo un pago `REGISTRADO` por turno mediante:

1. advisory lock común de caja por `businessId` y luego advisory lock por `businessId + appointmentId`;
2. validación dentro de la transacción;
3. índice parcial único `Payment_one_active_per_appointment`.

El orden global de adquisición es siempre **caja del negocio → pago del turno**. Apertura, cierre y movimientos manuales sólo necesitan el primer lock; el cobro necesita ambos y respeta ese orden. De este modo no se introduce un ciclo de espera y se evita la carrera cierre-vs-cobro:

- si el cobro obtiene primero el lock de caja, el cierre espera y calcula su snapshot después de que la venta fue confirmada;
- si el cierre obtiene primero el lock, cambia la caja a `CERRADA` y el cobro posterior responde `CASH_NOT_OPEN`.

No se agregó un trigger: PostgreSQL no permite expresar mediante `CHECK` la consulta del estado de otra fila y un trigger agregaría una segunda estrategia de sincronización. La garantía se obtiene con el lock transaccional común y el acceso financiero encapsulado en los servicios.

Un importe distinto de `Appointment.price` exige `payments.adjust_amount` y motivo. `Appointment.price` conserva el snapshot de reserva; `Payment.amount` es el dinero efectivamente cobrado. La auditoría `PAYMENT_AMOUNT_ADJUSTED` conserva ambos importes y el motivo.

## Cierre

El frontend sólo envía `countedCash` y notas. El backend vuelve a calcular `expectedCash`, obtiene `difference = countedCash - expectedCash` con Decimal y guarda los tres snapshots. Una diferencia distinta de cero exige motivo. El cierre usa el mismo lock de caja y se audita como `CASH_CLOSED`.

Cerrar no depende de turnos pendientes o en curso. Un turno cobrado más tarde se vincula a la caja que esté abierta en ese momento.

## Historial, correcciones y compatibilidad

El historial de cajas y movimientos es paginado y siempre filtra por `businessId`. Una caja `CERRADA` es histórica e inmutable desde la API.

Los filtros `from`/`to` representan días calendario en `Business.timezone`. El backend construye medianoche local con la timezone IANA del negocio, convierte esos límites a UTC y recién entonces consulta PostgreSQL; no interpreta las fechas como días UTC ni asume una timezone argentina.

La reversión no se expone en Fase 5: falta definir de forma segura la reapertura operacional del turno. El esquema conserva `PaymentStatus.REVERTIDO`, usuario, fecha y motivo para una futura operación compensatoria. Nunca se elimina ni sobrescribe el pago original.

Los turnos `COMPLETADO` creados antes de Fase 5 permanecen visibles sin fabricar pagos retroactivos. Su detalle indica que fueron completados antes del módulo de cobros. El endpoint antiguo de completar responde `PAYMENT_REQUIRED`; el flujo normal desde Fase 5 es exclusivamente **Cobrar y completar**.
