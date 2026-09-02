import { t, CONTINUE_CYCLE } from "../i18n.js";
import { openModal } from "../modal.js";
import { openExternal, fetchChangelog, saveLicense } from "../bridge.js";

export const id = "start";
export const title = "Welcome";
export const label = "Welcome";

const LEAD =
  "Harbor is a media client that runs on your own computer. This installer sets it up for your " +
  "account only, and needs no administrator rights.";

const STEPS = [
  "Pick the language Harbor opens in",
  "Read the terms and accept them",
  "Review every component before it lands",
  "Install, then launch Harbor",
];

const ICONS = {
  globe:
    '<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8"/>' +
    '<path d="M12 3.6c2.5 2.4 2.5 14.4 0 16.8-2.5-2.4-2.5-14.4 0-16.8Z"/>',
  branch:
    '<circle cx="7" cy="5.6" r="2.3"/><circle cx="7" cy="18.4" r="2.3"/>' +
    '<circle cx="17" cy="8.6" r="2.3"/><path d="M7 7.9v8.2"/>' +
    '<path d="M17 10.9c0 3.3-2.6 4.3-5.7 4.8"/>',
  mail: '<rect x="3.2" y="5.6" width="17.6" height="12.8" rx="2.4"/><path d="m4 7.2 8 5.8 8-5.8"/>',
  chat: '<path d="M20.4 14.2a2.2 2.2 0 0 1-2.2 2.2H8.6L4.6 20V5.8a2.2 2.2 0 0 1 2.2-2.2h11.4a2.2 2.2 0 0 1 2.2 2.2Z"/>',
};

const LINKS = [
  { icon: "globe", lead: "Website", value: "harbor.site", url: "https://harbor.site" },
  {
    icon: "branch",
    lead: "Source",
    value: "github.com/harborstremio/harbor",
    url: "https://github.com/harborstremio/harbor",
  },
  {
    icon: "mail",
    lead: "Bugs",
    value: "bugs@harbor.site",
    url: "mailto:bugs@harbor.site?subject=Harbor%20bug%20report",
  },
  {
    icon: "chat",
    lead: "Community",
    value: "discord.gg/harbor",
    url: "https://discord.gg/harbor",
  },
];

function openLicense() {
  openModal({
    label: t("MIT License"),
    action: {
      label: t("Download"),
      onClick: (button) => {
        button.disabled = true;
        saveLicense().then((path) => {
          if (path) {
            button.classList.add("is-done");
            button.title = t("Saved to Downloads");
            button.setAttribute("aria-label", t("Saved to Downloads"));
            return;
          }
          button.disabled = false;
        });
      },
    },
    build: (body) => {
      const pre = document.createElement("p");
      pre.className = "hb-modal-legal";
      body.appendChild(pre);

      fetch("assets/LICENSE.txt")
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((text) => {
          pre.textContent = text.trim();
        })
        .catch(() => {
          pre.textContent = t("The licence file ships alongside Harbor in the install folder.");
        });
    },
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function stroked(paths) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = paths;
  return svg;
}

function marker(cls) {
  const span = document.createElement("span");
  span.className = cls;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("fill", "currentColor");
  svg.innerHTML = '<path d="M4 1c3.9 2.9 5.8 6.5 6.2 9.4H4Z"/>';
  span.appendChild(svg);
  return span;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}

function parseNotes(notes, version) {
  const lines = String(notes || "").split("\n");
  const blocks = [];

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (i === 0 && line.replace(/[^0-9.]/g, "") === version) return;

    if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
      blocks.push({ kind: "item", text: line.slice(2).trim() });
      return;
    }
    if (line.length <= 34 && !/[.!?]$/.test(line)) {
      blocks.push({ kind: "head", text: line });
      return;
    }
    blocks.push({ kind: "prose", text: line });
  });

  return blocks;
}

function entryNode(entry) {
  const wrap = document.createElement("article");
  wrap.className = "hb-news-entry";

  const head = document.createElement("div");
  head.className = "hb-news-stamp";

  const ver = document.createElement("span");
  ver.className = "hb-news-ver";
  ver.textContent = entry.version;

  head.appendChild(ver);

  const date = formatDate(entry.pub_date);
  if (date) {
    const when = document.createElement("span");
    when.className = "hb-news-date t-meta";
    when.textContent = date;
    head.appendChild(when);
  }

  wrap.appendChild(head);

  parseNotes(entry.notes, entry.version).forEach((block) => {
    if (block.kind === "head") {
      const h = document.createElement("p");
      h.className = "hb-news-head t-eyebrow";
      h.textContent = block.text;
      wrap.appendChild(h);
      return;
    }
    if (block.kind === "item") {
      const li = document.createElement("p");
      li.className = "hb-news-item t-prose";
      const copy = document.createElement("span");
      copy.textContent = block.text;
      li.append(marker("hb-news-mark"), copy);
      wrap.appendChild(li);
      return;
    }
    const p = document.createElement("p");
    p.className = "hb-news-prose t-prose";
    p.textContent = block.text;
    wrap.appendChild(p);
  });

  return wrap;
}

function skeleton() {
  const wrap = document.createElement("div");
  wrap.className = "hb-news-skeleton";
  [58, 100, 92, 74, 40, 100, 86].forEach((w, i) => {
    const bar = document.createElement("span");
    bar.className = "hb-news-bar";
    bar.style.width = w + "%";
    bar.style.setProperty("--i", String(i));
    wrap.appendChild(bar);
  });
  return wrap;
}

