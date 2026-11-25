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
- Body tab: 7-day average, lb to go, workouts this week; weigh-in and food (calories by meal) logging.
- Weight plan: chart (weigh-ins, 7-day average, dashed plan), pace tier (On pace / Close / Behind vs last week, 0.25 lb grace), projected date, this week's behaviors, rewards (small = weigh-in + food 6 of 7 days and workouts at the weekly requirement; big = on pace), daily food target (maintenance − pace × 500, floor 1,800). Edit plan: goal, pace, workouts/week, reward names, Do it now list.
- Do it now: a day counts as logged with a weigh-in and calories. After the 4 AM rollover, a missed log shows a random task from your list on Today, with Done and Swap.

## Not yet
Mind, Soul and Hero tabs, workout runner, water and sleep, food search, This Week, spoils and forfeits, calendar, Health, notifications, Supabase sync.

## Dev
```
npm install
npm run dev
npm run build
```
