/* ============================================================
   JunTech Review — popup.js (orchestrator)
   ----------------------------------------------------------
   Sau Prompt 10A refactor: popup.js là điều phối UI thuần,
   không còn logic Shopee hardcoded. Adapter pattern:
   - Logic platform → adapters/{name}-adapter.js
   - Logic phân tích → analysis/analyzer.js
   - Logic xuất Excel → analysis/exporter.js
   ============================================================ */

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let currentData = null;
// { url, productId, platform: {id,name,icon,color},
//   reviews, productInfo, stats, issues, seeding, recommendation }

/* ============================================================
   CẤU HÌNH DONATE — SỬA THÔNG TIN CỦA BẠN TRƯỚC KHI PHÁT HÀNH
   ============================================================ */
const DONATE_CONFIG = {
  BANK_CODE: "ICB",                 // VietinBank
  BANK_NAME: "VietinBank",
  ACCOUNT_NUMBER: "84949999",
  ACCOUNT_NAME: "LE HONG CONG",
  BMC_USERNAME: "",                 // để trống → tab quốc tế tự ẩn
};

/* ============================================================
   1. UI HELPERS (chung)
   ============================================================ */

function showError(msg) {
  const box = $("errorBox"), text = $("errorMessage");
  if (!box || !text) return;
  text.textContent = msg;
  box.classList.remove("hidden");
}
function hideError() { $("errorBox")?.classList.add("hidden"); }

