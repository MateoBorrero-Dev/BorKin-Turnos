# Operación y mantenimiento

## Estado y salud

```bash
docker compose --env-file .env.production ps
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/health/ready
```

`/healthz` comprueba Nginx, `/health` comprueba que el proceso API vive y `/health/ready` comprueba PostgreSQL. Un `ready` fallido debe retirar la instancia del tráfico. Compose reinicia servicios con `unless-stopped`; no reemplaza monitoreo externo.

## Cadena de proxies

La instalación estándar utiliza dos saltos delante de Express: proxy TLS externo y Nginx BorKin. Debe conservarse `PUBLIC_BIND_IP=127.0.0.1` y `TRUST_PROXY_HOPS=2`. El proxy externo debe reemplazar headers enviados por el cliente y establecer `X-Forwarded-For` con la IP original y `X-Forwarded-Proto=https`; Nginx BorKin agrega el segundo salto y preserva el protocolo validado.

Después de cambiar Caddy, Nginx, Traefik o la red del host:

```bash
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d backend frontend
docker compose --env-file .env.production ps
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/health/ready
```

Si cambia la cantidad real de proxies, ajustar `TRUST_PROXY_HOPS` al número exacto antes de habilitar tráfico. No usar `trust proxy=true`, no publicar el puerto 8080 hacia clientes y no permitir que el proxy externo concatene valores `X-Forwarded-*` no confiables.

## Logs

```bash
docker compose --env-file .env.production logs --since 30m frontend backend postgres
docker compose --env-file .env.production logs -f --tail 100 backend
```

La rotación local limita cada servicio a tres archivos de 10 MB. El logger del backend censura Authorization, cookies, contraseñas y tokens. Aun así, no pegar logs completos en canales públicos; revisar datos personales y direcciones antes de compartirlos.

## Reinicios y persistencia

```bash
docker compose --env-file .env.production restart backend
docker compose --env-file .env.production down
docker compose --env-file .env.production up -d
```

El segundo flujo conserva `postgres_data` y `uploads_data`. No usar `down -v`. Antes de mantenimiento de base, cerrar o detener backend para evitar escrituras concurrentes.

## Incidente de base

Si PostgreSQL deja de estar disponible, `/health` puede seguir en 200 y `/health/ready` debe fallar. El backend responderá de forma segura o reiniciará según la clase de error. Restaurar PostgreSQL, esperar su healthcheck y verificar que backend/frontend vuelven a estado healthy; luego validar login y una consulta protegida. No borrar volúmenes como intento de reparación.

## Rutina sugerida

- Diario: health externo y backup automático; conservar una copia fuera del servidor.
- Semanal: revisar espacio, logs, éxito y tamaño de backups.
- Mensual: restaurar el backup en una base/entorno separado y verificar datos y uploads.
- Antes de cada actualización: backup completo, migración explícita, health y smoke funcional.

Los CSV de reportes no son backups: no incluyen relaciones, sesiones, caja ni archivos.
