# Wave

Control any video with hand gestures through your webcam. Works on YouTube, NPTEL, Coursera and most sites with an HTML5 video. Built for when your hands are busy: eating, cooking, leaning back.

**Runs entirely on your device.** Camera frames are analysed in memory by Google's MediaPipe model (bundled in this repo) and thrown away. Nothing is recorded, stored or sent anywhere. No account, no server, no analytics.

## Gestures

Hold a gesture for half a second.

| Gesture | Action |
|---|---|
| ✋ Open palm | Play / pause |
| 👍 Thumbs up | Volume up (hold to repeat) |
| 👎 Thumbs down | Volume down (hold to repeat) |
| ✌️ Peace sign | Forward 10 s |
| ☝️ Pointing up | Back 10 s |
| ✊ Fist | Mute / unmute |

## Install (unpacked)

1. `git clone https://github.com/NAMAN-VERMA-02/wave`
2. Open `chrome://extensions`, enable **Developer mode**, **Load unpacked**, pick the folder.
3. Wave's options page opens from the extension menu: press **Allow camera and try gestures** once and try each gesture. The box shows what the camera sees.
4. Play a video. Alt+W turns Wave on and off.

## How it works

- `content.js` reports when the page's main video plays or pauses, and applies actions to it.
- `background.js` starts a hidden camera page only while a video is playing (or was paused less than 2 minutes ago, so a palm can resume it). Chrome's camera indicator is on whenever it runs.
- `camera.js` reads frames and runs the gesture model. Frames are read as a stream because timers in hidden pages get throttled.
- `engine.js` turns per-frame results into actions: 0.5 s hold, 1 s cooldown, repeat for volume, minimum 60% confidence. It also drops to 2 analysed frames per second until a hand is seen, which saves battery. It has no browser code, so `test/engine.test.js` runs it without a camera.

## Limits (v0.1)

- Not tested on a camera by the author before release; please open an issue with your gesture misfires.
- Seeking on Netflix and similar DRM players may not work, because their players ignore direct time changes.
- One person, one hand, decent light. Chrome / Chromium only.
- Roadmap: look-away pause, sleep catch, air scrub, bookmarks.

## Develop

```bash
node --test test/engine.test.js
```

Bundled: `@mediapipe/tasks-vision` 1.2.2 (`vendor/`) and Google's `gesture_recognizer.task` model (`models/`), both Apache-2.0.

MIT
