# TrustLens VN - Hệ Thống Phân Tích Đánh Giá & Phát Hiện Seeding TMĐT

Ứng dụng web hỗ trợ người mua hàng kiểm tra độ tin cậy của các đánh giá sản phẩm trên các sàn thương mại điện tử Việt Nam (Shopee, Tiki, TikTok Shop). Hệ thống phân tích văn bản tiếng Việt kết hợp quy luật thời gian và hành vi tài khoản để phát hiện đánh giá ảo, bình luận seeding theo đợt, sao chép văn mẫu hoặc spam nhận xu.

---

## 1. Hướng Dẫn Khởi Chạy Nhanh

### Cách 1: Chạy tự động bằng file bat (Khuyên dùng)
Dự án đã có sẵn file script khởi động cả Backend và Frontend cùng lúc. Chỉ cần click đúp vào file:
```
start_trustlens.bat
```
Sau khi cửa sổ terminal bật lên:
- Giao diện Web: http://localhost:3000
- Tài liệu API (Swagger UI): http://localhost:8001/docs

---

### Cách 2: Chạy thủ công bằng dòng lệnh

**Bước 1: Khởi động Backend (FastAPI)**
Mở terminal tại thư mục dự án:
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```
Backend sẽ lắng nghe tại cổng `8001`.

**Bước 2: Khởi động Frontend (Next.js)**
Mở một terminal mới:
```bash
cd frontend
npm install
npm run dev
```
Giao diện sẽ chạy tại `http://localhost:3000`.

---

## 2. Dữ Liệu (Dataset) & Cơ Chế Cào Dữ Liệu Shopee

### 2.1. Chi tiết về Dataset (`real_ecommerce_reviews.csv`)
File dữ liệu chính nằm tại: `backend/app/models_saved/real_ecommerce_reviews.csv`. 
Đây là tập dữ liệu gồm **2.430 bản ghi đánh giá tiếng Việt** được thu thập từ các sàn thương mại điện tử thực tế tại Việt Nam (Shopee, Tiki...).

#### A. Cấu trúc 16 trường thông tin (Columns):
| Tên cột | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `review_id` | String | Mã định danh duy nhất của mỗi đánh giá |
| `product_id` | String | Mã định danh sản phẩm được đánh giá |
| `user_id` | String | Mã định danh người dùng viết đánh giá |
| `user_name` | String | Tên hiển thị của tài khoản |
| `rating` | Integer | Số sao đánh giá từ 1 đến 5 |
| `comment` | String | Nội dung văn bản bình luận tiếng Việt |
| `timestamp` | Datetime | Thời gian đăng đánh giá (`YYYY-MM-DD HH:MM:SS`) |
| `has_media` | Binary (0/1) | Có đính kèm hình ảnh hoặc video thực tế hay không |
| `verified_purchase`| Binary (0/1) | Đã xác thực mua hàng trên sàn hay chưa |
| `helpful_votes` | Integer | Số lượt người mua khác bấm "Hữu ích" |
| `user_total_reviews`| Integer | Tổng số đánh giá mà tài khoản này đã từng viết |
| `account_age_days` | Integer | Tuổi đời tài khoản (tính theo số ngày) |
| `device_ip_hash` | String | Mã băm thiết bị/IP mạng (dùng phát hiện nhóm tài khoản chung IP) |
| `platform` | String | Nguồn sàn TMĐT (Shopee, Tiki...) |
| `is_seeding` | Binary (0/1) | Nhãn nhị phân: 0 = Thật (Authentic), 1 = Bất thường / Seeding |
| `seeding_type` | String | Nhãn chi tiết phân loại 5 dạng hành vi đánh giá |

#### B. Phân bố các nhóm nhãn (`seeding_type`):
1. **AUTHENTIC (1.558 mẫu - 64.1%):** Đánh giá chân thực của người mua thật, phản ánh ưu/nhược điểm thực tế, khen chê rõ ràng, văn phong tự nhiên.
2. **COIN_FARM_SPAM (292 mẫu - 12.0%):** Bình luận spam để đủ ký tự nhận xu Shopee (chép ca dao tục ngữ, công thức nấu ăn, lời bài hát, bình luận "chưa dùng cứ cho 5 sao"...).
3. **TIME_BURST_SEEDING (249 mẫu - 10.2%):** Các đợt đánh giá dồn dập bất thường trong thời gian ngắn (15 - 30 phút) bởi các tài khoản ảo để đẩy tương tác cho sản phẩm.
4. **AI_MARKETING_SEEDING (173 mẫu - 7.1%):** Đánh giá do AI viết với câu từ bóng bẩy, sáo rỗng, quá trang trọng ("tôi đánh giá cao thiết kế công thái học...").
5. **TEMPLATE_COPY_PASTE (158 mẫu - 6.5%):** Sao chép rập khuôn văn mẫu nhiều lần ("Shop phục vụ rất tốt, đóng gói cẩn thận, giao hàng nhanh 5 sao...").

