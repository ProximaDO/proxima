export const RD_TIME_ZONE = "America/Santo_Domingo";
export const DAILY_MARKET_CLOSE_MINUTES = 16 * 60 + 30;
export const DAILY_MARKET_RESOLUTION_MINUTES = 17 * 60 + 30;
export const DAILY_FX_MARKET_SLUG = "daily-fx-usd-venta";

export type RdNowParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  isoDate: string;
  labelDate: string;
  minutesOfDay: number;
};

export function getRdNowParts(reference = new Date()): RdNowParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: RD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(reference);
  const getValue = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? "0");

  const year = getValue("year");
  const month = getValue("month");
  const day = getValue("day");
  const hour = getValue("hour");
  const minute = getValue("minute");

  return {
    year,
    month,
    day,
    hour,
    minute,
    isoDate: `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    labelDate: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String(year)}`,
    minutesOfDay: hour * 60 + minute,
  };
}

export function rdLocalToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const utcMs = Date.UTC(year, month - 1, day, hour + 4, minute, 0);
  return new Date(utcMs).toISOString();
}

export function getDailyMarketWindowUtc(isoDate: string) {
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  return {
    opensAt: rdLocalToUtcIso(year, month, day, 0, 0),
    closesAt: rdLocalToUtcIso(year, month, day, 16, 30),
  };
}

export function buildDailyFxSlug() {
  return DAILY_FX_MARKET_SLUG;
}

export function buildDailyFxTitle(labelDate: string) {
  return `USD/Venta cierre ${labelDate}: ¿Sube o baja?`;
}
