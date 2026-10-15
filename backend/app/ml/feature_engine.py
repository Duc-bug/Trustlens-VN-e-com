"""
Feature Engineering Pipeline for TrustLens VN (`feature_engine.py`).
Extracts 3 complementary groups of features (39 total features):
  1. Vietnamese NLP & Semantic Embeddings (TF-IDF n-grams + TruncatedSVD + Shannon Character Entropy
     + Clause Burstiness + Sentiment-Rating Mismatch + Linguistic Seeding/Coin-Farm/AI Indicators)
  2. Temporal Burstiness Dynamics (15-min Sliding Window Density, Burst Z-Score, Inter-arrival Delta)
  3. Behavioral & Graph Topological Features (NetworkX PageRank, Centrality, K-Core Decomposition,
     Louvain Modularity Q, and Supervised 2-Layer GAT Message Passing Embeddings)
"""

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

from app.ml.graph_model import BehavioralGraphEngine

# Vietnamese Seeding, Coin-Farming, and AI-Template Lexicons
SEEDING_HYPE_PATTERNS = [
    r"đỉnh của chóp",
    r"vượt mong đợi",
    r"giao hàng thần tốc",
    r"nhanh như chớp",
    r"ủng hộ shop dài dài",
    r"5 sao uy tín",
    r"chốt đơn ngay",
    r"đáng đồng tiền bát gạo",
    r"không có gì để chê",
    r"hoàn toàn hài lòng 100%",
    r"uy tín số 1",
    r"đẳng cấp 5 sao",
    r"siêu phẩm",
]

COIN_FARM_PATTERNS = [
    r"mang tính chất nhận xu",
    r"mang tính chất kiếm xu",
    r"mang tính chất minh họa",
    r"chỉ mang tính chất",
    r"hình ảnh mang tính chất",
    r"video mang tính chất",
    r"đủ 50 ký tự",
    r"đủ 200 ký tự",
    r"đủ ký tự",
    r"nhận 200 xu",
    r"nhận 100 xu",
    r"200 xu",
    r"lấy xu",
    r"kiếm xu",
    r"nhận xu",
    r"cày xu",
    r"công cha như núi thái sơn",
    r"trăm năm trong cõi người ta",
    r"cách nấu thịt kho tàu",
    r"chưa dùng nên chưa biết",
    r"chưa mở ra xem",
    r"quý khách đã đăng ký",
    r"gói cước gia hạn",
    r"soạn huy gửi",
    r"viettel\.vn",
    r"tv360\.vn",
]

SHOPEE_FORM_HEADER_REGEX = re.compile(
    r"(?i)(chất lượng sản phẩm|đúng với mô tả|kinh nghiệm sử dụng|tính năng nổi bật|"
    r"mùi hương|hương thơm|hương vị|bao bì/mẫu mã|bao bì|màu sắc|khả năng lên màu|"
    r"độ che phủ|độ bóng|dành cho da|công dụng|độ bền|kết cấu|mẹo)\s*:\s*"
)

AI_TEMPLATE_PATTERNS = [
    r"người tiêu dùng thông thái",
    r"giải pháp tối ưu nâng tầm",
    r"bảng thành phần ưu việt",
    r"thiết kế công thái học",
    r"khoản đầu tư xứng đáng",
    r"không thể phủ nhận sức hút",
    r"tái tạo làn da từ sâu bên trong",
    r"hiệu quả vượt trội chỉ sau",
]

AUTHENTIC_DETAIL_PATTERNS = [
    r"nhưng",
    r"tuy nhiên",
    r"điểm trừ",
    r"hơi lâu",
    r"móp góc",
    r"dùng thử",
    r"đã dùng được",
    r"tầm giá",
    r"ổn áp",
    r"tạm ổn",
    r"giao sai",
    r"thất vọng",
    r"thấm nhanh",
    r"dưỡng ẩm",
    r"mùi thơm",
    r"chính hãng",
    r"mềm môi",
    r"cấp ẩm",
]

