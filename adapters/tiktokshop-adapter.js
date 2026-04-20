/* ============================================================
   TikTokShopAdapter — phân tích sản phẩm TikTok Shop.
   Khác Shopee: KHÔNG gọi API trực tiếp (X-Bogus signature).
   Cơ chế: gửi message tới content script đã inject vào tab
   shop.tiktok.com — content script scrape DOM + auto-scroll.

   Phase 1: chỉ DOM scrape (~100-300 review render sẵn).
   Phase 2 (tương lai): có thể nâng cấp gọi API trực tiếp nếu
   reverse-engineer được X-Bogus.
   ============================================================ */

(function () {
  // URL patterns:
  //   https://shop.tiktok.com/view/product/{productId}
  //   https://www.tiktok.com/shop/pdp/{productId}
  //   https://vt.tiktok.com/{shortcode}            (rút gọn)
  const RE_VIEW_PRODUCT = /shop\.tiktok\.com\/view\/product\/(\d+)/i;
  const RE_PDP = /www\.tiktok\.com\/shop\/pdp\/(\d+)/i;
  const RE_VT_SHORT = /^https?:\/\/vt\.tiktok\.com\/[A-Za-z0-9]+/i;
  const HOST_RE = /^https?:\/\/(?:shop\.tiktok\.com|www\.tiktok\.com\/shop|vt\.tiktok\.com)/i;

  /** Tìm tab có URL match productId. */
  async function findProductTab(productId) {
    try {
      const tabs = await chrome.tabs.query({
        url: [
          "https://shop.tiktok.com/view/product/*",
          "https://www.tiktok.com/shop/pdp/*",
        ],
      });
      // Prefer tab có productId trong URL
      const match = tabs.find((t) => t.url && t.url.includes(productId));
      return match || tabs.find((t) => t.active) || tabs[0] || null;
    } catch (err) {
      console.error("[TikTokShopAdapter] tabs.query lỗi:", err);
      return null;
    }
  }

  /** Inject content script on-demand nếu chưa có (tab cũ chưa load script). */
  async function ensureContentScript(tabId) {
    try {
      // Thử PING trước
      const pong = await new Promise((resolve) => {
        try {
          chrome.tabs.sendMessage(tabId, { action: "PING" }, (resp) => {
            // chrome.runtime.lastError nếu không có listener
            if (chrome.runtime.lastError) resolve(null);
            else resolve(resp);
          });
        } catch { resolve(null); }
      });
      if (pong?.pong) return true;
    } catch { /* */ }

    // Inject thủ công
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/tiktokshop-content.js"],
      });
      return true;
    } catch (err) {
      console.warn("[TikTokShopAdapter] inject content script fail:", err.message);
      return false;
    }
  }

  /* ========================================================== */

  class TikTokShopAdapter extends BaseAdapter {
    static platformId = "tiktokshop";
    static platformName = "TikTok Shop";
    static platformIcon = "🎵";
    static platformColor = "#FE2C55";
    static supportedDomains = [
      "shop.tiktok.com",
      "www.tiktok.com",
      "vt.tiktok.com",
    ];

    static canHandle(url) {
      if (typeof url !== "string") return false;
      const trimmed = url.trim();
      if (!HOST_RE.test(trimmed)) return false;
      // Match nếu là 1 trong 3 pattern (kể cả vt rút gọn — popup sẽ resolve sau)
      return (
        RE_VIEW_PRODUCT.test(trimmed) ||
        RE_PDP.test(trimmed) ||
        RE_VT_SHORT.test(trimmed)
      );
    }

    /**
     * Trả:
     * - { needsRedirect: true, shortUrl } nếu link rút gọn vt.tiktok.com
     * - { productId, raw } nếu link đầy đủ
     * - null nếu không hợp lệ
     */
    static parseUrl(url) {
      if (typeof url !== "string") return null;
      const trimmed = url.trim();
      if (!trimmed) return null;

      // Link rút gọn → cần follow redirect
      if (RE_VT_SHORT.test(trimmed)) {
        return { needsRedirect: true, shortUrl: trimmed, raw: trimmed };
      }

      const m = trimmed.match(RE_VIEW_PRODUCT) || trimmed.match(RE_PDP);
      if (!m) return null;
      const productId = m[1];
      if (!/^\d+$/.test(productId)) return null;

      return {
        productId,
        shopId: null, // TikTok Shop URL không chứa shopId
        raw: trimmed,
      };
    }

    /**
     * Field từ content script đã chuẩn hoá sẵn (giống Shopee).
     * Chỉ trả raw, không transform thêm.
     */
    static normalizeReview(raw) {
      return raw;
    }

    /**
     * Fetch reviews qua content script trong tab TikTok Shop.
     * Throw nếu không có tab hợp lệ — popup sẽ catch + show modal "Mở tab tự động".
     */
    async fetchReviews(ids, options = {}) {
      const { maxReviews = 300, onProgress } = options;

      if (!ids?.productId) {
        throw new Error("Thiếu productId TikTok Shop.");
      }

      // 1. Tìm tab
      const tab = await findProductTab(ids.productId);
      if (!tab) {
        const err = new Error(
          "TIKTOK_NO_TAB:Vui lòng mở trang sản phẩm TikTok Shop trong tab khác trước, " +
          "sau đó quay lại và bấm Phân tích."
        );
        err.code = "TIKTOK_NO_TAB";
        err.productUrl = ids.raw;
        throw err;
      }

      // 2. Đảm bảo content script đã load
      const ready = await ensureContentScript(tab.id);
      if (!ready) {
        throw new Error(
          "Không inject được script vào tab TikTok Shop. Hãy refresh tab đó rồi thử lại."
        );
      }

      // 3. Lắng nghe progress messages từ content script.
      const progressListener = (msg) => {
        const action = msg?.action || msg?.type;
        if (action === "PROGRESS" && typeof onProgress === "function") {
          onProgress(msg.loaded, msg.total);
        }
      };
      chrome.runtime.onMessage.addListener(progressListener);

      try {
        // 4. Gửi request fetch (content script sẽ scroll + parse)
        const response = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(
            tab.id,
            { action: "FETCH_REVIEWS", maxReviews, productId: ids.productId },
            (resp) => {
              if (chrome.runtime.lastError) {
                reject(new Error(
                  "Mất kết nối với tab TikTok Shop: " + chrome.runtime.lastError.message
                ));
                return;
              }
              if (!resp) {
                reject(new Error("Tab TikTok Shop không phản hồi."));
                return;
              }
              if (resp.ok) resolve(resp.data);
              else reject(new Error(resp.error || "Lỗi không xác định từ content script."));
            }
          );
        });

        // response = { reviews: [...], productInfo: {...} }
        return response;
      } finally {
        chrome.runtime.onMessage.removeListener(progressListener);
      }
    }
  }

  // Helper static để popup gọi khi cần mở tab tự động.
  TikTokShopAdapter.openProductTab = async function (productId, fromUrl) {
    const url = fromUrl || `https://shop.tiktok.com/view/product/${productId}`;
    const tab = await chrome.tabs.create({ url, active: false });
    // Đợi tab load xong
    await new Promise((resolve) => {
      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      // Timeout 30s
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 30000);
    });
    // Đợi thêm 3s cho content script + render
    await new Promise((r) => setTimeout(r, 3000));
    return tab;
  };

  // Helper resolve link rút gọn vt.tiktok.com → URL đầy đủ.
  TikTokShopAdapter.resolveShortUrl = async function (shortUrl) {
    // Dùng fetch với redirect: follow để theo dõi
    try {
      const res = await fetch(shortUrl, {
        method: "GET",
        redirect: "follow",
        credentials: "omit",
      });
      const finalUrl = res.url || "";
      // Check final URL có phải product page không
      if (TikTokShopAdapter.canHandle(finalUrl) && !RE_VT_SHORT.test(finalUrl)) {
        return finalUrl;
      }
      return null;
    } catch (err) {
      console.warn("[TikTokShopAdapter] resolveShortUrl fail:", err.message);
      return null;
    }
  };

  window.TikTokShopAdapter = TikTokShopAdapter;
  adapterRegistry.register(TikTokShopAdapter);
})();
