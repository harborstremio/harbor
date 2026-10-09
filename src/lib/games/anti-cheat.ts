import { safeFetchBytes } from "@/lib/safe-fetch";
import { createGameAntiCheatLoader } from "./anti-cheat-source";

export const loadGameAntiCheat = createGameAntiCheatLoader(safeFetchBytes);
