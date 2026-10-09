// Official English/Arabic club identities, verified 2026-09-13:
// https://www.spl.com.sa/en/teams and https://www.spl.com.sa/ar/teams
// ESPN IDs were matched against soccer/ksa.1/teams; these are search aliases, not invented roster entries.
const CLUBS: Record<string, readonly [english: string, arabic: string]> = {
  "21833": ["Abha", "أبها"],
  "8346": ["Al Ahli", "الأهلي"],
  "131746": ["Diriyah Club", "الدرعية"],
  "8363": ["Al Ettifaq", "الاتفاق"],
  "21446": ["Al Faisaly", "الفيصلي"],
  "13033": ["Al Fateh", "الفتح"],
  "21827": ["Al Fayha", "الفيحاء"],
  "21964": ["Al Hazem", "الحزم"],
  "929": ["Al Hilal", "الهلال"],
  "2276": ["Al Ittihad", "الاتحاد"],
  "21829": ["Al Khaleej", "الخليج"],
  "22028": ["Al Kholood", "الخلود"],
  "817": ["Al Nassr", "النصر"],
  "22022": ["Al Qadsiah", "القادسية"],
  "21965": ["Al Riyadh", "الرياض"],
  "793": ["Al Shabab", "الشباب"],
  "18459": ["Al Taawoun", "التعاون"],
  "130899": ["NEOM", "نيوم"],
};

export function saudiTeamAliases(leagueKey: string, teamId: string): readonly string[] {
  return leagueKey === "ROSHN" || leagueKey === "KINGSCUP" ? (CLUBS[teamId] ?? []) : [];
}
