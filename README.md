# Himalayan Catchment Flash-Flood Priority Platform (HimFlood)

## 1. Executive Summary

The Himalayan Catchment Flash-Flood Priority Platform (HimFlood) is an operational spatial decision-support system designed for multi-criteria risk triage across 3,067 micro-catchments in the Western and Central Himalayas (covering Uttarakhand and Himachal Pradesh). The system combines high-resolution hydro-geomorphological modeling, multi-decadal gridded precipitation records, probabilistic machine learning clustering, and population exposure data to classify catchments into four operational priority tiers: P1 (Critical), P2 (High), P3 (Watch), and P4 (Routine).

HimFlood provides disaster management authorities, municipal planners, and hydrologists with real-time interactive mapping, dynamic weight re-ranking, automated action planning, and empirical validation against historical flash-flood occurrences.

```
+----------------------------------------------------------------------------------------------------+
|                                    HIMFLOOD SYSTEM WORKFLOW                                        |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [SRTM 90m DEM]       [IMD 0.25 deg Rainfall]      [WorldPop 1km]      [Historical Events (122)]   |
|         |                        |                        |                        |               |
|         v                        v                        v                        v               |
|  [Terrain Features]     [Rainfall Extremes]       [Exposure Index]       [Validation Footprint]    |
|   - slope_p90            - p99_wetday              - pop_total             - AUC / ROC (95% CI)    |
|   - melton               - max3d                   - pop_near_channel      - Lift Analysis         |
|   - drainage_density     - heavy_days                                                              |
|   - 1/tc_min                                                                                       |
|         \                        /                                                                 |
|          v                      v                                                                  |
|     +--------------------------------+                                                             |
|     |   GMM Regime Clustering (k=5)  |                                                             |
|     +--------------------------------+                                                             |
|                    |                                                                               |
|                    v                                                                               |
|     +--------------------------------+       +------------------------+                            |
|     |    Hazard Index Computation    | ----> | Exposure Intersect     |                            |
|     +--------------------------------+       +------------------------+                            |
|                    |                                     |                                         |
|                    +------------------+------------------+                                         |
|                                       v                                                            |
|                        +------------------------------+                                            |
|                        |   Priority Score & Tiers     |                                            |
|                        |   (P1, P2, P3, P4 Triage)    |                                            |
|                        +------------------------------+                                            |
|                                       |                                                            |
|         +-----------------------------+-----------------------------+                              |
|         v                                                           v                              |
|  [FastAPI Backend Engine]                                    [MapLibre Frontend UI]                |
|   - In-memory Analytical Store                                - WebGL Catchment Rendering          |
|   - Dynamic Re-ranking API (<50ms)                            - Interactive Weight Sliders         |
|   - Action Plan Generator & CSV Export                        - Regime Heatmaps & PCA Space        |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Dataset Details & Preprocessing

The analytical pipeline processes four primary geospatial and hydrometeorological data streams covering 3,067 micro-catchments delineated using HydroSHEDS standard drainage hierarchy.

### 2.1 Data Sources & Spatial Resolution

| Dataset | Provider / Source | Resolution | Temporal Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Digital Elevation Model (DEM)** | NASA / USGS SRTM | 90 meters | Baseline | High-resolution elevation, slope, Melton ruggedness index, and flow accumulation. |
| **Daily Precipitation** | India Meteorological Department (IMD) | 0.25 deg (~25 km) | 2015 to 2025 | Daily precipitation rasters aggregated over catchments for extreme rainfall metrics. |
| **Human Population Exposure** | WorldPop / Socioeconomic Data Center | 1 km grid | 2017 | Total population and channel-proximate population (within 100 meters of stream axis). |
| **Historical Flood Events** | State Disaster Management Authorities | Point locations | 1970 to 2025 | 122 documented flash-flood event points across Uttarakhand (40 town-precision, 82 regional). |

### 2.2 Feature Definitions

The system derives 14 analytical features per catchment, grouped into response, rainfall, and exposure domains:

1. **Morphometric Response Domain:**
   - `slope_p90`: 90th percentile slope in degrees (captures steep upper slopes prone to mass movement).
   - `melton`: Melton's Ruggedness Number, calculated as `(elev_max - elev_min) / sqrt(area_km2)`.
   - `drainage_density`: Stream length per unit catchment area (`km / km2`).
   - `tc_min`: Time of concentration in minutes, computed using Kirpich's formula based on longest flow path and hydraulic slope.
   - `inv_tc_min`: Inverted time of concentration (`1 / tc_min`), representing peak runoff velocity.
   - `area_km2`: Planimetric catchment area in square kilometers.
   - `elev_mean`: Mean catchment surface elevation in meters above sea level.

2. **Hydrometeorological Extreme Domain:**
   - `p99_wetday`: 99th percentile wet-day daily rainfall intensity (mm/day).
   - `max3d`: Maximum consecutive 3-day accumulated rainfall over the observation period (mm).
   - `heavy_days`: Mean annual count of extreme precipitation days exceeding 64.5 mm/day.
   - `jjas_share`: Fraction of annual precipitation occurring during the June to September monsoon window.
   - `frac_above_4500`: Proportion of catchment area located above 4,500 meters (permafrost/nival freeze-thaw zone).

3. **Exposure and Demographic Domain:**
   - `pop_total`: Aggregated residential population count within the micro-catchment boundary.
   - `pop_near_channel`: Population residing within a 100-meter horizontal buffer of active riverbeds.

### 2.3 Data Preprocessing Pipeline

- **Feature Standardization:** Quantitative variables are standardized to mean zero and unit variance prior to dimensional reduction and clustering:
  $$z_i = \frac{x_i - \mu}{\sigma}$$
- **Percentile Normalization:** For multi-criteria risk scoring, raw features are converted to empirical percentile ranks over the full domain:
  $$r(x_i) = \frac{\text{rank}(x_i)}{N}$$
- **Topological Integrity:** All 3,067 polygon geometries are validated against OGC standards (handling MultiPolygons, vertex ring orientation, and coordinate precision down to WGS84 6-decimal precision).

---

## 3. Models and Algorithms

The operational categorization uses a two-stage modeling approach: unsupervised clustering for regime discovery, followed by rank-order multi-criteria hazard aggregation.

### 3.1 Unsupervised Regime Discovery: Gaussian Mixture Models (GMM)

Rather than enforcing spherical partition assumptions (such as standard K-Means), catchments are clustered into terrain-rainfall regimes using Gaussian Mixture Models with full covariance:

$$p(x) = \sum_{k=1}^{K} \pi_k \mathcal{N}(x \mid \mu_k, \Sigma_k)$$

Where:
- $\pi_k$ represents cluster prior probabilities ($\sum \pi_k = 1$).
- $\mu_k$ represents cluster mean vectors across hydro-terrain feature dimensions.
- $\Sigma_k$ represents unconstrained full covariance matrices capturing directional correlations between slope, elevation, and rainfall extremes.

**Justification for GMM Selection:**
- **Heterogeneous Topography:** Alpine valleys exhibit strong correlation between elevation and rain shadow effects, requiring full covariance matrices.
- **Probabilistic Membership:** GMM computes soft cluster assignment posteriors ($\gamma_{ik}$), enabling confidence tracking (`conf`) and identification of borderline transition catchments (`borderline = True` when $\max(\gamma) < 0.6$).

### 3.2 Dimensionality Reduction: Principal Component Analysis (PCA)

PCA was trained across standard hydromorphic features to validate cluster separation in orthogonal vector space. The three primary components account for 68.4% of total dataset variance:
- **PC1 (28.2% variance):** Topographic elevation and temperature gradient (elevation vs. rainfall intensity).
- **PC2 (27.5% variance):** Slope gradient and ruggedness (steepness vs. drainage area).
- **PC3 (12.7% variance):** Extreme multi-day monsoon rainfall accumulation.

### 3.3 Multi-Criteria Hazard and Priority Formulation

The platform evaluates hazard and operational priority through continuous percentile formulation:

1. **Morphometric Response Index ($R$):**
   $$R = \frac{w_1 r(\text{slope\_p90}) + w_2 r(\text{melton}) + w_3 r(\text{drainage\_density}) + w_4 r(\text{inv\_tc\_min})}{\sum_{i=1}^{4} w_i}$$

2. **Rainfall Extreme Index ($P$):**
   $$P = \frac{w_5 r(\text{p99\_wetday}) + w_6 r(\text{max3d}) + w_7 r(\text{heavy\_days})}{\sum_{i=5}^{7} w_i}$$

3. **Composite Hazard Index ($H$):**
   $$H = \alpha R + (1 - \alpha) P$$
   *(Baseline operational balance: $\alpha = 0.5$)*

4. **Exposure Index ($E$):**
   $$E = \frac{r(\text{pop\_total}) + r(\text{pop\_near\_channel})}{2}$$

5. **Operational Priority Score ($S$):**
   $$S = H \cdot E^\gamma$$
   *(Baseline non-linear exposure dampener: $\gamma = 1.0$)*

### 3.4 Classification and Triage Rules

Priority classifications are determined within the permanent human habitation corridor (elevation between 500 m and 3,500 m):
- **P1 Critical (Top 5%):** Priority percentile score $> 0.95$ within the settlement belt.
- **P2 High (Next 5%):** Priority percentile score between $0.90$ and $0.95$.
- **P3 Watch:** Priority percentile score between $0.70$ and $0.90$.
- **P4 Routine:** Remaining catchments with priority percentile score $< 0.70$.
- **Cascade Watch Override:** Any catchment outside the settlement belt ($> 3,500$ m) exhibiting High Cascade Risk (e.g., hanging glaciers, proglacial moraine lakes) is classified directly into **P3 Watch**.

---

## 4. Model Selection & Empirical Comparison

During model development, five cluster architectures across $k \in [4, 8]$ were evaluated using Silhouette Score, Davies-Bouldin Index, Bayesian Information Criterion (BIC), Adjusted Rand Index (ARI) against Ward's Hierarchical agglomeration, and 100-fold bootstrap stability.

### 4.1 Comparative Model Performance Matrix

| Model Architecture | Clusters ($k$) | Silhouette Score (Higher is better) | Davies-Bouldin Index (Lower is better) | Bayesian Information Criterion (BIC) | Bootstrap Stability (ARI) | Min Cluster Size ($n$) | ARI vs. Ward Hierarchical |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| K-Means | 4 | 0.1835 | 1.6727 | -- | 0.9490 | 282 | 0.4710 |
| **GMM (Full Covariance)** | **4** | **0.1450** | **1.9982** | **58,249.6** | **0.8365** | **476** | **0.3940** |
| K-Means | 5 | 0.1860 | 1.6144 | -- | 0.9048 | 219 | 0.5347 |
| **GMM (Selected)** | **5** | **0.1225** | **2.1957** | **56,110.2** | **0.8252** | **436** | **0.3933** |
| K-Means | 6 | 0.1813 | 1.5959 | -- | 0.9375 | 179 | 0.4798 |
| GMM | 6 | 0.1195 | 2.5327 | 53,890.1 | 0.7008 | 355 | 0.3097 |
| K-Means | 7 | 0.1829 | 1.5711 | -- | 0.9531 | 178 | 0.4530 |
| GMM | 7 | 0.1278 | 1.9318 | 53,460.4 | 0.7285 | 285 | 0.3670 |
| K-Means | 8 | 0.1778 | 1.5408 | -- | 0.8331 | 179 | 0.5081 |
| GMM | 8 | 0.1074 | 2.3209 | 50,237.0 | 0.7221 | 189 | 0.3549 |

### 4.2 Selection Rationale

The 5-cluster Gaussian Mixture Model was selected as the optimal compromise between information criteria minimization (BIC inflection) and domain interpretability:
- **GMM ($k=5$) minimizes unpopulated outlier clusters** (minimum cluster size is 436 micro-catchments, avoiding hyper-fragmentation).
- **High Partition Stability:** 100-fold bootstrap stability of $0.8252$ ARI confirms convergence across repeated geographic sub-samplings.
- **Physical Realism:** Unlike K-Means, which forced isotropic boundaries across non-linear valley floors, GMM accurately delineated mid-hill monsoonal flash-flood catchments from high-elevation cryosphere zones.

### 4.3 Resulting Terrain-Rainfall Regime Profiles

| Regime ID | Descriptive Archetype | Catchment Count ($N$) | Mean Elevation (m) | 90th Pct Slope (deg) | p99 Wet Day (mm) | Max 3-Day Rain (mm) | Mean Catchment Pop |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R1** | Alpine/cold-arid, low rain extremes, very steep slopes | 534 | 4,838 | 35.9 deg | 45.5 mm | 65.2 mm | 170 |
| **R2** | Alpine/cold-arid, low rain extremes, steep slopes | 490 | 4,771 | 30.1 deg | 50.2 mm | 67.9 mm | 198 |
| **R3** | Mid-hill, high rain extremes, gentle slopes | 436 | 2,125 | 22.4 deg | 88.4 mm | 169.5 mm | 13,880 |
| **R4** | Mid-hill, moderate rain extremes, steep slopes | 942 | 1,849 | 34.7 deg | 71.9 mm | 137.7 mm | 7,038 |
| **R5** | Alpine/cold-arid, moderate rain extremes, very steep slopes | 665 | 4,201 | 46.1 deg | 66.0 mm | 134.1 mm | 1,250 |

---

## 5. Performance Evaluation & Validation

To assess whether the multi-criteria triage reflects actual ground-truth events, models were evaluated against the historical repository of 122 documented flash-flood occurrences (1970–2025) using Receiver Operating Characteristic Area Under the Curve (ROC-AUC) with 300-draw bootstrap 95% Confidence Intervals.

### 5.1 Discriminative Capacity Across Spatial Scopes

Evaluation was performed under two spatial constraints:
1. **Footprint Scope:** All catchments within districts having documented event reporting ($N = 865$).
2. **Belt Scope:** Inhabited settlement corridor ($500 \text{ m} \le \text{elev} \le 3,500 \text{ m}$) with documented records ($N = 605$).

#### Discriminative Performance Matrix (ROC-AUC with 95% CI)

| Predictor Variable | Footprint (All Events, $N=82$) | Footprint (Town Precision, $N=25$) | Settlement Belt (All Events, $N=78$) | Settlement Belt (Town Precision, $N=22$) |
| :--- | :--- | :--- | :--- | :--- |
| **Priority Score ($S$)** | **0.703** [0.646 - 0.757] | **0.730** [0.643 - 0.828] | **0.619** [0.553 - 0.680] | **0.684** [0.585 - 0.797] |
| **Exposure Index ($E$)** | **0.709** [0.659 - 0.758] | **0.772** [0.683 - 0.848] | **0.595** [0.528 - 0.667] | **0.724** [0.607 - 0.830] |
| **Slope 90th Pct** | 0.513 [0.454 - 0.578] | 0.501 [0.382 - 0.622] | 0.574 [0.497 - 0.632] | 0.511 [0.372 - 0.653] |
| **Hazard Index ($H$)** | 0.483 [0.423 - 0.539] | 0.473 [0.380 - 0.567] | 0.513 [0.453 - 0.579] | 0.503 [0.390 - 0.594] |
| **Max 3-Day Rain** | 0.446 [0.372 - 0.516] | 0.506 [0.359 - 0.635] | 0.460 [0.384 - 0.521] | 0.546 [0.407 - 0.676] |
| **p99 Wet Day Rain** | 0.460 [0.394 - 0.529] | 0.486 [0.360 - 0.624] | 0.443 [0.377 - 0.517] | 0.507 [0.360 - 0.638] |

### 5.2 Key Validation Insights

1. **Town-Level Specificity:** When evaluating against verified town-level event coordinates, **Priority Score achieves an AUC of 0.730**, and **Exposure achieves 0.772**, demonstrating high operational relevance for populated administrative centers.
2. **Capture Lift:** P1 and P2 catchments represent **8.9%** of the habitable belt area but account for **10.3%** of all historical flood events, yielding a **Capture Lift of 1.15x** over uniform spatial distribution.
3. **Regime Vulnerability Distribution:** Historical flash-flood occurrences are heavily concentrated in Mid-Hill regimes:
   - **R4 (Mid-hill, steep slopes):** 12.5% event rate (63 recorded flood events across 503 catchments).
   - **R3 (Mid-hill, high rain):** 9.3% event rate (13 recorded flood events across 140 catchments).
   - **R5 (Alpine, steep slopes):** 2.3% event rate (5 events across 221 catchments).

---

## 6. System Architecture & API Design

HimFlood is built on an asynchronous microservice pattern decoupled into a high-performance Python analytical engine and a reactive WebGL geospatial front end.

### 6.1 Architectural Topology

```
+----------------------------------------------------------------------------------------+
|                                    CLIENT LAYER                                        |
|  React 19 / TypeScript / Vite / Tailwind CSS                                           |
|  - MapLibre GL JS (Vector Tile Canvas & Dedicated Web Worker: maplibre-gl-worker.mjs)  |
|  - TanStack React Query (State Caching, Stale-While-Revalidate)                       |
|  - Recharts (Interactive Regime Profiles & Validation Lift Charts)                    |
+----------------------------------------------------------------------------------------+
                                            |
                                            | HTTPS Requests (/api/*, /static/*)
                                            v
+----------------------------------------------------------------------------------------+
|                                EDGE REVERSE PROXY                                      |
|  Render Global Edge / Cloudflare CDN                                                   |
|  - GZIP Compression Termination                                                        |
|  - Transparent Route Rewriting & SPA History Fallback                                 |
+----------------------------------------------------------------------------------------+
                                            |
                                            | Forwarded Upstream Request
                                            v
+----------------------------------------------------------------------------------------+
|                                 APPLICATION BACKEND                                    |
|  FastAPI / Uvicorn (ASGI Async Server)                                                 |
|  - Pydantic v2 Request/Response Validation                                             |
|  - Pre-computed In-Memory Singleton DataStore (Pandas / NumPy Vectorized Buffers)      |
|  - Sub-50ms Dynamic Priority Re-computation Engine                                     |
|  - Strict Startup Mathematical Parity Gate (verify_reproduction)                       |
+----------------------------------------------------------------------------------------+
                                            |
                                            | Direct Memory Access
                                            v
+----------------------------------------------------------------------------------------+
|                               PERSISTENT DATA STORE                                    |
|  Read-Only Analytical Artifacts (/data)                                                |
|  - catchment_features.csv (3,067 records x 44 attributes)                              |
|  - catchments_risk.geojson (WGS84 Vector Geometry Collection, 5.6 MB)                  |
|  - events_all.csv (122 Historical Geocoded Flash-Flood Records)                        |
|  - model_selection.csv / archetype_profiles.csv / action_summary.csv                  |
+----------------------------------------------------------------------------------------+
```

### 6.2 Database & Data Structure Design

To achieve sub-second query execution across 3,067 high-dimensional polygons, relational database query overhead is eliminated by loading all datasets into an in-memory tabular singleton (`DataStore`):

```python
class DataStore:
    catchments: pd.DataFrame          # Primary table (3067 rows, indexed by catchment_id)
    geojson: dict                     # GeoJSON FeatureCollection with promoted int catchment_id
    percentile_ranks: dict[str, Series] # Pre-computed ranking vectors for instant recalculation
    standardised: np.ndarray          # Z-scored matrix for feature distance comparisons
    events_all: pd.DataFrame          # Geocoded historical flood records
    events_town: pd.DataFrame         # High-precision subset
    archetype_profiles: pd.DataFrame  # GMM cluster profiles
    model_selection: pd.DataFrame     # Model validation matrix
```

### 6.3 RESTful API Specifications

| Method | Endpoint | Query / Body Parameters | Response Format | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/summary` | None | JSON | Platform KPI counts, priority distribution, population totals. |
| `GET` | `/api/catchments` | `regime`, `priority`, `elev_min`, `elev_max`, `pop_min`, `cascade`, `search`, `page`, `page_size` | JSON | Paginated catchment list with full hydro-morphology and matching IDs. |
| `GET` | `/api/catchments/{id}` | `catchment_id` (path) | JSON | Detailed profile, alert thresholds, similar catchments, radar metrics. |
| `POST` | `/api/rank` | Dynamic weights (`weight_slope`, `weight_melton`, `p1_pct`, etc.) | JSON | Recalculates hazard, priority scores, and classes for all 3,067 catchments in $<50$ ms. |
| `GET` | `/api/validate` | `event_set` (`all`/`town`), `scope` (`belt`/`footprint`) | JSON | Real-time ROC-AUC metrics with 95% bootstrap intervals and lift. |
| `POST` | `/api/plan` | Dynamic weights & filter state | JSON | Generates resource intervention table for top 50 prioritized catchments. |
| `POST` | `/api/plan/export/csv` | Plan payload | `text/csv` attachment | Streams generated action plan as downloadable CSV. |
| `GET` | `/api/alerts/tiers` | None | JSON | Elevation and rainfall watch/warning thresholds across risk tiers. |
| `GET` | `/api/geojson` | None | `application/geo+json` | Delivers pre-compressed, enriched catchment vector geometry. |
| `GET` | `/api/frontend-data` | None | JSON | Consolidated application metadata, top 50 table, regime profiles. |

---

## 7. Prerequisites & Installation

### 7.1 System Requirements

- **Operating System:** Linux, macOS, or Windows (WSL2 / PowerShell).
- **Python:** Version 3.11 or higher.
- **Node.js:** Version 18.0.0 or higher (LTS recommended) and `npm` 9+.
- **Hardware:** Minimum 2 GB RAM, 1 GHz Dual-Core CPU, WebGL-capable browser.

### 7.2 Backend Setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a Python virtual environment
python -m venv venv

# On Linux/macOS:
source venv/bin/activate
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# 3. Install production dependencies
pip install -r requirements.txt

# 4. Verify startup reproduction test and launch development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will be accessible at `http://localhost:8000`. Interactive Swagger documentation is available at `http://localhost:8000/docs`.

### 7.3 Frontend Setup

```bash
# 1. Open a new terminal and navigate to the frontend directory
cd frontend

# 2. Install Node dependencies
npm install

# 3. Launch Vite development server
npm run dev
```

The frontend web interface will be accessible at `http://localhost:5173`.

### 7.4 Quality Assurance & Verification Commands

```bash
# Run backend pytest suite (validates endpoints, reproduction parity, ranking)
cd backend
python -m pytest tests/test_endpoints.py -v

# Run frontend linting (Oxlint)
cd frontend
npm run lint

# Run frontend production build
npm run build
```

---

## 8. Deployment Details, Performance & Security

### 8.1 Deployment Architecture

HimFlood is optimized for zero-maintenance cloud hosting:

- **Backend Service (Render Web Service):**
  - **Environment:** Python 3.
  - **Build Command:** `pip install -r backend/requirements.txt`
  - **Start Command:** `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`
  - **Working Directory:** Repository root (allowing read-only access to `/data`).

- **Frontend Static Site (Render Static Site / Global CDN):**
  - **Build Command:** `npm install && npm run build`
  - **Publish Directory:** `dist`
  - **Root Directory:** `frontend`
  - **Worker Configuration:** Dedicated `maplibre-gl-worker.mjs` hosted in `frontend/public/` and registered via `maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')` to ensure hardware-accelerated GPU polygon tiling.

- **Proxy Rewrite Configuration:**
  - Route `/api/*` -> `https://<backend-domain>.onrender.com/api/*` (Rewrite)
  - Route `/static/*` -> `https://<backend-domain>.onrender.com/static/*` (Rewrite)
  - Route `/*` -> `/index.html` (Rewrite for client-side routing)

### 8.2 Performance Profile

- **Dynamic Priority Re-weighting:** NumPy vectorized array broadcasting computes updated hazard indexes, exposure powers, percentile ranks, and P1–P4 classifications for all 3,067 catchments in under **45 milliseconds**.
- **Vector Map Rendering:** MapLibre GL JS manages 3,067 polygons utilizing a dedicated Web Worker off the main thread, maintaining fluid 60 FPS pan and zoom.
- **Payload Compression:** GeoJSON boundaries (5.6 MB uncompressed) are served via GZIP encoding at ~1.08 MB, pre-cached client-side on initial boot.

### 8.3 Security Considerations

- **Stateless Read-Only Storage:** Catchment boundary files and baseline CSVs are treated as immutable storage, preventing arbitrary file write or state tampering.
- **Strict Parameter Schematization:** All incoming dynamic ranking and filtering payloads are validated against strict Pydantic models with numeric upper and lower bounds.
- **CORS Management:** Configured via FastAPI CORSMiddleware with explicit method access controls.

---

## 9. Practical Applications & Societal Impact

HimFlood transitions disaster mitigation from post-disaster response to preemptive geographic risk management:

1. **Targeted Sirens & Automated Rain Gauges:** Rather than deploying uniform instrumentation across large administrative districts, funds are directed to the 71 P1 Critical micro-catchments where population exposure intersects extreme flash-flood terrain.
2. **Channel Margin Encroachment Regulations:** Identifies specific river segments where settlements overlap active floodway margins, providing empirical justification for zoning restrictions and relocation planning.
3. **Glacial Lake Outburst Flood (GLOF) Tracking:** Identifies 1,192 unpopulated high-elevation alpine basins as "Cascade Watch", alerting downstream municipal authorities to remote hazard origins before runoff reaches habitations.
4. **Community Evacuation Drills:** Enables village panchayats and local disaster management committees to formulate evacuation plans tailored to specific catchment time-of-concentration thresholds.

---

## 10. Repository File Structure

```
.
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── alerts.py         # Alert thresholds and IMD precipitation tier routing
│   │   │   ├── catchments.py     # Micro-catchment querying, search, and detail views
│   │   │   ├── events.py         # Geocoded historical flood point delivery
│   │   │   ├── method.py         # Methodological documentation endpoints
│   │   │   ├── plan.py           # Resource allocation table generator and CSV export
│   │   │   ├── rank.py           # Real-time multi-criteria re-ranking API
│   │   │   ├── summary.py        # Executive dashboard KPI calculations
│   │   │   └── validate.py       # Empirical ROC-AUC and bootstrap validation endpoints
│   │   ├── services/
│   │   │   ├── ranking.py        # Vectorized hazard/priority calculation engine
│   │   │   └── validation.py     # Scikit-learn bootstrap AUC and lift algorithms
│   │   ├── data_loader.py        # Singleton in-memory analytical cache
│   │   ├── main.py               # FastAPI application initialization and middleware
│   │   └── models.py             # Pydantic v2 data schemas
│   ├── tests/
│   │   └── test_endpoints.py     # Pytest unit and integration test suite
│   └── requirements.txt          # Production Python dependencies
├── data/
│   ├── action_summary.csv        # Intervention action counts by priority tier
│   ├── alert_thresholds_by_tier.csv # Rainfall watch/warning trigger levels
│   ├── archetype_profiles.csv    # Cluster centroid statistics (R1 to R5)
│   ├── catchment_features.csv    # Complete analytical master table (3,067 records)
│   ├── catchments_risk.geojson   # WGS84 polygon boundaries for all micro-catchments
│   ├── events_all.csv            # 122 historical flash flood coordinate records
│   ├── events_town_only.csv      # 40 town-level high-precision event records
│   ├── frontend_data.json        # Compiled dashboard cache
│   ├── maps.png                  # Static regional analysis overview graphic
│   ├── model_selection.csv       # GMM vs K-Means benchmark metrics
│   ├── pca_regimes.png           # Principal component ordination scatter plot
│   └── top50_action_table.csv    # Baseline top 50 intervention schedule
├── frontend/
│   ├── public/
│   │   └── maplibre-gl-worker.mjs# Dedicated Web Worker for GPU vector tile processing
│   ├── src/
│   │   ├── api/                  # Axios/fetch typed API client abstractions
│   │   ├── components/           # Reusable UI cards, tables, pills, and FloodMap
│   │   ├── pages/                # Overview, Explorer, Priority Builder, Validation, Planner
│   │   ├── utils/                # Number formatters and priority/regime color palettes
│   │   ├── App.tsx               # Root application router and layout shell
│   │   └── main.tsx              # React DOM initialization
│   ├── package.json              # Frontend dependencies and scripts
│   ├── vite.config.ts            # Vite bundler and development proxy configuration
│   └── tsconfig.json             # TypeScript compiler settings
└── README.md                     # Production system documentation
```