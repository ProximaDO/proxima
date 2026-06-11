# Progreso del Plan de Ejecucion

Ultima actualizacion: 2026-06-11

## Estado por etapa

1. Setup base (Next.js, estructura): COMPLETADO
2. BD en Supabase (schema, RLS, indices): COMPLETADO
3. Auth y roles (Supabase Auth + middleware): COMPLETADO
4. Admin panel (CRUD de mercados): COMPLETADO
5. Logica de trading (Orden limit + LMSR hibrido): COMPLETADO
6. Wallet (recargas, historial): COMPLETADO
7. Retiros (automaticos con reglas): COMPLETADO
8. Resolucion (liquidacion de beneficios): COMPLETADO
9. UI usuario (mercados, portfolio, graficos): COMPLETADO
10. Emails (transaccionales con Resend): COMPLETADO
11. Deployment (Vercel + Edge Functions): COMPLETADO
12. Mejoras opcionales (KYC, monitoring, etc.): PENDIENTE

## Detalle breve de estado actual

- Trading: motor de matching de ordenes limit, settlement y capa de pricing hibrido LMSR+libro+trades operativa en listado y detalle de mercados.
- Retiros: flujo extremo a extremo completo con solicitud, revision admin, cola de procesamiento automatico (processing -> completed/failed), reversas y notificaciones.
- UI usuario: mercados y dashboard completos, incluyendo visualizaciones de portfolio (asignacion y evolucion) y refinamientos operativos.
- Deployment: flujo productivo documentado para Vercel con jobs programados y endpoints protegidos por token.

## Siguiente paso recomendado

- Etapa 12: mejoras opcionales (KYC, observabilidad, alertas y hardening operativo).

## Regla de actualizacion

- Actualizar este archivo al cerrar cada iteracion con:
  - fecha
  - etapas impactadas
  - cambios entregados
  - validacion (lint/build/db push/types)

## Historial de iteraciones recientes

- 2026-06-11
  - Etapas impactadas: 11 (Deployment), 10 (Emails), 7 (Retiros)
  - Cambios entregados:
    - Nuevo `vercel.json` con cron jobs cada 5 minutos para `/api/notifications/dispatch` y `/api/withdrawals/process`
    - Endpoints cron endurecidos para produccion con compatibilidad `GET` y `POST` bajo autenticacion Bearer
    - Documentacion de deployment productivo en README con variables, seguridad de cron y checklist de verificacion
    - `.env.example` actualizado incluyendo `CRON_SECRET`
  - Validacion: lint OK, build OK

- 2026-06-11
  - Etapas impactadas: 9 (UI usuario)
  - Cambios entregados:
    - Dashboard: nuevo bloque de portfolio con grafico de asignacion por posiciones abiertas (donut con pesos por exposicion)
    - Dashboard: grafico de evolucion de balance con sparkline construido a partir de movimientos reales de wallet
    - Dashboard: nuevos KPIs de patrimonio, liquidez inmediata, flujo neto 7 dias, posicion principal y PnL realizado agregado
    - Refinamiento de UX de lectura rapida para portfolio sin agregar dependencias externas
  - Validacion: lint OK, build OK

- 2026-06-11
  - Etapas impactadas: 7 (Retiros), 10 (Emails), 4 (Admin panel)
  - Cambios entregados:
    - Nueva migracion `20260612000012_withdrawal_processing_pipeline.sql` con pipeline real: `pending -> processing -> completed/failed`
    - `review_withdrawal_request` ahora aprueba enviando a `processing` y solo consume fondos bloqueados al completar
    - Nueva RPC `process_withdrawal_queue(p_limit)` para procesar retiros en lote, con ramas de exito y fallo (incluye reversa de fondos en `failed`)
    - Trigger de notificaciones de retiros actualizado para disparar `withdrawal_approved` en `completed` y `withdrawal_rejected` en `rejected/failed`
    - Admin retiros: boton de `Procesar cola` y aprobacion con mensaje de envio a processing
    - Nuevo endpoint seguro `POST /api/withdrawals/process` para ejecucion programada (cron) con token Bearer
    - Dashboard: etiqueta visual explicita para estado `processing`
  - Validacion: db push OK, db types OK, lint OK, build OK

- 2026-06-11
  - Etapas impactadas: 5 (Trading), 9 (UI usuario)
  - Cambios entregados:
    - Nuevo modulo `lib/markets/pricing.ts` con calculo de probabilidades hibridas (LMSR + mid del libro + ultimo trade) y normalizacion por mercado
    - `app/markets/page.tsx` ahora muestra probabilidades por pricing hibrido usando liquidez `liquidity_b`, posiciones, libro abierto y trades recientes
    - `app/markets/[id]/page.tsx` actualizado al mismo modelo de cotizacion hibrida y mensaje de contexto ajustado
  - Validacion: lint OK, build OK

- 2026-06-11
  - Etapas impactadas: 7 (Retiros), 4 (Admin panel)
  - Cambios entregados:
    - Admin retiros: nuevo bloque de historial de procesados en /admin/withdrawals
    - Filtros por estado (approved/rejected/completed/failed), usuario (email o id) y rango de fechas
    - Vista de pendientes se mantiene con acciones aprobar/rechazar sin regresiones
  - Validacion: lint OK, build OK

- 2026-06-11
  - Etapas impactadas: 9 (UI usuario)
  - Cambios entregados:
    - Dashboard: filtro de notificaciones por tipo (todo, trading, mercados, retiros)
    - Compatibilidad con filtro no leidas/todas + paginacion preservando el tipo seleccionado
  - Validacion: lint OK, build OK

- 2026-06-11
  - Etapas impactadas: 7 (Retiros), 10 (Emails)
  - Cambios entregados:
    - Nueva migracion `20260612000011_withdrawal_notifications.sql` para eventos `withdrawal_approved` y `withdrawal_rejected`
    - Trigger en `withdrawal_requests` para encolar notificaciones al revisar solicitudes
    - Dispatcher y templates de correo extendidos para retiros aprobados/rechazados
    - Dashboard actualizado para mostrar estos nuevos eventos en la seccion de notificaciones
    - Revision admin de retiro ahora intenta despachar notificaciones pendientes al completar approve/reject
  - Validacion: db push OK, db types OK, lint OK, build OK

- 2026-06-11
  - Etapas impactadas: 7 (Retiros), 4 (Admin panel), 6 (Wallet)
  - Cambios entregados:
    - RPC `request_withdrawal` con validaciones de reglas (min/max, limites diario/mensual, cooldown) y reserva de fondos (available -> locked)
    - RPC `review_withdrawal_request` para aprobacion/rechazo admin, con liberacion/consumo de fondos reservados y audit log
    - Dashboard: formulario de solicitud de retiro + historial de solicitudes del usuario
    - Admin: nueva vista `/admin/withdrawals` para aprobar/rechazar retiros pendientes
  - Validacion: db push OK, db types OK, lint OK, build OK

- 2026-06-11
  - Etapas impactadas: 9 (UI usuario)
  - Cambios entregados:
    - Filtro de mercados resueltos por estado personal (todos, ganados, perdidos, sin posicion)
    - Totales de payout global y filtrado
    - Enlace permanente al tracker desde README
  - Validacion: lint OK, build OK
