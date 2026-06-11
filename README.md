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
