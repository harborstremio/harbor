export const ARABIC_SRT = "1\n00:00:01,000 --> 00:00:03,000\nسلام\n";

export const ARABIC_ASS = `[Script Info]
Title: Arabic style preservation
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, Bold
Style: Default,Vazirmatn,48,&H00FFFFFF,-1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,Speaker,0,0,20,,{\\an8}مرحباً
Dialogue: 0,0:00:04.00,0:00:06.00,Default,Speaker,0,0,20,karaoke,{\\k20}بالعالم
`;

const ASCII_PREFIX = [..."1\n00:00:01,000 --> 00:00:03,000\n"].map((character) =>
  character.charCodeAt(0),
);

export const WINDOWS_1256_ARABIC_SRT = new Uint8Array([
  ...ASCII_PREFIX,
  0xd3,
  0xe1,
  0xc7,
  0xe3,
  0x0a,
]);

export const ISO_8859_6_ARABIC_SRT = new Uint8Array([
  ...ASCII_PREFIX,
  0xd3,
  0xe4,
  0xc7,
  0xe5,
  0x0a,
]);

export const ISO_8859_6_ARABIC_PHRASE_SRT = new Uint8Array([
  ...ASCII_PREFIX,
  0xe5,
  0xd1,
  0xcd,
  0xc8,
  0xc7,
  0x20,
  0xc8,
  0xc7,
  0xe4,
  0xd9,
  0xc7,
  0xe4,
  0xe5,
  0x0a,
]);

function bytesFromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export const ISO_8859_6_ARABIC_DIALOGUE_SRT = bytesFromBase64(
  "MQowMDowMDowMSwwMDAgLS0+IDAwOjAwOjAzLDAwMArj6uEgzcfk4yDH5Oro5b8KCjIKMDA6MDA6MDQsMDAwIC0tPiAwMDowMDowNiwwMDAK5+QgytPK1+rZIMPmIMrOyNHm6iDlx9DHIM3Py78K",
);

export const ISO_8859_6_ARABIC_DIALOGUE_TWO_SRT = bytesFromBase64(
  "MQowMDowMDowMSwwMDAgLS0+IDAwOjAwOjAzLDAwMArF5ucgw+XRINXZyCDo5OPmINnk6ubHIMfk5c3H6OTJCgoyCjAwOjAwOjA0LDAwMCAtLT4gMDA6MDA6MDYsMDAwCtTj0ccg5OMg2eTpIOPkIOXHIOHZ5MrnIOXmIMPM5OoK",
);

export function utf16WithBom(text: string, littleEndian: boolean): Uint8Array {
  const bytes: number[] = littleEndian ? [0xff, 0xfe] : [0xfe, 0xff];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (littleEndian) bytes.push(code & 0xff, code >> 8);
    else bytes.push(code >> 8, code & 0xff);
  }
  return new Uint8Array(bytes);
}

export const TARGET_CUES = Array.from({ length: 18 }, (_, index) => {
  const start = index * 5 + 2;
  return {
    start,
    end: start + 2 + (index % 3) * 0.25,
    text: index === 7 ? "موعدنا الساعة 12؟" : `الجملة العربية ${index + 1}`,
  };
});

export const PIVOT_CUES = TARGET_CUES.map((cue, index) => ({
  start: cue.start + 2.4,
  end: cue.end + 2.4,
  text: index === 7 ? "Meet me at 12?" : `English dialogue ${index + 1}`,
}));

export const TARGET_WITH_MISSING_INTRO = TARGET_CUES.slice(3);

export const PIVOT_WITH_EXTRA_RECAP = [
  { start: 0, end: 0.9, text: "Previously" },
  { start: 1.1, end: 2, text: "A short recap" },
  ...PIVOT_CUES,
];