function showLoading(label, percent) {
  const box = $("loadingBox"), labelEl = $("loadingLabel"), bar = $("progressBar");
  if (!box) return;
  if (label && labelEl) labelEl.textContent = label;
  if (typeof percent === "number" && bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  box.classList.remove("hidden");
}
function hideLoading() {
  $("loadingBox")?.classList.add("hidden");
  const bar = $("progressBar"); if (bar) bar.style.width = "0%";
}

function showResult(html) {
  const box = $("resultBox"), content = $("resultContent");
  if (!box || !content) return;
  content.innerHTML = html;
  box.classList.remove("hidden");
}
function hideResult() {
  $("resultBox")?.classList.add("hidden");
  const c = $("resultContent"); if (c) c.innerHTML = "";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

const safeUsername = (u) => (u && String(u).trim()) || "Ẩn danh";
function formatDate(ctime) {
  if (!Number.isFinite(ctime)) return "";
  try { return new Date(ctime * 1000).toLocaleDateString("vi-VN"); } catch { return ""; }
}
const ctimeToDate = (ct) => Number.isFinite(ct) ? formatDate(ct) : "—";

// Toast nhỏ trong popup (auto-fade sau 2.2s).
function showToast(msg, kind = "info") {
  let toast = $("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast hidden";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.dataset.kind = kind;
  toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

/* ============================================================
   2. AUTO-DETECT TAB HIỆN TẠI (qua adapter registry)
   ============================================================ */

/** True nếu URL được bất kỳ adapter đã đăng ký xử lý được. */
function isSupportedProductUrl(url) {
  return adapterRegistry.findByUrl(url) !== null;
}

async function getCurrentTabUrl() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      return { url: tabs[0].url || "", title: tabs[0].title || "" };
    }
    return null;
  } catch (err) {
    console.error("[JunTech] Lỗi lấy tab:", err);
    return null;
  }
}

function showDetectionBadge(type, text) {
  const badge = $("detectionBadge");
  if (!badge) return;
  badge.classList.remove("hidden", "warning");
  if (type === "warning") badge.classList.add("warning");

  const iconEl = badge.querySelector(".badge-icon");
  const textEl = badge.querySelector(".badge-text");
  if (iconEl) iconEl.textContent = type === "warning" ? "!" : "✓";
  if (textEl) textEl.textContent = text;

  clearTimeout(showDetectionBadge._timer);
  if (type === "warning") {
    showDetectionBadge._timer = setTimeout(() => badge.classList.add("hidden"), 4000);
  }
}

function hideDetectionBadge() {
  $("detectionBadge")?.classList.add("hidden");
}

async function tryAutoFillFromCurrentTab(showBadgeOnFail = false) {
  const tabInfo = await getCurrentTabUrl();
  const urlInput = $("urlInput");
  if (!urlInput) return false;

  if (!tabInfo) {
    if (showBadgeOnFail) showDetectionBadge("warning", "⚠️ Không thể lấy URL tab hiện tại.");
    return false;
  }

  const Adapter = adapterRegistry.findByUrl(tabInfo.url);
  if (!Adapter) {
    if (showBadgeOnFail) {
      showDetectionBadge("warning", "Tab hiện tại không thuộc sàn được hỗ trợ.");
    }
    return false;
  }

  urlInput.value = tabInfo.url;
  // Cắt suffix "| Shopee", "| TikTok Shop"...
  const cleanedTitle = (tabInfo.title || "")
    .replace(/\s*\|\s*(Shopee|TikTok Shop|Lazada|Tiki|Sendo).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const platformLabel = `${Adapter.platformIcon} ${Adapter.platformName}`;
  const text = cleanedTitle
    ? `${platformLabel}: ${cleanedTitle.length > 40 ? cleanedTitle.slice(0, 40) + "…" : cleanedTitle}`
    : `Đã phát hiện sản phẩm ${platformLabel}`;
  showDetectionBadge("success", text);
  showPlatformHint(Adapter);
  return true;
}

/** Hiện hint riêng cho platform (vd TikTok cần mở tab trước). */
function showPlatformHint(Adapter) {
  const box = $("platformHint");
  const text = $("platformHintText");
  if (!box || !text) return;

  if (Adapter?.platformId === "tiktokshop") {
    text.textContent = "TikTok Shop: Hãy MỞ trang sản phẩm trong tab riêng trước khi phân tích để lấy được nhiều review nhất.";
    box.classList.remove("hidden");
  } else {
    box.classList.add("hidden");
  }
}

function hidePlatformHint() {
  $("platformHint")?.classList.add("hidden");
}

/* ============================================================
   3. RENDERER chính (verdict view)
   ============================================================ */

function renderMain() {
  const { stats, recommendation: rec, productInfo, platform } = currentData;

  const trustText = { high: "Cao", medium: "Trung bình", low: "Thấp" }[rec.trustScore.level];
  const verdictHtml = `
    <div class="verdict" style="background:${rec.verdictColor}">
      <div class="verdict__label">${rec.verdictLabel}</div>
      <div class="verdict__score">${rec.score}<span class="verdict__score-max">/100</span></div>
      <div class="verdict__trust" title="${escapeHtml(rec.trustScore.reason)}">
        Độ tin cậy: <strong>${trustText}</strong>
      </div>
    </div>
  `;

  const platformLine = platform
    ? `<div class="product-line"><strong>${platform.icon} ${escapeHtml(platform.name)}</strong>${productInfo?.name ? " — " + escapeHtml(productInfo.name) : ""}</div>`
    : (productInfo?.name ? `<div class="product-line">${escapeHtml(productInfo.name)}</div>` : "");

  const issuesList = rec.topIssues.length === 0
    ? `<div class="empty-good">✅ Không phát hiện vấn đề nghiêm trọng trong review tiêu cực.</div>`
    : rec.topIssues.map((i) => `
        <div class="issue-item">
          <div class="issue-item__head">
            <span class="issue-item__icon">${i.icon}</span>
            <span class="issue-item__title">${escapeHtml(i.label)}</span>
            <span class="issue-item__count">${i.count} người (${i.percent}%)</span>
          </div>
          ${i.examples[0] ? `<div class="issue-item__quote">"${escapeHtml(i.examples[0]).slice(0, 140)}"</div>` : ""}
        </div>
      `).join("");
  const issuesHtml = `
    <div class="section">
      <div class="section__title">⚠️ Vấn đề khách hàng phàn nàn</div>
      ${issuesList}
    </div>
  `;

  const redFlagsHtml = rec.redFlags.length === 0 ? "" : `
    <div class="section">
      <div class="section__title">🚩 Cảnh báo</div>
      ${rec.redFlags.map((f) => `<div class="red-flag">${escapeHtml(f)}</div>`).join("")}
    </div>
  `;

  const statsHtml = `
    <div class="section">
      <div class="section__title">📊 Thống kê</div>
      <div class="stat-grid">
        <div class="stat-cell"><div class="stat-cell__num">${stats.avgRating}★</div><div class="stat-cell__lbl">TB</div></div>
        <div class="stat-cell"><div class="stat-cell__num">${stats.total}</div><div class="stat-cell__lbl">Tổng</div></div>
        <div class="stat-cell"><div class="stat-cell__num">${stats.authenticPercent}%</div><div class="stat-cell__lbl">Review thật</div></div>
        <div class="stat-cell"><div class="stat-cell__num">${stats.withMediaPercent}%</div><div class="stat-cell__lbl">Có ảnh</div></div>
      </div>
      <div class="dist">
        ${[5,4,3,2,1].map((s) => {
          const p = stats.distributionPercent[s];
          const isNeg = s <= 2;
          return `
            <div class="dist__row">
              <span class="dist__star">${s}★</span>
              <div class="dist__bar"><div class="dist__fill ${isNeg ? "dist__fill--neg" : ""}" style="width:${p}%"></div></div>
              <span class="dist__num">${stats.distribution[s]} (${p}%)</span>
            </div>`;
        }).join("")}
      </div>
    </div>
  `;

  const prosHtml = rec.pros.length === 0 ? "" : `
    <div class="section">
      <div class="section__title">💚 Điểm tích cực</div>
      <ul class="pros-list">${rec.pros.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
    </div>
  `;

  const buttonsHtml = `
    <div class="action-grid">
      <button class="btn btn--negative" data-action="view-negative" ${stats.negativeCount === 0 ? "disabled" : ""}>
        🔴 Xem ${stats.negativeCount} review 1-2★
      </button>
      <button class="btn btn--ghost" data-action="export-excel">📊 Xuất Excel</button>
      <button class="btn btn--ghost" data-action="view-all">👁️ Xem tất cả</button>
      <button class="btn btn--ghost" data-action="reanalyze">🔄 Sản phẩm khác</button>
    </div>
  `;

  showResult(platformLine + verdictHtml + issuesHtml + redFlagsHtml + statsHtml + prosHtml + buttonsHtml);
}

/* ============================================================
   4. REVIEWS VIEW — filter + sort + paginate
   ============================================================ */

const DEFAULT_FILTER_STATE = {
  star: "all",
  hasMedia: false,
  hasComment: false,
  recent: false,
  search: "",
  sort: "trust",
  displayLimit: 20,
};
let filterState = { ...DEFAULT_FILTER_STATE };
let searchDebounceTimer = null;

const PAGE_INCREMENT = 20;
const RECENT_WINDOW_SECS = 30 * 24 * 3600;

// Build NEG_KEYWORDS_PATTERN từ JunTechAnalyzer.ISSUE_CATEGORIES.
const NEG_KEYWORDS_PATTERN = (() => {
  const all = Object.values(JunTechAnalyzer.ISSUE_CATEGORIES).flatMap((c) => c.keywords);
  return all.slice().sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
})();

function highlightCommentHTML(comment, searchTerm) {
  const safe = escapeHtml(comment);
  if (!safe) return safe;
  const trimmedSearch = (searchTerm || "").trim();
  const searchPart = trimmedSearch ? `(${escapeRegExp(trimmedSearch)})` : "()";
  const negPart = NEG_KEYWORDS_PATTERN ? `(${NEG_KEYWORDS_PATTERN})` : "()";
  const combined = new RegExp(searchPart + "|" + negPart, "gi");
  return safe.replace(combined, (match, search, neg) => {
    if (search) return `<mark class="hl-search">${match}</mark>`;
    if (neg) return `<mark class="hl-neg">${match}</mark>`;
    return match;
  });
}

function applyFilters(allReviews, state) {
  const { getMediaCount, getCommentLen } = JunTechAnalyzer;
  let result = allReviews;

  if (state.star === "neg") {
    result = result.filter((r) => {
      const s = Number(r?.rating_star);
      return s === 1 || s === 2;
    });
  } else if (state.star !== "all") {
    const target = Number(state.star);
    result = result.filter((r) => Number(r?.rating_star) === target);
  }

  if (state.hasMedia) result = result.filter((r) => getMediaCount(r) > 0);
  if (state.hasComment) result = result.filter((r) => getCommentLen(r) >= 20);
  if (state.recent) {
    const cutoff = Math.floor(Date.now() / 1000) - RECENT_WINDOW_SECS;
    result = result.filter((r) => Number(r?.ctime) > cutoff);
  }

  const q = (state.search || "").trim().toLowerCase();
  if (q) {
    result = result.filter((r) => (r?.comment || "").toLowerCase().includes(q));
  }

  const sorted = result.slice();
  switch (state.sort) {
    case "newest":
      sorted.sort((a, b) => (Number(b?.ctime) || 0) - (Number(a?.ctime) || 0));
      break;
    case "oldest":
      sorted.sort((a, b) => (Number(a?.ctime) || 0) - (Number(b?.ctime) || 0));
      break;
    case "lowest":
      sorted.sort((a, b) => (Number(a?.rating_star) || 0) - (Number(b?.rating_star) || 0));
      break;
    case "highest":
      sorted.sort((a, b) => (Number(b?.rating_star) || 0) - (Number(a?.rating_star) || 0));
      break;
    case "longest":
      sorted.sort((a, b) => getCommentLen(b) - getCommentLen(a));
      break;
    case "trust":
    default:
      sorted.sort((a, b) => {
        const am = getMediaCount(a) > 0 ? 1 : 0;
        const bm = getMediaCount(b) > 0 ? 1 : 0;
        if (am !== bm) return bm - am;
        return getCommentLen(b) - getCommentLen(a);
      });
  }
  return sorted;
}

function renderReviewItem(r, searchTerm) {
  const { getMediaCount, getCommentLen, isEdited } = JunTechAnalyzer;
  const star = Number(r?.rating_star) || 0;
  const len = getCommentLen(r);
  const media = getMediaCount(r);

  const isNeg = star === 1 || star === 2;
  const isPositiveDetailed = (star === 4 || star === 5) && len >= 30 && media > 0;
  const cardClass = isNeg ? "review-item--negative"
    : isPositiveDetailed ? "review-item--positive" : "";

  const username = safeUsername(r?.author_username);
  const date = ctimeToDate(r?.ctime);
  const variation = JunTechExporter.getVariation(r);

  const editedBadge = isEdited(r) ? `<span class="rev-tag">✏️ đã sửa</span>` : "";
  const videoBadge = (r?.videos?.length > 0) ? `<span class="rev-tag">🎥 video</span>` : "";

  const commentHtml = (r?.comment && r.comment.trim())
    ? `<div class="review-item__body">${highlightCommentHTML(r.comment, searchTerm)}</div>`
    : `<div class="review-item__body rev-empty">(không có nhận xét)</div>`;

  const imgs = Array.isArray(r?.images) ? r.images.slice(0, 5) : [];
  const imagesHtml = imgs.length === 0 ? "" : `
    <div class="review-item__images">
      ${imgs.map((h) => {
        // Shopee dùng hash; URL thumbnail down-vn.img.susercontent.com.
        const src = typeof h === "string" && /^https?:\/\//.test(h)
          ? h // TikTok đã trả full URL
          : `https://down-vn.img.susercontent.com/file/${encodeURIComponent(h)}`;
        return `<a href="${src}" target="_blank" rel="noopener noreferrer" class="rev-img-link">
          <img src="${src}" alt="" loading="lazy" />
        </a>`;
      }).join("")}
    </div>
  `;

  const variantHtml = (variation && variation !== "—")
    ? `<div class="review-item__variant">📋 ${escapeHtml(variation)}</div>`
    : "";

  return `
    <div class="review-item ${cardClass}">
      <div class="review-item__head">
        <span class="review-item__user">${escapeHtml(username)}</span>
        ${editedBadge}${videoBadge}
        <span class="review-item__star">${"★".repeat(star)}${"☆".repeat(5 - star)}</span>
        <span class="review-item__date">${date}</span>
      </div>
      ${commentHtml}
      ${variantHtml}
      ${imagesHtml}
    </div>
  `;
}

function renderStarChips() {
  const chips = [
    { val: "all", label: "Tất cả" },
    { val: "neg", label: "1-2★", cls: "chip-star-neg" },
    { val: "5", label: "5★" },
    { val: "4", label: "4★" },
    { val: "3", label: "3★" },
    { val: "2", label: "2★" },
    { val: "1", label: "1★" },
  ];
  return chips.map((c) =>
    `<button class="chip chip-star ${c.cls || ""} ${filterState.star === c.val ? "active" : ""}"
       data-star="${c.val}" type="button">${c.label}</button>`
  ).join("");
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">🤷</div>
      <div class="empty-state__msg">Không tìm thấy review phù hợp với bộ lọc.</div>
      <button class="btn btn--ghost" data-action="reset-filter" type="button">↺ Reset filter</button>
    </div>
  `;
}

