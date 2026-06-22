const ORDER_STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  partially_filled: "Parcial",
  filled: "Ejecutada",
  cancelled: "Cancelada",
  expired: "Vencida",
};

const ORDER_SIDE_LABELS: Record<"buy" | "sell", string> = {
  buy: "Compra",
  sell: "Venta",
};

const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  processing: "En proceso",
  approved: "Aprobado",
  rejected: "Rechazado",
  completed: "Completado",
  failed: "Fallido",
};

const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviada",
  failed: "Fallida",
};

const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  trade_fill: "Prediccion ejecutada",
  order_cancelled: "Prediccion cancelada",
  market_closed: "Mercado cerrado",
  market_resolved: "Mercado resuelto",
  withdrawal_approved: "Retiro aprobado",
  withdrawal_rejected: "Retiro rechazado",
};

const MARKET_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  open: "Abierto",
  closed: "Cerrado",
  resolved: "Resuelto",
  archived: "Archivado",
};

const KYC_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  submitted: "En revision",
  verified: "Verificado",
  rejected: "Rechazado",
  requires_input: "Requiere informacion",
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  deposit: "Deposito",
  participation: "Participacion",
  payout: "Pago de mercado",
  withdrawal_requested: "Retiro solicitado",
  withdrawal_approved: "Retiro aprobado",
  withdrawal_rejected: "Retiro rechazado",
  admin_adjustment: "Ajuste administrativo",
  reversal: "Reversion",
};

const TRADE_ROLE_LABELS: Record<"maker" | "taker", string> = {
  maker: "Creador",
  taker: "Tomador",
};

export function labelOrderStatus(value: string) {
  return ORDER_STATUS_LABELS[value] ?? value;
}

export function labelOrderSide(value: "buy" | "sell") {
  return ORDER_SIDE_LABELS[value] ?? value;
}

export function labelWithdrawalStatus(value: string) {
  return WITHDRAWAL_STATUS_LABELS[value] ?? value;
}

export function labelNotificationStatus(value: string) {
  return NOTIFICATION_STATUS_LABELS[value] ?? value;
}

export function labelNotificationEvent(value: string) {
  return NOTIFICATION_EVENT_LABELS[value] ?? value;
}

export function labelMarketStatus(value: string) {
  return MARKET_STATUS_LABELS[value] ?? value;
}

export function labelKycStatus(value: string) {
  return KYC_STATUS_LABELS[value] ?? value;
}

export function labelMovementType(value: string) {
  return MOVEMENT_TYPE_LABELS[value] ?? value;
}

export function labelTradeRole(value: "maker" | "taker") {
  return TRADE_ROLE_LABELS[value] ?? value;
}
