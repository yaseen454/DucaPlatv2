# 🪐 DUCAPLAT (Pro v2.0)
### Void Market Efficiency Analytics & Sellsheet Vision Engine

🔗 **GitHub Repository**: [https://github.com/yaseen454/DucaPlatv2](https://github.com/yaseen454/DucaPlatv2)

**Ducaplat** is a premium, full-featured analytics board and inventory calculator built for *Warframe* Tenno looking to maximize trade efficiency. By evaluating Platinum-to-Ducat conversion matrices, visualizing price distribution profiles, scanning screenshots natively via AI, and syncing inventories securely, players can make fast, mathematically optimal trading decisions.

---

## 🌌 Key Highlights

1. **Precision Ducat vs. Platinum Analyzer**
   - Live conversion matrices for all rarity bands: Bronze (15 & 25 Ducats), Silver (45 & 65 Ducats), and Gold (100 Ducats).
   - Instant relative-worth calculations showing custom thresholds where selling for Platinum outvalues trading for Void Ducats.

2. **Sellsheet Vision (Gemini-Powered OCR)**
   - Drag-and-drop or clipboard scanning of in-game Baro Ki'Teer Void Trader lists.
   - Built-in multi-layered interactive zoom magnifier modals for both uploaded screens and in-game cropping guides.
   - Smart fuzzy-matching algorithms verifying and matching raw text arrays to standard in-game prime parts.
   - One-click removal mechanism to clear active OCR staging fields and start clean.

3. **Statistical Scenario Modeler**
   - High-contrast, interactive boxplot distributions using **D3** / **Recharts** representing Minimum, Mean, Median, and Peak Profit scenarios.
   - Fully interactive indicators for evaluating dynamic trading margins under conservative vs. aggressive volatility settings.

4. **Bi-Temporal Cloud & Local Storage Sync**
   - Secure server-sided user state tracking. Automatically caches saved list configurations to local fallback blocks if guests remain unauthenticated.
   - Seamless, real-time Firestore sync of customized item sets mapping directly to authenticated user profiles.

5. **Advanced Security & Dual Database Routing**
   - Integrated OAuth 2.0 flow with custom security barriers preventing Google sign-in failure blocks inside restricted in-app WebViews (such as Discord, Telegram, or Facebook).
   - Adaptive database target selectors allowing players to toggle out of AI Studio-shared quotas to communicate directly with native production `(default)` Firestore databases.

---

## 📂 Project Architecture

The workspace is structured cleanly as a React 18 / TypeScript single-page client coupled with premium styles and utilities:

```bash
├── public/                 # Static assets & routing proxy settings
├── src/
│   ├── components/         # Modular user interface compartments
│   │   ├── AboutInfo.tsx         # Comprehensive feature documentation & system user guides
│   │   ├── AnalysisResults.tsx   # D3 & Recharts distribution models and profit analysis
│   │   ├── ClipboardOCR.tsx      # Sellsheet Vision, zoom modal overrides, reference guides
│   │   ├── DataSelection.tsx     # Directory browser for individual prime part listings
│   │   ├── ManualInput.tsx       # Standard entry board with stepper increments
│   │   ├── SavedItemsTab.tsx     # Cloud list records, rename widgets, mass deleting handles
│   │   └── SettingsTab.tsx       # System price settings & customizable standard ratios
│   ├── context/
│   │   └── AuthContext.tsx       # Firebase Session Management, Google login, WebView blockers
│   ├── data/
│   │   ├── primeData.ts          # Static item blueprints, rarity maps, and static assets
│   │   └── wiki-...json          # Seed reference collections for standard market prices
│   ├── lib/
│   │   └── firebase.ts           # DB initializers, operational error interceptors, auto-connectors
│   ├── utils/
│   │   └── mathUtils.ts          # Mathematical matrices, average, median, and boxplot coordinates
│   ├── types.ts            # Key shared interface blueprints & object models
│   ├── App.tsx             # Main dashboard shell, state managers, and navigation controllers
│   ├── main.tsx            # Initial mounting sequence and provider wrappers
│   └── index.css           # Global typography definitions, Tailwind classes, and interaction cursor overrides
```

---

## 🛠️ Installation & Setup

Ensure you have **Node.js 18+** installed before beginning database bootstrapping.

### 1. Repository Installation
```bash
# Install core dependencies
npm install
```

### 2. Local Environment Configurations
Create a copy of `.env.example` as `.env` and fill in your designated credentials:
```env
# Google Gemini API Keys (Used in Server proxy logic)
GEMINI_API_KEY=your_gemini_api_key

# Firebase Client configuration variables (Optional fallback configs)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DB_ID=(default)
```

### 3. Native vs Sandboxed Database Selection
Ducaplat connects dynamically to either sandbox databases or native default containers. You can define this target within your `.env`:
- **Sandboxed Mode:** Set `VITE_FIREBASE_DB_ID=ai-studio-cd586454-6029-4415-b995-88896f502e38` for temporary workspaces.
- **Production Mode:** Set `VITE_FIREBASE_DB_ID=(default)` (or leave it blank) to route all synchronization queries straight to your native database instance, avoiding collective shared-developer quota restrictions.

---

## 🔒 Security Specifications & Data Invariants

Security is strictly governed at the server layer using highly robust boundaries constructed within `/firestore.rules`:

### Structural Rules & Path Scoping
* **Owner Isolation:** Cross-tenant reads/writes are completely blocked. Users are locked into their respective `/users/{userId}` directories.
* **Property Size Safeguards:** Custom profile names are hard-capped to `150` characters, emails to `200`, and inventory configuration custom names cannot exceed `120` letters to avoid billing and database exhaustion exploits.
* **Fields Immutability:** Fundamental metadata parameters like record `id` and `source` are verified as immutable post-creation to preserve data integrity and prevent historical forgery.
* **Clean Querying Bounds:** Broad collection queries (`list`) are systematically disabled on the outer user collection blocks to prevent security scanning.

---

## 🚀 Native Deployment

```bash
# Build production-ready assets
npm run build

# Start the optimized client preview
npm run dev
```

The production assets compile cleanly inside the `/dist` directory, optimizing network weight and utilizing native hardware rendering pipelines for fast scrolling across all mobile and widescreen devices.
