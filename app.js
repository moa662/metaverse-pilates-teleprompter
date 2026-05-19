const STORAGE_KEY = "metaverse-pilates-teleprompter-v3";
const DRAFT_KEY = "storm-teleprompter-editor-draft-v1";

const sampleScripts = [
  {
    id: "sample-1",
    title: "元宇宙普拉提开场口播",
    content:
      "大家好，欢迎来到元宇宙普拉提。\n\n今天这节课，我们会用更稳定、更清晰的节奏，帮助你找到身体的控制感。\n\n请把注意力放在呼吸、核心和动作质量上，不追求速度，只追求每一次发力都更精准。\n\n准备好以后，我们就从第一个动作开始。",
    updatedAt: Date.now() - 1000 * 60 * 8,
    createdAt: Date.now() - 1000 * 60 * 60
  }
];

const appState = {
  route: "manager",
  currentId: null,
  query: "",
  scripts: [],
  toast: null,
  editor: {
    id: null,
    title: "",
    content: "",
    dirty: false,
    search: ""
  },
  prompter: {
    isPlaying: false,
    fontSize: 64,
    lineHeight: 1.5,
    paddingX: 5,
    mirrorMode: false,
    responsive: true,
    countdownSeconds: 3,
    scrollSpeed: 52,
    settingsOpen: false,
    tapPause: true,
    wakeLock: true
  }
};

let rafId = null;
let lastFrame = 0;
let countdownTimer = null;
let wakeLock = null;

const root = document.querySelector("#app");

