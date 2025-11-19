const ENDPOINT = "http://localhost:50021";
const ZUNDAMON_SPEAKER = 3;

// --- インストール時：右クリックメニュー（残したいならこれもそのまま） ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "zundamon-read",
    title: "ずんだもんで読み上げ",
    contexts: ["selection"]
  });
});

// --- 右クリックメニューからの読み上げ（残したくなければこのブロックごと消していい） ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "zundamon-read") return;

  const text = (info.selectionText || "").trim();
  console.log("[BG] context menu text:", text);
  if (!text) return;

  try {
    const audioBytes = await synthesizeWithVoiceVox(text);
    if (tab && tab.id != null) {
      chrome.tabs.sendMessage(tab.id, {
        type: "ZUNDAMON_PLAY",
        audioBytes
      });
    }
  } catch (e) {
    console.error("[BG] VOICEVOX error:", e);
  }
});

// --- ショートカットコマンドを受け取る ---
chrome.commands.onCommand.addListener((command) => {
  if (command !== "zundamon-read-selection") return;

  console.log("[BG] command zundamon-read-selection");

  // アクティブタブを探して「選択テキストくれ」と投げる
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;

    chrome.tabs.sendMessage(tab.id, {
      type: "ZUNDAMON_REQUEST_SELECTION"
    }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.warn("[BG] sendMessage error:", err.message);
      }
    });
  });
});

// --- content.js から「このテキスト読んで」とメッセージが来る窓口 ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ZUNDAMON_READ_TEXT") {
    const text = (message.text || "").trim();
    console.log("[BG] READ_TEXT:", text);
    if (!text) return;

    (async () => {
      try {
        const audioBytes = await synthesizeWithVoiceVox(text);
        if (sender.tab && sender.tab.id != null) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "ZUNDAMON_PLAY",
            audioBytes
          });
        }
      } catch (e) {
        console.error("[BG] VOICEVOX error in READ_TEXT:", e);
      }
    })();

    // 非同期なので true を返しておくと安心（ここでは必須じゃないけど慣習的に）
    return true;
  }
});

// --- VOICEVOX で合成して「バイト配列(Array<number>)」を返す ---
async function synthesizeWithVoiceVox(text) {
  console.log("[BG] synth start");

  const params = new URLSearchParams({
    text,
    speaker: String(ZUNDAMON_SPEAKER)
  });

  // 1. audio_query
  const queryRes = await fetch(`${ENDPOINT}/audio_query?${params.toString()}`, {
    method: "POST"
  });
  if (!queryRes.ok) {
    throw new Error("audio_query failed: " + queryRes.status);
  }
  const query = await queryRes.json();

  // ★ 話速を少し速くするならここで調整（いまは1.0）
  const SPEED_SCALE = 1.3; // 好きに 1.1, 1.2 とかにしてOK
  query.speedScale = SPEED_SCALE;

  // 2. synthesis
  const synthRes = await fetch(`${ENDPOINT}/synthesis?speaker=${ZUNDAMON_SPEAKER}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query)
  });
  if (!synthRes.ok) {
    throw new Error("synthesis failed: " + synthRes.status);
  }

  const arrayBuf = await synthRes.arrayBuffer();
  const u8 = new Uint8Array(arrayBuf);
  const bytes = Array.from(u8);
  console.log("[BG] audio bytes length:", bytes.length);
  return bytes;
}
