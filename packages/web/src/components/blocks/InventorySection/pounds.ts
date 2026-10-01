export const pounds = (value: number) =>
  `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} lb`;
