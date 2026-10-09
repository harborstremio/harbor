import test from "node:test";
import assert from "node:assert/strict";
import { load } from "cheerio";

type Cheerio = ReturnType<typeof load>;
const wrappers = new WeakMap<object, unknown>();
function wrap($: Cheerio, node: unknown): unknown {
  if (!node) return null;
  const held = wrappers.get(node as object);
  if (held) return held;
  const attribs = (node as { attribs?: Record<string, string> }).attribs ?? {};
  const element = {
    get id() { return attribs.id ?? ""; },
    get textContent() { return $(node as never).text(); },
    getAttribute(name: string) { return attribs[name] ?? null; },
    classList: { contains: (name: string) => (attribs.class ?? "").split(/\s+/).includes(name) },
    querySelector(selector: string) { return wrap($, $(node as never).find(selector).get(0) ?? null); },
    querySelectorAll(selector: string) { return $(node as never).find(selector).get().map((child) => wrap($, child)); },
  };
  wrappers.set(node as object, element);
  return element;
}
class FixtureParser {
  parseFromString(html: string) {
    const $ = load(html);
    return {
      querySelector: (selector: string) => wrap($, $(selector).get(0) ?? null),
      querySelectorAll: (selector: string) => $(selector).get().map((node) => wrap($, node)),
      getElementById: (id: string) => wrap($, $(`#${id}`).get(0) ?? null),
    };
  }
}
Object.assign(globalThis, { DOMParser: FixtureParser });
const { parseProConfig } = await import("../src/lib/games/pro-configs.ts");

const upload = (name: string) => `https://prosettings.net/wp-content/uploads/${name}`;
const row = (field: string, label: string, value: string) => `<tr data-field="${field}"><th>${label}</th><td>${value}</td></tr>`;
const crosshair = Object.entries({
  cl_crosshairstyle: ["Style", "Static Cross"], cl_crosshair_recoil: ["Follow Recoil", "No"], cl_crosshairdot: ["Dot", "Yes"],
  cl_crosshair_length: ["Length (px)", "0"], cl_crosshair_thickness: ["Thickness (px)", "4"], cl_crosshair_gap: ["Gap (px)", "2"],
  cl_crosshair_drawoutline: ["Outline", "No"], cl_crosshaircolor_r: ["Red", "0"], cl_crosshaircolor_g: ["Green", "255"],
  cl_crosshaircolor_b: ["Blue", "145"], cl_crosshaircolor_a: ["Opacity", "255"], cl_crosshair_t: ["T Style", "No"],
  cl_crosshair_dynamic_splitdist: ["Split Distance", "3"], cl_crosshair_dynamic_splitalpha_innermod: ["Inner Split Alpha", "0"],
  cl_crosshair_dynamic_splitalpha_outermod: ["Outer Split Alpha", "1"], cl_crosshair_dynamic_maxdist_splitratio: ["Split Size Ratio", "1"],
  cl_crosshair_dynamic_spread_limit: ["Spread Limit", "255"], cl_crosshair_screen_height: ["Screen Height", "960"],
}).map(([field, [label, value]]) => row(field, label, value)).join("");

