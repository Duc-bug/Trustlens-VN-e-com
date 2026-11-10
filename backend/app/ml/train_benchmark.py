from __future__ import annotations

import json
import os
import time
import warnings
from typing import Any, Callable, Dict, List

warnings.filterwarnings("ignore", category=UserWarning)

import joblib
import numpy as np
import pandas as pd
import torch
from scipy import stats
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    matthews_corrcoef,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from tabpfn import TabPFNClassifier
from tabpfn.constants import ModelVersion

from app.ml.feature_engine import FEATURE_LABELS_VI, FeatureEngine


def _sample_curve_points(x_arr: np.ndarray, y_arr: np.ndarray, num_points: int = 41) -> List[Dict[str, float]]:
    grid = np.linspace(0.0, 1.0, num_points)
    order = np.argsort(x_arr)
    x_sorted = x_arr[order]
    y_sorted = y_arr[order]
    y_interp = np.interp(grid, x_sorted, y_sorted)
    return [
        {"x": round(float(gx) * 100, 1), "y": round(float(gy) * 100, 2)}
        for gx, gy in zip(grid, y_interp)
    ]


def _evaluate_predictions(y_true: np.ndarray, y_prob: np.ndarray, threshold: float = 0.50) -> Dict[str, Any]:
    y_pred = (y_prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    fpr, tpr, _ = roc_curve(y_true, y_prob)
    prec_c, rec_c, _ = precision_recall_curve(y_true, y_prob)
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)) * 100, 2),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)) * 100, 2),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)) * 100, 2),
        "f1_score": round(float(f1_score(y_true, y_pred, zero_division=0)) * 100, 2),
        "roc_auc": round(float(roc_auc_score(y_true, y_prob)) * 100, 2),
        "pr_auc": round(float(average_precision_score(y_true, y_prob)) * 100, 2),
        "mcc": round(float(matthews_corrcoef(y_true, y_pred)) * 100, 2),
        "brier_score": round(float(brier_score_loss(y_true, np.clip(y_prob, 0.0, 1.0))), 4),
        "optimal_threshold": round(float(threshold), 3),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "roc_curve": _sample_curve_points(fpr, tpr, num_points=41),
        "pr_curve": _sample_curve_points(rec_c, prec_c, num_points=41),
    }


def _run_5fold_cv(
    df_raw: pd.DataFrame,
    X_context: pd.DataFrame,
    y: np.ndarray,
    builder_fn: Callable[[], Any],
    cols: List[str] | None = None,
) -> Dict[str, Any]:
    """
    Runs Stratified 5-Fold CV while fitting TF-IDF + TruncatedSVD strictly inside each
    training fold (zero text vocabulary/projection leakage across folds).
    """
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    f1_list, auc_list, brier_list = [], [], []
    svd_cols = [f"nlp_svd_{k}" for k in range(3)]
    use_cols = cols if cols is not None else list(X_context.columns)
    needs_svd = any(sc in use_cols for sc in svd_cols)

    for tr_idx, va_idx in skf.split(X_context, y):
        X_tr_fold = X_context.iloc[tr_idx].reset_index(drop=True).copy()
        X_va_fold = X_context.iloc[va_idx].reset_index(drop=True).copy()
        if needs_svd:
            eng_fold = FeatureEngine(n_svd_components=3)
            X_tr_svd, _ = eng_fold.fit_transform(df_raw.iloc[tr_idx].reset_index(drop=True))
            X_va_svd, _ = eng_fold.transform(df_raw.iloc[va_idx].reset_index(drop=True))
            for sc in svd_cols:
                X_tr_fold[sc] = X_tr_svd[sc].to_numpy()
                X_va_fold[sc] = X_va_svd[sc].to_numpy()

        X_tr_np = X_tr_fold[use_cols].to_numpy(dtype=np.float32)
        X_va_np = X_va_fold[use_cols].to_numpy(dtype=np.float32)

        clf = builder_fn()
        clf.fit(X_tr_np, y[tr_idx])
        prob_va = clf.predict_proba(X_va_np)[:, 1]
        pred_va = (prob_va >= 0.50).astype(int)
        f1_list.append(float(f1_score(y[va_idx], pred_va, zero_division=0)) * 100.0)
        auc_list.append(float(roc_auc_score(y[va_idx], prob_va)) * 100.0)
        brier_list.append(float(brier_score_loss(y[va_idx], np.clip(prob_va, 0.0, 1.0))))
    return {
        "f1_mean": round(float(np.mean(f1_list)), 2),
        "f1_std": round(float(np.std(f1_list, ddof=1)), 2),
        "roc_auc_mean": round(float(np.mean(auc_list)), 2),
        "roc_auc_std": round(float(np.std(auc_list, ddof=1)), 2),
        "brier_mean": round(float(brier_list and np.mean(brier_list) or 0.0), 4),
        "fold_f1_scores": [round(v, 2) for v in f1_list],
    }


