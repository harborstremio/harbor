/** Interpret only explicitly labelled promoter records; preserve unfamiliar formats verbatim. */
export function boxingRecord(record: string | undefined) {
  if (!record) return null;
  const values = new Map<string, string>();
  for (const part of record.split(/\s*·\s*/)) {
    const match = /^(W|L|D|KO)\s+(\d{1,3})$/i.exec(part.trim());
    if (!match || values.has(match[1].toUpperCase())) return null;
    values.set(match[1].toUpperCase(), match[2]);
  }
  if (!["W", "L", "D"].every((key) => values.has(key))) return null;
  return ([
    ["W", "sports.boxing.wins"],
    ["L", "sports.boxing.losses"],
    ["D", "sports.boxing.draws"],
    ["KO", "sports.boxing.knockouts"],
  ] as const).flatMap(([key, label]) => values.has(key) ? [{ label, value: values.get(key)! }] : []);
}
