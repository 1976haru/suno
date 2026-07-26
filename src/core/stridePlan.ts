const PRIME_STEPS = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function strideStepForLength(length: number): number {
  if (length <= 1) return 1;
  return PRIME_STEPS.find(step => gcd(step, length) === 1) ?? 1;
}

function positiveModulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

export function stridePick<T>(pool: readonly T[], index: number, offset = 0, step = strideStepForLength(pool.length)): T | undefined {
  if (!pool.length) return undefined;
  return pool[positiveModulo(index * step + offset, pool.length)];
}

export function buildStridePlan<T>(pool: readonly T[], count: number, offset = 0): T[] {
  if (!pool.length || count <= 0) return [];
  const step = strideStepForLength(pool.length);
  return Array.from({ length: count }, (_, index) => pool[positiveModulo(index * step + offset, pool.length)]);
}

export function repairAdjacentRepeats<T>(plan: T[]): T[] {
  if (plan.length <= 1) return plan;
  const unique = Array.from(new Set(plan));
  if (unique.length <= 1) return plan;

  for (let i = 1; i < plan.length; i++) {
    if (plan[i] !== plan[i - 1]) continue;
    const replacement = unique.find(candidate => candidate !== plan[i - 1]);
    if (replacement !== undefined) plan[i] = replacement;
  }
  return plan;
}
