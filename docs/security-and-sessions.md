# Seguridad y sesiones

## Access tokens

El backend emite JWT HS256 de vida corta. El frontend los conserva sólo en memoria y los envía mediante `Authorization: Bearer`. Cada solicitud protegida vuelve a consultar el usuario, negocio, rol y permisos efectivos, por lo que una desactivación o cambio de permisos se aplica sin esperar al vencimiento del JWT.

## Refresh tokens

El refresh token es aleatorio, se entrega en cookie `HttpOnly`, `SameSite=Lax`, con alcance `/api/auth` y `Secure` en producción. La base conserva únicamente un hash SHA-256 combinado con un secreto del servidor.

Cada uso rota el token. Si se reutiliza un token ya rotado, el backend revoca toda la familia de sesiones antes de devolver el error. Logout, restablecimiento de contraseña y desactivación impiden nuevas renovaciones.

Los endpoints que usan cookies validan el origen configurado. CORS admite únicamente `FRONTEND_URL` y credenciales.

## Autorización

Los permisos se calculan desde `RolePermission` y excepciones `UserPermission` ALLOW/DENY. El `businessId` procede de la sesión, nunca del cuerpo enviado por el cliente. Los endpoints de usuarios requieren `users.manage` en backend.
