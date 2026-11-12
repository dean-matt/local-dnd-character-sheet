/** Whether a hit point maximum term is one level's, which `maxHitPoints` labels `Level N:`. */
export const isLevelTerm = ({ label }: { label: string }) => /^Level \d+:/.test(label);
