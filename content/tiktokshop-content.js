/* ============================================================
   TikTok Shop Content Script
   ----------------------------------------------------------
   Chạy trong tab shop.tiktok.com / tiktok.com/shop/pdp.
   Vai trò:
   - Listen message từ popup (PING/FETCH_REVIEWS/FETCH_PRODUCT_INFO)
   - Scrape DOM (TikTok không cho gọi API trực tiếp do X-Bogus signature)
   - Auto-scroll để load thêm review (~100-300 review render sẵn)
   - Parse relative time tiếng Việt → unix timestamp

   ⚠️ TikTok Shop ĐỔI SELECTOR THƯỜNG XUYÊN (1-2 tháng).
      Code dùng nhiều fallback (data-e2e, aria-label, text matching)
      để giảm vỡ. Khi fail → cần update SELECTORS map.
   ============================================================ */

(function () {
  // Tránh inject 2 lần (manifest content_scripts + executeScript fallback)
  if (window.__juntechTikTokInjected) {
    console.log("[JunTech-TT] Đã inject trước đó, skip.");
    return;
  }
  window.__juntechTikTokInjected = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ========================================================== */
  /* SELECTOR MAP — cần update khi TikTok đổi UI                 */
  /* ========================================================== */
  const SELECTORS = {
    // Captcha / login wall
    captcha: [
      '[data-e2e="captcha"]',
      '[id*="captcha"]',
      '.captcha-disable-btn',
      '#captcha_container',
    ],
    loginWall: [
      '[data-e2e="login-modal"]',
      '[class*="login-required"]',
    ],
    notFound: [
      '[data-e2e="error-page"]',
      '[class*="404"]',
    ],

    // Product info
    productName: [
      '[data-e2e="product-title"]',
      'h1[class*="ProductTitle"]',
      'h1[class*="title"]',
      'h1',
    ],
    productPrice: [
      '[data-e2e="product-price"]',
      '[class*="ProductPrice"]',
      '[class*="price"][class*="current"]',
    ],
    productImage: [
      '[data-e2e="product-image"] img',
      '[class*="ProductImage"] img',
      'img[alt*="product" i]',
    ],
    shopName: [
      '[data-e2e="shop-name"]',
      '[class*="ShopName"]',
      'a[href*="/shop/"][class*="name" i]',
    ],
    ratingTotal: [
      '[data-e2e="review-count"]',
      '[class*="reviewCount"]',
      '[class*="review-total"]',
    ],
    ratingAvg: [
      '[data-e2e="rating-score"]',
      '[class*="ratingScore"]',
      '[class*="rating-average"]',
    ],

    // Review section
    reviewContainer: [
      '[data-e2e="review-list"]',
      '[class*="ReviewList"]',
      '[class*="review-list"]',
      '[class*="comment-list"]',
    ],
    reviewItem: [
      '[data-e2e="review-item"]',
      '[class*="ReviewItem"]',
      '[class*="review-item"]',
      '[class*="comment-item"]',
    ],

    // Inside 1 review item
    reviewUser: [
      '[data-e2e="review-username"]',
      '[class*="username"]',
      '[class*="UserName"]',
    ],
    reviewStars: [
      '[data-e2e="review-rating"] svg',
      '[class*="Rating"] svg',
      '[class*="star"][data-filled="true"]',
    ],
    reviewStarsAll: [
      '[data-e2e="review-rating"] svg',
      '[class*="Rating"] svg',
    ],
    reviewComment: [
      '[data-e2e="review-content"]',
      '[class*="ReviewContent"]',
      '[class*="comment-text"]',
    ],
    reviewImages: [
      '[data-e2e="review-image"] img',
      '[class*="ReviewImage"] img',
      '[class*="review-pic"] img',
    ],
    reviewVideos: [
      '[data-e2e="review-video"] video',
      '[class*="ReviewVideo"] video',
    ],
    reviewTime: [
      '[data-e2e="review-time"]',
      '[class*="reviewTime"]',
      '[class*="time"]',
    ],
    reviewVariant: [
      '[data-e2e="review-spec"]',
      '[class*="review-spec"]',
      '[class*="ReviewSpec"]',
    ],
    reviewEdited: [
      '[data-e2e="review-edited"]',
      '[class*="edited"]',
    ],
  };

  // Tìm element đầu tiên match một trong các selector. null nếu không có.
  function querySelectorAny(root, selectors) {
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch { /* selector không hợp lệ — skip */ }
    }
    return null;
  }
  function querySelectorAllAny(root, selectors) {
    for (const sel of selectors) {
      try {
        const els = root.querySelectorAll(sel);
        if (els.length > 0) return Array.from(els);
      } catch { /* */ }
    }
    return [];
  }

  /* ========================================================== */
  /* PARSE RELATIVE TIME (tiếng Việt → unix seconds)             */
  /* ========================================================== */

  function parseRelativeTime(text) {
    if (!text || typeof text !== "string") return Math.floor(Date.now() / 1000);
    const t = text.trim().toLowerCase();
    const now = Math.floor(Date.now() / 1000);

    if (/vừa\s*xong|vừa\s*mới|just\s*now/i.test(t)) return now;

    // "X đơn vị trước" — bắt số + đơn vị
    const m = t.match(/(\d+)\s*(phút|gi[ờo]|ngày|tuần|tháng|năm|min|hour|day|week|month|year)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      const map = {
        "phút": 60, "min": 60,
        "giờ": 3600, "gio": 3600, "hour": 3600,
        "ngày": 86400, "day": 86400,
        "tuần": 604800, "week": 604800,
        "tháng": 2592000, "month": 2592000,
        "năm": 31536000, "year": 31536000,
      };
      const sec = map[unit];
      if (sec) return now - n * sec;
    }

    // dd/mm/yyyy hoặc dd-mm-yyyy
    const dm = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dm) {
      const day = parseInt(dm[1], 10);
      const month = parseInt(dm[2], 10) - 1;
      let year = parseInt(dm[3], 10);
      if (year < 100) year += 2000;
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);
    }

    return now; // fallback
  }

  /* ========================================================== */
  /* DETECT TRẠNG THÁI TRANG                                     */
  /* ========================================================== */

  function detectPageState() {
    if (querySelectorAny(document, SELECTORS.captcha)) return "CAPTCHA";
    if (querySelectorAny(document, SELECTORS.loginWall)) return "LOGIN_REQUIRED";
    if (querySelectorAny(document, SELECTORS.notFound)) return "NOT_FOUND";
    return "OK";
  }

  /* ========================================================== */
  /* SCRAPE PRODUCT INFO                                         */
  /* ========================================================== */

  function scrapeProductInfo() {
    try {
      const nameEl = querySelectorAny(document, SELECTORS.productName);
      const priceEl = querySelectorAny(document, SELECTORS.productPrice);
      const imgEl = querySelectorAny(document, SELECTORS.productImage);
      const shopEl = querySelectorAny(document, SELECTORS.shopName);
      const totalEl = querySelectorAny(document, SELECTORS.ratingTotal);
      const avgEl = querySelectorAny(document, SELECTORS.ratingAvg);

      // Parse price text "₫12.000" hoặc "12.000₫" → number
      const parsePrice = (txt) => {
        if (!txt) return null;
        const digits = String(txt).replace(/[^\d]/g, "");
        const n = Number(digits);
        return Number.isFinite(n) && n > 0 ? n : null;
      };

      // Parse rating count "1.2k" → 1200, "532" → 532
      const parseCount = (txt) => {
        if (!txt) return null;
        const t = String(txt).trim().toLowerCase();
        const m = t.match(/([\d.,]+)\s*([km]?)/);
        if (!m) return null;
        let n = parseFloat(m[1].replace(/,/g, ""));
        if (!Number.isFinite(n)) return null;
        if (m[2] === "k") n *= 1000;
        if (m[2] === "m") n *= 1_000_000;
        return Math.round(n);
      };

      return {
        name: nameEl?.textContent?.trim() || "",
        image: imgEl?.src || imgEl?.getAttribute("data-src") || null,
        price: parsePrice(priceEl?.textContent),
        shop_name: shopEl?.textContent?.trim() || null,
        total_reviews: parseCount(totalEl?.textContent),
        avg_rating: parseFloat(avgEl?.textContent?.trim() || "0") || null,
      };
    } catch (err) {
      console.warn("[JunTech-TT] scrapeProductInfo lỗi:", err);
      return null;
    }
  }

  /* ========================================================== */
  /* SCRAPE REVIEWS với auto-scroll                              */
  /* ========================================================== */

  function getReviewElements() {
    return querySelectorAllAny(document, SELECTORS.reviewItem);
  }

  function getReviewContainer() {
    return querySelectorAny(document, SELECTORS.reviewContainer);
  }

  // Đếm số star fill trong 1 review element. Cách tiếp cận: đếm svg
  // có thuộc tính fill khác trắng, hoặc data-filled, hoặc class có "active"/"fill".
  function countFilledStars(reviewEl) {
    const allStars = querySelectorAllAny(reviewEl, SELECTORS.reviewStarsAll);
    if (allStars.length === 0) return 0;
    let filled = 0;
    for (const s of allStars) {
      const html = s.outerHTML.toLowerCase();
      // svg có fill non-white/non-transparent → coi là filled
      const fillAttr = s.getAttribute("fill") || "";
      const styleAttr = s.getAttribute("style") || "";
      const dataFilled = s.getAttribute("data-filled");
      if (
        dataFilled === "true" ||
        /class=["'][^"']*(active|filled|fill-yes|on)/i.test(html) ||
        (/[fF][fF]([cCdD])([0-9a-f])/.test(fillAttr)) || // vàng (#FFC..., #FFD...)
        /color\s*:\s*#?(ff|ffd|ffc|fbb)/i.test(styleAttr)
      ) {
        filled++;
      }
    }
    // Nếu fail toàn bộ logic detect filled, fallback: đếm tất cả svg = 5 sao
    if (filled === 0 && allStars.length === 5) filled = 5;
    return Math.max(0, Math.min(5, filled));
  }

  // Parse 1 review element → object raw chuẩn
  function parseReviewElement(el) {
    const userEl = querySelectorAny(el, SELECTORS.reviewUser);
    const commentEl = querySelectorAny(el, SELECTORS.reviewComment);
    const timeEl = querySelectorAny(el, SELECTORS.reviewTime);
    const variantEl = querySelectorAny(el, SELECTORS.reviewVariant);
    const editedEl = querySelectorAny(el, SELECTORS.reviewEdited);
    const imgs = querySelectorAllAny(el, SELECTORS.reviewImages);
    const vids = querySelectorAllAny(el, SELECTORS.reviewVideos);

    const star = countFilledStars(el);
    const username = userEl?.textContent?.trim() || "";
    const comment = commentEl?.textContent?.trim() || "";
    const timeText = timeEl?.textContent?.trim() || "";
    const variant = variantEl?.textContent?.trim() || "";

    const ctime = parseRelativeTime(timeText);
    const isEdited = !!editedEl || /đã chỉnh sửa|edited/i.test(el.textContent || "");

    return {
      // Field chuẩn (giống Shopee)
      author_username: username,
      rating_star: star,
      comment,
      images: imgs.map((i) => i.src || i.getAttribute("data-src")).filter(Boolean),
      videos: vids.map((v) => ({
        url: v.src || v.querySelector("source")?.src || null,
        thumbnail: v.poster || null,
      })).filter((v) => v.url),
      ctime,
      mtime: isEdited ? ctime + 120 : ctime, // mark edited bằng mtime > ctime
      tags: variant ? [{ tag_name: variant }] : [],
      // Field meta riêng TikTok
      _platform: "tiktokshop",
      _timeText: timeText,
    };
  }

  // Gửi progress về popup. Bọc try/catch vì popup có thể đã đóng.
  function sendProgress(loaded, total) {
    try {
      chrome.runtime.sendMessage({
        type: "PROGRESS",
        action: "PROGRESS",
        loaded,
        total,
      }).catch(() => {});
    } catch { /* */ }
  }

  // Auto-scroll container review để TikTok load thêm.
  // Dừng khi: đủ maxReviews, hoặc 5 lần scroll không ra review mới.
  async function scrapeReviews(maxReviews = 300) {
    const container = getReviewContainer();
    if (!container) {
      throw new Error("Không tìm thấy phần review trên trang. Có thể trang chưa load xong hoặc sản phẩm chưa có review.");
    }

    // Scroll smooth tới container review trước
    container.scrollIntoView({ behavior: "smooth", block: "start" });
    await sleep(800);

    let prevCount = getReviewElements().length;
    sendProgress(prevCount, maxReviews);

    let stagnantRounds = 0;
    const MAX_STAGNANT = 5;
    const MAX_SCROLL_ROUNDS = 200; // hard cap: 200 lần scroll = ~200s

    for (let i = 0; i < MAX_SCROLL_ROUNDS; i++) {
      if (prevCount >= maxReviews) break;

      // Scroll trong container nếu container cuộn được, ngược lại cuộn window
      const scrollableParent = findScrollableParent(container);
      if (scrollableParent) {
        scrollableParent.scrollTop += 700;
      } else {
        window.scrollBy({ top: 700, behavior: "instant" });
      }

      await sleep(1200);

      const currentCount = getReviewElements().length;
      sendProgress(currentCount, maxReviews);

      if (currentCount === prevCount) {
        stagnantRounds++;
        if (stagnantRounds >= MAX_STAGNANT) {
          console.log(`[JunTech-TT] Dừng scroll: ${currentCount} review, không tăng sau ${MAX_STAGNANT} lần thử.`);
          break;
        }
      } else {
        stagnantRounds = 0;
        prevCount = currentCount;
      }
    }

    // Parse tất cả
    const elements = getReviewElements().slice(0, maxReviews);
    const reviews = [];
    for (const el of elements) {
      try {
        const r = parseReviewElement(el);
        if (r.rating_star > 0 || r.comment) {
          reviews.push(r);
        }
      } catch (err) {
        console.warn("[JunTech-TT] parseReviewElement skip:", err.message);
      }
    }
    return reviews;
  }

  // Tìm parent scroll-able gần nhất.
  function findScrollableParent(el) {
    let p = el?.parentElement;
    while (p && p !== document.body) {
      const overflow = getComputedStyle(p).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && p.scrollHeight > p.clientHeight) {
        return p;
      }
      p = p.parentElement;
    }
    return null;
  }

  /* ========================================================== */
  /* MESSAGE HANDLER                                             */
  /* ========================================================== */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const action = msg?.action || msg?.type;
    if (!action) return false;

    if (action === "PING") {
      sendResponse({ ok: true, pong: true, version: "1.1.0" });
      return false;
    }

    if (action === "FETCH_PRODUCT_INFO") {
      try {
        const state = detectPageState();
        if (state !== "OK") {
          sendResponse({ ok: false, error: stateToMsg(state) });
          return false;
        }
        const info = scrapeProductInfo();
        sendResponse({ ok: true, data: info });
      } catch (err) {
        sendResponse({ ok: false, error: err.message || String(err) });
      }
      return false;
    }

    if (action === "FETCH_REVIEWS") {
      const maxReviews = Number(msg?.maxReviews) || 300;
      const state = detectPageState();
      if (state !== "OK") {
        sendResponse({ ok: false, error: stateToMsg(state) });
        return false;
      }

      // Async — chạy scrape rồi sendResponse khi xong
      (async () => {
        try {
          const reviews = await scrapeReviews(maxReviews);
          if (reviews.length === 0) {
            sendResponse({
              ok: false,
              error: "Không scrape được review nào. Có thể TikTok đã đổi UI hoặc sản phẩm này chưa có review.",
            });
            return;
          }
          const productInfo = scrapeProductInfo();
          sendResponse({ ok: true, data: { reviews, productInfo } });
        } catch (err) {
          console.error("[JunTech-TT] scrapeReviews fail:", err);
          sendResponse({ ok: false, error: err.message || String(err) });
        }
      })();
      return true; // giữ channel mở cho async sendResponse
    }

    return false;
  });

  function stateToMsg(state) {
    switch (state) {
      case "CAPTCHA":
        return "TikTok đang yêu cầu xác thực (captcha). Hãy xử lý trong tab TikTok rồi quay lại phân tích.";
      case "LOGIN_REQUIRED":
        return "TikTok yêu cầu đăng nhập. Hãy đăng nhập trong tab TikTok rồi thử lại.";
      case "NOT_FOUND":
        return "Sản phẩm không tồn tại hoặc đã bị xoá.";
      default:
        return "Lỗi không xác định.";
    }
  }

  console.log("[JunTech-TT] Content script ready on", location.hostname);
})();
