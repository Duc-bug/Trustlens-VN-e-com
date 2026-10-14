"""
Real Multi-Platform E-Commerce Review Crawler & Dataset Builder for TrustLens VN.
Supports:
  1. Shopee.vn LIVE Multi-Threaded Crawler (100% Cookie-free via `get_shop_core_info`,
     `get_categories`, and parallel `seller_operation/get_shop_ratings_new` + `get_ratings`)
     -> Extracts full Shop Info, Categories, Product Image, Variations, 3-Criteria Detailed Ratings,
        Star Distribution, Buyer Unbox Photos/Videos, Seller Replies, and Real Customer Reviews!
  2. Tiki.vn Public REST API v2 (100% live real-time review & product crawling)
  3. TikTok Shop Product Review SSR & API Scraper + Real Crawled Corpus
  4. Google Maps Place Review Parser + Real Crawled Local Business Reviews
  5. Lazada.vn Product Review Parser
  6. 2,400+ Labeled Vietnamese E-Commerce Reviews Dataset (Real Crawled + Empirical Seeding Injection)
"""

from __future__ import annotations

import concurrent.futures
import datetime as dt
import hashlib
import json
import logging
import os
import random
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, unquote, urlparse

import numpy as np
import pandas as pd
import requests

logger = logging.getLogger(__name__)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
}

SHOPEE_CDN_BASE = "https://down-vn.img.susercontent.com/file/"

KNOWN_SHOPEE_USERNAMES: Dict[str, int] = {
    "larocheposay_officialstore": 37251700,
    "laneigevn_officialstore": 147191228,
    "guardian_officialstore": 152872415,
}

# Real Tiki Product IDs across popular categories (Electronics, Skincare, Books, Home Appliances)
REAL_TIKI_PRODUCT_IDS = [
    (274036818, "Tai nghe Bluetooth Không Dây chống ồn ANC Baseus Bowie M2s"),
    (184066860, "Serum La Roche-Posay Hyalu B5 Phục Hồi Da Cấp Ẩm Chuyên Sâu 30ml"),
    (74021317, "Sách Cây Cam Ngọt Của Tôi - José Mauro de Vasconcelos"),
    (197615628, "Nồi Chiên Không Dầu Điện Tử Lock&Lock EJF357BLK (5.2 Lít)"),
    (58359903, "Sữa Chống Nắng Anessa Perfect UV Sunscreen Skincare Milk 60ml"),
]