const page = `<html><body>
<section id="cs2_mouse" class="settings-group section--mouse"><h3>Mouse</h3>
  <div class="promo linked js-promo-gear"><div class="promo_heading-wrapper">
    <picture><img src="${upload("razer-deathadder-40x40-fitcontain.webp")}" alt=""></picture>
    <h4><a href="https://amzn.to/affiliate" rel="sponsored">Razer DeathAdder V4 Pro</a></h4>
  </div><a class="btn" href="https://amzn.to/affiliate"><span>Check price</span></a></div>
  <table class="settings"><tbody>${row("dpi", "DPI", "800")}${row("sensitivity", "Sensitivity", "0.815")}</tbody></table>
</section>
<section id="cs2_crosshair" class="settings-group section--crosshair"><h3>Crosshair</h3>
  <div class="crosshair-slider pro-gallery"><ul class="glide__slides">
    <li><picture><img src="${upload("inferno-2-1120x350-s1.jpeg")}" alt=""></picture></li>
    <li><picture><img src="${upload("mirage-17-1120x350-s1.jpeg")}" alt=""></picture></li>
    <li><picture><img src="https://cdn.example.com/not-the-provider.jpeg" alt=""></picture></li>
  </ul></div>
  <table class="settings"><tbody>${crosshair}</tbody></table>
</section>
<section id="cs2_launch_options" class="settings-textarea section--launch_options"><h3>Launch Options</h3><pre>-novid -high -tickrate 128</pre></section>
<section id="cs2_video_settings" class="settings-group section--video_settings section--parent"><h3>Video Settings</h3><div class="settings">
  <section id="video" class="section--child"><h4>Video</h4><table><tbody>${row("resolution", "Resolution", "1280x960")}${row("aspect_ratio", "Aspect Ratio", "4:3")}</tbody></table></section>
  <section id="advanced_video" class="section--child"><h4>Advanced Video</h4><table><tbody>${row("max_fps", "Maximum FPS In Game", "400")}${row("shader_detail", "Shader Detail", "Low")}</tbody></table></section>
</div></section>
<section id="cs2_cosmetics" class="settings-cosmetics skins"><h3>Skins</h3>
  <div class="promo promo--cs-money js-promo-skin"><div class="promo_heading-wrapper"><h4><a href="https://cs.money/market">Shop the drop</a></h4></div></div>
  <div class="cta-boxes--list"><div class="cta-box cta-box-skin promo"><h4><a href="https://cs.money/market">AK-47 | Case Hardened (Factory New)</a></h4>
    <div class="cta-box__tag">Rifles</div><div class="cta-box_heading-wrapper"><picture><img src="${upload("cosmetics/ak-47-300x225-fitcontain.png")}" alt=""></picture></div></div></div>
</section>
<section id="gear" class="setup settings-group"><h3>Gear</h3><div class="cta-boxes--list">
  <div class="cta-box promo js-promo-gear"><h4><a href="https://amzn.to/affiliate">ZOWIE XL2586X+</a></h4>
    <dialog><table><tbody><tr><th>Size</th><td>24"</td></tr><tr><th>Refresh Rate</th><td>600</td></tr></tbody></table></dialog>
    <div class="cta-box__tag">Monitor</div><div class="cta-box_heading-wrapper"><picture><img src="${upload("zowie-187x187-fitcontain.png")}" alt=""></picture>
    <a class="card-link" href="https://amzn.to/affiliate"><span>Check price</span></a></div></div>
</div></section>
<section id="teammates" class="teammates"><h2>Teammates</h2><div class="cards cta-boxes--list">
  <div class="card cta-box"><h4><a href="https://prosettings.net/players/m0nesy/">m0NESY</a></h4>
    <div class="team_team"><a href="https://prosettings.net/teams/falcons-esports/">Falcons Esports</a></div>
    <div class="cta-box_heading-wrapper"><picture><img src="${upload("m0nesy-200x200-s1.png")}" alt=""></picture></div></div>
</div></section>
</body></html>`;

test("a player page yields settings, gear, skins and teammates without carrying affiliate links", () => {
  const config = parseProConfig(page, "cs2");
  assert.equal(config.crosshair, "CSGO-VT5h9-bzS2V-hZXPc-7WkTt-rVTVP");
  assert.deepEqual(config.groups.map((group) => group.id), ["mouse", "crosshair", "launch_options", "video_settings"]);
  assert.equal(config.groups[0].product?.name, "Razer DeathAdder V4 Pro");
  assert.ok(config.groups[0].product?.image.startsWith("https://prosettings.net/wp-content/uploads/"));
  assert.equal(config.groups[2].text, "-novid -high -tickrate 128");
  assert.deepEqual(config.groups[3].blocks?.map((block) => `${block.title}:${block.values.length}`), ["Video:2", "Advanced Video:2"]);
  assert.deepEqual(config.skins?.map((skin) => `${skin.tag}|${skin.name}`), ["Rifles|AK-47 | Case Hardened (Factory New)"]);
  assert.deepEqual(config.showcases?.map((showcase) => showcase.id), ["gear"]);
  const monitor = config.showcases?.[0].items[0];
  assert.equal(monitor?.tag, "Monitor");
  assert.deepEqual(monitor?.specs.map((spec) => `${spec.label}=${spec.value}`), ["Size=24\"", "Refresh Rate=600"]);
  assert.deepEqual(config.teammates?.map((mate) => `${mate.id}/${mate.team}`), ["m0nesy/Falcons Esports"]);
  assert.ok(!JSON.stringify(config).includes("amzn.to"));
  assert.ok(!JSON.stringify(config).includes("cs.money"));
});

test("crosshair backgrounds only come from the provider's own image host", () => {
  const config = parseProConfig(page, "cs2");
  assert.deepEqual(config.maps, [
    "https://prosettings.net/wp-content/uploads/inferno-2-1120x350-s1.jpeg",
    "https://prosettings.net/wp-content/uploads/mirage-17-1120x350-s1.jpeg",
  ]);
});

test("a page without this game's sections is reported as unavailable", () => {
  assert.throws(() => parseProConfig(page, "valorant"), /No published settings/);
});
