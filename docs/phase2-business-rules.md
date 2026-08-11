# Reglas de negocio de Fase 2

## Aislamiento multinegocio

Todos los servicios obtienen `businessId` de la sesión autenticada. Los identificadores recibidos se consultan junto con ese `businessId`; un recurso ajeno responde como no encontrado y nunca se reasigna al negocio solicitante.

## Dinero e historial

Los precios se guardan como `Decimal(14,2)`. Se permite precio cero para servicios gratuitos o bonificados; no se admiten negativos. Un cambio de precio, duración, nombre o profesional no altera los snapshots existentes en `Appointment`. Categorías, servicios y profesionales se desactivan o eliminan lógicamente, conservando relaciones históricas.

## Horarios y bloqueos

Los intervalos laborales se expresan en minutos del día, con extremos `[inicio, fin)`: dos intervalos adyacentes son válidos. El backend valida el rango y los solapamientos, y PostgreSQL mantiene una restricción de exclusión como segunda barrera.

Los bloqueos se convierten desde la zona horaria configurada del negocio a timestamps persistidos. Un día completo termina al inicio del día siguiente; un rango incluye íntegramente la fecha final. Los bloqueos se eliminan de forma lógica y quedan auditados.

## Auditoría

Cambios de configuración, catálogo, profesionales, asignaciones, horarios, archivos y bloqueos generan eventos de auditoría con identificadores y metadata mínima. No se guardan archivos, credenciales, tokens ni datos de formularios completos en la metadata.
