# Audion Companion Plugin

An all-in-one plugin for [Audion](https://github.com/dupitydumb/Audion) demonstrating:
1. **Dynamic UI Injection**: Injects an icon into the player bar (`playerbar:right`) and a menu action in the mobile/popup plugin menu (`playerbar:menu`).
2. **Real-time Canvas Audio Visualizer**: Spectrum bars, oscilloscope wave, and circular pulse synced with Audion's playback engine.
3. **Custom Stream Resolver (`api.stream`)**: Shows how to resolve external stream IDs and add external audio tracks (`api.library.addExternalTrack`).
4. **Sleep Timer**: Countdown timer with customizable duration (15m, 30m, 45m, 60m) that automatically pauses playback and triggers native notifications.
5. **Playback Analytics & Scrobbler**: Session event logger and webhook scrobbler support.

---

## 📁 Repository Structure

```
├── plugin.json         # Audion plugin manifest (permissions, metadata, entrypoint)
├── index.js            # Main plugin implementation (IIFE + Audion.register)
├── install-local.ps1   # PowerShell script to deploy to %APPDATA%\audion\plugins
├── .gitignore          # Git ignore file
└── README.md           # Documentation
```

---

## 🚀 Quick Start (Local Testing)

### 1. Automatic Install (Windows)
Run the included PowerShell installer:
```powershell
powershell -ExecutionPolicy Bypass -File .\install-local.ps1
```

### 2. Manual Install
Copy the folder to Audion's plugins directory:
* **Windows**: `%APPDATA%\audion\plugins\audion-companion\`
* **macOS**: `~/Library/Application Support/audion/plugins/audion-companion/`
* **Linux**: `~/.config/audion/plugins/audion-companion/`

### 3. Enable in Audion
1. Launch **Audion**.
2. Navigate to **Settings** > **Plugins**.
3. Click **Reload Plugins**.
4. Toggle **Audion Companion** on.
5. Click the companion button in the bottom right player bar.

---

## 🛠️ Plugin Architecture Explained

### 1. Manifest (`plugin.json`)
The manifest declares required permissions:
```json
{
  "name": "Audion Companion",
  "safe_name": "audion-companion",
  "version": "1.0.0",
  "type": "js",
  "entry": "index.js",
  "permissions": [
    "player:read",
    "player:control",
    "library:read",
    "library:write",
    "ui:inject",
    "storage:local",
    "network:fetch",
    "system:notify"
  ],
  "category": "utility"
}
```

### 2. Stream Resolver (`api.stream`)
To add support for custom streaming services (e.g. YouTube Music, SoundCloud, Subsonic, Jellyfin):
```javascript
api.stream.registerResolver('companion-source', async (externalId, options) => {
    // Return direct playable audio URL (MP3/FLAC/AAC)
    const streamUrl = await fetchStreamUrl(externalId);
    return streamUrl;
});
```

To add tracks to the user's library referencing this resolver:
```javascript
await api.library.addExternalTrack({
    title: "Song Title",
    artist: "Artist Name",
    album: "Album Name",
    cover_url: "https://example.com/cover.jpg",
    source_type: "companion-source",
    external_id: "track-12345",
    duration: 180
});
```

### 3. UI Injection (`api.ui`)
Audion provides designated slots for plugin UI elements:
* `playerbar:right`: Near the volume slider.
* `playerbar:menu`: Mobile-friendly plugin menu list.
* `sidebar:top`: Top of sidebar under the app logo.
* `sidebar:bottom`: Bottom of sidebar above library actions.

```javascript
api.ui.registerSlot('playerbar:right', buttonElement, 20);
```

### 4. Event Subscriptions
Audion emits events through `api.on`:
* `trackChange`: `({ track, previousTrack }) => { ... }`
* `playStateChange`: `({ isPlaying }) => { ... }`
* `timeUpdate`: `({ currentTime, duration }) => { ... }`
* `volumeChange`: `({ volume }) => { ... }`

---

## 🌐 Publishing to Audion Marketplace

Audion features an automated marketplace runner that indexes plugins from GitHub:

1. Create a public repository on GitHub (e.g. `https://github.com/kesavarajsamipillai/audion-companion`).
2. Push your code with `plugin.json` and `index.js` in the default branch (`main` or `master`).
3. In your GitHub repository's **About** section (gear icon on the right side):
   * Add the topic: **`audion-plugins`**.
4. The Audion Marketplace indexer runner automatically discovers repositories with this topic and registers them into the global registry (`dupitydumb/audion-plugins`).
