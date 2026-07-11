import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

import pkg from "./package.json" with { type: "json" };

declare const process: { env: Record<string, string | undefined> };

/**
 * Harbor style (matches github.com/harborstremio/harbor — no Prettier/ESLint
 * there; this mirrors the existing codebase conventions):
 * - 2-space indent, double quotes, semicolons, LF
 * - printWidth 120 (generous; many existing lines are long)
 * - `@/` for app imports
 *
 * Lint is intentional but not strict: real bugs/errors block commit & CI;
 * full TypeScript typecheck stays in `tsc -b` / `vp build`, not the hook gate.
 */
const IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/src-tauri/**",
  "**/harbor-core/**",
  "**/flatpak/**",
  "**/public/**",
  "**/docs/**",
  "**/examples/**",
  "**/target/**",
  "pnpm-lock.yaml",
  "**/*.tsbuildinfo",
  "vite.config.js",
  "vite.config.d.ts",
  "**/avatars/**",
  "**/*.{png,jpg,jpeg,webp,gif,svg,ico,mp4,woff,woff2,ttf,otf}",
];

// https://viteplus.dev/config/
export default defineConfig({
  // ── Git staged checks (pre-commit → `vp staged`) ──────────────────────
  // Format + lint with autofix on staged files only. Blocks commit if
  // remaining errors. No full-project typecheck here (not strict).
  staged: {
    "*.{ts,tsx,js,jsx,mjs,cjs,css,json,md,html}": "vp check --fix --no-error-on-unmatched-pattern",
  },

  // `vp check` = fmt + lint (typeCheck off — see lint.options)
  check: {
    // keep defaults: fmt + lint on
  },

  // tmdb-episode-types.test.ts is a compile-only type fixture. TypeScript
  // verifies it through tsconfig; Vitest requires executable test suites.
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/lib/providers/tmdb/tmdb-episode-types.test.ts"],
  },

  // ── Oxfmt  https://viteplus.dev/guide/fmt ─────────────────────────────
  fmt: {
    tabWidth: 2,
    semi: true,
    printWidth: 120,
    singleQuote: false,
    endOfLine: "lf",
    trailingComma: "all",
    sortPackageJson: true,
    sortImports: {
      internalPattern: ["@/**"],
      customGroups: [{ elementNamePattern: ["@/**"], groupName: "internal" }],
      groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "style", "unknown"],
    },
    ignorePatterns: IGNORE,
  },

  // ── Oxlint  https://viteplus.dev/guide/lint ───────────────────────────
  // Tauri webview = browser runtime. Catch real bugs; avoid noisy pedantry.
  lint: {
    ignorePatterns: IGNORE,
    plugins: ["typescript", "react", "import"],
    env: {
      builtin: true,
      browser: true,
      es2024: true,
    },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    categories: {
      correctness: "warn",
      suspicious: "warn",
      pedantic: "off",
      style: "off",
      restriction: "off",
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // React 17+ / automatic JSX runtime (no `import React`)
      "react/react-in-jsx-scope": "off",
      // Correctness that matters in React + Tauri UI
      "react/jsx-key": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/no-children-prop": "error",
      "react/no-direct-mutation-state": "error",
      // Practical for an app with intentional logs
      "no-console": "off",
      "no-debugger": "error",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Soft type-aware noise (Harbor uses many casts with DOM / Tauri)
      "typescript/no-unsafe-type-assertion": "off",
      "typescript/no-explicit-any": "off",
      // Side-effect CSS / polyfill imports are intentional
      "import/no-unassigned-import": "off",
      // Custom TV list UIs (categories, etc.) use listbox/option roles
      "jsx_a11y/prefer-tag-over-role": "off",
      "jsx_a11y/no-noninteractive-element-to-interactive-role": "off",
      "jsx-a11y/prefer-tag-over-role": "off",
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "off",
    },
    options: {
      // Full TypeScript validation stays in `tsc -b` / `vp build`.
      // This keeps static analysis fast and avoids promoting legacy type-aware
      // style rules to CI-blocking errors.
      typeAware: false,
      typeCheck: false,
    },
    overrides: [
      {
        files: ["scripts/**/*.{js,mjs,cjs,ts}"],
        env: { node: true, browser: false },
        rules: { "no-console": "off" },
      },
      {
        files: ["vite.config.ts", "vite.config.*.ts"],
        env: { node: true },
      },
      {
        // Tauri invoke / window APIs often look "unused" in types; keep soft
        files: ["src/**/*.{ts,tsx}"],
        env: { browser: true },
      },
    ],
  },

  // ── Vite app (Tauri frontend) ─────────────────────────────────────────
  plugins: lazyPlugins(() => [react(), tailwindcss()]),
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __IS_BETA_BUILD__: JSON.stringify(process.env.HARBOR_CHANNEL !== "stable"),
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  resolve: {
    alias: { "@": "/src" },
  },
});
