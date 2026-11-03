from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

SHOPEE_FORM_HEADER_REGEX = re.compile(
    r"(?im)^(kinh nghiệm sử dụng|mẹo|bao bì/mẫu mã|bao bì|mẫu mã|hương thơm|mùi hương|"
    r"dành cho da|tác dụng|công dụng|kết cấu|độ thẩm thấu|độ bền màu|màu sắc|"
    r"chất liệu|đúng với mô tả|tính năng nổi bật|chất lượng sản phẩm|công dụng chính|"
    r"độ che phủ|phù hợp với loại da|hiệu quả sử dụng)\s*:\s*"
)

COIN_FARM_WORDS = [
    r"nhận\s*xu",
    r"kiếm\s*xu",
    r"lấy\s*xu",
    r"cày\s*xu",
    r"đủ\s*ký\s*tự",
    r"tính\s*chất\s*minh\s*họa",
    r"mang\s*tính\s*chất",
    r"công\s*cha\s*như\s*núi",
    r"trăm\s*năm\s*trong\s*cõi",
    r"cách\s*nấu\s*",
]

HYPE_WORDS = [
    r"tuyệt\s*vời",
    r"đỉnh\s*của\s*chóp",
    r"siêu\s*phẩm",
    r"thần\s*tốc",
    r"nhanh\s*như\s*chớp",
    r"đáng\s*đồng\s*tiền",
    r"không\s*có\s*gì\s*để\s*chê",
    r"uy\s*tín\s*số\s*1",
    r"ủng\s*hộ\s*dài\s*dài",
    r"100%\s*chính\s*hãng",
]

NEGATIVE_WORDS = [
    r"thất\s*vọng",
    r"kém",
    r"tệ",
    r"lỗi",
    r"hỏng",
    r"vỡ",
    r"móp",
    r"giả",
    r"fake",
    r"thiếu",
    r"nhầm",
    r"giao\s*sai",
    r"chậm",
    r"hắc",
    r"dị\s*ứng",
    r"không\s*giống",
]

FEATURE_LABELS_VI: Dict[str, str] = {
    "nlp_char_length": "Độ dài bình luận tự do (ký tự)",
    "nlp_word_count": "Số lượng từ trong bình luận",
    "nlp_lexical_diversity": "Độ đa dạng từ vựng (TTR)",
    "nlp_char_entropy": "Entropy thông tin ký tự (Shannon)",
    "nlp_exclamation_count": "Số dấu cảm thán (!)",
    "nlp_max_cosine_sim": "Độ trùng lặp văn mẫu (Cosine TF-IDF)",
    "nlp_coin_farm_score": "Mật độ từ khóa cày xu Shopee",
    "nlp_seeding_hype_score": "Mật độ từ ngữ quảng cáo quá đà",
    "nlp_negative_word_count": "Số từ ngữ phàn nàn tiêu cực",
    "nlp_svd_0": "Thành phần ngữ nghĩa SVD #1",
    "nlp_svd_1": "Thành phần ngữ nghĩa SVD #2",
    "nlp_svd_2": "Thành phần ngữ nghĩa SVD #3",
    "temp_reviews_in_15m": "Mật độ đánh giá 5★ trong 15 phút",
    "temp_burst_zscore": "Điểm đột biến đánh giá theo giờ (Z-Score)",
    "temp_inter_arrival_log_sec": "Khoảng cách thời gian giữa 2 đánh giá (log)",
    "beh_rating_star": "Điểm sao đánh giá (1–5★)",
    "beh_rating_deviation": "Độ lệch điểm sao so với trung vị",
    "beh_has_media": "Có đính kèm hình ảnh / video",
    "beh_helpful_votes": "Số lượt bình chọn hữu ích (like_count)",
    "beh_is_repeated_purchase": "Trạng thái khách mua lặp lại",
}


def _shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    counts = Counter(text)
    total = len(text)
    return float(-sum((c / total) * math.log2(c / total) for c in counts.values()))


