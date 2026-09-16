/**
 * The guard `armorclass` and `weapon` share, where an integer check stands alone. A sheet
 * shows whole numbers, so this rejects a fraction rather than rounding it somewhere a
 * reader cannot see. Elsewhere in the package a check pairs with a range and states both
 * in one message.
 */
export function assertInteger(label: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} must be an integer, got ${value}`);
  }
}
