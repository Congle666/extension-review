# Kiến trúc Hệ thống — JunTech Review

**Phiên bản:** 0.1.0-planning  
**Ngày cập nhật:** 2026-04-19  
**Trạng thái:** Lập kế hoạch MVP — chưa triển khai

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Sơ đồ luồng dữ liệu](#2-sơ-đồ-luồng-dữ-liệu)
3. [Trách nhiệm từng thành phần](#3-trách-nhiệm-từng-thành-phần)
4. [Các phương án kiến trúc thu thập đánh giá](#4-các-phương-án-kiến-trúc-thu-thập-đánh-giá)
5. [Phương án được khuyến nghị](#5-phương-án-được-khuyến-nghị)
6. [Ràng buộc Service Worker MV3](#6-ràng-buộc-service-worker-mv3)
7. [Chiến lược lưu trữ](#7-chiến-lược-lưu-trữ)
8. [Bảo mật và quyền riêng tư](#8-bảo-mật-và-quyền-riêng-tư)
9. [Quyền (Permissions) yêu cầu](#9-quyền-permissions-yêu-cầu)

---

## 1. Tổng quan kiến trúc

JunTech Review là một Chrome Extension Manifest V3 hoạt động hoàn toàn phía client. Không có server backend ở MVP. Toàn bộ logic chạy trong trình duyệt của người dùng.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                          │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  Popup   │───▶│   Scraper    │───▶│   Shopee API         │  │
│  │ (UI/UX)  │    │  (content    │    │ (reviews endpoint)   │  │
│  │          │◀───│   script /   │◀───│                      │  │
│  │ popup.js │    │  popup fetch)│    └──────────────────────┘  │
│  └────┬─────┘    └──────────────┘                              │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐    ┌──────────────┐                              │
│  │ Analyzer │───▶│   Renderer   │                              │
│  │(thống kê)│    │ + Exporter   │                              │
│  └──────────┘    │  (CSV/xlsx)  │                              │
│                  └──────────────┘                              │
│                                                                 │
│  ┌─────────────────────────────┐                               │
│  │   chrome.storage.local      │  ← Cache kết quả phân tích   │
│  └─────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Sơ đồ luồng dữ liệu

```
Người dùng
    │
    │ Dán URL sản phẩm Shopee
    ▼
┌─────────────────────────────────────────┐
│ BƯỚC 1: Validate & Parse URL            │
│  - Kiểm tra URL hợp lệ (shopee.vn/com)  │
│  - Trích xuất shopId + itemId từ URL    │
│  - Hiển thị lỗi nếu URL không hợp lệ   │
└──────────────────┬──────────────────────┘
                   │ { shopId, itemId }
                   ▼
┌─────────────────────────────────────────┐
│ BƯỚC 2: Thu thập đánh giá (Scraping)    │
│  - Vòng lặp gọi API Shopee theo trang   │
│  - Mỗi trang: 6–20 đánh giá             │
│  - Dừng khi đủ số lượng hoặc hết trang  │
│  - Cập nhật progress bar sau mỗi trang  │
│  - Xử lý rate limit với delay/retry     │
└──────────────────┬──────────────────────┘
                   │ reviewList[]
                   ▼
┌─────────────────────────────────────────┐
│ BƯỚC 3: Phân tích                       │
│  - Tính điểm trung bình                 │
│  - Phân bố đánh giá theo số sao         │
│  - Tần suất từ khóa (TBD: tiếng Việt)  │
│  - Sinh khuyến nghị mua hàng (TBD)      │
└──────────────────┬──────────────────────┘
                   │ analysisResult
                   ▼
┌─────────────────────────────────────────┐
│ BƯỚC 4: Hiển thị & Xuất                 │
│  - Render kết quả vào popup             │
│  - Cho phép xuất CSV                    │
│  - Cache vào chrome.storage.local       │
└─────────────────────────────────────────┘
```

---

## 3. Trách nhiệm từng thành phần

| Thành phần | File | Trách nhiệm |
|-----------|------|-------------|
| **UI Layer** | `popup.html` + `styles.css` | Hiển thị giao diện, nhận input từ người dùng |
| **Controller** | `popup.js` | Điều phối luồng, xử lý sự kiện, quản lý trạng thái UI |
| **URL Parser** | `popup.js` (hàm `parseShopeeUrl`) | Trích xuất `shopId` và `itemId` từ URL |
| **Scraper** | `popup.js` hoặc content script (TBD) | Gọi API Shopee, phân trang, retry |
| **Analyzer** | `popup.js` (hàm `analyzeReviews`) | Tính toán thống kê từ danh sách đánh giá |
| **Renderer** | `popup.js` (hàm `renderResults`) | Đổ kết quả vào DOM popup |
| **Exporter** | `popup.js` (hàm `exportToCsv`) | Tạo và tải file CSV |
| **Cache** | `chrome.storage.local` | Lưu kết quả phân tích gần nhất |
| **Extension Config** | `manifest.json` | Khai báo quyền, icon, và entry point |

---

## 4. Các phương án kiến trúc thu thập đánh giá

Đây là quyết định kiến trúc quan trọng nhất và vẫn đang **TBD**. Ba phương án đang được cân nhắc:

### Bảng so sánh phương án

| Tiêu chí | Phương án A: Popup Direct Fetch | Phương án B: Content Script | Phương án C: Backend Proxy |
|---------|--------------------------------|-----------------------------|---------------------------|
| **Mô tả** | Popup gọi `fetch()` trực tiếp đến API Shopee | Inject script vào tab Shopee đang mở, chạy fetch trong context của trang | Một server trung gian đứng ra gọi Shopee API |
| **Độ phức tạp** | Thấp nhất | Trung bình | Cao |
| **CORS** | Bị chặn bởi Shopee (Cross-Origin) | Không bị chặn (same-origin với tab Shopee) | Không bị chặn (server-side) |
| **Session cookie** | Không có (anonymous request) | Có (dùng cookie của người dùng đang đăng nhập) | Không có, trừ khi truyền token |
| **Anti-bot** | Dễ bị chặn nhất | Khó bị chặn hơn (dùng real session) | Dễ bị chặn nếu IP proxy bị detect |
| **Quyền cần thêm** | `host_permissions` (đã có) | `scripting`, `tabs` | Không cần thêm Chrome permission |
| **Offline capable** | Không | Không | Không |
| **Privacy** | Dữ liệu trong browser | Dữ liệu trong browser | Dữ liệu qua server bên ngoài |
| **Chi phí** | Miễn phí | Miễn phí | Có chi phí hosting |
| **Yêu cầu tab Shopee** | Không | Có (người dùng phải mở tab Shopee) | Không |
| **Phù hợp MVP** | Thử nghiệm nhanh | **Được khuyến nghị** | Ngoài phạm vi MVP |

### Chi tiết từng phương án

#### Phương án A: Popup Direct Fetch

```
popup.js → fetch('https://shopee.vn/api/...') → Response
```

**Ưu điểm:**
- Đơn giản nhất để triển khai, không cần infrastructure thêm.
- Không cần tab Shopee nào đang mở.

**Nhược điểm:**
- Shopee chặn CORS — request từ `chrome-extension://` origin sẽ bị từ chối.
- Request ẩn danh (không có session), dễ bị rate limit và captcha hơn.
- Không thể lấy dữ liệu yêu cầu xác thực.

**Kết luận:** Có thể test được cho prototype nhưng **không bền vững** cho production.

---

#### Phương án B: Content Script trong Tab

```
popup.js → chrome.scripting.executeScript() → [Tab Shopee] → fetch API → Review data → popup.js
```

**Ưu điểm:**
- Request chạy trong context của trang Shopee → cùng origin → không bị chặn CORS.
- Dùng session cookie của người dùng → ít bị anti-bot hơn.
- Không cần server — bảo vệ quyền riêng tư người dùng.

**Nhược điểm:**
- Người dùng phải có tab Shopee đang mở (hoặc extension tự mở tab).
- Cần thêm quyền `scripting` và `tabs`.
- Phức tạp hơn Phương án A về điều phối message giữa popup và content script.

**Kết luận:** **Được khuyến nghị cho MVP production**.

---

#### Phương án C: Backend Proxy Server

```
popup.js → fetch('https://api.juntech.vn/scrape?url=...') → [Server] → Shopee API → Review data
```

**Ưu điểm:**
- Tách hoàn toàn logic scraping khỏi extension.
- Có thể implement caching, queue, và rate limiting server-side.

**Nhược điểm:**
- Yêu cầu chi phí hosting và bảo trì server.
- Dữ liệu sản phẩm đi qua server bên ngoài → vi phạm nguyên tắc privacy MVP.
- Nếu server down → extension không hoạt động.
- Tăng độ phức tạp đáng kể.

**Kết luận:** **Ngoài phạm vi MVP**. Xem xét ở phiên bản sau nếu Phương án B không đủ.

---

## 5. Phương án được khuyến nghị

**Sử dụng Phương án B: Content Script trong Tab.**

**Lý do:**
1. Dùng session cookie của người dùng giúp giảm đáng kể nguy cơ bị anti-bot chặn.
2. Không có dữ liệu rời khỏi trình duyệt — bảo vệ quyền riêng tư.
3. Không có chi phí server.
4. CORS không phải vấn đề.

**Luồng triển khai dự kiến:**

```
1. Popup nhận URL từ người dùng
2. Popup gọi chrome.tabs.query() để tìm tab Shopee đang mở
   → Nếu không có: chrome.tabs.create({ url: shopeeUrl, active: false })
3. Popup inject content script qua chrome.scripting.executeScript()
4. Content script chạy fetch() loop trong context của tab Shopee
5. Kết quả gửi về popup qua chrome.runtime.sendMessage()
6. Popup render kết quả
```

**Permissions cần bổ sung vào manifest.json:**

```json
{
  "permissions": ["storage", "scripting", "tabs"],
  "host_permissions": ["https://shopee.vn/*", "https://shopee.com/*"]
}
```

---

## 6. Ràng buộc Service Worker MV3

### Vấn đề

Manifest V3 thay thế background page thường trú bằng Service Worker. Service worker **bị terminate sau ~30 giây không có hoạt động**. Đây là ràng buộc cứng của Chrome.

### Tác động

- **Không thể** chạy scraping loop dài (500–5000 đánh giá) trong service worker.
- Nếu service worker bị kill giữa chừng, tiến trình mất và người dùng không nhận được kết quả.

### Giải pháp (theo phương án B)

Chạy scraping trong **content script của tab đang mở**, không phải service worker. Content script sống theo lifetime của tab, không bị kill sau 30s.

```
Service Worker (background.js)   → Chỉ dùng cho routing message, KHÔNG chạy scraping
Content Script (trong tab)       → Chạy toàn bộ fetch loop
Popup (popup.js)                 → Điều phối, hiển thị progress, render kết quả
```

### Nếu cần giữ service worker hoạt động (trường hợp đặc biệt)

Có thể dùng `chrome.alarms` để tạo alarm định kỳ và giữ service worker không bị terminate. Tuy nhiên với Phương án B, đây không cần thiết.

---

## 7. Chiến lược lưu trữ

### `chrome.storage.local`

| Dữ liệu | Key | Mô tả |
|---------|-----|-------|
| Kết quả phân tích gần nhất | `lastAnalysis` | Object `{ url, timestamp, result }` |
| Cài đặt người dùng | `userSettings` | Object `{ maxReviews: 300 }` |

**Lưu ý:**
- `chrome.storage.local` giới hạn 5MB mặc định (đủ cho MVP).
- Không lưu toàn bộ danh sách đánh giá (có thể lên đến vài MB với 5000 đánh giá).
- Chỉ lưu kết quả phân tích tổng hợp và metadata.

### Không dùng

- `localStorage` — không accessible từ popup context đúng cách.
- `IndexedDB` — quá phức tạp cho MVP.
- `chrome.storage.sync` — giới hạn 100KB, không phù hợp nếu cache lớn hơn.

---

## 8. Bảo mật và quyền riêng tư

### Nguyên tắc MVP

1. **Không có dữ liệu người dùng nào rời khỏi trình duyệt.** Extension không gửi bất kỳ thông tin nào đến server bên ngoài (trừ Shopee API để lấy đánh giá).
2. **Không lưu trữ thông tin đăng nhập.** Extension không bao giờ đọc hay lưu trữ cookie, token, hay mật khẩu Shopee của người dùng.
3. **Content Security Policy (CSP) của MV3** tự động chặn `eval()` và inline script — tuân thủ tốt hơn MV2.
4. **Host permissions tối thiểu:** Chỉ khai báo `shopee.vn` và `shopee.com`, không dùng wildcard `<all_urls>`.

### Rủi ro đã biết

- Content script inject vào tab của người dùng có quyền truy cập DOM của trang đó. Cần đảm bảo content script không đọc thông tin nhạy cảm ngoài API calls cần thiết.
- Session cookie của người dùng được dùng ngầm qua fetch (browser tự đính kèm) — không bị lưu hay truyền đi, nhưng cần document rõ ràng trong privacy policy tương lai.

---

## 9. Quyền (Permissions) yêu cầu

### Manifest hiện tại (spec ban đầu — không đủ)

```json
{
  "permissions": ["storage"],
  "host_permissions": ["https://shopee.vn/*", "https://shopee.com/*"]
}
```

### Manifest dự kiến (sau khi chọn Phương án B)

```json
{
  "permissions": ["storage", "scripting", "tabs"],
  "host_permissions": ["https://shopee.vn/*", "https://shopee.com/*"]
}
```

### Giải thích từng quyền

| Permission | Lý do cần |
|-----------|-----------|
| `storage` | Lưu cài đặt người dùng và cache kết quả phân tích |
| `scripting` | Inject content script vào tab Shopee để chạy fetch |
| `tabs` | Tìm tab Shopee đang mở, hoặc tạo tab mới nếu cần |
| `host_permissions: shopee.vn/*` | Cho phép fetch và inject script vào trang Shopee |

**Không cần:**
- `"alarms"` — nếu dùng content script (không cần giữ service worker)
- `"cookies"` — browser tự đính kèm cookie, không cần quyền đọc trực tiếp
- `"<all_urls>"` — không cần, chỉ hoạt động với Shopee

---

*Xem thêm: [docs/project-overview-pdr.md](project-overview-pdr.md) | [docs/code-standards.md](code-standards.md) | [docs/codebase-summary.md](codebase-summary.md)*