function news() {
  const wrap = document.createElement("section");
  wrap.className = "hb-news";

  const bar = document.createElement("div");
  bar.className = "hb-news-bar-top";

  const heading = document.createElement("p");
  heading.className = "hb-news-title t-eyebrow";
  heading.textContent = t("What's new");

  const tabs = document.createElement("div");
  tabs.className = "hb-news-tabs";

  const body = document.createElement("div");
  body.className = "hb-news-scroll";
  body.appendChild(skeleton());

  function syncFade() {
    const top = body.scrollTop > 2;
    const bottom = body.scrollTop + body.clientHeight < body.scrollHeight - 2;
    body.classList.toggle("is-fade-top", top);
    body.classList.toggle("is-fade-bottom", bottom);
  }

  body.addEventListener("scroll", syncFade, { passive: true });

  bar.append(heading, tabs);
  wrap.append(bar, body);

  let versions = [];
  let channel = "beta";
  const buttons = {};

  function paint() {
    const list = versions.filter((v) =>
      channel === "stable" ? v.channel === "stable" : v.channel !== "stable",
    );

    body.replaceChildren();
    body.scrollTop = 0;

    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "hb-news-note t-prose";
      empty.textContent = t("No {channel} releases listed yet.", { channel: t(channel) });
      body.appendChild(empty);
      syncFade();
      return;
    }

    list.forEach((entry, i) => {
      const node = entryNode(entry);
      node.style.setProperty("--i", String(i));
      body.appendChild(node);
    });

    syncFade();
  }

  ["beta", "stable"].forEach((key) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "hb-news-tab t-btn-mini";
    tab.textContent = key === "beta" ? t("Beta") : t("Stable");
    tab.setAttribute("aria-pressed", String(key === channel));
    tab.addEventListener("click", () => {
      if (channel === key) return;
      channel = key;
      Object.keys(buttons).forEach((k) =>
        buttons[k].setAttribute("aria-pressed", String(k === key)),
      );
      paint();
    });
    buttons[key] = tab;
    tabs.appendChild(tab);
  });

  let dead = false;

  function load() {
    fetchChangelog()
      .then((data) => {
        if (dead) return;
        const list = Array.isArray(data && data.versions) ? data.versions : [];
        versions = list.filter((v) => v && typeof v.version === "string");
        paint();
      })
      .catch(() => {
        if (dead) return;
        body.replaceChildren();

        const note = document.createElement("p");
        note.className = "hb-news-note t-prose";
        note.textContent = t("Release notes need a connection.");

        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "hb-news-retry t-btn-mini";
        retry.textContent = t("Try again");
        retry.addEventListener("click", () => {
          body.replaceChildren(skeleton());
          load();
        });

        body.append(note, retry);
        syncFade();
      });
  }

  load();

  return {
    node: wrap,
    stop: () => {
      dead = true;
    },
  };
}

export function render(mount, ctx) {
  const wrap = document.createElement("div");
  wrap.className = "hb-start-wrap";

  const main = document.createElement("div");
  main.className = "hb-start-main";

  const lead = document.createElement("p");
  lead.className = "hb-start-lead t-body";
  lead.textContent = t(LEAD);

  const stepsHead = document.createElement("p");
  stepsHead.className = "hb-start-head t-eyebrow";
  stepsHead.textContent = t("What happens next");

  const list = document.createElement("ul");
  list.className = "hb-start-list";

  STEPS.forEach((text, i) => {
    const item = document.createElement("li");
    item.className = "hb-start-item t-prose";
    item.style.setProperty("--i", String(i + 1));

    const copy = document.createElement("span");
    copy.textContent = t(text);

    item.append(marker("hb-start-mark"), copy);
    list.appendChild(item);
  });

  const links = document.createElement("ul");
  links.className = "hb-start-links";

  LINKS.forEach((spec, i) => {
    const row = document.createElement("li");
    row.className = "hb-start-linkrow t-prose";
    row.style.setProperty("--i", String(i + 6));

    const glyph = document.createElement("span");
    glyph.className = "hb-start-glyph";
    glyph.appendChild(stroked(ICONS[spec.icon]));

    const caption = document.createElement("span");
    caption.className = "hb-start-cap";
    caption.textContent = t(spec.lead);

    const anchor = document.createElement("button");
    anchor.type = "button";
    anchor.className = "hb-start-url";
    anchor.textContent = spec.value;
    anchor.addEventListener("click", () => openExternal(spec.url));

    row.append(glyph, caption, anchor);
    links.appendChild(row);
  });

  main.append(lead, stepsHead, list, links);

  const feed = news();
  wrap.append(main, feed.node);
  mount.appendChild(wrap);

  const zone = document.getElementById("hb-consequence");
  const legal = document.createElement("p");
  legal.className = "hb-license-line t-sub";

  const legalLead = document.createElement("span");
  legalLead.textContent = t("Free and open source");

  const sep = document.createElement("span");
  sep.className = "hb-license-sep";
  sep.textContent = "·";

  const link = document.createElement("button");
  link.type = "button";
  link.className = "hb-license-link";
  link.textContent = t("MIT License");
  link.addEventListener("click", openLicense);

  const sep2 = document.createElement("span");
  sep2.className = "hb-license-sep";
  sep2.textContent = "·";

  const who = document.createElement("span");
  who.textContent = t("Harbor contributors");

  legal.append(legalLead, sep, link, sep2, who);
  if (zone) zone.appendChild(legal);

  ctx.setFooter({ backLabel: null, nextLabel: t("Continue"), nextEnabled: true, onNext: null });

  let cycle = 0;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timer = reduce
    ? 0
    : window.setInterval(() => {
        cycle = (cycle + 1) % CONTINUE_CYCLE.length;
        ctx.setFooter({ nextLabel: CONTINUE_CYCLE[cycle] });
      }, 2600);

  return () => {
    if (timer) window.clearInterval(timer);
    if (zone) zone.replaceChildren();
    feed.stop();
  };
}
