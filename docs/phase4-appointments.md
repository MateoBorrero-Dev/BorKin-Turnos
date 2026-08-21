# Fase 4 — Agenda y turnos

## Modelo e integridad

`Appointment` conserva las relaciones autorizadas con cliente, servicio y profesional y captura `serviceName`, `durationMinutes` y `price` al crear o editar. El snapshot evita que un cambio posterior en el catálogo altere la lectura económica e histórica del turno.

PostgreSQL es la última garantía contra solapamientos: `Appointment_no_employee_overlap` usa `btree_gist` y `tstzrange(startAt, endAt, '[)')` por negocio y profesional. Su predicado excluye únicamente `CANCELADO`, por lo que pendiente, confirmado, en curso, completado y ausente siguen ocupando el horario. Dos turnos adyacentes son válidos.

Antes de escribir, el backend abre una transacción y toma `pg_advisory_xact_lock(hashtextextended(businessId + ':' + employeeId, 0))`. Dentro de esa transacción vuelve a validar relaciones, jornada completa, bloqueos y turnos ocupantes. El lock entrega errores previsibles y la restricción `EXCLUDE` protege incluso ante escrituras externas o carreras no cooperativas. Los conflictos se responden con HTTP 409 y un código operativo.

## Tiempo y disponibilidad

Las fechas y horas ingresadas se interpretan exclusivamente en la zona IANA de `Business.timezone` con Luxon. Se rechazan tiempos locales inexistentes. PostgreSQL almacena instantes UTC en `timestamptz`; la API y el frontend vuelven a presentarlos en la zona del negocio.

La disponibilidad avanza cada 15 minutos. La duración real proviene del servicio y puede no ser múltiplo de 15. Un candidato se devuelve sólo si cabe entero dentro de un único `EmployeeSchedule`, no intersecta un `ScheduleBlock` global o profesional y no intersecta un turno ocupante. Todas las intersecciones son semiabiertas: `start < otherEnd && end > otherStart`.

No se permite crear ni reprogramar un turno con `startAt` anterior al instante actual. El backend interpreta el día y la hora con `Business.timezone` y responde HTTP 400 con `APPOINTMENT_IN_PAST`; no depende de la zona del navegador. Para consultas de disponibilidad, una fecha local anterior a hoy devuelve una lista vacía y la fecha de hoy omite todo slot cuyo inicio ya pasó. Esta regla no altera ni oculta turnos históricos y tampoco interviene en sus acciones de estado válidas.

## Estados e historial sensible

Transiciones permitidas:

- `PENDIENTE → CONFIRMADO | EN_CURSO | CANCELADO | AUSENTE`
- `CONFIRMADO → EN_CURSO | CANCELADO | AUSENTE`
- `EN_CURSO → COMPLETADO`
- `COMPLETADO`, `CANCELADO` y `AUSENTE` son finales.

Cada transición genera `AppointmentStatusEvent` y `AuditLog`. La cancelación requiere motivo. Un turno en curso sólo permite editar notas. Los estados finales son históricos e inmutables por endpoints ordinarios. En particular, un turno completado —y, en una fase posterior, sus pagos y movimientos de caja— nunca se corrige sobrescribiendo entidades; cualquier corrección financiera futura deberá ser una operación explícita, autorizada, auditada y compensatoria que preserve el original.

Completar en Fase 4 sólo cambia el estado y `completedAt`: no crea `Payment` ni `CashMovement`.

## Seguridad y permisos

Todas las consultas filtran `businessId`. En creación y edición el backend exige que cliente, servicio y profesional pertenezcan al negocio, estén activos y no eliminados, y que el profesional tenga asignado el servicio. La API separa `appointments.view`, `appointments.create`, `appointments.edit` y `appointments.cancel`; el rol Empleado recibe estos permisos en el seed.

## Interfaz

`/agenda` ofrece vistas día, semana y mes, navegación, filtro por profesional, turnos y bloqueos. En móvil comienza en vista día y las otras vistas se degradan a listas verticales utilizables. El formulario encadena cliente, servicio, profesional, fecha y slots calculados por backend. El detalle expone únicamente acciones válidas por estado y permiso. WhatsApp aparece sólo con un número normalizable de 8 a 15 dígitos y genera un enlace `wa.me` con negocio, cliente, servicio, fecha y hora.

La fecha inicial y el botón **Hoy** se calculan con la zona IANA del negocio, no con el día UTC del dispositivo. La ficha de cliente consume un historial paginado específico, ordenado desde el turno más reciente, y muestra snapshots de servicio/precio, profesional y estado. Sus estadísticas son operativas (cantidad, completados, última visita y próximo turno); no se calcula “total gastado” en Fase 4 porque el precio del turno no demuestra un pago. Esa métrica deberá basarse en pagos reales desde Fase 5.
