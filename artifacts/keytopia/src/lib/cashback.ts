export const CASHBACK_RATE = 0.05;

export function calculateCashback(amount: number): number {
  return Math.round(amount * CASHBACK_RATE * 100) / 100;
}