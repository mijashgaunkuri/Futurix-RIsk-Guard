# 📊 Barsha Trading Journal & Risk Calculator

A professional-grade, high-performance trading journal and risk management ecosystem designed specifically for perpetual futures traders. Barsha bridges the gap between theoretical trade planning and real-world execution by accounting for slippage, funding rates, tiered maintenance margins, and institutional price action concepts.

---

## 🚀 Key Features

### 🛡️ Advanced Risk Calculator
- **Tiered MMR Logic**: Uses exchange-accurate Tiered Maintenance Margin Rates (Binance/Bybit style) for precise liquidation price projection.
- **Isolated & Cross Margin**: Supports both margin modes with real-time liquidation distance tracking.
- **Friction-Aware Sizing**: Accounts for Maker/Taker fees, slippage buffers, and funding rates to project true Net PNL.
- **Conservative Sizing Mode**: Automatically adjusts position size to account for potential entry slippage and fees.

### 🧠 AI-Powered ICT Analysis
- **Institutional Analysis**: Built-in Senior ICT Analyst that validates 1m chart entries.
- **MSS & FVG Validation**: Automatically detects Market Structure Shifts and Fair Value Gaps from screenshots.
- **Liquidity Context**: Evaluates if moves started after liquidity purges (purges of previous highs/lows).
- **Expert Verdict**: Provides a probability-based verdict (VALID/INVALID/MARGINAL) for every setup.

### 📓 Execution Journal
- **Full Lifecycle Tracking**: Log, manage, and close trades with precision.
- **MFE/MAE Tracking**: Monitor Maximum Favorable Excursion and Maximum Adverse Excursion to evaluate trade management.
- **Exit Efficiency**: Calculate how much of a move you actually captured versus the theoretical maximum.
- **Psychological Logging**: Track emotions (Greed, Fear, FOMO) and identify "Revenge Trading" patterns.

### 📈 Performance Analytics
- **Equity Projection**: Monte Carlo simulations to visualize 20+ potential future equity paths.
- **Temporal Heatmaps**: Daily, Weekly, and Monthly performance heatmaps to identify your most profitable trading windows.
- **Strategy Diagnostics**: Win rate and PNL breakdown by strategy, timeframe, and market regime.
- **Drawdown Analysis**: Real-time tracking of current and maximum drawdowns.

### ☁️ Cloud Integration & Data
- **Real-time Sync**: Powered by Firebase Auth and Firestore for seamless multi-device access.
- **Import/Export**: Support for Binance CSV trade history imports and full JSON backups.
- **Mobile Optimized**: A fully responsive "Crypto-Native" UI designed for both desktop workstations and mobile devices.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript
- **Styling**: Tailwind CSS (Utility-first, high-contrast dark theme)
- **Animations**: Framer Motion (Fluid transitions and micro-interactions)
- **Charts**: Recharts (High-precision SVG data visualization)
- **AI Engine**: Google Gemini 1.5 Flash (OCR and Price Action Analysis)
- **Backend**: Firebase (Authentication & Firestore NoSQL)

---

## 📖 Documentation

For a deep dive into the mathematical formulas, liquidation logic, and architectural details, please refer to:
👉 [**DOCUMENTATION.md**](./DOCUMENTATION.md)

---

## 🚦 Getting Started

1. **Set Goals**: Configure your Daily Risk Management parameters in the Stats tab.
2. **Plan**: Use the Calculator to find your position size and validate the setup with the ICT Scanner.
3. **Execute**: Log the trade and monitor your MFE/MAE.
4. **Review**: Close the trade and perform a post-trade reflection to improve your discipline.