NEGATIVE_COMPLAINT_PATTERNS = [
    r"kém",
    r"tệ",
    r"hỏng",
    r"lỗi",
    r"rách",
    r"vỡ",
    r"không giống",
    r"lừa đảo",
    r"phí tiền",
    r"chậm",
]

FEATURE_LABELS_VI: Dict[str, str] = {
    "nlp_max_cosine_sim": "Độ trùng lặp văn mẫu (Cosine Similarity)",
    "temp_reviews_in_15m": "Mật độ dồn đơn khung 15 phút (Time-Burst)",
    "graph_neighbor_suspect_score": "Điểm bất thường cụm lân cận (Supervised GAT Score)",
    "graph_degree_centrality": "Bậc liên kết đồ thị hành vi (Degree Centrality)",
    "graph_kcore_number": "Bậc lõi cấu kết chặt nhất (K-Core Decomposition)",
    "graph_community_modularity": "Độ phân tách cộng đồng Seeding (Modularity Q)",
    "nlp_coin_farm_score": "Chỉ số văn mẫu 'Cày Xu' / Spam ký tự",
    "nlp_seeding_hype_score": "Mật độ từ khóa tâng bốc / Seeding quá đà",
    "nlp_char_entropy": "Entropy thông tin ký tự (Shannon Entropy)",
    "nlp_sentiment_rating_mismatch": "Độ lệch Cảm xúc văn bản & Điểm sao",
    "nlp_sentence_burstiness": "Độ biến thiên cấu trúc câu (AI vs Người thật)",
    "beh_user_review_velocity": "Tốc độ cày đánh giá / Tuổi tài khoản",
    "temp_burst_zscore": "Độ lệch chuẩn đột biến theo giờ (Burst Z-Score)",
    "graph_shared_ip_links": "Số liên kết trùng Thiết bị / Cụm IP",
    "graph_pagerank": "Trọng số lan truyền đồ thị (PageRank)",
    "nlp_ai_formality_score": "Chỉ số văn phong quảng cáo AI / LLM",
    "beh_account_age_days": "Tuổi đời tài khoản (Ngày)",
    "graph_cluster_size": "Quy mô cụm tài khoản Seeding liên thông",
    "beh_verified_purchase": "Xác thực đã mua hàng (Verified Purchase)",
    "nlp_lexical_diversity": "Độ đa dạng từ vựng (Lexical TTR)",
    "nlp_authentic_nuance_score": "Mức độ chi tiết trải nghiệm thực tế",
    "temp_inter_arrival_log_sec": "Khoảng cách thời gian giữa 2 đánh giá liên tiếp",
    "graph_clustering_coeff": "Hệ số cụm tam giác đồ thị (Clustering Coeff)",
    "graph_temporal_co_edges": "Số cạnh đồng xuất hiện trong khung giờ hẹp",
    "graph_text_dup_edges": "Số cạnh trùng lặp nội dung trên đồ thị",
    "nlp_char_length": "Độ dài bình luận (Ký tự)",
    "nlp_exclamation_count": "Tần suất dấu cảm thán (!)",
    "beh_rating_deviation": "Độ lệch điểm đánh giá so với trung vị",
    "beh_helpful_votes": "Lượt hữu ích (Helpful Votes)",
    "graph_gat_emb_0": "Đặc trưng ẩn Đồ thị GAT chiều #1",
    "graph_gat_emb_1": "Đặc trưng ẩn Đồ thị GAT chiều #2",
    "graph_gat_emb_2": "Đặc trưng ẩn Đồ thị GAT chiều #3",
    "graph_gat_emb_3": "Đặc trưng ẩn Đồ thị GAT chiều #4",
    "nlp_svd_0": "Biểu diễn ngữ nghĩa SVD chiều #1",
    "nlp_svd_1": "Biểu diễn ngữ nghĩa SVD chiều #2",
    "nlp_svd_2": "Biểu diễn ngữ nghĩa SVD chiều #3",
    "nlp_svd_3": "Biểu diễn ngữ nghĩa SVD chiều #4",
    "nlp_svd_4": "Biểu diễn ngữ nghĩa SVD chiều #5",
    "nlp_svd_5": "Biểu diễn ngữ nghĩa SVD chiều #6",
}


class FeatureEngine:
    """
    End-to-end Feature Engineering pipeline combining Vietnamese NLP, Temporal Burstiness,
    and Behavioral NetworkX + Supervised Graph Attention features.
    """

    def __init__(self, n_svd_components: int = 6):
        self.n_svd_components = n_svd_components
        self.tfidf = TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=1200,
            min_df=1,
            sublinear_tf=True,
        )
        self.svd = TruncatedSVD(n_components=n_svd_components, random_state=42)
        self.graph_engine = BehavioralGraphEngine()
        self.is_fitted = False
        self.feature_columns: List[str] = []
        self.tabular_nlp_columns: List[str] = []

    @staticmethod
    def _clean_comment_for_similarity(text: str) -> str:
        raw = (text or "").strip()
        if raw.startswith("[Đánh giá "):
            return ""
        cleaned = SHOPEE_FORM_HEADER_REGEX.sub(" ", raw)
        return re.sub(r"\s+", " ", cleaned).strip()

    @staticmethod
    def _count_regex_matches(text: str, patterns: List[str]) -> int:
        text_low = text.lower()
        return sum(1 for p in patterns if re.search(p, text_low))

    @staticmethod
    def _shannon_char_entropy(text: str) -> float:
        cleaned = text.strip().lower()
        if not cleaned:
            return 0.0
        n = float(len(cleaned))
        counts = Counter(cleaned)
        return -sum((c / n) * math.log2(c / n) for c in counts.values())

    @staticmethod
    def _clause_burstiness(text: str) -> float:
        clauses = [
            c.strip()
            for c in re.split(r"[.,!?;:\n]+", text)
            if len(c.strip()) > 0
        ]
        if len(clauses) <= 1:
            return 0.25
        lengths = np.array([len(c.split()) for c in clauses], dtype=np.float32)
        mean_l = float(np.mean(lengths)) + 1e-5
        std_l = float(np.std(lengths))
        return float(std_l / mean_l)

    def _extract_nlp_intrinsic(self, df: pd.DataFrame, tfidf_mat: np.ndarray) -> pd.DataFrame:
        comments = df["comment"].fillna("").astype(str).tolist()
        ratings = (
            df["rating"].astype(float).to_numpy()
            if "rating" in df.columns
            else np.full(len(comments), 5.0)
        )
        n = len(comments)

        char_lengths = np.zeros(n, dtype=np.float32)
        lexical_ttr = np.zeros(n, dtype=np.float32)
        excl_counts = np.zeros(n, dtype=np.float32)
        hype_scores = np.zeros(n, dtype=np.float32)
        coin_scores = np.zeros(n, dtype=np.float32)
        ai_scores = np.zeros(n, dtype=np.float32)
        auth_nuance = np.zeros(n, dtype=np.float32)
        char_entropy = np.zeros(n, dtype=np.float32)
        sent_mismatch = np.zeros(n, dtype=np.float32)
        sent_burstiness = np.zeros(n, dtype=np.float32)
        is_valid_sim_text = np.zeros(n, dtype=bool)
        cleaned_texts: List[str] = []

        for i, txt in enumerate(comments):
            is_auto_placeholder = txt.startswith("[Đánh giá ")
            clean_txt = "" if is_auto_placeholder else self._clean_comment_for_similarity(txt)
            cleaned_texts.append(clean_txt)
            is_valid_sim_text[i] = (not is_auto_placeholder) and (len(clean_txt) >= 24)

            char_lengths[i] = 35.0 if is_auto_placeholder else float(len(clean_txt))
            tokens = re.findall(r"\w+", clean_txt.lower())
            n_tok = max(1, len(tokens))
            lexical_ttr[i] = 0.78 if is_auto_placeholder else (len(set(tokens)) / float(n_tok))
            excl_counts[i] = 0.0 if is_auto_placeholder else float(clean_txt.count("!"))

            hype = 0 if is_auto_placeholder else self._count_regex_matches(clean_txt, SEEDING_HYPE_PATTERNS)
            coin = 0 if is_auto_placeholder else self._count_regex_matches(clean_txt, COIN_FARM_PATTERNS)
            ai_f = 0 if is_auto_placeholder else self._count_regex_matches(clean_txt, AI_TEMPLATE_PATTERNS)
            nuance = 1 if is_auto_placeholder else self._count_regex_matches(clean_txt, AUTHENTIC_DETAIL_PATTERNS)
            neg_c = 0 if is_auto_placeholder else self._count_regex_matches(clean_txt, NEGATIVE_COMPLAINT_PATTERNS)

            hype_scores[i] = hype
            coin_scores[i] = coin
            ai_scores[i] = ai_f
            auth_nuance[i] = nuance
            char_entropy[i] = 3.85 if is_auto_placeholder else self._shannon_char_entropy(clean_txt)
            sent_burstiness[i] = 0.32 if is_auto_placeholder else self._clause_burstiness(clean_txt)

            # Sentiment-rating mismatch: 5-star review with coin-farm / complaint or extreme hype without nuance
            star_norm = (ratings[i] - 1.0) / 4.0  # [0, 1]
            if coin >= 1 and ratings[i] >= 5.0:
                sent_mismatch[i] = 0.90
            elif neg_c >= 1 and ratings[i] >= 5.0:
                sent_mismatch[i] = 0.85
            elif (hype + ai_f) >= 2 and nuance == 0 and ratings[i] >= 5.0:
                sent_mismatch[i] = 0.65
            else:
                sent_mismatch[i] = abs(star_norm - min(1.0, 0.5 + 0.2 * (hype - neg_c))) * 0.3

        # Compute domain-independent max cosine similarity within each product group using char_wb 3-5 grams
        # so out-of-vocabulary domain words (skincare, fashion, food) never cause false similarity spikes
        max_cos_sim = np.zeros(n, dtype=np.float32)
        prod_ids = (
            df["product_id"].astype(str).to_numpy()
            if "product_id" in df.columns
            else np.full(n, "default")
        )

        for pid in np.unique(prod_ids):
            idx = np.where((prod_ids == pid) & is_valid_sim_text)[0]
            if len(idx) > 1:
                sub_texts = [cleaned_texts[k].lower() for k in idx]
                try:
                    local_vec = TfidfVectorizer(
                        analyzer="char_wb", ngram_range=(3, 5), min_df=1, sublinear_tf=True
                    )
                    sub_mat = local_vec.fit_transform(sub_texts)
                    sim = cosine_similarity(sub_mat)
                    np.fill_diagonal(sim, 0.0)
                    max_cos_sim[idx] = np.max(sim, axis=1).clip(0.0, 1.0)
                except Exception:
                    sub_mat = tfidf_mat[idx]
                    sim = cosine_similarity(sub_mat)
                    np.fill_diagonal(sim, 0.0)
                    max_cos_sim[idx] = np.max(sim, axis=1).clip(0.0, 1.0)

        # SVD components
        actual_comp = min(
            self.n_svd_components, tfidf_mat.shape[1] - 1, tfidf_mat.shape[0] - 1
        )
        if not self.is_fitted and actual_comp >= 2:
            self.svd = TruncatedSVD(n_components=actual_comp, random_state=42)
            svd_vecs = self.svd.fit_transform(tfidf_mat)
        elif self.is_fitted:
            svd_vecs = self.svd.transform(tfidf_mat)
        else:
            svd_vecs = np.zeros((n, self.n_svd_components), dtype=np.float32)

        if svd_vecs.shape[1] < self.n_svd_components:
            pad = np.zeros(
                (n, self.n_svd_components - svd_vecs.shape[1]), dtype=np.float32
            )
            svd_vecs = np.hstack([svd_vecs, pad])

        data_dict: Dict[str, Any] = {
            "nlp_char_length": char_lengths,
            "nlp_lexical_diversity": lexical_ttr,
            "nlp_exclamation_count": excl_counts,
            "nlp_seeding_hype_score": hype_scores,
            "nlp_coin_farm_score": coin_scores,
            "nlp_ai_formality_score": ai_scores,
            "nlp_authentic_nuance_score": auth_nuance,
            "nlp_char_entropy": char_entropy,
            "nlp_sentiment_rating_mismatch": sent_mismatch,
            "nlp_sentence_burstiness": sent_burstiness,
            "nlp_max_cosine_sim": max_cos_sim,
        }
        for k in range(self.n_svd_components):
            data_dict[f"nlp_svd_{k}"] = svd_vecs[:, k].astype(np.float32)

        return pd.DataFrame(data_dict, index=df.index)

    def _extract_temporal_and_behavioral(
        self, df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        n = len(df)
        timestamps = pd.to_datetime(df["timestamp"], errors="coerce").fillna(
            pd.Timestamp("2026-10-01")
        )
        ts_sec = (timestamps.astype("int64") // 10**9).to_numpy()
        ratings = df["rating"].astype(float).to_numpy()
        prod_ids = (
            df["product_id"].astype(str).to_numpy()
            if "product_id" in df.columns
            else np.full(n, "default")
        )
        # Scope 15-min burst detection by item_id when available so multi-product shop traffic
        # is not conflated with single-product order buffing
        if "item_id" in df.columns:
            item_ids = df["item_id"].fillna("").astype(str).to_numpy()
            group_keys = np.array(
                [
                    f"{prod_ids[k]}__{item_ids[k]}" if item_ids[k] and item_ids[k] != "0" else prod_ids[k]
                    for k in range(n)
                ]
            )
        else:
            group_keys = prod_ids

        reviews_in_15m = np.zeros(n, dtype=np.float32)
        inter_arrival_log = np.zeros(n, dtype=np.float32)
        burst_zscore = np.zeros(n, dtype=np.float32)
        rating_dev = np.zeros(n, dtype=np.float32)

        for gid in np.unique(group_keys):
            idx = np.where(group_keys == gid)[0]
            p_ts = ts_sec[idx]
            p_rat = ratings[idx]
            med_rat = float(np.median(p_rat)) if len(p_rat) > 0 else 4.5

            diff_mat = np.abs(p_ts[:, None] - p_ts[None, :])
            in_15m = np.sum(diff_mat <= 900, axis=1) - 1
            reviews_in_15m[idx] = np.clip(in_15m, 0, None)

            np.fill_diagonal(diff_mat, 1e9)
            nearest_sec = (
                np.min(diff_mat, axis=1)
                if len(idx) > 1
                else np.full(len(idx), 3600.0)
            )
            inter_arrival_log[idx] = np.log1p(
                np.clip(nearest_sec, 0.0, 86400.0 * 7)
            )

            hour_buckets = p_ts // 3600
            unique_hours, counts = np.unique(hour_buckets, return_counts=True)
            hr_map = dict(zip(unique_hours, counts))
            mean_c = float(np.mean(counts)) if len(counts) > 0 else 1.0
            std_c = float(np.std(counts)) + 0.8
            for local_i, global_i in enumerate(idx):
                c_val = float(hr_map.get(hour_buckets[local_i], 1))
                burst_zscore[global_i] = (c_val - mean_c) / std_c
                rating_dev[global_i] = abs(p_rat[local_i] - med_rat)

        acc_age = (
            df["account_age_days"].astype(float).clip(1.0, None).to_numpy()
            if "account_age_days" in df.columns
            else np.full(n, 180.0)
        )
        u_total = (
            df["user_total_reviews"].astype(float).clip(1.0, None).to_numpy()
            if "user_total_reviews" in df.columns
            else np.full(n, 8.0)
        )
        velocity = u_total / np.maximum(1.0, acc_age / 30.0)
        verified = (
            df["verified_purchase"].astype(float).to_numpy()
            if "verified_purchase" in df.columns
            else np.ones(n, dtype=np.float32)
        )
        helpful = (
            df["helpful_votes"].astype(float).to_numpy()
            if "helpful_votes" in df.columns
            else np.zeros(n, dtype=np.float32)
        )

        temp_beh_df = pd.DataFrame(
            {
