# Seguridad y sesiones

## Access tokens

El backend emite JWT HS256 de vida corta. El frontend los conserva sólo en memoria y los envía mediante `Authorization: Bearer`. Cada solicitud protegida vuelve a consultar el usuario, negocio, rol y permisos efectivos, por lo que una desactivación o cambio de permisos se aplica sin esperar al vencimiento del JWT.

## Refresh tokens

El refresh token es aleatorio, se entrega en cookie `HttpOnly`, `SameSite=Lax`, con alcance `/api/auth` y `Secure` en producción. La base conserva únicamente un hash SHA-256 combinado con un secreto del servidor.

Cada uso rota el token. Si se reutiliza un token ya rotado, el backend revoca toda la familia de sesiones antes de devolver el error. Logout, restablecimiento de contraseña y desactivación impiden nuevas renovaciones.

La rotación toma un bloqueo de fila PostgreSQL (`SELECT … FOR UPDATE`) sobre la sesión antes de comprobar y actualizar `revokedAt`. Esto garantiza atomicidad entre pestañas, procesos y múltiples instancias del backend: ante dos refresh simultáneos con la misma cookie, sólo uno crea un sucesor. El segundo espera el commit, detecta reutilización y aplica la política conservadora de V1, revocando todas las sesiones todavía activas de esa familia, incluido el sucesor recién creado.

Esta política prioriza seguridad frente a comodidad. Dos pestañas que refresquen exactamente al mismo tiempo pueden provocar que la familia quede revocada y requiera un nuevo login al agotarse el access token vigente. V1 no incorpora una ventana de tolerancia porque distinguir una carrera legítima de la reproducción maliciosa del token exigiría un protocolo adicional; no se acepta una excepción temporal que permita dos ramas activas.

Los endpoints que usan cookies validan el origen configurado. CORS admite únicamente `FRONTEND_URL` y credenciales.

## Autorización

Los permisos se calculan desde `RolePermission` y excepciones `UserPermission` ALLOW/DENY. El `businessId` procede de la sesión, nunca del cuerpo enviado por el cliente. Los endpoints de usuarios requieren `users.manage` en backend.
