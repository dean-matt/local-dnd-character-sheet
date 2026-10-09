/** Coins as the largest denomination that counts them whole: `5 gp`, `15 sp`. */
export function copperLabel(copper: number): string {
  if (copper % 100 === 0) return `${copper / 100} gp`;
  return copper % 10 === 0 ? `${copper / 10} sp` : `${copper} cp`;
}