function renderReviewsView() {
  if (!currentData) return;
  const all = currentData.reviews || [];
  const filtered = applyFilters(all, filterState);
  const visible = filtered.slice(0, filterState.displayLimit);
  const totalLabel = filtered.length !== all.length ? ` (tổng ${all.length})` : "";

  const html = `
    <div class="reviews-section">
      <div class="reviews-header">
        <h3 class="reviews-title">📝 Danh sách review</h3>
        <button class="btn-icon-close" data-action="close-reviews" type="button" aria-label="Đóng">✕</button>
      </div>

      <div class="filter-bar">
        <input type="text" class="filter-search" id="filterSearch"
               placeholder="🔍 Tìm từ khóa (size, ship, fake...)"
               value="${escapeHtml(filterState.search)}" />

        <div class="filter-chips">
          ${renderStarChips()}
        </div>

        <div class="filter-chips">
          <button class="chip chip-toggle ${filterState.hasMedia ? "active" : ""}"
                  data-toggle="hasMedia" type="button">📷 Có ảnh/video</button>
          <button class="chip chip-toggle ${filterState.hasComment ? "active" : ""}"
                  data-toggle="hasComment" type="button">💬 Có nhận xét</button>
          <button class="chip chip-toggle ${filterState.recent ? "active" : ""}"
                  data-toggle="recent" type="button">🆕 30 ngày</button>
        </div>

        <select class="filter-sort" id="filterSort">
          <option value="trust"   ${filterState.sort === "trust"   ? "selected" : ""}>Sắp xếp: Độ tin cậy</option>
          <option value="newest"  ${filterState.sort === "newest"  ? "selected" : ""}>Sắp xếp: Mới nhất</option>
          <option value="oldest"  ${filterState.sort === "oldest"  ? "selected" : ""}>Sắp xếp: Cũ nhất</option>
          <option value="lowest"  ${filterState.sort === "lowest"  ? "selected" : ""}>Sắp xếp: Sao thấp nhất</option>
          <option value="highest" ${filterState.sort === "highest" ? "selected" : ""}>Sắp xếp: Sao cao nhất</option>
          <option value="longest" ${filterState.sort === "longest" ? "selected" : ""}>Sắp xếp: Comment dài nhất</option>
        </select>
      </div>

      <div class="filter-counter">
        <span>Hiển thị <strong id="counterVisible">${visible.length}</strong> / <span id="counterFiltered">${filtered.length}</span> review${totalLabel}</span>
        <button class="link-btn" data-action="reset-filter" type="button">↺ Reset filter</button>
      </div>

      <div class="reviews-list-inner" id="reviewsListInner">
        ${visible.length === 0 ? renderEmptyState() : visible.map((r) => renderReviewItem(r, filterState.search)).join("")}
      </div>

      <button class="btn btn--ghost btn-show-more ${filtered.length > visible.length ? "" : "hidden"}"
              id="showMoreBtn" data-action="show-more" type="button">
        Xem thêm ${Math.min(PAGE_INCREMENT, Math.max(0, filtered.length - visible.length))} review
      </button>
    </div>
  `;
  showResult(html);
}

