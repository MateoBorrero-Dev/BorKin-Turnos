# Fase 7 — Product hardening

## Alcance

Esta fase no modifica reglas de negocio de las Fases 1 a 6. Consolida UX, responsive, accesibilidad base, PWA, manejo de errores, sesiones, observabilidad y operación productiva.

## UX y navegación

- Menú principal ordenado por frecuencia operativa: Inicio, Agenda, Clientes, Servicios, Profesionales, Caja, Estadísticas, Reportes, Auditoría, Usuarios y Configuración.
- El menú lateral tiene scroll propio, se convierte en drawer móvil, bloquea el scroll del documento y cierra con overlay, navegación, botón o `Escape`.
- Los cambios de ruta restauran la parte superior de la página.
- Los modales comunes tienen título asociado, foco inicial, ciclo de foco, restauración del foco anterior, cierre con `Escape`, overlay y scroll interno en pantallas bajas.
- Estados 403 y 404 son explícitos. Un `ErrorBoundary` evita una pantalla vacía ante fallos no controlados.
- Los controles táctiles principales miden al menos 44 px, el foco por teclado es visible y se respeta `prefers-reduced-motion`.
- El color primario del negocio calcula automáticamente texto claro u oscuro para conservar contraste legible.

## Sesiones y datos en memoria

- El access token vive sólo en memoria. El refresh permanece en cookie `HttpOnly`, `SameSite=Lax`, restringida a `/api/auth` y `Secure` en producción.
- Las solicitudes 401 concurrentes comparten una única renovación y cada operación se reintenta una sola vez.
- Cuando la renovación falla durante una sesión activa se limpia token, usuario y caché de TanStack Query, se muestra un único aviso y se vuelve al login por la ruta protegida.
- Login y logout limpian la caché para impedir que un usuario vea datos retenidos de una sesión anterior. El logout local se completa aunque el backend no esté disponible.
- El backend limita intentos de login y también ráfagas de refresh. Los endpoints de cookie validan el origen confiable.

## Errores y observabilidad

- La API devuelve códigos estables y mensajes seguros. Los errores no controlados usan `INTERNAL_ERROR`; una base inaccesible usa `SERVICE_UNAVAILABLE` con HTTP 503.
- Cada respuesta incluye `X-Request-Id`; los errores 500/503 lo incluyen también en el cuerpo para soporte. Los detalles técnicos se conservan sólo en logs estructurados.
- Pino redacta autorización, cookies, `set-cookie`, contraseñas y tokens.
- `GET /health` confirma que el proceso responde y no consulta PostgreSQL.
- `GET /health/ready` confirma que el proceso puede consultar PostgreSQL. Ambos usan `Cache-Control: no-store`.

## Seguridad HTTP

- Helmet sigue habilitado globalmente. HSTS se emite sólo en producción, donde debe existir HTTPS; no se anuncia HSTS sobre HTTP local.
- CORS entrega credenciales y `Access-Control-Allow-Origin` únicamente al `FRONTEND_URL` configurado. Herramientas sin header Origin siguen permitidas.
- `/uploads` conserva su excepción CORP `cross-origin` para permitir imágenes embebidas desde el frontend, sin relajar la API restante.
- El backend rechaza producción con `COOKIE_SECURE=false`. Los límites JSON, validación de uploads, firmas, nombres aleatorios y protección de rutas se conservan.

## PWA y privacidad de caché

- El manifest define nombre, descripción, colores, modo standalone e íconos 192, 512 y maskable.
- El service worker precachea únicamente HTML, JavaScript, CSS, SVG, PNG e ICO generados por el frontend.
- Toda ruta `/api/`, `/uploads/` o `/health` usa estrategia Workbox `NetworkOnly`. No se almacenan respuestas privadas, clientes, agenda, caja, estadísticas ni reportes en Cache Storage.
- No se configura Background Sync. Ningún cobro, movimiento de caja o edición se encola offline.
- El banner offline informa que los datos pueden estar desactualizados. Al recuperar conexión se invalidan consultas activas.
- Una actualización del service worker muestra una acción explícita para cargar la nueva versión.

## Checklist de producción

1. Node.js 24 LTS, PostgreSQL disponible y secretos gestionados fuera del repositorio.
2. `NODE_ENV=production`, `COOKIE_SECURE=true`, `FRONTEND_URL` y `VITE_API_URL` con orígenes HTTPS correctos.
3. `npm ci`, `npm run db:deploy`, `npm run build`.
4. Servir `frontend/dist` con fallback SPA y enviar API/uploads/health al backend.
5. No cachear `index.html`, `sw.js`, `manifest.webmanifest`, API ni uploads en el proxy/CDN.
6. Verificar `/health`, `/health/ready`, login, refresh, logout, permisos y persistencia luego de reiniciar.
7. Revisar Console, Network, Application/Service Workers y Cache Storage en navegador real.
8. Ejecutar `npm audit` y evaluar vulnerabilidades sin aplicar `--force` automáticamente.

### Estado del audit de dependencias

El audit productivo (`npm audit --omit=dev`) no reporta vulnerabilidades. El audit completo conserva un advisory alto en la cadena de desarrollo `prisma` → `@prisma/config` → `deepmerge-ts` por agotamiento de pila al combinar grafos recursivos. No afecta dependencias instaladas con `--omit=dev` ni procesa entrada HTTP de la aplicación. npm sólo propone bajar Prisma 7 a Prisma 6.12 como cambio mayor; no se aplica esa regresión automática. Debe revisarse al publicarse un parche compatible de Prisma 7. El generador temporal de assets fue retirado y `concurrently` se actualizó a la versión corregida.

## Matriz de QA manual

Probar anchos 1920, 1366, 1024, 768 y 390 px: navegación, drawer, formularios, tablas/listados, agenda, modales y acciones críticas. Recorrer como administrador Inicio, Agenda, Clientes, Servicios, Profesionales, Caja, Estadísticas, Reportes, Usuarios y Configuración. Repetir el alcance habilitado como empleado. Simular backend caído, PostgreSQL caída, offline y sesión expirada. Confirmar que no haya errores relevantes ni datos sensibles en Console/Network y que Cache Storage no contenga respuestas de backend.
