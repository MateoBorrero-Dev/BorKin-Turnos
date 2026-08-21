# Checklist de entrega al cliente

## Infraestructura

- [ ] Dominio y HTTPS válidos; redirección HTTP→HTTPS.
- [ ] Sólo proxy/frontend público; PostgreSQL y backend sin puertos expuestos.
- [ ] `.env.production` fuera de Git, sin `CHANGE_ME`, con secretos distintos y aleatorios.
- [ ] `COOKIE_SECURE=true`, `PUBLIC_ORIGIN` correcto y hora del servidor sincronizada.
- [ ] Volúmenes `postgres_data` y `uploads_data` identificados.
- [ ] Rotación de logs y monitoreo externo de `/health/ready`.

## Instalación y datos

- [ ] Imágenes construidas desde lockfile; contenedores sin privilegios innecesarios.
- [ ] Migraciones `prisma migrate deploy` ejecutadas explícitamente.
- [ ] Seed base ejecutado dos veces sin duplicar ni resetear administrador/negocio.
- [ ] Contraseña inicial cambiada y usuarios/roles revisados.
- [ ] No se ejecutó seed demo en producción.

## QA funcional

- [ ] Login, logout, refresh, rutas protegidas, roles y permisos backend.
- [ ] Configuración de negocio, servicio, profesional, horarios y cliente.
- [ ] Turno creado, iniciado, completado y cobrado con caja abierta.
- [ ] Cierre de caja, dashboard, estadísticas y reportes coherentes.
- [ ] Logo y foto visibles tras recarga.
- [ ] Datos persisten tras restart y `down`/`up` sin `-v`.
- [ ] API y frontend no contienen `localhost` hardcodeado en el build productivo.

## Continuidad

- [ ] Backup completo real creado y almacenado fuera del host.
- [ ] Restore realizado en base/proyecto separado.
- [ ] Cliente, profesional, turno, caja, pago y uploads restaurados y verificados.
- [ ] Procedimiento, responsable, retención y frecuencia documentados.
- [ ] Simulación de caída/recuperación de PostgreSQL superada.

## Entrega

- [ ] README y guías entregadas al responsable.
- [ ] Versionado 0.1.0 y changelog revisados.
- [ ] TypeScript, lint, tests, builds, auditorías y `git diff --check` registrados.
- [ ] Sin secretos, backups, certificados ni archivos de cliente en Git.
- [ ] Sin commit, push, tag o release automatizado por el proceso de QA.
