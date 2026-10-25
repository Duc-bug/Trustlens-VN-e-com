# -*- coding: utf-8 -*-
"""
Crawls 100% real Vietnamese Shopee reviews across multiple official & popular Shopee shops
using Shopee's public API (get_shop_core_info + get_shop_ratings_new) and builds a clean,
large, product-consistent Shopee dataset at backend/app/models_saved/real_ecommerce_reviews.csv.
"""

from __future__ import annotations

import concurrent.futures
import datetime as dt
import hashlib
import os
import re
import time
import unicodedata
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

SHOPEE_SHOPS: List[Tuple[int, str, str]] = [
    (85923677, "MTBH.VN", "Linh kiện PC & Điện tử"),
    (389909406, "Longdo Leather", "Đồ da & Phụ kiện"),
    (147191228, "Laneige Official Store", "Mỹ phẩm & Chăm sóc da"),
    (37251700, "La Roche-Posay Official", "Mỹ phẩm & Chăm sóc da"),
    (152872415, "Guardian Official Store", "Sức khỏe & Chăm sóc cá nhân"),
    (37251933, "L'Oreal Paris Official", "Mỹ phẩm & Chăm sóc da"),
    (52679373, "Logitech Official Store", "Linh kiện PC & Điện tử"),
    (173392916, "Coolmate Official", "Thời trang & Phụ kiện"),
    (55771655, "LocknLock Official Store", "Gia dụng & Đời sống"),
    (26947756, "Unilever Vietnam Official", "Tiêu dùng & Gia dụng"),
    (155343961, "Innisfree Official Store", "Mỹ phẩm & Chăm sóc da"),
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://shopee.vn/",
}

FORM_HEADER_RE = re.compile(
    r"(?im)^(kinh nghiệm sử dụng|mẹo|bao bì/mẫu mã|bao bì|mẫu mã|hương thơm|mùi hương|"
    r"dành cho da|tác dụng|công dụng|kết cấu|độ thẩm thấu|độ bền màu|màu sắc|"
    r"chất liệu|đúng với mô tả|tính năng nổi bật|chất lượng sản phẩm|công dụng chính|"
    r"độ che phủ|phù hợp với loại da|hiệu quả sử dụng)\s*:\s*"
)

COIN_FARM_PATTERNS = [
    r"nhận\s*xu",
    r"kiếm\s*xu",
    r"lấy\s*xu",
    r"đủ\s*ký\s*tự",
    r"đủ\s*50\s*ký\s*tự",
    r"tính\s*chất\s*minh\s*họa",
    r"hình\s*ảnh\s*(và\s*video\s*)?(chỉ\s*)?mang\s*tính\s*chất",
    r"video\s*(chỉ\s*)?mang\s*tính\s*chất",
    r"chưa\s*(dùng|xài|mở|thử).{0,30}(5\s*sao|năm\s*sao)",
    r"công\s*cha\s*như\s*núi",
    r"trăm\s*năm\s*trong\s*cõi",
    r"cách\s*nấu\s*",
    r"bánh\s*tráng\s*trộn",
    r"([a-zà-ỹ])\1{4,}",
]
COIN_FARM_RE = re.compile("|".join(COIN_FARM_PATTERNS), re.IGNORECASE)

HYPE_PATTERNS = [
    r"tuyệt\s*vời\s*vượt\s*mong\s*đợi",
    r"đỉnh\s*của\s*chóp",
    r"siêu\s*phẩm",
    r"giao\s*hàng\s*thần\s*tốc",
    r"nhanh\s*như\s*chớp",
    r"đáng\s*đồng\s*tiền\s*bát\s*gạo",
    r"không\s*có\s*gì\s*để\s*chê",
    r"uy\s*tín\s*số\s*1",
    r"nhất\s*định\s*sẽ\s*ủng\s*hộ\s*dài\s*dài",
    r"100%\s*chính\s*hãng",
    r"tư\s*vấn\s*cực\s*kỳ\s*có\s*tâm",
]
HYPE_RE = re.compile("|".join(HYPE_PATTERNS), re.IGNORECASE)

NEGATIVE_WORDS_RE = re.compile(
    r"(thất\s*vọng|kém|tệ|lỗi|hỏng|vỡ|móp|giả|pha\s*ke|fake|thiếu|nhầm|giao\s*sai|chậm|lâu|hắc|nồng|dị\s*ứng|rởm|mỏng\s*dính|không\s*giống)",
    re.IGNORECASE,
)


