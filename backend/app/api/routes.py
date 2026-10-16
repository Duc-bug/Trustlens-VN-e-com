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
