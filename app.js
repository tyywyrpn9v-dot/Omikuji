const DATA_URL = "data/omikuji.json";
const SYNONYMS_URL = "data/synonyms.json";

const state = {
  entries: [],
  filtered: [],
  query: "",
  favoritesOnly: false,
  sort: "name"
};

const els = {
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  results: document.querySelector("#results"),
  resultsTitle: document.querySelector("#resultsTitle"),
  resultsMeta: document.querySelector("#resultsMeta"),
  emptyState: document.querySelector("#emptyState"),
  prefecture: document.querySelector("#prefectureFilter"),
  motif: document.querySelector("#motifFilter"),
  material: document.querySelector("#materialFilter"),
  status: document.querySelector("#statusFilter"),
  maxPrice: document.querySelector("#maxPriceFilter"),
  sort: document.querySelector("#sortSelect"),
  activeFilters: document.querySelector("#activeFilters"),
  detailModal: document.querySelector("#detailModal"),
  modalContent: document.querySelector("#modalContent"),
  favoritesNavBtn: document.querySelector("#favoritesNavBtn"),
  clearFiltersBtn: document.querySelector("#clearFiltersBtn")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();

  try {
    const [dataResponse, synonymsResponse] = await Promise.all([
      fetch(DATA_URL, { cache: "no-store" }),
      fetch(SYNONYMS_URL, { cache: "no-store" })
    ]);
    if (!dataResponse.ok) throw new Error(`Database HTTP ${dataResponse.status}`);
    if (!synonymsResponse.ok) throw new Error(`Synonyms HTTP ${synonymsResponse.status}`);

    state.entries = await dataResponse.json();
    state.synonyms = await synonymsResponse.json();
    populateFilters();
    applyFilters();
  } catch (error) {
    console.error(error);
    els.resultsMeta.textContent = "資料庫載入失敗";
    els.results.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>未能載入資料庫</h3>
        <p>請確認 GitHub Pages 上的 data/omikuji.json 存在且 JSON 格式正確。</p>
      </div>`;
  }
}

function bindEvents() {
  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = els.searchInput.value.trim();
    state.favoritesOnly = false;
    applyFilters();
  });

  els.searchInput.addEventListener("input", () => {
    state.query = els.searchInput.value.trim();
    state.favoritesOnly = false;
    applyFilters();
  });

  [els.prefecture, els.motif, els.material, els.status, els.maxPrice, els.sort]
    .forEach(el => el.addEventListener("change", () => {
      if (el === els.sort) state.sort = el.value;
      applyFilters();
    }));

  els.clearFiltersBtn.addEventListener("click", clearFilters);

  els.favoritesNavBtn.addEventListener("click", () => {
    state.favoritesOnly = !state.favoritesOnly;
    els.resultsTitle.textContent = state.favoritesOnly ? "我的最愛" : "全部御神籤";
    applyFilters();
  });

  document.querySelectorAll("[data-query]").forEach(button => {
    button.addEventListener("click", () => {
      els.searchInput.value = button.dataset.query;
      state.query = button.dataset.query;
      state.favoritesOnly = false;
      applyFilters();
    });
  });

  document.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest("[data-favorite-id]");
    if (favoriteButton) {
      event.stopPropagation();
      toggleFavorite(favoriteButton.dataset.favoriteId);
      return;
    }

    const cardButton = event.target.closest("[data-entry-id]");
    if (cardButton) openDetail(cardButton.dataset.entryId);

    if (event.target.matches("[data-close-modal]")) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
}

function populateFilters() {
  fillSelect(els.prefecture, unique(state.entries.map(e => e.prefecture).filter(Boolean)));
  fillSelect(els.motif, unique(state.entries.flatMap(e => e.motif || [])));
  fillSelect(els.material, unique(state.entries.map(e => e.material).filter(Boolean)));
}

function fillSelect(select, values) {
  values.sort((a, b) => String(a).localeCompare(String(b), "ja"));
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

function applyFilters() {
  const parsedQuery = parseQuery(state.query);
  const maxPrice = Number(els.maxPrice.value) || parsedQuery.maxPrice;

  let list = state.entries.filter(entry => {
    if (state.favoritesOnly && !getFavorites().has(entry.id)) return false;
    if (els.prefecture.value && entry.prefecture !== els.prefecture.value) return false;
    if (els.motif.value && !(entry.motif || []).includes(els.motif.value)) return false;
    if (els.material.value && entry.material !== els.material.value) return false;
    if (els.status.value && entry.status !== els.status.value) return false;
    if (maxPrice && parsePrice(entry.price) > maxPrice) return false;

    // Every remaining query term must match.
    return parsedQuery.terms.every(term => {
      const expanded = expandSearchTerm(term).split(" ").filter(Boolean);
      const text = searchableText(entry);
      return expanded.some(token => text.includes(token));
    });
  });

  list.sort(getSortFunction());
  state.filtered = list;
  render();
}

function parseQuery(raw) {
  const normalized = normalize(raw);
  if (!normalized) return { terms: [], maxPrice: 0 };

  const priceMatch = normalized.match(/(?:¥|￥|jpy)?\s*(\d[\d,]*)\s*円?\s*(?:以下|以内|まで|under|below|less than)/i);
  const maxPrice = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : 0;

  const withoutPrice = normalized
    .replace(/(?:¥|￥|jpy)?\s*\d[\d,]*\s*円?\s*(?:以下|以内|まで|under|below|less than)/ig, " ")
    .trim();

  const terms = withoutPrice.split(/\s+/).filter(Boolean);

  // Special status words are handled as structured filters.
  const statusMap = state.synonyms?.special_terms || {};
  for (const [status, words] of Object.entries(statusMap)) {
    if (status === "price_under") continue;
    if (terms.some(term => words.some(word => normalize(word) === term))) {
      // Apply through a virtual filter only when the status selector is untouched.
      if (!els.status.value && status !== "price_under") {
        els.status.value = status;
      }
    }
  }

  return { terms, maxPrice };
}

function expandSearchTerm(term) {
  const normalizedTerm = normalize(term);
  if (!state.synonyms) return normalizedTerm;

  const groups = state.synonyms.motif_groups || [];
  for (const group of groups) {
    for (const item of group.items || []) {
      const synonyms = item.synonyms || [];
      if (synonyms.some(s => normalize(s) === normalizedTerm)) {
        return synonyms.map(normalize).join(" ");
      }
    }
  }

  const prefecture = (state.synonyms.prefectures || []).find(p =>
    normalize(p.name_ja) === normalizedTerm ||
    normalize(p.name_ja.replace(/[都道府県]$/, "")) === normalizedTerm ||
    normalize(p.romaji) === normalizedTerm
  );
  if (prefecture) return normalize(prefecture.name_ja);

  return normalizedTerm;
}

function searchableText(entry) {
  const parts = [
    entry.name_jp,
    entry.shrine_temple_jp,
    entry.institution_type,
    entry.prefecture,
    entry.city,
    entry.address,
    entry.material,
    entry.price,
    entry.notes,
    ...(entry.motif || []),
    ...(entry.search_terms || [])
  ];
  return normalize(parts.filter(Boolean).join(" "));
}

function getSortFunction() {
  if (state.sort === "prefecture") {
    return (a, b) => `${a.prefecture}${a.name_jp}`.localeCompare(`${b.prefecture}${b.name_jp}`, "ja");
  }
  if (state.sort === "priceAsc") {
    return (a, b) => (parsePrice(a.price) || Infinity) - (parsePrice(b.price) || Infinity);
  }
  if (state.sort === "recent") {
    return (a, b) => String(b.last_verified_date || "").localeCompare(String(a.last_verified_date || ""));
  }
  return (a, b) => String(a.name_jp || "").localeCompare(String(b.name_jp || ""), "ja");
}

function render() {
  els.results.innerHTML = "";
  els.emptyState.hidden = state.filtered.length !== 0;

  const title = state.favoritesOnly ? "我的最愛" : "搜尋結果";
  els.resultsTitle.textContent = title;
  els.resultsMeta.textContent = `共 ${state.filtered.length} 項`;

  renderActiveFilters();

  for (const entry of state.filtered) {
    els.results.appendChild(createCard(entry));
  }
}

function createCard(entry) {
  const article = document.createElement("article");
  article.className = "card";

  const image = Array.isArray(entry.images) && entry.images[0] ? entry.images[0] : "";
  const status = statusLabel(entry.status);
  const favorite = getFavorites().has(entry.id);

  article.innerHTML = `
    <button class="favorite-btn ${favorite ? "is-collected" : ""}"
      type="button" data-favorite-id="${escapeAttr(entry.id)}"
      aria-label="${favorite ? "取消收藏" : "加入收藏"}">${favorite ? "❤️" : "♡"}</button>
    <button class="card-main" type="button" data-entry-id="${escapeAttr(entry.id)}">
      <div class="card-image">
        ${image
          ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(entry.name_jp || "御神籤")}">`
          : `<span class="image-placeholder">⛩️</span>`}
      </div>
      <h3 class="card-title">${escapeHtml(entry.name_jp || "未命名御神籤")}</h3>
      <p class="card-subtitle">${escapeHtml(entry.shrine_temple_jp || "")} · ${escapeHtml(entry.prefecture || "")}</p>
      <div class="tags">
        ${(entry.motif || []).slice(0, 4).map(m => `<span class="tag">${escapeHtml(m)}</span>`).join("")}
        ${entry.material ? `<span class="tag">${escapeHtml(entry.material)}</span>` : ""}
        ${entry.price ? `<span class="tag">${escapeHtml(entry.price)}</span>` : ""}
      </div>
      <span class="status ${status.className}">${status.text}</span>
    </button>
  `;

  return article;
}

function openDetail(id) {
  const entry = state.entries.find(e => e.id === id);
  if (!entry) return;

  const image = Array.isArray(entry.images) && entry.images[0] ? entry.images[0] : "";
  const maps = entry.google_maps_url || "";

  els.modalContent.innerHTML = `
    ${image ? `<img class="detail-image" src="${escapeAttr(image)}" alt="${escapeAttr(entry.name_jp || "御神籤")}">` : ""}
    <div class="detail-header">
      <h2 id="modalTitle">${escapeHtml(entry.name_jp || "未命名御神籤")}</h2>
      <p class="detail-jp">${escapeHtml(entry.shrine_temple_jp || "")}</p>
    </div>

    <dl class="detail-grid">
      ${detailItem("都道府縣", entry.prefecture)}
      ${detailItem("市區町村", entry.city)}
      ${detailItem("地址", entry.address)}
      ${detailItem("造型／題材", (entry.motif || []).join("、"))}
      ${detailItem("材質", entry.material)}
      ${detailItem("價格", entry.price)}
      ${detailItem("狀態", statusLabel(entry.status).text)}
      ${detailItem("最後核實", entry.last_verified_date)}
    </dl>

    ${maps ? `<a class="map-btn" href="${escapeAttr(maps)}" target="_blank" rel="noopener">📍 在 Google Maps 開啟</a>` : ""}

    <section class="detail-section">
      <h3>備註</h3>
      <p>${escapeHtml(entry.notes || "—")}</p>
    </section>

    <section class="detail-section">
      <h3>資料來源</h3>
      ${entry.source_url
        ? `<a class="source-link" href="${escapeAttr(entry.source_url)}" target="_blank" rel="noopener">${escapeHtml(entry.source_title || "來源")}</a>`
        : "<p>—</p>"}
      ${(entry.official_url || "").trim()
        ? `<a class="source-link" href="${escapeAttr(entry.official_url)}" target="_blank" rel="noopener">官方網站</a>`
        : ""}
    </section>

    <dl class="detail-grid">
      ${detailItem("來源刊載日期", entry.source_published_date)}
      ${detailItem("資料取得日期", entry.data_retrieved_date)}
    </dl>

    ${entry.version_notes ? `
      <section class="detail-section">
        <h3>版本／歷史備註</h3>
        <p>${escapeHtml(entry.version_notes)}</p>
      </section>` : ""}
  `;

  els.detailModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  els.detailModal.hidden = true;
  document.body.style.overflow = "";
}

function detailItem(label, value) {
  return `<div class="detail-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`;
}

function statusLabel(status) {
  if (status === "current_confirmed") return { text: "🟢 現在確認", className: "status-current" };
  if (status === "previously_confirmed") return { text: "🟡 曾確認／目前未核實", className: "status-previous" };
  if (status === "discontinued") return { text: "🔴 已停止", className: "status-discontinued" };
  return { text: "⚪ 資料不足", className: "" };
}

function clearFilters() {
  state.query = "";
  state.favoritesOnly = false;
  els.searchInput.value = "";
  els.prefecture.value = "";
  els.motif.value = "";
  els.material.value = "";
  els.status.value = "";
  els.maxPrice.value = "";
  applyFilters();
}

function getFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem("omikujiFavorites") || "[]"));
  } catch {
    return new Set();
  }
}

function toggleFavorite(id) {
  const favorites = getFavorites();
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  localStorage.setItem("omikujiFavorites", JSON.stringify([...favorites]));
  applyFilters();
}

function parsePrice(value) {
  if (!value) return 0;
  const match = String(value).replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function unique(values) {
  return [...new Set(values)];
}

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("ja")
    .replace(/[　]/g, " ")
    .replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
