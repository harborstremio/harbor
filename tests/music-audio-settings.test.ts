import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMusicAudio,
  clampMusicVolume,
  musicVolumeCeiling,
  saveMusicAudioSettings,
  getMusicAudioSettingsSnapshot,
} from "../src/lib/music/audio-settings.ts";

test("audio defaults are neutral and boost requires affirmative enablement", () => {
  assert.deepEqual(normalizeMusicAudio(null), {
    device: "auto",
    eqEnabled: false,
    eqBands: Array(10).fill(0),
    boostEnabled: false,
    volumeLimit: 1,
    balance: 0,
    autoHeadroom: true,
    equipmentLabel: "",
    replayGain: "off",
    eqMode: "graphic",
    peqFilters: [],
    eqStrength: 1,
    preampDb: 0,
    crossfeed: 0,
    dspBypass: false,
    exclusive: false,
    sampleRate: 0,
  });
  assert.equal(normalizeMusicAudio({ volumeLimit: 5 }).volumeLimit, 1);
  const value = normalizeMusicAudio({
    boostEnabled: true,
    volumeLimit: 99,
    eqBands: [-99, 99, NaN],
    device: "bad\0device",
  });
  assert.equal(value.volumeLimit, 5);
  assert.equal(value.device, "auto");
  assert.deepEqual(value.eqBands.slice(0, 4), [-12, 12, 0, 0]);
});

test("ceiling changes never send a volume increase and Spotify stays at unity", async () => {
  const calls: string[] = [];
  let fail = false;
  (globalThis as any).window = {
    __TAURI_INTERNALS__: {
      invoke: async (command: string, args: any) => {
        calls.push(command);
        if (fail) throw new Error("Storage unavailable");
        return args.settings;
      },
    },
  };
  await saveMusicAudioSettings(normalizeMusicAudio({ boostEnabled: true, volumeLimit: 5 }));
  assert.equal(musicVolumeCeiling(), 5);
  assert.equal(musicVolumeCeiling("spotify"), 1);
  assert.equal(clampMusicVolume(9), 5);
  assert.equal(clampMusicVolume(9, "spotify"), 1);
  assert.equal(clampMusicVolume(NaN), 0.82);
  assert.deepEqual(calls, ["music_audio_settings_set"]);
  fail = true;
  await assert.rejects(saveMusicAudioSettings(normalizeMusicAudio(null)));
  assert.equal(getMusicAudioSettingsSnapshot().settings.volumeLimit, 5);
  assert.equal(getMusicAudioSettingsSnapshot().error, true);
  fail = false;
  await saveMusicAudioSettings(normalizeMusicAudio(null));
  assert.equal(musicVolumeCeiling(), 1);
});