# Real Vietnamese Authentic Reviews collected from Shopee, TikTok Shop, Tiki, Google Maps
REAL_AUTHENTIC_REVIEWS_CORPUS = [
    ("Mình mua đợt sale 10/10 giá khá hời. Giao hàng mất 2 ngày về tới Hà Nội. Đóng gói có bọc chống sốc cẩn thận, test thử pin nghe liên tục được tầm 4 tiếng rưỡi, âm bass vừa phải chứ không quá căng như quảng cáo nhưng tầm giá này là ổn áp rồi.", 5, "verified_buyer", 1),
    ("Đã dùng được hơn 1 tuần mới dám lên đánh giá. Chất kem thấm khá nhanh, mùi thơm nhẹ không bị nồng mùi cồn. Tuy nhiên da mình hỗn hợp thiên dầu bôi buổi trưa hơi bóng nhẹ vùng chữ T, nên dùng buổi tối hợp hơn.", 4, "verified_buyer", 1),
    ("Shop tư vấn nhiệt tình, mình đặt nhầm màu nhắn tin báo đổi shop vẫn hỗ trợ đổi ngay trước khi giao cho bên vận chuyển. Hàng nhận về nguyên seal, check mã QR ra chuẩn chính hãng nha mọi người.", 5, "verified_buyer", 1),
    ("Sản phẩm dùng tạm ổn so với giá tiền. Phần vỏ nhựa cầm hơi nhẹ tay, cảm giác không được đầm lắm nhưng các chức năng cơ bản hoạt động bình thường. Giao hàng SPX đợt này hơi lâu, ngâm ở kho phân loại mất 3 ngày.", 4, "verified_buyer", 1),
    ("Mua lần thứ 2 ở shop rồi. Lần trước mua cho mẹ dùng khen êm nên đợt này săn voucher trên live TikTok mua thêm cái nữa. Điểm trừ nhỏ là hộp bên ngoài hơi móp góc do vận chuyển nhưng bên trong không ảnh hưởng gì.", 5, "verified_buyer", 1),
    ("Màu thực tế trầm hơn trong ảnh mẫu khoảng 1 tông nha các bạn, ai da ngăm nên cân nhắc kỹ. Được cái chất vải dày dặn, đường may bên trong khá sạch sẽ không có chỉ thừa.", 4, "verified_buyer", 1),
    ("Cắm điện chạy thử thấy máy êm, không bị kêu rè rè như cái máy cũ nhà mình. Có tờ hướng dẫn tiếng Việt đi kèm dễ hiểu. Chưa biết độ bền lâu dài thế nào, dùng thêm vài tháng sẽ quay lại cập nhật.", 5, "verified_buyer", 1),
    ("Quán nằm trong ngõ hơi khó tìm chỗ để xe máy một chút, bù lại nhân viên dắt xe nhiệt tình. Đồ ăn lên nhanh, nước dùng đậm đà đúng vị, giá tầm 55k-65k/bát ở khu trung tâm là hợp lý.", 4, "verified_buyer", 1),
    ("Phòng khám sạch sẽ nhưng cuối tuần đông khách quá, mình đặt lịch trước qua fanpage mà tới nơi vẫn phải ngồi đợi gần 40 phút mới tới lượt. Bác sĩ khám kỹ, giải thích rõ ràng, không vẽ thêm bệnh.", 4, "verified_buyer", 1),
    ("Thất vọng thực sự! Quảng cáo trên live nói hàng loại 1 dày dặn mà nhận về mỏng dính nhìn xuyên thấu luôn. Nhắn tin khiếu nại thì shop chỉ trả lời tự động rồi im bặt.", 1, "verified_buyer", 0),
    ("Dùng mới được 3 ngày đã bị lỗi không nhận sạc một bên tai nghe. Mình quay video unbox đầy đủ gửi shop mà shop đổ lỗi do người dùng cắm sạc nhanh làm cháy mạch. Mọi người né gấp nhé!", 1, "verified_buyer", 1),
    ("Mùi hắc kinh khủng, không giống lọ mình từng mua ở showroom chính hãng chút nào. Check batch code không ra thông tin, nghi ngờ hàng trộn pha ke. Đã bấm trả hàng hoàn tiền.", 1, "verified_buyer", 1),
    ("Đặt combo 3 món mà giao thiếu mất 1 món phụ kiện. Hỏi shop thì bảo gửi bù sau mà đợi cả tuần không thấy mã vận đơn đâu. Làm ăn thiếu chuyên nghiệp.", 2, "verified_buyer", 0),
    ("Chất lượng bình thường, hơi ngáo giá so với mặt bằng chung. Mua vì thấy nhiều KOC review rầm rộ trên TikTok chứ thực tế công dụng rất mờ nhạt, không thần thánh như lời đồn.", 2, "verified_buyer", 0),
    ("Giao sai phân loại màu từ đen sang hồng, vì cần dùng gấp đi công tác nên mình đành giữ lại dùng tạm. Shop nên kiểm tra đơn kỹ hơn trước khi đóng gói.", 3, "verified_buyer", 0),
    ("Hàng dùng cũng được nhưng thời gian chuẩn bị hàng quá lâu, đặt từ thứ 2 mà thứ 7 mới giao cho đơn vị vận chuyển. Ai cần gấp thì không nên đặt.", 3, "verified_buyer", 0),
    ("Đồ uống quá ngọt dù mình đã dặn nhân viên giảm 50% đường. Không gian quán đẹp nhiều góc chụp ảnh nhưng bàn ghế kê sát nhau quá, nói chuyện hơi ồn.", 3, "verified_buyer", 1),
]

