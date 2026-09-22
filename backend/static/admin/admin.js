const TOKEN_KEY = "arcanyx_admin_token";
const state = { items: [], selected: null, dragging: null };
const spreadState = { items: [], selected: null, dragging: null };
const $ = (id) => document.getElementById(id);

function token() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

function detailMessage(payload, fallback = "Произошла ошибка") {
  const detail = payload?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.configured === false) return "Timeweb S3 ещё не настроен на сервере.";
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(", ");
  return fallback;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token()) headers.set("Authorization", `Bearer ${token()}`);
  const response = await fetch(`/api${path}`, { ...options, headers });
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      showLogin("Сессия истекла. Войдите снова.");
    }
    throw new Error(detailMessage(payload, `Ошибка ${response.status}`));
  }
  return payload;
}

function flash(message, isError = false) {
  const node = $("flash");
  node.textContent = message;
  node.className = `flash${isError ? " error" : ""}`;
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => node.classList.add("hidden"), 4500);
}

function showLogin(error = "") {
  $("app-view").classList.add("hidden");
  $("login-view").classList.remove("hidden");
  $("login-error").textContent = error;
}

function showApp() {
  $("login-view").classList.add("hidden");
  $("app-view").classList.remove("hidden");
}

async function exchangeGoogleCode() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const authError = params.get("error");
  if (authError) {
    history.replaceState({}, "", "/admin");
    throw new Error(authError);
  }
  if (!code) return false;
  const response = await fetch("/api/auth/google/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const payload = await response.json();
  history.replaceState({}, "", "/admin");
  if (!response.ok || !payload.access_token) {
    throw new Error(detailMessage(payload, "Не удалось завершить вход"));
  }
  sessionStorage.setItem(TOKEN_KEY, payload.access_token);
  return true;
}

