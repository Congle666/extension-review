/* ============================================================
   ShopeeAdapter — phân tích sản phẩm Shopee.
   Cơ chế: inject fetch function vào tab shopee.vn của user qua
   chrome.scripting.executeScript → fetch chạy trong context tab
   với cookie + Referer thật → Shopee chấp nhận.
   ============================================================ */

(function () {
  const PAGE_SIZE = 50;
  const DELAY_MS = 300;
  const REQUEST_TIMEOUT_MS = 30000;

  const RE_I_FORMAT = /-i\.(\d+)\.(\d+)(?:[/?#]|$)/;
  const RE_PRODUCT_FORMAT = /\/product\/(\d+)\/(\d+)(?:[/?#]|$)/;
  const HOST_RE = /(?:^|\/\/|\.)shopee\.(?:vn|com)(?:\/|$|:)/i;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // -- Hàm chạy trong tab Shopee (MAIN world). Self-contained vì sẽ
  // -- bị serialize qua executeScript args.
  async function fetchInPage(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(url, {
        credentials: "include",
        headers: { "X-API-SOURCE": "pc" },
        signal: controller.signal,
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch { /* */ }
      return { status: res.status, ok: res.ok, data, raw: data ? null : text.slice(0, 200) };
    } catch (err) {
      return { status: 0, ok: false, error: err.name === "AbortError" ? "TIMEOUT" : err.message };
    } finally {
      clearTimeout(timer);
    }
  }

  async function findShopeeTab() {
    const tabs = await chrome.tabs.query({
      url: ["https://shopee.vn/*", "https://shopee.com/*"],
    });
    if (tabs.length === 0) return null;
    return tabs.find((t) => t.active) || tabs[0];
  }

  async function fetchUrlInTab(tabId, url) {
    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId }, func: fetchInPage, args: [url], world: "MAIN",
      });
    } catch (err) {
      throw new Error(`Không inject được vào tab Shopee: ${err.message}`);
    }
    if (!results?.[0]) throw new Error("Tab Shopee không trả kết quả.");
    const r = results[0].result;
    if (!r) throw new Error("Kết quả rỗng từ tab Shopee.");
    if (r.error === "TIMEOUT") throw new Error("Mạng chậm hoặc Shopee phản hồi quá lâu (>30s).");
    if (r.error) throw new Error(`Lỗi mạng trong tab: ${r.error}`);
    if (!r.ok) {
      if (r.status === 403) throw new Error("Shopee chặn (403). Hãy đảm bảo đã đăng nhập shopee.vn.");
      if (r.status === 404) throw new Error("Sản phẩm không tồn tại hoặc đã bị xoá (404).");
      if (r.status === 429) throw new Error("Bị Shopee giới hạn (429). Đợi vài phút rồi thử lại.");
      throw new Error(`HTTP ${r.status} từ Shopee.`);
    }
    if (!r.data) throw new Error(`Phản hồi không phải JSON. Preview: ${r.raw || "(rỗng)"}`);
    return r.data;
  }

  async function fetchProductInfoInTab(tabId, shopid, itemid) {
    const url = `https://shopee.vn/api/v4/item/get?itemid=${itemid}&shopid=${shopid}`;
    try {
      const data = await fetchUrlInTab(tabId, url);
      if (data?.error && data.error !== 0) return null;
      const item = data?.data;
      if (!item) return null;
      return {
        name: item.name || "",
        image: item.image ? `https://cf.shopee.vn/file/${item.image}` : null,
        price: typeof item.price === "number" ? item.price / 100000 : null,
      };
    } catch (err) {
      console.warn("[ShopeeAdapter] productInfo fail:", err.message);
      return null;
    }
  }

  async function fetchAllReviewsInTab(tabId, shopid, itemid, maxReviews, onProgress) {
    const base = "https://shopee.vn/api/v2/item/get_ratings";
    const reviews = [];
    let offset = 0;
    let estimatedTotal = maxReviews;
    const productPromise = fetchProductInfoInTab(tabId, shopid, itemid);

    while (reviews.length < maxReviews) {
      const params = new URLSearchParams({
        itemid: String(itemid), shopid: String(shopid),
        limit: String(PAGE_SIZE), offset: String(offset),
        type: "0", filter: "0", flag: "1",
      });
      const data = await fetchUrlInTab(tabId, `${base}?${params}`);
      if (data?.error && data.error !== 0) {
        throw new Error(`Shopee từ chối: ${data.error_msg || "error=" + data.error}.`);
      }
      const page = data?.data?.ratings;
      if (!Array.isArray(page) || page.length === 0) break;

      const ratingTotal = data?.data?.item_rating_summary?.rating_total;
      if (typeof ratingTotal === "number" && ratingTotal > 0) {
        estimatedTotal = Math.min(maxReviews, ratingTotal);
      }
      const remaining = maxReviews - reviews.length;
      reviews.push(...page.slice(0, remaining));
      onProgress?.(reviews.length, Math.max(estimatedTotal, reviews.length));

      if (page.length < PAGE_SIZE || reviews.length >= maxReviews) break;
      offset += PAGE_SIZE;
      await sleep(DELAY_MS);
    }
    return { reviews, productInfo: await productPromise };
  }

  /* ========================================================== */

  class ShopeeAdapter extends BaseAdapter {
    static platformId = "shopee";
    static platformName = "Shopee";
    static platformIcon = "🛒";
    static platformColor = "#ee4d2d";
    static supportedDomains = ["shopee.vn", "shopee.com"];

    /** Trả true chỉ khi parse được product URL Shopee. */
    static canHandle(url) {
      return ShopeeAdapter.parseUrl(url) !== null;
    }

    /** Parse URL → { shopid, itemid, productId, raw } | null */
    static parseUrl(url) {
      if (typeof url !== "string") return null;
      const trimmed = url.trim();
      if (!trimmed || !HOST_RE.test(trimmed)) return null;

      const m = trimmed.match(RE_I_FORMAT) || trimmed.match(RE_PRODUCT_FORMAT);
      if (!m) return null;
      const shopid = Number(m[1]);
      const itemid = Number(m[2]);
      if (!Number.isFinite(shopid) || shopid <= 0) return null;
      if (!Number.isFinite(itemid) || itemid <= 0) return null;
      return { shopid, itemid, productId: itemid, raw: trimmed };
    }

    /** Field Shopee đã đúng chuẩn — trả raw. */
    static normalizeReview(raw) {
      return raw;
    }

    /** Fetch toàn bộ review qua executeScript loop. */
    async fetchReviews(ids, options = {}) {
      const { maxReviews = 300, onProgress } = options;
      const tab = await findShopeeTab();
      if (!tab) {
        throw new Error("Vui lòng mở một tab shopee.vn (đã đăng nhập) rồi thử lại.");
      }
      return await fetchAllReviewsInTab(
        tab.id, ids.shopid, ids.itemid, maxReviews, onProgress
      );
    }
  }

  // Đăng ký
  window.ShopeeAdapter = ShopeeAdapter;
  adapterRegistry.register(ShopeeAdapter);
})();
