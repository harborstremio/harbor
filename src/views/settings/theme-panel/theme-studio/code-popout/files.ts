import type { CodeLang } from "@/components/code-editor";
import { Braces, FileCode2, FileType2, type LucideIcon } from "lucide-react";

export type ThemeFile = {
  id: CodeLang;
  name: string;
  lang: string;
  icon: LucideIcon;
  tint: string;
};

export const THEME_FILES: ThemeFile[] = [
  { id: "css", name: "theme.css", lang: "CSS", icon: FileType2, tint: "#61afef" },
  { id: "html", name: "theme.html", lang: "HTML", icon: FileCode2, tint: "#e06c75" },
  { id: "js", name: "theme.js", lang: "JavaScript", icon: Braces, tint: "#e3b341" },
];

export const IDE = {
  overlay: "#1c1f24",
  panel: "#21252b",
  editor: "#282c34",
  border: "#181a1f",
  text: "#abb2bf",
  textDim: "#828a99",
  textFaint: "#5c6370",
  accent: "#e3b341",
};
