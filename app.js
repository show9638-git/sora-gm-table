const STORAGE_KEYS = {
  chat: "sora_gm_chat_v01",
  player: "sora_gm_player_v01",
  gm: "sora_gm_gm_v01",
  history: "sora_gm_history_v01",
  sceneImage: "sora_gm_scene_image_v01"
};

const CHECK_TYPES = {
  manual: {
    label: "手入力",
    checkName: "",
    playerKey: null
  },
  accuracy: {
    label: "命中力判定",
    checkName: "命中力判定",
    playerKey: "accuracy"
  },
  evasion: {
    label: "回避力判定",
    checkName: "回避力判定",
    playerKey: "evasion"
  },
  magic: {
    label: "魔法行使判定",
    checkName: "魔法行使判定",
    playerKey: "magic"
  },
  vitality: {
    label: "生命抵抗力判定",
    checkName: "生命抵抗力判定",
    playerKey: "vitality"
  },
  spirit: {
    label: "精神抵抗力判定",
    checkName: "精神抵抗力判定",
    playerKey: "spirit"
  },
  search: {
    label: "探索判定",
    checkName: "探索判定",
    playerKey: "search"
  },
  custom: {
    label: "その他の行為判定",
    checkName: "行為判定",
    playerKey: null
  }
};

let latestDiceResult = null;

function $(id) {
  return document.getElementById(id);
}

function nowText() {
  const d = new Date();
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setActiveTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === tabName);
  });
}

function addChat({ speaker, type, text }) {
  const chat = loadJson(STORAGE_KEYS.chat, []);

  chat.push({
    id: crypto.randomUUID(),
    time: nowText(),
    speaker,
    type,
    text
  });

  saveJson(STORAGE_KEYS.chat, chat);
  renderChat();
}

function renderChat() {
  const chat = loadJson(STORAGE_KEYS.chat, []);
  const log = $("chatLog");

  if (chat.length === 0) {
    log.innerHTML = `<p class="note">チャットログはまだありません。</p>`;
    return;
  }

  log.innerHTML = chat.map(item => `
    <div class="log-item speaker-${escapeHtml(item.speaker)}">
      <div class="log-meta">${escapeHtml(item.time)} / ${escapeHtml(item.speaker)} / ${escapeHtml(item.type)}</div>
      <div>${escapeHtml(item.text).replaceAll("\n", "<br>")}</div>
    </div>
  `).join("");
}

function addChatFromInput() {
  const speaker = $("speakerInput").value;
  const type = $("chatTypeInput").value;
  const text = $("chatTextInput").value.trim();

  if (!text) {
    alert("本文を入力してください。");
    return;
  }

  addChat({ speaker, type, text });
  $("chatTextInput").value = "";
}

function copyChatLog() {
  const chat = loadJson(STORAGE_KEYS.chat, []);
  const text = chat
    .map(item => `[${item.time} ${item.speaker}/${item.type}]\n${item.text}`)
    .join("\n\n");

  navigator.clipboard.writeText(text);
  alert("チャットログをコピーしました。");
}

function clearChat() {
  if (!confirm("チャットログをすべて削除しますか？")) return;

  localStorage.removeItem(STORAGE_KEYS.chat);
  renderChat();
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
    memo: $("pcMemo").value
  };

  saveJson(STORAGE_KEYS.player, player);
  alert("PLAYER情報を保存しました。");
}

function loadPlayerToForm() {
  const p = loadJson(STORAGE_KEYS.player, {});

  $("pcName").value = p.name ?? "";
  $("pcRace").value = p.race ?? "";
  $("pcLevel").value = p.level ?? "";
  $("pcDefense").value = p.defense ?? "";
  $("pcHpNow").value = p.hpNow ?? "";
  $("pcHpMax").value = p.hpMax ?? "";
  $("pcMpNow").value = p.mpNow ?? "";
  $("pcMpMax").value = p.mpMax ?? "";
  $("pcAccuracy").value = p.accuracy ?? "";
  $("pcEvasion").value = p.evasion ?? "";
  $("pcVitality").value = p.vitality ?? "";
  $("pcSpirit").value = p.spirit ?? "";
  $("pcMagic").value = p.magic ?? "";
  $("pcSearch").value = p.search ?? "";
  $("pcMemo").value = p.memo ?? "";
}

