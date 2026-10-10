export const WOW_EQUIPMENT_SLOTS = ["head", "neck", "shoulder", "back", "chest", "wrist", "hands", "waist", "legs", "feet", "finger1", "finger2", "trinket1", "trinket2", "mainhand", "offhand", "shirt", "tabard"] as const;
export type WowEquipmentSlot = typeof WOW_EQUIPMENT_SLOTS[number];
export type WowEnhancement = { id: number; name: string; image: string };
export type WowEnhancements = { items: WowEnhancement[]; complete: boolean };
export type WowEquipmentItem = WowEnhancement & { slot: WowEquipmentSlot; level: number | null; gems: WowEnhancements; enchants: WowEnhancements };
export type WowEquipment = { items: WowEquipmentItem[]; partial: boolean };
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const validId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) < 1_000_000_000;
const name = (value: unknown) => typeof value === "string" && value.trim().length <= 240 ? value.trim() : "";
export function wowEquipmentIcon(value: unknown): string {
  return typeof value === "string" && /^[a-zA-Z0-9_]{1,150}$/.test(value) ? `https://cdn.raiderio.net/images/wow/icons/large/${value}.jpg` : "";
}
function enhancements(details: unknown, ids: unknown): WowEnhancements {
  if (!Array.isArray(details) || details.length > 20) return { items: [], complete: false };
  const items = details.flatMap(value => {
    const item = object(value), title = name(item?.name);
    return item && validId(item.id) && title ? [{ id: item.id, name: title, image: wowEquipmentIcon(item.icon) }] : [];
  });
  // Enchant detail IDs identify the enchantment item, while `enchants` contains
  // spell-enchantment IDs. Compare coverage, never equate these different IDs.
  const complete = Array.isArray(ids) && ids.length <= 20 && ids.every(validId) && ids.length === details.length && items.length === details.length;
  return { items, complete };
}
export function parseWowEquipment(raw: unknown): WowEquipment | null {
  const value = object(raw);
  if (!value || Object.keys(value).length > 40) return null;
  let partial = Object.keys(value).some(key => !WOW_EQUIPMENT_SLOTS.includes(key as WowEquipmentSlot));
  const items: WowEquipmentItem[] = [];
  for (const slot of WOW_EQUIPMENT_SLOTS) {
    if (value[slot] == null) continue;
    const item = object(value[slot]), title = name(item?.name);
    if (!item || !validId(item.item_id) || !title) { partial = true; continue; }
    const level = Number.isSafeInteger(item.item_level) && Number(item.item_level) > 0 && Number(item.item_level) <= 10_000 ? Number(item.item_level) : null;
    if (level === null) partial = true;
    items.push({ slot, id: item.item_id, name: title, image: wowEquipmentIcon(item.icon), level,
      gems: enhancements(item.gems_detail, item.gems), enchants: enhancements(item.enchants_detail, item.enchants) });
  }
  return items.length ? { items, partial } : null;
}
