import test from "node:test";
import assert from "node:assert/strict";
import { minecraftArt, minecraftCatalogUrl, minecraftCatalogVersions, minecraftLink, minecraftProject, minecraftProjects, minecraftProjectUrl, minecraftVersions, minecraftPreferredVersion, minecraftReviewableVersion, minecraftReleaseNotes } from "../src/lib/games/minecraft-catalog.ts";

test("search retains loader and follow data even when display categories omit it", () => {
  const hit = minecraftProjects({ total_hits: 1, hits: [{ project_id: "pack", project_type: "modpack", title: "Pack", categories: ["fabric", "optimization", "quilt", "babric"], display_categories: ["optimization", "babric"], follows: 42, versions: ["1.21.1", "1.20.1", "1.21.1"] }] }).hits[0];
  assert.deepEqual(hit.loaders, ["fabric", "quilt", "babric"]);
  assert.deepEqual(hit.categories, ["optimization"]);
  assert.equal(hit.followers, 42);
  assert.deepEqual(hit.versions, ["1.21.1", "1.20.1"]);
  const detail = minecraftProject({ id: "pack", project_type: "modpack", title: "Pack", versions: ["releaseId"], loaders: ["forge"], followers: 8 });
  assert.deepEqual(detail.versions, []);
  assert.deepEqual(detail.loaders, ["forge"]);
  assert.equal(detail.followers, 8);
});

test("catalog compatibility shows exact numeric releases, prioritizes a selected version and retains previews", () => {
  const versions = ["1.21.9", "1.20.1", "1.21.11", "1.21.9", "26.1-snapshot-1", "26.1"];
  assert.deepEqual(minecraftCatalogVersions(versions), ["26.1", "1.21.11", "1.21.9", "1.20.1", "26.1-snapshot-1"]);
  assert.equal(minecraftCatalogVersions(versions, "1.20.1")[0], "1.20.1");
  assert.ok(!minecraftCatalogVersions(versions, "1.18.2").includes("1.18.2"));
  assert.equal(versions.length, 6);
  const longHistory = Array.from({ length: 240 }, (_, index) => `1.16-pre${index}`);
  const result = minecraftProjects({ total_hits: 1, hits: [{ project_id: "longHistory", project_type: "mod", title: "Long running project", versions: [...longHistory, "1.21.11", "26.3"] }] });
  assert.deepEqual(result.hits[0].versions.slice(0, 2), ["26.3", "1.21.11"]);
});

test("browsing all versions does not impose an empty version or Fabric-only filter", () => {
  const url = minecraftCatalogUrl({ kind: "search", type: "modpack" });
  assert.deepEqual(JSON.parse(url.searchParams.get("facets")!), [["project_type:modpack"]]);
  const shader = minecraftCatalogUrl({ kind: "search", type: "shader", loader: "iris", game: "1.21.1", category: "realistic", offset: 24 });
  assert.deepEqual(JSON.parse(shader.searchParams.get("facets")!), [["project_type:shader"], ["categories:iris"], ["versions:1.21.1"], ["categories:realistic"]]);
  assert.equal(shader.searchParams.get("offset"), "24");
  for (const params of [{ kind: "project", query: "../../private" }, { kind: "search", category: 'bad"category' }, { kind: "search", loader: "custom" }, { kind: "search", offset: -1 }]) assert.throws(() => minecraftCatalogUrl(params as never));
});
test("project identities and images are provider data, never generic fallback records", () => {
  const data = minecraftProjects({ total_hits: 500, hits: [{ project_id: "actual123", project_type: "shader", title: "Shader project", icon_url: "https://cdn.modrinth.com/icon.png", gallery: ["javascript:bad", "https://cdn.modrinth.com/scene.webp"], featured_gallery: "https://untrusted.test/image", versions: ["1.21.1"] }, { project_id: "../evil", project_type: "mod", title: "Wrong" }, { project_id: "other", project_type: "movie", title: "Wrong type" }] });
  assert.equal(data.total, 500); assert.equal(data.hits.length, 1); assert.equal(data.hits[0].art, "https://cdn.modrinth.com/scene.webp");
  assert.equal(minecraftProjectUrl(data.hits[0], "release123"), "https://modrinth.com/shader/actual123/version/release123");
  assert.throws(() => minecraftProjects({ message: "outage" }));
});
test("project detail preserves gallery priority, license and useful safe links", () => {
  const detail = minecraftProject({ id: "abc123", project_type: "modpack", title: "Pack", body: "# Description", license: { id: "MIT", name: "MIT License" }, source_url: "https://github.com/example/project", issues_url: "file:///C:/local", gallery: [{ url: "https://cdn.modrinth.com/2.png", title: "Other", ordering: 0 }, { url: "https://cdn.modrinth.com/1.png", title: "Featured", featured: true }] });
  assert.equal(detail.gallery[0].title, "Featured"); assert.equal(detail.license, "MIT License"); assert.deepEqual(detail.links.map(v => v.title), ["source"]);
  assert.equal(minecraftLink("javascript:alert(1)"), ""); assert.equal(minecraftLink("https://user:secret@host.test/"), ""); assert.equal(minecraftArt("https://cdn.modrinth.com.evil.test/image"), "");
  const originals = minecraftProject({ id: "gallery", project_type: "mod", title: "Gallery", gallery: [{ url: "https://cdn.modrinth.com/thumb.webp", raw_url: "https://cdn.modrinth.com/original.png" }, { url: "https://cdn.modrinth.com/fallback.webp", raw_url: "https://untrusted.test/image.png" }] });
  assert.deepEqual(originals.gallery.map(v => v.url), ["https://cdn.modrinth.com/original.png", "https://cdn.modrinth.com/fallback.webp"]);
});
test("versions distinguish required dependencies and only report an identified primary file", () => {
  const [version] = minecraftVersions([{ id: "version1", version_number: "2.0", files: [{ filename: "server.jar", size: 700 }, { filename: "client.jar", size: 300, primary: true }], game_versions: ["1.21.1"], loaders: ["fabric"], dependencies: [{ dependency_type: "required" }, { dependency_type: "optional" }] }]);
  assert.equal(version.bytes, 300); assert.equal(version.filename, "client.jar"); assert.equal(version.dependencies, 1); assert.deepEqual(version.games, ["1.21.1"]);
  assert.throws(() => minecraftVersions({ error: "unavailable" }));
});

