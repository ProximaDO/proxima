const BCRD_BASE_URL = "https://bancentral.gov.do";
const HISTORIC_PAGE = "/SectorExterno/HistoricoTasas";
const HISTORIC_API = "/Home/GetHistoricalExchangeRates";
const ACTUAL_API = "/Home/GetActualExchangeRate";

const REQUEST_HEADERS = {
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
};

export type BcrdDailyRate = {
  date: string;
  label: string;
  purchase: number;
  selling: number;
};

function toIsoDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

async function getSessionCookie(): Promise<string> {
  const response = await fetch(`${BCRD_BASE_URL}${HISTORIC_PAGE}`, {
    headers: REQUEST_HEADERS,
    cache: "no-store",
  });

  const cookie = response.headers.get("set-cookie") ?? "";
  const pairs = cookie.match(/[A-Za-z0-9_\-]+=([^;,"]+|"[^"]*")/g) ?? [];
  return pairs.join("; ");
}

async function postBcrd<T>(path: string, body: URLSearchParams): Promise<T> {
  const cookie = await getSessionCookie();
  const response = await fetch(`${BCRD_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...REQUEST_HEADERS,
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      origin: BCRD_BASE_URL,
      referer: `${BCRD_BASE_URL}${HISTORIC_PAGE}`,
      cookie,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`BCRD request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

type HistoricalResponse = {
  result?: {
    items?: Array<{
      date: string;
      statisticDataGroupName: string;
      purchaseValue: number;
      sellingValue: number;
    }>;
  };
};

type ActualResponse = {
  result?: {
    date: string;
    actualSellingValue: number;
    actualPurchaseValue: number;
  };
};

export async function fetchBcrdDailyHistory(from: string | Date, to: string | Date) {
  const payload = new URLSearchParams({
    fromDate: `${toIsoDate(from)}T00:00:00.000Z`,
    toDate: `${toIsoDate(to)}T00:00:00.000Z`,
    purchaseColumnOrder: "asc",
    sellingColumnOrder: "asc",
    dateColumnOrder: "asc",
    isForReporting: "false",
  });

  const output = await postBcrd<HistoricalResponse>(HISTORIC_API, payload);
  const items = output.result?.items ?? [];

  return items.map((item) => ({
    date: item.date,
    label: item.statisticDataGroupName,
    purchase: Number(item.purchaseValue ?? 0),
    selling: Number(item.sellingValue ?? 0),
  })) as BcrdDailyRate[];
}

export async function fetchBcrdActualRate() {
  const output = await postBcrd<ActualResponse>(ACTUAL_API, new URLSearchParams());
  const result = output.result;

  if (!result) {
    return null;
  }

  return {
    date: result.date,
    selling: Number(result.actualSellingValue ?? 0),
    purchase: Number(result.actualPurchaseValue ?? 0),
  };
}
