# Phase 01: UI Shell

**Date:** 2026-04-19
**Priority:** P0 (blocker cho các phase sau)
**Status:** in_progress

## Context
- [docs/project-overview-pdr.md](../../docs/project-overview-pdr.md)
- [docs/system-architecture.md](../../docs/system-architecture.md)
- [docs/code-standards.md](../../docs/code-standards.md)

## Overview
Tạo 5 file boilerplate vanilla JS/HTML/CSS cho extension. Load được vào Chrome ngay, không có business logic.

## Key Insights
- Vanilla, không bundler, không npm install.
- `permissions: ["storage"]` ở MVP shell là đủ; sẽ bổ sung `scripting`/`tabs` ở Phase 2 khi có scraping.
- Icons để placeholder (không tạo file PNG; user tự thêm).

## Requirements
| ID | Mô tả |
|---|---|
| R1 | Extension load không lỗi khi `Load unpacked` |
| R2 | Popup mở ra rộng 420px, hiển thị đầy đủ component |
| R3 | Click nút "Phân tích ngay" → `console.log(url)` (placeholder) |
| R4 | Click nút "Ủng hộ tác giả" → `alert("Sẽ thêm ở prompt sau")` |
| R5 | Helpers `showError/hideError/showLoading/hideLoading` định nghĩa sẵn |

## Architecture
Flat root:
```
manifest.json
popup.html
popup.js
styles.css
README.md
icons/  (chưa tạo, user thêm sau)
```

## Implementation Steps
1. `manifest.json` — MV3, đúng spec.
2. `popup.html` — markup + link CSS + script.
3. `styles.css` — CSS variables cho theme, layout 420px.
4. `popup.js` — helpers + 2 event listeners placeholder.
5. `README.md` — load instructions + folder structure.
6. Verify: `ls` toàn bộ file, đọc lại để đảm bảo syntax.

## Todo
- [ ] manifest.json
- [ ] popup.html
- [ ] styles.css
- [ ] popup.js
- [ ] README.md (overwrite từ docs:init nếu cần)
- [ ] Verify

## Success Criteria
- 5 file tồn tại đúng vị trí.
- Không file nào tham chiếu lib bên ngoài.
- HTML không syntax lỗi (parse OK).
- JS không reference DOM id không tồn tại.

## Risks
- **Manifest icon paths**: nếu khai báo icon trỏ tới file không tồn tại, Chrome sẽ cảnh báo (nhưng vẫn load). Giải pháp: tạm bỏ field `icons` trong action hoặc giữ nguyên + ghi chú user phải thêm.
- **Quyết định**: KHÔNG khai báo `icons` field nếu chưa có file → tránh warning. User thêm sau.

## Security
- Không có user input nào được eval/inject HTML thô — `textarea.value` chỉ log.
- Không có external network call ở phase này.

## Next steps
Sau khi Phase 1 done → user verify load OK trên Chrome → resolve 5 TBDs → start Phase 2.
