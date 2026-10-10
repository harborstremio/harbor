import type { ReactNode } from "react";
import { EXAMPLE } from "./custom-source-content";
import { useT } from "@/lib/i18n";

function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-canvas px-1 py-0.5 font-mono text-[11.5px] text-ink">{children}</code>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">{title}</p>
      {children}
    </div>
  );
}

export function CustomSourceHelp() {
  const t = useT();
  return (
    <div className="harbor-rise flex flex-col gap-4 rounded-xl bg-canvas/60 p-4 text-[13px] leading-relaxed text-ink-muted ring-1 ring-edge-soft">
      <p>
        {t(
          "Harbor ships the engine, not the sites. You write a short JSON config that describes a site with CSS selectors, and Harbor reads the site with them. Nothing is bundled: point it only at sites you have the right to read.",
        )}
      </p>

      <Section title={t("1. Fill in the top")}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <b>baseUrl</b>: {t("the site root, like")} <C>https://example-manga.test</C>.
          </li>
          <li>
            <b>popularPath</b> / <b>searchPath</b>:{" "}
            {t("the browse and search URLs, with the paging number and search word swapped for tokens (below).")}{" "}
            <b>name</b> {t("and")} <b>iconUrl</b> {t("are optional.")}
          </li>
        </ul>
      </Section>

      <Section title={t("2. Selector syntax")}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <C>.title</C> {t("reads the text inside the first match.")}
          </li>
          <li>
            <C>a@href</C> {t("reads an attribute (here the link).")} <C>img@data-src</C>{" "}
            {t("grabs lazy-loaded images.")}
          </li>
          <li>
            <C>{"img@data-src|img@src"}</C> {t("tries each in order and uses the first with a value.")}
          </li>
          <li>
            {t("An empty selector before")} <C>@</C>, {t("like")} <C>@href</C>,{" "}
            {t("reads the attribute off the item itself.")}
          </li>
        </ul>
      </Section>

      <Section title={t("3. The four blocks")}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <b>list</b>: {t("each card on a browse/search page.")} <b>item</b>{" "}
            {t("is the box around one manga; inside it")} <b>link</b> {t("is the manga URL")},{" "}
            <b>title</b> {t("its name")}, <b>cover</b> {t("its image.")}
          </li>
          <li>
            <b>detail</b>:{" "}
            {t("the series page. title, cover, description, author, status (all optional).")}
          </li>
          <li>
            <b>chapters</b>: {t("the chapter links on a series page.")} <b>item</b>{" "}
            {t("is each chapter row")}, <b>link</b> {t("its URL")}, <b>number</b>{" "}
            {t("the chapter number")}, <b>date</b> {t("its timestamp.")}
          </li>
          <li>
            <b>pages</b>: {t("the reader.")} <b>image</b> {t("matches every page image in order.")}
          </li>
        </ul>
      </Section>

      <Section title={t("4. Paging + search tokens")}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <C>{"{query}"}</C> {t("is the search text (searchPath only).")}
          </li>
          <li>
            <C>{"{offset}"}</C>{" "}
            {t(
              "is how many items to skip, starting at 0. Harbor auto-detects the site's page size and walks it for you, so you never set a page size. Use this when the URL counts items.",
            )}
          </li>
          <li>
            <C>{"{page}"}</C> {t("is a page number. Add")} <C>"pageStart": 0</C>{" "}
            {t("if the first page is 0. Use this when the URL counts pages.")}
          </li>
          <li>
            {t(
              "Not sure which? Load page 2 of the site in a browser and watch what changes in the address bar.",
            )}
          </li>
        </ul>
      </Section>

      <Section title={t("5. Optional power fields")}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <b>chapters.listUrl</b>:{" "}
            {t(
              "if the series page shows only the latest few chapters and the full list lives on another URL, this rewrites the series URL to it.",
            )}{" "}
            <C>match</C> {t("is a regex for the part to change")}, <C>replace</C>{" "}
            {t("is what to swap in. The example turns")}{" "}
            <C>.../series/ID/Name</C> {t("into")} <C>.../series/ID/all-chapters</C>.
          </li>
          <li>
            <b>pages.pathSuffix</b>:{" "}
            {t("if the reader loads images from the chapter URL plus a suffix (like")}{" "}
            <C>/images?...</C>
            {t("), put that suffix here.")}
          </li>
          <li>
            <b>headers</b>: {t("extra request headers. Add a")} <C>Referer</C>{" "}
            {t("if the site blocks hotlinked images.")}
          </li>
        </ul>
      </Section>

      <Section title={t("6. How to find a selector")}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            {t(
              "Open the site in a browser. Right-click the thing you want (a cover, a title, a chapter link) and choose Inspect.",
            )}
          </li>
          <li>
            {t("The highlighted tag shows its name and class.")} <C>class="card cover"</C>{" "}
            {t("becomes")} <C>.card</C> {t("or")} <C>.cover</C>.
          </li>
          <li>
            {t("For a link or image you usually want an attribute:")} <C>a@href</C>, <C>img@src</C>.
          </li>
          <li>{t("Do it once on a browse page, once on a series page, once in the reader.")}</li>
        </ul>
      </Section>

      <Section title={t("Rules + limits")}>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <b>{t("Publicly accessible pages only.")}</b>{" "}
            {t(
              "This reads pages a browser can already load. It does not, and must not be made to, bypass a login, password, paywall, or any access control.",
            )}
          </li>
          <li>
            <b>{t("Never target official or licensed publisher sites.")}</b>{" "}
            {t("Only sites you have the right to read.")}
          </li>
          <li>
            {t(
              "You are solely responsible for what you connect and for complying with copyright and each site's terms. Harbor bundles and endorses no sites; it only runs the config you supply.",
            )}
          </li>
          <li>
            {t(
              "Works on plain server-rendered HTML. Sites that build the page with JavaScript, or hide data inside scripts, need a plugin instead.",
            )}
          </li>
        </ul>
      </Section>

      <pre className="max-h-72 overflow-auto rounded-lg bg-canvas p-3 text-[11px] leading-relaxed text-ink-muted ring-1 ring-edge-soft">
        <code>{EXAMPLE}</code>
      </pre>
    </div>
  );
}
