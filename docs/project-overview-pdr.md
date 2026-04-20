# Tài liệu Yêu cầu Phát triển Sản phẩm (PDR)
# JunTech Review — Chrome Extension

**Phiên bản:** 0.1.0-planning  
**Ngày cập nhật:** 2026-04-19  
**Trạng thái:** Lập kế hoạch MVP — chưa triển khai  
**Tác giả:** JunTech

---

## Mục lục

1. [Phát biểu vấn đề](#1-phát-biểu-vấn-đề)
2. [Người dùng mục tiêu](#2-người-dùng-mục-tiêu)
3. [Mục tiêu và ngoài phạm vi](#3-mục-tiêu-và-ngoài-phạm-vi)
4. [Yêu cầu chức năng](#4-yêu-cầu-chức-năng)
5. [Yêu cầu phi chức năng](#5-yêu-cầu-phi-chức-năng)
6. [Chỉ số thành công](#6-chỉ-số-thành-công)
7. [Ngoài phạm vi MVP](#7-ngoài-phạm-vi-mvp)
8. [Câu hỏi mở và rủi ro kiến trúc](#8-câu-hỏi-mở-và-rủi-ro-kiến-trúc)

---

## 1. Phát biểu vấn đề

Người mua hàng trên Shopee thường phải đọc hàng trăm đến hàng nghìn đánh giá để quyết định có nên mua sản phẩm hay không. Quá trình này tốn nhiều thời gian, dễ bỏ sót đánh giá tiêu cực bị chôn vùi, và không cung cấp bức tranh tổng thể về chất lượng sản phẩm. Người bán lại (reseller) và dropshipper càng cần đánh giá nhanh hàng loạt sản phẩm trong thời gian ngắn.

**Vấn đề cốt lõi:**
- Đọc thủ công hàng trăm đánh giá mất từ 10–30 phút mỗi sản phẩm.
- Shopee không cung cấp tóm tắt cảm xúc (sentiment) hay thống kê chi tiết theo tiêu chí.
- Không có cách xuất dữ liệu đánh giá để phân tích ngoại tuyến.

---

## 2. Người dùng mục tiêu

| Nhóm | Mô tả | Nhu cầu chính |
|------|-------|---------------|
| Người mua lẻ | Người Việt Nam mua sắm trên Shopee.vn | Quyết định mua nhanh, tin tưởng hơn |
| Reseller / Dropshipper | Người tìm nguồn hàng từ Shopee | Đánh giá hàng loạt sản phẩm, xuất báo cáo |
| Người so sánh sản phẩm | Người dùng so sánh nhiều listing cùng danh mục | Tóm tắt nhanh ưu/nhược điểm |

**Ngôn ngữ giao diện:** Tiếng Việt (ưu tiên), tiếng Anh (tùy chọn tương lai).

---

## 3. Mục tiêu và ngoài phạm vi

### 3.1 Mục tiêu MVP

- Cho phép người dùng dán URL sản phẩm Shopee và tự động thu thập đánh giá.
- Hiển thị phân tích tổng hợp (số sao trung bình, phân bố đánh giá, từ khóa nổi bật).
- Đưa ra khuyến nghị mua hàng dựa trên dữ liệu thu thập được.
- Xuất kết quả sang định dạng CSV để phân tích thêm.
- Hoạt động hoàn toàn trong trình duyệt, không yêu cầu tài khoản hay server riêng.

### 3.2 Không phải mục tiêu MVP

- Hỗ trợ đa nền tảng (Lazada, Tiki, Sendo).
- Xác thực người dùng hay quản lý tài khoản.
- Phân tích cảm xúc bằng AI/LLM (đây là tính năng tương lai — xem [Mục 8](#8-câu-hỏi-mở-và-rủi-ro-kiến-trúc)).
- Giám sát sản phẩm theo thời gian thực.
- Chia sẻ kết quả lên mạng xã hội.

---

## 4. Yêu cầu chức năng

### FR-01: Nhập URL sản phẩm

- Người dùng dán URL sản phẩm Shopee (shopee.vn hoặc shopee.com) vào ô textarea.
- Extension tự động trích xuất product ID và shop ID từ URL.
- Hiển thị thông báo lỗi nếu URL không hợp lệ hoặc không phải URL Shopee.

### FR-02: Cấu hình lấy đánh giá

- Người dùng chọn số lượng đánh giá tối đa cần phân tích: 100, 300 (mặc định), 500, 1000, 5000.
- Lưu cài đặt cuối cùng của người dùng vào `chrome.storage.local`.

### FR-03: Thu thập đánh giá

- Extension gọi API Shopee để lấy đánh giá theo từng trang (phân trang).
- Hiển thị thanh tiến trình trong quá trình thu thập.
- Xử lý lỗi mạng, rate limit và timeout một cách graceful.

### FR-04: Phân tích đánh giá

- Tính điểm trung bình (average rating).
- Thống kê phân bố số sao (1–5 sao).
- Xác định từ khóa xuất hiện nhiều nhất trong đánh giá.
- Đưa ra khuyến nghị mua hàng (**TBD** — xem Mục 8, Rủi ro 4).

### FR-05: Hiển thị kết quả

- Hiển thị kết quả trong popup của extension.
- Kết quả bao gồm: điểm TB, biểu đồ phân bố sao, danh sách từ khóa, và khuyến nghị.

### FR-06: Xuất dữ liệu

- Xuất toàn bộ dữ liệu đánh giá sang file CSV.
- **TBD:** Xuất sang `.xlsx` — cần thư viện bên ngoài, chưa quyết định (xem Rủi ro 5).

### FR-07: Ủng hộ tác giả

- Nút "☕ Ủng hộ tác giả" mở link donate (placeholder tại MVP).

---

## 5. Yêu cầu phi chức năng

### NFR-01: Công nghệ

- **Bắt buộc:** Vanilla JavaScript, HTML, CSS thuần — không dùng framework hay bundler tại MVP.
- **Manifest Version:** Manifest V3 (bắt buộc cho Chrome Extension hiện đại).
- Không có thư viện bên ngoài được nhúng tại MVP.

### NFR-02: Trải nghiệm người dùng

- Giao diện hoàn toàn bằng tiếng Việt.
- Popup rộng 420px, tương thích với màn hình độ phân giải thấp.
- Thời gian phản hồi: hiển thị trạng thái loading ngay lập tức sau khi nhấn nút.
- Thông báo lỗi rõ ràng, không để người dùng đoán nguyên nhân thất bại.

### NFR-03: Bảo mật và quyền riêng tư

- Không có dữ liệu người dùng nào rời khỏi trình duyệt tại MVP.
- Chỉ yêu cầu các quyền Chrome tối thiểu cần thiết.
- Không lưu trữ cookie hay thông tin đăng nhập Shopee của người dùng.

### NFR-04: Khả năng bảo trì

- Code comment bằng tiếng Việt cho các hàm chính.
- Tên biến và hàm rõ ràng, mô tả chức năng.
- Không có `console.log` trong code đã commit (chỉ dùng khi phát triển).

---

## 6. Chỉ số thành công

> Lưu ý: Các chỉ số dưới đây là mục tiêu kỳ vọng, chưa được xác nhận bằng dữ liệu thực tế.

| Chỉ số | Mục tiêu (placeholder) |
|--------|------------------------|
| Thời gian phân tích 300 đánh giá | Dưới X giây (TBD sau khi đo thực tế) |
| Thời gian phân tích 1000 đánh giá | Dưới Y giây (TBD) |
| Tỷ lệ thành công trên URL hợp lệ | > 90% |
| Thời gian tải popup | Dưới 500ms |
| Kích thước extension (không nén) | Dưới 500KB |

---

## 7. Ngoài phạm vi MVP

Các tính năng sau **không** thuộc MVP và sẽ cân nhắc ở phiên bản sau:

- Xác thực người dùng (đăng nhập, tài khoản cá nhân)
- Hỗ trợ đa nền tảng TMĐT (Lazada, Tiki, Sendo, Amazon)
- Giám sát sản phẩm theo thời gian thực (theo dõi thay đổi đánh giá)
- Phân tích cảm xúc bằng LLM / AI (GPT, Gemini)
- Xuất sang định dạng `.xlsx` thực sự (yêu cầu thư viện như SheetJS)
- Giao diện quản lý lịch sử phân tích
- Chia sẻ kết quả lên mạng xã hội
- Hỗ trợ đa ngôn ngữ (ngoài tiếng Việt)
- Extension cho trình duyệt khác (Firefox, Edge — mặc dù MV3 có khả năng tương thích)

---

## 8. Câu hỏi mở và rủi ro kiến trúc

Các mục dưới đây là **rủi ro đã biết** và cần quyết định trước hoặc trong khi triển khai.

---

### Rủi ro 1: Anti-bot và Rate Limiting của Shopee

**Mức độ:** CAO  
**Mô tả:** Shopee áp dụng cơ chế chống bot tích cực. Việc gọi API liên tục để lấy 5000 đánh giá từ popup có thể bị chặn (HTTP 429 hoặc CAPTCHA).  
**Trạng thái:** **TBD** — cần kiểm tra thực tế tốc độ bị chặn và thiết kế cơ chế throttling phù hợp.  
**Hướng giảm thiểu tiềm năng:** Thêm delay giữa các request, dùng session cookie của người dùng qua content script.

---

### Rủi ro 2: Service Worker MV3 bị tắt sau ~30 giây

**Mức độ:** CAO  
**Mô tả:** Manifest V3 không cho phép background page thường trú. Service worker bị kill sau khoảng 30 giây không hoạt động. Các tác vụ scraping dài sẽ thất bại nếu chạy trong service worker.  
**Trạng thái:** **TBD** — kiến trúc cần tránh dựa vào service worker cho scraping. Xem [docs/system-architecture.md](system-architecture.md) để biết các phương án.  
**Hướng giảm thiểu tiềm năng:** Chạy scraping trong content script của tab đang mở, hoặc dùng `chrome.alarms` để giữ service worker hoạt động.

---

### Rủi ro 3: Quyền (Permissions) trong Spec chưa đủ

**Mức độ:** TRUNG BÌNH  
**Mô tả:** Spec hiện tại chỉ khai báo `"storage"` trong `permissions`. Để scraping thực sự hoạt động, extension rất có thể cần thêm: `"scripting"`, `"tabs"`, có thể `"alarms"`.  
**Trạng thái:** **TBD** — sẽ xác định danh sách permission chính xác sau khi chọn kiến trúc scraping.

---

### Rủi ro 4: "Phân tích" và "Khuyến nghị mua hàng" chưa được định nghĩa

**Mức độ:** TRUNG BÌNH  
**Mô tả:** Spec chưa xác định rõ "phân tích" có nghĩa là gì. Hai hướng chính:  
- **Phương án A (đơn giản):** Thống kê thuần túy — điểm TB, phân bố sao, từ khóa xuất hiện nhiều.  
- **Phương án B (nâng cao):** Phân tích cảm xúc (sentiment analysis) bằng LLM — yêu cầu API key bên ngoài, tăng độ phức tạp đáng kể.  
**Trạng thái:** **TBD** — MVP nên dùng Phương án A. Phương án B là tính năng tương lai.

---

### Rủi ro 5: Xuất Excel (.xlsx) không có thư viện là không khả thi

**Mức độ:** THẤP–TRUNG BÌNH  
**Mô tả:** File `.xlsx` thực sự là một archive ZIP chứa XML. Tạo ra không có thư viện như SheetJS/ExcelJS là rất phức tạp. CSV hoàn toàn khả thi với Vanilla JS.  
**Trạng thái:** **TBD** — Quyết định chính thức: xuất CSV tại MVP. Xuất `.xlsx` xem xét ở phiên bản sau với thư viện phù hợp.

---

*Xem thêm: [docs/system-architecture.md](system-architecture.md) | [docs/code-standards.md](code-standards.md) | [docs/codebase-summary.md](codebase-summary.md)*
