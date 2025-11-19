console.log("[CS] content script loaded");

let currentAudio = null;

const DEFAULT_PLAYBACK_RATE = 1.3;   // 標準
const RATE_STEP = 0.1;               // 1回の増減幅
const MIN_RATE = 0.5;
const MAX_RATE = 2.5;

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  console.log("[CS] received message:", message);

  // ★ ショートカットから来た「選択テキストちょうだい」に応える
  if (message.type === "ZUNDAMON_REQUEST_SELECTION") {
    const sel = window.getSelection ? window.getSelection().toString() : "";
    const text = (sel || "").trim();
    console.log("[CS] selection:", text);

    chrome.runtime.sendMessage({
      type: "ZUNDAMON_READ_TEXT",
      text
    });

    return; // ここで抜けてOK
  }

  if (message.type === "ZUNDAMON_PLAY" && message.audioBytes) {
    try {
      // Array<number> → Uint8Array → Blob
      const u8 = new Uint8Array(message.audioBytes);
      console.log("[CS] bytes length:", u8.length);

      const blob = new Blob([u8], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      console.log("[CS] play url:", url);

      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }

      currentAudio = new Audio(url);
      currentAudio.playbackRate = DEFAULT_PLAYBACK_RATE;  // ★追加
      currentAudio.play().catch(function (err) {
        console.error("[CS] audio play error:", err);
      });

    } catch (e) {
      console.error("[CS] exception:", e);
    }
  }
});

window.addEventListener("keydown", function (e) {
  if (!currentAudio) return; // 音がない時は何もしない

  // Alt+Shift+↑ で早く
  if (e.altKey && e.shiftKey && e.key === "ArrowUp") {
    e.preventDefault();
    const next = Math.min(MAX_RATE, currentAudio.playbackRate + RATE_STEP);
    currentAudio.playbackRate = next;
    console.log("[CS] speed up:", next);
  }

  // Alt+Shift+↓ でゆっくり
  if (e.altKey && e.shiftKey && e.key === "ArrowDown") {
    e.preventDefault();
    const next = Math.max(MIN_RATE, currentAudio.playbackRate - RATE_STEP);
    currentAudio.playbackRate = next;
    console.log("[CS] speed down:", next);
  }

  // Alt+Shift+Space で再生/一時停止切り替え
  if (e.altKey && e.shiftKey && e.code === "Space") {
    e.preventDefault();
    if (currentAudio.paused) {
      currentAudio.play().catch(function (err) {
        console.error("[CS] resume error:", err);
      });
    } else {
      currentAudio.pause();
    }
  }
});
