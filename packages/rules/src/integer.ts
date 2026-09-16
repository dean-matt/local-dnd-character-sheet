/**
 * The guard every standalone integer check in the package shares. A sheet shows whole
 * numbers, so this rejects a fraction rather than rounding it somewhere a reader cannot
 * see. A check that also bounds a range states both in one message and stays where it is.
 */
export function assertInteger(label: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer, got ${value}`);
  }
}
