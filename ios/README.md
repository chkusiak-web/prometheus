# Prometheus for iPhone

Open `ios/Prometheus.xcodeproj`, choose the shared **Prometheus** scheme, select an iPhone simulator, and press Run. The app targets iOS 17 or newer and has no external dependencies.

For a physical iPhone, choose your team under **Signing & Capabilities**, then select the connected phone as the run destination. If Xcode reports a bundle ID collision, use an identifier associated with your team.

The initial shell includes the five tabs, the existing Prometheus geometry and colors, and a native sheet and keyboard preview under **Body → Try native input**. The preview discards its fields on close. Food logging is a later milestone.

In the web app, use **Hero → Settings → Save backup**. In the native app, use **Hero → Import backup** to review and store that version 1 JSON. **Export backup** returns the original payload, including fields later native screens will use. A replacement requires confirmation.

## Food and workouts review build

- **Today** and **Body** both open the food log and scheduled workout.
- **Food** searches logged foods, basic foods, and branded results in that order.
  Catalog searches and barcode lookup use Prometheus's public USDA catalog.
  A supported iPhone can scan from the camera. Simulator supports typing a UPC
  and using Quick Add.
- **Workout** opens the scheduled lift, records sets and rest, keeps a run on
  disk as it progresses, and saves the completed workout to its date. The
  calendar button opens the year and lets you swap dates for eligible sessions.
- **Hero** imports and exports backups. Logs stay in the app's local storage.
  A backup exported after native edits includes those edits.

## Daily flows review

- Today includes agenda creation, editing, completion, cross-date moves,
  duplication, the weekly Hero strip, missed-log prompts, and close-day
  rating, Soul traits, and moving unfinished blocks to tomorrow.
- Body provides weigh-ins and a trend chart, sleep, lifting history, water,
  steps, and the Sunday review. The workout screen retains the year calendar.
- Mind includes the wheel, weekly activity goals and emotion check-in. Soul
  includes the trait sky and quest pools. Hero includes weekly scores, the
  flame, the weekly quest and reward, goals, and backup.
- The existing GitHub Pages app and backup version remain available. Native
  UI uses iOS sheets and keyboards, with layouts adapted from the web design.
