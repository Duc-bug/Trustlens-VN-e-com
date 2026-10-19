# 🛡️ TrustLens VN – Hệ Thống Kiểm Tra Đánh Giá & Phân Tích Độ Tin Cậy Sản Phẩm TMĐT Bằng Học Máy Đa Phương Thức (5-Model Consensus + Graph ML + NLP)

![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104%2B-009688?logo=fastapi&logoColor=white)
![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js&logoColor=white)
![5-Model Consensus](https://img.shields.io/badge/Ensemble-5--Model%20Stacking%20%2B%20GAT%20Graph%20ML-6366f1)
![Explainable AI](https://img.shields.io/badge/XAI-SHAP%20TreeExplainer-10b981)

**TrustLens VN** là hệ thống Full-Stack Machine Learning hỗ trợ người tiêu dùng kiểm tra chất lượng đánh giá sản phẩm thực tế, phát hiện bình luận seeding theo khung giờ (*Time-Burst*), sao chép văn mẫu (*Template Copy-Paste*), văn phong quảng cáo AI/LLM và bình luận nhận xu trên các sàn thương mại điện tử Việt Nam (**Shopee, TikTok Shop, Tiki, Lazada**) và **Google Maps**.

---

## 🌟 Tính Năng Cốt Lõi (Key Highlights)

1. **Tải Đánh Giá Trực Tiếp Đa Sàn (Live Multi-Platform Crawler & Importer):**
   - **Shopee Deep Live Crawler (`item/get_ratings` + `shop/get_ratings`):** Kết hợp truy vấn trực tiếp theo sản phẩm và phân trang sâu trên luồng đánh giá của Shop (lên tới 1,500 bình luận), đối chiếu chính xác `itemid` trong các đơn hàng ghép nhiều món, tự động loại bỏ quà tặng đính kèm (`[HB GIFT]`, `[GIFT]`) và bóc tách văn bản tự viết (`free_text_word_count`) khỏi khung tiêu đề mẫu của Shopee (`Đúng với mô tả:`, `Chất lượng sản phẩm:`).
   - **Tiki.vn Live API v2:** Tải trực tiếp toàn bộ đánh giá thật, lịch sử tài khoản người mua, hình ảnh thực tế và phản hồi từ nhà bán hàng theo thời gian thực ngay khi dán URL sản phẩm Tiki.
   - **TikTok Shop / Google Maps / Lazada:** Hỗ trợ lấy dữ liệu trực tiếp qua đường dẫn sản phẩm, xuất bình luận từ trình duyệt hoặc tải file `.CSV`/`.JSON` lên hệ thống.
   - **Tập dữ liệu thực nghiệm 2,430 đánh giá tiếng Việt (`real_ecommerce_reviews.csv`):** Phục vụ huấn luyện và kiểm định chéo 5-Fold Cross-Validation.

2. **Kiến Trúc Đồng Thuận 5 Mô Hình Thời Gian Thực (5-Model Live Consensus Architecture - 39 Features):**
   - **Nhóm đặc trưng NLP Tiếng Việt & Lọc Form Mẫu (19 features):** `TfidfVectorizer` (1-2 n-grams) + `TruncatedSVD` (Semantic Embeddings), độ tương đồng văn mẫu cực đại (`nlp_max_cosine_sim`), tỷ lệ từ vựng duy nhất (`nlp_unique_word_ratio`), bộ từ điển nhận diện bình luận nhận xu (`nlp_coin_farm_score`), từ khóa quảng cáo (`nlp_seeding_hype_score`), văn phong AI (`nlp_ai_formality_score`), độ chi tiết trải nghiệm thực tế (`nlp_authentic_nuance_score`) và số từ người mua tự gõ (`free_text_word_count`).
   - **Nhóm đặc trưng Đột biến Thời gian & Hành vi (8 features):** Mật độ dồn đơn trong cửa sổ trượt 15 phút (`temp_reviews_in_15m`), điểm lệch chuẩn đột biến theo giờ (`temp_burst_zscore`), khoảng cách liên tiếp giữa 2 đánh giá (`temp_inter_arrival_log_sec`) và tốc độ viết đánh giá trên tuổi đời tài khoản (`beh_user_review_velocity`).
   - **Nhóm đặc trưng Đồ thị Hành vi & Graph Attention (12 features):** Xây dựng đồ thị tương tác User-Review bằng `NetworkX` (cạnh nối dựa trên đồng xuất hiện khung 15 phút, trùng cụm Thiết bị/IP và độ tương đồng Cosine $> 0.42$), trích xuất `PageRank`, `Degree Centrality`, `Clustering Coefficient`, quy mô thành phần liên thông và **2-Layer Graph Attention Network (GAT) Message Passing Embeddings**.
   - **Chạy đồng thời 5 mô hình trên mỗi sản phẩm (`all_5_models.pkl`):** Mỗi bình luận được chấm điểm song song bởi cả 5 mô hình (**Logistic Regression**, **Random Forest**, **XGBoost**, **LightGBM + GAT**, và **TrustLens Stacking Ensemble**) để đưa ra tỷ lệ đồng thuận minh bạch (`X/5 mô hình nghi ngờ`).

3. **Tổng Hợp Trải Nghiệm Người Mua Thật & Khôi Phục Điểm Thực Tế (True Adjusted Rating):**
   - Tự động trích xuất **Ưu điểm thực tế**, **Nhược điểm & Lưu ý thực tế**, **Phân loại hàng được mua nhiều nhất** và **Lời khuyên mua sắm** từ tập bình luận của khách hàng thật.
   - Tính toán **Điểm thực tế ước tính (`adjusted_rating`)** theo trọng số độ tin cậy liên tục của từng bình luận, giúp phản ánh công tâm cả các phản hồi khen và chê thực chất.

---

## 📂 Cấu Trúc Thư Mục Dự Án (Repository Structure)

```text
trustlens-vn/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI entry point & CORS middleware
│   │   ├── api/
│   │   │   └── routes.py           # Endpoints: /analyze-url, /analyze-csv, /demo-products, /benchmarks
│   │   ├── ml/
│   │   │   ├── data_generator.py   # Shopee Deep Crawler, Tiki/TikTok/GMaps Scraper + 2,430-sample Dataset
│   │   │   ├── feature_engine.py   # Trích xuất 39 đặc trưng: NLP + Form Parser, Temporal Burstiness, Graph ML
│   │   │   ├── graph_model.py      # Đồ thị hành vi NetworkX & 2-Layer Graph Attention (GAT) Message Passing
│   │   │   ├── train_benchmark.py  # Huấn luyện & lưu cả 5 mô hình vào all_5_models.pkl + 5-Fold CV
│   │   │   └── predictor.py        # 5-Model Live Consensus Inference + Real Review Insights + SHAP XAI
│   │   └── models_saved/           # Chứa all_5_models.pkl, model.pkl, metrics.json, real_ecommerce_reviews.csv
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # Trang chính: Dashboard phân tích 3 tab & So sánh trực tiếp 5 mô hình
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── Navbar.tsx          # Thanh điều hướng + Nút mở Bảng Benchmark & Tiện ích lấy dữ liệu (F12)
│   │   │   ├── TrustScoreCard.tsx  # So sánh Điểm Sàn vs Điểm Thực Tế, Phân bố sao & Đồng thuận 5 mô hình
│   │   │   ├── RealReviewInsights.tsx # Tổng hợp Ưu/Nhược điểm từ người mua thật & Phân loại hàng phổ biến
│   │   │   ├── ReviewExplorer.tsx  # Khám phá bình luận, lọc theo số sao (5★-1★), Lightbox ảnh/video & phiếu bầu 5 mô hình
│   │   │   ├── BurstChart.tsx      # Biểu đồ phát hiện đột biến thời gian (Time-burst spikes)
│   │   │   ├── SeedingGraph.tsx    # Đồ thị mạng lưới tương tác các cụm tài khoản (SVG Canvas)
│   │   │   ├── ShapChart.tsx       # Biểu đồ giải thích mô hình bằng SHAP (Explainable AI)
│   │   │   └── BenchmarkModal.tsx  # Bảng kết quả thực nghiệm so sánh 5 thuật toán & Ablation Study
│   │   └── types/
│   │       └── trustlens.ts        # TypeScript Interfaces
│   ├── package.json
│   └── tailwind.config.ts
├── docs/
│   └── REPORT_8_PAGES_CONTENT.md   # Nội dung chi tiết báo cáo học thuật 8 trang (Lý thuyết, Kiến trúc, Thực nghiệm)
└── README.md                       # Tài liệu hướng dẫn cài đặt và sử dụng hệ thống
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy Nhanh (Quick Start)

### Bước 1: Cài đặt & Khởi chạy Backend (FastAPI + 5-Model ML Pipeline)

Mở terminal tại thư mục gốc dự án:

```bash
cd backend
pip install -r requirements.txt

# (Tùy chọn) Huấn luyện lại cả 5 mô hình, kiểm định 5-Fold CV & xuất all_5_models.pkl + metrics.json:
python -m app.ml.train_benchmark

# Khởi động FastAPI Server tại cổng 8000:
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- Tài liệu Swagger UI tự động của Backend: `http://localhost:8000/docs`

### Bước 2: Cài đặt & Khởi chạy Frontend (Next.js 14 Dashboard)

Mở một terminal thứ hai tại thư mục gốc dự án:

```bash
cd frontend
npm install
npm run dev
```

- Mở trình duyệt truy cập: **`http://localhost:3000`**

---

## 📊 Tóm Tắt Kết Quả Thực Nghiệm (5-Model Benchmark trên Tập Test 608 Mẫu & 5-Fold CV)

Hệ thống huấn luyện và đánh giá độc lập 5 mô hình trên tập dữ liệu **2,430 đánh giá tiếng Việt** (1,822 mẫu Train / 608 mẫu Test):

| Mô Hình Thực Nghiệm | Nhóm Đặc Trưng Sử Dụng | Accuracy (%) | Precision (%) | Recall (%) | F1-Score (%) | 5-Fold CV F1 (%) | ROC-AUC (%) | MCC (%) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Logistic Regression** *(Baseline 1)* | NLP Only (19 features) | 91.61% | 89.45% | 87.44% | 88.44% | 88.24% ± 1.66% | 96.44% | 81.94% |
| **2. Random Forest** *(Baseline 2)* | NLP + Temporal (22 features) | 95.89% | 96.73% | 91.93% | 94.27% | 93.78% ± 1.71% | 97.45% | 91.12% |
| **3. XGBoost** *(Strong Baseline 3)* | NLP + Temporal + Tabular (27 features) | 97.53% | 97.71% | 95.52% | 96.60% | 95.58% ± 1.48% | 98.48% | 94.68% |
| **4. LightGBM + GAT** *(Graph Hybrid 4)* | Full 39 Features (NLP + Temporal + GAT) | 97.70% | 98.16% | 95.52% | 96.82% | 95.71% ± 1.40% | 98.61% | 95.04% |
| **5. TrustLens Stacking Ensemble (Proposed)** | **Out-of-Fold Stacking (LGBM + XGB + RF + Meta-Learner, 39 features)** | **98.03%** | **98.62%** | **95.96%** | **97.27%** | **96.26% ± 1.01%** | **98.79%** | **95.76%** |

---

## 📄 Báo Cáo Học Thuật Chi Tiết

Toàn bộ cơ sở lý thuyết, công thức toán học (Graph Attention Network, Out-of-Fold Stacking Meta-Learner, Reliability-Weighted True Rating), bảng mô tả 39 đặc trưng và phân tích Ablation Study đã được biên soạn đầy đủ tại:
👉 **[`docs/REPORT_8_PAGES_CONTENT.md`](docs/REPORT_8_PAGES_CONTENT.md)**
