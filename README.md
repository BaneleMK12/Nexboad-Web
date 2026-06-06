# NexBoard Web

Browser-based board game hub with AI opponents — no backend, no signup, plays in your browser.

## Games

- ♟ **Chess** — Full rules: castling, en passant, promotion, alpha-beta AI (Easy / Medium / Hard)
- ⬤ **Checkers** — Mandatory captures, multi-jump, kinging, alpha-beta AI
- ◉ **Othello** — Reversi with disc flipping, mobility AI
- ⬡ **Morabaraba** — Traditional South African game, mills, 3 phases, AI
- ✕ **Tic-Tac-Toe** — 3×3 to 7×7 boards, perfect minimax AI

## Tech

- React + Vite + TypeScript
- TailwindCSS (v4)
- HTML Canvas board rendering
- All game state in localStorage (no backend)
- Monetag ads — replace zone ID `8403919` in `index.html` with your own

## Deploy to Cloudflare Pages

1. Connect this repo to [Cloudflare Pages](https://pages.cloudflare.com)
2. Build command: `npm run build`
3. Output directory: `dist`
4. The `public/_redirects` file handles SPA routing automatically

## Development

```bash
npm install
npm run dev
```
