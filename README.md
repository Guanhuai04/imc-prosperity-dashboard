# IMC Prosperity Dashboard

https://guanhuai04.github.io/imc-prosperity-dashboard/

Interactive local dashboard for IMC Prosperity `prices*.csv` and `trades*.csv` files.

It is built with:

- `React + TypeScript + Vite`
- `Mantine` for the UI
- `Plotly.js` for the synchronized charts
- `Papa Parse` for CSV ingestion
- `Zustand` for dashboard state

## Features

- Order book scatter plot with:
  - blue bid quotes
  - red ask quotes
  - optional `Best Bid` / `Best Ask` lines
- Trade markers with different shapes for:
  - public buy aggressors
  - public sell aggressors
  - unknown public trades
  - own trades (`SUBMISSION`)
- Synchronized hover panels:
  - main plot
  - PnL panel
  - position panel
  - hover snapshot sidebar
- CSV validation and file status cards
- Product, file, day, indicator, normalization, trade size, and performance controls
- Automatic parsing of dynamic book levels such as `bid_price_1`, `bid_price_2`, ...

## Run

```bash
npm install
npm run dev
```

Open the local Vite URL in your browser and upload CSV files from your machine.

## Build

```bash
npm run build
```

## Supported CSV contracts

### Prices CSV

Required columns:

- `timestamp`
- `product`
- at least one quote pair like `bid_price_1` / `bid_volume_1` or `ask_price_1` / `ask_volume_1`

Optional columns:

- `day`
- `mid_price`
- `profit_and_loss`

### Trades CSV

Required columns:

- `timestamp`
- `symbol`
- `price`
- `quantity`

Optional columns:

- `buyer`
- `seller`
- `currency`
- `day`

If `buyer == SUBMISSION` or `seller == SUBMISSION`, the trade is treated as one of our own trades and contributes to the position panel.

## Current limitations

- Only CSV input is supported in this version.
- Log visualization is not implemented yet.
- Cross-product normalization is not implemented yet.
- Trader group filters stay informational until buyer/seller IDs and group mappings are available.

## Notes

- The app expects semicolon-delimited CSV files, matching the Prosperity public data exports.
- Unmatched trade symbols are ignored safely and surfaced as warnings in the UI.
- Public datasets often have all-zero PnL or no `SUBMISSION` trades; the dashboard keeps those panels visible and explains why they are empty.