function renderReviewsListOnly(opts = { scrollTop: true }) {
  if (!currentData) return;
  const all = currentData.reviews || [];
  const filtered = applyFilters(all, filterState);
  const visible = filtered.slice(0, filterState.displayLimit);

  const listEl = $("reviewsListInner");
  if (listEl) {
    listEl.innerHTML = visible.length === 0
      ? renderEmptyState()
      : visible.map((r) => renderReviewItem(r, filterState.search)).join("");
    if (opts.scrollTop) listEl.scrollTop = 0;
  }

  const cv = $("counterVisible"); if (cv) cv.textContent = String(visible.length);
  const cf = $("counterFiltered"); if (cf) cf.textContent = String(filtered.length);

  const sm = $("showMoreBtn");
  if (sm) {
    const remaining = filtered.length - visible.length;
    if (remaining > 0) {
      sm.textContent = `Xem thêm ${Math.min(PAGE_INCREMENT, remaining)} review`;
      sm.classList.remove("hidden");
    } else {
      sm.classList.add("hidden");
    }
  }
}

function appendMoreReviews() {
  if (!currentData) return;
  const all = currentData.reviews || [];
  const filtered = applyFilters(all, filterState);
  const start = filterState.displayLimit - PAGE_INCREMENT;
  const newSlice = filtered.slice(start, filterState.displayLimit);
  const listEl = $("reviewsListInner");
  if (listEl && newSlice.length > 0) {
    listEl.insertAdjacentHTML(
      "beforeend",
      newSlice.map((r) => renderReviewItem(r, filterState.search)).join("")
    );
  }
  const visibleCount = Math.min(filterState.displayLimit, filtered.length);
  const cv = $("counterVisible"); if (cv) cv.textContent = String(visibleCount);
  const sm = $("showMoreBtn");
  if (sm) {
    const remaining = filtered.length - visibleCount;
    if (remaining > 0) {
      sm.textContent = `Xem thêm ${Math.min(PAGE_INCREMENT, remaining)} review`;
    } else {
      sm.classList.add("hidden");
    }
  }
}

