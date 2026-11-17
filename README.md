# TripWise — Priority-Based, Budget-Aware Travel Recommendation Platform

TripWise is an intelligent, full-stack travel recommendation platform developed as a college minor project. Given a traveler's destination city (**Udaipur, Rajasthan** for MVP), multiple selected activity categories, personal category priority rankings, and a total budget in INR, TripWise calculates the mathematically optimal combination of attractions and activities using a **Priority-Weighted 0/1 Knapsack Algorithm**. It sequences the selected places using a **Nearest-Neighbor TSP (Travelling Salesperson Problem)** route optimization, estimates local transit costs, and renders an interactive itinerary on Google Maps.

---

## 🌟 Key Features & MVP Scope

- **Target City:** Udaipur, Rajasthan, India (Coordinates: `24.5854° N, 73.7125° E`).
- **6 Activity Categories:** Monuments, Nature, Adventure, Lakes & Boating, Culture, Religious Places.
- **Priority Ranking:** Drag-and-drop category ranker (`@dnd-kit`) to assign personal importance weights.
- **Priority-Weighted 0/1 Knapsack Optimizer:**
  - Evaluates composite utility scores: $0.7 \times \text{Priority Weight} + 0.3 \times \text{Rating Weight}$.
  - Selects maximum-score attraction bundle strictly within budget.
  - Generates high-value **slightly over-budget alternatives (+10% tolerance)**.
- **Dual Budget Coverage Modes:**
  - **All-Inclusive (Default):** Reserves a dynamic ~20% transport buffer (₹150–₹450) inside the total budget for local auto-rickshaw travel, ensuring total trip expenditure stays strictly within the user's pocket limit.
  - **Tickets Only:** Allocates 100% of budget toward attraction tickets and computes transit costs separately.
- **Transparent Pricing Service:**
  - Hierarchical resolution: Verified counter rates $\to$ Rule-based category estimates.
  - Every price record carries `priceType` (`'verified'` vs `'estimated'`), `source`, `confidence`, and `lastVerified`.
- **Nearest-Neighbor TSP Route Ordering:**
  - Sequentially orders visit stops starting from Udaipur City Center to minimize city traversal.
  - Outputs distance in km, drive duration in minutes, and leg-by-leg directions.
- **Interactive Google Maps View:**
  - Renders custom category-colored numbered markers with visit sequence (1, 2, 3...).
  - Plots geodesic route polyline connecting attractions in sequence.
  - Interactive info windows with verified ticket pricing badges.
  - Built-in graceful error handlers for missing keys or disabled APIs.
- **Resilient Fallback Design:**
  - Verified Udaipur Attraction Registry ensures 100% stable offline demo even if third-party API keys or quotas are expired.

---

## 🏗️ Architecture & Folder Structure

