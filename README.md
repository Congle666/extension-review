# JunTech Review

> Phân tích hàng nghìn đánh giá Shopee trong vài giây — trực tiếp trên trình duyệt của bạn.

---

## Giới thiệu

**JunTech Review** là một Chrome Extension giúp người mua hàng trên Shopee nhanh chóng phân tích toàn bộ đánh giá của một sản phẩm, từ đó đưa ra quyết định mua sắm thông minh hơn.

**Tính năng dự kiến:**

- Dán URL sản phẩm Shopee → extension tự động thu thập đánh giá
- Thống kê tổng hợp: điểm trung bình, phân bố số sao, từ khóa nổi bật
- Khuyến nghị mua hàng dựa trên dữ liệu thực tế
- Xuất kết quả sang CSV để phân tích thêm
- Hoàn toàn chạy trong trình duyệt — không cần tài khoản, không có server

---

## Trạng thái dự án

> **Phase 1 — UI Shell hoàn tất.** Scraping logic chưa làm.

Phase 1 đã tạo xong skeleton UI (5 file) — extension load được vào Chrome và hiển thị popup. Logic scraping/phân tích sẽ làm ở Phase 2 sau khi resolve các quyết định kiến trúc còn treo. Xem [plans/20260419-2316-mvp-ui-shell/plan.md](plans/20260419-2316-mvp-ui-shell/plan.md).

---

## Cách cài đặt

1. Mở Chrome và truy cập `chrome://extensions`
2. Bật **Developer mode** (góc trên bên phải)
3. Nhấn **Load unpacked**
4. Chọn thư mục `D:/Shoppe Review/` (thư mục chứa [manifest.json](manifest.json))
5. Extension "JunTech Review" sẽ xuất hiện trong thanh công cụ Chrome — pin lại để dễ dùng

## Cách dùng (BẮT BUỘC)

Shopee chặn request không có cookie/Referer hợp lệ. Extension fix bằng cách fetch **trong context tab shopee.vn** thật. Vì vậy:

1. **Mở 1 tab shopee.vn** (bất kỳ trang nào — homepage cũng được) và **đăng nhập**
2. **Giữ tab đó mở** (không cần focus, có thể chạy nền)
3. Click icon JunTech Review → dán URL sản phẩm → "Phân tích ngay"
4. Extension sẽ tự gửi message tới content script trong tab shopee.vn → fetch review → trả kết quả về popup

Nếu chưa mở tab shopee.vn → popup báo: *"Vui lòng mở một tab shopee.vn..."*

---

## Cấu trúc thư mục dự kiến

```
D:/Shoppe Review/
├── manifest.json      # Cấu hình Chrome Extension (MV3)      [chưa tạo]
├── popup.html         # Giao diện chính của extension         [chưa tạo]
├── popup.js           # Logic phân tích và điều phối          [chưa tạo]
├── styles.css         # Stylesheet                            [chưa tạo]
├── README.md          # File này
└── docs/
    ├── project-overview-pdr.md   # Yêu cầu sản phẩm (PDR)
    ├── codebase-summary.md       # Tóm tắt codebase
    ├── code-standards.md         # Tiêu chuẩn và quy ước code
    └── system-architecture.md   # Kiến trúc hệ thống
```

---

## Tài liệu

| Tài liệu | Mô tả |
|---------|-------|
| [docs/project-overview-pdr.md](docs/project-overview-pdr.md) | Yêu cầu sản phẩm đầy đủ, mục tiêu, câu hỏi mở |
| [docs/system-architecture.md](docs/system-architecture.md) | Kiến trúc, luồng dữ liệu, phương án scraping |
| [docs/code-standards.md](docs/code-standards.md) | Tiêu chuẩn code, quy ước đặt tên, xử lý lỗi |
| [docs/codebase-summary.md](docs/codebase-summary.md) | Mô tả từng file theo kế hoạch |

---

## Stack công nghệ

- **Loại:** Chrome Extension, Manifest V3
- **Ngôn ngữ:** Vanilla JavaScript, HTML5, CSS3
- **Không có:** framework, bundler, hay thư viện bên ngoài tại MVP
- **Ngôn ngữ giao diện:** Tiếng Việt

---

## Tác giả

**JunTech** — Made with love for Vietnamese Shopee shoppers.

---

## Giấy phép

*TBD — Giấy phép chưa được chọn. Sẽ cập nhật trước khi phát hành.*