function uid() {
  return `script-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textFromHtml(value) {
  const div = document.createElement("div");
  div.innerHTML = value;
  return div.textContent || div.innerText || "";
}

function formatAgo(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return new Date(timestamp).toLocaleDateString();
}

function readingTime(text) {
  const length = Array.from(textFromHtml(text)).length;
  if (!length) return "0 分 0 秒";
  const minutes = Math.floor(length / 300);
  const seconds = Math.floor((length % 300) / 5);
  if (!minutes) return `${seconds} 秒`;
  if (!seconds) return `${minutes} 分`;
  return `${minutes} 分 ${seconds} 秒`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    appState.scripts = Array.isArray(saved?.scripts) && saved.scripts.length ? saved.scripts : sampleScripts;
    if (saved?.prompter) Object.assign(appState.prompter, saved.prompter, { isPlaying: false, settingsOpen: false });
  } catch {
    appState.scripts = sampleScripts;
  }
}

function saveState() {
  const { isPlaying, settingsOpen, activeIndex, ...prompter } = appState.prompter;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      scripts: appState.scripts,
      prompter
    })
  );
}

function setToast(message, type = "success") {
  appState.toast = { message, type };
  render();
  window.setTimeout(() => {
    if (appState.toast?.message === message) {
      appState.toast = null;
      render();
    }
  }, 2200);
}

function navigate(route, id = null) {
  stopPrompter();
  clearCountdown();
  appState.route = route;
  appState.currentId = id;
  if (route === "editor") loadEditor(id);
  render();
}

function loadEditor(id) {
  if (id === "new") {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
    appState.editor = {
      id: "new",
      title: draft.title || "",
      content: draft.content || "",
      dirty: false,
      search: ""
    };
    return;
  }

  const script = appState.scripts.find((item) => item.id === id);
  if (!script) {
    setToast("稿件不存在", "error");
    navigate("manager");
    return;
  }

  appState.editor = {
    id,
    title: script.title,
    content: script.content,
    dirty: false,
    search: ""
  };
}

function currentScript() {
  return appState.scripts.find((item) => item.id === appState.currentId) || null;
}

function saveEditor() {
  const title = appState.editor.title.trim();
  const content = appState.editor.content.trim();
  if (!title || !content) {
    setToast("请填写标题和正文", "error");
    return;
  }

  if (appState.editor.id === "new") {
    const script = {
      id: uid(),
      title,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    appState.scripts.unshift(script);
    appState.editor.id = script.id;
    appState.currentId = script.id;
    localStorage.removeItem(DRAFT_KEY);
    setToast("稿件已创建");
  } else {
    const script = appState.scripts.find((item) => item.id === appState.editor.id);
    if (!script) return;
    script.title = title;
    script.content = content;
    script.updatedAt = Date.now();
    setToast("稿件已保存");
  }

  appState.editor.dirty = false;
  saveState();
  render();
}

function autoSaveDraft() {
  if (appState.editor.id !== "new") return;
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      title: appState.editor.title,
      content: appState.editor.content,
      savedAt: Date.now()
    })
  );
}

function deleteScript(id) {
  const script = appState.scripts.find((item) => item.id === id);
  if (!script) return;
  const confirmed = window.confirm(`确定删除《${script.title}》吗？此操作不可恢复。`);
  if (!confirmed) return;
  appState.scripts = appState.scripts.filter((item) => item.id !== id);
  saveState();
  setToast("稿件已删除");
  navigate("manager");
}

function duplicateScript(id) {
  const script = appState.scripts.find((item) => item.id === id);
  if (!script) return;
  appState.scripts.unshift({
    ...script,
    id: uid(),
    title: `${script.title} 副本`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  saveState();
  setToast("已复制稿件");
  render();
}

function applyResponsivePreset() {
  if (!appState.prompter.responsive) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const minSize = Math.min(width, height);
  if (width < 480) {
    appState.prompter.fontSize = minSize < 380 ? 32 : 36;
    appState.prompter.lineHeight = 1.6;
    appState.prompter.paddingX = 4;
  } else if (width < 768) {
    appState.prompter.fontSize = height < 720 ? 40 : 44;
    appState.prompter.lineHeight = 1.55;
    appState.prompter.paddingX = 6;
  } else if (width < 1280) {
    appState.prompter.fontSize = 60;
    appState.prompter.lineHeight = 1.5;
    appState.prompter.paddingX = 5;
  } else {
    appState.prompter.fontSize = 68;
    appState.prompter.lineHeight = 1.45;
    appState.prompter.paddingX = 3;
  }
}

function scriptChars(text) {
  return Array.from(textFromHtml(text));
}

function updatePrompterProgress() {
  const viewport = root.querySelector("#prompterViewport");
  const progress = root.querySelector("#progressFill");
  if (viewport && progress) {
    const maxScroll = Math.max(viewport.scrollHeight - viewport.clientHeight, 1);
    progress.style.width = `${Math.round((viewport.scrollTop / maxScroll) * 1000) / 10}%`;
  }
}

function scrollPrompterBy(delta) {
  const viewport = root.querySelector("#prompterViewport");
  if (!viewport) return;
  viewport.scrollTop = Math.max(0, Math.min(viewport.scrollTop + delta, viewport.scrollHeight - viewport.clientHeight));
  updatePrompterProgress();
}

async function requestWakeLock() {
  if (!appState.prompter.wakeLock || !("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } finally {
    wakeLock = null;
  }
}

function clearCountdown() {
  if (countdownTimer) window.clearInterval(countdownTimer);
  countdownTimer = null;
  const countdown = root.querySelector("#countdown");
  if (countdown) {
    countdown.classList.remove("show");
    countdown.textContent = "";
  }
}

function startCountdownThenPlay() {
  clearCountdown();
  if (appState.prompter.countdownSeconds <= 0) {
    startPrompter();
    return;
  }
  let remaining = appState.prompter.countdownSeconds;
  const countdown = root.querySelector("#countdown");
  if (!countdown) return;
  countdown.textContent = remaining;
  countdown.classList.add("show");
  countdownTimer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearCountdown();
      startPrompter();
    } else {
      countdown.textContent = remaining;
    }
  }, 1000);
}

function startPrompter() {
  if (appState.prompter.isPlaying) return;
  appState.prompter.isPlaying = true;
  requestWakeLock();
  lastFrame = performance.now();
  rafId = requestAnimationFrame(tick);
  render();
}

function stopPrompter() {
  appState.prompter.isPlaying = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  releaseWakeLock();
}

function tick(now) {
  if (!appState.prompter.isPlaying) return;
  const viewport = root.querySelector("#prompterViewport");
  if (!viewport) return;
  const elapsed = Math.min(now - lastFrame, 120);
  lastFrame = now;
  viewport.scrollTop += appState.prompter.scrollSpeed * (elapsed / 1000);
  updatePrompterProgress();
  if (viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 2) {
    stopPrompter();
    render();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

function exportScript(id) {
  const script = appState.scripts.find((item) => item.id === id);
  if (!script) return;
  const blob = new Blob([script.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${script.title || "teleprompter-script"}.txt`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importTxt(file) {
  if (!file) return;
  file.text().then((text) => {
    appState.editor.content = text;
    if (!appState.editor.title) appState.editor.title = file.name.replace(/\.[^.]+$/, "");
    appState.editor.dirty = true;
    autoSaveDraft();
    render();
  });
}

function renderToast() {
  if (!appState.toast) return "";
  return `<div class="toast ${appState.toast.type === "error" ? "toast-error" : ""}">
    <i data-lucide="${appState.toast.type === "error" ? "circle-alert" : "check-circle-2"}"></i>
    <span>${escapeHtml(appState.toast.message)}</span>
  </div>`;
}

function renderManager() {
  const query = appState.query.trim().toLowerCase();
  const scripts = appState.scripts.filter((script) => {
    if (!query) return true;
    return script.title.toLowerCase().includes(query) || textFromHtml(script.content).toLowerCase().includes(query);
  });

  return `
    <main class="manager-screen">
      <header class="manager-header">
        <div class="brand-lockup">
          <div class="brand-mark">ST</div>
          <div>
            <h1>元宇宙普拉提</h1>
            <p>Metaverse Pilates Teleprompter</p>
          </div>
        </div>
        <div class="manager-actions">
          <label class="search-box">
            <i data-lucide="search"></i>
            <input id="managerSearch" value="${escapeHtml(appState.query)}" placeholder="搜索稿件...">
          </label>
          <button class="gold-button" id="newScriptButton" type="button">
            <i data-lucide="plus"></i><span>新建稿件</span>
          </button>
        </div>
      </header>

      <section class="brand-intro brand-intro-text">
        <div>
          <span>Metaverse Pilates</span>
          <h2>元宇宙普拉提提词工作台</h2>
        </div>
        <p>为课程口播、动作讲解和手机拍摄准备设计。先整理稿件，再进入全屏提词。</p>
      </section>

      <section class="script-section">
        <div class="section-title-row">
          <div>
            <h3>全部稿件</h3>
            <p>共 ${scripts.length} 条${query ? " 匹配结果" : ""}</p>
          </div>
        </div>
        ${scripts.length ? `<div class="script-grid">${scripts.map(renderScriptCard).join("")}</div>` : renderEmptyState(query)}
      </section>
    </main>
    ${renderToast()}
  `;
}

function renderScriptCard(script) {
  const plain = textFromHtml(script.content);
  return `
    <article class="script-card" data-script-id="${script.id}">
      <button class="card-main" data-action="play" data-id="${script.id}" type="button">
        <div class="card-cover"><i data-lucide="scroll-text"></i></div>
        <div class="card-copy">
          <h4>${escapeHtml(script.title)}</h4>
          <p>${escapeHtml(plain.slice(0, 96))}${plain.length > 96 ? "..." : ""}</p>
        </div>
      </button>
      <div class="card-meta">
        <span>${formatAgo(script.updatedAt)}</span>
        <span>${readingTime(script.content)}</span>
      </div>
      <div class="card-actions">
        <button data-action="edit" data-id="${script.id}" type="button"><i data-lucide="file-pen-line"></i><span>编辑</span></button>
        <button data-action="copy" data-id="${script.id}" type="button"><i data-lucide="copy"></i><span>复制</span></button>
        <button data-action="export" data-id="${script.id}" type="button"><i data-lucide="download"></i><span>导出</span></button>
        <button data-action="delete" data-id="${script.id}" type="button"><i data-lucide="trash-2"></i><span>删除</span></button>
      </div>
    </article>
  `;
}

function renderEmptyState(query) {
  return `
    <div class="empty-state">
      <div><i data-lucide="file-text"></i></div>
      <h3>${query ? "未找到匹配稿件" : "暂无稿件"}</h3>
      <p>${query ? "尝试更换搜索关键词，或清除搜索条件查看全部稿件。" : "点击“新建稿件”开始创作你的第一个提词脚本。"}</p>
      ${query ? "" : `<button class="gold-button" id="emptyCreateButton" type="button">立即创建</button>`}
    </div>
  `;
}

function renderEditor() {
  const { title, content, search } = appState.editor;
  const canPlay = appState.editor.id !== "new";
  return `
    <main class="editor-screen">
      <header class="editor-header">
        <button class="ghost-button icon-only" id="backToManager" type="button" aria-label="返回"><i data-lucide="arrow-left"></i></button>
        <div class="editor-title-meta">
          <h1>${escapeHtml(title || "请输入标题")}</h1>
          <p>读完预计：${readingTime(content)}${appState.editor.dirty ? " · 未保存" : ""}</p>
        </div>
        <div class="editor-toolbar">
          <label class="search-box editor-search">
            <i data-lucide="search"></i>
            <input id="editorSearch" value="${escapeHtml(search)}" placeholder="搜索">
          </label>
          <label class="ghost-button import-label" for="txtImport">
            <i data-lucide="upload"></i><span>导入</span>
          </label>
          <input id="txtImport" type="file" accept=".txt,text/plain">
          <button class="ghost-button" id="saveEditorButton" type="button"><i data-lucide="save"></i><span>保存</span></button>
          <button class="gold-button" id="playEditorButton" type="button" ${canPlay ? "" : "disabled"}><i data-lucide="play"></i><span>去提词</span></button>
        </div>
      </header>
      <section class="editor-body">
        <input id="titleInput" class="title-input" value="${escapeHtml(title)}" placeholder="请输入标题">
        <textarea id="contentInput" class="content-input" placeholder="请输入脚本文案">${escapeHtml(content)}</textarea>
      </section>
    </main>
    ${renderToast()}
  `;
}

function renderPrompter() {
  applyResponsivePreset();
  const script = currentScript();
  if (!script) return renderManager();
  const chars = scriptChars(script.content);
  const settingsClass = appState.prompter.settingsOpen ? "settings-drawer open" : "settings-drawer";
  return `
    <main class="prompter-screen" style="--prompter-font-size:${appState.prompter.fontSize}px;--prompter-line-height:${appState.prompter.lineHeight};--prompter-padding:${appState.prompter.paddingX}%;">
      <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
      <div class="prompter-topbar">
        <div class="top-left">
          <button class="round-button" id="backFromPrompter" type="button" aria-label="返回"><i data-lucide="arrow-left"></i></button>
          <h1>${escapeHtml(script.title)}</h1>
        </div>
        <div class="top-stats">
          <span>总字数：${chars.length.toLocaleString()}</span>
          <button class="round-button" id="settingsButton" type="button" aria-label="设置"><i data-lucide="sliders-horizontal"></i></button>
        </div>
      </div>
      <div class="countdown" id="countdown"></div>
      <div class="reading-box" style="left:calc(16px + ${appState.prompter.paddingX}%);right:calc(16px + ${appState.prompter.paddingX}%);"></div>
      <section id="prompterViewport" class="prompter-viewport ${appState.prompter.mirrorMode ? "mirror-mode" : ""}" style="font-size:${appState.prompter.fontSize}px;line-height:${appState.prompter.lineHeight};padding-left:calc(16px + ${appState.prompter.paddingX}%);padding-right:calc(16px + ${appState.prompter.paddingX}%);">
        <article class="prompter-content">${escapeHtml(textFromHtml(script.content))}</article>
      </section>
      <div class="prompter-controls">
        <button class="gold-button" id="playPrompterButton" type="button">
          <i data-lucide="${appState.prompter.isPlaying ? "pause" : "play"}"></i><span>${appState.prompter.isPlaying ? "暂停" : "开始"}</span>
        </button>
        <button class="round-button" id="prevCharButton" type="button" aria-label="后退"><i data-lucide="skip-back"></i></button>
        <button class="round-button" id="restartPrompterButton" type="button" aria-label="重置"><i data-lucide="rotate-ccw"></i></button>
        <button class="round-button" id="nextCharButton" type="button" aria-label="前进"><i data-lucide="skip-forward"></i></button>
        <button class="round-button" id="landscapeButton" type="button" aria-label="横屏显示"><i data-lucide="smartphone"></i></button>
        <button class="round-button" id="fullscreenButton" type="button" aria-label="全屏"><i data-lucide="maximize-2"></i></button>
      </div>
      <aside class="${settingsClass}">
        ${renderPrompterSettings()}
      </aside>
    </main>
    ${renderToast()}
  `;
}

function renderPrompterSettings() {
  const p = appState.prompter;
  return `
    <div class="drawer-header">
      <h2><i data-lucide="sliders-horizontal"></i> 提词设置</h2>
      <button class="round-button" id="closeSettingsButton" type="button" aria-label="关闭"><i data-lucide="x"></i></button>
    </div>
    ${renderToggle("responsiveToggle", "自动适配", "根据页面大小自动匹配字号、行距和边距", p.responsive)}
    ${renderRange("fontSizeRange", "字号", p.fontSize, 24, 120, 2, "px")}
    ${renderRange("lineHeightRange", "行距", p.lineHeight, 1, 2.5, 0.1, "")}
    ${renderRange("paddingRange", "左右边距", p.paddingX, 0, 40, 1, "%")}
    ${renderRange("scrollSpeedRange", "滚动速度", p.scrollSpeed, 12, 140, 2, "px/s")}
    ${renderRange("countdownRange", "开拍倒计时", p.countdownSeconds, 0, 10, 1, "s")}
    ${renderToggle("mirrorToggle", "镜像模式", "用于分光镜反射", p.mirrorMode)}
    ${renderToggle("tapPauseToggle", "点击暂停", "播放时点按屏幕暂停", p.tapPause)}
    ${renderToggle("wakeLockToggle", "熄屏防护", "支持的浏览器会保持屏幕常亮", p.wakeLock)}
    <div class="drawer-editor">
      <span>稿件内容（实时同步）</span>
      <textarea id="prompterInlineEditor">${escapeHtml(currentScript()?.content || "")}</textarea>
    </div>
  `;
}

function renderRange(id, label, value, min, max, step, unit) {
  return `
    <label class="setting-block" for="${id}">
      <span>${label}</span>
      <strong>${Number(value).toFixed(step < 1 ? 1 : 0)}${unit}</strong>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
    </label>
  `;
}

function renderToggle(id, title, desc, checked) {
  return `
    <label class="toggle-block" for="${id}">
      <span><strong>${title}</strong><small>${desc}</small></span>
      <input id="${id}" type="checkbox" ${checked ? "checked" : ""}>
    </label>
  `;
}

function render() {
  if (appState.route === "editor") root.innerHTML = renderEditor();
  else if (appState.route === "prompter") root.innerHTML = renderPrompter();
  else root.innerHTML = renderManager();
  bindCurrentView();
  if (window.lucide) window.lucide.createIcons();
  if (appState.route === "prompter") {
    window.requestAnimationFrame(() => {
      updatePrompterProgress();
    });
  }
}

function bindCurrentView() {
  if (appState.route === "manager") bindManager();
  if (appState.route === "editor") bindEditor();
  if (appState.route === "prompter") bindPrompter();
}

function bindManager() {
  root.querySelector("#newScriptButton")?.addEventListener("click", () => navigate("editor", "new"));
  root.querySelector("#emptyCreateButton")?.addEventListener("click", () => navigate("editor", "new"));
  root.querySelector("#managerSearch")?.addEventListener("input", (event) => {
    appState.query = event.target.value;
    render();
  });
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action !== "play") event.stopPropagation();
      if (action === "play") navigate("prompter", id);
      if (action === "edit") navigate("editor", id);
      if (action === "copy") duplicateScript(id);
      if (action === "export") exportScript(id);
      if (action === "delete") deleteScript(id);
    });
  });
}

