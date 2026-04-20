# Plan: MVP UI Shell (boilerplate)

**Created:** 2026-04-19 23:16
**Scope:** Tạo 5 file boilerplate cho Chrome Extension JunTech Review (UI shell only, chưa có scraping logic).
**Status:** in_progress

## Phạm vi
Chỉ tạo skeleton — không implement scraping, không implement analyzer, không implement export. Các phần đó cần resolve 5 TBDs ở [docs/project-overview-pdr.md](../../docs/project-overview-pdr.md) trước.

## Phases

| # | Phase | Status | Output |
|---|---|---|---|
| 1 | Manifest + UI shell | in_progress | manifest.json, popup.html, styles.css, popup.js, README.md |

→ Chi tiết: [phase-01-ui-shell.md](phase-01-ui-shell.md)

## Phases tiếp theo (chưa bắt đầu)
- Phase 2: Scraping engine (cần resolve TBD#1, #2, #5 trước)
- Phase 3: Analyzer (cần resolve TBD#3)
- Phase 4: Export (cần resolve TBD#4)

## Decisions deferred (gating Phase 2+)
1. Scraping arch: Popup fetch / Content script / Backend proxy — **chưa quyết**
2. Permission set thực tế ngoài `storage` — **chưa quyết**
3. "Phân tích" định nghĩa cụ thể — **chưa quyết**
4. CSV vs XLSX — **chưa quyết**
5. Rate limit thực tế của Shopee — **chưa test**