```
trip/
├── .gitignore                   # Excludes node_modules, .env files, and dist/
├── README.md                    # Project documentation
│
├── client/                      # Frontend: React 18 + Vite + Tailwind CSS
│   ├── .env                     # Client environment variables (Google Maps Key, Backend URL)
│   ├── .env.example             # Template for client environment
│   ├── src/
│   │   ├── components/
│   │   │   ├── AttractionCard.jsx   # Card with photo/emoji fallback & verified price badges
│   │   │   ├── BudgetInput.jsx      # Budget input with All-Inclusive vs Tickets-Only mode toggle
│   │   │   ├── CategoryRanker.jsx   # Drag-and-drop priority ranker using @dnd-kit
│   │   │   ├── MapView.jsx          # Google Maps React wrapper with status states (loading/error)
│   │   │   └── ResultsPanel.jsx     # 6-metric summary banner, map, cards, and TSP route legs
│   │   ├── hooks/
│   │   │   ├── useMap.js            # Map instance lifecycle, markers, polyline & bounds fitting
│   │   │   └── useRecommendations.js# API orchestration hook with loading/error state
│   │   ├── pages/
│   │   │   ├── HomePage.jsx         # Landing page & city selector
│   │   │   ├── PreferencesPage.jsx  # Category picker, priority ranker & budget controls
│   │   │   └── ResultsPage.jsx      # Primary recommendations & over-budget alternatives
│   │   ├── services/
│   │   │   └── api.js               # Axios HTTP client connecting to backend
│   │   └── store/
│   │       └── tripStore.js         # Zustand global state store
│   └── package.json
│
└── server/                      # Backend: Node.js (ESM) + Express.js
    ├── .env                     # Server environment variables (PORT, API keys)
    ├── .env.example             # Template for server environment
    ├── src/
    │   ├── app.js               # Express application entry point & CORS configuration
    │   ├── config/
    │   │   └── env.js           # Environment parser & provider status reporter
    │   ├── middleware/
    │   │   ├── errorHandler.js  # Global JSON error handler
    │   │   └── requestLogger.js # HTTP request timestamp & latency logger
    │   ├── routes/
    │   │   ├── health.js        # GET /api/health
    │   │   ├── cities.js        # GET /api/cities
    │   │   ├── places.js        # GET /api/places
    │   │   └── recommendations.js # POST /api/recommendations/generate
    │   └── services/
    │       ├── placeDiscoveryService.js # Sourcing places (OTM / Verified registry)
    │       ├── googlePlacesService.js   # Places API (New) integration with fallback
    │       ├── ticketLensService.js     # Commercial tickets integration with zero fake data
    │       ├── pricingService.js        # Verified counter prices & category estimation
    │       ├── scoringService.js        # Priority & rating utility calculator
    │       ├── knapsackService.js       # Dynamic programming 0/1 Knapsack optimizer
    │       ├── googleRoutesService.js   # TSP sequencing & Google Routes / Haversine fallback
    │       ├── costCalculationService.js# Auto-rickshaw / taxi transport cost modeling
    │       └── orchestratorService.js   # Pipeline coordinator & response builder
    ├── test/
    │   └── backend.test.js      # 18 automated unit & integration tests
    └── package.json
```

---

## 🚀 Getting Started on a New Machine

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Step 1: Clone the Repository
```bash
git clone <your-github-repo-url>
cd trip
```

### Step 2: Configure Environment Variables

1. **Client Configuration (`client/.env`):**
   ```bash
   cp client/.env.example client/.env
   ```
   Contents of `client/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:5005
   VITE_GOOGLE_MAPS_API_KEY=AIzaSyBKCGXg4JwHkRITTlUAb9dHlsyF7jOJCc8
   ```

2. **Server Configuration (`server/.env`):**
   ```bash
   cp server/.env.example server/.env
   ```
   Contents of `server/.env`:
   ```env
   PORT=5005
   CORS_ORIGIN=*
   OTM_API_KEY=
   GOOGLE_MAPS_API_KEY=AIzaSyDIAniPNJDmf6eId1B-Lb0Zwlyos6HhUjg
   TICKETLENS_API_KEY=
   ```

### Step 3: Install Dependencies & Run Backend
In terminal 1:
```bash
cd server
npm install
npm run dev
# Backend runs on http://localhost:5005
```

Run test suite anytime:
```bash
node test/backend.test.js
# Runs all 18 automated tests
```

### Step 4: Install Dependencies & Run Frontend
In terminal 2:
```bash
cd client
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & external API provider status |
| `GET` | `/api/cities` | Supported cities (Udaipur metadata, coordinates, categories) |
| `GET` | `/api/places?city=Udaipur&category=Monuments&limit=5` | Place catalog with pagination and prices |
| `POST` | `/api/recommendations/generate` | Generates knapsack recommendations, route, and financial summary |

---

## 🧪 Verified Official Ticket Counter Registry (Udaipur)

- **City Palace Museum:** ₹400 (MMCF Official Counter adult entry)
- **Bagore Ki Haveli:** ₹60 (WZCC Ministry of Culture daytime museum entry)
- **Sajjangarh Monsoon Palace:** ₹110 (Forest Dept & Archaeology composite pass)
- **Saheliyon-ki-Bari:** ₹25 (Municipal Corporation counter)
- **Fateh Sagar Speedboating:** ₹100 (Municipal Water Transport Association)
- **Doodh Talai Promenades:** ₹20 (UIT musical fountain terrace)
- **Lake Pichola Cruise:** ₹400 (MMCF boat counter)
- **Sajjangarh Biological Park:** ₹60 (Forest Department)
- **Gulab Bagh:** ₹25 (Municipal counter)
- **Bharatiya Lok Kala Mandal:** ₹60 (Museum counter)
- **Vintage Car Collection:** ₹400 (Counter ticket)
- **Jagdish / Bohra Ganesh / Neemach Mata Temples:** ₹0 (Free entry)
