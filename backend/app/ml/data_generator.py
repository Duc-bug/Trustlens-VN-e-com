from __future__ import annotations

import concurrent.futures
import datetime as dt
import hashlib
import html
import json
import logging
import os
import random
import re
import time
import unicodedata
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import numpy as np
import pandas as pd
import requests
from requests.adapters import HTTPAdapter

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


class MultiPlatformScraper:

    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.session = requests.Session()
        adapter = HTTPAdapter(pool_connections=64, pool_maxsize=64)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self.session.headers.update(DEFAULT_HEADERS)
        self._price_cache: Dict[str, int] = {}
        self._market_similar_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._shop_raw_cache: Dict[int, Dict[str, Any]] = {}

    @staticmethod
    def _extract_real_buyer_prices_vnd(comments: Optional[List[str]] = None) -> List[int]:
        found_prices: List[int] = []
        if not comments:
            return found_prices
        for txt in comments:
            if not txt:
                continue
            s_txt = str(txt)
            for m_k in re.finditer(
                r"(?i)(?<!giảm\s)(?<!trừ\s)(?<!bớt\s)(?<!voucher\s)(?<!mã\s)(?:giá|mua|còn|săn|sale|tầm|khoảng|chỉ|tới)\s*(\d{2,4})\s*(?:k|cành|ngàn|nghìn)(?!\s*xu)\b",
                s_txt,
            ):
                val = int(m_k.group(1)) * 1000
                if 20000 <= val <= 15000000:
                    found_prices.append(val)
            for m_d in re.finditer(
                r"(?i)(?<!giảm\s)(?<!trừ\s)(?<!voucher\s)\b(\d{2,4})[.,](\d{3})\s*(?:đ|₫|vnd|vnđ|đồng)\b",
                s_txt,
            ):
                val = int(m_d.group(1)) * 1000 + int(m_d.group(2))
                if 20000 <= val <= 15000000:
                    found_prices.append(val)
        return found_prices

    def _lookup_market_price_vnd(self, product_name: str, single_query: bool = False) -> int:
        if not product_name:
            return 0
        norm_name = unicodedata.normalize("NFC", str(product_name)).strip()
        cache_key = norm_name.lower()
        if cache_key in self._price_cache and (single_query or cache_key in self._market_similar_cache):
            return self._price_cache[cache_key]

        s = re.sub(r"\[[^\]]*\]", " ", norm_name)
        s = re.sub(r"\s*-\s*[A-Z]{1,5}\d{1,4}\s*$", " ", s)
        s = re.sub(r"(?i)\bthương hiệu\s+\S+(?:\s+\S+)?", " ", s)
        s = re.sub(
            r"(?i)\b(hàng chính hãng|bảo hành \d+\s*(?:năm|tháng)|thương hiệu|cam kết|chính hãng|độc quyền|freeship|giao nhanh|tặng kèm|mua \d+ tặng \d+|(?:upto|turbo)\s*[\d.]*\s*ghz|[\d.]+\s*ghz|chống nước\s*\w*|pin\s*\d+\s*giờ|cao cấp|dành cho|sử dụng cho|phù hợp cho)\b",
            " ",
            s,
        )
        s = re.sub(r"(\w+)/\w+", r"\1", s)
        s = re.sub(r"(?:\s+-\s+|\s*[|,/()]+\s*)", " ", s)
        words = [w for w in s.split() if len(w) > 1 or w.isdigit()]
        if not words:
            return 0

        important: List[str] = []
        stop_prev = {"và", "cho", "da", "dầu", "thường", "sâu", "từ", "điện", "tử", "làm", "sạch"}
        for idx, w in enumerate(words[6:], start=6):
            if re.search(r"\d", w) and not re.search(r"(?i)ghz|lớp|tờ", w):
                if (
                    idx - 1 >= 6
                    and words[idx - 1] not in important
                    and not re.search(r"\d", words[idx - 1])
                    and words[idx - 1].lower() not in stop_prev
                ):
                    important.append(words[idx - 1])
                important.append(w)

        query_words = words[:6] + [w for w in important if w not in words[:6]]
        no_combo = [w for w in words if w.lower() not in ("combo", "bộ", "set", "cặp", "đôi") and not w.isdigit()]
        candidate_queries: List[str] = []
        for q_cand in (
            " ".join(query_words[:7]),
            " ".join(words[:5]),
            " ".join(no_combo[:4]),
        ):
            q_c = q_cand.strip()
            if q_c and q_c not in candidate_queries:
                candidate_queries.append(q_c)
        if single_query:
            candidate_queries = candidate_queries[:1]

        caps = [
            m.group(0).lower().replace(" ", "")
            for m in re.finditer(r"\b\d+(?:[.,]\d+)?\s*(?:ml|g|kg|l|lít|inch)\b", norm_name, re.I)
        ]
        models = [
            w.lower()
            for w in query_words
            if any(c.isdigit() for c in w)
            and any(c.isalpha() for c in w)
            and len(w) >= 3
            and w.lower() not in caps
        ]
        is_pc_product = bool(re.match(r"(?i)^(pc|bộ pc|máy tính bàn|thùng máy)\b", norm_name))

        for q_str in candidate_queries:
            try:
                wss_url = f"https://websosanh.vn/s/{quote_plus(q_str)}.htm"
                r_wss = self.session.get(wss_url, timeout=3.2)
                if r_wss.status_code == 200:
                    strict_cards: List[Dict[str, Any]] = []
                    cap_cards: List[Dict[str, Any]] = []
                    all_cards: List[Dict[str, Any]] = []

                    parts = r_wss.text.split("product-single-info")
                    for idx in range(1, min(18, len(parts))):
                        card_blk = parts[idx][:850]
                        prev_blk = parts[idx - 1][-480:]
                        m_h = re.search(r'<a\s+href="([^"]+)"[^>]*>([^<]+)</a>', card_blk)
                        if not m_h:
                            m_h = re.search(r"href=.([^\s>\"']+)[^>]*>([^<]+)<", card_blk)
                        m_p = re.search(r"product-single-price[^>]*>\s*([\d.]+)", card_blk, re.I)
                        if not m_p or not m_h:
                            continue
                        href = m_h.group(1).strip().strip("\"'")
                        href_low = href.lower()
                        title_raw = html.unescape(m_h.group(2)).strip()
                        if not is_pc_product and any(
                            bad in href_low for bad in ("/pc-", "/bo-pc-", "/may-tinh-de-ban", "/bo-may-tinh")
                        ):
                            continue
                        p_str = m_p.group(1).replace(".", "")
                        if not (p_str.isdigit() and 15000 <= int(p_str) <= 80000000):
                            continue
                        p_val = int(p_str)

                        m_img = re.search(r'<img[^>]+(?:data-src|src)="([^"]+)"', prev_blk)
                        img_url = html.unescape(m_img.group(1)).strip() if m_img else ""
                        m_merch = re.search(r'class="merchant-name"[^>]*>([^<]+)<', card_blk)
                        m_mnum = re.search(r'class="merchant-number"[^>]*>(\d+)<', card_blk)
                        if m_merch and m_merch.group(1).strip():
                            merchant_name = html.unescape(m_merch.group(1)).strip()
                        elif m_mnum:
                            merchant_name = f"So sánh {m_mnum.group(1)} cửa hàng"
                        else:
                            merchant_name = "Cửa hàng trực tuyến"

                        full_url = f"https://websosanh.vn{href}" if href.startswith("/") else href
                        card_obj = {
                            "name": title_raw,
                            "price_vnd": p_val,
                            "merchant_name": merchant_name,
                            "image_url": img_url,
                            "url": full_url,
                        }
                        all_cards.append(card_obj)
                        comb_alnum = re.sub(r"[^a-z0-9]", "", href_low + " " + title_raw.lower())
                        cap_ok = (not caps) or any(re.sub(r"[^a-z0-9]", "", c) in comb_alnum for c in caps)
                        mod_ok = (not models) or any(re.sub(r"[^a-z0-9]", "", m) in comb_alnum for m in models)
                        if cap_ok and mod_ok:
                            strict_cards.append(card_obj)
                        elif cap_ok:
                            cap_cards.append(card_obj)

                    chosen_cards = strict_cards or cap_cards or all_cards
                    use_v = [c["price_vnd"] for c in chosen_cards[:6]]
                    if use_v:
                        med = float(np.median(use_v))
                        filtered = [v for v in use_v if 0.45 * med <= v <= 1.85 * med] or use_v
                        resolved = int(round(float(np.median(filtered)), -3))
                        self._price_cache[cache_key] = resolved

                        sim_list: List[Dict[str, Any]] = []
                        seen_sim_keys = set()
                        for c_item in (strict_cards + cap_cards + all_cards):
                            if not (0.40 * resolved <= c_item["price_vnd"] <= 2.25 * resolved):
                                continue
                            s_key = (c_item["name"].lower()[:45], c_item["merchant_name"].lower(), c_item["price_vnd"])
                            if s_key in seen_sim_keys:
                                continue
                            seen_sim_keys.add(s_key)
                            sim_list.append(c_item)
                            if len(sim_list) >= 8:
                                break
                        self._market_similar_cache[cache_key] = sim_list
                        return resolved
            except Exception:
                pass

        model_codes = [
            w.lower()
            for w in query_words
            if any(ch.isdigit() for ch in w) and len(w) >= 3
        ]
        try:
            resp = self.session.get(
                "https://tiki.vn/api/v2/products",
                params={"limit": 6, "q": candidate_queries[0]},
                timeout=2.5,
            )
            if resp.status_code == 200:
                items = (resp.json().get("data") or [])[:5]
                prices = []
                for it in items:
                    it_name = str(it.get("name") or "").lower()
                    it_price = int(it.get("price") or 0)
                    if not (15000 <= it_price <= 50000000):
                        continue
                    if model_codes and not any(mc in it_name for mc in model_codes):
                        continue
                    prices.append(it_price)
                if prices:
                    resolved = int(round(float(np.median(prices)), -3))
                    self._price_cache[cache_key] = resolved
                    self._market_similar_cache.setdefault(cache_key, [])
                    return resolved
        except Exception:
            pass
        self._market_similar_cache.setdefault(cache_key, [])
        return 0

    def _lookup_market_similar_products(self, product_name: str) -> List[Dict[str, Any]]:
        if not product_name:
            return []
        norm_name = unicodedata.normalize("NFC", str(product_name)).strip()
        cache_key = norm_name.lower()
        if cache_key not in self._market_similar_cache:
            self._lookup_market_price_vnd(norm_name)
        return list(self._market_similar_cache.get(cache_key) or [])

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
        resolved_url = url.strip()
        if any(short_dom in resolved_url.lower() for short_dom in ("shp.ee", "s.shopee.vn", "shopee.link")):
            try:
                r = self.session.get(resolved_url, allow_redirects=True, timeout=6)
                if r.url:
                    resolved_url = r.url
            except Exception:
                pass

        decoded_url = unquote(unquote(resolved_url))

        m1 = re.search(r"(?:[-/._\s]|^)i\.(\d+)\.(\d+)", decoded_url)
        if not m1:
            m1 = re.search(r"i\.(\d+)\.(\d+)", decoded_url)
        if m1:
            return int(m1.group(1)), int(m1.group(2)), resolved_url

        m2 = re.search(r"/product/(\d+)/(\d+)", decoded_url)
        if m2:
            return int(m2.group(1)), int(m2.group(2)), resolved_url

        m3 = re.search(r"shopee\.vn/(?:[^/?#]+/)*(\d{5,12})/(\d{6,15})", decoded_url)
        if m3:
            return int(m3.group(1)), int(m3.group(2)), resolved_url

        parsed = urlparse(resolved_url)
        qs = parse_qs(parsed.query)
        sid_list = qs.get("shopid") or qs.get("shop_id")
        iid_list = qs.get("itemid") or qs.get("item_id")
        if sid_list and str(sid_list[0]).isdigit():
            sid = int(sid_list[0])
            iid = int(iid_list[0]) if (iid_list and str(iid_list[0]).isdigit()) else None
            return sid, iid, resolved_url

        m5 = re.search(r"/shop/(\d+)", decoded_url)
        if m5:
            return int(m5.group(1)), None, resolved_url

        path_seg = parsed.path.strip("/").split("/")[0].lower()
        if path_seg in KNOWN_SHOPEE_USERNAMES:
            return KNOWN_SHOPEE_USERNAMES[path_seg], None, resolved_url

        return None, None, resolved_url

    def crawl_shopee_product(self, url: str, cookie: Optional[str] = None) -> Optional[Dict[str, Any]]:
        shopid, itemid, resolved_url = self._parse_shopee_ids(url)
        if not shopid:
            return None

        headers = dict(DEFAULT_HEADERS)
        headers["Referer"] = resolved_url
        if cookie:
            headers["Cookie"] = cookie

        KNOWN_SHOP_NAMES: Dict[int, Tuple[str, str]] = {
            147191228: ("Laneige Official Store", "laneigevn_officialstore"),
            37251700: ("La Roche-Posay Chính Hãng", "larocheposay_officialstore"),
            152872415: ("Guardian Official Store", "guardian_officialstore"),
        }
        default_sname, default_suser = KNOWN_SHOP_NAMES.get(
            shopid, (f"Gian hàng Shopee #{shopid}", f"shop_{shopid}")
        )
        shop_name = default_sname
        shop_username = default_suser
        shop_avatar_url = ""
        seller_userid = None
        last_active_ts = None

        try:
            core_url = f"https://shopee.vn/api/v4/shop/get_shop_core_info?shopid={shopid}"
            r_core = self.session.get(core_url, headers=headers, timeout=3)
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

        shop_categories: List[Dict[str, Any]] = []
        total_shop_items = 0
        try:
            cat_url = f"https://shopee.vn/api/v4/shop/get_categories?limit=25&offset=0&shopid={shopid}"
            r_cat = self.session.get(cat_url, headers=headers, timeout=2.5)
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

        now_ts = time.time()
        cached_shop = self._shop_raw_cache.get(shopid)
        if cached_shop and (now_ts - float(cached_shop.get("ts", 0))) < 600:
            raw_items_by_cmtid = dict(cached_shop["raw_items_by_cmtid"])
            first_page_by_star = dict(cached_shop["first_page_by_star"])
            has_more_5star = bool(cached_shop.get("has_more_5star", False))
            wave2_done = bool(cached_shop.get("wave2_done", False))
            if not shop_categories and cached_shop.get("shop_categories"):
                shop_categories = cached_shop["shop_categories"]
                total_shop_items = int(cached_shop.get("total_shop_items") or 0)
        else:
            raw_items_by_cmtid = {}
            first_page_by_star = {5: [], 4: [], 3: [], 2: [], 1: []}
            has_more_5star = False
            wave2_done = False

        effective_uid = seller_userid if seller_userid is not None else 0

        def _fetch_rating_page(args: Tuple[int, int]) -> Tuple[int, int, List[Dict[str, Any]]]:
            star_type, offset = args
            ep = (
                f"https://shopee.vn/api/v4/seller_operation/get_shop_ratings_new"
                f"?limit=50&offset={offset}&shopid={shopid}&type={star_type}&userid={effective_uid}"
            )
            try:
                resp = self.session.get(ep, headers=headers, timeout=6)
                if resp.status_code == 200:
                    items = ((resp.json().get("data") or {}).get("items")) or []
                    return star_type, offset, items
            except Exception:
                pass
            return star_type, offset, []

        if not raw_items_by_cmtid:
            batch_Args: List[Tuple[int, int]] = (
                [(5, offset) for offset in range(0, 1000, 50)]
                + [(4, offset) for offset in range(0, 300, 50)]
                + [(3, offset) for offset in (0, 50, 100)]
                + [(2, offset) for offset in (0, 50)]
                + [(1, offset) for offset in (0, 50)]
            )
            with concurrent.futures.ThreadPoolExecutor(max_workers=33) as executor:
                for star_type, offset, page_items in executor.map(_fetch_rating_page, batch_Args):
                    if offset == 0 and star_type in first_page_by_star and page_items:
                        first_page_by_star[star_type] = page_items
                    if star_type == 5 and offset == 950 and len(page_items) >= 40:
                        has_more_5star = True
                    for it in page_items:
                        cid = int(it.get("cmtid") or 0)
                        if cid and cid not in raw_items_by_cmtid:
                            raw_items_by_cmtid[cid] = it

        if raw_items_by_cmtid:
            self._shop_raw_cache[shopid] = {
                "ts": now_ts,
                "raw_items_by_cmtid": raw_items_by_cmtid,
                "first_page_by_star": first_page_by_star,
                "has_more_5star": has_more_5star,
                "wave2_done": wave2_done,
                "shop_categories": shop_categories,
                "total_shop_items": total_shop_items,
            }

        all_raw_ratings = list(raw_items_by_cmtid.values())
        if not all_raw_ratings:
            return None

        if seller_userid is None:
            for r_chk in all_raw_ratings:
                rep_obj = r_chk.get("ItemRatingReply")
                if isinstance(rep_obj, dict) and rep_obj.get("userid"):
                    seller_userid = int(rep_obj["userid"])
                    break

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

        raw_slug_title = self._extract_title_from_url(resolved_url, "Shopee")
        slug_title = unicodedata.normalize("NFC", raw_slug_title).strip() if raw_slug_title else ""
        detected_product_name = slug_title or f"Sản phẩm Chính hãng tại {shop_name}"
        detected_product_image = shop_avatar_url
        variations_set = set()
        shop_products_map: Dict[int, Dict[str, Any]] = {}

        star_counts = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        star_tier_ctimes: Dict[int, List[int]] = {5: [], 4: [], 3: [], 2: [], 1: []}
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

        all_raw_ratings.sort(key=lambda x: int(x.get("ctime") or 0), reverse=True)

        real_user_freq_in_shop: Dict[str, int] = {}
        real_user_item_freq: Dict[Tuple[str, int], int] = {}
        target_id_int = int(itemid) if itemid else 0

        for r_item in all_raw_ratings:
            rs_chk = max(1, min(5, int(r_item.get("rating_star", 5) or 5)))
            ct_chk = int(r_item.get("ctime") or 0)
            if ct_chk > 0:
                star_tier_ctimes[rs_chk].append(ct_chk)
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

        now_c = max(
            (int(r_x.get("ctime") or 0) for r_x in all_raw_ratings),
            default=int(now_ts),
        )
        dt_s: Dict[int, float] = {
            s: max(86400.0, float(now_c - min(star_tier_ctimes[s])))
            if star_tier_ctimes[s]
            else 86400.0 * 365.0
            for s in (5, 4, 3, 2, 1)
        }
        tier_saturated: Dict[int, bool] = {
            5: bool(has_more_5star or len(star_tier_ctimes[5]) >= 950),
            4: len(star_tier_ctimes[4]) >= 270,
            3: len(star_tier_ctimes[3]) >= 130,
            2: len(star_tier_ctimes[2]) >= 85,
            1: len(star_tier_ctimes[1]) >= 85,
        }

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
            first_prod = p_items[0] if p_items else {}
            if p_items:
                if target_id_int:
                    for pi in p_items:
                        if int(pi.get("itemid") or 0) == target_id_int:
                            first_prod = pi
                            break
                    else:
                        non_gifts = [
                            pi
                            for pi in p_items
                            if not str(pi.get("name") or "").strip().upper().startswith(("[HB GIFT", "[GIFT", "QUÀ TẶNG"))
                        ]
                        if non_gifts:
                            first_prod = non_gifts[0]
                else:
                    non_gifts = [
                        pi
                        for pi in p_items
                        if not str(pi.get("name") or "").strip().upper().startswith(("[HB GIFT", "[GIFT", "QUÀ TẶNG"))
                    ]
                    if non_gifts:
                        first_prod = non_gifts[0]

            r_itemid = int(first_prod.get("itemid") or r.get("itemid") or 0)
            raw_p_name = first_prod.get("name") or detected_product_name
            p_name = unicodedata.normalize("NFC", str(raw_p_name)).strip()
            p_img_id = first_prod.get("image") or ""
            p_img_url = f"{SHOPEE_CDN_BASE}{p_img_id}" if p_img_id else ""
            model_name = unicodedata.normalize("NFC", str(first_prod.get("model_name") or "")).strip()
            r_ctime_val = int(r.get("ctime") or 0)

            seen_pids_in_review = set()
            for pi in (p_items or [first_prod]):
                pi_id = int(pi.get("itemid") or 0)
                pi_name = unicodedata.normalize("NFC", str(pi.get("name") or "")).strip()
                if not pi_id or not pi_name:
                    continue
                if pi_id not in shop_products_map:
                    pi_img = pi.get("image") or ""
                    shop_products_map[pi_id] = {
                        "itemid": pi_id,
                        "name": pi_name,
                        "image_url": f"{SHOPEE_CDN_BASE}{pi_img}" if pi_img else "",
                        "review_count": 0,
                        "item_units_ordered": 0,
                        "star_sum": 0,
                        "star_tiers": {5: 0, 4: 0, 3: 0, 2: 0, 1: 0},
                        "min_ctime": r_ctime_val if r_ctime_val > 0 else now_c,
                        "comments_sample": [],
                        "variations": set(),
                    }
                if r_ctime_val > 0 and r_ctime_val < shop_products_map[pi_id]["min_ctime"]:
                    shop_products_map[pi_id]["min_ctime"] = r_ctime_val
                shop_products_map[pi_id]["item_units_ordered"] += 1
                if pi_id not in seen_pids_in_review:
                    seen_pids_in_review.add(pi_id)
                    shop_products_map[pi_id]["review_count"] += 1
                    shop_products_map[pi_id]["star_sum"] += r_star
                    shop_products_map[pi_id]["star_tiers"][r_star] += 1
                    raw_c_sample = (r.get("comment") or "").strip()
                    if raw_c_sample and len(shop_products_map[pi_id]["comments_sample"]) < 30:
                        shop_products_map[pi_id]["comments_sample"].append(raw_c_sample)
                pi_model = unicodedata.normalize("NFC", str(pi.get("model_name") or "")).strip()
                if pi_model:
                    shop_products_map[pi_id]["variations"].add(pi_model)

            is_exact_match = bool(target_id_int and r_itemid == target_id_int)
            if is_exact_match:
                if p_name:
                    detected_product_name = p_name
                if p_img_url:
                    detected_product_image = p_img_url
                if model_name:
                    variations_set.add(model_name)

            images_raw = r.get("images") or []
            media_images = [f"{SHOPEE_CDN_BASE}{img}" for img in images_raw if isinstance(img, str)]

            videos_raw = r.get("videos") or []
            media_videos = []
            for v in videos_raw:
                if isinstance(v, dict) and v.get("url"):
                    media_videos.append({
                        "cover": v.get("cover", ""),
                        "url": v.get("url", ""),
                        "duration_ms": int(v.get("duration") or 0),
                        "template_video": bool(v.get("template_video", False)),
                    })

            has_media_flag = 1 if (media_images or media_videos) else 0
            raw_comment = (r.get("comment") or "").strip()
            template_tags = [str(t).strip() for t in (r.get("template_tags") or []) if str(t).strip()]
            low_rating_reasons = [
                str(reason).strip()
                for reason in (r.get("low_rating_reasons") or [])
                if str(reason).strip()
            ]

            stripped_free_text = form_header_pattern.sub(" ", raw_comment)
            for tag_str in template_tags:
                stripped_free_text = stripped_free_text.replace(tag_str, " ")
            free_text_words = [w for w in re.split(r"\s+", stripped_free_text.strip()) if len(w) >= 2]
            free_text_word_count = len(free_text_words)

            has_real_text = bool(raw_comment)
            if has_real_text:
                comment_text = raw_comment
            elif template_tags:
                comment_text = " • ".join(template_tags)
                has_real_text = True
            elif has_media_flag:
                media_parts = []
                if media_images:
                    media_parts.append(f"{len(media_images)} hình ảnh")
                if media_videos:
                    media_parts.append(f"{len(media_videos)} video")
                comment_text = f"[Đánh giá {r_star}★ kèm {' & '.join(media_parts)} thực tế từ người mua – không ghi lời bình]"
            else:
                comment_text = f"[Đánh giá {r_star}★ nhanh từ người mua đã xác thực – không ghi lời bình]"

            ctime = int(r.get("ctime") or 0)
            mtime = int(r.get("mtime") or ctime)
            edit_delay_sec = max(0, mtime - ctime)

            cmtid = int(r.get("cmtid") or 0)
            raw_uid = r.get("userid") or r.get("author_shopid") or cmtid
            uid = str(raw_uid)
            uname = r.get("author_username") or f"user_{uid}"
            u_portrait = r.get("author_portrait") or ""
            u_avatar = f"{SHOPEE_CDN_BASE}{u_portrait}" if u_portrait else ""

            reply_obj = r.get("ItemRatingReply") or {}
            seller_reply = (reply_obj.get("comment") or "").strip() if isinstance(reply_obj, dict) else ""

            observed_user_reviews = int(real_user_freq_in_shop.get(uid, 1))
            same_item_repeat = int(real_user_item_freq.get((uid, r_itemid), 1)) > 1
            real_user_key = f"u_{uid}" if same_item_repeat else f"u_{uid}_{r_itemid}"
            real_device_key = f"ip_uid_{uid}" if same_item_repeat else f"ip_{uid}_{r_itemid}"

            review_record = {
                "review_id": f"sp_{cmtid}",
                "order_id": str(r.get("orderid") or ""),
                "item_id": str(r_itemid),
                "product_name": p_name,
                "variation": model_name,
                "is_target_item": is_exact_match,
                "is_text_review": has_real_text,
                "free_text_word_count": free_text_word_count,
                "is_repeated_purchase": bool(r.get("is_repeated_purchase", False)),
                "anonymous": bool(r.get("anonymous", False)),
                "edit_delay_sec": edit_delay_sec,
                "template_tags": template_tags,
                "low_rating_reasons": low_rating_reasons,
                "user_id": real_user_key,
                "user_name": uname,
                "user_avatar": u_avatar,
                "rating": r_star,
                "comment": comment_text,
                "timestamp": dt.datetime.fromtimestamp(ctime).strftime("%Y-%m-%d %H:%M:%S") if ctime else "",
                "has_media": has_media_flag,
                "media_images": media_images,
                "media_videos": media_videos,
                "seller_reply": seller_reply,
                "detailed_rating": {
                    "product_quality": int(det.get("product_quality") or r_star),
                    "seller_service": int(det.get("seller_service") or 5),
                    "delivery_service": int(det.get("delivery_service") or 5),
                },
                "verified_purchase": 1,
                "helpful_votes": int(r.get("like_count") or 0),
                "user_total_reviews": observed_user_reviews,
                "account_age_days": 365,
                "device_ip_hash": real_device_key,
                "platform": "Shopee",
            }

            if is_exact_match:
                if has_real_text:
                    exact_item_text_reviews.append(review_record)
                else:
                    exact_item_media_or_star_reviews.append(review_record)
            else:
                if has_real_text:
                    other_shop_text_reviews.append(review_record)
                elif has_media_flag:
                    other_shop_media_reviews.append(review_record)
                else:
                    other_shop_star_only_reviews.append(review_record)

        exact_item_all_reviews = exact_item_text_reviews + exact_item_media_or_star_reviews
        effective_target_id = target_id_int

        gift_keywords = ("[HB GIFT", "[GIFT", "QUÀ TẶNG", "HÀNG TẶNG")
        is_slug_gift = any(gk in slug_title.upper() for gk in gift_keywords)
        if len(exact_item_all_reviews) == 0 and slug_title and shop_products_map:
            slug_kws = [
                w.lower()
                for w in re.split(r"\W+", slug_title)
                if len(w) >= 2 and w.lower() not in ("chính", "hãng", "cao", "cấp", "cho", "và", "với", "của")
            ]
            if len(slug_kws) >= 2:
                best_pid = 0
                best_score = 0.0
                for pid_cand, sp_cand in shop_products_map.items():
                    if not is_slug_gift and any(gk in str(sp_cand["name"]).upper() for gk in gift_keywords):
                        continue
                    cand_low = sp_cand["name"].lower()
                    matched_kws = sum(1 for kw in slug_kws if kw in cand_low)
                    ratio = matched_kws / float(len(slug_kws))
                    if matched_kws >= 2 and ratio >= 0.55 and ratio > best_score:
                        best_score = ratio
                        best_pid = pid_cand
                if best_pid:
                    effective_target_id = best_pid
                    all_other_revs = other_shop_text_reviews + other_shop_media_reviews + other_shop_star_only_reviews
                    for rev_c in all_other_revs:
                        if int(rev_c.get("item_id") or 0) == best_pid:
                            rev_c["is_target_item"] = True
                            if rev_c.get("is_text_review"):
                                exact_item_text_reviews.append(rev_c)
                            else:
                                exact_item_media_or_star_reviews.append(rev_c)
                    exact_item_all_reviews = exact_item_text_reviews + exact_item_media_or_star_reviews

        all_shop_items = list(shop_products_map.values())
        horizon_counts_by_pid: Dict[int, Dict[int, int]] = {}
        for sp in all_shop_items:
            sp["variations"] = list(sp["variations"])[:8]
            sp_min_ct = int(sp.get("min_ctime") or now_c)
            t_sp = max(86400.0, float(now_c - sp_min_ct))
            s_tiers = sp.get("star_tiers") or {5: sp.get("review_count", 1), 4: 0, 3: 0, 2: 0, 1: 0}
            adj_tiers: Dict[int, int] = {}
            for s_k in (5, 4, 3, 2, 1):
                cnt_k = int(s_tiers.get(s_k, 0))
                if cnt_k > 0 and tier_saturated.get(s_k, False) and dt_s[s_k] < 0.85 * t_sp:
                    scale_k = min(15.0, max(1.0, t_sp / dt_s[s_k]))
                else:
                    scale_k = 1.0
                adj_tiers[s_k] = int(round(cnt_k * scale_k))
            horizon_counts_by_pid[sp["itemid"]] = adj_tiers
            rc = max(1, sum(adj_tiers.values()))
            raw_rc = max(1, int(sp.get("review_count") or 1))
            units_ord = int(sp.get("item_units_ordered") or raw_rc)
            scaled_units = int(round(units_ord * (rc / float(raw_rc))))
            sp["review_count"] = rc
            sp["historical_sold"] = max(scaled_units, int(round(rc * 3.54)))
            sp["avg_rating"] = round(sum(s_k * adj_tiers[s_k] for s_k in (5, 4, 3, 2, 1)) / float(rc), 2)
            sp_prices = self._extract_real_buyer_prices_vnd(sp.get("comments_sample", []))
            sp["fallback_buyer_price_vnd"] = int(round(float(np.median(sp_prices)), -3)) if sp_prices else 0
            sp["price_vnd"] = 0
            sp["url"] = f"https://shopee.vn/product/{shopid}/{sp['itemid']}"
            sp.pop("comments_sample", None)
            sp.pop("star_sum", None)
            sp.pop("star_tiers", None)
            sp.pop("min_ctime", None)
            sp.pop("item_units_ordered", None)

        total_exact_count = len(exact_item_all_reviews)

        if total_exact_count > 0:
            combined_reviews = exact_item_all_reviews[:500]
            if effective_target_id and effective_target_id in horizon_counts_by_pid:
                star_counts = dict(horizon_counts_by_pid[effective_target_id])
                total_exact_count = max(len(combined_reviews), sum(star_counts.values()))
            else:
                star_counts = {
                    s: sum(1 for r in combined_reviews if int(r.get("rating", 5)) == s)
                    for s in (5, 4, 3, 2, 1)
                }
                total_exact_count = len(combined_reviews)
            tot_sc = max(1, sum(star_counts.values()))
            true_platform_rating = round(sum(s * star_counts[s] for s in (5, 4, 3, 2, 1)) / float(tot_sc), 2)
            true_star_share_pct = {
                str(s): round(star_counts[s] * 100.0 / float(tot_sc), 2)
                for s in (5, 4, 3, 2, 1)
            }
            qual_scores = [
                float((r.get("detailed_rating") or {}).get("product_quality", 5))
                for r in combined_reviews
                if (r.get("detailed_rating") or {}).get("product_quality")
            ]
            seller_scores = [
                float((r.get("detailed_rating") or {}).get("seller_service", 5))
                for r in combined_reviews
                if (r.get("detailed_rating") or {}).get("seller_service")
            ]
            deliv_scores = [
                float((r.get("detailed_rating") or {}).get("delivery_service", 5))
                for r in combined_reviews
                if (r.get("detailed_rating") or {}).get("delivery_service")
            ]
        else:
            combined_reviews = (
                other_shop_text_reviews
                + other_shop_media_reviews[:240]
                + other_shop_star_only_reviews[:200]
            )[:500]

        if len(combined_reviews) == 0:
            return None

        shop_gift_items = sorted(
            [
                sp
                for sp in all_shop_items
                if any(gk in str(sp["name"]).upper() for gk in gift_keywords)
            ],
            key=lambda x: x["review_count"],
            reverse=True,
        )[:6]

        top_shop_products = sorted(
            [
                sp
                for sp in all_shop_items
                if not any(gk in str(sp["name"]).upper() for gk in gift_keywords)
            ],
            key=lambda x: x["review_count"],
            reverse=True,
        )[:9]

        if effective_target_id and effective_target_id in shop_products_map:
            matched_sp = shop_products_map[effective_target_id]
            detected_product_name = matched_sp.get("name") or detected_product_name
            detected_product_image = matched_sp.get("image_url") or detected_product_image
            if not variations_set and matched_sp.get("variations"):
                variations_set = set(matched_sp["variations"])
        elif not target_id_int and total_exact_count == 0 and not slug_title and top_shop_products:
            detected_product_name = top_shop_products[0].get("name") or detected_product_name
        if not detected_product_image and top_shop_products:
            detected_product_image = top_shop_products[0].get("image_url", "")
        if not variations_set and top_shop_products:
            variations_set = set(top_shop_products[0].get("variations", []))

        exact_prices = self._extract_real_buyer_prices_vnd(
            [r.get("comment", "") for r in exact_item_text_reviews]
        )
        real_buyer_prices = exact_prices
        market_lookup_price = self._lookup_market_price_vnd(detected_product_name)
        market_similar_products = self._lookup_market_similar_products(detected_product_name)

        if market_lookup_price > 0:
            detected_price_vnd = market_lookup_price
        elif exact_prices:
            detected_price_vnd = int(round(float(np.median(exact_prices)), -3))
        else:
            detected_price_vnd = 0

        wss_budget = 3
        for sp_obj in top_shop_products:
            fb_p = int(sp_obj.get("fallback_buyer_price_vnd") or 0)
            sp_name_norm = unicodedata.normalize("NFC", str(sp_obj.get("name") or "")).strip().lower()
            if sp_name_norm in self._price_cache and self._price_cache[sp_name_norm] > 0:
                sp_obj["price_vnd"] = self._price_cache[sp_name_norm]
            elif fb_p > 0:
                sp_obj["price_vnd"] = fb_p
            elif wss_budget > 0:
                wss_budget -= 1
                mp = self._lookup_market_price_vnd(sp_obj.get("name", ""), single_query=True)
                sp_obj["price_vnd"] = mp if mp > 0 else 0
            else:
                sp_obj["price_vnd"] = 0
            sp_obj.pop("fallback_buyer_price_vnd", None)

        buyer_price_stats = {
            "median_vnd": detected_price_vnd,
            "min_vnd": int(min(real_buyer_prices)) if real_buyer_prices else detected_price_vnd,
            "max_vnd": int(max(real_buyer_prices)) if real_buyer_prices else detected_price_vnd,
            "mention_count": len(real_buyer_prices),
        }

        buyer_deal_tips: List[Dict[str, Any]] = []
        for rev in (exact_item_text_reviews + other_shop_text_reviews):
            c_txt = (rev.get("comment") or "").strip()
            if not c_txt or c_txt.startswith("[Đánh giá "):
                continue
            c_low = c_txt.lower()
            if "nhận xu" in c_low or "kiếm xu" in c_low or "lấy xu" in c_low:
                continue
            tags: List[str] = []
            c_prices = self._extract_real_buyer_prices_vnd([c_txt])
            mentioned_p = c_prices[0] if c_prices else 0
            if mentioned_p > 0:
                tags.append(f"Giá khách mua: {mentioned_p:,}₫".replace(",", "."))
            if any(w in c_low for w in ("voucher", "áp mã", "mã giảm", "add mã")):
                tags.append("Áp mã / Voucher")
            if any(w in c_low for w in ("săn sale", "flash sale", "sale", "giá hời", "giá rẻ")):
                tags.append("Săn sale")
            if any(w in c_low for w in ("phiên live", "mua live", "trên live", "livestream", "video")):
                tags.append("Live / Video")
            if any(w in c_low for w in ("tặng kèm", "quà tặng", "được tặng", "tặng thêm", "sample", "minisize")):
                tags.append("Có quà tặng kèm")

            if tags:
                buyer_deal_tips.append({
                    "review_id": rev.get("review_id"),
                    "user_name": rev.get("user_name"),
                    "rating": rev.get("rating", 5),
                    "timestamp": rev.get("timestamp", ""),
                    "variation": rev.get("variation", ""),
                    "comment": c_txt,
                    "mentioned_price_vnd": mentioned_p,
                    "tags": tags,
                })
            if len(buyer_deal_tips) >= 8:
                break

        last_active_str = (
            dt.datetime.fromtimestamp(int(last_active_ts)).strftime("%Y-%m-%d %H:%M:%S")
            if last_active_ts
            else "Đang hoạt động"
        )

        total_text_count = len(exact_item_text_reviews) + len(other_shop_text_reviews)
        base_rev_cnt = total_exact_count if total_exact_count > 0 else len(combined_reviews)
        if effective_target_id and effective_target_id in shop_products_map:
            historical_sold = int(shop_products_map[effective_target_id].get("historical_sold") or round(base_rev_cnt * 3.54))
        else:
            historical_sold = int(round(base_rev_cnt * 3.54))
        replied_cnt = sum(1 for r in combined_reviews if r.get("seller_reply"))
        shop_reply_rate_pct = round(replied_cnt * 100.0 / max(1, len(combined_reviews)), 1)

        return {
            "product_id": f"shopee-{shopid}-{itemid or 'shop'}",
            "name": detected_product_name,
            "platform": "Shopee",
            "shop_name": shop_name,
            "price_vnd": detected_price_vnd,
            "url": resolved_url,
            "image_url": detected_product_image,
            "platform_rating": true_platform_rating,
            "total_platform_reviews": len(all_raw_ratings),
            "crawl_mode": "SHOPEE_DIRECT_CRAWL",
            "shopee_live_meta": {
                "shopid": shopid,
                "itemid": itemid,
                "seller_userid": seller_userid,
                "shop_name": shop_name,
                "shop_username": shop_username,
                "shop_avatar_url": shop_avatar_url,
                "is_official_shop": is_official_mall,
                "true_platform_rating": true_platform_rating,
                "true_star_share_pct": true_star_share_pct,
                "product_image_url": detected_product_image,
                "last_active_time": last_active_str,
                "total_shop_items": total_shop_items,
                "total_raw_ratings_scanned": len(all_raw_ratings),
                "total_text_reviews_extracted": total_text_count,
                "exact_item_reviews_count": total_exact_count,
                "historical_sold": historical_sold,
                "shop_reply_rate_pct": shop_reply_rate_pct,
                "reviews_with_media_count": sum(1 for r in combined_reviews if r["has_media"]),
                "variations": list(variations_set)[:15],
                "star_distribution": star_counts,
                "detailed_ratings_avg": {
                    "product_quality": round(max(true_platform_rating, float(np.mean(qual_scores)) if qual_scores else true_platform_rating), 2),
                    "seller_service": round(float(np.mean(seller_scores)), 2) if seller_scores else 4.95,
                    "delivery_service": round(float(np.mean(deliv_scores)), 2) if deliv_scores else 4.93,
                },
                "shop_categories": shop_categories[:10],
                "shop_top_products": top_shop_products,
                "market_similar_products": market_similar_products,
                "shop_gift_items": shop_gift_items,
                "buyer_deal_tips": buyer_deal_tips,
                "buyer_price_stats": buyer_price_stats,
            },
            "reviews": combined_reviews,
        }

    def crawl_tiki_product(self, url_or_id: str, max_pages: int = 4) -> Optional[Dict[str, Any]]:
        product_id = None
        spid = None

        if str(url_or_id).isdigit():
            product_id = int(url_or_id)
        else:
            m = re.search(r"-p(\d+)\.html", url_or_id)
            if not m:
                m = re.search(r"product_id=(\d+)", url_or_id)
            if m:
                product_id = int(m.group(1))
            parsed = urlparse(url_or_id)
            qs = parse_qs(parsed.query)
            if "spid" in qs and qs["spid"]:
                try:
                    spid = int(qs["spid"][0])
                except ValueError:
                    spid = None

        if not product_id:
            return None

        try:
            prod_url = f"https://tiki.vn/api/v2/products/{product_id}"
            params = {"platform": "web"}
            if spid:
                params["spid"] = spid
            resp = self.session.get(prod_url, params=params, timeout=self.timeout)
            if resp.status_code != 200:
                return None
            prod_data = resp.json()

            product_name = prod_data.get("name", f"Sản phẩm Tiki #{product_id}")
            platform_rating = float(prod_data.get("rating_average", 4.8) or 4.8)
            review_count = int(prod_data.get("review_count", 0) or 0)
            tiki_sold = int(
                prod_data.get("all_time_quantity_sold")
                or (prod_data.get("quantity_sold") or {}).get("value")
                or max(review_count * 3, 1)
            )
            price = int(prod_data.get("price", 0) or 0)
            brand = (prod_data.get("brand") or {}).get("name", "Tiki Trading")
            seller = (prod_data.get("current_seller") or {}).get("name", brand)
            thumb_url = prod_data.get("thumbnail_url", "")

            reviews_list: List[Dict[str, Any]] = []
            for page in range(1, max_pages + 1):
                rev_params = {
                    "limit": 20,
                    "include": "comments,contribute_info,attribute_vote_summary",
                    "sort": "score|desc,id|desc,stars|all",
                    "page": page,
                    "product_id": product_id,
                }
                if spid:
                    rev_params["spid"] = spid
                r_resp = self.session.get(
                    "https://tiki.vn/api/v2/reviews",
                    params=rev_params,
                    timeout=self.timeout,
                )
                if r_resp.status_code != 200:
                    break
                r_json = r_resp.json()
                items = r_json.get("data") or []
                if not items:
                    break

                for item in items:
                    created_by = item.get("created_by") or {}
                    contribute = created_by.get("contribute_info") or {}
                    summary = contribute.get("summary") or {}
                    content = (item.get("content") or "").strip()
                    title = (item.get("title") or "").strip()
                    full_text = content if content else title
                    if not full_text:
                        continue

                    created_ts = int(item.get("created_at") or int(time.time()))
                    dt_str = dt.datetime.fromtimestamp(created_ts).strftime("%Y-%m-%d %H:%M:%S")
                    uid = str(created_by.get("id") or f"tiki_u_{item.get('id')}")
                    uname = created_by.get("full_name") or created_by.get("name") or f"Khách hàng #{uid[-4:]}"
                    images = item.get("images") or []
                    media_imgs = [img.get("full_path") for img in images if isinstance(img, dict) and img.get("full_path")]
                    is_verified = bool(created_by.get("purchased", True))
                    total_user_reviews = int(summary.get("total_review", 3) or 3)
                    account_days = 365
                    joined_time = summary.get("joined_time") or ""
                    m_year = re.search(r"(\d+)\s*năm", str(joined_time))
                    m_month = re.search(r"(\d+)\s*tháng", str(joined_time))
                    if m_year:
                        account_days = int(m_year.group(1)) * 365
                    elif m_month:
                        account_days = max(15, int(m_month.group(1)) * 30)

                    reviews_list.append({
                        "review_id": f"tiki_{item.get('id')}",
                        "user_id": f"u_{uid}",
                        "user_name": uname,
                        "rating": int(item.get("rating", 5) or 5),
                        "comment": full_text,
                        "timestamp": dt_str,
                        "has_media": 1 if len(media_imgs) > 0 else 0,
                        "media_images": media_imgs,
                        "verified_purchase": 1 if is_verified else 0,
                        "helpful_votes": int(item.get("thank_count", 0) or 0),
                        "user_total_reviews": total_user_reviews,
                        "account_age_days": account_days,
                        "device_ip_hash": hashlib.md5(uid.encode()).hexdigest()[:8],
                        "platform": "Tiki",
                    })

            if len(reviews_list) < 5:
                return None

            return {
                "product_id": f"tiki-{product_id}",
                "name": product_name,
                "platform": "Tiki",
                "shop_name": seller,
                "price_vnd": price,
                "url": url_or_id if str(url_or_id).startswith("http") else f"https://tiki.vn/product-p{product_id}.html",
                "platform_rating": round(platform_rating, 2),
                "total_platform_reviews": max(review_count, len(reviews_list)),
                "crawl_mode": "LIVE_TIKI_API_V2",
                "shopee_live_meta": {
                    "shopid": product_id,
                    "itemid": product_id,
                    "shop_name": seller,
                    "shop_username": brand,
                    "shop_avatar_url": thumb_url,
                    "product_image_url": thumb_url,
                    "last_active_time": "Đang hoạt động",
                    "total_shop_items": 1,
                    "total_raw_ratings_scanned": len(reviews_list),
                    "total_text_reviews_extracted": len(reviews_list),
                    "exact_item_reviews_count": len(reviews_list),
                    "historical_sold": tiki_sold,
                    "shop_reply_rate_pct": 0.0,
                    "reviews_with_media_count": sum(1 for r in reviews_list if r.get("has_media")),
                    "variations": [],
                    "star_distribution": {
                        s: sum(1 for r in reviews_list if r["rating"] == s) for s in (5, 4, 3, 2, 1)
                    },
                    "detailed_ratings_avg": {
                        "product_quality": round(platform_rating, 2),
                        "seller_service": 4.9,
                        "delivery_service": 4.9,
                    },
                    "shop_categories": [],
                    "shop_top_products": [],
                },
                "reviews": reviews_list,
            }
        except Exception as exc:
            logger.warning("Tiki live crawl warning for %s: %s", url_or_id, exc)
            return None

    def scrape_any_url(
        self,
        url: str,
        demo_products: List[Dict[str, Any]],
        cookie: Optional[str] = None,
    ) -> Dict[str, Any]:
        platform = self.detect_platform(url)

        if platform == "Shopee":
            live_shopee = self.crawl_shopee_product(url, cookie=cookie)
            if live_shopee and len(live_shopee.get("reviews", [])) > 0:
                return live_shopee
            raise ValueError(
                "Không thể cào dữ liệu thật từ link Shopee này. Vui lòng kiểm tra lại định dạng link sản phẩm Shopee (có chứa shopid/itemid, ví dụ: shopee.vn/product/147191228/25866559724 hoặc -i.shopid.itemid)."
            )

        if platform == "Tiki":
            live_tiki = self.crawl_tiki_product(url, max_pages=6)
            if live_tiki and len(live_tiki.get("reviews", [])) > 0:
                return live_tiki
            raise ValueError(
                "Không thể cào dữ liệu thật từ link Tiki này. Vui lòng kiểm tra lại link sản phẩm Tiki.vn hợp lệ (có chứa mã -p123456.html)."
            )

        for prod in demo_products:
            if prod.get("url", "").strip().lower() == url.strip().lower():
                return prod

        raise ValueError(
            f"Sàn {platform} hiện chặn truy cập trực tiếp không qua trình duyệt. Vui lòng dán link Shopee.vn hoặc Tiki.vn để cào trực tiếp API thật, hoặc dùng nút 'Tải file' (CSV/JSON) / Công cụ 'Xem code cào (F12)' trên thanh menu."
        )

    def _extract_title_from_url(self, url: str, platform: str) -> Optional[str]:
        try:
            parsed = urlparse(unquote(unquote(url)))
            path = unquote(parsed.path)
            if platform == "Shopee":
                m_slug = re.split(r"[-.]i\.\d+\.\d+", path.strip("/"))
                if m_slug and len(m_slug) >= 1 and m_slug[0] != path.strip("/"):
                    slug = m_slug[0].split("/")[-1]
                    if slug and not slug.isdigit():
                        return slug.replace("-", " ").strip()
                return None
            elif platform == "Tiki":
                slug = re.sub(r"-p\d+\.html.*$", "", path.strip("/"))
                if slug:
                    return slug.replace("-", " ").title()
            elif platform == "Google Maps":
                m = re.search(r"/place/([^/]+)", path)
                if m:
                    return m.group(1).replace("+", " ")
            elif platform == "TikTok Shop":
                m = re.search(r"/product/([^/?]+)", path)
                if m:
                    return f"TikTok Shop Product #{m.group(1)}"
        except Exception:
            pass
        return None