def crawl_single_shop(session: requests.Session, shopid: int, shop_label: str, category: str) -> List[Dict[str, Any]]:
    seller_uid = 0
    shop_name = shop_label
    try:
        r_core = session.get(
            f"https://shopee.vn/api/v4/shop/get_shop_core_info?shopid={shopid}",
            headers=HEADERS,
            timeout=5,
        )
        if r_core.status_code == 200:
            data = r_core.json().get("data") or {}
            seller_uid = int(data.get("userid") or 0)
            shop_name = unicodedata.normalize("NFC", str(data.get("shop_name") or shop_label)).strip()
    except Exception:
        pass

    # Fetch full API pagination across all 5 star tiers (up to ~1,650 raw ratings per shop)
    tasks = (
        [(5, off) for off in range(0, 1000, 50)]
        + [(4, off) for off in range(0, 300, 50)]
        + [(3, off) for off in (0, 50, 100)]
        + [(2, off) for off in (0, 50)]
        + [(1, off) for off in (0, 50)]
    )

    def _fetch(arg: Tuple[int, int]) -> List[Dict[str, Any]]:
        st, off = arg
        url = (
            f"https://shopee.vn/api/v4/seller_operation/get_shop_ratings_new"
            f"?limit=50&offset={off}&shopid={shopid}&type={st}&userid={seller_uid}"
        )
        try:
            resp = session.get(url, headers=HEADERS, timeout=7)
            if resp.status_code == 200:
                return (resp.json().get("data") or {}).get("items") or []
        except Exception:
            pass
        return []

    raw_by_cmtid: Dict[int, Dict[str, Any]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        for page_items in ex.map(_fetch, tasks):
            for it in page_items:
                cid = int(it.get("cmtid") or 0)
                if cid and cid not in raw_by_cmtid:
                    raw_by_cmtid[cid] = it

    rows: List[Dict[str, Any]] = []
    for cid, r in raw_by_cmtid.items():
        raw_comment = unicodedata.normalize("NFC", str(r.get("comment") or "")).strip()
        if not raw_comment or len(raw_comment) < 8:
            continue  # Keep reviews with actual Vietnamese text comments

        p_items = r.get("product_items") or []
        first_p = p_items[0] if p_items else {}
        for pi in p_items:
            nm = str(pi.get("name") or "").strip().upper()
            if nm and not nm.startswith(("[HB GIFT", "[GIFT", "QUÀ TẶNG")):
                first_p = pi
                break

        itemid = int(first_p.get("itemid") or r.get("itemid") or 0)
        prod_name = unicodedata.normalize("NFC", str(first_p.get("name") or f"Sản phẩm {shop_name}")).strip()
        rating = max(1, min(5, int(r.get("rating_star") or 5)))
        ctime = int(r.get("ctime") or 0)
        ts_str = dt.datetime.fromtimestamp(ctime).strftime("%Y-%m-%d %H:%M:%S") if ctime > 0 else ""

        images = r.get("images") or []
        videos = r.get("videos") or []
        has_media = 1 if (images or videos) else 0
        min_video_ms = 0
        is_template_video = 0
        for v in videos:
            if isinstance(v, dict):
                dur = int(v.get("duration") or 0)
                if dur > 0 and (min_video_ms == 0 or dur < min_video_ms):
                    min_video_ms = dur
                if v.get("template_video"):
                    is_template_video = 1

        det = r.get("detailed_rating") or {}
        det_quality = int(det.get("product_quality") or rating)

        uid = str(r.get("userid") or r.get("author_shopid") or cid)
        uname = unicodedata.normalize("NFC", str(r.get("author_username") or f"user_{uid[:6]}")).strip()
        likes = int(r.get("like_count") or 0)
        is_repeated = 1 if r.get("is_repeated_purchase") else 0

        rows.append(
            {
                "review_id": f"sp_{shopid}_{cid}",
                "shop_id": shopid,
                "shop_name": shop_name,
                "category": category,
                "product_id": f"sp_item_{itemid}" if itemid else f"sp_shop_{shopid}",
                "product_name": prod_name[:120],
                "user_id": f"sp_u_{uid}",
                "user_name": uname,
                "rating": rating,
                "detailed_quality": det_quality,
                "comment": raw_comment.replace("\r", " ").replace("\n", " "),
                "timestamp": ts_str,
                "ctime": ctime,
                "has_media": has_media,
                "video_duration_ms": min_video_ms,
                "is_template_video": is_template_video,
                "helpful_votes": likes,
                "is_repeated_purchase": is_repeated,
                "platform": "Shopee",
            }
        )
    print(f"  -> {shop_name} ({shopid}): {len(raw_by_cmtid)} raw ratings -> {len(rows)} text reviews")
    return rows


def apply_weak_supervision_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transparent, multi-signal weak-supervision labeling (Snorkel-style labeling functions)
    directly on 100% REAL Shopee reviews — zero fabricated reviews, zero fake noise injection!
    """
    df = df.copy().reset_index(drop=True)
    n = len(df)

    # 1. Strip Shopee default form headers to get free text
    free_texts = [FORM_HEADER_RE.sub(" ", str(c)).strip() for c in df["comment"]]
    df["free_text"] = free_texts

    # 2. Compute per-shop TF-IDF char_wb max cosine similarity to detect copy-paste templates
    max_cos = np.zeros(n, dtype=np.float64)
    for _, grp in df.groupby("shop_id"):
        idxs = grp.index.to_numpy()
        valid_mask = [len(free_texts[i]) >= 25 for i in idxs]
        valid_idxs = [idxs[k] for k, ok in enumerate(valid_mask) if ok]
        if len(valid_idxs) >= 3:
            vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, max_features=3000)
            mat = vec.fit_transform([free_texts[i].lower() for i in valid_idxs])
            sim = cosine_similarity(mat)
            np.fill_diagonal(sim, 0.0)
            max_vals = sim.max(axis=1)
            for k, orig_i in enumerate(valid_idxs):
                max_cos[orig_i] = float(max_vals[k])

    # 3. Compute temporal burstiness within each shop (15-min window of 5-star reviews)
    burst_15m = np.zeros(n, dtype=np.int32)
    for _, grp in df.groupby("shop_id"):
        idxs = grp.index.to_numpy()
        ctimes = grp["ctime"].to_numpy()
        ratings = grp["rating"].to_numpy()
        for k, orig_i in enumerate(idxs):
            if ratings[k] == 5 and ctimes[k] > 0:
                cnt = int(np.sum((np.abs(ctimes - ctimes[k]) <= 900) & (ratings == 5))) - 1
                burst_15m[orig_i] = max(0, cnt)

    # 4. User repeat count across the same product
    user_prod_counts = df.groupby(["user_id", "product_id"])["review_id"].transform("count").to_numpy()

    # 5. Apply transparent weak-supervision labeling functions (LFs)
    is_seeding = np.zeros(n, dtype=int)
    seeding_type = ["AUTHENTIC"] * n

    for i in range(n):
        ft = free_texts[i]
        ft_low = ft.lower()
        star = int(df.loc[i, "rating"])
        det_q = int(df.loc[i, "detailed_quality"])
        vid_ms = int(df.loc[i, "video_duration_ms"])
        tpl_vid = int(df.loc[i, "is_template_video"])
        words = [w for w in re.split(r"\s+", ft_low) if w]
        n_words = len(words)
        lex_div = len(set(words)) / max(1, n_words)

        # LF1: Explicit Coin-Farming / Spam text on Shopee
        lf_coin = bool(COIN_FARM_RE.search(ft_low)) or (n_words >= 12 and lex_div < 0.42)
        # LF2: Copy-Paste Template (high cosine similarity across different accounts)
        lf_dup = (max_cos[i] >= 0.72 and star == 5)
        # LF3: Short template video / quality-star mismatch (5★ overall but <=3★ product quality or negative words)
        lf_mismatch = (star == 5 and (det_q <= 3 or (NEGATIVE_WORDS_RE.search(ft_low) is not None and len(ft) >= 35)))
        lf_short_vid = (star == 5 and (tpl_vid == 1 or (0 < vid_ms <= 2600)) and n_words <= 14)
        # LF4: Time-Burst 5★ Seeding + Generic Hype or Repeated Account
        lf_hype = len(HYPE_RE.findall(ft_low)) >= 1
        lf_burst = (star == 5 and burst_15m[i] >= 4 and (lf_hype or max_cos[i] >= 0.48 or user_prod_counts[i] >= 2))

        if lf_coin:
            is_seeding[i] = 1
            seeding_type[i] = "COIN_FARM_SPAM"
        elif lf_dup:
            is_seeding[i] = 1
            seeding_type[i] = "TEMPLATE_COPY_PASTE"
        elif lf_mismatch or lf_short_vid:
            is_seeding[i] = 1
            seeding_type[i] = "LOW_EFFORT_MISMATCH"
        elif lf_burst or (star == 5 and lf_hype and n_words >= 15 and df.loc[i, "helpful_votes"] == 0):
            is_seeding[i] = 1
            seeding_type[i] = "TIME_BURST_HYPE"

    df["is_seeding"] = is_seeding
    df["seeding_type"] = seeding_type
    df.drop(columns=["free_text"], inplace=True)
    return df


def main():
    session = requests.Session()
    adapter = HTTPAdapter(pool_connections=32, pool_maxsize=32)
    session.mount("https://", adapter)

    all_rows: List[Dict[str, Any]] = []
    print("Crawling 100% REAL Shopee reviews from 12 Vietnamese Shopee shops...")
    for sid, label, cat in SHOPEE_SHOPS:
        rows = crawl_single_shop(session, sid, label, cat)
        all_rows.extend(rows)
        time.sleep(0.35)

    df = pd.DataFrame(all_rows)
    if df.empty:
        raise RuntimeError("Failed to crawl Shopee reviews!")

    df = df.drop_duplicates(subset=["review_id"]).reset_index(drop=True)
    df = apply_weak_supervision_labels(df)

    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models_saved")
    os.makedirs(out_dir, exist_ok=True)
    out_csv = os.path.join(out_dir, "real_ecommerce_reviews.csv")
    df.to_csv(out_csv, index=False, encoding="utf-8-sig")

    print("\n=== CRAWLED 100% REAL SHOPEE DATASET SUMMARY ===")
    print(f"Saved to: {out_csv}")
    print(f"Total reviews: {len(df)} | Unique comments: {df['comment'].nunique()} | Unique products: {df['product_id'].nunique()}")
    print("Categories:", df["category"].value_counts().to_dict())
    print("Labels (is_seeding):", df["is_seeding"].value_counts().to_dict())
    print("Seeding types:", df["seeding_type"].value_counts().to_dict())


if __name__ == "__main__":
    main()
