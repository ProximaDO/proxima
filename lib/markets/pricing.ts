type QuantityByOption = Map<string, number>;

interface LmsrPricingParams {
  optionIds: string[];
  liquidityB: number;
  quantityByOption?: QuantityByOption;
}

function requireLiquidity(liquidityB: number) {
  if (!Number.isFinite(liquidityB) || liquidityB <= 0) {
    throw new Error("liquidityB must be a positive finite number");
  }
  return liquidityB;
}

function costFromQuantities(quantities: number[], liquidityB: number) {
  if (quantities.length === 0) return 0;

  const scaled = quantities.map((quantity) => quantity / liquidityB);
  const maxScaled = Math.max(...scaled);
  const expSum = scaled.reduce((sum, value) => sum + Math.exp(value - maxScaled), 0);

  return liquidityB * (maxScaled + Math.log(expSum));
}

export function computeLmsrProbabilities(params: LmsrPricingParams): Map<string, number> {
  const { optionIds, liquidityB, quantityByOption = new Map<string, number>() } = params;

  const output = new Map<string, number>();
  if (optionIds.length === 0) return output;

  const b = requireLiquidity(liquidityB);
  const scaled = optionIds.map((optionId) => (quantityByOption.get(optionId) ?? 0) / b);
  const maxScaled = Math.max(...scaled);
  const expValues = scaled.map((value) => Math.exp(value - maxScaled));
  const expSum = expValues.reduce((sum, value) => sum + value, 0);

  for (let idx = 0; idx < optionIds.length; idx++) {
    output.set(optionIds[idx], expValues[idx] / expSum);
  }

  return output;
}

export function computeLmsrBuyCost(params: LmsrPricingParams & { optionId: string; quantity: number }) {
  const { optionIds, optionId, quantity, quantityByOption = new Map<string, number>() } = params;
  const b = requireLiquidity(params.liquidityB);

  if (!optionIds.includes(optionId)) throw new Error("optionId is not part of the market");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("quantity must be positive");

  const current = optionIds.map((id) => quantityByOption.get(id) ?? 0);
  const updated = optionIds.map((id, index) => current[index] + (id === optionId ? quantity : 0));

  return costFromQuantities(updated, b) - costFromQuantities(current, b);
}

export function computeLmsrLiquidity(params: LmsrPricingParams) {
  const { optionIds, quantityByOption = new Map<string, number>() } = params;
  if (optionIds.length === 0) return 0;

  const b = requireLiquidity(params.liquidityB);
  const quantities = optionIds.map((id) => quantityByOption.get(id) ?? 0);
  const initialCost = b * Math.log(optionIds.length);

  return Math.max(0, costFromQuantities(quantities, b) - initialCost);
}