function draftFromForm() {
  return {
    title: $("title").value.trim(),
    slug: $("slug").value.trim().toLowerCase(),
    description: $("description").value.trim(),
    tags: $("tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    sort: Number($("sort").value || 0),
  };
}

function setForm(item) {
  state.selected = item;
  $("empty-editor").classList.add("hidden");
  $("editor-form").classList.remove("hidden");
  $("title").value = item?.title || "";
  $("slug").value = item?.slug || "";
  $("description").value = item?.description || "";
  $("tags").value = (item?.tags || []).join(", ");
  $("sort").value = item?.sort ?? state.items.length;
  $("editor-heading").textContent = item?.title || "Новая медитация";
  $("publish-badge").textContent = item?.published ? "Опубликована" : "Черновик";
  $("publish-badge").classList.toggle("live", Boolean(item?.published));
  $("archive-button").classList.toggle("hidden", !item);
  $("media-section").classList.toggle("hidden", !item);
  $("publish-actions").classList.toggle("hidden", !item);
  $("publish-button").classList.toggle("hidden", Boolean(item?.published));
  $("unpublish-button").classList.toggle("hidden", !item?.published);
  renderMedia(item);
  renderList();
}

function formatDuration(seconds) {
  if (!seconds) return "длительность неизвестна";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function renderMedia(item) {
  const audio = item?.audio;
  const audioNode = $("audio-preview");
  if (audio?.url) {
    audioNode.src = `${audio.url}${audio.url.includes("?") ? "&" : "?"}v=${encodeURIComponent(audio.version || "")}`;
    audioNode.classList.remove("hidden");
    $("audio-meta").textContent = `${formatDuration(audio.durationSec)} · ${(audio.size / 1024 / 1024).toFixed(1)} МБ`;
  } else {
    audioNode.removeAttribute("src");
    audioNode.classList.add("hidden");
    $("audio-meta").textContent = "Файл не загружен";
  }

  const cover = item?.cover;
  const image = $("cover-preview");
  if (cover?.url) {
    image.src = `${cover.url}${cover.url.includes("?") ? "&" : "?"}v=${encodeURIComponent(cover.version || "")}`;
    image.classList.remove("hidden");
    $("cover-placeholder").classList.add("hidden");
  } else {
    image.removeAttribute("src");
    image.classList.add("hidden");
    $("cover-placeholder").classList.remove("hidden");
  }

  const versions = item?.audioVersions || [];
  $("rollback-wrap").classList.toggle("hidden", versions.length === 0);
  $("audio-version").innerHTML = versions.map((version) => {
    const label = `${formatDuration(version.durationSec)} · ${new Date(version.createdAt).toLocaleString("ru")}`;
    return `<option value="${escapeHtml(version.version)}">${escapeHtml(label)}</option>`;
  }).join("");

  const coverVersions = item?.coverVersions || [];
  $("cover-rollback-wrap").classList.toggle("hidden", coverVersions.length === 0);
  $("cover-version").innerHTML = coverVersions.map((version) => {
    const label = new Date(version.createdAt).toLocaleString("ru");
    return `<option value="${escapeHtml(version.version)}">${escapeHtml(label)}</option>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderList() {
  $("item-count").textContent = `${state.items.length} шт.`;
  $("meditation-list").innerHTML = state.items.map((item) => `
    <button class="list-item${state.selected?.slug === item.slug ? " active" : ""}"
      data-slug="${escapeHtml(item.slug)}" draggable="true">
      <strong>${escapeHtml(item.title)}</strong>
      <span class="status-dot${item.published ? " live" : ""}">${item.published ? "● online" : "○ draft"}</span>
      <small>${escapeHtml(item.slug)}</small>
    </button>
  `).join("");

  document.querySelectorAll(".list-item").forEach((node) => {
    node.addEventListener("click", () => {
      const item = state.items.find((entry) => entry.slug === node.dataset.slug);
      if (item) setForm(item);
    });
    node.addEventListener("dragstart", () => {
      state.dragging = node.dataset.slug;
      node.classList.add("dragging");
    });
    node.addEventListener("dragend", () => node.classList.remove("dragging"));
    node.addEventListener("dragover", (event) => event.preventDefault());
    node.addEventListener("drop", async (event) => {
      event.preventDefault();
      const target = node.dataset.slug;
      if (!state.dragging || state.dragging === target) return;
      const from = state.items.findIndex((entry) => entry.slug === state.dragging);
      const to = state.items.findIndex((entry) => entry.slug === target);
      const [moved] = state.items.splice(from, 1);
      state.items.splice(to, 0, moved);
      renderList();
      try {
        await api("/admin/meditations/reorder", {
          method: "POST",
          body: JSON.stringify({ slugs: state.items.map((entry) => entry.slug) }),
        });
        flash("Порядок сохранён");
      } catch (error) {
        flash(error.message, true);
        await loadItems();
      }
    });
  });
}

async function loadItems(selectSlug = state.selected?.slug) {
  const payload = await api("/admin/meditations");
  state.items = payload.items || [];
  renderList();
  if (selectSlug) {
    const selected = state.items.find((item) => item.slug === selectSlug);
    if (selected) setForm(selected);
  }
}

function uploadFile(kind, file) {
  return new Promise((resolve, reject) => {
    if (!state.selected) return reject(new Error("Сначала сохраните черновик"));
    const xhr = new XMLHttpRequest();
    const progress = $(`${kind}-progress`);
    progress.value = 0;
    progress.classList.remove("hidden");
    xhr.open("POST", `/api/admin/meditations/${encodeURIComponent(state.selected.slug)}/${kind}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token()}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress.value = Math.round((event.loaded / event.total) * 100);
    };
    xhr.onload = () => {
      progress.classList.add("hidden");
      let payload = {};
      try { payload = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
      else reject(new Error(detailMessage(payload, `Ошибка ${xhr.status}`)));
    };
    xhr.onerror = () => {
      progress.classList.add("hidden");
      reject(new Error("Сеть недоступна"));
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

async function handleUpload(kind, file) {
  if (!file) return;
  try {
    const item = await uploadFile(kind, file);
    state.selected = item;
    await loadItems(item.slug);
    flash(kind === "audio" ? "Аудио загружено" : "Обложка загружена");
  } catch (error) {
    flash(error.message, true);
  } finally {
    $(`${kind}-file`).value = "";
  }
}

function switchSection(section) {
  const spreads = section === "spreads";
  $("meditations-panel").classList.toggle("hidden", spreads);
  $("spreads-panel").classList.toggle("hidden", !spreads);
  $("tab-meditations").classList.toggle("active", !spreads);
  $("tab-spreads").classList.toggle("active", spreads);
  $("section-title").textContent = spreads ? "Расклады Таро" : "Медитации";
}

function spreadPositionsFromForm() {
  return [...document.querySelectorAll(".position-row")].map((row) => ({
    id: row.querySelector("[data-position-id]").value.trim().toLowerCase(),
    labelRu: row.querySelector("[data-position-label]").value.trim(),
  }));
}

function renderSpreadPositions(positions) {
  const values = positions?.length ? positions : [{ id: "answer", labelRu: "Ответ" }];
  $("spread-positions").innerHTML = values.map((position, index) => `
    <div class="position-row" draggable="true" data-index="${index}">
      <span class="position-handle" title="Перетащить">⋮⋮</span>
      <label>ID
        <input data-position-id maxlength="80" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required value="${escapeHtml(position.id)}" />
      </label>
      <label>Подпись
        <input data-position-label maxlength="120" required value="${escapeHtml(position.labelRu)}" />
      </label>
      <button type="button" class="position-remove" data-remove-position="${index}" aria-label="Удалить позицию">×</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-remove-position]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = spreadPositionsFromForm();
      if (current.length <= 1) {
        flash("В раскладе должна остаться хотя бы одна позиция", true);
        return;
      }
      current.splice(Number(button.dataset.removePosition), 1);
      renderSpreadPositions(current);
    });
  });
  document.querySelectorAll(".position-row").forEach((row) => {
    row.addEventListener("dragstart", () => {
      spreadState.positionDragging = Number(row.dataset.index);
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
    row.addEventListener("dragover", (event) => event.preventDefault());
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      const from = spreadState.positionDragging;
      const to = Number(row.dataset.index);
      if (!Number.isInteger(from) || from === to) return;
      const current = spreadPositionsFromForm();
      const [moved] = current.splice(from, 1);
      current.splice(to, 0, moved);
      renderSpreadPositions(current);
    });
  });
}

function spreadDraftFromForm() {
  return {
    titleRu: $("spread-title").value.trim(),
    slug: $("spread-slug").value.trim().toLowerCase(),
    subtitleRu: $("spread-subtitle").value.trim(),
    positions: spreadPositionsFromForm(),
    sort: Number($("spread-sort").value || 0),
  };
}

function renderSpreadCover(item) {
  const cover = item?.cover;
  const image = $("spread-cover-preview");
  if (cover?.url) {
    image.src = `${cover.url}${cover.url.includes("?") ? "&" : "?"}v=${encodeURIComponent(cover.version || "")}`;
    image.classList.remove("hidden");
    $("spread-cover-placeholder").classList.add("hidden");
  } else {
    image.removeAttribute("src");
    image.classList.add("hidden");
    $("spread-cover-placeholder").classList.remove("hidden");
  }
  const versions = item?.coverVersions || [];
  $("spread-cover-rollback-wrap").classList.toggle("hidden", versions.length === 0);
  $("spread-cover-version").innerHTML = versions.map((version) => {
    const label = new Date(version.createdAt).toLocaleString("ru");
    return `<option value="${escapeHtml(version.version)}">${escapeHtml(label)}</option>`;
  }).join("");
}

function setSpreadForm(item) {
  spreadState.selected = item;
  $("spread-empty-editor").classList.add("hidden");
  $("spread-editor-form").classList.remove("hidden");
  $("spread-title").value = item?.titleRu || "";
  $("spread-slug").value = item?.slug || "";
  $("spread-subtitle").value = item?.subtitleRu || "";
  $("spread-sort").value = item?.sort ?? spreadState.items.length;
  $("spread-editor-heading").textContent = item?.titleRu || "Новый расклад";
  $("spread-publish-badge").textContent = item?.published ? "Опубликован" : "Черновик";
  $("spread-publish-badge").classList.toggle("live", Boolean(item?.published));
  $("spread-archive-button").classList.toggle("hidden", !item);
  $("spread-media-section").classList.toggle("hidden", !item);
  $("spread-publish-actions").classList.toggle("hidden", !item);
  $("spread-publish-button").classList.toggle("hidden", Boolean(item?.published));
  $("spread-unpublish-button").classList.toggle("hidden", !item?.published);
  renderSpreadPositions(item?.positions);
  renderSpreadCover(item);
  renderSpreadList();
}

function renderSpreadList() {
  $("spread-item-count").textContent = `${spreadState.items.length} шт.`;
  $("spread-list").innerHTML = spreadState.items.map((item) => `
    <button class="list-item${spreadState.selected?.slug === item.slug ? " active" : ""}"
      data-spread-slug="${escapeHtml(item.slug)}" draggable="true">
      <strong>${escapeHtml(item.titleRu)}</strong>
      <span class="status-dot${item.published ? " live" : ""}">${item.published ? "● online" : "○ draft"}</span>
      <small>${item.drawCount} карт · ${escapeHtml(item.slug)}</small>
    </button>
  `).join("");
  document.querySelectorAll("[data-spread-slug]").forEach((node) => {
    node.addEventListener("click", () => {
      const item = spreadState.items.find((entry) => entry.slug === node.dataset.spreadSlug);
      if (item) setSpreadForm(item);
    });
    node.addEventListener("dragstart", () => {
      spreadState.dragging = node.dataset.spreadSlug;
      node.classList.add("dragging");
    });
    node.addEventListener("dragend", () => node.classList.remove("dragging"));
    node.addEventListener("dragover", (event) => event.preventDefault());
    node.addEventListener("drop", async (event) => {
      event.preventDefault();
      const target = node.dataset.spreadSlug;
      if (!spreadState.dragging || spreadState.dragging === target) return;
      const from = spreadState.items.findIndex((item) => item.slug === spreadState.dragging);
      const to = spreadState.items.findIndex((item) => item.slug === target);
      const [moved] = spreadState.items.splice(from, 1);
      spreadState.items.splice(to, 0, moved);
      renderSpreadList();
      try {
        await api("/admin/tarot-spreads/reorder", {
          method: "POST",
          body: JSON.stringify({ slugs: spreadState.items.map((item) => item.slug) }),
        });
        flash("Порядок раскладов сохранён");
      } catch (error) {
        flash(error.message, true);
        await loadSpreadItems();
      }
    });
  });
}

async function loadSpreadItems(selectSlug = spreadState.selected?.slug) {
  const payload = await api("/admin/tarot-spreads");
  spreadState.items = payload.items || [];
  renderSpreadList();
  if (selectSlug) {
    const selected = spreadState.items.find((item) => item.slug === selectSlug);
    if (selected) setSpreadForm(selected);
  }
}

function uploadSpreadCover(file) {
  return new Promise((resolve, reject) => {
    if (!spreadState.selected) return reject(new Error("Сначала сохраните черновик"));
    const xhr = new XMLHttpRequest();
    const progress = $("spread-cover-progress");
    progress.value = 0;
    progress.classList.remove("hidden");
    xhr.open("POST", `/api/admin/tarot-spreads/${encodeURIComponent(spreadState.selected.slug)}/cover`);
    xhr.setRequestHeader("Authorization", `Bearer ${token()}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress.value = Math.round((event.loaded / event.total) * 100);
    };
    xhr.onload = () => {
      progress.classList.add("hidden");
      let payload = {};
      try { payload = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
      else reject(new Error(detailMessage(payload, `Ошибка ${xhr.status}`)));
    };
    xhr.onerror = () => {
      progress.classList.add("hidden");
      reject(new Error("Сеть недоступна"));
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

async function initialize() {
  try {
    await exchangeGoogleCode();
  } catch (error) {
    showLogin(error.message);
    return;
  }
  if (!token()) {
    showLogin();
    return;
  }
  try {
    const status = await api("/admin/status");
    showApp();
    $("account-email").textContent = status.user.email;
    if (!status.storage.configured) {
      $("storage-warning").textContent = "Timeweb S3 не настроен: просмотр и редактирование доступны, загрузка файлов — после добавления ключей в .env.";
      $("storage-warning").classList.remove("hidden");
    }
    await Promise.all([loadItems(), loadSpreadItems()]);
  } catch (error) {
    showLogin(error.message);
  }
}

$("login-button").addEventListener("click", () => {
  const redirect = `${location.origin}/admin`;
  location.assign(`/api/auth/google/start?redirect_uri=${encodeURIComponent(redirect)}`);
});
$("logout-button").addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_KEY);
  showLogin();
});
$("tab-meditations").addEventListener("click", () => switchSection("meditations"));
$("tab-spreads").addEventListener("click", () => switchSection("spreads"));
$("new-button").addEventListener("click", () => setForm(null));
$("editor-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = draftFromForm();
  $("save-state").textContent = "Сохраняю…";
  try {
    const path = state.selected
      ? `/admin/meditations/${encodeURIComponent(state.selected.slug)}`
      : "/admin/meditations";
    const item = await api(path, {
      method: state.selected ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    state.selected = item;
    await loadItems(item.slug);
    flash("Черновик сохранён");
  } catch (error) {
    flash(error.message, true);
  } finally {
    $("save-state").textContent = "";
  }
});
$("audio-file").addEventListener("change", (event) => handleUpload("audio", event.target.files[0]));
$("cover-file").addEventListener("change", (event) => handleUpload("cover", event.target.files[0]));
$("publish-button").addEventListener("click", async () => {
  if (!state.selected) return;
  try {
    const item = await api(`/admin/meditations/${encodeURIComponent(state.selected.slug)}/publish`, { method: "POST" });
    state.selected = item;
    await loadItems(item.slug);
    flash("Медитация опубликована");
  } catch (error) { flash(error.message, true); }
});
$("unpublish-button").addEventListener("click", async () => {
  if (!state.selected) return;
  try {
    const item = await api(`/admin/meditations/${encodeURIComponent(state.selected.slug)}/unpublish`, { method: "POST" });
    state.selected = item;
    await loadItems(item.slug);
    flash("Медитация снята с публикации");
  } catch (error) { flash(error.message, true); }
});
$("rollback-button").addEventListener("click", async () => {
  if (!state.selected || !confirm("Вернуть выбранную версию аудио?")) return;
  try {
    const item = await api(`/admin/meditations/${encodeURIComponent(state.selected.slug)}/audio/rollback`, {
      method: "POST",
      body: JSON.stringify({ version: $("audio-version").value }),
    });
    state.selected = item;
    await loadItems(item.slug);
    flash("Версия аудио восстановлена");
  } catch (error) { flash(error.message, true); }
});
$("cover-rollback-button").addEventListener("click", async () => {
  if (!state.selected || !confirm("Вернуть выбранную версию обложки?")) return;
  try {
    const item = await api(`/admin/meditations/${encodeURIComponent(state.selected.slug)}/cover/rollback`, {
      method: "POST",
      body: JSON.stringify({ version: $("cover-version").value }),
    });
    state.selected = item;
    await loadItems(item.slug);
    flash("Версия обложки восстановлена");
  } catch (error) { flash(error.message, true); }
});
$("archive-button").addEventListener("click", async () => {
  if (!state.selected || !confirm("Убрать медитацию в архив?")) return;
  try {
    await api(`/admin/meditations/${encodeURIComponent(state.selected.slug)}`, { method: "DELETE" });
    state.selected = null;
    $("editor-form").classList.add("hidden");
    $("empty-editor").classList.remove("hidden");
    await loadItems(null);
    flash("Медитация перемещена в архив");
  } catch (error) { flash(error.message, true); }
});

$("spread-new-button").addEventListener("click", () => setSpreadForm(null));
$("spread-add-position").addEventListener("click", () => {
  const current = spreadPositionsFromForm();
  if (current.length >= 5) {
    flash("В раскладе может быть не больше пяти позиций", true);
    return;
  }
  current.push({ id: `position-${current.length + 1}`, labelRu: "" });
  renderSpreadPositions(current);
});
$("spread-editor-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = spreadDraftFromForm();
  $("spread-save-state").textContent = "Сохраняю…";
  try {
    const path = spreadState.selected
      ? `/admin/tarot-spreads/${encodeURIComponent(spreadState.selected.slug)}`
      : "/admin/tarot-spreads";
    const item = await api(path, {
      method: spreadState.selected ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    spreadState.selected = item;
    await loadSpreadItems(item.slug);
    flash("Расклад сохранён");
  } catch (error) {
    flash(error.message, true);
  } finally {
    $("spread-save-state").textContent = "";
  }
});
$("spread-cover-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const item = await uploadSpreadCover(file);
    spreadState.selected = item;
    await loadSpreadItems(item.slug);
    flash("Изображение расклада загружено");
  } catch (error) {
    flash(error.message, true);
  } finally {
    $("spread-cover-file").value = "";
  }
});
$("spread-cover-rollback-button").addEventListener("click", async () => {
  if (!spreadState.selected || !confirm("Вернуть выбранную версию изображения?")) return;
  try {
    const item = await api(`/admin/tarot-spreads/${encodeURIComponent(spreadState.selected.slug)}/cover/rollback`, {
      method: "POST",
      body: JSON.stringify({ version: $("spread-cover-version").value }),
    });
    spreadState.selected = item;
    await loadSpreadItems(item.slug);
    flash("Версия изображения восстановлена");
  } catch (error) { flash(error.message, true); }
});
$("spread-publish-button").addEventListener("click", async () => {
  if (!spreadState.selected) return;
  try {
    const item = await api(`/admin/tarot-spreads/${encodeURIComponent(spreadState.selected.slug)}/publish`, { method: "POST" });
    spreadState.selected = item;
    await loadSpreadItems(item.slug);
    flash("Расклад опубликован");
  } catch (error) { flash(error.message, true); }
});
$("spread-unpublish-button").addEventListener("click", async () => {
  if (!spreadState.selected) return;
  try {
    const item = await api(`/admin/tarot-spreads/${encodeURIComponent(spreadState.selected.slug)}/unpublish`, { method: "POST" });
    spreadState.selected = item;
    await loadSpreadItems(item.slug);
    flash("Расклад снят с публикации");
  } catch (error) { flash(error.message, true); }
});
$("spread-archive-button").addEventListener("click", async () => {
  if (!spreadState.selected || !confirm("Убрать расклад в архив?")) return;
  try {
    await api(`/admin/tarot-spreads/${encodeURIComponent(spreadState.selected.slug)}`, { method: "DELETE" });
    spreadState.selected = null;
    $("spread-editor-form").classList.add("hidden");
    $("spread-empty-editor").classList.remove("hidden");
    await loadSpreadItems(null);
    flash("Расклад перемещён в архив");
  } catch (error) { flash(error.message, true); }
});

initialize();
