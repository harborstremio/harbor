// SPDX-License-Identifier: GPL-3.0-or-later
// Separate, offline process. The host owns paths, backups and explicit commit; this engine only transforms bytes.
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using PKForge.Domain;
using PKForge.Engine;
using PKHeX.Core;

var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
json.Converters.Add(new JsonStringEnumConverter());
const int Limit = 48 * 1024 * 1024;
try {
    // Do not use ReadLine: reject oversized stdin before allocating an unbounded string.
    using var input = Console.OpenStandardInput();
    using var buffer = new MemoryStream();
    var chunk = new byte[8192];
    int count;
    while ((count = input.Read(chunk)) > 0) { if (buffer.Length + count > Limit) throw new InvalidDataException("Request too large"); buffer.Write(chunk, 0, count); }
    var request = JsonSerializer.Deserialize<Request>(buffer.ToArray(), json) ?? throw new InvalidDataException("Missing request");
    Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true });
    var engine = new SaveEngine();
    object response;
    if (request.Op == "version") response = new { protocol = 1, engine = "PKForge + PKHeX", revision = "58ba096c79d74f452d4dae74460af5e8d48b0c4e" };
    else if (request.Op == "entity") {
        var data = Decode(request.Entity);
        var info = engine.TryDescribeEntity(data, request.Name ?? "Pokémon", request.EntityFormat) ?? throw new InvalidDataException("Unrecognized Pokémon file");
        using var entitySession = engine.OpenEntitySession(data, request.Name, request.EntityFormat) ?? throw new InvalidDataException("Unsupported Pokémon format");
        response = new { info, detail = entitySession.ReadEntity(0, 0), image = Art(info.Look) };
    } else {
        var original = Decode(request.Data);
        if (original.Length > 16 * 1024 * 1024) throw new InvalidDataException("Save too large");
        using var session = engine.OpenSession(original, request.Name);
        var before = session.Snapshot;
        // These upstream exporters currently flatten hack-specific identity into PK3.
        // Keep in-save editing available, but never bank a silently altered Pokémon.
        var canExport = before.Format is not ("UNBOUND" or "RADICALRED" or "GSCHRONICLES");
        var risk = engine.AssessLayoutRisk(original);
        var slots = new List<SlotRef>();
        var changed = false;
        object? detail = null, exported = null, outcome = null;
        TransferPreview? transfer = null;
        EntityDetail? prior = null;
        if (request.Op is "edit" or "release" or "move" or "create") prior = session.ReadEntity(request.Box, request.Slot);
        if (request.Op == "import") { using var source = engine.OpenEntitySession(Decode(request.Entity), request.Name, request.EntityFormat); prior = source?.ReadEntity(0, 0); }
        object[] differences = [];
        if (request.Op is not ("inspect" or "detail" or "export") && risk is not null) throw new InvalidDataException(risk.Reason);
        switch (request.Op) {
            case "inspect": break;
            case "detail": detail = Describe(session, request.Box, request.Slot); break;
            case "export":
                if (!canExport) throw new InvalidDataException("pokemon_hack_export");
                exported = session.ExportSlot(request.Box, request.Slot); break;
            case "edit":
                session.ApplyEdit(request.Box, request.Slot, request.Edit ?? throw new InvalidDataException("Missing edit"));
                changed = true; slots.Add(new(request.Box, request.Slot)); break;
            case "move":
                session.MoveSlot(request.Box, request.Slot, request.ToBox, request.ToSlot);
                changed = true; slots.Add(new(request.Box, request.Slot)); slots.Add(new(request.ToBox, request.ToSlot)); break;
            case "release":
                session.ReleaseSlot(request.Box, request.Slot);
                changed = true; slots.Add(new(request.Box, request.Slot)); break;
            case "import":
                if (!session.ReadEntity(request.Box, request.Slot).IsEmpty) throw new InvalidDataException("Choose an empty slot");
                transfer = new TransferPreviewService(new LegalityService()).Preview(session, request.Box, request.Slot, Decode(request.Entity), request.EntityFormat);
                if (transfer is null) throw new InvalidDataException("This Pokémon cannot be imported into this game");
                changed = true; slots.Add(new(request.Box, request.Slot)); break;
            case "create":
                if (!session.ReadEntity(request.Box, request.Slot).IsEmpty) throw new InvalidDataException("Choose an empty slot");
                var generated = request.Creation is not null ? new LegalizerService().Generate(session, request.Box, request.Slot, request.Creation) : new LegalizerService().GenerateFromShowdown(session, request.Box, request.Slot, request.Showdown ?? "");
                if (!generated.Success) throw new InvalidDataException(generated.Message);
                outcome = generated; changed = true; slots.Add(new(request.Box, request.Slot)); break;
            default: throw new InvalidDataException("Unknown operation");
        }
        byte[]? candidate = null;
        if (changed) {
            candidate = session.Serialize().ToArray();
            if (!engine.Validate(candidate)) throw new InvalidDataException("Edited save failed validation");
            var refusal = engine.CheckWriteSafety(original, candidate, new WriteScope(slots));
            if (refusal is not null) throw new InvalidDataException(refusal);
            // Reopen serialized bytes: the preview reflects the exact candidate to be committed.
            using var verified = engine.OpenSession(candidate, request.Name);
            var after = verified.ReadEntity(request.Op == "move" ? request.ToBox : request.Box, request.Op == "move" ? request.ToSlot : request.Slot);
            detail = Describe(verified, after.Box, after.Slot);
            if (prior is not null) {
                var beforeJson = JsonSerializer.SerializeToElement(prior, json);
                var afterJson = JsonSerializer.SerializeToElement(after, json);
                differences = afterJson.EnumerateObject().Where(property => property.Name is not ("box" or "slot" or "look" or "traits") && beforeJson.TryGetProperty(property.Name, out var old) && old.GetRawText() != property.Value.GetRawText()).Select(property => (object)new { field = property.Name, before = beforeJson.GetProperty(property.Name).Clone(), after = property.Value.Clone() }).ToArray();
            }
        }
        var snapshot = session.Snapshot;
        response = new { protocol = 1, format = snapshot.Format, generation = snapshot.Generation, games = session.GameNames, trainer = session.GetTrainer(), slots = snapshot.Slots.Select(s => new { s.Box, s.Slot, s.Species, s.Nickname, s.IsShiny, s.IsEgg, s.Form, image = Art(s.Look) }), boxes = snapshot.Slots.Where(s => s.Box >= 0).Select(s => s.Box).Distinct().Select(box => new { id = box, name = session.GetBoxName(box) }).ToArray(), maxSpecies = session.MaxSpeciesId, canExport, canAnalyze = session.SupportsLegalityAnalysis, risk, detail, exported, outcome, transfer, candidate, differences, choices = request.Op == "detail" ? new { species = GameInfo.GetStrings("en").specieslist.Take(session.MaxSpeciesId + 1), moves = GameInfo.GetStrings("en").movelist, items = session.GetItemNames(), natures = GameInfo.GetStrings("en").natures, abilities = GameInfo.GetStrings("en").abilitylist, caps = session.GetTrainingCaps() } : null };
    }
    Console.Write(JsonSerializer.Serialize(new { ok = true, data = response }, json));
} catch (Exception error) {
    Console.Write(JsonSerializer.Serialize(new { ok = false, error = error.Message }, json));
    Environment.ExitCode = 1;
}
static byte[] Decode(string? value) {
    if (value is null || value.Length > 24 * 1024 * 1024) throw new InvalidDataException("Invalid save data");
    return Convert.FromBase64String(value);
}
static object Describe(ISaveEngineSession session, int box, int slot) {
    var entity = session.ReadEntity(box, slot);
    MetInfo? met = null;
    if (!entity.IsEmpty) {
        try { met = session.GetMetInfo(box, slot); }
        catch (NotSupportedException) { /* Optional origin fields are absent in some hack adapters. */ }
    }
    return new { entity, image = Art(entity.Look), legality = !entity.IsEmpty && session.SupportsLegalityAnalysis ? new LegalityService().Analyze(session, box, slot) : null, showdown = entity.IsEmpty ? "" : session.GetShowdownText(box, slot), met };
}
static string? Art(SpriteLook look) {
    if (look.Species <= 0) return null;
    if (SpriteCatalog.Home(look) is { } image) return SpritePack.RemoteRoot + "pokemon/other/home/" + image.Path;
    // ORAS costumes never reached HOME. The source catalog's exact PokeAPI IDs
    // also have static pixel art; keep these static for reduced-motion users.
    if (look is { Species: 25, Form: >= 1 and <= 6, Traits.Cosplay: true })
        return SpritePack.RemoteRoot + $"pokemon/{(look.Shiny ? "shiny/" : "")}{10079 + look.Form}.png";
    return null;
}
record Request(string Op, string? Data = null, string? Name = null, int Box = 0, int Slot = 0, int ToBox = 0, int ToSlot = 0, EntityEdit? Edit = null, string? Entity = null, string? EntityFormat = null, string? Showdown = null, GenerationRequest? Creation = null);
