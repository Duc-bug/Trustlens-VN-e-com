"""
FastAPI Main Entry Point (`main.py`) for TrustLens VN.
Configures CORS, mounts `/api` routes, and provides health check.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router

app = FastAPI(
    title="TrustLens VN API",
    description=(
        "Hệ thống Soi Review Ảo & Phát hiện Seeding trên Sàn TMĐT Việt Nam "
        "(Shopee, TikTok Shop, Tiki, Lazada, Google Maps) bằng Graph ML + NLP + Explainable AI (SHAP)."
    ),
    version="2.0.0",
