// SPDX-License-Identifier: GPL-3.0-or-later
using PKHeX.Core;
using System.Buffers.Binary;
var output = args[0]; Directory.CreateDirectory(output);
foreach (var version in new[] { GameVersion.RD, GameVersion.GD, GameVersion.C, GameVersion.B, GameVersion.W2, GameVersion.E, GameVersion.Pt, GameVersion.AS, GameVersion.SW, GameVersion.BD, GameVersion.SL }) {
    SaveFile save;
    if (version == GameVersion.E) {
        var raw = new byte[0x20000];
        for (var sector = 0; sector < 14; sector++) {
            var offset = sector * 0x1000;
            BinaryPrimitives.WriteUInt16LittleEndian(raw.AsSpan(offset + 0xFF4), (ushort)sector);
            BinaryPrimitives.WriteUInt32LittleEndian(raw.AsSpan(offset + 0xFF8), 0x08012025);
            BinaryPrimitives.WriteUInt32LittleEndian(raw.AsSpan(offset + 0xFFC), 1);
        }
        BinaryPrimitives.WriteUInt32LittleEndian(raw.AsSpan(0xAC), 0x0FCA0FCC); raw[0x900] = 1;
        uint sum = 0; for (var i = 0; i < 0xF80; i += 4) sum += BinaryPrimitives.ReadUInt32LittleEndian(raw.AsSpan(i));
        BinaryPrimitives.WriteUInt16LittleEndian(raw.AsSpan(0xFF6), (ushort)(sum + (sum >> 16)));
        raw.AsSpan(0xE000).Fill(0xFF); save = new SAV3E(raw);
    } else if (version == GameVersion.Pt) {
        var raw = new byte[0x80000];
        foreach (var half in new[] { 0, 0x40000 }) {
            BinaryPrimitives.WriteUInt32LittleEndian(raw.AsSpan(half + SAV4Pt.GeneralSize - 0xC), SAV4Pt.GeneralSize);
            BinaryPrimitives.WriteUInt32LittleEndian(raw.AsSpan(half + SAV4Pt.GeneralSize - 0x8), SAV4.MAGIC_JAPAN_INTL);
        }
        save = new SAV4Pt(raw);
    }
    else save = BlankSaveFile.Get(version, "HARBOR", LanguageID.English);
    if (version == GameVersion.AS) BinaryPrimitives.WriteUInt32LittleEndian(save.Data[^0x1F0..], 0x42454546);
    var mon = save.BlankPKM; mon.Species = 25; mon.Version = version; mon.Language = 2;
    mon.OriginalTrainerName = "HARBOR"; mon.Nickname = "Pikachu"; mon.CurrentLevel = 20;
    mon.PID = 0x12345678; mon.TID16 = 1234; mon.Move1 = 84; mon.Ball = 4; mon.RefreshChecksum();
    save.SetBoxSlotAtIndex(mon, 0, 0, EntityImportSettings.None);
    if(save.Generation<=2){save.SetPartySlotAtIndex(mon,0,EntityImportSettings.None);}
    File.WriteAllBytes(Path.Combine(output, $"{version}.sav"), save.Write().ToArray());
    Console.WriteLine(version);
}
foreach (var (name, mon) in new (string, PKM)[] {
    ("Raichu-Alola", new PK7 { Species = 26, Form = 1, Version = GameVersion.SN, Language = 2 }),
    ("Rotom-Wash", new PK6 { Species = 479, Form = 2, Version = GameVersion.AS, Language = 2 }),
    ("Pikachu-Rock-Star", new PK6 { Species = 25, Form = 1, Version = GameVersion.AS, Language = 2 }),
}) {
    mon.Nickname = name; mon.CurrentLevel = 25; mon.RefreshChecksum();
    var bytes = new byte[mon.SIZE_PARTY]; mon.WriteDecryptedDataParty(bytes);
    File.WriteAllBytes(Path.Combine(output, name + "." + mon.GetType().Name.ToLowerInvariant()), bytes);
}
