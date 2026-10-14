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
