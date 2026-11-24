# TrustLens VN - Phát Hiện Bình Luận Ảo & Tính Lại Điểm Sao Sản Phẩm Shopee

Ứng dụng web hỗ trợ người mua kiểm tra độ tin cậy của bình luận sản phẩm trên sàn **Shopee Việt Nam**. Hệ thống tự động tải đánh giá công khai, rút trích **20 đặc trưng** (văn bản tiếng Việt, thời gian đăng, hành vi mua hàng), phân loại bằng mô hình **TabPFN v2** và ước lượng lại điểm sao thực tế của sản phẩm.

---

## 1. Hướng Dẫn Chạy Nhanh

### Cách 1: Chạy tự động trên Windows (1-click)
Sau khi cài đặt thư viện ở lần đầu, nhấp đúp vào file:
```bat
start_trustlens.bat
```
- Giao diện Web: `http://localhost:3000`
- Tài liệu API (Swagger): `http://localhost:8001/docs`

### Cách 2: Chạy thủ công bằng dòng lệnh

**Bước 1 – Khởi động Backend (FastAPI, cổng 8001):**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```
*(Hệ thống tự động nhận diện GPU CUDA nếu máy có card rời NVIDIA, hoặc tự chuyển sang chạy trên CPU nếu máy không có GPU).*

**Bước 2 – Khởi động Frontend (Next.js 14, cổng 3000):**
```bash
cd frontend
npm install
npm run dev
```

---

## 2. Bộ Dữ Liệu Thực Tế Shopee (`real_ecommerce_reviews.csv`)

Tập dữ liệu huấn luyện và kiểm thử nằm tại `backend/app/models_saved/real_ecommerce_reviews.csv`, gồm **5.409 bình luận tiếng Việt** (sau khi lọc từ 17.359 lượt đánh giá thô của 1.499 sản phẩm thuộc 11 gian hàng và 7 nhóm ngành hàng trên Shopee Việt Nam).

### Phân bố nhãn (Giám sát yếu theo 4 quy tắc thực tế):
- **`AUTHENTIC` (0):** 4.313 mẫu (79,74%) – Đánh giá hợp lệ của người mua thật.
- **`LOW_EFFORT_MISMATCH` (1):** 357 mẫu (6,60%) – Chấm 5 sao nhưng nội dung phàn nàn hàng lỗi, kém chất lượng.
- **`TEMPLATE_COPY_PASTE` (1):** 335 mẫu (6,19%) – Bình luận 5 sao sao chép văn mẫu trùng lặp cao trong cùng shop.
- **`COIN_FARM_SPAM` (1):** 257 mẫu (4,75%) – Bình luận rác đối phó hoặc xin nhận Shopee Xu.
- **`TIME_BURST_HYPE` (1):** 147 mẫu (2,72%) – Bình luận 5 sao khen chung chung đăng dồn dập trong khung 15 phút.

---

## 3. Cấu Trúc Thư Mục

```text
Trustlens-VN-e-com/
├── backend/
│   ├── app/
│   │   ├── main.py                     # Khởi tạo FastAPI & cấu hình CORS
│   │   ├── api/
│   │   │   └── routes.py               # Các API endpoint (/api/analyze-url, /api/analyze-csv...)
│   │   ├── ml/
│   │   │   ├── crawl_shopee_dataset.py # Script thu thập & tạo bộ dữ liệu 5.409 mẫu Shopee
│   │   │   ├── data_generator.py       # Module tải đánh giá Shopee trực tuyến & bù tỷ lệ sao
│   │   │   ├── feature_engine.py       # Rút trích 20 đặc trưng (12 NLP, 3 Thời gian, 5 Hành vi)
│   │   │   ├── predictor.py            # Suy luận mô hình TabPFN v2 & tính lại điểm sao thực tế
│   │   │   └── train_benchmark.py      # Huấn luyện, kiểm thử Holdout 75/25 & 5-Fold CV
│   │   └── models_saved/               # Lưu dataset CSV, mô hình (.pkl) và kết quả metrics.json
│   └── requirements.txt                # Danh sách thư viện Python
├── frontend/
│   ├── src/
│   │   ├── app/                        # Giao diện chính Next.js 14 (App Router)
│   │   ├── components/                 # Các thành phần hiển thị điểm tin cậy & danh sách review
│   │   └── types/                      # Kiểu dữ liệu TypeScript
│   └── package.json                    # Danh sách thư viện Node.js
├── start_trustlens.bat                 # Script bật nhanh Backend + Frontend trên Windows
└── README.md
```

---

## 4. Chạy Lại Thực Nghiệm So Sánh Mô Hình

Để huấn luyện và xuất lại toàn bộ chỉ số đánh giá vào `backend/app/models_saved/metrics.json`:
```bash
cd backend
python -m app.ml.train_benchmark
```

### Kết quả thực nghiệm trên 20 đặc trưng (Holdout Test $N = 1.353$ & 5-Fold CV $N = 5.409$):

| Mô hình | Accuracy (%) | Precision (%) | Recall (%) | F1 (%) | ROC-AUC (%) | MCC (%) | Brier (↓) | 5-Fold CV F1 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1. Logistic Regression | 95,05 | 93,31 | 81,39 | 86,94 | 96,89 | 84,20 | 0,0417 | 87,03 ± 2,78% |
| 2. Random Forest | 96,16 | 96,25 | 84,31 | 89,88 | 97,93 | 87,82 | 0,0354 | 90,64 ± 2,60% |
| **3. TabPFN v2 (Đề xuất)** | **96,97** | **96,41** | **88,32** | **92,19** | **98,51** | **90,45** | **0,0243** | **92,24 ± 2,88%** |

---

## 5. Công Nghệ Sử Dụng
- **Backend & Học máy:** Python 3.11, FastAPI, PyTorch, TabPFN v2, Scikit-learn, Pandas, NumPy.
- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS, Lucide Icons.
