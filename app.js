const STORAGE_KEYS = {
  chat: "sora_gm_chat_v04",
  player: "sora_gm_player_v04",
  gm: "sora_gm_gm_v04",
  history: "sora_gm_history_v04",
  boardImage: "sora_gm_board_image_v04",
  tokens: "sora_gm_tokens_v04",
  windows: "sora_gm_windows_v04",
  characterJsonUrl: "sora_gm_character_json_url_v042",
  characterJsonFileName: "sora_gm_character_json_file_name_v042",
  characterJsonLoadMode: "sora_gm_character_json_load_mode_v042",
  playerJsonFileName: "sora_gm_player_json_file_name_v043"
};

const CHECK_TYPES = {
  manual: { label: "手入力", checkName: "", playerKey: null },
  accuracy: { label: "命中力判定", checkName: "命中力判定", playerKey: "accuracy" },
  evasion: { label: "回避力判定", checkName: "回避力判定", playerKey: "evasion" },
  magic: { label: "魔法行使判定", checkName: "魔法行使判定", playerKey: "magic" },
  vitality: { label: "生命抵抗力判定", checkName: "生命抵抗力判定", playerKey: "vitality" },
  spirit: { label: "精神抵抗力判定", checkName: "精神抵抗力判定", playerKey: "spirit" },
  search: { label: "探索判定", checkName: "探索判定", playerKey: "search" },
  custom: { label: "その他の行為判定", checkName: "行為判定", playerKey: null }
};

let selectedTokenId = null;
let pendingTokenImage = "";
let latestDiceResult = null;
let topZ = 50;

