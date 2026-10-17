export interface DemoProductSummary {
  product_id: string;
  name: string;
  platform: string;
  shop_name: string;
  price_vnd: number;
  url: string;
  image_url?: string;
  platform_rating: number;
  total_reviews: number;
}

export interface ShopeeCategoryItem {
  category_id: number | string;
  name: string;
  total_items: number;
  image_url: string;
}

export interface ShopeeTopProductItem {
  itemid: number;
  name: string;
  image_url: string;
  review_count: number;
  variations: string[];
}

export interface ShopeeLiveMeta {
  shopid: number | string;
  itemid?: number | string | null;
  seller_userid?: number | string | null;
  shop_name: string;
  shop_username: string;
  shop_avatar_url: string;
  is_official_shop?: boolean;
  true_platform_rating?: number;
  true_star_share_pct?: Record<string, number>;
  product_image_url: string;
  last_active_time: string;
  total_shop_items: number;
  total_raw_ratings_scanned: number;
  total_text_reviews_extracted: number;
  exact_item_reviews_count: number;
  reviews_with_media_count: number;
  variations: string[];
  star_distribution: Record<string, number>;
  detailed_ratings_avg: {
    product_quality: number;
    seller_service: number;
    delivery_service: number;
  };
  shop_categories: ShopeeCategoryItem[];
  shop_top_products: ShopeeTopProductItem[];
}

export interface ProductInfo {
  product_id: string;
  name: string;
  platform: string;
  shop_name: string;
  price_vnd: number;
  url: string;
  image_url?: string;
  crawl_mode: string;
  shopee_live_meta?: ShopeeLiveMeta | null;
}

export interface TrustMetrics {
  platform_rating: number;
  adjusted_rating: number;
  rating_inflation: number;
  trust_score: number;
  total_reviews_analyzed: number;
  authentic_reviews_count: number;
  seeding_reviews_count: number;
  seeding_rate_pct: number;
  risk_level: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  risk_label: string;
  verdict: string;
  archetype_breakdown: Record<string, number>;
}

export interface BurstTimelinePoint {
  time_bucket: string;
  total_reviews: number;
  five_star_reviews: number;
  organic_reviews: number;
  seeding_spike_reviews: number;
  is_burst_anomaly: boolean;
}

export interface GraphNode {
  id: string;
  user_id: string;
  user_name: string;
  rating: number;
  degree: number;
  cluster_id: number;
  cluster_size: number;
  pagerank: number;
  suspect_score: number;
  comment_preview: string;
  timestamp: string;
  seeding_probability?: number;
  is_seeding?: boolean;
  seeding_type?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
  reason: string;
}

export interface SeedingGraphPayload {
  nodes: GraphNode[];
  links: GraphLink[];
  summary: {
    total_nodes: number;
    total_edges: number;
    largest_cluster_size: number;
    suspicious_clusters_count: number;
    graph_density: number;
    modularity_q?: number;
    max_kcore?: number;
  };
}

export interface ShapFeatureItem {
  feature: string;
  label: string;
  importance: number;
  signed_impact?: number;
  category: string;
}

export interface LocalShapReason {
  feature: string;
  label: string;
  value: number;
  shap_delta: number;
}

export interface ReviewVideoItem {
  cover: string;
  url: string;
  duration_ms: number;
  template_video?: boolean;
}

export interface ReviewItem {
  review_id: string;
  order_id?: string;
  item_id?: string;
  product_name?: string;
  variation?: string;
  is_target_item?: boolean;
  is_text_review?: boolean;
  is_repeated_purchase?: boolean;
  anonymous?: boolean;
