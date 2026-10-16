"""
Real-Time Inference & Explainable AI (SHAP) Predictor (`predictor.py`).
Executes the trained Hybrid LightGBM + Graph Attention pipeline on any product's reviews,
computing:
  - Per-review Seeding Probability, Fraud Archetype, and Top-3 Local SHAP Explanations
  - Product-level Adjusted True Rating (Điểm Thật sau lọc Seeding) vs Platform Rating (Điểm Sàn)
  - Product-level SHAP Feature Importance (`shap.TreeExplainer`)
  - Temporal Burstiness Timeline (`burst_timeline`) & Behavioral Seeding Graph (`seeding_graph`)
  - Full Shopee Live Metadata pass-through (Shop Info, Categories, Variations, Buyer Photos/Videos, Seller Replies)
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
import shap

from app.ml.feature_engine import FEATURE_LABELS_VI, FeatureEngine
from app.ml.train_benchmark import train_and_save_all


class TrustLensPredictor:
    """
    Production Inference & SHAP Explanation Engine for TrustLens VN.
    Automatically loads all 5 saved models from `models_saved/` or triggers training on first boot.
    """

    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.all_5_models_path = os.path.join(models_dir, "all_5_models.pkl")
        self.model_path = os.path.join(models_dir, "hybrid_lgbm_model.pkl")
        self.calibrator_path = os.path.join(models_dir, "calibration_isotonic.pkl")
        self.engine_path = os.path.join(models_dir, "feature_engine.pkl")
        self.metrics_path = os.path.join(models_dir, "metrics.json")
        self.samples_path = os.path.join(models_dir, "sample_products.json")

        if not (
            os.path.exists(self.all_5_models_path)
            and os.path.exists(self.model_path)
            and os.path.exists(self.engine_path)
            and os.path.exists(self.metrics_path)
            and os.path.exists(self.samples_path)
        ):
            train_and_save_all(models_dir)

        self.all_5_models: Dict[str, Dict[str, Any]] = joblib.load(self.all_5_models_path)
        self.model = joblib.load(self.model_path)
        self.calibrator = (
            joblib.load(self.calibrator_path)
            if os.path.exists(self.calibrator_path)
            else None
        )
        self.engine: FeatureEngine = joblib.load(self.engine_path)
        self.explainer = shap.TreeExplainer(self.model)

        with open(self.metrics_path, "r", encoding="utf-8") as f:
            self.benchmarks: Dict[str, Any] = json.load(f)
        with open(self.samples_path, "r", encoding="utf-8") as f:
            self.demo_products: List[Dict[str, Any]] = json.load(f)

    def _classify_seeding_archetype(self, row_feat: pd.Series, prob: float) -> Tuple[str, str]:
        if prob < 0.50:
            return "AUTHENTIC", "Đánh giá Người Mua Thật"
        if float(row_feat.get("nlp_coin_farm_score", 0)) >= 1.0:
            return "COIN_FARM_SPAM", "Spam Văn Mẫu Cày Xu"
        if float(row_feat.get("nlp_ai_formality_score", 0)) >= 1.0:
            return "AI_MARKETING_SEEDING", "Seeding Văn Mẫu AI / KOC"
        if float(row_feat.get("nlp_max_cosine_sim", 0)) >= 0.45:
            return "TEMPLATE_COPY_PASTE", "Copy-Paste Văn Mẫu Hàng Loạt"
        if float(row_feat.get("temp_reviews_in_15m", 0)) >= 3.0 or float(row_feat.get("graph_temporal_co_edges", 0)) >= 2.0:
            return "TIME_BURST_SEEDING", "Buff Đơn Dồn Khung Giờ (Time-Burst)"
        return "GRAPH_CLUSTER_SEEDING", "Cụm Tài Khoản Seeding Liên Kết Đồ Thị"

    def analyze_product_payload(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        reviews_raw = product_data.get("reviews") or []
        if not reviews_raw:
            raise ValueError("Sản phẩm không có dữ liệu bình luận để phân tích.")

        df = pd.DataFrame(reviews_raw)
        if "product_id" not in df.columns:
            df["product_id"] = product_data.get("product_id", "custom_prod")
        if "rating" not in df.columns:
            df["rating"] = 5
        if "comment" not in df.columns:
            df["comment"] = ""
        if "timestamp" not in df.columns:
            df["timestamp"] = "2026-10-10 20:00:00"
        if "user_id" not in df.columns:
            df["user_id"] = [f"u_custom_{i}" for i in range(len(df))]
        if "user_name" not in df.columns:
            df["user_name"] = [f"Khách hàng #{i+1}" for i in range(len(df))]
        if "review_id" not in df.columns:
            df["review_id"] = [f"rev_{i+1}" for i in range(len(df))]

        X_feat, aux = self.engine.transform(df)

        # Execute all 5 models in parallel on the current product's feature matrix
        model_raw_probs: Dict[str, np.ndarray] = {}
        model_latencies: Dict[str, float] = {}
        for m_key, m_entry in self.all_5_models.items():
            t0 = time.perf_counter()
            cols_m = [c for c in m_entry["cols"] if c in X_feat.columns]
            p_arr = m_entry["model"].predict_proba(X_feat[cols_m])[:, 1]
            if m_entry.get("calibrator") is not None:
                try:
                    cal_arr = m_entry["calibrator"].transform(p_arr)
                    p_arr = 0.65 * p_arr + 0.35 * cal_arr
                except Exception:
                    pass
            model_raw_probs[m_key] = np.clip(p_arr, 0.01, 0.99)
            model_latencies[m_key] = round((time.perf_counter() - t0) * 1000.0, 2)

        raw_probs = (
            0.35 * model_raw_probs["proposed_hybrid_graph_lgbm"]
            + 0.25 * model_raw_probs["lgbm_graph_gat"]
            + 0.18 * model_raw_probs["xgb_tabular"]
            + 0.12 * model_raw_probs["rf_nlp_temp"]
            + 0.10 * model_raw_probs["logreg_nlp"]
        )

        # Calibrate probabilities with explicit Vietnamese linguistic/behavioral signals for live crawled reviews
        probs = np.copy(raw_probs)
        live_meta = product_data.get("shopee_live_meta") or {}
        is_official_shop = bool(live_meta.get("is_official_shop", False))
        per_review_model_votes: List[Dict[str, float]] = []
        per_review_flagged_count: List[int] = []

        for i in range(len(df)):
            f_row = X_feat.iloc[i]
            row_i = df.iloc[i]
            r_star_i = int(row_i.get("rating", 5))
            comment_i = str(row_i.get("comment", "")).strip()
            has_media_i = int(row_i.get("has_media", 0))
            is_auto_note = comment_i.startswith("[Đánh giá ")
            is_repeat_buyer = bool(row_i.get("is_repeated_purchase", False))

            tpl_tags_i = row_i.get("template_tags")
            tpl_tags_list = tpl_tags_i if isinstance(tpl_tags_i, list) else []
            word_cnt_i = int(f_row.get("nlp_word_count", 0))
            raw_free_cnt = row_i.get("free_text_word_count")
            free_words_i = (
                int(raw_free_cnt)
                if raw_free_cnt is not None and not pd.isna(raw_free_cnt)
                else word_cnt_i
            )
            is_form_only_comment = (len(tpl_tags_list) > 0 and free_words_i <= 6)

            # Inspect real Shopee video metadata (duration_ms & template_video)
            vids_i = row_i.get("media_videos")
            vids_list = vids_i if isinstance(vids_i, list) else []
            has_template_vid = any(bool(v.get("template_video")) for v in vids_list if isinstance(v, dict))
            has_short_coin_vid = any(
                0 < int(v.get("duration_ms") or 0) <= 2600 for v in vids_list if isinstance(v, dict)
            )
            has_long_real_vid = any(
                int(v.get("duration_ms") or 0) >= 4000 and not bool(v.get("template_video"))
                for v in vids_list
                if isinstance(v, dict)
            )

            # Inspect real Shopee 3-criteria detailed sub-ratings
            det_i = row_i.get("detailed_rating")
            prod_qual_i = (
                int(det_i.get("product_quality", r_star_i))
                if isinstance(det_i, dict) and det_i.get("product_quality")
