# Integridad de pagos y turnos completados

## Preparación para pagos divididos

La V1 admite funcionalmente un único cobro por turno. El modelo define la relación `Appointment 1:N Payment` y no aplica unicidad a `Payment.appointmentId`.

Durante la V1 el servicio de cobro debe verificar, dentro de la misma transacción, que el turno no posea pagos activos. Cada pago tiene su propio método, importe y movimiento de caja. Una versión futura podrá admitir varios pagos cuya suma coincida con el total del turno sin cambiar las relaciones principales.

## Política de turnos completados y cobrados

Un turno completado que posee al menos un pago activo es información histórica bloqueada:

- No admite edición ordinaria de cliente, servicio, profesional, horarios, duración, precio, estado ni notas transaccionales.
- No puede volver a estados operativos mediante el endpoint general de turnos.
- El pago y el movimiento de caja original no se eliminan ni sobrescriben.
- Toda corrección futura deberá usar una operación explícita de reversión o ajuste, permiso administrativo, motivo obligatorio, transacción atómica y auditoría.
- Una reversión deberá crear movimientos compensatorios, marcar los pagos afectados como revertidos y conservar los importes originales.
- Historiales, caja, dashboard, estadísticas y reportes deben derivarse del mismo estado persistido y considerar reversiones.

La política se aplicará en servicios backend; ocultar controles en frontend nunca será la barrera de seguridad.
