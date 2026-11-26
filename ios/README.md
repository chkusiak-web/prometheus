# Prometheus for iPhone

Open `ios/Prometheus.xcodeproj`, choose the shared **Prometheus** scheme, select an iPhone simulator, and press Run. The app targets iOS 17 or newer and has no external dependencies.

For a physical iPhone, choose your team under **Signing & Capabilities**, then select the connected phone as the run destination. If Xcode reports a bundle ID collision, use an identifier associated with your team.

The initial shell includes the five tabs, the existing Prometheus geometry and colors, and a native sheet and keyboard preview under **Body → Try native input**. The preview discards its fields on close. Food logging is a later milestone.

In the web app, use **Hero → Settings → Save backup**. In the native app, use **Hero → Import backup** to review and store that version 1 JSON. **Export backup** returns the original payload, including fields later native screens will use. A replacement requires confirmation.