function bindEditor() {
  root.querySelector("#backToManager")?.addEventListener("click", () => navigate("manager"));
  root.querySelector("#saveEditorButton")?.addEventListener("click", saveEditor);
  root.querySelector("#playEditorButton")?.addEventListener("click", () => {
    if (appState.editor.id !== "new") navigate("prompter", appState.editor.id);
  });
  root.querySelector("#txtImport")?.addEventListener("change", (event) => importTxt(event.target.files?.[0]));
  root.querySelector("#titleInput")?.addEventListener("input", (event) => {
    appState.editor.title = event.target.value;
    appState.editor.dirty = true;
    autoSaveDraft();
  });
  root.querySelector("#contentInput")?.addEventListener("input", (event) => {
    appState.editor.content = event.target.value;
    appState.editor.dirty = true;
    autoSaveDraft();
  });
  root.querySelector("#editorSearch")?.addEventListener("input", (event) => {
    appState.editor.search = event.target.value;
  });
  root.querySelector("#editorSearch")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const textarea = root.querySelector("#contentInput");
    const needle = appState.editor.search.trim();
    if (!textarea || !needle) return;
    const index = textarea.value.indexOf(needle, textarea.selectionEnd);
    const found = index >= 0 ? index : textarea.value.indexOf(needle);
    if (found >= 0) {
      textarea.focus();
      textarea.setSelectionRange(found, found + needle.length);
    } else {
      setToast("未找到匹配内容", "error");
    }
  });
}

