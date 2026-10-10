/** Original neutral scenes, never a claim to depict the event's actual venue. */
export function racingDefaultPhoto(league?: string): string {
  if (["NASCAR", "NXS", "NCTS", "ARCA"].includes(league || "")) return "racing-stockcar";
  if (["INDY", "INDYCAR"].includes(league || "")) return "racing-indycar";
  if (["MXGP", "SMX"].includes(league || "")) return "racing-motocross";
  if (["MOTOGP", "MOTO2", "MOTO3", "WORLDSBK", "WORLDSSP"].includes(league || ""))
    return "motorcycle";
  if (["WRC", "WORLDRX"].includes(league || "")) return "racing-rally";
  if (league === "DAKAR") return "racing-desert";
  if (league === "NHRA") return "racing-drag";
  if (["WEC", "IMSA", "DTM", "SUPERGT"].includes(league || "")) return "racing-endurance";
  return "racing-formula";
}
