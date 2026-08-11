# BorKin Turnos

Sistema web comercial y multirubro para gestionar turnos, clientes, profesionales, servicios y caja.

Proyecto perteneciente a BorKin.

## Estado

La Fase 1 contiene las fundaciones verificadas: monorepo TypeScript, React/Vite, API Express, PostgreSQL/Prisma, autenticación, refresh seguro, usuarios, roles, permisos y layout responsive.

## Requisitos

- Node.js 24 LTS y npm 11.
- PostgreSQL 17 recomendado.

## Instalación de desarrollo

1. Ejecutar `npm install`.
2. Copiar `.env.example` a `backend/.env` y reemplazar todos los secretos.
3. Crear las bases indicadas en `DATABASE_URL` y `TEST_DATABASE_URL`.
4. Ejecutar `npm run db:generate`.
5. Ejecutar `npm run db:migrate` y `npm run db:seed`.
6. Ejecutar `npm run dev`.

Frontend: `http://localhost:5173`. API: `http://localhost:3000/api`.

## Comandos

- `npm run typecheck`: valida TypeScript.
- `npm run lint`: ejecuta ESLint.
- `npm test`: ejecuta pruebas backend y frontend.
- `npm run build`: genera builds productivos.
- `npm run db:deploy`: aplica migraciones existentes.
- `npm run db:seed`: crea negocio, roles, permisos y administrador iniciales.

Los archivos `.env`, tokens, hashes y credenciales no deben incorporarse a Git.

Las políticas de sesiones y de integridad histórica están en `docs/`.
