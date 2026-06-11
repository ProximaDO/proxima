type PriceByOption = Map<string, number>;

interface HybridPricingParams {
  optionIds: string[];
  liquidityB: number;
  positionQtyByOption?: PriceByOption;
  lastTradePriceByOption?: PriceByOption;
  bestBidByOption?: PriceByOption;
  bestAskByOption?: PriceByOption;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalize(values: number[]) {
  const safe = values.map((v) => (Number.isFinite(v) && v >= 0 ? v : 0));
  const total = safe.reduce((acc, v) => acc + v, 0);
  if (total <= 0) {
    const fallback = safe.length > 0 ? 1 / safe.length : 0;
    return safe.map(() => fallback);
  }
  return safe.map((v) => v / total);
}

function computeLmsrProbabilities(optionIds: string[], liquidityB: number, positionQtyByOption: PriceByOption) {
  const b = Number.isFinite(liquidityB) && liquidityB > 0 ? liquidityB : 100;
  const scaled = optionIds.map((optionId) => (positionQtyByOption.get(optionId) ?? 0) / b);
  const maxScaled = scaled.reduce((acc, value) => Math.max(acc, value), Number.NEGATIVE_INFINITY);

  if (!Number.isFinite(maxScaled)) {
    const fallback = optionIds.length > 0 ? 1 / optionIds.length : 0;
    return optionIds.map(() => fallback);
  }

  const expValues = scaled.map((value) => Math.exp(value - maxScaled));
  return normalize(expValues);
}

export function computeHybridProbabilities(params: HybridPricingParams): Map<string, number> {
  const {
    optionIds,
    liquidityB,
    positionQtyByOption = new Map<string, number>(),
    lastTradePriceByOption = new Map<string, number>(),
    bestBidByOption = new Map<string, number>(),
    bestAskByOption = new Map<string, number>(),
  } = params;

  const output = new Map<string, number>();
  if (optionIds.length === 0) return output;

  const lmsr = computeLmsrProbabilities(optionIds, liquidityB, positionQtyByOption);
  const hybridRaw: number[] = [];

  for (let idx = 0; idx < optionIds.length; idx++) {
    const optionId = optionIds[idx];
    const lmsrPrice = clamp01(lmsr[idx] ?? 0);
    const lastTradeRaw = lastTradePriceByOption.get(optionId);
    const bidRaw = bestBidByOption.get(optionId);
    const askRaw = bestAskByOption.get(optionId);
    const lastTrade = lastTradeRaw !== undefined ? clamp01(lastTradeRaw) : Number.NaN;
    const bid = bidRaw !== undefined ? clamp01(bidRaw) : Number.NaN;
    const ask = askRaw !== undefined ? clamp01(askRaw) : Number.NaN;
    const mid = Number.isFinite(bid) && Number.isFinite(ask) ? clamp01((bid + ask) / 2) : Number.NaN;

    const candidates: Array<{ value: number; weight: number }> = [{ value: lmsrPrice, weight: 0.55 }];
    if (Number.isFinite(mid)) candidates.push({ value: mid, weight: 0.3 });
    if (Number.isFinite(lastTrade)) candidates.push({ value: lastTrade, weight: 0.15 });

    const totalWeight = candidates.reduce((acc, entry) => acc + entry.weight, 0);
    const hybridPrice =
      totalWeight > 0
        ? candidates.reduce((acc, entry) => acc + (entry.value * entry.weight) / totalWeight, 0)
        : lmsrPrice;

    hybridRaw.push(clamp01(hybridPrice));
  }

  const normalized = normalize(hybridRaw);
  for (let idx = 0; idx < optionIds.length; idx++) {
    output.set(optionIds[idx], normalized[idx] ?? 0);
  }

  return output;
}
