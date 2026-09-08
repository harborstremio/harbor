import { Copy, Download, Image, ExternalLink, Link2, ZoomIn } from "lucide-react";
import type { ContentContext } from "@/lib/context-content";
import type { ContextAction } from "@/lib/context-actions";
import {
  copyContextImage,
  saveContextImage,
  publicContextImageUrl,
  canCopyContextImage,
  type ContextImage,
} from "@/lib/context-image";
import { copyText } from "@/components/player/copy-link-button";
import { parseExternalLink } from "@/lib/social/external-link-policy";
import { openLinkOut } from "@/lib/social/link-out";
import { t } from "@/lib/i18n";

export async function copyContextText(text: string): Promise<void> {
  if (!(await copyText(text))) throw new Error(t("Could not copy to the clipboard."));
}

export function contentActions(
  content: ContentContext,
  showImage: (image: ContextImage) => void,
  standalone: boolean,
): ContextAction[] {
  const actions: ContextAction[] = [];
  if (content.selection)
    actions.push({
      id: "selection:copy",
      label: t("Copy selected text"),
      icon: <Copy size={14} />,
      run: () => copyContextText(content.selection!),
      group: "selection",
    });
  const parsed = content.link && parseExternalLink(content.link);
  const imageLink = content.image && publicContextImageUrl(content.image);
  const linkIsImage =
    !!imageLink && parsed && parsed.ok && new URL(content.link!).href === imageLink;
  if (parsed && parsed.ok && !linkIsImage) {
    actions.push({
      id: "link:open",
      label: t("Open link"),
      icon: <ExternalLink size={14} />,
      run: () => openLinkOut(content.link!),
      restoreFocus: false,
      group: "link",
    });
    const shareable = publicContextImageUrl({ src: content.link!, publicUrl: content.link! });
    if (shareable)
      actions.push({
        id: "link:copy",
        label: t("Copy link"),
        icon: <Link2 size={14} />,
        run: () => copyContextText(shareable),
        group: "link",
      });
  }
  if (content.image) {
    const image = content.image;
    const children: ContextAction[] = [
      {
        id: "image:view",
        label: t("View image"),
        icon: <ZoomIn size={14} />,
        run: () => showImage(image),
        restoreFocus: false,
      },
      {
        id: "image:save",
        label: t("Save image…"),
        icon: <Download size={14} />,
        run: async () => {
          await saveContextImage(image);
        },
      },
      {
        id: "image:copy",
        label: t("Copy image"),
        icon: <Copy size={14} />,
        disabled: !canCopyContextImage(),
        reason: !canCopyContextImage()
          ? t("Image copying is not supported on this platform.")
          : undefined,
        run: () => copyContextImage(image),
      },
    ];
    const url = publicContextImageUrl(image);
    if (url)
      children.push(
        {
          id: "image:copy-link",
          label: t("Copy image link"),
          group: "link",
          icon: <Link2 size={14} />,
          run: () => copyContextText(url),
        },
        {
          id: "image:open-link",
          label: t("Open image link externally"),
          group: "link",
          icon: <ExternalLink size={14} />,
          run: () => openLinkOut(url),
          restoreFocus: false,
        },
      );
    if (standalone) actions.push(...children);
    else
      actions.push({
        id: "image",
        label: t("Image"),
        group: "content",
        icon: <Image size={14} />,
        children,
      });
  }
  return actions;
}