function $(id) { return document.getElementById(id); }
function bind(id, eventName, handler) {
  const el = $(id);
  if (el) el.addEventListener(eventName, handler);
}
function nowText() {
  return new Date().toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function loadJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function escapeHtml(text) {
  return String(text ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function showToast(text) {
  const toast = $("toast");
  toast.textContent = text;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 1600);
}

function bringToFront(win) {
  topZ += 1;
  win.style.zIndex = topZ;
}
function openWindow(id) {
  const win = $(id);
  win.classList.remove("hidden-window");
  bringToFront(win);
  saveWindowState();
}
function closeWindow(id) {
  $(id).classList.add("hidden-window");
  saveWindowState();
}
function saveWindowState() {
  const state = {};
  document.querySelectorAll(".window").forEach(win => {
    state[win.id] = {
      hidden: win.classList.contains("hidden-window"),
      left: win.style.left,
      top: win.style.top,
      right: win.style.right,
      bottom: win.style.bottom,
      width: win.style.width,
      height: win.style.height,
      zIndex: win.style.zIndex
    };
  });
  saveJson(STORAGE_KEYS.windows, state);
}
function restoreWindowState() {
  const state = loadJson(STORAGE_KEYS.windows, {});
  Object.entries(state).forEach(([id, s]) => {
    const win = $(id);
    if (!win) return;
    win.classList.toggle("hidden-window", !!s.hidden);
    if (s.left) win.style.left = s.left;
    if (s.top) win.style.top = s.top;
    if (s.right) win.style.right = s.right;
    if (s.bottom) win.style.bottom = s.bottom;
    if (s.width) win.style.width = s.width;
    if (s.height) win.style.height = s.height;
    if (s.zIndex) win.style.zIndex = s.zIndex;
  });
}
function initWindowResize() {
  document.querySelectorAll(".window").forEach(win => {
    if (win.querySelector(".resize-handle")) return;

    const handle = document.createElement("div");
    handle.className = "resize-handle";
    handle.title = "サイズ変更";
    win.appendChild(handle);

    handle.addEventListener("pointerdown", e => {
      if (window.matchMedia("(max-width: 820px)").matches) return;
      e.preventDefault();
      e.stopPropagation();
      bringToFront(win);

      const startX = e.clientX;
      const startY = e.clientY;
      const rect = win.getBoundingClientRect();

      const move = ev => {
        const nextWidth = Math.max(260, rect.width + ev.clientX - startX);
        const nextHeight = Math.max(180, rect.height + ev.clientY - startY);
        win.style.width = nextWidth + "px";
        win.style.height = nextHeight + "px";
      };

      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        saveWindowState();
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  });
}

function initWindowDrag() {
  document.querySelectorAll(".window").forEach(win => {
    bringToFront(win);
    win.addEventListener("pointerdown", () => bringToFront(win));
    const bar = win.querySelector(".window-titlebar");
    bar.addEventListener("pointerdown", e => {
      if (e.target.closest("[data-close-window]")) return;
      if (window.matchMedia("(max-width: 820px)").matches) return;
      e.preventDefault();
      bringToFront(win);
      const startX = e.clientX, startY = e.clientY;
      const rect = win.getBoundingClientRect();
      win.style.right = "auto";
      win.style.bottom = "auto";
      const move = ev => {
        win.style.left = Math.max(0, rect.left + ev.clientX - startX) + "px";
        win.style.top = Math.max(0, rect.top + ev.clientY - startY) + "px";
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        saveWindowState();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  });
}

function addChat({ speaker, type, text }) {
  const chat = loadJson(STORAGE_KEYS.chat, []);
  chat.push({ id: crypto.randomUUID(), time: nowText(), speaker, type, text });
  saveJson(STORAGE_KEYS.chat, chat);
  renderChat();
}
function renderChat() {
  const chat = loadJson(STORAGE_KEYS.chat, []);
  const log = $("chatLog");
  if (!log) return;
  if (!chat.length) {
    log.innerHTML = `<p class="note">チャットログはまだありません。</p>`;
    return;
  }
  log.innerHTML = chat.map(item => `
    <div class="log-item speaker-${escapeHtml(item.speaker)}">
      <div class="log-meta">${escapeHtml(item.time)} / ${escapeHtml(item.speaker)} / ${escapeHtml(item.type)}</div>
      <div>${escapeHtml(item.text).replaceAll("\n", "<br>")}</div>
    </div>
  `).join("");
  log.scrollTop = log.scrollHeight;
}
function sendChat() {
  const speaker = $("speakerInput").value.trim() || "PLAYER";
  const type = $("chatTypeInput").value;
  const text = $("chatTextInput").value.trim();
  if (!text) { alert("本文を入力してください。"); return; }
  addChat({ speaker, type, text });
  $("chatTextInput").value = "";
}
function copyChatLog() {
  const chat = loadJson(STORAGE_KEYS.chat, []);
  const text = chat.map(c => `[${c.time} ${c.speaker}/${c.type}]\n${c.text}`).join("\n\n");
  navigator.clipboard.writeText(text);
  alert("コピーしました。");
}
function clearChat() {
  if (!confirm("チャットログを削除しますか？")) return;
  localStorage.removeItem(STORAGE_KEYS.chat);
  renderChat();
}

function getTokens() { return loadJson(STORAGE_KEYS.tokens, []); }
function saveTokens(tokens) { saveJson(STORAGE_KEYS.tokens, tokens); }
function getSelectedToken() { return getTokens().find(t => t.id === selectedTokenId) || null; }
function selectToken(id) {
  selectedTokenId = id;
  const token = getSelectedToken();
  if (token) {
    $("tokenNameInput").value = token.name || "";
    $("tokenTypeInput").value = token.type || "PLAYER";
    $("tokenHpInput").value = token.hp || "";
    $("tokenMemoInput").value = token.memo || "";
    $("speakerInput").value = token.name || "PLAYER";
  }
  renderTokens();
}
function addToken() {
  const name = $("tokenNameInput").value.trim();
  if (!name) { alert("コマ名を入力してください。"); return; }
  const tokens = getTokens();
  const token = {
    id: crypto.randomUUID(),
    name,
    type: $("tokenTypeInput").value,
    hp: $("tokenHpInput").value,
    memo: $("tokenMemoInput").value,
    image: pendingTokenImage,
    x: 50,
    y: 50
  };
  tokens.push(token);
  saveTokens(tokens);
  selectedTokenId = token.id;
  pendingTokenImage = "";
  $("tokenImageInput").value = "";
  renderTokens();
  addChat({ speaker: "SYSTEM", type: "メモ", text: `コマ「${name}」を盤面に追加しました。` });
}
function updateToken() {
  const token = getSelectedToken();
  if (!token) { alert("更新するコマを選択してください。"); return; }
  const tokens = getTokens();
  const t = tokens.find(x => x.id === token.id);
  t.name = $("tokenNameInput").value.trim() || t.name;
  t.type = $("tokenTypeInput").value;
  t.hp = $("tokenHpInput").value;
  t.memo = $("tokenMemoInput").value;
  if (pendingTokenImage) {
    t.image = pendingTokenImage;
    pendingTokenImage = "";
    $("tokenImageInput").value = "";
  }
  saveTokens(tokens);
  renderTokens();
}
function deleteToken() {
  const token = getSelectedToken();
  if (!token) { alert("削除するコマを選択してください。"); return; }
  if (!confirm(`「${token.name}」を削除しますか？`)) return;
  saveTokens(getTokens().filter(t => t.id !== token.id));
  selectedTokenId = null;
  renderTokens();
}
function renderTokens() {
  const tokens = getTokens();
  const layer = $("tokenLayer");
  layer.innerHTML = tokens.map(t => {
    const content = t.image ? `<img src="${t.image}" alt="${escapeHtml(t.name)}">` : escapeHtml((t.name || "?").slice(0, 2));
    return `<button class="token ${escapeHtml(t.type)} ${t.id === selectedTokenId ? "selected" : ""}"
      data-token-id="${t.id}" style="left:${t.x}%; top:${t.y}%;">
      ${content}<span class="token-label">${escapeHtml(t.name)}</span>
    </button>`;
  }).join("");
  document.querySelectorAll(".token").forEach(btn => {
    btn.addEventListener("pointerdown", tokenPointerDown);
    btn.addEventListener("click", e => { e.stopPropagation(); selectToken(btn.dataset.tokenId); });
  });

  const selected = getSelectedToken();
  $("selectedTokenInfo").textContent = selected
    ? `選択中：${selected.name} / ${selected.type}${selected.hp ? " / HP:" + selected.hp : ""}\n${selected.memo || ""}`
    : "選択中コマ：なし";

  $("tokenList").innerHTML = tokens.length ? tokens.map(t => `
    <div class="token-row ${t.id === selectedTokenId ? "selected" : ""}" data-token-row="${t.id}">
      <strong>${escapeHtml(t.name)}</strong> / ${escapeHtml(t.type)}
      ${t.hp ? `<br>HP：${escapeHtml(t.hp)}` : ""}
      ${t.memo ? `<br>${escapeHtml(t.memo)}` : ""}
    </div>`).join("") : `<p class="note">コマはまだありません。</p>`;
  document.querySelectorAll("[data-token-row]").forEach(row => row.addEventListener("click", () => selectToken(row.dataset.tokenRow)));
}
function tokenPointerDown(e) {
  e.preventDefault();
  e.stopPropagation();

  const id = e.currentTarget.dataset.tokenId;
  const tokenEl = e.currentTarget;
  const board = $("board");

  selectToken(id);
  tokenEl.setPointerCapture?.(e.pointerId);

  let latestX = null;
  let latestY = null;
  let moved = false;

  const move = ev => {
    const rect = board.getBoundingClientRect();

    latestX = ((ev.clientX - rect.left) / rect.width) * 100;
    latestY = ((ev.clientY - rect.top) / rect.height) * 100;

    latestX = Math.max(2, Math.min(98, latestX));
    latestY = Math.max(2, Math.min(98, latestY));

    tokenEl.style.left = latestX + "%";
    tokenEl.style.top = latestY + "%";
    moved = true;
  };

  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);

    if (!moved || latestX === null || latestY === null) {
      return;
    }

    const tokens = getTokens();
    const token = tokens.find(t => t.id === id);

    if (!token) return;

    token.x = latestX;
    token.y = latestY;

    saveTokens(tokens);
    renderTokens();
    showToast("コマを移動しました");
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function renderBoardImage() {
  const dataUrl = localStorage.getItem(STORAGE_KEYS.boardImage);
  if (dataUrl) {
    $("boardImage").src = dataUrl;
    $("boardImage").style.display = "block";
    $("emptyBoard").style.display = "none";
  } else {
    $("boardImage").removeAttribute("src");
    $("boardImage").style.display = "none";
    $("emptyBoard").style.display = "grid";
  }
}
function handleBoardImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem(STORAGE_KEYS.boardImage, String(reader.result || ""));
    renderBoardImage();
  };
  reader.readAsDataURL(file);
}
function handleTokenImage(file) {
  const reader = new FileReader();
  reader.onload = () => { pendingTokenImage = String(reader.result || ""); };
  reader.readAsDataURL(file);
}

function savePlayer() {
  const player = {
    name: $("pcName").value,
    race: $("pcRace").value,
    level: $("pcLevel").value,
    defense: $("pcDefense").value,
    hpNow: $("pcHpNow").value,
    hpMax: $("pcHpMax").value,
    mpNow: $("pcMpNow").value,
    mpMax: $("pcMpMax").value,
    accuracy: $("pcAccuracy").value,
    evasion: $("pcEvasion").value,
    vitality: $("pcVitality").value,
    spirit: $("pcSpirit").value,
    magic: $("pcMagic").value,
    search: $("pcSearch").value,
    initiative: $("pcInitiative").value,
    monsterLore: $("pcMonsterLore").value,
    intBonus: $("pcIntBonus").value,
    mndBonus: $("pcMndBonus").value,
    skills: $("pcSkills").value,
    magicPowers: $("pcMagicPowers").value,
    weapons: $("pcWeapons").value,
    equipments: $("pcEquipments").value,
    memo: $("pcMemo").value
  };
  saveJson(STORAGE_KEYS.player, player);
  alert("PLAYER保存しました。");
}
function loadPlayerToForm() {
  const p = loadJson(STORAGE_KEYS.player, {});
  for (const [id, key] of Object.entries({
    pcName:"name", pcRace:"race", pcLevel:"level", pcDefense:"defense", pcHpNow:"hpNow", pcHpMax:"hpMax",
    pcMpNow:"mpNow", pcMpMax:"mpMax", pcAccuracy:"accuracy", pcEvasion:"evasion", pcVitality:"vitality",
    pcSpirit:"spirit", pcMagic:"magic", pcSearch:"search", pcInitiative:"initiative", pcMonsterLore:"monsterLore",
    pcIntBonus:"intBonus", pcMndBonus:"mndBonus", pcSkills:"skills", pcMagicPowers:"magicPowers",
    pcWeapons:"weapons", pcEquipments:"equipments", pcMemo:"memo"
  })) {
    const el = $(id);
    if (el) el.value = p[key] ?? "";
  }
}
function saveGm() {
  const gm = {
    scenario:$("gmScenario").value, location:$("gmLocation").value, objective:$("gmObjective").value,
    publicInfo:$("gmPublicInfo").value, hiddenInfo:$("gmHiddenInfo").value, terrain:$("gmTerrain").value,
    npc:$("gmNpc").value, enemy:$("gmEnemy").value, trigger:$("gmTrigger").value, choices:$("gmChoices").value,
    ruling:$("gmRuling").value, needCheck:$("gmNeedCheck").value
  };
  saveJson(STORAGE_KEYS.gm, gm);
  alert("GM保存しました。");
}
function loadGmToForm() {
  const gm = loadJson(STORAGE_KEYS.gm, {});
  for (const [id, key] of Object.entries({
    gmScenario:"scenario", gmLocation:"location", gmObjective:"objective", gmPublicInfo:"publicInfo",
    gmHiddenInfo:"hiddenInfo", gmTerrain:"terrain", gmNpc:"npc", gmEnemy:"enemy", gmTrigger:"trigger",
    gmChoices:"choices", gmRuling:"ruling", gmNeedCheck:"needCheck"
  })) $(id).value = gm[key] ?? "";
}
function sendGmFieldToChat(fieldId, type) {
  const text = $(fieldId).value.trim();
  if (!text) { alert("内容が空です。"); return; }
  addChat({ speaker:"GM", type, text });
}

function getPlayerValue(key) { return loadJson(STORAGE_KEYS.player, {})[key]; }
function getCheckTypeInfo(type) { return CHECK_TYPES[type] || CHECK_TYPES.manual; }
function applyCheckType() {
  const info = getCheckTypeInfo($("checkTypeSelect").value);
  if (info.checkName) $("checkNameInput").value = info.checkName;
  if (info.playerKey) {
    const v = getPlayerValue(info.playerKey);
    if (v !== undefined && v !== null && v !== "") $("baseValueInput").value = v;
  }
}
function applyPlayerValue() {
  const info = getCheckTypeInfo($("checkTypeSelect").value);
  if (!info.playerKey) { $("diceError").textContent = "この判定は手入力です。"; return; }
  const v = getPlayerValue(info.playerKey);
  if (v === undefined || v === null || v === "") { $("diceError").textContent = "PLAYER情報が未登録です。"; return; }
  $("checkNameInput").value = info.checkName;
  $("baseValueInput").value = v;
  $("diceError").textContent = `PLAYER情報から${info.label} ${v} を反映しました。`;
}
function rollD6() { return Math.floor(Math.random() * 6) + 1; }
function numRequired(v, label) {
  if (v === "") throw new Error(`${label}を入力してください`);
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`${label}は数値で入力してください`);
  return n;
}
function numOptional(v, label, def = null) {
  if (v === "") return def;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`${label}は数値で入力してください`);
  return n;
}
function createCheckResult({ checkName, base, modifier, target }) {
  const d1 = rollD6(), d2 = rollD6(), total = d1 + d2, achievement = total + base + modifier;
  const isAutoFail = d1 === 1 && d2 === 1, isAutoSuccess = d1 === 6 && d2 === 6;
  let result, exp = 0;
  if (isAutoFail) { result = "自動失敗"; exp = 50; }
  else if (isAutoSuccess) result = "自動成功";
  else if (target === null) result = "目標値未設定";
  else result = achievement >= target ? "成功" : "失敗";
  return { id:crypto.randomUUID(), time:nowText(), checkName, d1, d2, total, base, modifier, target, achievement, result, isAutoFail, isAutoSuccess, exp };
}
function saveDiceHistory(item) {
  const history = loadJson(STORAGE_KEYS.history, []);
  history.unshift(item);
  saveJson(STORAGE_KEYS.history, history.slice(0, 50));
}
function formatDiceForChat(r) {
  return `【${r.checkName}】出目：${r.d1}+${r.d2}=${r.total} / 基準値：${r.base} / 修正値：${r.modifier >= 0 ? "+" : ""}${r.modifier} / 達成値：${r.achievement} / 結果：${r.result}${r.exp ? " / 経験点+50" : ""}`;
}
function formatDiceBlock(r) {
  return `【${r.checkName}】
出目：${r.d1} + ${r.d2} = ${r.total}
基準値：${r.base}
修正値：${r.modifier >= 0 ? "+" : ""}${r.modifier}
達成値：${r.achievement}
目標値：${r.target === null ? "なし" : r.target}
結果：${r.result}${r.exp ? "\n経験点：+50" : ""}`;
}
function rollCheck() {
  $("diceError").textContent = "";
  try {
    const info = getCheckTypeInfo($("checkTypeSelect").value);
    const checkName = $("checkNameInput").value.trim() || info.checkName || "行為判定";
    const base = numRequired($("baseValueInput").value, "基準値");
    const modifier = numOptional($("modifierInput").value, "修正値", 0);
    const target = numOptional($("targetValueInput").value, "目標値", null);
    const result = createCheckResult({ checkName, base, modifier, target });
    latestDiceResult = result;
    saveDiceHistory(result);
    $("diceResult").textContent = formatDiceBlock(result);
    $("diceResult").className = "result-box " + (result.isAutoFail || result.isAutoSuccess ? "result-special" : result.result === "成功" ? "result-success" : result.result === "失敗" ? "result-fail" : "");
    addChat({ speaker: $("speakerInput").value.trim() || "PLAYER", type:"判定結果", text: formatDiceForChat(result) });
    showToast("判定結果をチャットへ追加しました");
  } catch (e) {
    $("diceError").textContent = e.message;
  }
}

function pickFirst(data, keys) {
  for (const key of keys) if (data?.[key] !== undefined && data?.[key] !== null && data?.[key] !== "") return data[key];
  return "";
}
function importYtsheetJsonText() {
  const raw = $("ytsheetJsonInput").value.trim();
  if (!raw) { alert("JSONを貼り付けてください。"); return; }
  try { applyYtsheetData(JSON.parse(raw)); }
  catch { $("jsonImportResult").textContent = "JSONの読み込みに失敗しました。"; }
}

function buildCharacterJsonUrl() {
  const mode = $("characterJsonLoadMode")?.value || "url";

  if (mode === "filename") {
    const fileName = $("characterJsonFileNameInput").value.trim();
    if (!fileName) return "";
    return `./data/${fileName}`;
  }

  return $("characterJsonUrlInput").value.trim();
}

async function loadCharacterJsonFromUrl() {
  const mode = $("characterJsonLoadMode")?.value || "url";
  const directUrl = $("characterJsonUrlInput").value.trim();
  const fileName = $("characterJsonFileNameInput").value.trim();
  const url = buildCharacterJsonUrl();

  if (!url) {
    $("jsonImportResult").textContent = "JSON URL、またはdata配下のファイル名を入力してください。";
    return;
  }

  try {
    $("jsonImportResult").textContent = "JSONを読み込み中です...";
    localStorage.setItem(STORAGE_KEYS.characterJsonLoadMode, mode);
    localStorage.setItem(STORAGE_KEYS.characterJsonUrl, directUrl);
    localStorage.setItem(STORAGE_KEYS.characterJsonFileName, fileName);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    $("ytsheetJsonInput").value = JSON.stringify(data, null, 2);
    applyYtsheetData(data);
    $("jsonImportResult").textContent = `URLから読み込みました：${url}`;
  } catch (error) {
    $("jsonImportResult").textContent =
      `URLからJSONを読み込めませんでした。URL・ファイル名・JSON形式を確認してください。詳細：${error.message}`;
  }
}

function loadCharacterJsonUrlToForm() {
  const savedUrl = localStorage.getItem(STORAGE_KEYS.characterJsonUrl);
  const savedFileName = localStorage.getItem(STORAGE_KEYS.characterJsonFileName);
  const savedMode = localStorage.getItem(STORAGE_KEYS.characterJsonLoadMode);

  if ($("characterJsonUrlInput") && savedUrl) {
    $("characterJsonUrlInput").value = savedUrl;
  }

  if ($("characterJsonFileNameInput") && savedFileName) {
    $("characterJsonFileNameInput").value = savedFileName;
  }

  if ($("characterJsonLoadMode") && savedMode) {
    $("characterJsonLoadMode").value = savedMode;
  }
}

function getGitHubRepoInfoFromPagesUrl() {
  const host = window.location.hostname;
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  if (!host.endsWith(".github.io")) {
    return null;
  }

  const owner = host.split(".")[0];
  const repo = pathParts[0];

  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

async function fetchDataJsonFiles() {
  const select = $("playerJsonSelect");
  const result = $("playerJsonLoadResult");

  if (!select || !result) return;

  result.textContent = "data配下のJSON一覧を取得中です...";
  select.innerHTML = `<option value="">取得中...</option>`;

  const repoInfo = getGitHubRepoInfoFromPagesUrl();

  if (!repoInfo) {
    select.innerHTML = `<option value="">自動取得不可</option>`;
    result.textContent = "GitHub PagesのURLからリポジトリを判定できません。ファイル名を直接入力してください。";
    return;
  }

  try {
    const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/data`;
    const response = await fetch(apiUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const items = await response.json();
    const jsonFiles = items
      .filter(item => item.type === "file" && item.name.toLowerCase().endsWith(".json"))
      .map(item => item.name)
      .sort((a, b) => a.localeCompare(b, "ja"));

    if (jsonFiles.length === 0) {
      select.innerHTML = `<option value="">JSONファイルなし</option>`;
      result.textContent = "data配下にJSONファイルが見つかりませんでした。";
      return;
    }

    select.innerHTML = jsonFiles
      .map(name => `<option value="./data/${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join("");

    result.textContent = `${jsonFiles.length}件のJSONを取得しました。`;
  } catch (error) {
    select.innerHTML = `<option value="">取得失敗</option>`;
    result.textContent = `JSON一覧の取得に失敗しました。ファイル名を直接入力してください。詳細：${error.message}`;
  }
}

async function loadPlayerJsonFromPath(path) {
  const result = $("playerJsonLoadResult");

  if (!path) {
    if (result) result.textContent = "読み込むJSONを選択、またはファイル名を入力してください。";
    return;
  }

  try {
    if (result) result.textContent = `JSONを読み込み中です：${path}`;

    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    $("ytsheetJsonInput").value = JSON.stringify(data, null, 2);
    applyYtsheetData(data);

    localStorage.setItem(STORAGE_KEYS.characterJsonUrl, path);
    if (path.startsWith("./data/")) {
      localStorage.setItem(STORAGE_KEYS.playerJsonFileName, path.replace("./data/", ""));
    }

    if (result) result.textContent = `PLAYER情報へ読み込みました：${path}`;
  } catch (error) {
    if (result) result.textContent = `JSONを読み込めませんでした。パス・ファイル名・JSON形式を確認してください。詳細：${error.message}`;
  }
}

function loadSelectedPlayerJson() {
  const select = $("playerJsonSelect");
  const value = select ? select.value : "";
  loadPlayerJsonFromPath(value);
}

function loadTypedPlayerJson() {
  const input = $("playerJsonFileNameInput");
  const fileName = input ? input.value.trim() : "";

  if (!fileName) {
    $("playerJsonLoadResult").textContent = "ファイル名を入力してください。例：nagyuma.json";
    return;
  }

  const path = fileName.startsWith("./") || fileName.startsWith("http")
    ? fileName
    : `./data/${fileName}`;

  localStorage.setItem(STORAGE_KEYS.playerJsonFileName, fileName);
  loadPlayerJsonFromPath(path);
}

function loadPlayerJsonFileNameToForm() {
  const savedFileName = localStorage.getItem(STORAGE_KEYS.playerJsonFileName);
  if ($("playerJsonFileNameInput") && savedFileName) {
    $("playerJsonFileNameInput").value = savedFileName;
  }
}
function cleanYutorizeText(value) {
  return String(value ?? "")
    .replaceAll("&lt;br&gt;", "\n")
    .replaceAll("<br>", "\n")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function collectYutorizeSkills(data) {
  const skillMap = [
    ["ソーサラー", "lvSor"], ["コンジャラー", "lvCon"], ["ウィザード", "lvWiz"],
    ["プリースト", "lvPri"], ["フェアリーテイマー", "lvFai"], ["マギテック", "lvMag"],
    ["デーモンルーラー", "lvDem"], ["ドルイド", "lvDru"], ["アビスゲイザー", "lvAby"],
    ["ファイター", "lvFig"], ["グラップラー", "lvGra"], ["フェンサー", "lvFen"], ["シューター", "lvSho"],
    ["スカウト", "lvSco"], ["レンジャー", "lvRan"], ["セージ", "lvSag"], ["エンハンサー", "lvEnh"],
    ["バード", "lvBar"], ["ライダー", "lvRid"], ["アルケミスト", "lvAlc"], ["ウォーリーダー", "lvWar"],
    ["ジオマンサー", "lvGeo"], ["ダークハンター", "lvDar"]
  ];

  return skillMap
    .map(([label, key]) => {
      const value = data[key];
      return value && value !== "0" ? `${label}${value}` : "";
    })
    .filter(Boolean)
    .join(" / ");
}

function collectYutorizeMagicPowers(data) {
  const powerMap = [
    ["真語魔法", "magicPowerSor"], ["操霊魔法", "magicPowerCon"], ["深智魔法", "magicPowerWiz"],
    ["神聖魔法", "magicPowerPri"], ["妖精魔法", "magicPowerFai"], ["魔動機術", "magicPowerMag"],
    ["召異魔法", "magicPowerDem"], ["森羅魔法", "magicPowerDru"], ["奈落魔法", "magicPowerAby"],
    ["闇狩魔法", "magicPowerDar"]
  ];

  return powerMap
    .map(([label, key]) => {
      const value = data[key];
      return value && value !== "0" ? `${label}:${value}` : "";
    })
    .filter(Boolean)
    .join(" / ");
}

function collectYutorizeWeapons(data) {
  const num = Number(data.weaponNum || 0);
  const lines = [];

  for (let i = 1; i <= Math.max(num, 5); i++) {
    const name = data[`weapon${i}Name`];
    if (!name) continue;

    const acc = data[`weapon${i}AccTotal`] ?? data[`weapon${i}Acc`] ?? "";
    const dmg = data[`weapon${i}DmgTotal`] ?? data[`weapon${i}Dmg`] ?? "";
    const rate = data[`weapon${i}Rate`] ?? "";
    const crit = data[`weapon${i}Crit`] ?? "";
    const usage = data[`weapon${i}Usage`] ?? "";
    const note = cleanYutorizeText(data[`weapon${i}Note`] ?? "");

    lines.push(`${name}${usage ? `/${usage}` : ""}${acc !== "" ? ` 命中補正:${acc}` : ""}${rate ? ` 威力:${rate}` : ""}${crit ? ` C:${crit}` : ""}${dmg !== "" ? ` 追加D:${dmg}` : ""}${note ? `\n  ${note}` : ""}`);
  }

  return lines.join("\n");
}

function collectYutorizeEquipments(data) {
  const lines = [];

  for (let i = 1; i <= 5; i++) {
    const name = data[`armour${i}Name`];
    if (!name) continue;
    const category = data[`armour${i}Category`] ?? "";
    const def = data[`armour${i}Def`] ?? "";
    const note = cleanYutorizeText(data[`armour${i}Note`] ?? "");
    lines.push(`${category ? category + "：" : ""}${name}${def ? ` 防護:${def}` : ""}${note ? `\n  ${note}` : ""}`);
  }

  const accessorySlots = [
    ["頭", "accessoryHeadName"], ["顔", "accessoryFaceName"], ["耳", "accessoryEarName"], ["首", "accessoryNeckName"],
    ["背中", "accessoryBackName"], ["右手", "accessoryHandRName"], ["左手", "accessoryHandLName"], ["腰", "accessoryWaistName"],
    ["足", "accessoryFootName"], ["その他", "accessoryOtherName"]
  ];

  for (const [label, key] of accessorySlots) {
    const name = data[key];
    if (!name) continue;
    const noteKey = key.replace("Name", "Note");
    const note = cleanYutorizeText(data[noteKey] ?? "");
    lines.push(`${label}：${name}${note ? `\n  ${note}` : ""}`);
  }

  return lines.join("\n");
}

function deriveYutorizeValues(data) {
  const firstWeaponAcc = data.weapon1AccTotal ?? data.weapon1Acc ?? "";
  const accuracy = firstWeaponAcc !== "" && data.level
    ? String(Number(data.level || 0) + Number(data.bonusDex || 0) + Number(firstWeaponAcc || 0))
    : firstWeaponAcc;

  return {
    accuracy,
    evasion: data.defenseTotal1Eva ?? data.evaEquip ?? "",
    magic: data.magicPowerSor || data.magicPowerWiz || data.magicPowerCon || data.magicPowerDem || data.magicPowerAby || "",
    search: data.packScoObs || data.packRanObs || data.packWarAgi || "",
    skills: collectYutorizeSkills(data),
    magicPowers: collectYutorizeMagicPowers(data),
    weapons: collectYutorizeWeapons(data),
    equipments: collectYutorizeEquipments(data)
  };
}

function applyYtsheetData(data) {
  const applied = [];
  const derived = deriveYutorizeValues(data);

  const map = [
    ["pcName", ["characterName", "name", "pcName"]],
    ["pcRace", ["race", "Race"]],
    ["pcLevel", ["level", "lv", "adventurerLevel"]],
    ["pcHpMax", ["hpTotal", "hp", "maxHp", "HP"]],
    ["pcHpNow", ["hpTotal", "hp", "maxHp", "HP"]],
    ["pcMpMax", ["mpTotal", "mp", "maxMp", "MP"]],
    ["pcMpNow", ["mpTotal", "mp", "maxMp", "MP"]],
    ["pcDefense", ["defenseTotal1Def", "defEquip", "defense", "protection", "armor"]],
    ["pcAccuracy", [derived.accuracy]],
    ["pcEvasion", [derived.evasion, "evasion", "dodge", "回避"]],
    ["pcVitality", ["vitResistTotal", "vitality", "生命抵抗"]],
    ["pcSpirit", ["mndResistTotal", "spirit", "精神抵抗"]],
    ["pcMagic", [derived.magic, "magic", "魔法行使"]],
    ["pcSearch", [derived.search, "search", "探索"]],
    ["pcInitiative", ["initiative"]],
    ["pcMonsterLore", ["monsterLore"]],
    ["pcIntBonus", ["bonusInt"]],
    ["pcMndBonus", ["bonusMnd"]],
    ["pcSkills", [derived.skills]],
    ["pcMagicPowers", [derived.magicPowers]],
    ["pcWeapons", [derived.weapons]],
    ["pcEquipments", [derived.equipments]]
  ];

  for (const [id, keys] of map) {
    const element = $(id);
    if (!element) continue;

    let value = "";

    for (const key of keys) {
      if (key === undefined || key === null || key === "") continue;

      if (typeof key === "string" && data[key] !== undefined && data[key] !== null && data[key] !== "") {
        value = data[key];
        break;
      }

      if (typeof key !== "string" || data[key] === undefined) {
        value = key;
        break;
      }
    }

    if (value !== "") {
      element.value = cleanYutorizeText(value);
      applied.push(id);
    }
  }

  const memoParts = [];
  if (data.sheetDescriptionM) memoParts.push(cleanYutorizeText(data.sheetDescriptionM));
  if (data.items) memoParts.push("【所持品】\n" + cleanYutorizeText(data.items));
  if (data.freeHistory) memoParts.push("【自由記入】\n" + cleanYutorizeText(data.freeHistory));

  if ($("pcMemo") && memoParts.length) {
    $("pcMemo").value = memoParts.join("\n\n");
    applied.push("pcMemo");
  }

  savePlayer();
  $("jsonImportResult").textContent = applied.length
    ? `読み込み成功：${applied.length}項目反映しました。`
    : "読み込みましたが自動反映できませんでした。";
}
function handleYtsheetFile(file) {
  const reader = new FileReader();
  reader.onload = () => { $("ytsheetJsonInput").value = String(reader.result || ""); importYtsheetJsonText(); };
  reader.readAsText(file);
}

function generatePrompt() {
  const player = loadJson(STORAGE_KEYS.player, {});
  const gm = loadJson(STORAGE_KEYS.gm, {});
  const tokens = getTokens();
  const chat = loadJson(STORAGE_KEYS.chat, []).slice(-16);
  const chatText = chat.map(c => `[${c.speaker}/${c.type}] ${c.text}`).join("\n");
  $("generatedPrompt").value = `ソラGMとして、SW2.5の1人TRPGを進行してください。

重要ルール：
- PLAYERの質問だけでは行動を確定しないでください。
- 未発見情報、隠し罠、敵の位置、イベント条件などをネタバレしないでください。
- 選択肢以外の自由行動も処理してください。
- 未確認のSW2.5ルールは断定せず「要確認」としてください。
- PLAYERキャラクターの意思決定を勝手に確定しないでください。
- 描写、状況、必要判定、選択肢を分けて提示してください。

PLAYER情報：
${JSON.stringify(player, null, 2)}

盤面コマ情報：
${JSON.stringify(tokens, null, 2)}

GMメモ：
${JSON.stringify(gm, null, 2)}

直近ログ：
${chatText}

次のGM返答を作成してください。`;
}

function exportDataObject() {
  return {
    exportedAt: new Date().toISOString(),
    chat: loadJson(STORAGE_KEYS.chat, []),
    player: loadJson(STORAGE_KEYS.player, {}),
    gm: loadJson(STORAGE_KEYS.gm, {}),
    history: loadJson(STORAGE_KEYS.history, []),
    boardImage: localStorage.getItem(STORAGE_KEYS.boardImage) || "",
    tokens: getTokens(),
    windows: loadJson(STORAGE_KEYS.windows, {})
  };
}
function copyExportData() {
  navigator.clipboard.writeText(JSON.stringify(exportDataObject(), null, 2));
  alert("保存データをコピーしました。");
}
function importData() {
  const raw = $("importDataInput").value.trim();
  if (!raw) { alert("JSONを貼り付けてください。"); return; }
  try {
    const data = JSON.parse(raw);
    saveJson(STORAGE_KEYS.chat, data.chat || []);
    saveJson(STORAGE_KEYS.player, data.player || {});
    saveJson(STORAGE_KEYS.gm, data.gm || {});
    saveJson(STORAGE_KEYS.history, data.history || []);
    saveJson(STORAGE_KEYS.tokens, data.tokens || []);
    saveJson(STORAGE_KEYS.windows, data.windows || {});
    if (data.boardImage) localStorage.setItem(STORAGE_KEYS.boardImage, data.boardImage);
    refreshAll();
    alert("取り込みました。");
  } catch { alert("取り込み失敗。JSONを確認してください。"); }
}
function resetLayout() {
  if (!confirm("ウィンドウ配置を初期化しますか？")) return;
  localStorage.removeItem(STORAGE_KEYS.windows);
  location.reload();
}

function initEvents() {
  document.querySelectorAll("[data-open-window]").forEach(btn => {
    btn.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openWindow(btn.dataset.openWindow);
    });
  });

  document.querySelectorAll("[data-close-window]").forEach(btn => {
    btn.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      closeWindow(btn.dataset.closeWindow);
    });
  });

  bind("sendChatBtn", "click", sendChat);
  bind("copyChatBtn", "click", copyChatLog);
  bind("clearChatBtn", "click", clearChat);

  bind("addTokenBtn", "click", addToken);
  bind("updateTokenBtn", "click", updateToken);
  bind("deleteTokenBtn", "click", deleteToken);
  bind("tokenImageInput", "change", e => { const f = e.target.files?.[0]; if (f) handleTokenImage(f); });

  bind("boardImageInput", "change", e => { const f = e.target.files?.[0]; if (f) handleBoardImage(f); });
  bind("clearBoardImageBtn", "click", () => { localStorage.removeItem(STORAGE_KEYS.boardImage); renderBoardImage(); });
  bind("resetLayoutBtn", "click", resetLayout);

  bind("checkTypeSelect", "change", applyCheckType);
  bind("applyPlayerBtn", "click", applyPlayerValue);
  bind("rollBtn", "click", rollCheck);

  bind("savePlayerBtn", "click", savePlayer);
  bind("refreshPlayerJsonListBtn", "click", fetchDataJsonFiles);
  bind("loadSelectedPlayerJsonBtn", "click", loadSelectedPlayerJson);
  bind("loadTypedPlayerJsonBtn", "click", loadTypedPlayerJson);
  bind("saveGmBtn", "click", saveGm);
  bind("sendPublicInfoBtn", "click", () => sendGmFieldToChat("gmPublicInfo", "状況描写"));
  bind("sendChoicesBtn", "click", () => sendGmFieldToChat("gmChoices", "選択肢提示"));

  bind("loadJsonUrlBtn", "click", loadCharacterJsonFromUrl);
  bind("importJsonTextBtn", "click", importYtsheetJsonText);
  bind("clearJsonBtn", "click", () => { $("ytsheetJsonInput").value = ""; $("jsonImportResult").textContent = ""; });
  bind("ytsheetFileInput", "change", e => { const f = e.target.files?.[0]; if (f) handleYtsheetFile(f); });

  bind("generatePromptBtn", "click", generatePrompt);
  bind("copyPromptBtn", "click", () => { navigator.clipboard.writeText($("generatedPrompt").value); alert("コピーしました。"); });
  bind("copyExportBtn", "click", copyExportData);
  bind("importDataBtn", "click", importData);
}

function refreshAll() {
  restoreWindowState();
  initWindowDrag();
  initWindowResize();
  loadCharacterJsonUrlToForm();
  loadPlayerJsonFileNameToForm();
  loadPlayerToForm();
  loadGmToForm();
  renderBoardImage();
  renderTokens();
  renderChat();
}
function init() {
  initEvents();
  refreshAll();
}
init();
