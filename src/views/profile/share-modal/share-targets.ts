const e = encodeURIComponent;

export function socialUrls(url: string, text: string) {
  return {
    x: `https://twitter.com/intent/tweet?url=${e(url)}&text=${e(text)}`,
    reddit: `https://www.reddit.com/submit?url=${e(url)}&title=${e(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`,
    whatsapp: `https://wa.me/?text=${e(`${text} ${url}`)}`,
    email: `mailto:?subject=${e(text)}&body=${e(url)}`,
  };
}

export type EmbedField = { key: string; label: string; value: string };

export function embedFields(url: string, cardUrl: string, alias: string): EmbedField[] {
  return [
    { key: "image", label: "Direct image URL", value: cardUrl },
    { key: "markdown", label: "Markdown", value: `[![${alias} on Harbor](${cardUrl})](${url})` },
    { key: "bbcode", label: "BBCode", value: `[url=${url}][img]${cardUrl}[/img][/url]` },
    {
      key: "iframe",
      label: "Embed (iframe)",
      value: `<iframe src="${url}" width="600" height="360" style="border:0;border-radius:14px" title="${alias} on Harbor"></iframe>`,
    },
  ];
}
