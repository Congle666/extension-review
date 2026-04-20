# Tiêu chuẩn Code — JunTech Review

**Phiên bản:** 0.1.0-planning  
**Ngày cập nhật:** 2026-04-19  
**Áp dụng cho:** Toàn bộ codebase MVP

---

## Mục lục

1. [Công nghệ được phép](#1-công-nghệ-được-phép)
2. [Tổ chức file](#2-tổ-chức-file)
3. [Quy ước đặt tên](#3-quy-ước-đặt-tên)
4. [Quy ước comment](#4-quy-ước-comment)
5. [JavaScript — Quy tắc code](#5-javascript--quy-tắc-code)
6. [CSS — Quy tắc style](#6-css--quy-tắc-style)
7. [HTML — Quy tắc markup](#7-html--quy-tắc-markup)
8. [Xử lý lỗi](#8-xử-lý-lỗi)
9. [Những điều tuyệt đối không được làm](#9-những-điều-tuyệt-đối-không-được-làm)

---

## 1. Công nghệ được phép

### Được phép tại MVP

| Công nghệ | Được dùng | Ghi chú |
|-----------|-----------|---------|
| HTML5 | Có | Chuẩn semantic HTML |
| CSS3 | Có | Custom properties, Flexbox, Grid |
| Vanilla JavaScript (ES2020+) | Có | `async/await`, optional chaining, nullish coalescing |
| Chrome Extension APIs | Có | `chrome.storage`, `chrome.scripting`, `chrome.tabs`, v.v. |

### Không được phép tại MVP

| Công nghệ | Lý do |
|-----------|-------|
| React / Vue / Angular / Svelte | Không cần thiết cho MVP, thêm độ phức tạp |
| TypeScript | Tăng bước build, không phù hợp flat-file MVP |
| Webpack / Vite / Parcel / esbuild | Không cần bundler cho MVP |
| jQuery | Không cần thiết, `$()` helper tự viết là đủ |
| Lodash / underscore | Viết tiện ích tối giản khi cần |
| SheetJS / ExcelJS | TBD — chỉ cho phép nếu quyết định hỗ trợ .xlsx |
| npm packages nói chung | Không có `package.json` tại MVP |

> Ngoại lệ: Thư viện bên ngoài có thể được thêm ở phiên bản sau với phê duyệt rõ ràng và lý do chính đáng.

---

## 2. Tổ chức file

### Cấu trúc flat root (MVP)

```
D:/Shoppe Review/
├── manifest.json    # Chrome Extension manifest
├── popup.html       # Entry point giao diện
├── popup.js         # Logic duy nhất tại MVP
├── styles.css       # Stylesheet toàn cục
└── docs/            # Tài liệu dự án (không ship vào extension)
```

**Nguyên tắc:**
- MVP dùng cấu trúc flat — tất cả file code ở thư mục gốc.
- Không tạo thư mục `src/`, `dist/`, `build/` tại MVP.
- Thư mục `docs/` chỉ chứa tài liệu, không được khai báo trong `manifest.json`.
- Nếu số lượng file vượt quá 10, xem xét tái cấu trúc với thư mục `src/`.

### Quy tắc đặt tên file

- Dùng **kebab-case** cho tên file: `popup.js`, `styles.css`, không phải `Popup.js` hay `styles_css`.
- Tên file phải mô tả nội dung, không dùng tên chung chung như `utils.js` trừ khi file đó thực sự là tiện ích chung.

---

## 3. Quy ước đặt tên

### JavaScript

| Loại | Quy ước | Ví dụ |
|------|---------|-------|
| Biến thường | camelCase | `reviewList`, `totalCount`, `shopId` |
| Hằng số (không thay đổi) | UPPER_SNAKE_CASE | `MAX_REVIEWS`, `API_BASE_URL` |
| Hàm | camelCase, động từ | `fetchReviews()`, `showError()`, `parseShopeeUrl()` |
| Class (nếu dùng) | PascalCase | `ReviewAnalyzer` |
| Biến DOM element | tiền tố `el` hoặc hậu tố `El` | `btnAnalyze`, `progressBarEl` |
| Boolean | tiền tố `is` / `has` / `can` | `isLoading`, `hasError`, `canExport` |

### CSS

| Loại | Quy ước | Ví dụ |
|------|---------|-------|
| Class | kebab-case | `.result-card`, `.progress-bar`, `.btn-primary` |
| ID | kebab-case | `#url-input`, `#result-area` |
| Custom property | `--` tiền tố, kebab-case | `--color-primary`, `--radius-card` |
| BEM (tùy chọn) | Block__Element--Modifier | `.card__title`, `.btn--disabled` |

### HTML

- Thuộc tính `id`: kebab-case, dùng cho JavaScript truy cập.
- Thuộc tính `class`: kebab-case, dùng cho CSS styling.
- Không dùng cùng một `id` làm cả JavaScript hook lẫn CSS selector — tách biệt vai trò.

---

## 4. Quy ước comment

### Tiếng Việt cho hàm chính

Mọi hàm có logic phức tạp hoặc ảnh hưởng đến luồng chính **phải** có comment tiếng Việt:

```javascript
/**
 * Trích xuất shop ID và item ID từ URL sản phẩm Shopee.
 * Hỗ trợ cả định dạng shopee.vn và shopee.com.
 * @param {string} url - URL đầy đủ của sản phẩm
 * @returns {{ shopId: string, itemId: string } | null} - null nếu URL không hợp lệ
 */
function parseShopeeUrl(url) { ... }

/**
 * Hiển thị thông báo lỗi cho người dùng.
 * Tự động cuộn đến khu vực lỗi nếu bị ẩn.
 * @param {string} message - Nội dung thông báo lỗi (tiếng Việt)
 */
function showError(message) { ... }
```

### Tiếng Anh cho comment nội tuyến đơn giản

Comment nội tuyến ngắn trong logic tường minh có thể dùng tiếng Anh:

```javascript
const offset = page * limit; // calculate pagination offset
```

### Không comment những điều hiển nhiên

```javascript
// BAD: Tăng biến đếm lên 1
count++;

// GOOD: không cần comment
count++;
```

---

## 5. JavaScript — Quy tắc code

### 5.1 Truy cập DOM

Dùng helper `$` thay vì `document.getElementById` trực tiếp:

```javascript
// Khai báo một lần ở đầu file popup.js
const $ = (id) => document.getElementById(id);

// Sử dụng
const urlInput = $('url-input');
const btnAnalyze = $('btn-analyze');
```

Không dùng `document.querySelector` cho element có `id` — dùng `$()` để nhất quán.  
Chỉ dùng `document.querySelectorAll` khi cần chọn nhiều element theo class.

### 5.2 Async/Await

Luôn dùng `async/await` thay vì `.then()` chain:

```javascript
// BAD
fetch(url)
  .then(res => res.json())
  .then(data => processData(data))
  .catch(err => showError(err.message));

// GOOD
async function loadReviews(url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    processData(data);
  } catch (err) {
    showError(`Không thể tải đánh giá: ${err.message}`);
  }
}
```

### 5.3 Xử lý lỗi

Xem [Mục 8](#8-xử-lý-lỗi) để biết quy tắc đầy đủ.

### 5.4 Khai báo biến

- Dùng `const` mặc định.
- Chỉ dùng `let` khi biến thực sự cần gán lại.
- Không bao giờ dùng `var`.

```javascript
const MAX_REVIEWS = 5000;          // hằng số
let currentPage = 0;               // biến thay đổi trong vòng lặp
const reviewList = [];             // mảng (const — reference không đổi)
```

### 5.5 String

- Dùng template literal cho string có biến: `` `Đã tải ${count} đánh giá` ``
- Dùng single quote `'` cho string thuần (không có biến)
- Không dùng double quote cho string JS (dành cho HTML attribute)

### 5.6 So sánh

- Luôn dùng `===` và `!==`, không dùng `==` hay `!=`.

### 5.7 Hàm helper bắt buộc trong `popup.js`

Các hàm sau **phải** tồn tại và tuân theo signature này:

```javascript
// Hiển thị lỗi cho người dùng
function showError(message) { ... }

// Ẩn khu vực lỗi
function hideError() { ... }

// Hiển thị trạng thái loading với thông báo tùy chọn
function showLoading(message = 'Đang xử lý...') { ... }

// Ẩn loading, reset progress bar
function hideLoading() { ... }
```

---

## 6. CSS — Quy tắc style

### 6.1 Custom Properties (Design Tokens)

Mọi màu sắc, khoảng cách, và border-radius lặp lại **phải** được định nghĩa là CSS custom property trong `:root`:

```css
:root {
  /* Màu sắc chính */
  --color-primary: #ee4d2d;
  --color-primary-hover: #d73211;
  --color-background: #f7f7f8;
  --color-surface: #ffffff;
  --color-text: #212121;
  --color-text-muted: #757575;
  --color-border: #e0e0e0;
  --color-error: #d32f2f;
  --color-success: #388e3c;

  /* Khoảng cách */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;

  /* Border radius */
  --radius-card: 8px;
  --radius-button: 6px;
  --radius-input: 4px;

  /* Font */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-base: 14px;
  --font-size-sm: 12px;
  --font-size-lg: 16px;
}
```

Không dùng magic number trong CSS — ví dụ `border-radius: 8px` phải là `border-radius: var(--radius-card)`.

### 6.2 Class tiện ích

```css
/* Bắt buộc — dùng để ẩn/hiện element bằng JS */
.hidden {
  display: none;
}
```

### 6.3 Font

Dùng system font stack, không import Google Fonts tại MVP:

```css
font-family: var(--font-family);
```

### 6.4 Responsive

Popup cố định width 420px theo chuẩn Chrome Extension. Không cần media query cho responsive rộng. Tuy nhiên phải đảm bảo nội dung không bị tràn (overflow) nếu text dài.

---

## 7. HTML — Quy tắc markup

- Dùng HTML5 semantic: `<header>`, `<main>`, `<footer>`, `<section>`.
- Mọi `<input>`, `<textarea>`, `<select>` phải có `<label>` tương ứng (accessibility).
- Thuộc tính `lang="vi"` trên thẻ `<html>`.
- Charset phải là `UTF-8`.
- Mọi element có `id` trong HTML phải được dùng trong `popup.js` (xóa id nếu không dùng).

---

## 8. Xử lý lỗi

### Nguyên tắc cốt lõi: Không bao giờ im lặng nuốt lỗi

```javascript
// BAD — lỗi bị ẩn hoàn toàn
try {
  await fetchReviews(url);
} catch (e) {}

// BAD — chỉ log ra console, người dùng không biết
try {
  await fetchReviews(url);
} catch (e) {
  console.error(e);
}

// GOOD — luôn hiển thị lỗi cho người dùng
try {
  await fetchReviews(url);
} catch (e) {
  showError(`Không thể tải đánh giá: ${e.message}`);
}
```

### Loại lỗi cần xử lý

| Loại lỗi | Thông báo gợi ý |
|----------|-----------------|
| URL không hợp lệ | "URL không đúng định dạng. Vui lòng dán URL sản phẩm Shopee." |
| Lỗi mạng / timeout | "Không thể kết nối. Kiểm tra kết nối mạng và thử lại." |
| Rate limit (HTTP 429) | "Shopee đang giới hạn tốc độ. Vui lòng đợi vài phút rồi thử lại." |
| Sản phẩm không tồn tại | "Không tìm thấy sản phẩm. Kiểm tra lại URL." |
| Lỗi không xác định | "Đã xảy ra lỗi. Vui lòng thử lại." |

---

## 9. Những điều tuyệt đối không được làm

| Không được | Lý do |
|-----------|-------|
| `console.log()` trong code commit | Gây lộ thông tin debug, làm bẩn console người dùng |
| `var` để khai báo biến | Dùng `const`/`let` |
| Magic number trong CSS | Dùng CSS custom property |
| `.then()` chain | Dùng `async/await` |
| Import thư viện ngoài chưa được phê duyệt | Phải review và phê duyệt trước |
| Nuốt lỗi trong `catch` rỗng | Luôn gọi `showError()` |
| `document.write()` | Không bao giờ |
| `eval()` | Bị chặn bởi Chrome Extension CSP |
| Inline script trong HTML | Bị chặn bởi MV3 CSP — tất cả JS phải ở file riêng |

---

*Xem thêm: [docs/project-overview-pdr.md](project-overview-pdr.md) | [docs/system-architecture.md](system-architecture.md) | [docs/codebase-summary.md](codebase-summary.md)*