#### C. Các file dữ liệu bổ trợ:
- `backend/app/models_saved/sample_products.json`: Chứa 5 sản phẩm mẫu thuộc các ngành hàng (Mỹ phẩm, Đồ công nghệ, Gia dụng) có sẵn toàn bộ đánh giá để test trực tiếp trên Web mà không cần mạng.
- `backend/app/models_saved/all_5_models.pkl`: Trọng số các mô hình máy học đã được train sẵn (dung lượng khoảng 1.2 MB), tải về là chạy được ngay không cần train lại.

---

### 2.2. Cơ chế cào dữ liệu Shopee trực tiếp
Mã nguồn cào dữ liệu trực tiếp nằm trong file: `backend/app/ml/data_generator.py` (class `MultiPlatformScraper`).

Hệ thống hỗ trợ 3 hình thức đưa dữ liệu vào phân tích:
1. **Dán link Shopee trực tiếp:** Người dùng dán trực tiếp link sản phẩm Shopee (dạng `https://shopee.vn/...-i.{shopid}.{itemid}` hoặc link rút gọn `https://shp.ee/...`) vào thanh tìm kiếm trên web. Backend sẽ bóc tách `shopid`, `itemid` và gửi request đến API phân trang đánh giá của Shopee để lấy bình luận theo thời gian thực.
2. **Nhập file CSV / JSON:** Người dùng có thể xuất file đánh giá từ các công cụ bên ngoài và tải lên qua nút "Tải lên CSV/JSON" trên giao diện.
3. **Script trích xuất 1-click trên trình duyệt:** Hệ thống cung cấp một đoạn script JavaScript ngắn (lấy tại endpoint `/api/extractor-script`). Khi mở trang Shopee bất kỳ trên Chrome, chỉ cần bật Console (F12) dán vào là tải được file JSON chứa toàn bộ đánh giá đang hiển thị để nạp vào hệ thống.

---

## 3. Cấu Trúc Thư Mục

```text
trustlens-vn/
├── backend/
│   ├── app/
│   │   ├── main.py                 # File khởi động FastAPI, cấu hình CORS
│   │   ├── api/
│   │   │   └── routes.py           # Các API endpoint (/analyze-url, /analyze-csv, /demo-products...)
│   │   ├── ml/
│   │   │   ├── data_generator.py   # Module cào dữ liệu Shopee/Tiki và nạp dữ liệu mẫu
│   │   │   ├── feature_engine.py   # Trích xuất 39 đặc trưng (NLP tiếng Việt, thời gian, đồ thị)
│   │   │   ├── graph_model.py      # Xây dựng đồ thị hành vi người dùng bằng NetworkX
│   │   │   ├── predictor.py        # Module suy luận và chấm điểm độ tin cậy
│   │   │   └── train_benchmark.py  # Script huấn luyện và kiểm thử mô hình
│   │   └── models_saved/           # Chứa file mô hình .pkl và dataset .csv, .json
│   └── requirements.txt            # Thư viện Python cần thiết
├── frontend/
│   ├── src/
│   │   ├── app/                    # Các trang Next.js (App Router)
│   │   ├── components/             # Các component giao diện (TrustScoreCard, ReviewExplorer...)
│   │   └── types/                  # Định nghĩa kiểu dữ liệu TypeScript
│   ├── package.json                # Danh sách package Node.js
│   └── tailwind.config.ts          # Cấu hình giao diện Tailwind
├── start_trustlens.bat             # File khởi động nhanh cả hệ thống cho Windows
└── README.md                       # Hướng dẫn cài đặt và sử dụng
```

---

## 4. Công Nghệ Sử Dụng

- **Backend:** Python 3.10+, FastAPI, Uvicorn, Pandas, Scikit-learn, LightGBM, XGBoost, NetworkX.
- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts.
- **Phương pháp tiếp cận:** Kết hợp xử lý ngôn ngữ tự nhiên tiếng Việt (TF-IDF, n-gram), phân tích chuỗi thời gian phát hiện dồn đơn (Burstiness) và đồ thị mạng lưới hành vi tài khoản để đánh giá độ tin cậy của sản phẩm.
