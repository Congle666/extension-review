/* ============================================================
   BaseAdapter — abstract base cho adapter sàn TMĐT.
   Mỗi sàn (Shopee, TikTok Shop, Lazada...) định nghĩa 1 class
   extend BaseAdapter, override metadata + canHandle/parseUrl
   (static) + fetchReviews (instance).
   ============================================================ */

class BaseAdapter {
  // ----- Metadata (override trong subclass) -----
  static platformId = "";        // 'shopee' | 'tiktokshop' | 'lazada'
  static platformName = "";      // 'Shopee' | 'TikTok Shop'
  static platformIcon = "";      // emoji
  static platformColor = "";     // hex color cho theme
  static supportedDomains = [];  // ['shopee.vn', 'shopee.com']

  /**
   * Trả true nếu URL thuộc sàn này.
   * Mặc định gọi parseUrl — subclass có thể override để check rẻ hơn.
   */
  static canHandle(url) {
    return this.parseUrl(url) !== null;
  }

  /**
   * Parse URL → object id (vd { shopid, itemid, productId }) hoặc null.
   * Subclass MUST override.
   */
  static parseUrl(url) {
    return null;
  }

  /**
   * Chuẩn hoá 1 review raw từ API/DOM → định dạng chuẩn.
   * Field chuẩn: rating_star, comment, images[], videos[], ctime,
   * mtime, author_username, tags[].
   * Subclass override khi cần map field name.
   */
  static normalizeReview(raw) {
    return raw;
  }

  /**
   * Trả product info chuẩn { name, image, price } hoặc null.
   * Subclass override.
   */
  static normalizeProductInfo(raw) {
    return raw;
  }

  /**
   * Fetch review (async). Subclass MUST override.
   * @param {object} ids — output của parseUrl
   * @param {object} options — { maxReviews, onProgress }
   * @returns {Promise<{reviews: object[], productInfo: object|null}>}
   */
  async fetchReviews(ids, options) {
    throw new Error(`${this.constructor.name}.fetchReviews phải được override`);
  }
}

// Expose ra global cho các script khác.
window.BaseAdapter = BaseAdapter;
