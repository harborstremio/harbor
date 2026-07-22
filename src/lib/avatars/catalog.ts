export type AvatarItem = { id: string; name: string };
export type AvatarGroup = { group: string; items: AvatarItem[]; transparent?: boolean };

export const avatarUrl = (id: string): string => `/avatars/${id}.webp`;

export const AVATAR_CATALOG: AvatarGroup[] = [
  {
    group: "People",
    transparent: true,
    items: [
      { id: "harbor_person_01", name: "Person 1" },
      { id: "harbor_person_02", name: "Person 2" },
      { id: "harbor_person_03", name: "Person 3" },
      { id: "harbor_person_04", name: "Person 4" },
      { id: "harbor_person_05", name: "Person 5" },
      { id: "harbor_person_06", name: "Person 6" },
      { id: "harbor_person_07", name: "Person 7" },
      { id: "harbor_person_08", name: "Person 8" },
      { id: "harbor_person_09", name: "Person 9" },
      { id: "harbor_person_10", name: "Person 10" },
      { id: "harbor_person_11", name: "Person 11" },
      { id: "harbor_person_12", name: "Person 12" },
      { id: "harbor_person_13", name: "Person 13" },
      { id: "harbor_person_14", name: "Person 14" },
      { id: "harbor_person_15", name: "Person 15" },
      { id: "harbor_person_16", name: "Person 16" },
      { id: "harbor_person_17", name: "Person 17" },
    ],
  },
  {
    group: "Face",
    items: [
      { id: "harbor_face_01", name: "Red" },
      { id: "harbor_face_02", name: "Orange" },
      { id: "harbor_face_03", name: "Gold" },
      { id: "harbor_face_04", name: "Green" },
      { id: "harbor_face_05", name: "Teal" },
      { id: "harbor_face_06", name: "Blue" },
      { id: "harbor_face_07", name: "Indigo" },
      { id: "harbor_face_08", name: "Purple" },
      { id: "harbor_face_09", name: "Pink" },
      { id: "harbor_face_10", name: "Rose" },
      { id: "harbor_face_11", name: "Slate" },
      { id: "harbor_face_12", name: "Graphite" },
    ],
  },
  {
    group: "Misc",
    items: [
      { id: "harbor_misc_01", name: "Dreamer" },
      { id: "harbor_misc_02", name: "Rebel" },
      { id: "harbor_misc_03", name: "Techie" },
      { id: "harbor_misc_04", name: "Zen Master" },
      { id: "harbor_misc_05", name: "Ninja" },
      { id: "harbor_misc_06", name: "Robot" },
      { id: "harbor_misc_08", name: "Wizard" },
    ],
  },
  {
    group: "Animals",
    items: [
      { id: "harbor_animal_01", name: "Brave Lion" },
      { id: "harbor_animal_02", name: "Cheerful Koala" },
      { id: "harbor_animal_04", name: "Curious Raccoon" },
      { id: "harbor_animal_05", name: "Friendly Bear" },
      { id: "harbor_animal_06", name: "Happy Panda" },
      { id: "harbor_animal_07", name: "Magic Unicorn" },
      { id: "harbor_animal_08", name: "Mysterious Owl" },
    ],
  },
  {
    group: "Space",
    items: [
      { id: "harbor_space_01", name: "Nova" },
      { id: "harbor_space_02", name: "Satellite" },
      { id: "harbor_space_03", name: "Visitor" },
    ],
  },
  {
    group: "Elements",
    items: [
      { id: "harbor_element_01", name: "Earth" },
      { id: "harbor_element_02", name: "Fire" },
      { id: "harbor_element_03", name: "Electric" },
      { id: "harbor_element_04", name: "Water" },
    ],
  },
  {
    group: "Manga",
    items: [
      { id: "eboy_manga_eyes_bw_zoomed", name: "Manga Boy" },
      { id: "egirl_manga_eyes_bw_zoomed_distinct", name: "Manga Girl" },
    ],
  },
  {
    group: "Kawaii",
    items: [
      { id: "harbor_kawaii_01", name: "Grumpy" },
      { id: "harbor_kawaii_02", name: "Shocked" },
      { id: "harbor_kawaii_03", name: "Thinking" },
      { id: "harbor_kawaii_04", name: "Kiss" },
      { id: "harbor_kawaii_05", name: "Crying" },
      { id: "harbor_kawaii_06", name: "Sly" },
      { id: "harbor_kawaii_07", name: "Grin" },
      { id: "harbor_kawaii_08", name: "Smile" },
      { id: "harbor_kawaii_10", name: "Wink" },
    ],
  },
  {
    group: "Cats",
    items: [
      { id: "harbor_cat_01", name: "Flash Tabby" },
      { id: "harbor_cat_02", name: "Midnight Blep" },
      { id: "harbor_cat_03", name: "Cloud Grump" },
      { id: "harbor_cat_04", name: "Tiny Headset" },
    ],
  },
];

export const AVATAR_COUNT = AVATAR_CATALOG.reduce((n, g) => n + g.items.length, 0);

const KEPT_URLS = new Set(AVATAR_CATALOG.flatMap((g) => g.items.map((i) => avatarUrl(i.id))));

export function isRemovedBuiltinAvatar(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("/avatars/") && !KEPT_URLS.has(value);
}
