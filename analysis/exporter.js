/* ============================================================
   EXCEL EXPORTER (SheetJS Community)
   Lưu ý: bản Community KHÔNG ghi cell styling (background, bold).
   File output đẹp về cấu trúc/width/merge/freeze, nhưng KHÔNG có
   màu nền hay font nổi bật.

   Phụ thuộc:
   - XLSX (global từ lib/xlsx.full.min.js)
   - JunTechAnalyzer.{isEdited, starString, categoryLabel, getMediaCount, getCommentLen}
     (global từ analysis/analyzer.js)
   ============================================================ */

(function () {
  const A = window.JunTechAnalyzer;

  /* ---------- HELPERS ---------- */

  const pad2 = (n) => String(n).padStart(2, "0");

  /** Format dd/mm/yyyy HH:mm */
  function formatDateTime(d) {
    const x = d instanceof Date ? d : new Date(d);
    if (isNaN(x.getTime())) return "—";
    return `${pad2(x.getDate())}/${pad2(x.getMonth() + 1)}/${x.getFullYear()} ${pad2(x.getHours())}:${pad2(x.getMinutes())}`;
  }

  /** Format ngày từ unix seconds → dd/mm/yyyy (vi-VN locale) */
  function ctimeToDate(ct) {
    if (!Number.isFinite(ct)) return "—";
    try { return new Date(ct * 1000).toLocaleDateString("vi-VN"); } catch { return "—"; }
  }

  /** Filename: JunTech_{platformId}_{productId}_{yyyyMMdd_HHmm}.xlsx */
  function formatFilename(platformId, productId, d = new Date()) {
    const ts = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    return `JunTech_${platformId || "unknown"}_${productId || "unknown"}_${ts}.xlsx`;
  }

  const EXCEL_CELL_LIMIT = 32000;
  function truncateForCell(text, maxLen = EXCEL_CELL_LIMIT) {
    if (text == null) return "";
    const s = String(text);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen - 12) + "...[đã cắt]";
  }

  const safeUsername = (u) => (u && String(u).trim()) || "Ẩn danh";

  /** Variation/biến thể: thử nhiều field name khả dĩ. */
  function getVariation(r) {
    const items = r?.product_items || r?.tags || [];
    if (Array.isArray(items) && items.length > 0) {
      return items
        .map((t) => t?.model_name || t?.tag_name || t?.name || (typeof t === "string" ? t : ""))
        .filter(Boolean)
        .join(" / ") || "—";
    }
    return "—";
  }

  /** Sort review: có ảnh/video trước → comment dài hơn trước */
  function sortByMediaThenLength(reviews) {
    return [...reviews].sort((a, b) => {
      const am = A.getMediaCount(a) > 0 ? 1 : 0;
      const bm = A.getMediaCount(b) > 0 ? 1 : 0;
      if (am !== bm) return bm - am;
      return A.getCommentLen(b) - A.getCommentLen(a);
    });
  }

  /* ---------- SHEET BUILDERS ---------- */

  const aoa = (rows) => XLSX.utils.aoa_to_sheet(rows);
  const setCols = (ws, widths) => { ws["!cols"] = widths.map((w) => ({ wch: w })); };
  const setMerges = (ws, merges) => { if (merges?.length) ws["!merges"] = merges; };
  const freezeTopRow = (ws) => { ws["!freeze"] = { xSplit: 0, ySplit: 1 }; };

  /* ----- SHEET 1: Báo cáo tổng quan ----- */
  function buildOverviewSheet(data) {
    const { url, productInfo, stats, recommendation: rec, seeding, platform } = data;
    const rows = [];
    const merges = [];

    const pushSection = (title) => {
      rows.push([title, ""]);
      merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 1 } });
    };
    const pushRow = (k, v) => rows.push([k, v == null ? "—" : String(v)]);

    pushSection("THÔNG TIN SẢN PHẨM");
    pushRow("Sàn TMĐT", platform ? `${platform.icon} ${platform.name}` : "—");
    pushRow("URL", url || "—");
    pushRow("Tên sản phẩm", productInfo?.name || "—");
    pushRow("Ngày phân tích", formatDateTime(new Date()));
    pushRow("Tổng đánh giá phân tích", stats.total);

    pushSection("KHUYẾN NGHỊ");
    pushRow("KẾT LUẬN", rec.verdictLabel);
    pushRow("Điểm tin cậy", `${rec.score}/100`);
    pushRow("Mức độ tin cậy data", rec.trustScore.level);

    pushSection("ĐIỂM CHÍNH");
    pushRow("✅ Điểm tích cực", rec.pros.length ? rec.pros.join("\n") : "—");
    pushRow("❌ Điểm tiêu cực", rec.cons.length ? rec.cons.join("\n") : "—");
    pushRow("🚩 Cảnh báo", rec.redFlags.length ? rec.redFlags.join("\n") : "Không có");

    pushSection("THỐNG KÊ");
    pushRow("⭐ Điểm trung bình", stats.avgRating);
    pushRow("Phân bố 5 sao", `${stats.distribution[5]} (${stats.distributionPercent[5]}%)`);
    pushRow("Phân bố 4 sao", `${stats.distribution[4]} (${stats.distributionPercent[4]}%)`);
    pushRow("Phân bố 3 sao", `${stats.distribution[3]} (${stats.distributionPercent[3]}%)`);
    pushRow("Phân bố 2 sao ⚠️", `${stats.distribution[2]} (${stats.distributionPercent[2]}%)`);
    pushRow("Phân bố 1 sao ⚠️", `${stats.distribution[1]} (${stats.distributionPercent[1]}%)`);
    pushRow("Review chất lượng", `${stats.authenticReviews} (${stats.authenticPercent}%)`);
    pushRow("Review nghi auto-rate", `${stats.autoRatedReviews} (${stats.autoRatedPercent}%)`);
    pushRow("Có ảnh/video", `${stats.withMedia} (${stats.withMediaPercent}%)`);
    pushRow("Review tiêu cực 30 ngày", stats.recentNegativeCount);

    pushSection("NGHI NGỜ SEEDING");
    pushRow("Mức độ", seeding.suspicionLevel);
    pushRow("Dấu hiệu phát hiện", seeding.signals.length ? seeding.signals.join("\n") : "—");

    const safeRows = rows.map(([k, v]) => [truncateForCell(k), truncateForCell(v)]);
    const ws = aoa(safeRows);
    setCols(ws, [32, 60]);
    setMerges(ws, merges);
    return ws;
  }

  /* ----- SHEET 2: Vấn đề khách hàng ----- */
  function buildIssuesSheet(issues) {
    const headers = ["Nhóm vấn đề", "Số người phàn nàn", "Tỷ lệ trong review tiêu cực", "Mô tả", "Trích dẫn ví dụ"];
    const rows = [headers];
    if (!issues || issues.length === 0) {
      rows.push(["✅ Không phát hiện vấn đề nghiêm trọng nào", "", "", "", ""]);
    } else {
      for (const i of issues) {
        rows.push([
          truncateForCell(A.categoryLabel(i.key)),
          i.count, `${i.percent}%`,
          truncateForCell(i.label),
          truncateForCell((i.examples || []).map((e) => `• ${e}`).join("\n\n")),
        ]);
      }
    }
    const ws = aoa(rows);
    setCols(ws, [25, 18, 18, 35, 60]);
    freezeTopRow(ws);
    return ws;
  }

  /* ----- SHEET 3: Review 1-2 sao ----- */
  function buildNegativeSheet(stats) {
    const headers = ["STT", "Username", "Số sao", "Ngày", "Nội dung", "Số ảnh", "Có video", "Biến thể đã mua"];
    const rows = [headers];
    const sorted = sortByMediaThenLength(stats.negativeReviews || []);
    if (sorted.length === 0) {
      rows.push(["", "", "", "", "Không có review tiêu cực", "", "", ""]);
    } else {
      sorted.forEach((r, i) => {
        rows.push([
          i + 1,
          truncateForCell(safeUsername(r?.author_username)),
          A.starString(r?.rating_star),
          ctimeToDate(r?.ctime),
          truncateForCell(r?.comment || ""),
          r?.images?.length || 0,
          r?.videos?.length > 0 ? "Có" : "Không",
          truncateForCell(getVariation(r)),
        ]);
      });
    }
    const ws = aoa(rows);
    setCols(ws, [6, 18, 8, 12, 80, 8, 10, 30]);
    freezeTopRow(ws);
    return ws;
  }

  /* ----- SHEET 4: Tất cả review ----- */
  function buildAllReviewsSheet(reviews) {
    const headers = ["STT", "Username", "Số sao", "Ngày", "Nội dung", "Số ảnh", "Có video", "Đã chỉnh sửa", "Biến thể"];
    const rows = [headers];
    const sorted = [...(reviews || [])].sort((a, b) => (Number(b?.ctime) || 0) - (Number(a?.ctime) || 0));
    sorted.forEach((r, i) => {
      rows.push([
        i + 1,
        truncateForCell(safeUsername(r?.author_username)),
        A.starString(r?.rating_star),
        ctimeToDate(r?.ctime),
        truncateForCell(r?.comment || ""),
        r?.images?.length || 0,
        r?.videos?.length > 0 ? "Có" : "Không",
        A.isEdited(r) ? "Có" : "Không",
        truncateForCell(getVariation(r)),
      ]);
    });
    const ws = aoa(rows);
    setCols(ws, [6, 18, 8, 12, 80, 8, 10, 14, 30]);
    freezeTopRow(ws);
    return ws;
  }

  /* ----- SHEET 5: Phân bố sao ----- */
  function buildDistributionSheet(stats) {
    const labels = {
      5: "Rất hài lòng (lưu ý: có thể có seeding)",
      4: "Hài lòng",
      3: "Bình thường",
      2: "Không hài lòng",
      1: "Rất không hài lòng",
    };
    const rows = [["Số sao", "Số lượng", "Tỷ lệ %", "Đánh giá"]];
    for (const s of [5, 4, 3, 2, 1]) {
      rows.push([
        A.starString(s),
        stats.distribution[s] || 0,
        `${stats.distributionPercent[s] || 0}%`,
        labels[s],
      ]);
    }
    const ws = aoa(rows);
    setCols(ws, [10, 12, 12, 50]);
    freezeTopRow(ws);
    return ws;
  }

  /* ----- SHEET 6: Hướng dẫn đọc báo cáo ----- */
  function buildGuideSheet() {
    const lines = [
      "📌 CÁCH ĐỌC BÁO CÁO NÀY",
      "",
      "1. Bắt đầu từ Sheet 'Báo cáo tổng quan' - xem KẾT LUẬN và Cảnh báo.",
      "",
      "2. Xem Sheet 'Vấn đề khách hàng' - đây là CỐT LÕI. Các nhóm vấn đề được gom từ review 1-2 sao - là phản hồi THẬT từ người mua thật.",
      "",
      "3. Đọc Sheet 'Review 1-2 sao' để biết worst case khi mua sản phẩm này. Mẹo: review có ảnh/video luôn đáng tin hơn.",
      "",
      "4. ⚠️ LƯU Ý VỀ ĐIỂM TRUNG BÌNH:",
      "   - Sàn TMĐT có cơ chế tự đánh giá 5 sao nếu user không rate trong 7 ngày",
      "   - Shop có thể seeding (thuê người đánh giá ảo)",
      "   - Vì vậy điểm 4.8-5.0 KHÔNG đảm bảo sản phẩm tốt",
      "   - Hãy nhìn vào TỶ LỆ review chất lượng (authenticPercent) và SỐ review tiêu cực hơn là điểm TB",
      "",
      "5. Nếu mục 'Mức độ nghi seeding' là Medium/High → cẩn trọng hơn nữa.",
      "",
      "6. Báo cáo này được tạo bởi extension JunTech Review.",
    ];
    const ws = aoa(lines.map((l) => [l]));
    setCols(ws, [100]);
    return ws;
  }

  /* ---------- BUILD WORKBOOK + SAVE ---------- */

  function exportToExcel(data) {
    if (typeof XLSX === "undefined") {
      throw new Error("Thư viện SheetJS chưa load. Kiểm tra lib/xlsx.full.min.js.");
    }
    const wb = XLSX.utils.book_new();
    const sheets = [
      { name: "📋 Báo cáo tổng quan", ws: buildOverviewSheet(data) },
      { name: "⚠️ Vấn đề khách hàng",  ws: buildIssuesSheet(data.issues) },
      { name: "🔴 Review 1-2 sao",     ws: buildNegativeSheet(data.stats) },
      { name: "📝 Tất cả review",      ws: buildAllReviewsSheet(data.reviews) },
      { name: "📊 Phân bố sao",        ws: buildDistributionSheet(data.stats) },
      { name: "ℹ️ Hướng dẫn",         ws: buildGuideSheet() },
    ];
    for (const s of sheets) XLSX.utils.book_append_sheet(wb, s.ws, s.name);

    const platformId = data.platform?.id || "unknown";
    const productId = data.productId || data.itemid || "unknown";
    const filename = formatFilename(platformId, productId);
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /* ---------- EXPORT ra global ---------- */

  window.JunTechExporter = {
    exportToExcel,
    formatFilename,
    formatDateTime,
    ctimeToDate,
    getVariation,
    sortByMediaThenLength,
  };
})();
