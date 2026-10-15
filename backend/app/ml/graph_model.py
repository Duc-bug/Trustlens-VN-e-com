"""
Behavioral Graph Construction & Supervised Graph Attention Message Passing Engine (`graph_model.py`).
Builds a User-Review behavioral interaction network using NetworkX and computes:
  1. Topological Graph Metrics: PageRank, Degree Centrality, Local Clustering Coefficient,
     K-Core Decomposition (`core_number`), and Louvain/Modularity Community Detection (`Q`-score).
  2. Supervised 2-Layer Graph Attention Network (GAT) Message Passing Embeddings trained via
     Binary Cross-Entropy backpropagation over the behavioral adjacency matrix.
  3. Interactive Network Visualization Payload (Nodes, Edges, Communities) for Frontend `SeedingGraph.tsx`.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import networkx as nx
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity


class GraphAttentionEmbedder:
    """
    Supervised 2-Layer Graph Attention (GAT) Message Passing over the Review Behavioral Graph.
    Given node features X (N x D) and weighted adjacency matrix A (N x N), computes:
      e_{ij} = LeakyReLU(a^T [W h_i || W h_j]) + log(A_{ij} + I)
      alpha_{ij} = softmax_j(e_{ij})
      h_i' = ELU(sum_j alpha_{ij} W h_j)
    Supports supervised parameter optimization (`fit_supervised`) using Binary Cross-Entropy
    gradient descent so attention weights focus on true seeding collusion structures.
    """

    def __init__(self, in_dim: int = 6, hidden_dim: int = 10, out_dim: int = 4, seed: int = 42):
        self.in_dim = in_dim
        self.hidden_dim = hidden_dim
        self.out_dim = out_dim
        rng = np.random.RandomState(seed)

        self.W1 = (
            rng.randn(in_dim, hidden_dim).astype(np.float32)
            * np.sqrt(2.0 / (in_dim + hidden_dim))
        )
        self.a1_src = rng.randn(hidden_dim, 1).astype(np.float32) * 0.25
        self.a1_dst = rng.randn(hidden_dim, 1).astype(np.float32) * 0.25

        self.W2 = (
            rng.randn(hidden_dim, out_dim).astype(np.float32)
            * np.sqrt(2.0 / (hidden_dim + out_dim))
        )
        self.a2_src = rng.randn(out_dim, 1).astype(np.float32) * 0.25
        self.a2_dst = rng.randn(out_dim, 1).astype(np.float32) * 0.25

        self.w_out = rng.randn(out_dim, 1).astype(np.float32) * 0.5
        self.b_out = np.zeros((1,), dtype=np.float32)
        self.is_trained = False

    @staticmethod
    def _leaky_relu(x: np.ndarray, alpha: float = 0.2) -> np.ndarray:
        return np.where(x > 0, x, alpha * x)

    @staticmethod
    def _elu(x: np.ndarray, alpha: float = 1.0) -> np.ndarray:
        return np.where(x > 0, x, alpha * (np.exp(np.clip(x, -10, 0)) - 1.0))

    @staticmethod
    def _elu_grad(x: np.ndarray, alpha: float = 1.0) -> np.ndarray:
        return np.where(x > 0, 1.0, alpha * np.exp(np.clip(x, -10, 0)))

    @staticmethod
    def _sigmoid(x: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-np.clip(x, -15.0, 15.0)))

    def _gat_layer(
        self,
        H: np.ndarray,
        adj: np.ndarray,
        W: np.ndarray,
        a_src: np.ndarray,
        a_dst: np.ndarray,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        Wh = H @ W  # (N, F)
        f_src = Wh @ a_src  # (N, 1)
        f_dst = Wh @ a_dst  # (N, 1)
        logits = self._leaky_relu(f_src + f_dst.T)  # (N, N)

        mask = (adj > 0).astype(np.float32)
        np.fill_diagonal(mask, 1.0)

        weighted_logits = logits + np.log(
            np.clip(adj + np.eye(len(H), dtype=np.float32), 1e-6, None)
        )
        weighted_logits = np.where(mask > 0, weighted_logits, -1e9)
        max_logits = np.max(weighted_logits, axis=1, keepdims=True)
        exp_logits = np.exp(weighted_logits - max_logits) * mask
        alpha = exp_logits / (np.sum(exp_logits, axis=1, keepdims=True) + 1e-9)

        pre_act = alpha @ Wh
        H_next = self._elu(pre_act)
        return H_next, alpha, pre_act

    def forward(self, X: np.ndarray, adj: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        H1, _, _ = self._gat_layer(X, adj, self.W1, self.a1_src, self.a1_dst)
        H2, attn2, _ = self._gat_layer(H1, adj, self.W2, self.a2_src, self.a2_dst)
        readout_prob = self._sigmoid(H2 @ self.w_out + self.b_out).ravel()
        return H2, attn2, readout_prob

    def fit_supervised(
        self,
        X: np.ndarray,
        adj: np.ndarray,
        y: np.ndarray,
        epochs: int = 35,
        lr: float = 0.035,
    ) -> None:
        """
        Supervised training of GAT projection and attention parameters using Binary Cross-Entropy
        with L2 weight decay on labeled review graphs.
        """
        n = len(X)
        if n < 4:
            return
        y_col = y.astype(np.float32).reshape(-1, 1)

        for _ in range(epochs):
            H1, alpha1, pre1 = self._gat_layer(X, adj, self.W1, self.a1_src, self.a1_dst)
            H2, alpha2, pre2 = self._gat_layer(H1, adj, self.W2, self.a2_src, self.a2_dst)

            logits_out = H2 @ self.w_out + self.b_out
            preds = self._sigmoid(logits_out)

            # BCE gradient w.r.t readout
            d_logits = (preds - y_col) / float(n)  # (N, 1)
            dw_out = H2.T @ d_logits + 1e-3 * self.w_out
            db_out = np.sum(d_logits, axis=0)

            # Backprop through Layer 2
            dH2 = d_logits @ self.w_out.T
            d_pre2 = dH2 * self._elu_grad(pre2)
            dWh2 = alpha2.T @ d_pre2
            dW2 = H1.T @ dWh2 + 1e-3 * self.W2

            # Attention vector update signal for Layer 2
            Wh2 = H1 @ self.W2
            d_alpha2 = d_pre2 @ Wh2.T
            da2_src = np.mean(d_alpha2, axis=1, keepdims=True).T @ Wh2
            self.a2_src -= lr * 0.25 * da2_src.T.clip(-0.5, 0.5)
            self.a2_dst -= lr * 0.25 * da2_src.T.clip(-0.5, 0.5)

            # Backprop through Layer 1
            dH1 = dWh2 @ self.W2.T
            d_pre1 = dH1 * self._elu_grad(pre1)
            dWh1 = alpha1.T @ d_pre1
            dW1 = X.T @ dWh1 + 1e-3 * self.W1

            self.w_out -= lr * dw_out
            self.b_out -= lr * db_out
            self.W2 -= lr * dW2
            self.W1 -= lr * dW1

        self.is_trained = True


class BehavioralGraphEngine:
    """
    Constructs the Behavioral User-Review Graph per product (or sub-corpus) and extracts:
      - `graph_pagerank`: PageRank score in the suspicious co-occurrence network
      - `graph_degree_centrality`: Normalized degree centrality
      - `graph_clustering_coeff`: Local triangle clustering coefficient (clique behavior)
      - `graph_cluster_size`: Size of the Louvain/Modularity community or connected component
      - `graph_kcore_number`: K-Core decomposition number (deepest collusion core)
      - `graph_community_modularity`: Modularity Q-score of the product review network
      - `graph_shared_ip_links`: Number of edges sharing device/IP signature or burst window
      - `graph_gat_emb_0..3`: 4D Supervised Graph Attention embeddings aggregating 2-hop signals
      - `graph_neighbor_suspect_score`: Attention-weighted neighborhood + supervised GAT anomaly score
    """

    def __init__(self):
        self.gat = GraphAttentionEmbedder(in_dim=6, hidden_dim=10, out_dim=4, seed=42)

    def extract_product_graph_features(
        self,
        df_prod: pd.DataFrame,
        tfidf_matrix: np.ndarray,
        y_labels: Optional[np.ndarray] = None,
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        n = len(df_prod)
        if n == 0:
            return pd.DataFrame(), {"nodes": [], "links": [], "summary": {}}

        timestamps = pd.to_datetime(df_prod["timestamp"], errors="coerce").fillna(
            pd.Timestamp("2026-10-01")
        )
        ts_sec = (timestamps.astype("int64") // 10**9).to_numpy()
        ratings = df_prod["rating"].astype(float).to_numpy()
        user_ids = df_prod["user_id"].astype(str).to_numpy()
        ip_hashes = (
            df_prod["device_ip_hash"].astype(str).to_numpy()
            if "device_ip_hash" in df_prod.columns
            else np.array([f"ip_{i}" for i in range(n)])
        )
        acc_ages = (
            df_prod["account_age_days"].astype(float).to_numpy()
            if "account_age_days" in df_prod.columns
            else np.full(n, 180.0)
        )
        u_totals = (
            df_prod["user_total_reviews"].astype(float).to_numpy()
            if "user_total_reviews" in df_prod.columns
            else np.full(n, 10.0)
        )

        comments_list = (
            df_prod["comment"].fillna("").astype(str).tolist()
            if "comment" in df_prod.columns
            else ["" for _ in range(n)]
        )
        valid_sim_mask = np.array(
            [
                (not c.strip().startswith("[Đánh giá ")) and (len(c.strip()) >= 24)
                for c in comments_list
            ],
            dtype=bool,
        )
        item_ids = (
            df_prod["item_id"].fillna("").astype(str).to_numpy()
            if "item_id" in df_prod.columns
            else np.full(n, "same_item")
        )

        sim_matrix = np.eye(n, dtype=np.float32)
        valid_idx = np.where(valid_sim_mask)[0]
        if len(valid_idx) > 1:
            try:
                from sklearn.feature_extraction.text import TfidfVectorizer as _CharVec
                import re as _re

                _hdr_re = _re.compile(
                    r"(?i)(chất lượng sản phẩm|đúng với mô tả|kinh nghiệm sử dụng|tính năng nổi bật|"
                    r"mùi hương|hương thơm|hương vị|bao bì/mẫu mã|bao bì|màu sắc|khả năng lên màu|"
                    r"độ che phủ|độ bóng|dành cho da|công dụng|độ bền|kết cấu|mẹo)\s*:\s*"
                )
                cleaned_sub = [
                    _re.sub(r"\s+", " ", _hdr_re.sub(" ", comments_list[k])).strip().lower()
                    for k in valid_idx
                ]
                c_vec = _CharVec(analyzer="char_wb", ngram_range=(3, 5), min_df=1, sublinear_tf=True)
                sub_sim = cosine_similarity(c_vec.fit_transform(cleaned_sub)).astype(np.float32)
                sim_matrix[np.ix_(valid_idx, valid_idx)] = sub_sim
                np.fill_diagonal(sim_matrix, 1.0)
            except Exception:
                if tfidf_matrix.shape[0] == n and tfidf_matrix.shape[1] > 0:
                    sim_matrix = cosine_similarity(tfidf_matrix).astype(np.float32)
                    invalid_idx = np.where(~valid_sim_mask)[0]
                    if len(invalid_idx) > 0:
                        sim_matrix[invalid_idx, :] = 0.0
                        sim_matrix[:, invalid_idx] = 0.0
                    np.fill_diagonal(sim_matrix, 1.0)

        G = nx.Graph()
        for i in range(n):
            G.add_node(i)

        adj = np.zeros((n, n), dtype=np.float32)
        shared_ip_counts = np.zeros(n, dtype=np.float32)
        temporal_co_edges = np.zeros(n, dtype=np.float32)
        text_dup_edges = np.zeros(n, dtype=np.float32)

        edge_records: List[Dict[str, Any]] = []

        for i in range(n):
            for j in range(i + 1, n):
                dt_min = abs(ts_sec[i] - ts_sec[j]) / 60.0
                text_sim = float(sim_matrix[i, j])
                same_user = user_ids[i] == user_ids[j]
                same_ip = (ip_hashes[i] == ip_hashes[j]) and (
                    not ip_hashes[i].startswith("ip_")
                )
                same_item = (
                    (not item_ids[i])
                    or (item_ids[i] == "0")
                    or (item_ids[i] == item_ids[j])
                )
                both_high_5star = (ratings[i] >= 5.0) and (ratings[j] >= 5.0)

                weight = 0.0
                reasons = []

                if same_user:
                    weight += 0.85
                    reasons.append("Trùng tài khoản (Repeat User)")
                if same_ip:
                    weight += 0.65
                    shared_ip_counts[i] += 1
                    shared_ip_counts[j] += 1
                    reasons.append("Trùng cụm Thiết bị/IP")
                if dt_min <= 15.0 and both_high_5star and (same_item or text_sim >= 0.35):
                    burst_w = 0.50 * (1.0 - dt_min / 16.0)
                    weight += burst_w
                    temporal_co_edges[i] += 1
                    temporal_co_edges[j] += 1
                    reasons.append(f"Đăng cùng khung giờ ({dt_min:.1f} phút)")
                if text_sim >= 0.42:
                    sim_w = 0.75 * text_sim
                    weight += sim_w
                    text_dup_edges[i] += 1
                    text_dup_edges[j] += 1
                    reasons.append(f"Tương đồng văn mẫu ({int(text_sim * 100)}%)")

                if weight >= 0.38:
                    G.add_edge(i, j, weight=float(weight), reason=", ".join(reasons))
                    adj[i, j] = weight
                    adj[j, i] = weight
                    edge_records.append(
                        {
                            "source_idx": i,
                            "target_idx": j,
                            "weight": round(float(weight), 3),
                            "reason": ", ".join(reasons),
                        }
                    )

        # 1. PageRank, Degree Centrality, Local Clustering
        try:
            pagerank = nx.pagerank(G, weight="weight", alpha=0.85)
        except Exception:
            pagerank = {i: 1.0 / max(1, n) for i in range(n)}

        deg_cent = nx.degree_centrality(G)
        clustering = nx.clustering(G, weight="weight")

        # 2. K-Core Decomposition (identifies tightly connected collusion subgraphs)
        G_simple = G.copy()
        G_simple.remove_edges_from(nx.selfloop_edges(G_simple))
        try:
            kcore_map = nx.core_number(G_simple)
        except Exception:
            kcore_map = {i: int(G.degree(i)) for i in range(n)}

        # 3. Louvain / Greedy Modularity Community Detection
        comp_sizes: Dict[int, int] = {}
        comp_id_map: Dict[int, int] = {}
        modularity_q = 0.0

        if G.number_of_edges() > 0:
            try:
                communities = list(
                    nx.algorithms.community.greedy_modularity_communities(
                        G, weight="weight"
                    )
                )
                modularity_q = float(
                    nx.algorithms.community.modularity(G, communities, weight="weight")
                )
                for comm_idx, comm in enumerate(communities):
                    c_size = len(comm)
                    for node_i in comm:
                        comp_sizes[int(node_i)] = c_size
                        comp_id_map[int(node_i)] = comm_idx
            except Exception:
                for comp_idx, comp in enumerate(nx.connected_components(G)):
                    c_size = len(comp)
                    for node_i in comp:
                        comp_sizes[int(node_i)] = c_size
                        comp_id_map[int(node_i)] = comp_idx
        else:
            for i in range(n):
                comp_sizes[i] = 1
                comp_id_map[i] = i

        # 4. Construct node intrinsic matrix X (N x 6) for Supervised GAT
        pr_arr = np.array(
            [pagerank.get(i, 0.0) * n for i in range(n)], dtype=np.float32
        )
        deg_arr = np.array([deg_cent.get(i, 0.0) for i in range(n)], dtype=np.float32)
        clust_arr = np.array(
            [clustering.get(i, 0.0) for i in range(n)], dtype=np.float32
        )
        kcore_arr = np.array(
            [float(kcore_map.get(i, 0)) for i in range(n)], dtype=np.float32
        )
        new_acc_signal = np.clip(1.0 - (acc_ages / 365.0), 0.0, 1.0).astype(
            np.float32
        )
        hyper_activity = np.clip(u_totals / 100.0, 0.0, 1.5).astype(np.float32)
        sim_peak = (
            np.max(sim_matrix - np.eye(n), axis=1).clip(0.0, 1.0).astype(np.float32)
        )

        X_node = np.stack(
            [pr_arr, deg_arr, clust_arr, new_acc_signal, hyper_activity, sim_peak],
            axis=1,
        )

        # If ground-truth labels are passed during training, update GAT weights via backprop
        if y_labels is not None and len(y_labels) == n:
            self.gat.fit_supervised(X_node, adj, y_labels, epochs=30, lr=0.04)

        gat_emb, attn_weights, gat_readout_prob = self.gat.forward(X_node, adj)

        # Combine attention-propagated anomaly with supervised GAT readout probability
        local_raw_anomaly = (
            0.26 * deg_arr
            + 0.22 * sim_peak
            + 0.18 * new_acc_signal
            + 0.14 * np.clip(shared_ip_counts / 5.0, 0.0, 1.0)
            + 0.10 * np.clip(temporal_co_edges / 6.0, 0.0, 1.0)
            + 0.10 * np.clip(kcore_arr / 6.0, 0.0, 1.0)
        )
        attn_propagated = (attn_weights @ local_raw_anomaly).astype(np.float32)
        neighbor_suspect_score = (
            0.65 * attn_propagated + 0.35 * gat_readout_prob
        ).astype(np.float32)

        feat_df = pd.DataFrame(
            {
                "graph_pagerank": pr_arr,
                "graph_degree_centrality": deg_arr,
                "graph_clustering_coeff": clust_arr,
                "graph_cluster_size": [float(comp_sizes.get(i, 1)) for i in range(n)],
                "graph_kcore_number": kcore_arr,
                "graph_community_modularity": np.full(
                    n, max(0.0, modularity_q), dtype=np.float32
                ),
                "graph_shared_ip_links": shared_ip_counts,
                "graph_temporal_co_edges": temporal_co_edges,
                "graph_text_dup_edges": text_dup_edges,
                "graph_neighbor_suspect_score": neighbor_suspect_score,
                "graph_gat_emb_0": gat_emb[:, 0],
                "graph_gat_emb_1": gat_emb[:, 1],
                "graph_gat_emb_2": gat_emb[:, 2],
                "graph_gat_emb_3": gat_emb[:, 3],
            },
            index=df_prod.index,
        )

        # Build Interactive Graph Visualization Payload (top 42 nodes for crisp rendering)
        ranked_indices = np.argsort(-(deg_arr + 0.5 * neighbor_suspect_score))[:42]
        selected_set = set(int(idx) for idx in ranked_indices)

        vis_nodes = []
        for idx in ranked_indices:
            i = int(idx)
            row = df_prod.iloc[i]
            vis_nodes.append(
                {
                    "id": str(row.get("review_id", f"rev_{i}")),
                    "user_id": str(row.get("user_id", f"u_{i}")),
                    "user_name": str(row.get("user_name", f"User #{i}")),
                    "rating": int(row.get("rating", 5)),
                    "degree": int(G.degree(i)),
                    "cluster_id": int(comp_id_map.get(i, 0)),
                    "cluster_size": int(comp_sizes.get(i, 1)),
                    "pagerank": round(float(pr_arr[i]), 3),
                    "suspect_score": round(float(neighbor_suspect_score[i]), 3),
                    "comment_preview": str(row.get("comment", ""))[:90],
                    "timestamp": str(row.get("timestamp", "")),
                }
            )

        vis_links = []
        edge_records_sorted = sorted(
            edge_records, key=lambda x: x["weight"], reverse=True
        )
        for edge in edge_records_sorted:
            u_i = edge["source_idx"]
            v_i = edge["target_idx"]
            if u_i in selected_set and v_i in selected_set:
                vis_links.append(
                    {
                        "source": str(
                            df_prod.iloc[u_i].get("review_id", f"rev_{u_i}")
                        ),
                        "target": str(
                            df_prod.iloc[v_i].get("review_id", f"rev_{v_i}")
                        ),
                        "weight": edge["weight"],
                        "reason": edge["reason"],
                    }
                )
                if len(vis_links) >= 95:
                    break

        suspicious_clusters = sum(1 for sz in set(comp_sizes.values()) if sz >= 3)
        graph_payload = {
            "nodes": vis_nodes,
            "links": vis_links,
            "summary": {
                "total_nodes": int(n),
                "total_edges": int(G.number_of_edges()),
                "largest_cluster_size": int(
                    max(comp_sizes.values()) if comp_sizes else 1
                ),
                "suspicious_clusters_count": max(1, suspicious_clusters),
                "graph_density": round(float(nx.density(G)), 4) if n > 1 else 0.0,
                "modularity_q": round(float(modularity_q), 4),
                "max_kcore": int(max(kcore_map.values()) if kcore_map else 0),
            },
        }
        return feat_df, graph_payload
