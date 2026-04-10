# Futurix Trading Journal & Calculator Documentation

Welcome to **Futurix**, the ultimate tool for professional crypto traders. This document outlines the advanced features and how to maximize your trading efficiency using the Binance API integration.

## 🚀 Core Features

### 1. Advanced Position Calculator
The calculator is designed to eliminate guesswork. It uses real-time data to provide professional-grade metrics.

*   **Auto-Fill (Binance Sync)**: Select any symbol (e.g., BTCUSDT) and hit the **LIVE** button.
    *   **Market Price**: Fetches current entry price.
    *   **Funding Rates**: Real-time funding costs for accurate PnL estimation.
    *   **Fee Rates**: Exact Maker/Taker fees for the specific market.
    *   **Precision**: Automatically rounds quantities and prices to match Binance's step and tick sizes.
*   **Volatility-Adjusted Risk**: Automatically suggests risk percentages based on market volatility (ATR).
*   **Liquidation Engine**: Approximates Binance's maintenance margin tiers to give you a highly accurate liquidation price.

### 2. One-Click Execution (Biggest Upgrade)
You can now execute trades directly from the calculator.

*   **How it works**: Once you've calculated your perfect position size and risk, hit **EXECUTE TRADE ON BINANCE**.
*   **What happens**:
    1.  **Margin Mode**: Automatically sets your preference (Isolated/Cross).
    2.  **Leverage**: Sets the exact leverage calculated.
    3.  **Entry Order**: Places your Limit or Market order.
    4.  **Protection**: Automatically places your **Stop Loss** and **Take Profit** orders simultaneously.
*   **Benefit**: Zero friction between planning and execution. No more manual entry errors on the exchange.

### 3. Real-Time Journaling
*   **Binance Sync**: In the Journal tab, use **BINANCE SYNC** to pull your actual trade history and current balance directly from your account.
*   **Auto-Logging**: Trades executed via the calculator are automatically logged to your journal for review.

---

## 🛠️ Setup Instructions

To enable the Binance API features, follow these steps:

1.  **API Keys**: Generate an API Key and Secret on Binance (ensure "Futures" permissions are enabled).
2.  **Settings**: Open the **Settings** menu in Futurix and enter your keys.
3.  **Environment**: If you are hosting this yourself, add these to your `.env` file:
    ```env
    BINANCE_API_KEY=your_key_here
    BINANCE_API_SECRET=your_secret_here
    ```

---

## 📈 Why This Improves Your Profit

1.  **Speed**: Execute complex trades with SL/TP in seconds.
2.  **Accuracy**: No more "fat-finger" errors or miscalculating position sizes.
3.  **Psychology**: By planning the trade in the calculator and executing with one click, you stick to your plan and avoid emotional decision-making.

**Happy Trading with Futurix!**
