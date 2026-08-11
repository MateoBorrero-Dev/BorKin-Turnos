# Política de clientes — Fase 3

## Teléfono y email

`phone` conserva el valor de presentación ingresado por el negocio como texto. Se
aceptan prefijo `+`, espacios, paréntesis, puntos y guiones. `phoneNormalized`
elimina todo excepto dígitos y se usa únicamente para búsqueda y comparación de
coincidencias fuertes. Esta normalización deliberadamente simple no interpreta
prefijos nacionales ni agrega códigos de país, por lo que no altera ceros ni
fabrica un número internacional.

`email` se recorta y se guarda en minúsculas. `emailNormalized` contiene el mismo
valor canónico y permite mantener explícita la estrategia de comparación. Ambos
campos normalizados están indexados junto con `businessId`.

## Posibles duplicados

No existen restricciones únicas sobre teléfono o email: dos personas pueden
compartir datos de contacto. Al crear, o al cambiar esos datos durante una
edición, el backend busca clientes activos del mismo negocio con teléfono o email
normalizado igual. Una coincidencia responde `409 POSSIBLE_DUPLICATE` con un
resumen acotado. La operación sólo continúa si se reenvía con
`forceDuplicate: true`; esta intención se valida en el backend. El propio cliente
se excluye durante la edición y nunca se consultan coincidencias de otro negocio.

## Desactivación e historia

En V1 desactivar significa exclusivamente `active = false`. No se modifica
`deletedAt` y nunca se elimina físicamente el registro. Así se conservan sus
relaciones e historia. `deletedAt` queda reservado para una futura eliminación
lógica diferenciada. Reactivar vuelve a establecer `active = true`.

Los endpoints de listado pueden mostrar activos o inactivos de forma explícita.
El endpoint liviano `/api/clients/options` devuelve sólo activos, no eliminados y
del negocio autenticado; esa es la política que deberá reutilizar Fase 4 para
nuevos turnos. Turnos históricos o ya existentes no se alterarán si el cliente se
desactiva.

## Fechas, seguridad y auditoría

`birthDate` usa PostgreSQL `DATE`. La API intercambia `YYYY-MM-DD` y lo serializa
sin conversión a la zona horaria del navegador, evitando el corrimiento de día.
Se rechazan fechas inexistentes y futuras.

El `businessId` siempre proviene de la sesión. Los esquemas Zod son estrictos y
no aceptan `active`, `deletedAt`, IDs, timestamps ni `businessId` en altas o
ediciones. Los recursos de otro negocio responden 404.

Se auditan `CLIENT_CREATED`, `CLIENT_UPDATED`, `CLIENT_DISABLED` y
`CLIENT_REACTIVATED`. La metadata de edición contiene sólo nombres de campos;
no copia teléfono, email ni notas.
