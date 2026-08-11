# BorKin Turnos

Sistema web comercial y multirubro para gestionar turnos, clientes, profesionales, servicios y caja.

Proyecto perteneciente a BorKin.

## Estado

La Fase 2 agrega a las fundaciones autenticadas la configuración del negocio, identidad visual, categorías, servicios, profesionales, asignaciones, horarios laborales y bloqueos de agenda. Todos los datos operativos se aíslan por el negocio de la sesión.

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