function bindPrompter() {
  const script = currentScript();
  root.querySelector("#backFromPrompter")?.addEventListener("click", () => navigate("manager"));
  root.querySelector("#settingsButton")?.addEventListener("click", () => {
    appState.prompter.settingsOpen = true;
    render();
  });
  root.querySelector("#closeSettingsButton")?.addEventListener("click", () => {
    appState.prompter.settingsOpen = false;
    render();
  });
  root.querySelector("#playPrompterButton")?.addEventListener("click", () => {
    if (appState.prompter.isPlaying) {
      stopPrompter();
      render();
    } else {
      startCountdownThenPlay();
    }
  });
  root.querySelector("#restartPrompterButton")?.addEventListener("click", () => {
    stopPrompter();
    const viewport = root.querySelector("#prompterViewport");
    if (viewport) viewport.scrollTop = 0;
    updatePrompterProgress();
    render();
  });
  root.querySelector("#prevCharButton")?.addEventListener("click", () => {
    scrollPrompterBy(-window.innerHeight * 0.18);
  });
  root.querySelector("#nextCharButton")?.addEventListener("click", () => {
    scrollPrompterBy(window.innerHeight * 0.18);
  });
  root.querySelector("#fullscreenButton")?.addEventListener("click", async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  });
  root.querySelector("#landscapeButton")?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      await screen.orientation?.lock?.("landscape");
      setToast("已尝试切换横屏");
    } catch {
      setToast("请打开系统自动旋转后横放手机", "error");
    }
  });
  root.querySelector("#prompterViewport")?.addEventListener("click", (event) => {
    if (appState.prompter.tapPause && appState.prompter.isPlaying) {
      stopPrompter();
      render();
    }
  });
  root.querySelector("#prompterViewport")?.addEventListener("scroll", updatePrompterProgress, { passive: true });

  bindSetting("fontSizeRange", (value) => {
    appState.prompter.fontSize = Number(value);
    appState.prompter.responsive = false;
  });
  bindSetting("lineHeightRange", (value) => {
    appState.prompter.lineHeight = Number(value);
    appState.prompter.responsive = false;
  });
  bindSetting("paddingRange", (value) => {
    appState.prompter.paddingX = Number(value);
    appState.prompter.responsive = false;
  });
  bindSetting("scrollSpeedRange", (value) => {
    appState.prompter.scrollSpeed = Number(value);
  });
  bindSetting("countdownRange", (value) => {
    appState.prompter.countdownSeconds = Number(value);
  });
  bindToggle("responsiveToggle", "responsive");
  bindToggle("mirrorToggle", "mirrorMode");
  bindToggle("tapPauseToggle", "tapPause");
  bindToggle("wakeLockToggle", "wakeLock");

  root.querySelector("#prompterInlineEditor")?.addEventListener("input", (event) => {
    if (!script) return;
    script.content = event.target.value;
    script.updatedAt = Date.now();
    saveState();
  });
}

function bindSetting(id, onChange) {
  root.querySelector(`#${id}`)?.addEventListener("input", (event) => {
    onChange(event.target.value);
    saveState();
    render();
  });
}

function bindToggle(id, key) {
  root.querySelector(`#${id}`)?.addEventListener("change", (event) => {
    appState.prompter[key] = event.target.checked;
    if (key === "responsive" && event.target.checked) applyResponsivePreset();
    saveState();
    render();
  });
}

window.addEventListener("resize", () => {
  if (appState.route === "prompter" && appState.prompter.responsive) render();
});

document.addEventListener("keydown", (event) => {
  if (appState.route !== "prompter") return;
  if (event.code === "Space") {
    event.preventDefault();
    if (appState.prompter.isPlaying) {
      stopPrompter();
      render();
    } else {
      startCountdownThenPlay();
    }
  }
  if (event.key === "ArrowRight") {
    scrollPrompterBy(window.innerHeight * 0.18);
  }
  if (event.key === "ArrowLeft") {
    scrollPrompterBy(-window.innerHeight * 0.18);
  }
  if (event.key === "Escape") {
    appState.prompter.settingsOpen = false;
    render();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && appState.prompter.isPlaying) requestWakeLock();
});

loadState();
render();
