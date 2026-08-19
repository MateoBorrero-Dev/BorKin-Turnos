# BorKin Turnos

Sistema web comercial y multirubro para gestionar turnos, clientes, profesionales, servicios y caja.

Proyecto perteneciente a BorKin.

## Estado

Las Fases 1 a 6 implementan autenticación, negocio, catálogo, profesionales, clientes, agenda, caja, dashboard, estadísticas y reportes. La Fase 7 consolida el producto con navegación responsive, accesibilidad base, manejo global de errores, PWA segura, healthchecks y hardening de sesiones. Todos los datos operativos se aíslan por el negocio de la sesión.

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
- `JWT_SECRET` y `JWT_REFRESH_SECRET`: secretos distintos, aleatorios y de al menos 32 caracteres.
- `JWT_ACCESS_TTL` y `JWT_REFRESH_TTL_DAYS`: duración de access y refresh.
- `COOKIE_SECURE`: debe ser `true` en producción; el backend rechaza una configuración productiva insegura.
- `UPLOAD_DIR` y `MAX_UPLOAD_BYTES`: almacenamiento local y límite de imágenes.
- `VITE_API_URL`: URL pública de la API utilizada al compilar el frontend.
- `ADMIN_*` y `BUSINESS_NAME`: datos del seed inicial; usar valores propios y nunca versionar credenciales reales.

## Build y ejecución de producción

1. Instalar exactamente el lockfile con `npm ci` usando Node.js 24 LTS.
2. Definir variables productivas y secretos fuera del repositorio. Usar HTTPS y `COOKIE_SECURE=true`.
3. Ejecutar `npm run db:deploy` y, sólo para la instalación inicial, `npm run db:seed`.
4. Ejecutar `npm run build`.
5. Iniciar la API con `npm run start:backend`.
6. Servir `frontend/dist` desde un servidor HTTPS con fallback de rutas SPA a `index.html`. `npm run preview:frontend` sirve únicamente para verificación local del build.

El proxy o balanceador debe enviar `/api`, `/uploads` y `/health` al backend. No debe aplicar caché pública a la API, uploads privados, `index.html`, `sw.js` ni `manifest.webmanifest`; los assets con hash de `frontend/dist/assets` sí pueden usar caché prolongada. Los healthchecks son `GET /health` (vida del proceso, sin dependencia de base) y `GET /health/ready` (disponibilidad con PostgreSQL).

La PWA requiere HTTPS fuera de localhost. Su service worker precachea únicamente el shell y assets estáticos; API, uploads y health usan red exclusivamente y no existe sincronización financiera offline. La política completa y el checklist de despliegue están en `docs/phase7-product-hardening.md`.
