/* ============================================================
   ANALYZER — phân tích review (platform-agnostic).
   Vai trò:
   - Định nghĩa ISSUE_CATEGORIES + helpers chuẩn (getMediaCount,
     isEdited, getCommentLen, categoryLabel, starString).
   - 4 hàm chính: analyzeReviews, extractIssues, detectSeeding,
     getRecommendation.
   Tất cả thuần data, KHÔNG dùng DOM/chrome.* APIs.
   ============================================================ */

(function () {
  /* ---------- CONSTANTS ---------- */

  const ISSUE_CATEGORIES = {
    QUALITY: {
      label: "Chất lượng kém", icon: "🔧",
      keywords: ["kém","tệ","dỏm","rởm","xấu","mỏng","rách","hỏng","bể","gãy","bong tróc","phai màu","ố","lỗi","mòn","sờn"],
    },
    FAKE: {
      label: "Hàng giả/khác mô tả", icon: "🎭",
      keywords: ["fake","giả","không giống","khác hình","khác mô tả","lừa","lừa đảo","sai sản phẩm","không đúng","không như","khác quảng cáo"],
    },
    SIZE: {
      label: "Sai size/kích thước", icon: "📏",
      keywords: ["sai size","nhỏ hơn","to hơn","không vừa","chật","rộng","ngắn","dài quá","không đúng size","size sai"],
    },
    SHIPPING: {
      label: "Giao hàng/đóng gói", icon: "📦",
      keywords: ["giao chậm","lâu","mãi không","thiếu hàng","rách hộp","móp","đóng gói","bị bóp","ướt","bể","không có bill"],
    },
    SERVICE: {
      label: "Dịch vụ shop", icon: "🤝",
      keywords: ["shop tệ","thái độ","không trả lời","không phản hồi","block","không đổi trả","không hỗ trợ"],
    },
    SMELL: {
      label: "Mùi khó chịu", icon: "🌬️",
      keywords: ["hôi","mùi lạ","mùi hắc","khó chịu","mùi hóa chất"],
    },
  };

  const GENERIC_FIVE_STAR_WORDS = ["ok","tốt","đẹp","good","nice","👍","❤️"];

  const CATEGORY_LABEL_VI = {
    QUALITY: "Chất lượng kém",
    FAKE: "Hàng giả / Không giống mô tả",
    SIZE: "Sai size / Kích thước",
    SHIPPING: "Vấn đề giao hàng & đóng gói",
    SERVICE: "Thái độ shop kém",
    SMELL: "Mùi khó chịu",
  };

  /* ---------- HELPERS (review-level) ---------- */

  const getMediaCount = (r) => (r?.images?.length || 0) + (r?.videos?.length || 0);
  const isEdited = (r) => r?.mtime && r?.ctime && r.mtime > r.ctime + 60;
  const getCommentLen = (r) => (r?.comment || "").trim().length;
  const categoryLabel = (key) => CATEGORY_LABEL_VI[key] || key;
  const starString = (num) => {
    const n = Math.max(0, Math.min(5, Number(num) || 0));
    return "⭐".repeat(n);
  };

  /* ---------- analyzeReviews ---------- */

  function analyzeReviews(reviews) {
    const total = reviews.length;
    const empty = {
      total, avgRating: 0,
      distribution: { 1:0, 2:0, 3:0, 4:0, 5:0 },
      distributionPercent: { 1:0, 2:0, 3:0, 4:0, 5:0 },
      authenticReviews: 0, authenticPercent: 0,
      autoRatedReviews: 0, autoRatedPercent: 0,
      negativeReviews: [], negativeCount: 0, negativePercent: 0, negativeWithMedia: 0,
      detailedPositive: 0,
      recentNegativeCount: 0,
      avgCommentLength: 0, withMedia: 0, withMediaPercent: 0,
    };
    if (total === 0) return empty;

    const distribution = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    let sumStar = 0, authenticReviews = 0, autoRatedReviews = 0;
    let withMedia = 0, sumLen = 0, detailedPositive = 0;
    const negativeReviews = [];
    let negativeWithMedia = 0;
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    let recentNegativeCount = 0;

    for (const r of reviews) {
      const star = Number(r?.rating_star) || 0;
      if (star >= 1 && star <= 5) {
        distribution[star]++;
        sumStar += star;
      }
      const len = getCommentLen(r);
      sumLen += len;
      const media = getMediaCount(r);
      if (media > 0) withMedia++;

      if (len >= 20 || media > 0 || isEdited(r)) authenticReviews++;
      if (star === 5 && len < 5 && media === 0) autoRatedReviews++;

      if (star === 1 || star === 2) {
        negativeReviews.push(r);
        if (media > 0) negativeWithMedia++;
        if (Number(r?.ctime) > thirtyDaysAgo) recentNegativeCount++;
      }

      if ((star === 4 || star === 5) && len >= 30 && media > 0) detailedPositive++;
    }

    const pct = (n) => total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
    return {
      total,
      avgRating: Math.round((sumStar / total) * 10) / 10,
      distribution,
      distributionPercent: {
        1: pct(distribution[1]), 2: pct(distribution[2]), 3: pct(distribution[3]),
        4: pct(distribution[4]), 5: pct(distribution[5]),
      },
      authenticReviews, authenticPercent: pct(authenticReviews),
      autoRatedReviews, autoRatedPercent: pct(autoRatedReviews),
      negativeReviews,
      negativeCount: negativeReviews.length,
      negativePercent: pct(negativeReviews.length),
      negativeWithMedia,
      detailedPositive,
      recentNegativeCount,
      avgCommentLength: Math.round(sumLen / total),
      withMedia,
      withMediaPercent: pct(withMedia),
    };
  }

  /* ---------- extractIssues ---------- */

  function extractIssues(negativeReviews) {
    const result = {};
    for (const [key, def] of Object.entries(ISSUE_CATEGORIES)) {
      const matched = [];
      for (const r of negativeReviews) {
        const c = (r?.comment || "").toLowerCase();
        if (!c) continue;
        if (def.keywords.some((kw) => c.includes(kw.toLowerCase()))) {
          matched.push({ quote: r.comment.trim(), len: r.comment.trim().length });
        }
      }
      if (matched.length === 0) continue;
      const examples = matched.slice().sort((a, b) => a.len - b.len).slice(0, 3).map((x) => x.quote);
      result[key] = {
        key, label: def.label, icon: def.icon,
        count: matched.length,
        percent: negativeReviews.length > 0 ? Math.round((matched.length / negativeReviews.length) * 1000) / 10 : 0,
        examples,
      };
    }
    return Object.values(result).sort((a, b) => b.count - a.count);
  }

  /* ---------- detectSeeding ---------- */

  function detectSeeding(reviews, stats) {
    const signals = [];

    if (stats.autoRatedPercent > 60) {
      signals.push("Hơn 60% review 5 sao không có nội dung (auto-rating).");
    }
    if (stats.distributionPercent[5] > 95 && stats.authenticPercent < 30) {
      signals.push("Tỷ lệ 5 sao bất thường (>95%) nhưng review chất lượng rất ít.");
    }

    const fiveStars = reviews.filter((r) => Number(r?.rating_star) === 5);
    const genericCount = fiveStars.filter((r) => {
      const t = (r?.comment || "").trim().toLowerCase();
      return GENERIC_FIVE_STAR_WORDS.includes(t);
    }).length;
    if (fiveStars.length >= 10 && genericCount / fiveStars.length > 0.4) {
      signals.push(`Phát hiện ${genericCount} review 5 sao chỉ có 1 từ chung chung (ok/tốt/đẹp...).`);
    }

    if (fiveStars.length >= 50) {
      const byDay = {};
      for (const r of fiveStars) {
        if (!Number.isFinite(r?.ctime)) continue;
        const day = new Date(r.ctime * 1000).toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
      }
      const max = Math.max(0, ...Object.values(byDay));
      if (max / fiveStars.length > 0.3) {
        signals.push("Có nhiều review 5 sao dồn vào cùng 1 ngày bất thường.");
      }
    }

    if (stats.withMediaPercent < 5 && stats.total >= 50) {
      signals.push("Rất ít review có hình ảnh chứng minh (<5%).");
    }

    let suspicionLevel = "low";
    if (signals.length === 2) suspicionLevel = "medium";
    if (signals.length >= 3) suspicionLevel = "high";
    return { suspicionLevel, signals };
  }

  /* ---------- getRecommendation ---------- */

  function getRecommendation(stats, issuesArr, seeding) {
    let score = 50;
    const pros = [], cons = [], redFlags = [];

    if (stats.authenticPercent >= 50) {
      score += 15;
      pros.push(`${stats.authenticPercent}% review có chất lượng (comment dài / có ảnh / đã sửa).`);
    }
    if (stats.withMediaPercent >= 25) {
      score += 15;
      pros.push(`${stats.withMediaPercent}% review có ảnh/video — bằng chứng thật.`);
    }
    if (stats.detailedPositive >= 20) {
      score += 10;
      pros.push(`Có ${stats.detailedPositive} review tích cực chi tiết (4-5★, comment dài, có ảnh).`);
    }
    if (stats.total >= 500) {
      score += 10;
      pros.push(`Mẫu lớn (${stats.total} review) — đánh giá đáng tin.`);
    }
    if (stats.recentNegativeCount === 0 && stats.total > 50) {
      score += 5;
      pros.push("30 ngày gần đây không có review tiêu cực mới.");
    }

    if (stats.negativePercent > 5) {
      score -= 10;
      cons.push(`${stats.negativePercent}% review tiêu cực (1-2★).`);
    }
    if (stats.negativePercent > 10) score -= 15;
    if (stats.negativePercent > 20) {
      score -= 20;
      cons.push("Tỷ lệ tiêu cực vượt ngưỡng nguy hiểm (>20%).");
    }
    if (stats.recentNegativeCount >= 5) {
      score -= 15;
      redFlags.push(`Có ${stats.recentNegativeCount} review tiêu cực trong 30 ngày qua — vấn đề ĐANG xảy ra.`);
    }
    if (stats.recentNegativeCount >= 10) score -= 10;

    if (seeding.suspicionLevel === "medium") {
      score -= 10;
      redFlags.push("Có dấu hiệu seeding mức trung bình.");
    }
    if (seeding.suspicionLevel === "high") {
      score -= 25;
      redFlags.push("CẢNH BÁO: nhiều dấu hiệu seeding nghiêm trọng — review có thể không phản ánh thật.");
    }

    for (const iss of issuesArr) {
      if (iss.percent > 15) {
        score -= 10;
        cons.push(`${iss.percent}% review tiêu cực phàn nàn về ${iss.label.toLowerCase()}.`);
      }
    }
    if (stats.negativeWithMedia >= 5) {
      score -= 10;
      cons.push(`${stats.negativeWithMedia} review tiêu cực có ảnh/video chứng minh lỗi thật.`);
    }

    score = Math.max(0, Math.min(100, score));

    let verdict, verdictLabel, verdictColor;
    if (score >= 70) { verdict = "NEN_MUA"; verdictLabel = "✅ Nên mua"; verdictColor = "#1f9d55"; }
    else if (score >= 40) { verdict = "CAN_NHAC"; verdictLabel = "⚠️ Cân nhắc"; verdictColor = "#d97706"; }
    else { verdict = "KHONG_NEN"; verdictLabel = "🛑 Không nên mua"; verdictColor = "#dc2626"; }

    let trustLevel = "high", trustReason = "Đủ mẫu, nhiều bằng chứng.";
    if (stats.total < 50) {
      trustLevel = "low";
      trustReason = `Mẫu nhỏ (${stats.total} review) — kết quả tham khảo.`;
    } else if (stats.authenticPercent < 30 || seeding.suspicionLevel !== "low") {
      trustLevel = "medium";
      trustReason = "Nhiều review chất lượng thấp hoặc có dấu hiệu seeding.";
    }

    return {
      verdict, verdictLabel, verdictColor, score,
      pros, cons, redFlags,
      topIssues: issuesArr.slice(0, 3),
      trustScore: { level: trustLevel, reason: trustReason },
    };
  }

  /* ---------- EXPORT ra global ---------- */

  window.JunTechAnalyzer = {
    ISSUE_CATEGORIES,
    GENERIC_FIVE_STAR_WORDS,
    CATEGORY_LABEL_VI,
    getMediaCount,
    isEdited,
    getCommentLen,
    categoryLabel,
    starString,
    analyzeReviews,
    extractIssues,
    detectSeeding,
    getRecommendation,
  };
})();