test("release selection follows dates, prefers a final release and preserves an explicit preview choice", () => {
  const versions = minecraftVersions([
    { id: "old", version_number: "1.0", version_type: "release", date_published: "2025-01-01" },
    { id: "preview", version_number: "3.0-beta", version_type: "beta", date_published: "2026-05-01" },
    { id: "stable", version_number: "2.0", version_type: "release", date_published: "2026-01-01" },
  ]);
  assert.deepEqual(versions.map(v => v.id), ["preview", "stable", "old"]);
  assert.equal(minecraftPreferredVersion(versions)?.id, "stable");
  assert.equal(minecraftPreferredVersion(versions, "preview")?.id, "preview");
  assert.equal(minecraftPreferredVersion(versions, "removed-by-filter")?.id, "stable");
  assert.equal(minecraftPreferredVersion([versions[0]])?.id, "preview");
  assert.equal(minecraftPreferredVersion([]), null);
});

test("dependency previews retain declared relation and exact identities without guessing unknown project names", () => {
  const [version] = minecraftVersions([{ id: "release", version_number: "1", dependencies: [
    { project_id: "actualProject", version_id: "exactRelease", dependency_type: "required" },
    { project_id: "../wrong", file_name: "external-mod.jar", dependency_type: "optional" },
    { project_id: "conflict", dependency_type: "incompatible" }, { version_id: "bundledRelease", dependency_type: "embedded" }, { dependency_type: "invented" },
  ] }]);
  assert.equal(version.dependencyCount, 4);assert.equal(version.dependencies, 1);
  assert.deepEqual(version.dependencyRefs[0], { project: "actualProject", version: "exactRelease", filename: "", type: "required" });
  assert.equal(version.dependencyRefs[1].project, "");assert.equal(version.dependencyRefs[1].filename, "external-mod.jar");assert.equal(version.dependencyRefs[3].version, "bundledRelease");
});

test("modpack review requires one identified archive and provider filtering stays explicit", () => {
  const base = { id: "pack", version_number: "1" };
  const [valid, ambiguous, wrong, missing] = minecraftVersions([
    { ...base, files: [{ primary: true, filename: "Pack.MRPACK", size: 100 }] },
    { ...base, id: "ambiguous", files: [{ primary: true, filename: "one.mrpack", size: 100 }, { primary: true, filename: "two.mrpack", size: 100 }] },
    { ...base, id: "wrong", files: [{ filename: "server.zip", size: 100 }] }, { ...base, id: "missing", files: [] },
  ]);
  assert.ok(minecraftReviewableVersion(valid));assert.ok(!minecraftReviewableVersion(ambiguous));assert.ok(!minecraftReviewableVersion(wrong));assert.ok(!minecraftReviewableVersion(missing));
  const url=minecraftCatalogUrl({ kind: "versions", query: "realPack", game: "1.21.1", loader: "quilt" });
  assert.deepEqual(JSON.parse(url.searchParams.get("game_versions")!), ["1.21.1"]);assert.deepEqual(JSON.parse(url.searchParams.get("loaders")!), ["quilt"]);
  assert.equal(url.searchParams.get("include_changelog"), "false");
});

test("changelogs use the exact single-version endpoint while bulk releases omit them", () => {
  assert.equal(minecraftCatalogUrl({ kind: "version", query: "A1b2C3d4" }).href, "https://api.modrinth.com/v2/version/A1b2C3d4");
  for (const query of ["", "../project/secret", "https://other.test", "a?token=bad"]) assert.throws(() => minecraftCatalogUrl({ kind: "version", query }));
  assert.throws(() => minecraftCatalogUrl({ kind: "unknown", query: "valid" } as never));
  assert.equal(minecraftCatalogUrl({ kind: "versions", query: "project1" }).searchParams.get("include_changelog"), "false");
});

test("release notes validate both identities and distinguish missing notes from malformed metadata", () => {
  const raw = { id: "version1", project_id: "project1", changelog: "# Changes\n\n- Fixed a bug" };
  assert.deepEqual(minecraftReleaseNotes(raw, "project1", "version1"), { id: "version1", projectId: "project1", body: raw.changelog, truncated: false });
  for (const changelog of [null, ""]) assert.equal(minecraftReleaseNotes({ ...raw, changelog }, "project1", "version1").body, "");
  for (const invalid of [{ ...raw, id: "wrong" }, { ...raw, project_id: "otherProject" }, { ...raw, changelog: undefined }, { ...raw, changelog: {} }, null]) assert.throws(() => minecraftReleaseNotes(invalid, "project1", "version1"));
  assert.throws(() => minecraftReleaseNotes(raw, "../project", "version1"));
  const long = { ...raw, changelog: "x".repeat(100_001) };
  const result = minecraftReleaseNotes(long, "project1", "version1");
  assert.equal(result.body.length, 100_000); assert.equal(result.truncated, true); assert.equal(long.changelog.length, 100_001);
});
