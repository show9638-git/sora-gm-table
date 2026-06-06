const STORAGE_KEYS = {
  chat: "sora_gm_chat_v04",
  player: "sora_gm_player_v04",
  gm: "sora_gm_gm_v04",
  history: "sora_gm_history_v04",
  boardImage: "sora_gm_board_image_v04",
  tokens: "sora_gm_tokens_v04",
  windows: "sora_gm_windows_v04"
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
function initWindowDrag() {
  document.querySelectorAll(".window").forEach(win => {
    bringToFront(win);
    win.addEventListener("pointerdown", () => bringToFront(win));
    const bar = win.querySelector(".window-titlebar");
    bar.addEventListener("pointerdown", e => {
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
  selectToken(id);
  const board = $("board");
  const tokenEl = e.currentTarget;
  tokenEl.setPointerCapture(e.pointerId);
  const move = ev => {
    const rect = board.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    const tokens = getTokens();
    const token = tokens.find(t => t.id === id);
    if (!token) return;
    token.x = Math.max(2, Math.min(98, x));
    token.y = Math.max(2, Math.min(98, y));
    saveTokens(tokens);
    renderTokens();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
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
    name: $("pcName").value, race: $("pcRace").value, level: $("pcLevel").value, defense: $("pcDefense").value,
    hpNow: $("pcHpNow").value, hpMax: $("pcHpMax").value, mpNow: $("pcMpNow").value, mpMax: $("pcMpMax").value,
    accuracy: $("pcAccuracy").value, evasion: $("pcEvasion").value, vitality: $("pcVitality").value,
    spirit: $("pcSpirit").value, magic: $("pcMagic").value, search: $("pcSearch").value, memo: $("pcMemo").value
  };
  saveJson(STORAGE_KEYS.player, player);
  alert("PLAYER保存しました。");
}
function loadPlayerToForm() {
  const p = loadJson(STORAGE_KEYS.player, {});
  for (const [id, key] of Object.entries({
    pcName:"name", pcRace:"race", pcLevel:"level", pcDefense:"defense", pcHpNow:"hpNow", pcHpMax:"hpMax",
    pcMpNow:"mpNow", pcMpMax:"mpMax", pcAccuracy:"accuracy", pcEvasion:"evasion", pcVitality:"vitality",
    pcSpirit:"spirit", pcMagic:"magic", pcSearch:"search", pcMemo:"memo"
  })) $(id).value = p[key] ?? "";
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
function applyYtsheetData(data) {
  const map = [
    ["pcName", ["characterName", "name", "pcName"]],
    ["pcRace", ["race", "Race"]],
    ["pcLevel", ["level", "lv", "adventurerLevel"]],
    ["pcHpMax", ["hp", "maxHp", "HP"]],
    ["pcMpMax", ["mp", "maxMp", "MP"]],
    ["pcDefense", ["defense", "protection", "armor"]],
    ["pcAccuracy", ["accuracy", "hit", "命中"]],
    ["pcEvasion", ["evasion", "dodge", "回避"]],
    ["pcVitality", ["vitality", "生命抵抗"]],
    ["pcSpirit", ["spirit", "精神抵抗"]],
    ["pcMagic", ["magic", "魔法行使"]],
    ["pcSearch", ["search", "探索"]]
  ];
  let count = 0;
  for (const [id, keys] of map) {
    const v = pickFirst(data, keys);
    if (v !== "") { $(id).value = v; count++; }
  }
  if (!$("pcHpNow").value && $("pcHpMax").value) $("pcHpNow").value = $("pcHpMax").value;
  if (!$("pcMpNow").value && $("pcMpMax").value) $("pcMpNow").value = $("pcMpMax").value;
  savePlayer();
  $("jsonImportResult").textContent = count ? `読み込み成功：${count}項目反映` : "読み込みましたが自動反映できませんでした。";
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
  document.querySelectorAll("[data-open-window]").forEach(btn => btn.addEventListener("click", () => openWindow(btn.dataset.openWindow)));
  document.querySelectorAll("[data-close-window]").forEach(btn => btn.addEventListener("click", () => closeWindow(btn.dataset.closeWindow)));

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
  bind("saveGmBtn", "click", saveGm);
  bind("sendPublicInfoBtn", "click", () => sendGmFieldToChat("gmPublicInfo", "状況描写"));
  bind("sendChoicesBtn", "click", () => sendGmFieldToChat("gmChoices", "選択肢提示"));

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
