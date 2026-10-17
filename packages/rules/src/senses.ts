/** The senses a race, feat or item grants a range in, in the order a sheet lists them. */
export const SENSES = ["blindsight", "darkvision", "tremorsense", "truesight"] as const;

export type Sense = (typeof SENSES)[number];
