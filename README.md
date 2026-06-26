# Proxima

Aplicacion web para mercado de predicciones enfocada en Republica Dominicana.

## Seguimiento del plan

- Estado vivo de ejecucion: [PROGRESO_PLAN.md](PROGRESO_PLAN.md)

## Stack base inicial

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL + RLS)

## Primer arranque local

1. Instala dependencias:

```bash
npm install
```

2. Crea tu archivo de entorno local desde el ejemplo:

```bash
cp .env.example .env.local
```

3. Completa estas variables en `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NOTIFICATIONS_DISPATCH_TOKEN`
- `NEXT_PUBLIC_APP_URL` (ej. `https://proxima-beta.vercel.app`)

4. Levanta el servidor de desarrollo:

```bash
npm run dev
```

## Estructura tecnica creada

- Cliente Supabase para browser y server
- Middleware de sesion para Supabase Auth
- Tipos base de base de datos para evolucionar con migraciones

## Migraciones Supabase (remoto)

La migracion inicial esta en [supabase/migrations/20260611_000001_initial_schema.sql](supabase/migrations/20260611_000001_initial_schema.sql).

Para aplicarla al proyecto remoto:

```bash
npm run db:login
npm run db:link
npm run db:push
```

Luego, para regenerar tipos TypeScript desde el schema real:

```bash
npm run db:types
```

## Notificaciones (Resend)

Se implemento un outbox en DB (`notification_events`) con triggers para:

- ejecucion de trades (`trade_fill`)
- cancelacion de orden (`order_cancelled`)
- cierre de mercado (`market_closed`)

El envio de emails usa Resend desde un dispatcher server-side.

Endpoint de despacho manual/progamado:

- `POST /api/notifications/dispatch`
- Header requerido: `Authorization: Bearer <NOTIFICATIONS_DISPATCH_TOKEN>`

Ejemplo:

```bash
curl -X POST http://localhost:3000/api/notifications/dispatch \
	-H "Authorization: Bearer $NOTIFICATIONS_DISPATCH_TOKEN"
```

Recomendado: programar este endpoint con un cron cada 1-5 minutos en produccion.

## Confirmacion de correo (signup)

Para evitar redirects a `localhost`, define en Vercel:

- `NEXT_PUBLIC_APP_URL=https://TU_DOMINIO_PUBLICO`

El registro usa esa variable para construir el `emailRedirectTo` de Supabase Auth.

Adicionalmente, valida en Supabase Auth:

- `Site URL` apuntando a tu dominio productivo
- `Additional Redirect URLs` incluyendo tu dominio productivo

## Deployment productivo (Vercel)

La app queda lista para despliegue en Vercel con jobs programados para:

- despacho de notificaciones
- procesamiento de cola de retiros

### 1) Variables de entorno en Vercel

Configura estas variables en el proyecto (Production):

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- RESEND_API_KEY
- RESEND_FROM_EMAIL
- NOTIFICATIONS_DISPATCH_TOKEN
- CRON_SECRET

Recomendacion: usa el mismo valor para `CRON_SECRET` y `NOTIFICATIONS_DISPATCH_TOKEN`.

### 2) Cron jobs declarados

El archivo [vercel.json](vercel.json) incluye dos cron jobs cada 5 minutos:

- `/api/notifications/dispatch`
- `/api/withdrawals/process`

Ambos endpoints aceptan `GET` y `POST` y requieren token Bearer.

### 3) Seguridad de los cron

Vercel Cron envia `Authorization: Bearer <CRON_SECRET>` en cada invocacion.
Al usar el mismo valor en `NOTIFICATIONS_DISPATCH_TOKEN`, las rutas quedan protegidas sin exponer endpoints publicos.

### 4) Verificacion post-deploy

Puedes validar manualmente con:

```bash
curl -X POST https://TU_DOMINIO/api/notifications/dispatch \
	-H "Authorization: Bearer $NOTIFICATIONS_DISPATCH_TOKEN"

curl -X POST "https://TU_DOMINIO/api/withdrawals/process?limit=25" \
	-H "Authorization: Bearer $NOTIFICATIONS_DISPATCH_TOKEN"
```

## Operaciones y monitoreo (Etapa 12)

### 1) Healthcheck

- Endpoint: `GET /api/health`
- Respuesta esperada:
	- `200` con `{ ok: true, status: "healthy" }`
	- `503` si faltan variables publicas criticas

Ejemplo:

```bash
curl -i https://TU_DOMINIO/api/health
```

### 2) Observabilidad (logs estructurados)

Se agregaron eventos operativos en formato JSON para:

- auth: `auth.login.*`, `auth.register.*`
- notificaciones: `notifications.dispatch.*`
- retiros: `withdrawals.process.*`

En Vercel puedes filtrar por estos nombres de evento para investigar errores o picos.

### 3) Hardening de APIs

- Rate limit en endpoints sensibles:
	- `/api/notifications/dispatch`
	- `/api/withdrawals/process`
- Respuesta `429` con header `Retry-After` al exceder umbral.
- Seguridad de respuestas via proxy:
	- `X-Content-Type-Options: nosniff`
	- `X-Frame-Options: DENY`
	- `Referrer-Policy: strict-origin-when-cross-origin`
	- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Seed de mercados de prueba (sin SQL)

Para cargar categorias y mercados de ejemplo inspirados en el mockup del cliente (Politica, Economia, Social, Deportes):

```bash
npm run seed:markets
```

Opcionalmente puedes forzar el admin por email:

```bash
MARKET_SEED_ADMIN_EMAIL=admin@tu-dominio.com npm run seed:markets
```

## QA automatizado (smoke checks)

Se agrego una bateria minima automatizada para validar salud y hardening sin acciones destructivas.

Checks incluidos:

- `GET /api/health` responde `200` con `ok=true`
- headers de seguridad en respuesta (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`)
- endpoints protegidos bloquean acceso sin token (`/api/notifications/dispatch`, `/api/withdrawals/process`)

Ejecutar en local:

```bash
npm run qa:smoke
```

Ejecutar contra produccion:

```bash
SMOKE_BASE_URL=https://TU_DOMINIO npm run qa:smoke
```

## QA de posicion positiva en mercado

Se agrego un script para validar que un usuario tiene al menos una posicion abierta con valor positivo.

Ejecutar:

```bash
npm run qa:position -- --user-email correo@dominio.com
```

Opciones utiles:

- `--user-id <uuid>`: usar id de usuario en lugar de email.
- `--market-id <uuid>`: filtrar a un mercado especifico.
- `--min-value <numero>`: umbral minimo de valor de posicion (por defecto 0).

Ejemplo por mercado:

```bash
npm run qa:position -- --user-email correo@dominio.com --market-id UUID_DEL_MERCADO --min-value 1
```

### Como generar un caso valido (manual, reproducible)

1. Abrir un mercado en estado `open`.
2. Con Usuario A, enviar prediccion de compra por una opcion (ej. cantidad 100).
3. Con Usuario B, enviar prediccion de venta por la misma opcion, misma cantidad y mismo precio limite.
4. Verificar en el dashboard de Usuario A que exista ejecucion parcial o total (`quantity_filled > 0`).
5. Ejecutar el script `qa:position` para Usuario A y confirmar salida `OK` con valor positivo.

Nota: si no hay posiciones abiertas (`quantity > 0`) el script termina en `FAIL`, que es el comportamiento esperado.
