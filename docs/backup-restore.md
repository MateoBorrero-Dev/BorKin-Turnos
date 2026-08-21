# Backup, restore y recuperación

## Alcance y privacidad

Un backup completo es una carpeta autocontenida con:

- `database.dump`: salida custom de `pg_dump -Fc`.
- `uploads/`: logos y fotos con su estructura relativa.
- `manifest.json`: versión, fecha, origen no secreto, tamaños e inventario SHA-256.

El paquete contiene datos personales y financieros. Guardarlo fuera del repositorio, con permisos restringidos, copia externa y cifrado provisto por el almacenamiento o sistema operativo. El proyecto no inventa criptografía propia. `BACKUP_DIR` y `backups/` están ignorados por Git.

## Crear un backup Docker

Con los tres contenedores existentes y `.env.production` configurado:

```bash
npm run backup:docker
```

Para otro proyecto Compose o archivo de entorno:

```bash
node scripts/database/backup.mjs --docker --env-file .env.restore --project-name borkin-qa --output ./backups-qa
```

El script usa `pg_dump` dentro del contenedor PostgreSQL, copia `/data/uploads` desde backend, escribe primero una carpeta `.partial` y sólo la renombra al finalizar. Nunca elimina ni modifica datos. Un archivo vacío o una copia incompleta falla y no se presenta como backup válido.

## Backup sin Docker

Requiere `pg_dump` compatible con PostgreSQL 17 en `PATH`, o `PG_DUMP_BIN` con su ruta:

```bash
DATABASE_URL='postgresql://...' UPLOAD_DIR='/srv/borkin/uploads' BACKUP_DIR='/srv/backups' npm run backup
```

En PowerShell, definir esas variables con `$env:NOMBRE='valor'` antes del comando.

## Restore: operación destructiva

El restore reemplaza el contenido lógico de la base y los uploads del destino. Siempre:

1. Elegir un destino separado y sin tráfico.
2. Confirmar nombre de proyecto, base y ruta.
3. Conservar el backup previo del destino.
4. Detener backend.
5. Ejecutar con `--force`; sin esa opción el script se niega.

### Docker

Crear primero el entorno destino y aplicar migraciones para disponer de los contenedores; no ejecutar seed si se restaurará un backup:

```bash
docker compose --env-file .env.restore --project-name borkin-restore up -d postgres
docker compose --env-file .env.restore --project-name borkin-restore --profile operations run --rm migrate
docker compose --env-file .env.restore --project-name borkin-restore up -d backend
docker compose --env-file .env.restore --project-name borkin-restore stop backend
node scripts/database/restore.mjs --docker --force --source ./backups/borkin-FECHA --env-file .env.restore --project-name borkin-restore
docker compose --env-file .env.restore --project-name borkin-restore start backend
docker compose --env-file .env.restore --project-name borkin-restore up -d frontend
```

El script valida manifiesto, hash del dump, inventario de uploads y rutas; rechaza symlinks y traversal. También exige que backend esté detenido. Usa `pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error` y sólo después reemplaza el volumen de uploads.

### Sin Docker

Requiere `pg_restore` 17 en `PATH` o `PG_RESTORE_BIN`:

```bash
node scripts/database/restore.mjs --force --source /backups/borkin-FECHA --database-url 'postgresql://...' --uploads /srv/borkin/uploads
```

La ruta no puede ser la raíz, el repositorio ni el home. Los uploads nuevos se preparan aparte y el directorio anterior se conserva hasta completar el cambio.

## Verificación obligatoria

Después de restaurar:

- `/health/ready` responde 200.
- login, logout y refresh funcionan.
- existen negocio, roles, permisos y configuración.
- se ve un cliente real de prueba, su turno y el profesional.
- caja, movimiento y pago conservan importes y relaciones.
- logo y foto profesional cargan desde `/uploads`.
- dashboard/estadísticas reflejan el cobro.
- no aparecen errores ni secretos en logs.

Registrar fecha, paquete, destino, duración y resultado. Un backup que nunca se restauró no está operacionalmente verificado.

## Recuperación ante desastre

1. Aislar el servicio y preservar los volúmenes dañados para análisis.
2. Preparar host limpio con la misma versión aprobada de la aplicación y PostgreSQL 17.
3. Configurar secretos nuevos o recuperados desde el gestor autorizado.
4. Restaurar el último backup verificado en un proyecto separado.
5. Ejecutar el checklist anterior y comparar fecha/RPO esperado.
6. Habilitar tráfico sólo con aprobación del responsable.

La retención depende del negocio. Como base: diarios por 7 días, semanales por 4 semanas y mensuales por 6–12 meses, ajustado a normativa, capacidad y política de privacidad.
