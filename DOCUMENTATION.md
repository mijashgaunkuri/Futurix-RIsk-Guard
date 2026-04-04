# Barsha Journal & Calculator: Technical Documentation

## 1. Overview
Barsha Journal (formerly Futurix Risk Guard) is a professional-grade trading journal and risk management calculator designed for perpetual futures traders. It bridges the gap between theoretical trade planning and real-world execution by accounting for slippage, funding rates, tiered maintenance margins, and psychological factors.

---

## 2. Risk Calculator (Calculator Tab)

The calculator is the core planning engine. It determines position sizing and liquidation risk based on real-world exchange parameters.

### 2.1 Input Parameters
- **Symbol**: Selects the asset (BTC, ETH, SOL, etc.). This triggers specific **MMR Tiers** for liquidation calculation.
- **Account Balance**: The available capital for the trade.
- **Risk Percentage**: The percentage of the balance to lose if the Stop Loss is hit.
- **Entry/SL/TP**: Price levels for the trade.
- **Leverage**: Determines the initial margin required.
- **Margin Mode**:
  - **Isolated**: Liquidation is based only on the initial margin allocated.
  - **Cross**: Liquidation is based on the entire account balance.
- **Fee Settings**: Configurable Maker (default 0.02%) and Taker (default 0.05%) fees.
- **Funding Rate**: Estimated funding rate and hold time to project net PNL.

### 2.2 Core Logic & Functions

#### A. Position Sizing (Quantity)
Calculated based on the risk amount (Balance * Risk%) and the distance to Stop Loss.
```typescript
RiskAmount = Balance * (RiskPercent / 100)

// Direction-aware distance
For Long: DistanceToSL = EntryPrice - StopLoss
For Short: DistanceToSL = StopLoss - EntryPrice

Quantity = RiskAmount / DistanceToSL
NotionalValue = Quantity * EntryPrice
```

#### B. Initial Margin
```typescript
InitialMargin = NotionalValue / Leverage
```

#### C. Liquidation Price (Tiered MMR)
The calculator uses a **Tiered Maintenance Margin Rate (MMR)** model similar to major exchanges (Binance/Bybit).
1. **Find Bracket**: The system looks up the `SYMBOL_MMR_TIERS` based on the `NotionalValue`.
2. **Maintenance Margin (MM)**: `MM = (NotionalValue * MMR) - MaintenanceAmount`.
3. **Liquidation Fee**: Exchanges often add an estimated taker fee (e.g., 0.05%) to the maintenance requirement.
   - `LiqFee = NotionalValue * TakerFeeRate`
4. **Liquidation Formula**:
   - **Isolated**:
     - Long: `LiqPrice = (NotionalValue - InitialMargin - MaintenanceAmount + LiqFee) / (Quantity * (1 - MMR))`
     - Short: `LiqPrice = (NotionalValue + InitialMargin + MaintenanceAmount - LiqFee) / (Quantity * (1 + MMR))`
   - **Cross**:
     - Long: `LiqPrice = (NotionalValue - WalletBalance - MaintenanceAmount + LiqFee) / (Quantity * (1 - MMR))`
     - Short: `LiqPrice = (NotionalValue + WalletBalance + MaintenanceAmount - LiqFee) / (Quantity * (1 + MMR))`

> **Note on Exchange Precision**: Actual exchange liquidation prices may vary slightly due to:
> - **Mark Price vs Last Price**: Liquidation is typically triggered by the Mark Price, not the Last Traded Price.
> - **Account-Level MMR**: In Cross mode, liquidation is often dynamic and based on total account equity across all positions.
> - **Post-Entry Margin**: Adding margin to an isolated position will shift the liquidation price.

#### D. Net PNL Projections
PNL is calculated net of entry fees, exit fees, and estimated funding costs.
```typescript
EntryFee = NotionalValue * EntryFeeRate
ExitFee = (Quantity * TargetPrice) * ExitFeeRate
FundingFee = NotionalValue * (FundingRate / 100) * (HoldHours / 8)
NetPNL = GrossPNL - EntryFee - ExitFee - FundingFee
```

---

## 3. Trading Journal (Journal Tab)

The journal tracks execution and manages the lifecycle of a trade.

### 3.1 Trade Lifecycle
1. **Logging (OPEN)**: When a trade is logged, the `InitialMargin` is "locked" (deducted from Available Balance).
2. **Updating**: Users can add margin to isolated positions or edit trade details.
3. **Closing (CLOSED)**: When closed, the system calculates actual PNL, refunds the margin, and updates the balance.

### 3.2 Real-World Friction Tracking
- **Slippage**: Tracks the difference between `Expected Entry/Exit` and `Actual Entry/Exit`.
  - `Slippage USDT = (ExpectedPrice - ActualPrice) * Quantity` (adjusted for direction).
- **MFE/MAE**:
  - **Maximum Favorable Excursion (MFE)**: The highest profit reached during the trade.
  - **Maximum Adverse Excursion (MAE)**: The deepest drawdown experienced.
- **Exit Efficiency**: Captures how much of the total move (Entry to MFE) was captured by the actual exit.

---

## 4. Advanced Analytics (Stats Tab)

The stats tab provides diagnostic insights into trading behavior and mathematical expectancy.

### 4.1 Core Metrics
- **Profit Factor**: Total Gross Profit / Total Gross Loss.
- **Expectancy**: The average amount you expect to win (or lose) per trade.
- **Win Rate by Regime**: Performance breakdown by market condition (Trending vs Ranging).

### 4.2 Monte Carlo Simulation
Simulates 20 potential future equity paths (30 trades ahead) by randomly sampling from your historical net PNL distribution. This helps visualize the range of outcomes and the risk of a "drawdown streak."

### 4.3 Psychological Analysis
- **Emotion Correlation**: Tracks PNL and Win Rate against emotions (Greed, Fear, FOMO).
- **Revenge Trading**: Specifically isolates trades marked as "Revenge" to show their total negative impact on the equity curve.

---

## 5. Technical Architecture

### 5.1 Stack
- **Frontend**: React 18, Vite, TypeScript.
- **Styling**: Tailwind CSS (Utility-first, dark-themed "Crypto" aesthetic).
- **Animations**: Framer Motion (Transitions and micro-interactions).
- **Charts**: Recharts (Responsive SVG charts).
- **Database**: Firebase Firestore (Real-time sync, persistent storage).
- **Auth**: Firebase Authentication (Google Login).

### 5.2 Data Structure (Trade Interface)
```typescript
interface Trade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  marginMode: 'ISOLATED' | 'CROSS';
  netPnl: number;
  slippagePercent?: number;
  mfePercent?: number;
  maePercent?: number;
  emotion: string;
  marketCondition: string;
  // ... and more
}
```

### 5.3 Security & Validation
- **Firestore Rules**: Implements "Default Deny" with owner-only read/write access.
- **Balance Integrity**: All balance updates are handled via a central `onUpdateBalance` function to ensure consistency between trade PNL and manual adjustments.

---

## 6. Usage Guide
1. **Plan**: Use the Calculator to find your position size. Ensure the "Liq. Distance" is safe.
2. **Execute**: Log the trade to the Journal.
3. **Manage**: If in Isolated mode, use "Add Margin" if the price approaches liquidation.
4. **Review**: Close the trade with actual prices. Use the "Review" modal to reflect on your psychology and execution efficiency.
5. **Analyze**: Check the Stats tab weekly to identify leaks in your strategy or mindset.
