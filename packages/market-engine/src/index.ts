/**
 * Market-engine foundation.
 *
 * No pricing formula is implemented yet.
 * Fair value must be based on verified WarEra market data and tested
 * against real transaction/order-book behavior before becoming a signal.
 */

export interface MarketObservation {
  itemCode: string;
  observedAt: string;
  price: number;
  quantity: number;
}

export function isValidMarketObservation(
  observation: MarketObservation,
): boolean {
  return (
    observation.itemCode.trim().length > 0 &&
    Number.isFinite(observation.price) &&
    observation.price >= 0 &&
    Number.isFinite(observation.quantity) &&
    observation.quantity > 0
  );
}