function saveGm() {
  const gm = {
    scenario: $("gmScenario").value,
    location: $("gmLocation").value,
    objective: $("gmObjective").value,
    publicInfo: $("gmPublicInfo").value,
    hiddenInfo: $("gmHiddenInfo").value,
    terrain: $("gmTerrain").value,
    npc: $("gmNpc").value,
    enemy: $("gmEnemy").value,
    trigger: $("gmTrigger").value,
    choices: $("gmChoices").value,
    ruling: $("gmRuling").value,
    needCheck: $("gmNeedCheck").value
  };

  saveJson(STORAGE_KEYS.gm, gm);
  alert("GMメモを保存しました。");
}

function loadGmToForm() {
  const gm = loadJson(STORAGE_KEYS.gm, {});

  $("gmScenario").value = gm.scenario ?? "";
  $("gmLocation").value = gm.location ?? "";
  $("gmObjective").value = gm.objective ?? "";
  $("gmPublicInfo").value = gm.publicInfo ?? "";
  $("gmHiddenInfo").value = gm.hiddenInfo ?? "";
  $("gmTerrain").value = gm.terrain ?? "";
  $("gmNpc").value = gm.npc ?? "";
  $("gmEnemy").value = gm.enemy ?? "";
  $("gmTrigger").value = gm.trigger ?? "";
  $("gmChoices").value = gm.choices ?? "";
  $("gmRuling").value = gm.ruling ?? "";
  $("gmNeedCheck").value = gm.needCheck ?? "";
}

function sendGmFieldToChat(fieldId, type) {
  const text = $(fieldId).value.trim();

  if (!text) {
    alert("送信する内容が空です。");
    return;
  }

  addChat({ speaker: "GM", type, text });
  setActiveTab("chat");
}

function getPlayerValue(key) {
  const player = loadJson(STORAGE_KEYS.player, {});
  return player[key];
}

function getCheckTypeInfo(type) {
  return CHECK_TYPES[type] || CHECK_TYPES.manual;
}

function applyCheckTypeToInputs(type, checkNameInputId, baseValueInputId) {
  const info = getCheckTypeInfo(type);

  if (info.checkName) {
    $(checkNameInputId).value = info.checkName;
  }

  if (info.playerKey) {
    const value = getPlayerValue(info.playerKey);

    if (value !== undefined && value !== null && value !== "") {
      $(baseValueInputId).value = value;
    }
  }
}

