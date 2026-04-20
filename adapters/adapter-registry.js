/* ============================================================
   AdapterRegistry — đăng ký + lookup adapter theo URL.
   Mỗi adapter file gọi `adapterRegistry.register(MyAdapter)` ở cuối.
   popup.js dùng `adapterRegistry.findByUrl(url)` để chọn adapter.
   ============================================================ */

class AdapterRegistry {
  constructor() {
    this.adapters = []; // mảng AdapterClass (không phải instance)
  }

  /**
   * Đăng ký 1 AdapterClass. Idempotent (cùng platformId không add 2 lần).
   */
  register(AdapterClass) {
    if (!AdapterClass?.platformId) {
      console.warn("[adapterRegistry] Adapter thiếu platformId, bỏ qua:", AdapterClass);
      return;
    }
    if (this.adapters.some((A) => A.platformId === AdapterClass.platformId)) {
      return;
    }
    this.adapters.push(AdapterClass);
  }

  /**
   * Tìm AdapterClass đầu tiên xử lý được URL. null nếu không có.
   */
  findByUrl(url) {
    return this.adapters.find((A) => A.canHandle(url)) || null;
  }

  /**
   * Lấy AdapterClass theo platformId.
   */
  getById(platformId) {
    return this.adapters.find((A) => A.platformId === platformId) || null;
  }

  /**
   * Trả mảng tất cả adapter đã đăng ký.
   */
  getAll() {
    return this.adapters.slice();
  }
}

// Singleton instance ra global.
const adapterRegistry = new AdapterRegistry();
window.adapterRegistry = adapterRegistry;
window.AdapterRegistry = AdapterRegistry;
