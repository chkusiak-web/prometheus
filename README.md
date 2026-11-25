# Prometheus

Mind / Body / Soul habit app. Installable home-screen web app (PWA), React + Vite + TypeScript.

- Live: https://chkusiak-web.github.io/prometheus/
- Design prototype: https://chkusiak-web.github.io/prometheus/prototype/
- Install on iPhone: open the link in Safari → Share → Add to Home Screen.
- Pushes to `main` deploy automatically (GitHub Pages).
- After a release, bump `VERSION` in `public/sw.js` so installed copies update.

## What works (core loop)
- Today: week row (won days), Mind/Body/Soul progress, Up next card, agenda timeline.
- Add blocks (+ Today); tap a block for Done, Move, Extend (+15, pushes later blocks), Duplicate, Edit, Delete.
- Day won: 3+ check-offs with at least one each in Mind, Body and Soul. Unchecking undoes it.
- Close the day: rate 1–5, Soul triangle, plan tomorrow (or move unfinished to tomorrow), "Sleep well."
- Data is saved on the device (localStorage key `prometheus:v1`). Back up / restore on the Hero tab.
- The day rolls over at 4 AM.

## Not yet
Mind, Body, Soul and Hero tabs, This Week, spoils and forfeits, calendar, Health, notifications, Supabase sync.

## Dev
```
npm install
npm run dev
npm run build
```
