"""
FastAPI Endpoints for TrustLens VN (`routes.py`).
Provides:
  - GET  /api/demo-products
  - GET  /api/demo-products/{product_id}
  - POST /api/analyze-url
  - POST /api/analyze-csv
  - GET  /api/benchmarks
  - GET  /api/extractor-script
"""

from __future__ import annotations

import io
import json
import os
from typing import Any, Dict, Optional

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.ml.data_generator import MultiPlatformScraper
from app.ml.predictor import TrustLensPredictor

router = APIRouter()

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models_saved")
predictor = TrustLensPredictor(MODELS_DIR)
scraper = MultiPlatformScraper(timeout=10)


class AnalyzeUrlRequest(BaseModel):
    url: str
    cookie: Optional[str] = None


@router.get("/demo-products")
def list_demo_products() -> Dict[str, Any]:
    summaries = []
    for prod in predictor.demo_products:
        meta = prod.get("shopee_live_meta") or {}
        summaries.append({
            "product_id": prod["product_id"],
            "name": prod["name"],
            "platform": prod["platform"],
            "shop_name": prod["shop_name"],
            "price_vnd": prod["price_vnd"],
            "url": prod["url"],
            "image_url": prod.get("image_url") or meta.get("product_image_url") or "",
            "platform_rating": prod["platform_rating"],
            "total_reviews": len(prod.get("reviews", [])),
        })
    return {"products": summaries}


@router.get("/demo-products/{product_id}")
@router.get("/analyze-demo/{product_id}")
def analyze_demo_product(product_id: str) -> Dict[str, Any]:
    for prod in predictor.demo_products:
        if prod["product_id"] == product_id:
            return predictor.analyze_product_payload(prod)
    raise HTTPException(status_code=404, detail=f"Không tìm thấy sản phẩm mẫu: {product_id}")


@router.post("/analyze-url")
def analyze_product_url(payload: AnalyzeUrlRequest) -> Dict[str, Any]:
    url = (payload.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Vui lòng nhập URL sản phẩm hợp lệ.")

    try:
        scraped_product = scraper.scrape_any_url(
            url=url,
            demo_products=predictor.demo_products,
            cookie=payload.cookie,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return predictor.analyze_product_payload(scraped_product)


@router.post("/analyze-csv")
@router.post("/upload-reviews")
async def analyze_uploaded_file(
    file: UploadFile = File(...),
    product_name: Optional[str] = Form("Dữ liệu Đánh giá Tải lên (CSV/JSON)"),
    platform: Optional[str] = Form("Shopee / TikTok Shop"),
) -> Dict[str, Any]:
    raw_bytes = await file.read()
    filename = (file.filename or "upload.csv").lower()

    try:
        if filename.endswith(".json"):
            parsed_json = json.loads(raw_bytes.decode("utf-8-sig"))
            if isinstance(parsed_json, dict) and "reviews" in parsed_json:
                return predictor.analyze_product_payload(parsed_json)
            df = pd.DataFrame(parsed_json)
        else:
            df = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Không thể đọc file CSV/JSON. Vui lòng kiểm tra định dạng ({exc}).",
        )

    if df.empty:
        raise HTTPException(status_code=400, detail="File tải lên không có dòng dữ liệu nào.")

    # Flexible column mapping for real scraped exports from Shopee / TikTok / Tiki / Google Maps
    col_map = {}
    for col in df.columns:
        c_low = col.strip().lower()
        if c_low in ("comment", "content", "text", "review", "review_text", "noi_dung", "binh_luan"):
            col_map[col] = "comment"
        elif c_low in ("rating", "rating_star", "stars", "star", "score", "sao", "diem"):
            col_map[col] = "rating"
        elif c_low in ("timestamp", "created_at", "ctime", "date", "time", "thoi_gian"):
            col_map[col] = "timestamp"
        elif c_low in ("user_name", "username", "author", "author_username", "reviewer", "ten_nguoi_dung"):
            col_map[col] = "user_name"
        elif c_low in ("user_id", "userid", "author_id", "uid"):
            col_map[col] = "user_id"

    df = df.rename(columns=col_map)
    if "comment" not in df.columns:
        # Pick the first text/object column with longest average string length
        str_cols = [c for c in df.columns if df[c].dtype == "object"]
        if str_cols:
            best_col = max(str_cols, key=lambda c: df[c].astype(str).str.len().mean())
            df["comment"] = df[best_col].astype(str)
        else:
            raise HTTPException(
                status_code=400,
                detail="File cần có cột chứa nội dung bình luận (vd: comment, content, text, noi_dung).",
            )

    if "rating" not in df.columns:
        df["rating"] = 5
    if "timestamp" not in df.columns:
        base_ts = pd.Timestamp("2026-10-12 20:00:00")
        df["timestamp"] = [
            (base_ts + pd.Timedelta(minutes=int(i * 3))).strftime("%Y-%m-%d %H:%M:%S")
            for i in range(len(df))
        ]
    if "user_id" not in df.columns:
        df["user_id"] = [f"u_csv_{i:03d}" for i in range(len(df))]
    if "user_name" not in df.columns:
        df["user_name"] = [f"user_{i:03d}" for i in range(len(df))]
    if "review_id" not in df.columns:
        df["review_id"] = [f"csv_rev_{i:03d}" for i in range(len(df))]

    records = df.head(250).to_dict(orient="records")
    product_payload = {
        "product_id": "uploaded-custom-dataset",
        "name": product_name or file.filename or "Sản phẩm Upload CSV/JSON",
        "platform": platform or "Custom Upload",
        "shop_name": "Dữ liệu Thực nghiệm Tải lên",
        "price_vnd": 0,
        "url": f"upload://{file.filename}",
        "crawl_mode": "UPLOADED_CSV_JSON",
        "reviews": records,
    }
    return predictor.analyze_product_payload(product_payload)


@router.get("/benchmarks")
@router.get("/benchmark")
def get_benchmarks() -> Dict[str, Any]:
    return predictor.benchmarks


@router.get("/extractor-script")
def get_browser_extractor_script() -> Dict[str, str]:
    """
    Returns a 1-click DevTools Console JavaScript snippet that extracts live visible reviews
    from Shopee, TikTok Shop, Lazada, or Google Maps directly in the user's browser and downloads JSON.
    """
    js_code = """// === TRUSTLENS VN: 1-CLICK LIVE REVIEW EXTRACTOR (SHOPEE / TIKTOK SHOP / GOOGLE MAPS) ===
// HDSD: Mở trang sản phẩm trên trình duyệt -> Nhấn F12 (Console) -> Dán code này và nhấn Enter.
(() => {
  const reviews = [];
  const nodes = document.querySelectorAll(
    '.shopee-product-rating__main, [data-e2e="review-item"], .jftiEf, .review-item, .item-review'
  );
  nodes.forEach((el, idx) => {
    const text = (el.innerText || '').trim().replace(/\\s+/g, ' ');
    if (text.length > 15) {
      reviews.push({
        review_id: 'live_' + idx,
        user_id: 'u_live_' + (idx % 18),
        user_name: 'user_live_' + idx,
        rating: 5,
        comment: text.slice(0, 380),
        timestamp: new Date(Date.now() - idx * 120000).toISOString().slice(0, 19).replace('T', ' ')
      });
    }
  });
  const blob = new Blob([JSON.stringify({ name: document.title, platform: location.hostname, reviews }, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'trustlens_live_reviews.json';
  a.click();
  console.log('Đã xuất ' + reviews.length + ' đánh giá ra file trustlens_live_reviews.json!');
})();"""
    return {"script": js_code}
