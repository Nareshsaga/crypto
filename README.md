# CryptoTrack

A crypto portfolio tracker with a machine-learning forecasting view. Track a
portfolio and a watchlist, then inspect how an XGBoost and Gradient Boosting
ensemble was actually trained against five years of daily market data.

## Features

- **Portfolio and watchlist** with live prices, JWT auth and persistence
- **Currency selection** applied across the app
- **Light and dark theme**
- **Predictions page** (`/predictions`, no account required) showing the full
  training record of an ML ensemble: metrics, actual-vs-predicted, model
  comparison against a naive baseline, walk-forward cross-validation, feature
  importance, hyperparameters and a 14-day forecast

## Tech stack

| Layer | Tools |
| --- | --- |
| Client | React 19, Vite 7, Tailwind CSS 4, motion, Recharts, MUI icons |
| Server | Node 24, Express 5, Mongoose, Passport (JWT + local), bcrypt |
| ML | Python 3, scikit-learn, XGBoost, pandas, NumPy |
| Data | CoinGecko (live prices), Yahoo Finance (historical bars for training) |

## Project structure

```
Client/    React app
Server/    Express API and static ML results (Server/ml-data/)
ml/        Training pipeline (ml/train.py)
qa-tests/  Playwright end-to-end tests
```

## Setup

Requires Node 20+, Python 3.10+, and a running MongoDB.

### 1. Environment

```bash
cp Server/.env.example Server/.env
cp Client/.env.example Client/.env   # optional, only if the API is not on :3000
```

Edit `Server/.env` and set a real `JWT_SECRET`.

### 2. Database

`MONGODB_URI` must point at a running MongoDB instance, for example
`mongodb://127.0.0.1:27017/cryptotrack`.

### 3. Install and run

```bash
# API (terminal 1)
cd Server && npm install && npm start

# Client (terminal 2)
cd Client && npm install && npm run dev
```

The client runs on `http://localhost:5173` and the API on
`http://localhost:3000`.

## Machine learning predictions

### Data

Five years of **daily** bars for six coins: BTC, ETH, SOL, XRP, ADA and DOGE.
Historical data comes from the Yahoo Finance chart API because CoinGecko's free
tier hard-caps `market_chart` at 365 days.

| | |
| --- | --- |
| Rows | 1,776 usable daily candles per coin |
| Features | 32 engineered inputs |
| Target | next-day log return |
| Split | chronological 80/20, never shuffled |
| Validation | `TimeSeriesSplit(5)`, walk-forward, inside the training block |

### Models

`XGBoostRegressor` and scikit-learn's `GradientBoostingRegressor` are trained
independently, then combined into a weighted ensemble. The weights come from
inverse squared cross-validated RMSE, so the model that was consistently closer
on validated history takes the larger share. The held-out test window is used
only once, for the reported metrics.

Forecasting returns rather than prices matters: returns are roughly stationary,
while price drifts across six orders of magnitude between these coins.

### The baseline is reported on purpose

Every run also scores **naive persistence**, which forecasts a 0% move. It
matters because price-space R² is near 1.0 for that trivial baseline too — one
day ahead, price is mostly yesterday's price. The honest metrics are return R²
and MAPE against the hold-out window, and on daily crypto returns the ensemble
frequently does *not* beat persistence. The UI says so explicitly rather than
hiding it.

### Training

```bash
pip install -r ml/requirements.txt

# all coins (~2.5 minutes)
python ml/train.py

# a subset
python ml/train.py bitcoin solana
```

Results are written to `Server/ml-data/` as JSON and read by the client.

### API endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/ml` | Index of trained models with summaries |
| `GET` | `/ml/:coin` | Full payload for one coin |
| `POST` | `/ml/:coin/train` | Re-run training for one coin (~25s) |

## Scripts

| Where | Command | Purpose |
| --- | --- | --- |
| `Client/` | `npm run dev` | Vite dev server |
| `Client/` | `npm run build` | Production build |
| `Client/` | `npm run lint` | ESLint |
| `Server/` | `npm start` | Run the API |
| `Server/` | `npm run dev` | Run the API with nodemon |
| root | `python ml/train.py` | Train all configured coins |

## Environment variables

**`Server/.env`**

| Key | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `PORT` | API port (defaults to `3000`) |
| `CLIENT` | Allowed CORS origin |
| `JWT_SECRET` | Secret used to sign JWTs |

**`Client/.env`** (optional)

| Key | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL (defaults to `http://localhost:3000`) |

## Disclaimer

The forecasting view is a worked example of training an ensemble on market
data. One hold-out window, one random seed, no transaction costs or slippage,
daily bars only. Not financial advice.