function syncFilterUI() {
  document.querySelectorAll("[data-star]").forEach((el) => {
    el.classList.toggle("active", el.dataset.star === filterState.star);
  });
  document.querySelectorAll("[data-toggle]").forEach((el) => {
    el.classList.toggle("active", !!filterState[el.dataset.toggle]);
  });
  const search = $("filterSearch");
  if (search) search.value = filterState.search;
  const sort = $("filterSort");
  if (sort) sort.value = filterState.sort;
}

function openReviewsSection(mode) {
  filterState = { ...DEFAULT_FILTER_STATE };
  if (mode === "negative") filterState.star = "neg";
  renderReviewsView();
}

/* ============================================================
   5. EXPORT EXCEL
   ============================================================ */

async function handleExportExcel() {
  if (!currentData) return;
  const btns = document.querySelectorAll('[data-action="export-excel"]');
  btns.forEach((b) => (b.disabled = true));
  showToast("Đang tạo file Excel...", "info");
  try {
    const filename = JunTechExporter.exportToExcel(currentData);
    showToast(`✅ Đã xuất ${filename}`, "success");
  } catch (err) {
    console.error("[JunTech Review] export Excel failed:", err);
    showError("Không thể xuất file: " + err.message);
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

/* ============================================================
   6. EVENT HANDLERS
   ============================================================ */

// State tạm cho retry sau khi user bấm "Mở tab tự động".
let pendingOpenTab = null; // { Adapter, ids, productUrl, maxReviews }

async function handleAnalyzeClick() {
  hideError(); hideResult();
  currentData = null;
  filterState = { ...DEFAULT_FILTER_STATE };

  const url = ($("urlInput")?.value || "").trim();
  const maxReviews = Number($("maxReviews")?.value || 300);

  if (!url) return showError("Vui lòng dán URL");

  // CHỌN ADAPTER theo URL
  let Adapter = adapterRegistry.findByUrl(url);
  if (!Adapter) {
    return showError("URL không thuộc sàn được hỗ trợ.");
  }
  let ids = Adapter.parseUrl(url);
  if (!ids) {
    return showError("URL không hợp lệ. Vui lòng kiểm tra lại link sản phẩm.");
  }

  const btn = $("btnAnalyze");
  if (btn) btn.disabled = true;

  // ---------- Xử lý link rút gọn vt.tiktok.com ----------
  if (ids.needsRedirect) {
    showLoading("🔗 Đang theo dõi link rút gọn...", 0);
    try {
      const finalUrl = await TikTokShopAdapter.resolveShortUrl(ids.shortUrl);
      if (!finalUrl) {
        if (btn) btn.disabled = false;
        hideLoading();
        return showError(
          "Link rút gọn không dẫn tới sản phẩm TikTok Shop hợp lệ. " +
          "Có thể là link video, profile hoặc sale event."
        );
      }
      // Re-parse với URL đầy đủ
      Adapter = adapterRegistry.findByUrl(finalUrl);
      if (!Adapter) {
        if (btn) btn.disabled = false;
        hideLoading();
        return showError("Link sau redirect không thuộc sàn được hỗ trợ.");
      }
      ids = Adapter.parseUrl(finalUrl);
      if (!ids || ids.needsRedirect) {
        if (btn) btn.disabled = false;
        hideLoading();
        return showError("Không parse được productId từ link rút gọn.");
      }
      // Cập nhật URL hiển thị + dùng cho currentData
      const inp = $("urlInput");
      if (inp) inp.value = finalUrl;
    } catch (err) {
      if (btn) btn.disabled = false;
      hideLoading();
      return showError("Không follow được link rút gọn: " + err.message);
    }
  }

  const platform = {
    id: Adapter.platformId,
    name: Adapter.platformName,
    icon: Adapter.platformIcon,
    color: Adapter.platformColor,
  };

  const loadingMsg = platform.id === "tiktokshop"
    ? `Đang quét trang ${platform.icon} ${platform.name}... (chậm hơn Shopee, vui lòng chờ)`
    : `Đang chuẩn bị (${platform.icon} ${platform.name})...`;
  showLoading(loadingMsg, 0);

  try {
    const adapter = new Adapter();
    const { reviews: rawReviews, productInfo } = await adapter.fetchReviews(ids, {
      maxReviews,
      onProgress: (loaded, total) => {
        const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
        showLoading(`Đang tải: ${loaded} / ${total} đánh giá`, pct);
      },
    });

    // Chuẩn hoá review qua adapter (mặc định identity).
    const reviews = (rawReviews || []).map((r) => Adapter.normalizeReview(r));

    if (reviews.length === 0) {
      showResult(`<div class="empty-good">Sản phẩm này chưa có đánh giá nào.</div>`);
      return;
    }

    showLoading("Đang phân tích...", 100);
    const { analyzeReviews, extractIssues, detectSeeding, getRecommendation } = JunTechAnalyzer;
    const stats = analyzeReviews(reviews);
    const issues = extractIssues(stats.negativeReviews);
    const seeding = detectSeeding(reviews, stats);
    const recommendation = getRecommendation(stats, issues, seeding);

    currentData = {
      url,
      productId: ids.productId || ids.itemid,
      platform,
      reviews, productInfo,
      stats, issues, seeding, recommendation,
    };
    console.log("[JunTech Review]", currentData);

    hideDetectionBadge();
    hidePlatformHint();
    renderMain();
  } catch (err) {
    console.error("[JunTech Review] failed:", err);

    // Xử lý case TikTok chưa có tab → modal "Mở tab tự động"
    if (err.code === "TIKTOK_NO_TAB") {
      pendingOpenTab = {
        Adapter, ids, productUrl: err.productUrl, maxReviews,
      };
      hideLoading();
      openOpenTabModal();
      // Không showError — modal đã hướng dẫn
    } else {
      showError(err.message || "Không thể phân tích.");
    }
  } finally {
    if (btn) btn.disabled = false;
    if (!pendingOpenTab) hideLoading();
  }
}

/* ----- "Mở tab TikTok Shop" modal flow ----- */

function openOpenTabModal() {
  $("openTabModal")?.classList.remove("hidden");
}
function closeOpenTabModal() {
  $("openTabModal")?.classList.add("hidden");
  pendingOpenTab = null;
}

async function handleOpenTabConfirm() {
  if (!pendingOpenTab) return closeOpenTabModal();
  const { Adapter, ids, productUrl, maxReviews } = pendingOpenTab;
  closeOpenTabModal();

  const btn = $("btnAnalyze");
  if (btn) btn.disabled = true;
  showLoading("📂 Đang mở tab TikTok Shop + chờ trang load...", 0);

  try {
    // Mở tab nền + đợi load xong
    await TikTokShopAdapter.openProductTab(ids.productId, productUrl);
    // Sau khi tab sẵn sàng, retry fetch
    showLoading("Đang quét review...", 5);
    const adapter = new Adapter();
    const { reviews: rawReviews, productInfo } = await adapter.fetchReviews(ids, {
      maxReviews,
      onProgress: (loaded, total) => {
        const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
        showLoading(`Đang tải: ${loaded} / ${total} đánh giá`, pct);
      },
    });

    const reviews = (rawReviews || []).map((r) => Adapter.normalizeReview(r));
    if (reviews.length === 0) {
      showResult(`<div class="empty-good">Sản phẩm này chưa có đánh giá nào.</div>`);
      return;
    }

    showLoading("Đang phân tích...", 100);
    const { analyzeReviews, extractIssues, detectSeeding, getRecommendation } = JunTechAnalyzer;
    const stats = analyzeReviews(reviews);
    const issues = extractIssues(stats.negativeReviews);
    const seeding = detectSeeding(reviews, stats);
    const recommendation = getRecommendation(stats, issues, seeding);

    const platform = {
      id: Adapter.platformId,
      name: Adapter.platformName,
      icon: Adapter.platformIcon,
      color: Adapter.platformColor,
    };
    currentData = {
      url: productUrl,
      productId: ids.productId,
      platform,
      reviews, productInfo,
      stats, issues, seeding, recommendation,
    };
    hideDetectionBadge();
    hidePlatformHint();
    renderMain();
  } catch (err) {
    console.error("[JunTech Review] open-tab retry failed:", err);
    showError(err.message || "Không thể phân tích sau khi mở tab.");
  } finally {
    if (btn) btn.disabled = false;
    hideLoading();
  }
}

function handleResultClick(e) {
  if (!currentData) return;

  const starChip = e.target.closest("[data-star]");
  if (starChip) {
    if (filterState.star !== starChip.dataset.star) {
      filterState.star = starChip.dataset.star;
      filterState.displayLimit = PAGE_INCREMENT;
      document.querySelectorAll("[data-star]").forEach((el) => {
        el.classList.toggle("active", el === starChip);
      });
      renderReviewsListOnly();
    }
    return;
  }

  const toggleChip = e.target.closest("[data-toggle]");
  if (toggleChip) {
    const key = toggleChip.dataset.toggle;
    filterState[key] = !filterState[key];
    filterState.displayLimit = PAGE_INCREMENT;
    toggleChip.classList.toggle("active", filterState[key]);
    renderReviewsListOnly();
    return;
  }

  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "view-negative") {
    openReviewsSection("negative");
  } else if (action === "view-all") {
    openReviewsSection("all");
  } else if (action === "export-excel") {
    handleExportExcel();
  } else if (action === "show-more") {
    filterState.displayLimit += PAGE_INCREMENT;
    appendMoreReviews();
  } else if (action === "reset-filter") {
    filterState = { ...DEFAULT_FILTER_STATE };
    syncFilterUI();
    renderReviewsListOnly();
  } else if (action === "close-reviews" || action === "back") {
    renderMain();
  } else if (action === "reanalyze") {
    currentData = null;
    filterState = { ...DEFAULT_FILTER_STATE };
    hideResult(); hideError();
    const inp = $("urlInput");
    if (inp) { inp.value = ""; inp.focus(); }
    tryAutoFillFromCurrentTab(false);
  }
}

function handleResultInput(e) {
  if (e.target.id !== "filterSearch") return;
  const value = e.target.value;
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    filterState.search = value;
    filterState.displayLimit = PAGE_INCREMENT;
    renderReviewsListOnly();
  }, 300);
}

