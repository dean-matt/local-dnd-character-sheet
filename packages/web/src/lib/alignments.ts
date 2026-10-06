const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];

/**
 * The choices an alignment picker offers: None, which clears it, then the nine. The schema
 * keeps alignment free text for a setting's own, so a `current` value outside the nine
 * joins the list rather than reading as None.
 */
export function alignmentOptions(current: string): { value: string; label: string }[] {
  const custom = current !== "" && !ALIGNMENTS.includes(current);
  const values = custom ? [...ALIGNMENTS, current] : ALIGNMENTS;
  return [{ value: "", label: "None" }, ...values.map((value) => ({ value, label: value }))];
}
