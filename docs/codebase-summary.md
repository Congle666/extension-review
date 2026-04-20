# Tóm tắt Codebase — JunTech Review

**Phiên bản:** 0.1.0-planning  
**Ngày cập nhật:** 2026-04-19  
**Trạng thái:** CHƯA TRIỂN KHAI — Đây là cấu trúc dự kiến. Xem [docs/project-overview-pdr.md](project-overview-pdr.md) để biết toàn bộ yêu cầu.

> Dự án hiện đang ở giai đoạn lập kế hoạch. Không có file code nào được tạo ra. Tài liệu này mô tả cấu trúc thư mục và mục đích từng file **theo kế hoạch MVP**.

---

## Cấu trúc thư mục dự kiến

```
D:/Shoppe Review/
├── manifest.json          # Cấu hình Chrome Extension (MV3)
├── popup.html             # Giao diện chính của extension
├── popup.js               # Logic giao diện và điều phối luồng dữ liệu
├── styles.css             # Stylesheet toàn cục
├── README.md              # Hướng dẫn cài đặt và tổng quan dự án
└── docs/
    ├── project-overview-pdr.md   # Tài liệu yêu cầu sản phẩm (PDR)
    ├── codebase-summary.md       # File này — tóm tắt codebase
    ├── code-standards.md         # Tiêu chuẩn code và quy ước lập trình
    └── system-architecture.md   # Kiến trúc hệ thống và quyết định thiết kế
```

**Lưu ý:** Cấu trúc trên là "flat root" — tất cả file code nằm ở thư mục gốc, không có thư mục con `src/`. Đây là quyết định có chủ đích cho MVP để giảm độ phức tạp. Có thể tái cấu trúc ở phiên bản sau nếu số lượng file tăng lên.

---

## Mô tả từng file theo kế hoạch

### `manifest.json`

**Mục đích:** Khai báo cấu hình Chrome Extension theo chuẩn Manifest V3.

**Nội dung dự kiến:**

| Trường | Giá trị |
|--------|---------|
| `manifest_version` | `3` |
| `name` | `"JunTech Review"` |
| `version` | `"1.0.0"` |
| `permissions` | `["storage"]` *(có thể mở rộng — xem TBD trong PDR)* |
| `host_permissions` | `["https://shopee.vn/*", "https://shopee.com/*"]` |
| `action.default_popup` | `"popup.html"` |
| `icons` | 16px, 48px, 128px (placeholder) |

**Rủi ro:** Danh sách `permissions` hiện tại có thể chưa đủ cho scraping thực tế. Cần bổ sung `"scripting"`, `"tabs"`, hoặc `"alarms"` tùy theo kiến trúc được chọn.

---

### `popup.html`

**Mục đích:** Giao diện người dùng chính, hiển thị khi người dùng click vào icon extension.

**Bố cục dự kiến (width: 420px):**

```
┌─────────────────────────────────────┐
│  [Logo]  JunTech Review             │  ← header
│  Phân tích đánh giá Shopee thông minh│  ← subtitle
├─────────────────────────────────────┤
│  [Textarea: Dán URL sản phẩm...]    │  ← nhập URL
│  [Dropdown: Số đánh giá: 300 ▼]    │  ← chọn giới hạn
│  [🔍 Phân tích ngay]               │  ← nút chính
├─────────────────────────────────────┤
│  [████░░░░ Đang tải... 60%]        │  ← progress bar (hidden)
├─────────────────────────────────────┤
│  [Kết quả phân tích...]            │  ← result area (hidden)
│  [Thông báo lỗi...]                │  ← error area (hidden)
├─────────────────────────────────────┤
│  [☕ Ủng hộ tác giả]  Made with 💛 by JunTech │  ← footer
└─────────────────────────────────────┘
```

**Dropdown options (max reviews):** 100 / 300 (default) / 500 / 1000 / 5000

**Class CSS dùng:** `.hidden` để ẩn/hiện các khu vực động (progress, result, error).

---

### `styles.css`

**Mục đích:** Định nghĩa toàn bộ giao diện thị giác theo bộ nhận diện thương hiệu Shopee.

**Màu sắc và token thiết kế dự kiến:**

| CSS Custom Property | Giá trị |
|---------------------|---------|
| `--color-primary` | `#ee4d2d` (Shopee orange) |
| `--color-background` | `#f7f7f8` |
| `--color-text` | `#212121` |
| `--color-border` | `#e0e0e0` |
| `--radius-card` | `8px` |
| `--radius-button` | `6px` |

**Quy tắc quan trọng:**
- Font: system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- `.hidden { display: none }` — class tiện ích để ẩn element
- Responsive trong giới hạn 420px width của popup
- Không dùng magic number — mọi giá trị lặp lại phải là CSS custom property

---

### `popup.js`

**Mục đích:** Toàn bộ logic JavaScript của popup — xử lý sự kiện, gọi API, phân tích dữ liệu, render kết quả.

**Helper và hàm dự kiến:**

```javascript
// Tiện ích truy cập DOM
const $ = (id) => document.getElementById(id);

// Quản lý trạng thái UI
function showError(msg)    // Hiển thị thông báo lỗi cho người dùng
function hideError()       // Ẩn khu vực lỗi
function showLoading(msg)  // Hiển thị progress bar và trạng thái loading
function hideLoading()     // Ẩn progress bar

// Placeholder event listeners (MVP — chưa có logic thực)
// - Nút "Phân tích ngay": sẽ trigger luồng fetch → analyze → render
// - Nút "Ủng hộ tác giả": mở tab donate
```

**Luồng logic dự kiến (chưa triển khai):**
1. Người dùng nhấn "Phân tích ngay"
2. Validate và parse URL → trích xuất `shopId` + `itemId`
3. Vòng lặp phân trang gọi API Shopee
4. Thu thập đánh giá, cập nhật progress bar
5. Chạy hàm phân tích
6. Render kết quả vào `#result-area`
7. Kích hoạt nút xuất CSV

**Quy ước code:**
- Comment bằng tiếng Việt cho mọi hàm chính
- Dùng `async/await`, không dùng `.then()` chain
- Mọi lỗi phải được hiển thị qua `showError()` — không bao giờ im lặng nuốt lỗi

---

### `README.md`

**Mục đích:** Tài liệu giới thiệu dự án và hướng dẫn cài đặt.

**Nội dung dự kiến:**
- Tên dự án + tagline
- Danh sách tính năng ngắn gọn
- Trạng thái dự án (MVP planning)
- Hướng dẫn nạp extension vào Chrome (khi có build)
- Liên kết đến `docs/` để xem tài liệu chi tiết

---

## Trạng thái triển khai

| File | Trạng thái |
|------|-----------|
| `manifest.json` | Chưa tạo |
| `popup.html` | Chưa tạo |
| `popup.js` | Chưa tạo |
| `styles.css` | Chưa tạo |
| `README.md` | Chưa tạo |
| `docs/project-overview-pdr.md` | Hoàn thành |
| `docs/codebase-summary.md` | Hoàn thành (file này) |
| `docs/code-standards.md` | Hoàn thành |
| `docs/system-architecture.md` | Hoàn thành |

---

*Xem thêm: [docs/project-overview-pdr.md](project-overview-pdr.md) | [docs/system-architecture.md](system-architecture.md) | [docs/code-standards.md](code-standards.md)*
