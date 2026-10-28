/** The option a homebrew Select offers for a field the entry leaves out. */
export const NOT_STATED = { value: "", label: "Not stated" };

/** A Select's options, with `current` added under its own spelling where none lists it. */
export function withCurrent(options: { value: string; label: string }[], current: string) {
  return options.some((option) => option.value === current)
    ? options
    : [...options, { value: current, label: current }];
}
