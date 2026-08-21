# Changelog

Todos los cambios relevantes de BorKin Turnos se documentan aquí. El proyecto permanece en versión `0.1.0` durante la preparación pre-lanzamiento.

## [0.1.0] - Unreleased

### Added

- Autenticación segura, sesiones renovables, roles y permisos.
- Gestión de negocio, servicios, profesionales, clientes, agenda y bloqueos.
- Caja, cobros, integridad histórica, auditoría, dashboard, estadísticas y reportes.
- Experiencia responsive, PWA online-first, accesibilidad base y healthchecks.
- Stack productivo Docker Compose con proxy same-origin, volúmenes y healthchecks.
- Seed productivo idempotente y seed demo explícito sólo para desarrollo.
- Backup/restore verificado con dump PostgreSQL, uploads y manifiesto SHA-256.
- Guías de despliegue, operación, recuperación, usuario y entrega comercial.

### Security

- Backend y base no se publican al host; runtime backend y Nginx usan usuarios no root.
- Secretos productivos obligatorios fuera del repositorio, cookies Secure y logs sensibles censurados.