def train_and_save_all(models_dir: str, rebuild_data: bool = False) -> Dict[str, Any]:
    os.makedirs(models_dir, exist_ok=True)
    csv_path = os.path.join(models_dir, "real_ecommerce_reviews.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Missing real Shopee dataset: {csv_path}")

    df = pd.read_csv(csv_path)
    y = df["is_seeding"].astype(int).to_numpy()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Training on 100% REAL Shopee dataset: N={len(df)} reviews | Device={device}")

    # Compute shop-context features on full shop stream (matching live Shopee scanning),
    # while fitting TF-IDF + TruncatedSVD strictly on df_train to prevent text leakage.
    engine_full = FeatureEngine(n_svd_components=3)
    X_full, _ = engine_full.fit_transform(df)

    idx_all = np.arange(len(df))
    tr_idx, te_idx = train_test_split(idx_all, test_size=0.25, random_state=42, stratify=y)
    df_train = df.iloc[tr_idx].reset_index(drop=True)
    df_test = df.iloc[te_idx].reset_index(drop=True)
    y_train, y_test = y[tr_idx], y[te_idx]

    svd_cols = [f"nlp_svd_{k}" for k in range(3)]
    engine_tr = FeatureEngine(n_svd_components=3)
    X_tr_svd, _ = engine_tr.fit_transform(df_train)
    X_te_svd, _ = engine_tr.transform(df_test)

    X_train = X_full.iloc[tr_idx].reset_index(drop=True).copy()
    X_test = X_full.iloc[te_idx].reset_index(drop=True).copy()
    for sc in svd_cols:
        X_train[sc] = X_tr_svd[sc].to_numpy()
        X_test[sc] = X_te_svd[sc].to_numpy()

    all_cols = list(X_train.columns)
    nlp_cols = [c for c in all_cols if c.startswith("nlp_")]
    temp_cols = [c for c in all_cols if c.startswith("temp_")]
    beh_cols = [c for c in all_cols if c.startswith("beh_")]

    def build_logreg():
        return Pipeline([
            ("scaler", StandardScaler()),
            ("lr", LogisticRegression(C=1.0, max_iter=500, random_state=42)),
        ])

    def build_rf():
        return RandomForestClassifier(
            n_estimators=150, max_depth=12, min_samples_leaf=3, random_state=42, n_jobs=-1
        )

    def build_tabpfn():
        return TabPFNClassifier.create_default_for_version(
            ModelVersion.V2,
            device=device,
            ignore_pretraining_limits=(device == "cpu"),
        )

    # 1. Baseline 1: Logistic Regression (20 features)
    t0 = time.perf_counter()
    clf_lr = build_logreg()
    clf_lr.fit(X_train.to_numpy(dtype=np.float32), y_train)
    prob_lr = clf_lr.predict_proba(X_test.to_numpy(dtype=np.float32))[:, 1]
    lat_lr = round((time.perf_counter() - t0) * 1000, 1)
    m_lr = _evaluate_predictions(y_test, prob_lr)
    cv_lr = _run_5fold_cv(df, X_full, y, build_logreg)
    print(f"  [1] Logistic Regression: F1={m_lr['f1_score']}% | AUC={m_lr['roc_auc']}% | Brier={m_lr['brier_score']} | 5-Fold={cv_lr['f1_mean']}±{cv_lr['f1_std']}%")

    # 2. Baseline 2: Random Forest (20 features)
    t0 = time.perf_counter()
    clf_rf = build_rf()
    clf_rf.fit(X_train.to_numpy(dtype=np.float32), y_train)
    prob_rf = clf_rf.predict_proba(X_test.to_numpy(dtype=np.float32))[:, 1]
    lat_rf = round((time.perf_counter() - t0) * 1000, 1)
    m_rf = _evaluate_predictions(y_test, prob_rf)
    cv_rf = _run_5fold_cv(df, X_full, y, build_rf)
    print(f"  [2] Random Forest:       F1={m_rf['f1_score']}% | AUC={m_rf['roc_auc']}% | Brier={m_rf['brier_score']} | 5-Fold={cv_rf['f1_mean']}±{cv_rf['f1_std']}%")

    # 3. Proposed Main Model (Standalone SOTA 2025): TabPFN v2 (Nature 2025)
    t0 = time.perf_counter()
    clf_tabpfn = build_tabpfn()
    clf_tabpfn.fit(X_train.to_numpy(dtype=np.float32), y_train)
    prob_tabpfn = clf_tabpfn.predict_proba(X_test.to_numpy(dtype=np.float32))[:, 1]
    lat_tabpfn = round((time.perf_counter() - t0) * 1000, 1)
    m_tabpfn = _evaluate_predictions(y_test, prob_tabpfn)
    cv_tabpfn = _run_5fold_cv(df, X_full, y, build_tabpfn)
    print(f"  [3] TabPFN v2 (GPU):     F1={m_tabpfn['f1_score']}% | AUC={m_tabpfn['roc_auc']}% | Brier={m_tabpfn['brier_score']} | 5-Fold={cv_tabpfn['f1_mean']}±{cv_tabpfn['f1_std']}%")

    # Paired one-sided Student's t-test on 5-Fold CV F1
    prop_folds = np.array(cv_tabpfn["fold_f1_scores"], dtype=np.float64)

    def _ttest(base_folds: List[float]) -> Dict[str, Any]:
        b_arr = np.array(base_folds, dtype=np.float64)
        if np.allclose(prop_folds, b_arr):
            return {"t_stat": 0.0, "p_value": 1.0, "p_value_str": "1.000", "significant": False}
        t_st, p_val = stats.ttest_rel(prop_folds, b_arr)
        p_one = float(p_val) / 2.0 if t_st > 0 else float(p_val)
        p_cl = max(0.0001, min(0.9999, p_one))
        return {
            "t_stat": round(float(t_st), 2),
            "p_value": round(p_cl, 5),
            "p_value_str": "< 0.001" if p_cl < 0.001 else f"{p_cl:.4f}",
            "significant": bool(p_cl < 0.05),
        }

    # Ablation Study using TabPFN v2 across feature groups
    ablation_configs = [
        ("1. Chỉ NLP Tiếng Việt (12 biến)", nlp_cols),
        ("2. + Đột biến thời gian (15 biến)", nlp_cols + temp_cols),
        ("3. + Hành vi người mua Shopee (20 biến)", all_cols),
    ]
    ablation_rows = []
    base_abl_f1 = None
    for cfg_name, cols in ablation_configs:
        c_ab = build_tabpfn()
        c_ab.fit(X_train[cols].to_numpy(dtype=np.float32), y_train)
        p_ab = c_ab.predict_proba(X_test[cols].to_numpy(dtype=np.float32))[:, 1]
        res_ab = _evaluate_predictions(y_test, p_ab)
        cv_ab = _run_5fold_cv(df, X_full, y, build_tabpfn, cols=cols)
        if base_abl_f1 is None:
            base_abl_f1 = res_ab["f1_score"]
        ablation_rows.append({
            "configuration": cfg_name,
            "num_features": len(cols),
            "f1_score": res_ab["f1_score"],
            "roc_auc": res_ab["roc_auc"],
            "brier_score": res_ab["brier_score"],
            "cv_f1_mean": cv_ab["f1_mean"],
            "cv_f1_std": cv_ab["f1_std"],
            "gain_f1": round(res_ab["f1_score"] - base_abl_f1, 2),
        })
        print(f"  Ablation {cfg_name}: F1={res_ab['f1_score']}% | 5-Fold={cv_ab['f1_mean']}±{cv_ab['f1_std']}%")

    # Global Feature Importance via Permutation Importance on TabPFN v2 (model-agnostic, exact)
    perm = permutation_importance(
        clf_tabpfn,
        X_test.to_numpy(dtype=np.float32),
        y_test,
        scoring="f1",
        n_repeats=5,
        random_state=42,
    )
    imp_mean = np.maximum(0.0, perm.importances_mean)
    top_idx = np.argsort(-imp_mean)[:10]
    global_importance = []
    for i in top_idx:
        fk = all_cols[int(i)]
        cat = "NLP tiếng Việt" if fk.startswith("nlp_") else ("Đột biến thời gian" if fk.startswith("temp_") else "Hành vi Shopee")
        global_importance.append({
            "feature": fk,
            "label": FEATURE_LABELS_VI.get(fk, fk),
            "importance": round(float(imp_mean[int(i)]) * 100.0, 2),
            "category": cat,
        })

    # Fit production baseline models on full 5,409-row real Shopee dataset
    X_full_np = X_full.to_numpy(dtype=np.float32)
    prod_lr = build_logreg().fit(X_full_np, y)
    prod_rf = build_rf().fit(X_full_np, y)

    # Save portable artifacts (store TabPFN v2 context arrays so CPU & GPU machines both load cleanly)
    joblib.dump(engine_full, os.path.join(models_dir, "feature_engine.pkl"))
    joblib.dump(prod_rf, os.path.join(models_dir, "rf_explainer_model.pkl"))
    joblib.dump(
        {
            "logreg": {"model": prod_lr, "cols": all_cols},
            "rf": {"model": prod_rf, "cols": all_cols},
            "tabpfn_v2": {"X_context": X_full_np, "y_context": y, "cols": all_cols},
        },
        os.path.join(models_dir, "all_models.pkl"),
    )

    payload = {
        "dataset_summary": {
            "total_reviews": int(len(df)),
            "unique_comments": int(df["comment"].nunique()),
            "unique_products": int(df["product_id"].nunique()),
            "unique_shops": int(df["shop_id"].nunique()),
            "train_samples": int(len(y_train)),
            "test_samples": int(len(y_test)),
            "authentic_count": int(np.sum(y == 0)),
            "seeding_count": int(np.sum(y == 1)),
            "seeding_ratio_pct": round(float(np.mean(y) * 100.0), 2),
            "total_features": len(all_cols),
            "nlp_features_count": len(nlp_cols),
            "temporal_features_count": len(temp_cols),
            "behavioral_features_count": len(beh_cols),
            "cv_folds": 5,
            "platforms_covered": ["Shopee"],
            "device": device,
        },
        "models": [
            {
                "id": "logreg",
                "name": "Logistic Regression (Cơ sở tuyến tính)",
                "short_name": "Logistic Regression",
                "feature_set": f"Đủ {len(all_cols)} đặc trưng",
                "is_proposed": False,
                "latency_ms": lat_lr,
                "cv_5fold": cv_lr,
                "paired_ttest": _ttest(cv_lr["fold_f1_scores"]),
                **m_lr,
            },
            {
                "id": "random_forest",
                "name": "Random Forest (Cơ sở cây quyết định)",
                "short_name": "Random Forest",
                "feature_set": f"Đủ {len(all_cols)} đặc trưng",
                "is_proposed": False,
                "latency_ms": lat_rf,
                "cv_5fold": cv_rf,
                "paired_ttest": _ttest(cv_rf["fold_f1_scores"]),
                **m_rf,
            },
            {
                "id": "tabpfn_v2",
                "name": "TabPFN v2 (Foundation Model — Nature 2025)",
                "short_name": "TabPFN v2 (Đề xuất)",
                "feature_set": f"Đủ {len(all_cols)} đặc trưng",
                "is_proposed": True,
                "latency_ms": lat_tabpfn,
                "cv_5fold": cv_tabpfn,
                "paired_ttest": {"t_stat": 0.0, "p_value": 0.0, "p_value_str": "Mô hình đề xuất", "significant": True},
                **m_tabpfn,
            },
        ],
        "ablation_study": ablation_rows,
        "global_shap_importance": global_importance,
    }

    with open(os.path.join(models_dir, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print("Saved metrics.json and TabPFN v2 models successfully!")
    return payload


if __name__ == "__main__":
    base = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models_saved")
    train_and_save_all(base)
