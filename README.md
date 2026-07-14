<p align="center">
  <img src="https://harbor.site/readme-media/harbor-wordmark-light.svg" alt="Harbor" width="400" />
</p>

<h3 align="center">Fork do <a href="https://github.com/harborstremio/harbor">Harbor</a> para Samsung Tizen TV</h3>

<p align="center">
  <img src="https://img.shields.io/badge/plataforma-Tizen%20TV-blue" />
  <img src="https://img.shields.io/badge/framework-React%2019-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/build-Vite%207-646CFF?logo=vite" />
  <img src="https://img.shields.io/badge/base-Harbor%200.9.21-orange" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

Este é um fork do **[Harbor](https://github.com/harborstremio/harbor)** — o cliente Stremio nativo para desktop — adaptado exclusivamente para **Samsung Tizen TVs**. O Harbor original roda em Windows/macOS/Linux com player nativo libmpv, engine Rust/WASM, casting, torrent engine e shell Tauri. Este fork remove toda a camada desktop e adapta a UI React para navegação por controle remoto em TVs.

> **Aviso:** este projeto não hospeda, indexa ou distribui nenhuma mídia. Você traz seus próprios addons e fontes. Harbor não tem fins lucrativos — é um projeto open source feito por paixão.

---

## O que mudou do Harbor original

| Removido | Motivo |
|----------|--------|
| `src-tauri/` (shell Rust, player nativo, casting, torrent) | Incompatível com Tizen |
| `harbor-core/` (engine Rust → WASM) | Recompilar para web depois |
| `@tauri-apps/*` runtime e API calls | Substituídos por stubs/guards para build web |
| Player mpv nativo | Tizen usa `avplay` / `<video>` HTML5 |
| 20+ famílias de fonte | Apenas Sentient + Switzer + Inter carregam no boot |

| Adicionado | Por quê |
|-----------|--------|
| Navegação espacial por setas (keyboard-navigation.ts) | Controle remoto TV |
| Mapeamento de teclas Tizen (keys.js) | Back key, setas, Enter |
| Empacotamento `.wgt` | Sideload via Tizen Studio / `sdb` |
| Build target ES2015 | Compatível com Tizen WebKit (4.0+) |
| Viewport fixo 1920×1080 | Resolução padrão de TV |


## Rodando no PC

```bash
# Instalar
npm install

# Desenvolver (porta 1420)
npm run dev

# Build de produção
npm run build

# Empacotar .wgt para Tizen
npm run wgt
```

## Instalar na TV Tizen

```bash
# Via Tizen Studio
tizen install -n harbor-tizen.wgt

# Ou via sdb
sdb push harbor-tizen.wgt /opt/usr/apps/
```

## Estrutura

```
src/
├── views/          # Páginas (home, detail, player, settings...)
├── components/     # Componentes React reutilizáveis
├── lib/            # Lógica de negócio, providers, stores
├── chrome/         # Layouts de navegação (sidebar, topbar...)
├── assets/         # Imagens, fontes, previews de tema
├── data/           # JSON estático (premiações, catálogos)
config.xml          # Manifesto Tizen
scripts/package.mjs # Gerador de .wgt (ZIP)
```

## Contribuindo

Este fork é mantido como parte do ecossistema Harbor. Contribuições de UI, navegação TV e testes em hardware Tizen são bem-vindas.

O upstream é o [Harbor original](https://github.com/harborstremio/harbor) — correções no frontend React devem idealmente ser enviadas para lá.

## Licença

MIT — mesmo que o Harbor original. Veja [LICENSE](https://github.com/harborstremio/harbor/blob/main/LICENSE).