function handleResultChange(e) {
  if (e.target.id !== "filterSort") return;
  filterState.sort = e.target.value;
  filterState.displayLimit = PAGE_INCREMENT;
  renderReviewsListOnly();
}

/* ============================================================
   7. DONATE MODULE
   ============================================================ */

function buildVietQrUrl() {
  const cfg = DONATE_CONFIG;
  const addInfo = encodeURIComponent("Donate JunTech");
  return `https://img.vietqr.io/image/${encodeURIComponent(cfg.BANK_CODE)}-${encodeURIComponent(cfg.ACCOUNT_NUMBER)}-compact2.png?amount=&addInfo=${addInfo}&accountName=${encodeURIComponent(cfg.ACCOUNT_NAME)}`;
}

function openDonateModal() {
  const modal = $("donateModal");
  if (!modal) return;

  const img = $("vietqrImg");
  if (img) img.src = buildVietQrUrl();
  $("bankName").textContent = DONATE_CONFIG.BANK_NAME;
  $("bankAccount").textContent = DONATE_CONFIG.ACCOUNT_NUMBER;
  $("bankOwner").textContent = DONATE_CONFIG.ACCOUNT_NAME;

  const hasBmc = !!(DONATE_CONFIG.BMC_USERNAME && DONATE_CONFIG.BMC_USERNAME.trim());
  const intlTab = document.querySelector('.donate-tab[data-tab="international"]');
  const intlContent = $("tab-international");
  if (intlTab) intlTab.classList.toggle("hidden", !hasBmc);
  if (intlContent) intlContent.classList.toggle("hidden", !hasBmc);
  if (hasBmc) {
    $("bmcLink").href = `https://buymeacoffee.com/${encodeURIComponent(DONATE_CONFIG.BMC_USERNAME.trim())}`;
  }
  switchDonateTab("vietnam");

  modal.classList.remove("hidden");

  try {
    chrome.storage?.local?.get(["donate_opens"], (result) => {
      const count = (result?.donate_opens || 0) + 1;
      chrome.storage.local.set({ donate_opens: count });
    });
  } catch { /* */ }
}