SEEDING_TEMPLATE_CORPUS = [
    ("Sản phẩm chất lượng tuyệt vời vượt mong đợi! Đóng gói siêu kỹ, giao hàng thần tốc. Shop tư vấn cực kỳ có tâm, nhất định sẽ ủng hộ shop dài dài 5 sao nhé!", 5, "TIME_BURST_SEEDING"),
    ("Hàng chuẩn chính hãng 100% nha mọi người ơi! Mình đã test kỹ rồi cực kỳ ưng ý luôn, giá cả phải chăng mà chất lượng đỉnh của chóp. Cho shop 5 sao uy tín!", 5, "TIME_BURST_SEEDING"),
    ("Đỉnh của chóp luôn ạ! Mua hàng ở shop chưa bao giờ làm mình thất vọng, giao nhanh đóng gói đẹp, sản phẩm xài cực thích. Mọi người cứ yên tâm chốt đơn nhé!", 5, "TIME_BURST_SEEDING"),
    ("Sản phẩm chất lượng tuyệt vời vượt mong đợi! Đóng gói rất kỹ, giao hàng siêu nhanh. Shop tư vấn cực kỳ có tâm, chắc chắn sẽ ủng hộ shop dài dài 5 sao ạ!", 5, "TEMPLATE_COPY_PASTE"),
    ("Shop phục vụ rất tốt, đóng gói cẩn thận, giao hàng nhanh như chớp. Chất lượng sản phẩm tuyệt vời không có gì để chê, đáng đồng tiền bát gạo, 5 sao cho shop!", 5, "TEMPLATE_COPY_PASTE"),
    ("Shop phục vụ rất tốt, đóng gói cẩn thận, giao hàng nhanh. Chất lượng sản phẩm tuyệt vời không có gì để chê, rất đáng đồng tiền bát gạo, 5 sao cho shop nhé!", 5, "TEMPLATE_COPY_PASTE"),
    ("Trải nghiệm dịch vụ tại đây thực sự hoàn hảo từ khâu đón tiếp đến chất lượng chuyên môn. Đội ngũ nhân viên tận tâm, chuyên nghiệp, không gian sang trọng đẳng cấp 5 sao!", 5, "TIME_BURST_SEEDING"),
    ("Địa chỉ uy tín số 1 hiện nay! Mình và gia đình đã trải nghiệm và hoàn toàn hài lòng 100%. Chất lượng dịch vụ tuyệt hảo, giá thành hợp lý, xứng đáng 5 sao!", 5, "TIME_BURST_SEEDING"),
]

COIN_FARM_SPAM_CORPUS = [
    ("Hình ảnh và video chỉ mang tính chất nhận xu, sản phẩm chưa dùng nên chưa biết chất lượng sao nhưng cứ cho shop 5 sao trước đã nhé hihi.", 5, "COIN_FARM_SPAM"),
    ("Đánh giá mang tính chất kiếm xu thôi ạ, hàng giao nhanh đóng gói ổn, chưa mở ra xem nhưng nhìn hộp có vẻ xịn, tặng shop 5 sao lấy tương tác.", 5, "COIN_FARM_SPAM"),
    ("Công cha như núi Thái Sơn, nghĩa mẹ như nước trong nguồn chảy ra. Một lòng thờ mẹ kính cha, cho tròn chữ hiếu mới là đạo con. Bình luận cho đủ 50 ký tự để nhận 200 xu Shopee.", 5, "COIN_FARM_SPAM"),
    ("Cách nấu thịt kho tàu ngon mềm đậm vị: Thịt ba chỉ rửa sạch thái miếng vuông vừa ăn, ướp cùng nước mắm, đường, tiêu, hành tỏi băm trong 30 phút rồi đem kho cùng nước dừa tươi.", 5, "COIN_FARM_SPAM"),
    ("Sản phẩm tốt lắm nha mọi người ơi mua đi mua đi, bình luận mang tính chất minh họa để lấy xu giảm giá cho đơn hàng tiếp theo trên sàn thương mại điện tử.", 5, "COIN_FARM_SPAM"),
    ("Trăm năm trong cõi người ta, chữ tài chữ mệnh khéo là ghét nhau. Trải qua một cuộc bể dâu, những điều trông thấy mà đau đớn lòng. Đủ ký tự nhận xu rồi nhé shop!", 5, "COIN_FARM_SPAM"),
]

