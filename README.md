# BorKin Turnos

Sistema web comercial y multirubro para gestionar turnos, clientes, profesionales, servicios y caja.

Proyecto perteneciente a BorKin.

## Estado

La versión pre-lanzamiento `0.1.0` incluye autenticación, negocio, catálogo, profesionales, clientes, agenda, caja, dashboard, estadísticas, reportes, experiencia responsive, PWA online-first y controles de seguridad. La Fase 8 agrega una entrega reproducible con Docker Compose, persistencia, migraciones explícitas, seeds separados, backup/restore y documentación operativa. Todos los datos operativos se aíslan por el negocio de la sesión.

## Requisitos

- Node.js 24 LTS y npm 11.
- PostgreSQL 17 recomendado.

## Instalación de desarrollo

1. Ejecutar `npm install`.
2. Copiar `.env.example` a `backend/.env` y reemplazar todos los secretos.
3. Crear las bases indicadas en `DATABASE_URL` y `TEST_DATABASE_URL`. El entorno local del proyecto usa por defecto `127.0.0.1:55432` y conserva el cluster en `.local/postgres-data`.
4. Ejecutar `npm run db:generate`.
5. Ejecutar `npm run db:migrate` y `npm run db:seed`.
6. Ejecutar `npm run db:start` y luego `npm run dev`. Como alternativa, `npm run dev:all` comprueba/inicia la base y levanta ambas aplicaciones.

Frontend: `http://localhost:5173`. API: `http://localhost:3000/api`.

## Comandos

- `npm run dev`: inicia backend y frontend simultáneamente, con logs identificados.
- `npm run dev:all`: garantiza que PostgreSQL local esté activa y luego inicia backend y frontend.
- `npm run dev:backend`: inicia sólo la API.
- `npm run dev:frontend`: inicia sólo Vite.
- `npm run start:backend`: inicia el build compilado de la API.
- `npm run preview:frontend`: sirve localmente el build frontend ya generado para verificación.
- `npm run db:start`: inicia únicamente el cluster PostgreSQL de `.local/postgres-data`.
- `npm run db:stop`: detiene ese cluster sin eliminar datos.
- `npm run db:status`: informa si el cluster está activo, detenido o inaccesible.
- `npm run typecheck`: valida TypeScript.
- `npm run lint`: ejecuta ESLint.
- `npm test`: ejecuta pruebas backend y frontend.
- `npm run build`: genera builds productivos.
- `npm run db:deploy`: aplica migraciones existentes.
- `npm run db:seed`: crea negocio, roles, permisos y administrador iniciales.
- `npm run db:seed:demo`: agrega datos demostrativos sólo en desarrollo; se bloquea en producción.
- `npm run backup:docker`: crea dump, copia uploads y genera manifiesto verificado.
- `npm run restore:docker -- --force --source <carpeta>`: restaura explícitamente un paquete validado con backend detenido.

## Puertos de desarrollo

- Frontend Vite: `5173`.
- API: `3000`.
- PostgreSQL local del proyecto: `55432`.

Los scripts de base nunca operan sobre el servicio global de PostgreSQL. Para una instalación no estándar se puede definir `POSTGRES_BIN`; la carpeta de datos puede configurarse con `LOCAL_POSTGRES_DATA` y el puerto con `LOCAL_POSTGRES_PORT`.

## Archivos de negocio

En V1, logos y fotos se almacenan bajo `.local/uploads` y se sirven desde `/uploads`. El backend limita tamaño, verifica MIME y firma binaria, genera nombres aleatorios y no confía en extensiones del cliente. `UPLOAD_DIR` permite sustituir esta implementación por otro adaptador de almacenamiento en una versión futura.

Los archivos `.env`, tokens, hashes y credenciales no deben incorporarse a Git.

Las políticas de sesiones y de integridad histórica están en `docs/`.

## Variables de entorno

Copiar `.env.example` a `backend/.env` para desarrollo. Las variables principales son:

- `DATABASE_URL`: conexión PostgreSQL de la aplicación.
- `TEST_DATABASE_URL`: base aislada utilizada por la suite de integración.
- `FRONTEND_URL`: único origen autorizado por CORS y por endpoints basados en cookie.
- `TRUST_PROXY_HOPS`: cantidad exacta de proxies confiables delante de Express. En producción Docker estándar debe ser `2`; en desarrollo directo es `0`.
- `JWT_SECRET` y `JWT_REFRESH_SECRET`: secretos distintos, aleatorios y de al menos 32 caracteres.
- `JWT_ACCESS_TTL` y `JWT_REFRESH_TTL_DAYS`: duración de access y refresh.
- `COOKIE_SECURE`: debe ser `true` en producción; el backend rechaza una configuración productiva insegura.
- `UPLOAD_DIR` y `MAX_UPLOAD_BYTES`: almacenamiento local y límite de imágenes.
- `VITE_API_URL`: URL pública de la API utilizada al compilar el frontend.
- `ADMIN_*` y `BUSINESS_NAME`: datos del seed inicial; usar valores propios y nunca versionar credenciales reales.

## Despliegue recomendado con Docker

1. Copiar `.env.production.example` como `.env.production` y reemplazar todos los valores de ejemplo.
2. Validar con `docker compose --env-file .env.production config --quiet`.
3. Iniciar PostgreSQL, ejecutar migraciones y seed base explícitamente y luego levantar backend/frontend siguiendo [deployment.md](docs/deployment.md).
4. Terminar HTTPS en un proxy externo. La cadena soportada es cliente → proxy TLS externo → Nginx BorKin → Express, con `TRUST_PROXY_HOPS=2`. Nginx es el único contenedor publicado y mantiene `/api` y `/uploads` en el mismo origen.

No ejecutar `docker compose down -v` en una actualización: elimina los volúmenes persistentes. Crear un backup completo antes de cada cambio.

La PWA requiere HTTPS fuera de localhost. Su service worker precachea únicamente el shell y assets estáticos; API, uploads y health usan red exclusivamente y no existe sincronización financiera offline.

## Documentación

- [Despliegue productivo](docs/deployment.md)
- [Operación y mantenimiento](docs/operations.md)
- [Backup, restore y recuperación](docs/backup-restore.md)
- [Guía rápida de usuario](docs/user-guide.md)
- [Checklist de entrega comercial](docs/client-delivery-checklist.md)
- [Hardening de producto y PWA](docs/phase7-product-hardening.md)
- [Changelog](CHANGELOG.md)
