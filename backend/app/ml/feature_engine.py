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