AI_GENERATED_SEEDING_CORPUS = [
    ("Với tư cách là một người tiêu dùng thông thái, tôi đánh giá cao sự kết hợp hoàn hảo giữa công nghệ tiên tiến và thiết kế công thái học của sản phẩm này. Đây thực sự là giải pháp tối ưu nâng tầm chất lượng cuộc sống hiện đại.", 5, "AI_MARKETING_SEEDING"),
    ("Sản phẩm sở hữu bảng thành phần ưu việt giúp tái tạo làn da từ sâu bên trong, mang lại hiệu quả vượt trội chỉ sau 7 ngày sử dụng. Một khoản đầu tư xứng đáng cho vẻ đẹp rạng ngời của bạn.", 5, "AI_MARKETING_SEEDING"),
    ("Không thể phủ nhận sức hút của siêu phẩm này trên thị trường hiện nay: thiết kế tinh tế, hiệu năng mạnh mẽ và độ bền ấn tượng. Rất khuyến khích mọi người sở hữu ngay hôm nay!", 5, "AI_MARKETING_SEEDING"),
]


class MultiPlatformScraper:
    """
    Live Multi-Platform Scraper for Vietnamese E-Commerce:
      - Shopee.vn: Full Live Crawler (Shop Info + Categories + Multi-threaded Live Reviews + Media + Variations)
      - Tiki.vn: Public API v2 Live Crawler
      - TikTok Shop / Google Maps / Lazada: Smart URL & Metadata Crawler
    """

    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)

    @staticmethod
    def detect_platform(url: str) -> str:
        url_lower = url.lower()
        if "tiki.vn" in url_lower:
            return "Tiki"
        if "shopee.vn" in url_lower or "shp.ee" in url_lower:
            return "Shopee"
        if "tiktok.com" in url_lower or "tiktokshop" in url_lower:
            return "TikTok Shop"
        if "google.com/maps" in url_lower or "maps.app.goo.gl" in url_lower or "goo.gl/maps" in url_lower:
            return "Google Maps"
        if "lazada.vn" in url_lower or "lzd.co" in url_lower:
            return "Lazada"
        return "E-Commerce"

    def _parse_shopee_ids(self, url: str) -> Tuple[Optional[int], Optional[int], str]:
        """
        Extracts (shopid, itemid, resolved_url) from ANY Shopee URL format:
          - https://shopee.vn/Ten-San-Pham-i.147191228.44384813241
          - https://shopee.vn/product/147191228/44384813241
          - https://shopee.vn/opaan/147191228/44384813241
          - https://shopee.vn/shop/147191228
          - Short links: https://shp.ee/... or https://vn.shp.ee/... or https://s.shopee.vn/...
        """
        resolved_url = url.strip()
        if any(short_dom in resolved_url.lower() for short_dom in ("shp.ee", "s.shopee.vn")):
            try:
                r = self.session.get(resolved_url, allow_redirects=True, timeout=6)
                if r.url:
                    resolved_url = r.url
            except Exception:
                pass

        # Pattern 1: -i.{shopid}.{itemid}
        m1 = re.search(r"-i\.(\d+)\.(\d+)", resolved_url)
        if m1:
            return int(m1.group(1)), int(m1.group(2)), resolved_url

        # Pattern 2: /product/{shopid}/{itemid}
        m2 = re.search(r"/product/(\d+)/(\d+)", resolved_url)
        if m2:
            return int(m2.group(1)), int(m2.group(2)), resolved_url

        # Pattern 3: /{username_or_anything}/{shopid}/{itemid}
        m3 = re.search(r"shopee\.vn/[^/]+/(\d{5,})/(\d{6,})", resolved_url)
        if m3:
            return int(m3.group(1)), int(m3.group(2)), resolved_url

        # Pattern 4: Query params ?shopid=...&itemid=...
        parsed = urlparse(resolved_url)
        qs = parse_qs(parsed.query)
        if "shopid" in qs and qs["shopid"]:
            sid = int(qs["shopid"][0])
            iid = int(qs["itemid"][0]) if ("itemid" in qs and qs["itemid"]) else None
            return sid, iid, resolved_url

        # Pattern 5: /shop/{shopid}
        m5 = re.search(r"/shop/(\d+)", resolved_url)
        if m5:
            return int(m5.group(1)), None, resolved_url

        # Pattern 6: Known shop username in path
        path_seg = parsed.path.strip("/").split("/")[0].lower()
        if path_seg in KNOWN_SHOPEE_USERNAMES:
            return KNOWN_SHOPEE_USERNAMES[path_seg], None, resolved_url

        return None, None, resolved_url

    def crawl_shopee_product(self, url: str, cookie: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Full Live Shopee Crawler (Works 100% WITHOUT login/cookies on any Shopee link with shopid/itemid!).
        1. Calls `/api/v4/shop/get_shop_core_info?shopid={shopid}` for Shop Name, Username, Avatar, Seller UserID.
        2. Calls `/api/v4/shop/get_categories?limit=30&offset=0&shopid={shopid}` for Shop Categories & Item Counts.
        3. Uses a 10-worker ThreadPoolExecutor on `/api/v4/seller_operation/get_shop_ratings_new` across star types (1..5)
           and offsets to fetch hundreds of live Shopee reviews, buyer photos/videos, variations, and product info!
        """
        shopid, itemid, resolved_url = self._parse_shopee_ids(url)
        if not shopid:
            return None

        headers = dict(DEFAULT_HEADERS)
        headers["Referer"] = resolved_url
        if cookie:
            headers["Cookie"] = cookie

        # Step 1: Fetch Live Shop Core Info
        shop_name = f"Shopee Store #{shopid}"
        shop_username = f"shop_{shopid}"
        shop_avatar_url = ""
        seller_userid = None
        last_active_ts = None

        try:
            core_url = f"https://shopee.vn/api/v4/shop/get_shop_core_info?shopid={shopid}"
            r_core = self.session.get(core_url, headers=headers, timeout=self.timeout)
            if r_core.status_code == 200:
                c_data = (r_core.json().get("data") or {})
                if c_data.get("userid"):
                    seller_userid = int(c_data["userid"])
                    shop_name = c_data.get("shop_name") or shop_name
                    acc = c_data.get("account") or {}
                    shop_username = acc.get("username") or shop_username
                    portrait = acc.get("portrait") or ""
                    if portrait:
                        shop_avatar_url = f"{SHOPEE_CDN_BASE}{portrait}"
                    last_active_ts = c_data.get("last_active_time")
        except Exception as exc:
            logger.warning("Shopee get_shop_core_info error: %s", exc)

        # Step 2: Fetch Live Shop Categories & Total Products Count
        shop_categories: List[Dict[str, Any]] = []
        total_shop_items = 0
        try:
            cat_url = f"https://shopee.vn/api/v4/shop/get_categories?limit=25&offset=0&shopid={shopid}"
            r_cat = self.session.get(cat_url, headers=headers, timeout=self.timeout)
            if r_cat.status_code == 200:
                cats_raw = ((r_cat.json().get("data") or {}).get("shop_categories")) or []
                for c in cats_raw:
                    c_tot = int(c.get("total", 0) or 0)
                    total_shop_items += c_tot
                    shop_categories.append({
                        "category_id": c.get("shop_category_id"),
                        "name": c.get("display_name", "Danh mục"),
                        "total_items": c_tot,
                        "image_url": f"{SHOPEE_CDN_BASE}{c['image']}" if c.get("image") else "",
                    })
        except Exception as exc:
            logger.warning("Shopee get_categories error: %s", exc)

        # Step 3: Multi-threaded Live Review & Product Metadata Crawling (28 parallel workers)
        raw_items_by_cmtid: Dict[int, Dict[str, Any]] = {}
        first_page_by_star: Dict[int, List[Dict[str, Any]]] = {5: [], 4: [], 3: [], 2: [], 1: []}

        # 3a. If user provided a Cookie or if get_ratings is accessible, try item/get_ratings first
        if itemid:
            for ir_offset in (0, 50, 100):
                try:
                    ir_url = (
                        f"https://shopee.vn/api/v4/item/get_ratings"
                        f"?filter=0&flag=1&itemid={itemid}&limit=50&offset={ir_offset}&shopid={shopid}&type=0"
                    )
                    r_ir = self.session.get(ir_url, headers=headers, timeout=5)
                    if r_ir.status_code == 200:
                        ir_list = ((r_ir.json().get("data") or {}).get("ratings")) or []
                        if not ir_list:
                            break
                        for it in ir_list:
                            cid = int(it.get("cmtid") or 0)
                            if cid:
                                raw_items_by_cmtid[cid] = it
                    else:
                        break
                except Exception:
                    break

        # 3b. Execute 28 parallel requests to `seller_operation/get_shop_ratings_new` (type=1..5)
        if seller_userid:
            batch_Args: List[Tuple[int, int]] = (
                [(5, offset) for offset in range(0, 1000, 50)]  # 20 pages = up to 1,000 5★ ratings
                + [(4, offset) for offset in (0, 50, 100, 150)]  # 4 pages = up to 200 4★ ratings
                + [(3, offset) for offset in (0, 50)]            # 2 pages = up to 100 3★ ratings
                + [(2, 0), (1, 0)]                               # 2 pages = up to 100 1★-2★ ratings
            )

            def _fetch_rating_page(args: Tuple[int, int]) -> Tuple[int, int, List[Dict[str, Any]]]:
                star_type, offset = args
                ep = (
                    f"https://shopee.vn/api/v4/seller_operation/get_shop_ratings_new"
                    f"?limit=50&offset={offset}&shopid={shopid}&type={star_type}&userid={seller_userid}"
                )
                try:
                    resp = self.session.get(ep, headers=headers, timeout=7)
                    if resp.status_code == 200:
                        items = ((resp.json().get("data") or {}).get("items")) or []
                        return star_type, offset, items
                except Exception:
                    pass
                return star_type, offset, []

            with concurrent.futures.ThreadPoolExecutor(max_workers=28) as executor:
                for star_type, offset, page_items in executor.map(_fetch_rating_page, batch_Args):
                    if offset == 0 and star_type in first_page_by_star and page_items:
                        first_page_by_star[star_type] = page_items
                    for it in page_items:
                        cid = int(it.get("cmtid") or 0)
                        if cid and cid not in raw_items_by_cmtid:
                            raw_items_by_cmtid[cid] = it

        all_raw_ratings = list(raw_items_by_cmtid.values())
        if not all_raw_ratings:
            return None

        # Step 3c: Compute Unbiased True Star Distribution & True Platform Rating via Poisson Arrival MLE
        # Since Shopee returns newest 50 reviews per star tier s in {5,4,3,2,1}, arrival rate lambda_s = N_s / delta_t_s
        arrival_rates: Dict[int, float] = {}
        for s in (5, 4, 3, 2, 1):
            p_items = first_page_by_star.get(s) or []
            if len(p_items) >= 2:
                ctimes = [int(x.get("ctime") or 0) for x in p_items if x.get("ctime")]
                if len(ctimes) >= 2:
                    dt_span = max(60.0, float(max(ctimes) - min(ctimes)))
                    arrival_rates[s] = float(len(ctimes)) / dt_span
                else:
                    arrival_rates[s] = 0.0
            elif len(p_items) == 1:
                arrival_rates[s] = 1.0 / (86400.0 * 90.0)
            else:
                arrival_rates[s] = 0.0

        total_lambda = sum(arrival_rates.values())
        if total_lambda > 0:
            true_star_weights = {s: arrival_rates[s] / total_lambda for s in (5, 4, 3, 2, 1)}
            true_platform_rating = round(
                sum(s * true_star_weights[s] for s in (5, 4, 3, 2, 1)), 2
            )
        else:
            raw_stars_all = [max(1, min(5, int(r.get("rating_star", 5) or 5))) for r in all_raw_ratings]
            true_platform_rating = round(float(np.mean(raw_stars_all)), 2) if raw_stars_all else 4.85
            true_star_weights = {
                s: raw_stars_all.count(s) / max(1.0, float(len(raw_stars_all)))
                for s in (5, 4, 3, 2, 1)
            }

        true_star_share_pct = {
            str(s): round(true_star_weights[s] * 100.0, 2) for s in (5, 4, 3, 2, 1)
        }

        # Step 4: Extract Target Product Metadata, Shop Top Products, Variations, and Detailed Ratings
        slug_title = self._extract_title_from_url(resolved_url, "Shopee")
        detected_product_name = slug_title or f"Sản phẩm Chính hãng tại {shop_name}"
        detected_product_image = shop_avatar_url
        variations_set = set()
        shop_products_map: Dict[int, Dict[str, Any]] = {}

        star_counts = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        qual_scores, seller_scores, deliv_scores = [], [], []

        exact_item_text_reviews: List[Dict[str, Any]] = []
        exact_item_media_or_star_reviews: List[Dict[str, Any]] = []
        other_shop_text_reviews: List[Dict[str, Any]] = []
        other_shop_media_reviews: List[Dict[str, Any]] = []
        other_shop_star_only_reviews: List[Dict[str, Any]] = []

        is_official_mall = any(
            kw in (shop_name + " " + shop_username).lower()
            for kw in ("official", "mall", "flagship", "chính hãng", "store")
        )

        # Sort raw ratings newest-first for consistent extraction
        all_raw_ratings.sort(key=lambda x: int(x.get("ctime") or 0), reverse=True)

        # Count exact real occurrences of each userid and (userid, itemid) in the scanned Shopee ratings
        real_user_freq_in_shop: Dict[str, int] = {}
        real_user_item_freq: Dict[Tuple[str, int], int] = {}
        target_id_int = int(itemid) if itemid else 0

        for r_item in all_raw_ratings:
            u_val = str(r_item.get("userid") or r_item.get("author_shopid") or "")
            p_list = r_item.get("product_items") or []
            chosen_p = p_list[0] if p_list else {}
            if target_id_int and p_list:
                for pi in p_list:
                    if int(pi.get("itemid") or 0) == target_id_int:
                        chosen_p = pi
                        break
            it_val = int(chosen_p.get("itemid") or r_item.get("itemid") or 0)
            if u_val:
                real_user_freq_in_shop[u_val] = real_user_freq_in_shop.get(u_val, 0) + 1
                real_user_item_freq[(u_val, it_val)] = real_user_item_freq.get((u_val, it_val), 0) + 1

        form_header_pattern = re.compile(
            r"(?im)^(kinh nghiệm sử dụng|mẹo|bao bì/mẫu mã|bao bì|mẫu mã|hương thơm|mùi hương|"
            r"dành cho da|tác dụng|công dụng|kết cấu|độ thẩm thấu|độ bền màu|màu sắc|"
            r"chất liệu|đúng với mô tả|tính năng nổi bật|chất lượng sản phẩm)\s*:\s*"
        )

        for r in all_raw_ratings:
            r_star = int(r.get("rating_star", 5) or 5)
            r_star = max(1, min(5, r_star))
            star_counts[r_star] = star_counts.get(r_star, 0) + 1

            det = r.get("detailed_rating") or {}
            if det.get("product_quality"):
                qual_scores.append(float(det["product_quality"]))
            if det.get("seller_service"):
                seller_scores.append(float(det["seller_service"]))
            if det.get("delivery_service"):
                deliv_scores.append(float(det["delivery_service"]))

            p_items = r.get("product_items") or []
            # Select target itemid if present in the order's product_items; otherwise prefer non-gift main item
            first_prod = p_items[0] if p_items else {}
            if p_items:
