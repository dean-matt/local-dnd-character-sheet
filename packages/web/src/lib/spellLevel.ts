export const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

export const levelLabel = (level: number) => (level === 0 ? "Cantrips" : `${ORDINAL[level]} Level`);
