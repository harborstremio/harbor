let playerInteractionLocked = false;

export function setPlayerInteractionLocked(locked: boolean): void {
  playerInteractionLocked = locked;
}

export function isPlayerInteractionLocked(): boolean {
  return playerInteractionLocked;
}
