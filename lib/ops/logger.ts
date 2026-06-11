type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function emit(level: LogLevel, event: string, payload: LogPayload = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  };

  const message = JSON.stringify(entry);

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.log(message);
}

export const opsLogger = {
  info(event: string, payload?: LogPayload) {
    emit("info", event, payload);
  },
  warn(event: string, payload?: LogPayload) {
    emit("warn", event, payload);
  },
  error(event: string, payload?: LogPayload) {
    emit("error", event, payload);
  },
};