def _strip_shopee_form(text: str) -> str:
    return SHOPEE_FORM_HEADER_REGEX.sub(" ", str(text or "")).strip()


class FeatureEngine:
    """Clean, transparent 20-feature extractor for real Vietnamese Shopee reviews."""

    def __init__(self, n_svd_components: int = 3):
        self.n_svd_components = n_svd_components
        self.tfidf = TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=1200,
            sublinear_tf=True,
            min_df=2,
        )
        self.svd = TruncatedSVD(n_components=n_svd_components, random_state=42)
        self.is_fitted = False

    def _compute_group_cosine(self, free_texts: List[str], group_keys: np.ndarray) -> np.ndarray:
        n = len(free_texts)
        max_cos = np.zeros(n, dtype=np.float64)
        df_tmp = pd.DataFrame({"grp": group_keys, "idx": np.arange(n)})
        for _, g in df_tmp.groupby("grp"):
            idxs = g["idx"].to_numpy()
            valid = [i for i in idxs if len(free_texts[i]) >= 20]
            if len(valid) >= 2:
                try:
                    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, max_features=2000)
                    mat = vec.fit_transform([free_texts[i].lower() for i in valid])
                    sim = cosine_similarity(mat)
                    np.fill_diagonal(sim, 0.0)
                    mv = sim.max(axis=1)
                    for k, orig_i in enumerate(valid):
                        max_cos[orig_i] = float(mv[k])
                except Exception:
                    pass
        return max_cos

    def _extract_core(self, df: pd.DataFrame, fit_text: bool = False) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        n = len(df)
        comments_raw = [str(c or "") for c in df["comment"].tolist()]
        free_texts = [_strip_shopee_form(c) for c in comments_raw]
        free_lower = [t.lower() for t in free_texts]

        # 1. TF-IDF + Truncated SVD (fit ONLY on training data)
        if fit_text:
            tfidf_mat = self.tfidf.fit_transform(free_lower)
            if tfidf_mat.shape[1] >= self.n_svd_components + 1:
                svd_feats = self.svd.fit_transform(tfidf_mat)
            else:
                svd_feats = np.zeros((n, self.n_svd_components), dtype=np.float64)
            self.is_fitted = True
        else:
            if self.is_fitted:
                tfidf_mat = self.tfidf.transform(free_lower)
                svd_feats = self.svd.transform(tfidf_mat)
            else:
                svd_feats = np.zeros((n, self.n_svd_components), dtype=np.float64)

        group_col = "shop_id" if "shop_id" in df.columns else "product_id"
        group_keys = df[group_col].astype(str).to_numpy()
        max_cos = self._compute_group_cosine(free_texts, group_keys)

        # 2. Temporal features
        if "ctime" in df.columns:
            ts_sec = pd.to_numeric(df["ctime"], errors="coerce").fillna(0).to_numpy(dtype=np.float64)
        else:
            dt_ser = pd.to_datetime(df["timestamp"], errors="coerce")
            ts_sec = (dt_ser.astype("int64") // 10**9).fillna(0).to_numpy(dtype=np.float64)

        ratings = pd.to_numeric(df["rating"], errors="coerce").fillna(5).to_numpy(dtype=np.float64)
        reviews_15m = np.zeros(n, dtype=np.float64)
        burst_z = np.zeros(n, dtype=np.float64)
        inter_log = np.zeros(n, dtype=np.float64)
        rating_dev = np.zeros(n, dtype=np.float64)

        df_idx = pd.DataFrame({"grp": group_keys, "idx": np.arange(n)})
        for _, g in df_idx.groupby("grp"):
            idxs = g["idx"].to_numpy()
            t_g = ts_sec[idxs]
            r_g = ratings[idxs]
            med_r = float(np.median(r_g)) if len(r_g) else 5.0
            rating_dev[idxs] = np.abs(r_g - med_r)

            hours = (t_g // 3600).astype(np.int64)
            h_counts = Counter(hours.tolist())
            vals = np.array(list(h_counts.values()), dtype=np.float64)
            mu_h = float(np.mean(vals)) if len(vals) else 1.0
            sd_h = float(np.std(vals)) if len(vals) else 0.0

            order = np.argsort(t_g)
            t_sorted = t_g[order]
            gaps = np.diff(t_sorted, prepend=t_sorted[0] - 3600.0)
            gaps = np.maximum(0.0, gaps)
            for pos, orig_pos in enumerate(order):
                inter_log[idxs[orig_pos]] = math.log1p(float(gaps[pos]))

            for k, orig_i in enumerate(idxs):
                if t_g[k] > 0:
                    cnt15 = int(np.sum((np.abs(t_g - t_g[k]) <= 900.0) & (r_g == 5))) - (1 if r_g[k] == 5 else 0)
                    reviews_15m[orig_i] = float(max(0, cnt15))
                    burst_z[orig_i] = (h_counts[hours[k]] - mu_h) / (sd_h + 0.8)

        # 3. Assemble 20 clean features
        feat_rows: List[Dict[str, float]] = []
        has_media_arr = pd.to_numeric(df.get("has_media", 0), errors="coerce").fillna(0).to_numpy(dtype=np.float64)
        votes_arr = pd.to_numeric(df.get("helpful_votes", 0), errors="coerce").fillna(0).to_numpy(dtype=np.float64)
        rep_arr = pd.to_numeric(df.get("is_repeated_purchase", 0), errors="coerce").fillna(0).to_numpy(dtype=np.float64)

        for i in range(n):
            ft = free_texts[i]
            fl = free_lower[i]
            words = [w for w in re.split(r"\s+", fl) if w]
            n_words = len(words)
            ttr = len(set(words)) / max(1, n_words)
            ent = _shannon_entropy(fl)
            excl = float(ft.count("!"))
            coin_hits = float(sum(1 for pat in COIN_FARM_WORDS if re.search(pat, fl)))
            hype_hits = float(sum(1 for pat in HYPE_WORDS if re.search(pat, fl)))
            neg_hits = float(sum(1 for pat in NEGATIVE_WORDS if re.search(pat, fl)))

            row_d: Dict[str, float] = {
                "nlp_char_length": float(len(ft)),
                "nlp_word_count": float(n_words),
                "nlp_lexical_diversity": float(ttr),
                "nlp_char_entropy": float(ent),
                "nlp_exclamation_count": excl,
                "nlp_max_cosine_sim": float(max_cos[i]),
                "nlp_coin_farm_score": coin_hits,
                "nlp_seeding_hype_score": hype_hits,
                "nlp_negative_word_count": neg_hits,
                "nlp_svd_0": float(svd_feats[i, 0]) if self.n_svd_components > 0 else 0.0,
                "nlp_svd_1": float(svd_feats[i, 1]) if self.n_svd_components > 1 else 0.0,
                "nlp_svd_2": float(svd_feats[i, 2]) if self.n_svd_components > 2 else 0.0,
                "temp_reviews_in_15m": float(reviews_15m[i]),
                "temp_burst_zscore": float(burst_z[i]),
                "temp_inter_arrival_log_sec": float(inter_log[i]),
                "beh_rating_star": float(ratings[i]),
                "beh_rating_deviation": float(rating_dev[i]),
                "beh_has_media": float(has_media_arr[i]),
                "beh_helpful_votes": float(votes_arr[i]),
                "beh_is_repeated_purchase": float(rep_arr[i]),
            }
            feat_rows.append(row_d)

        X_df = pd.DataFrame(feat_rows)

        # Lightweight aux payload for UI visualization (burst series & simple duplicate links)
        aux = {
            "graph_nodes": [],
            "graph_edges": [],
            "graph_stats": {"num_nodes": n, "num_edges": 0, "num_clusters": 0, "modularity": 0.0},
        }
        return X_df, aux

    def fit_transform(self, df: pd.DataFrame, y: Optional[np.ndarray] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        return self._extract_core(df, fit_text=True)

    def transform(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        return self._extract_core(df, fit_text=False)
