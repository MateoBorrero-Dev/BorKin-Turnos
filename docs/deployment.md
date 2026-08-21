# Despliegue productivo

## Arquitectura

La instalación soportada usa Docker Compose con tres servicios:

- `frontend`: Nginx no privilegiado, único servicio publicado. Sirve la SPA y redirige `/api`, `/uploads`, `/health` y `/health/ready` al backend por la red interna.
- `backend`: proceso Node compilado, ejecutado como usuario no root. No publica puertos al host y persiste archivos en `uploads_data`.
- `postgres`: PostgreSQL 17.10, sin puerto público y con datos en `postgres_data`.

Los servicios `migrate` y `seed` pertenecen al perfil `operations` y sólo se ejecutan manualmente. El backend nunca migra ni carga datos al arrancar.

La topología productiva soportada es explícitamente:

```text
Cliente HTTPS
  → proxy TLS externo (Caddy, Nginx, Traefik o equivalente)
  → 127.0.0.1:8080, Nginx interno de BorKin
  → backend Express
  → PostgreSQL
```

Express tiene dos proxies delante y por eso `TRUST_PROXY_HOPS=2`. No se usa `trust proxy=true`: Express sólo descarta los dos saltos conocidos al resolver `req.ip`. En desarrollo directo `TRUST_PROXY_HOPS=0` y los headers forwarded no son confiables.

## Capacidad inicial

Como punto de partida para un negocio pequeño: 2 vCPU, 2–4 GB de RAM y SSD con espacio suficiente para base, uploads y backups externos. Es una guía inicial, no un benchmark; monitorear uso y latencia antes de escalar.

## Preparación

1. Instalar Docker Engine con Compose v2 en Linux, o Docker Desktop para una evaluación local.
2. Copiar `.env.production.example` como `.env.production`. El archivo real está ignorado por Git.
3. Reemplazar todos los `CHANGE_ME`. Generar cada secreto por separado:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

4. Si la contraseña PostgreSQL contiene caracteres reservados, codificarla sólo para `DATABASE_URL`:

   ```bash
   node -e "console.log(encodeURIComponent(process.argv[1]))" 'contraseña-real'
   ```

5. Definir `PUBLIC_ORIGIN` con el origen HTTPS final, sin ruta. `COOKIE_SECURE=true` es obligatorio en producción.
6. Mantener `TRUST_PROXY_HOPS=2` para la topología estándar. Un valor ausente, cero, no numérico o mayor que el límite validado impide iniciar el backend productivo.
7. Validar la configuración sin mostrarla en tickets ni logs compartidos:

   ```bash
   docker compose --env-file .env.production config --quiet
   ```

## Instalación limpia

```bash
docker compose --env-file .env.production up -d postgres
docker compose --env-file .env.production --profile operations run --rm migrate
docker compose --env-file .env.production --profile operations run --rm seed
docker compose --env-file .env.production up -d backend frontend
docker compose --env-file .env.production ps
```

Comprobar `GET /healthz`, `GET /health` y `GET /health/ready` desde el origen publicado. Cambiar la contraseña inicial desde la aplicación antes de entregar acceso a terceros.

## HTTPS y red

Los certificados no se versionan ni se incluyen. En un VPS, ubicar Caddy, Nginx, Traefik o el balanceador del proveedor delante de `127.0.0.1:8080` y terminar TLS allí. Mantener `PUBLIC_BIND_IP=127.0.0.1`; el puerto interno no debe aceptar clientes de Internet ni de la LAN.

El proxy TLS externo es la frontera de confianza y debe **sobrescribir**, no concatenar ciegamente, cualquier `X-Forwarded-For` y `X-Forwarded-Proto` recibido del cliente. Debe enviar la IP original como `X-Forwarded-For` y `https` como `X-Forwarded-Proto`. Nginx BorKin agrega el salto del proxy externo a `X-Forwarded-For`; para protocolo sólo acepta `http` o `https` y usa su propio `$scheme` cuando el header falta o es inválido. Así Express recibe la cadena `cliente, proxy-externo` y, con dos saltos confiables, resuelve la IP original sin confiar en valores ubicados más allá de esa frontera.

Una topología diferente —por ejemplo, acceso directo sin proxy TLS o más balanceadores— no está autodetectada. El administrador debe mantener el puerto protegido, contar los proxies reales y ajustar `TRUST_PROXY_HOPS` conscientemente antes de habilitar tráfico. Nunca usar `true` para cubrir topologías desconocidas.

El firewall debe aceptar sólo SSH administrado y HTTP/HTTPS públicos. No abrir PostgreSQL ni el puerto del backend. El proxy debe imponer HTTPS; HSTS ya lo agrega Helmet cuando el backend recibe tráfico productivo.

## Actualización segura

1. Crear y verificar un backup completo.
2. Obtener la versión aprobada del código o imágenes.
3. Ejecutar `docker compose --env-file .env.production build --pull`.
4. Ejecutar el servicio `migrate` y revisar su salida.
5. Recrear backend y frontend con `docker compose --env-file .env.production up -d backend frontend`.
6. Comprobar health, login y el flujo crítico.

`docker compose down` no elimina volúmenes; una recreación conserva base y uploads. `docker compose down -v` elimina datos y está prohibido en actualizaciones normales. Un rollback de aplicación debe usar una versión compatible con el esquema; si una migración no lo permite, seguir el procedimiento de recuperación y restaurar en un entorno separado antes de tocar producción.

## PostgreSQL y versiones

La imagen queda fijada en PostgreSQL 17.10 Alpine. Node queda fijado en 24.18.0 y Nginx unprivileged en la rama estable 1.30.3. El usuario V1 definido por `POSTGRES_USER` es propietario operativo de la base y también ejecuta migraciones/backup dentro de la red privada; no existe un usuario público. En instalaciones con requisitos regulatorios puede separarse el rol de runtime, migración y backup sin cambiar el modelo de aplicación.