function applySelectedPlayerValue(typeSelectId, checkNameInputId, baseValueInputId, errorId = null) {
  const type = $(typeSelectId).value;
  const info = getCheckTypeInfo(type);

  if (info.checkName) {
    $(checkNameInputId).value = info.checkName;
  }

  if (!info.playerKey) {
    if (errorId) $(errorId).textContent = "この判定方法はPLAYER基準値の自動反映対象ではありません。";
    return false;
  }

  const value = getPlayerValue(info.playerKey);

  if (value === undefined || value === null || value === "") {
    if (errorId) $(errorId).textContent = "PLAYER情報が未登録です。";
    else alert("PLAYER情報が未登録です。");
    return false;
  }

  $(baseValueInputId).value = value;

  if (errorId) $(errorId).textContent = "";
  return true;
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function parseRequiredNumber(value, label) {
  if (value === "" || value === null || value === undefined) {
    throw new Error(`${label}を入力してください`);
  }

  const num = Number(value);

  if (Number.isNaN(num)) {
    throw new Error(`${label}は数値で入力してください`);
  }

  return num;
}

function parseOptionalNumber(value, label, defaultValue = null) {
  if (value === "" || value === null || value === undefined) {
    return defaultValue;
  }

  const num = Number(value);

  if (Number.isNaN(num)) {
    throw new Error(`${label}は数値で入力してください`);
  }

  return num;
}

function createCheckResult({ checkName, base, modifier, target }) {
  const d1 = rollD6();
  const d2 = rollD6();
  const total = d1 + d2;
  const achievement = total + base + modifier;

  const isAutoFail = d1 === 1 && d2 === 1;
  const isAutoSuccess = d1 === 6 && d2 === 6;

  let result;
  let exp = 0;

  if (isAutoFail) {
    result = "自動失敗";
    exp = 50;
  } else if (isAutoSuccess) {
    result = "自動成功";
  } else if (target === null) {
    result = "目標値未設定";
  } else {
    result = achievement >= target ? "成功" : "失敗";
  }

  return {
    id: crypto.randomUUID(),
    time: nowText(),
    checkType: "action_check",
    checkName,
    d1,
    d2,
    total,
    base,
    modifier,
    target,
    achievement,
    result,
    isAutoFail,
    isAutoSuccess,
    exp
  };
}

function saveDiceHistory(item) {
  const history = loadJson(STORAGE_KEYS.history, []);
  history.unshift(item);
  saveJson(STORAGE_KEYS.history, history.slice(0, 50));
}

function formatDiceResultForChat(r) {
  return `【${r.checkName}】出目：${r.d1}+${r.d2}=${r.total} / 基準値：${r.base} / 修正値：${r.modifier >= 0 ? "+" : ""}${r.modifier} / 達成値：${r.achievement} / 結果：${r.result}${r.exp ? " / 経験点+50" : ""}`;
}

function renderDiceResult(r) {
  const cls = r.isAutoFail || r.isAutoSuccess
    ? "result-special"
    : r.result === "成功"
      ? "result-success"
      : r.result === "失敗"
        ? "result-fail"
        : "";

  $("diceResult").className = `result-box ${cls}`;

  const targetText = r.target === null ? "なし" : r.target;
  const expText = r.exp ? `\n経験点：+${r.exp}` : "";

  $("diceResult").textContent =
`【${r.checkName}】
出目：${r.d1} + ${r.d2} = ${r.total}
基準値：${r.base}
修正値：${r.modifier >= 0 ? "+" : ""}${r.modifier}
達成値：${r.achievement}
目標値：${targetText}
結果：${r.result}${expText}`;
}

function rollCheckFromDiceTab() {
  $("diceError").textContent = "";

  try {
    const selectedType = $("checkTypeSelect").value;
    const info = getCheckTypeInfo(selectedType);

    const checkName = $("checkNameInput").value.trim() || info.checkName || "行為判定";
    const base = parseRequiredNumber($("baseValueInput").value, "基準値");
    const modifier = parseOptionalNumber($("modifierInput").value, "修正値", 0);
    const target = parseOptionalNumber($("targetValueInput").value, "目標値", null);

    latestDiceResult = createCheckResult({ checkName, base, modifier, target });

    saveDiceHistory(latestDiceResult);
    renderDiceResult(latestDiceResult);
    renderHistory();

    $("sendResultToChatBtn").disabled = false;
  } catch (error) {
    $("diceError").textContent = error.message;
  }
}

function rollCheckFromChatTab() {
  $("chatDiceError").textContent = "";

  try {
    const selectedType = $("chatCheckTypeSelect").value;
    const info = getCheckTypeInfo(selectedType);

    if ($("chatBaseValueInput").value === "" && info.playerKey) {
      applySelectedPlayerValue("chatCheckTypeSelect", "chatCheckNameInput", "chatBaseValueInput", "chatDiceError");
    }

    const checkName = $("chatCheckNameInput").value.trim() || info.checkName || "行為判定";
    const base = parseRequiredNumber($("chatBaseValueInput").value, "基準値");
    const modifier = parseOptionalNumber($("chatModifierInput").value, "修正値", 0);
    const target = parseOptionalNumber($("chatTargetValueInput").value, "目標値", null);

    const result = createCheckResult({ checkName, base, modifier, target });

    latestDiceResult = result;
    saveDiceHistory(result);
    renderHistory();

    addChat({
      speaker: "PLAYER",
      type: "判定結果",
      text: formatDiceResultForChat(result)
    });

    $("chatDiceError").textContent = "";
  } catch (error) {
    $("chatDiceError").textContent = error.message;
  }
}

function sendLatestDiceResultToChat() {
  if (!latestDiceResult) return;

  addChat({
    speaker: "PLAYER",
    type: "判定結果",
    text: formatDiceResultForChat(latestDiceResult)
  });

  setActiveTab("chat");
}

function renderHistory() {
  const history = loadJson(STORAGE_KEYS.history, []);
  const failCount = history.filter(h => h.isAutoFail).length;
  const expTotal = history.reduce((sum, h) => sum + Number(h.exp || 0), 0);

  $("historySummary").textContent =
`判定回数：${history.length}
自動失敗回数：${failCount}
自動失敗による獲得経験点：${expTotal}`;

  const list = $("diceHistory");

  if (history.length === 0) {
    list.innerHTML = `<p class="note">判定履歴はまだありません。</p>`;
    return;
  }

  list.innerHTML = history.map(h => `
    <div class="log-item">
      <div class="log-meta">${escapeHtml(h.time)} / ${escapeHtml(h.checkName)}</div>
      <div>出目：${h.d1}+${h.d2}=${h.total} / 達成値：${h.achievement} / 結果：${escapeHtml(h.result)}${h.exp ? " / 経験点+50" : ""}</div>
    </div>
  `).join("");
}

function clearHistory() {
  if (!confirm("判定履歴をすべて削除しますか？")) return;

  localStorage.removeItem(STORAGE_KEYS.history);
  renderHistory();
}

function importYtsheetJsonText() {
  const raw = $("ytsheetJsonInput").value.trim();

  if (!raw) {
    alert("JSONを貼り付けてください。");
    return;
  }

  try {
    const data = JSON.parse(raw);
    applyYtsheetData(data);
  } catch {
    $("jsonImportResult").textContent = "JSONの読み込みに失敗しました。形式を確認してください。";
  }
}

function pickFirst(data, keys) {
  for (const key of keys) {
    if (data && data[key] !== undefined && data[key] !== null && data[key] !== "") {
      return data[key];
    }
  }

  return "";
}

function applyYtsheetData(data) {
  const applied = [];

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

  for (const [elementId, keys] of map) {
    const value = pickFirst(data, keys);

    if (value !== "") {
      $(elementId).value = value;
      applied.push(elementId);
    }
  }

  if (!$("pcHpNow").value && $("pcHpMax").value) {
    $("pcHpNow").value = $("pcHpMax").value;
  }

  if (!$("pcMpNow").value && $("pcMpMax").value) {
    $("pcMpNow").value = $("pcMpMax").value;
  }

  $("jsonImportResult").textContent = applied.length > 0
    ? `読み込み成功。反映項目数：${applied.length}。不足項目は手入力してください。`
    : "読み込みはできましたが、自動反映できる項目が見つかりませんでした。項目名の調整が必要です。";

  savePlayer();
}

function handleYtsheetFile(file) {
  const reader = new FileReader();

  reader.onload = () => {
    $("ytsheetJsonInput").value = String(reader.result || "");
    importYtsheetJsonText();
  };

  reader.readAsText(file);
}

function handleSceneImage(file) {
  const reader = new FileReader();

  reader.onload = () => {
    const dataUrl = String(reader.result || "");
    localStorage.setItem(STORAGE_KEYS.sceneImage, dataUrl);
    renderSceneImage();
  };

  reader.readAsDataURL(file);
}

function renderSceneImage() {
  const dataUrl = localStorage.getItem(STORAGE_KEYS.sceneImage);
  const img = $("sceneImagePreview");
  const empty = $("sceneImageEmpty");

  if (dataUrl) {
    img.src = dataUrl;
    img.style.display = "block";
    empty.style.display = "none";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
    empty.style.display = "block";
  }
}

function generatePrompt() {
  const player = loadJson(STORAGE_KEYS.player, {});
  const gm = loadJson(STORAGE_KEYS.gm, {});
  const chat = loadJson(STORAGE_KEYS.chat, []).slice(-12);

  const chatText = chat.map(c => `[${c.speaker}/${c.type}] ${c.text}`).join("\n");

  const prompt =
`ソラGMとして、SW2.5の1人TRPGを進行してください。

重要ルール：
- PLAYERの質問だけでは行動を確定しないでください。
- 未発見情報、隠し罠、敵の位置、イベント条件などをネタバレしないでください。
- 選択肢以外の自由行動も処理してください。
- 未確認のSW2.5ルールは断定せず「要確認」としてください。
- PLAYERキャラクターの意思決定を勝手に確定しないでください。
- 描写、状況、必要判定、選択肢を分けて提示してください。

PLAYER情報：
${JSON.stringify(player, null, 2)}

GMメモ：
${JSON.stringify(gm, null, 2)}

直近ログ：
${chatText}

次のGM返答を作成してください。`;

  $("generatedPrompt").value = prompt;
}

function exportAllData() {
  const data = {
    exportedAt: new Date().toISOString(),
    chat: loadJson(STORAGE_KEYS.chat, []),
    player: loadJson(STORAGE_KEYS.player, {}),
    gm: loadJson(STORAGE_KEYS.gm, {}),
    history: loadJson(STORAGE_KEYS.history, []),
    sceneImage: localStorage.getItem(STORAGE_KEYS.sceneImage) || ""
  };

  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  alert("保存データをクリップボードにコピーしました。");
}

function importAllData() {
  const raw = $("importDataInput").value.trim();

  if (!raw) {
    alert("取り込むJSONを貼り付けてください。");
    return;
  }

  try {
    const data = JSON.parse(raw);

    saveJson(STORAGE_KEYS.chat, data.chat || []);
    saveJson(STORAGE_KEYS.player, data.player || {});
    saveJson(STORAGE_KEYS.gm, data.gm || {});
    saveJson(STORAGE_KEYS.history, data.history || []);

    if (data.sceneImage) {
      localStorage.setItem(STORAGE_KEYS.sceneImage, data.sceneImage);
    }

    loadPlayerToForm();
    loadGmToForm();
    renderChat();
    renderHistory();
    renderSceneImage();

    alert("保存データを取り込みました。");
  } catch {
    alert("取り込みに失敗しました。JSON形式を確認してください。");
  }
}

function initEvents() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  $("addChatBtn").addEventListener("click", addChatFromInput);
  $("copyChatBtn").addEventListener("click", copyChatLog);
  $("clearChatBtn").addEventListener("click", clearChat);

  $("checkTypeSelect").addEventListener("change", () => {
    applyCheckTypeToInputs($("checkTypeSelect").value, "checkNameInput", "baseValueInput");
  });

  $("chatCheckTypeSelect").addEventListener("change", () => {
    applyCheckTypeToInputs($("chatCheckTypeSelect").value, "chatCheckNameInput", "chatBaseValueInput");
  });

  $("applyPlayerValueBtn").addEventListener("click", () => {
    applySelectedPlayerValue("checkTypeSelect", "checkNameInput", "baseValueInput", "diceError");
  });

  $("chatApplyPlayerValueBtn").addEventListener("click", () => {
    applySelectedPlayerValue("chatCheckTypeSelect", "chatCheckNameInput", "chatBaseValueInput", "chatDiceError");
  });

  $("rollBtn").addEventListener("click", rollCheckFromDiceTab);
  $("chatRollBtn").addEventListener("click", rollCheckFromChatTab);

  $("sendResultToChatBtn").addEventListener("click", sendLatestDiceResultToChat);
  $("clearHistoryBtn").addEventListener("click", clearHistory);

  $("savePlayerBtn").addEventListener("click", savePlayer);
  $("saveGmBtn").addEventListener("click", saveGm);

  $("sendPublicInfoBtn").addEventListener("click", () => sendGmFieldToChat("gmPublicInfo", "状況描写"));
  $("sendChoicesBtn").addEventListener("click", () => sendGmFieldToChat("gmChoices", "選択肢提示"));

  $("generatePromptBtn").addEventListener("click", generatePrompt);
  $("copyPromptBtn").addEventListener("click", () => {
    navigator.clipboard.writeText($("generatedPrompt").value);
    alert("プロンプトをコピーしました。");
  });

  $("exportDataBtn").addEventListener("click", exportAllData);
  $("importDataBtn").addEventListener("click", importAllData);

  $("importJsonTextBtn").addEventListener("click", importYtsheetJsonText);
  $("clearJsonBtn").addEventListener("click", () => {
    $("ytsheetJsonInput").value = "";
    $("jsonImportResult").textContent = "";
  });

  $("ytsheetFileInput").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) handleYtsheetFile(file);
  });

  $("sceneImageInput").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) handleSceneImage(file);
  });
}

function init() {
  initEvents();
  loadPlayerToForm();
  loadGmToForm();
  renderChat();
  renderHistory();
  renderSceneImage();
}

init();
