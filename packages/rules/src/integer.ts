/**
 * The guard every rules number shares: a sheet shows whole numbers, so this rejects a fraction
 * rather than rounding it somewhere a reader cannot see.
 */
export function assertInteger(label: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer, got ${value}`);
  }
}
