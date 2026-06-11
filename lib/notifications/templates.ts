type NotificationTemplate = {
  subject: string;
  text: string;
  html: string;
};

function money(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(value);
}

function pct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

type NotificationEventType =
  | "trade_fill"
  | "order_cancelled"
  | "market_closed"
  | "market_resolved"
  | "withdrawal_approved"
  | "withdrawal_rejected";

export function buildNotificationTemplate(
  eventType: NotificationEventType,
  payload: Record<string, unknown>,
): NotificationTemplate {
  if (eventType === "trade_fill") {
    const role = String(payload.role ?? "usuario");
    const side = String(payload.side ?? "buy");
    const marketTitle = String(payload.market_title ?? "Mercado");
    const optionLabel = String(payload.option_label ?? "Opcion");
    const quantity = Number(payload.quantity ?? 0);
    const price = Number(payload.price ?? 0);
    const notional = Number(payload.notional ?? quantity * price);

    const subject = `Trade ejecutado en ${marketTitle}`;
    const text = [
      `Tu orden tuvo ejecucion parcial o total.`,
      `Mercado: ${marketTitle}`,
      `Opcion: ${optionLabel}`,
      `Rol: ${role}`,
      `Lado: ${side}`,
      `Precio: ${pct(price)}`,
      `Cantidad: ${quantity.toFixed(2)}`,
      `Notional: ${money(notional)}`,
    ].join("\n");

    const html = `<p>Tu orden tuvo ejecucion parcial o total.</p>
      <ul>
        <li><strong>Mercado:</strong> ${marketTitle}</li>
        <li><strong>Opcion:</strong> ${optionLabel}</li>
        <li><strong>Rol:</strong> ${role}</li>
        <li><strong>Lado:</strong> ${side}</li>
        <li><strong>Precio:</strong> ${pct(price)}</li>
        <li><strong>Cantidad:</strong> ${quantity.toFixed(2)}</li>
        <li><strong>Notional:</strong> ${money(notional)}</li>
      </ul>`;

    return { subject, text, html };
  }

  if (eventType === "order_cancelled") {
    const marketTitle = String(payload.market_title ?? "Mercado");
    const optionLabel = String(payload.option_label ?? "Opcion");
    const side = String(payload.side ?? "buy");
    const limitPrice = Number(payload.limit_price ?? 0);
    const quantity = Number(payload.quantity ?? 0);
    const quantityFilled = Number(payload.quantity_filled ?? 0);

    const subject = `Orden cancelada en ${marketTitle}`;
    const text = [
      `Se confirmo la cancelacion de tu orden.`,
      `Mercado: ${marketTitle}`,
      `Opcion: ${optionLabel}`,
      `Lado: ${side}`,
      `Precio limite: ${pct(limitPrice)}`,
      `Cantidad: ${quantity.toFixed(2)}`,
      `Cantidad ejecutada: ${quantityFilled.toFixed(2)}`,
    ].join("\n");

    const html = `<p>Se confirmo la cancelacion de tu orden.</p>
      <ul>
        <li><strong>Mercado:</strong> ${marketTitle}</li>
        <li><strong>Opcion:</strong> ${optionLabel}</li>
        <li><strong>Lado:</strong> ${side}</li>
        <li><strong>Precio limite:</strong> ${pct(limitPrice)}</li>
        <li><strong>Cantidad:</strong> ${quantity.toFixed(2)}</li>
        <li><strong>Cantidad ejecutada:</strong> ${quantityFilled.toFixed(2)}</li>
      </ul>`;

    return { subject, text, html };
  }

  if (eventType === "market_closed") {
    const marketTitle = String(payload.market_title ?? "Mercado");
    const subject = `Mercado cerrado: ${marketTitle}`;
    const text = [
      `El mercado ${marketTitle} fue cerrado para nuevas ordenes.`,
      `Revisa tu dashboard para ver estado de posiciones y ordenes restantes.`,
    ].join("\n");

    const html = `<p>El mercado <strong>${marketTitle}</strong> fue cerrado para nuevas ordenes.</p>
      <p>Revisa tu dashboard para ver estado de posiciones y ordenes restantes.</p>`;

    return { subject, text, html };
  }

  if (eventType === "withdrawal_approved") {
    const amount = Number(payload.amount ?? 0);
    const externalReference = payload.external_reference ? String(payload.external_reference) : null;
    const adminNote = payload.admin_note ? String(payload.admin_note) : null;

    const subject = "Retiro aprobado";
    const text = [
      "Tu solicitud de retiro fue aprobada.",
      `Monto: ${money(amount)}`,
      externalReference ? `Referencia externa: ${externalReference}` : null,
      adminNote ? `Nota administrativa: ${adminNote}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const html = `<p>Tu solicitud de retiro fue aprobada.</p>
      <ul>
        <li><strong>Monto:</strong> ${money(amount)}</li>
        ${externalReference ? `<li><strong>Referencia externa:</strong> ${externalReference}</li>` : ""}
        ${adminNote ? `<li><strong>Nota administrativa:</strong> ${adminNote}</li>` : ""}
      </ul>`;

    return { subject, text, html };
  }

  if (eventType === "withdrawal_rejected") {
    const amount = Number(payload.amount ?? 0);
    const rejectionReason = payload.rejection_reason ? String(payload.rejection_reason) : "No especificado";
    const adminNote = payload.admin_note ? String(payload.admin_note) : null;

    const subject = "Retiro rechazado";
    const text = [
      "Tu solicitud de retiro fue rechazada.",
      `Monto: ${money(amount)}`,
      `Motivo: ${rejectionReason}`,
      adminNote ? `Nota administrativa: ${adminNote}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const html = `<p>Tu solicitud de retiro fue rechazada.</p>
      <ul>
        <li><strong>Monto:</strong> ${money(amount)}</li>
        <li><strong>Motivo:</strong> ${rejectionReason}</li>
        ${adminNote ? `<li><strong>Nota administrativa:</strong> ${adminNote}</li>` : ""}
      </ul>`;

    return { subject, text, html };
  }

  const marketTitle = String(payload.market_title ?? "Mercado");
  const winner = String(payload.winning_option_label ?? "Opcion ganadora");
  const subject = `Mercado resuelto: ${marketTitle}`;
  const text = [
    `El mercado ${marketTitle} ya fue resuelto.`,
    `Opcion ganadora: ${winner}`,
    `Revisa tu dashboard para confirmar el resultado y movimientos de wallet.`,
  ].join("\n");

  const html = `<p>El mercado <strong>${marketTitle}</strong> ya fue resuelto.</p>
    <p><strong>Opcion ganadora:</strong> ${winner}</p>
    <p>Revisa tu dashboard para confirmar el resultado y movimientos de wallet.</p>`;

  return { subject, text, html };
}
