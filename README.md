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
- Workouts: pick one of 9 workouts, remove or add exercises (110-exercise library, word search with db/bb/ohp aliases). Runner: weight and reps steppers that carry to the next set, 60 s rest (+30 s, skip), add a set, swap (keeps done sets with the old exercise), finish or discard. In-progress workout survives closing the app. Next time: double progression (top of range on every set -> +5 lb and back to the bottom; else +1 rep). Saving adds a done Body block to today.
- Water: 8 glasses; 8 of 8 counts as the Body check. Sleep: bed, wake and quality for last night.
- Soul tab: quest card (today's Soul items, Quest i of N, Done/Undo; or a suggested quest from your weakest trait), sky of 12 traits that brightens with the last 7 days, trait sheet (96 quests rotated longest-not-done first, add your own), trace today's Soul triangle (shared with Close the day).
- Mind tab: wheel of 12 areas in 4 categories that fills toward each weekly goal (done Mind tasks this week), area task sheets (first 4, add your own, rest), feelings check-in (quadrant, word, stress and drive 1–5) with an emotion ring (today's dots, all-time average). Stress 4–5, Drive 1 or Drive 5 adds a short Emotion quest to today.
- Hero tab: Mind / Body / Soul % and Hero days/7 (completion-based; Body = 70% workouts + 30% logging), flame panel sized by Overall (average of the four), Weekly Hero Quest (7 day toggles, spoil, 1 free swap a week, type your own), long-term goals (pillar, length, times a week, + to add to today), Settings (backup/restore). Today shows a Hero strip (tap = today done).
- Do it now: a day counts as logged with a weigh-in and calories. After the 4 AM rollover, a missed log shows a random task from your list on Today, with Done and Swap.

## Not yet
food search, muscle map, This Week, spoils and forfeits, calendar, Health, notifications, Supabase sync.

## Dev
```
npm install
npm run dev
npm run build
```