function closeDonateModal() {
  $("donateModal")?.classList.add("hidden");
}

function switchDonateTab(tabName) {
  document.querySelectorAll(".donate-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  document.querySelectorAll(".donate-tab-content").forEach((c) => {
    c.classList.toggle("active", c.id === `tab-${tabName}`);
  });
}

async function copyAccountNumber() {
  try {
    await navigator.clipboard.writeText(DONATE_CONFIG.ACCOUNT_NUMBER);
    showToast("✅ Đã copy số tài khoản!", "success");
  } catch {
    showToast("❌ Không thể copy. Hãy copy thủ công.", "error");
  }
}

/* ============================================================
   8. INIT
   ============================================================ */

function init() {
  // Phân tích
  $("btnAnalyze")?.addEventListener("click", handleAnalyzeClick);
  $("resultContent")?.addEventListener("click", handleResultClick);
  $("resultContent")?.addEventListener("input", handleResultInput);
  $("resultContent")?.addEventListener("change", handleResultChange);

  // Auto-detect URL từ tab hiện tại (qua adapter registry).
  tryAutoFillFromCurrentTab(false);

  $("useCurrentTabBtn")?.addEventListener("click", async () => {
    const btn = $("useCurrentTabBtn");
    if (!btn) return;
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = "⏳ Đang lấy...";
    try {
      await tryAutoFillFromCurrentTab(true);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });

  $("urlInput")?.addEventListener("input", () => {
    hideDetectionBadge();
    hidePlatformHint();
  });

  // "Mở tab TikTok Shop" modal
  $("openTabConfirmBtn")?.addEventListener("click", handleOpenTabConfirm);
  $("openTabCancelBtn")?.addEventListener("click", closeOpenTabModal);
  $("closeOpenTabBtn")?.addEventListener("click", closeOpenTabModal);
  $("openTabModal")?.addEventListener("click", (e) => {
    if (e.target.id === "openTabModal") closeOpenTabModal();
  });

  // Donate modal
  $("donateBtn")?.addEventListener("click", openDonateModal);
  $("closeDonateBtn")?.addEventListener("click", closeDonateModal);
  $("donateModal")?.addEventListener("click", (e) => {
    if (e.target.id === "donateModal") closeDonateModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("donateModal")?.classList.contains("hidden")) {
      closeDonateModal();
    }
  });
  document.querySelectorAll(".donate-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchDonateTab(tab.dataset.tab));
  });
  $("copyAccountBtn")?.addEventListener("click", copyAccountNumber);
}

document.addEventListener("DOMContentLoaded", init);
