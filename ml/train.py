"""
CryptoTrack price-prediction pipeline.

Collects 5 years of daily bars from Yahoo Finance, engineers technical
features, then trains an ensemble of XGBoost and scikit-learn Gradient
Boosting on a strictly chronological train/test split.

Both models are weighted by their own walk-forward cross-validation error,
so the blend is decided before the test set is ever touched.

Usage:
    python ml/train.py                 # train every configured coin
    python ml/train.py bitcoin solana  # train a subset
"""

from __future__ import annotations

import json
import math
import platform
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
import xgboost as xgb
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_absolute_percentage_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import TimeSeriesSplit

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "Server" / "ml-data"
MODEL_DIR = ROOT / "ml" / "models"

YEARS = 5
TEST_RATIO = 0.20
CV_FOLDS = 5
FORECAST_DAYS = 14
CONTEXT_DAYS = 400
RANDOM_SEED = 42

# coingecko id, yahoo ticker, display name, ticker
COINS = {
    "bitcoin": ("BTC-USD", "Bitcoin", "BTC"),
    "ethereum": ("ETH-USD", "Ethereum", "ETH"),
    "solana": ("SOL-USD", "Solana", "SOL"),
    "ripple": ("XRP-USD", "XRP", "XRP"),
    "cardano": ("ADA-USD", "Cardano", "ADA"),
    "dogecoin": ("DOGE-USD", "Dogecoin", "DOGE"),
}

XGB_PARAMS = {
    "n_estimators": 700,
    "learning_rate": 0.03,
    "max_depth": 4,
    "min_child_weight": 5,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0,
    "objective": "reg:squarederror",
    "random_state": RANDOM_SEED,
    "n_jobs": -1,
}

GBR_PARAMS = {
    "n_estimators": 500,
    "learning_rate": 0.03,
    "max_depth": 3,
    "min_samples_leaf": 10,
    "subsample": 0.8,
    "loss": "squared_error",
    "random_state": RANDOM_SEED,
}

FEATURES = [
    "ret_1", "ret_3", "ret_7", "ret_14", "ret_30",
    "lag_ret_1", "lag_ret_2", "lag_ret_3", "lag_ret_5",
    "sma_ratio_7", "sma_ratio_14", "sma_ratio_30", "sma_ratio_50",
    "ema_ratio_12", "ema_ratio_26",
    "rsi_14", "macd_hist", "bb_width_20", "bb_pctb_20",
    "vol_7", "vol_14", "vol_30",
    "atr_norm_14", "hl_range", "close_open",
    "volume_ratio_20", "log_volume",
    "drawdown_252",
    "dow_sin", "dow_cos", "month_sin", "month_cos",
]

FEATURE_GROUPS = {
    "Momentum and returns": [
        "ret_1", "ret_3", "ret_7", "ret_14", "ret_30",
        "lag_ret_1", "lag_ret_2", "lag_ret_3", "lag_ret_5",
    ],
    "Trend and moving averages": [
        "sma_ratio_7", "sma_ratio_14", "sma_ratio_30", "sma_ratio_50",
        "ema_ratio_12", "ema_ratio_26", "macd_hist",
    ],
    "Oscillators": ["rsi_14", "bb_pctb_20", "bb_width_20"],
    "Volatility": ["vol_7", "vol_14", "vol_30", "atr_norm_14", "hl_range"],
    "Volume": ["volume_ratio_20", "log_volume"],
    "Market structure": ["close_open", "drawdown_252"],
    "Calendar": ["dow_sin", "dow_cos", "month_sin", "month_cos"],
}


# --------------------------------------------------------------------------
# Data collection
# --------------------------------------------------------------------------

def fetch_yahoo(symbol: str, years: int = YEARS) -> pd.DataFrame:
    """Pull daily OHLCV from the Yahoo Finance chart endpoint."""
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?range={years}y&interval=1d&includePrePost=false"
    )
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            ),
            "Accept": "application/json",
        },
    )

    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == 2:
                raise RuntimeError(f"Yahoo request failed for {symbol}: {exc}") from exc
            time.sleep(2 * (attempt + 1))

    result = payload["chart"]["result"][0]
    quote = result["indicators"]["quote"][0]
    timestamps = result["timestamp"]

    frame = pd.DataFrame(
        {
            "open": quote["open"],
            "high": quote["high"],
            "low": quote["low"],
            "close": quote["close"],
            "volume": quote["volume"],
        },
        index=pd.to_datetime(timestamps, unit="s", utc=True).tz_localize(None),
    )
    frame.index.name = "date"
    frame = frame.dropna(subset=["close"])
    frame = frame[~frame.index.duplicated(keep="first")].sort_index()
    return frame


# --------------------------------------------------------------------------
# Feature engineering
# --------------------------------------------------------------------------

def _rsi(close: pd.Series, window: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / window, adjust=False, min_periods=window).mean()
    avg_loss = loss.ewm(alpha=1 / window, adjust=False, min_periods=window).mean()
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    return 100 - (100 / (1 + rs))


def add_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Attach technical features and the next-day log-return target."""
    out = frame.copy()
    close = out["close"]
    log_close = np.log(close)

    for days in (1, 3, 7, 14, 30):
        out[f"ret_{days}"] = log_close.diff(days)

    for days in (1, 2, 3, 5):
        out[f"lag_ret_{days}"] = log_close.diff().shift(days)

    for days in (7, 14, 30, 50):
        out[f"sma_ratio_{days}"] = close / close.rolling(days).mean() - 1.0

    for days in (12, 26):
        out[f"ema_ratio_{days}"] = close / close.ewm(span=days, adjust=False).mean() - 1.0

    out["rsi_14"] = _rsi(close)

    ema_fast = close.ewm(span=12, adjust=False).mean()
    ema_slow = close.ewm(span=26, adjust=False).mean()
    macd = ema_fast - ema_slow
    out["macd_hist"] = macd - macd.ewm(span=9, adjust=False).mean()

    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    upper = sma20 + 2 * std20
    lower = sma20 - 2 * std20
    out["bb_width_20"] = (upper - lower) / close
    out["bb_pctb_20"] = (close - lower) / (upper - lower)

    daily_ret = log_close.diff()
    for days in (7, 14, 30):
        out[f"vol_{days}"] = daily_ret.rolling(days).std()

    previous_close = close.shift()
    true_range = pd.concat(
        [
            out["high"] - out["low"],
            (out["high"] - previous_close).abs(),
            (out["low"] - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    out["atr_norm_14"] = true_range.ewm(alpha=1 / 14, adjust=False).mean() / close

    out["hl_range"] = (out["high"] - out["low"]) / close
    out["close_open"] = (out["close"] - out["open"]) / out["open"]

    volume = out["volume"].astype(float)
    out["volume_ratio_20"] = volume / volume.rolling(20).mean()
    out["log_volume"] = np.log1p(volume)

    out["drawdown_252"] = close / close.rolling(252, min_periods=30).max() - 1.0

    dow = out.index.dayofweek
    month = out.index.month
    out["dow_sin"] = np.sin(2 * math.pi * dow / 7)
    out["dow_cos"] = np.cos(2 * math.pi * dow / 7)
    out["month_sin"] = np.sin(2 * math.pi * (month - 1) / 12)
    out["month_cos"] = np.cos(2 * math.pi * (month - 1) / 12)

    # Target: log return realised over the NEXT trading day.
    out["target"] = log_close.shift(-1) - log_close

    return out


# --------------------------------------------------------------------------
# Models, cross-validation and metrics
# --------------------------------------------------------------------------

def make_models() -> dict:
    return {
        "xgboost": xgb.XGBRegressor(**XGB_PARAMS),
        "gradientBoosting": GradientBoostingRegressor(**GBR_PARAMS),
    }


def walk_forward_weights(
    x_train: pd.DataFrame, y_train: pd.Series
) -> tuple[dict, list[dict]]:
    """Score both models on TimeSeriesSplit folds to derive blend weights.

    The test set never enters this calculation, so the weighting cannot leak
    information about the data the ensemble is later judged on.
    """
    splitter = TimeSeriesSplit(n_splits=CV_FOLDS)
    totals = {"xgboost": [], "gradientBoosting": []}
    folds: list[dict] = []

    for index, (train_idx, valid_idx) in enumerate(splitter.split(x_train), start=1):
        x_fit, x_val = x_train.iloc[train_idx], x_train.iloc[valid_idx]
        y_fit, y_val = y_train.iloc[train_idx], y_train.iloc[valid_idx]

        row = {
            "fold": index,
            "trainRows": int(len(train_idx)),
            "validRows": int(len(valid_idx)),
        }

        for name, model in make_models().items():
            model.fit(x_fit, y_fit)
            rmse = float(np.sqrt(mean_squared_error(y_val, model.predict(x_val))))
            totals[name].append(rmse)
            row[f"{name}Rmse"] = rmse

        folds.append(row)

    means = {name: float(np.mean(values)) for name, values in totals.items()}
    inverse = {name: 1.0 / (value ** 2) for name, value in means.items()}
    total = sum(inverse.values())
    weights = {name: round(value / total, 4) for name, value in inverse.items()}

    summary = {
        "meanRmse": {name: round(value, 6) for name, value in means.items()},
        "folds": folds,
    }
    return weights, summary


def regression_metrics(y_true, y_pred, last_prices: np.ndarray) -> dict:
    """Score in return space and in dollar space, where the second one is the
    number a person can actually sanity-check."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    predicted_price = last_prices * np.exp(y_pred)
    actual_price = last_prices * np.exp(y_true)

    sign_match = np.mean(np.sign(y_true) == np.sign(y_pred))
    direction_pool = y_true != 0
    sign_match_strict = (
        float(np.mean(np.sign(y_true[direction_pool]) == np.sign(y_pred[direction_pool])))
        if direction_pool.any()
        else float(sign_match)
    )

    return {
        "returns": {
            "mae": round(float(mean_absolute_error(y_true, y_pred)), 6),
            "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 6),
            "r2": round(float(r2_score(y_true, y_pred)), 4),
        },
        "price": {
            "mae": round(float(mean_absolute_error(actual_price, predicted_price)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(actual_price, predicted_price))), 4),
            "mape": round(float(mean_absolute_percentage_error(actual_price, predicted_price)) * 100, 3),
            "r2": round(float(r2_score(actual_price, predicted_price)), 4),
        },
        "direction": {
            "accuracy": round(float(sign_match) * 100, 2),
            "accuracyExcludingFlat": round(sign_match_strict * 100, 2),
            "evaluatedOn": int(len(y_true)),
        },
    }


def feature_importance(models: dict) -> dict:
    raw = {
        name: sorted(
            zip(FEATURES, model.feature_importances_.astype(float)),
            key=lambda pair: pair[1],
            reverse=True,
        )
        for name, model in models.items()
    }

    merged_totals: dict[str, float] = {}
    for rows in raw.values():
        span = sum(value for _, value in rows) or 1.0
        for feature, value in rows:
            merged_totals[feature] = merged_totals.get(feature, 0.0) + (value / span) / 2

    merged = sorted(merged_totals.items(), key=lambda pair: pair[1], reverse=True)

    payload = {
        name: [{"feature": f, "value": round(v, 5)} for f, v in rows]
        for name, rows in raw.items()
    }
    payload["merged"] = [
        {"feature": f, "value": round(v, 5)} for f, v in merged
    ]
    return payload


def recursive_forecast(
    frame: pd.DataFrame,
    models: dict,
    weights: dict,
    horizon: int,
    band_rmse: float,
) -> dict:
    """Walk forward one day at a time, feeding each prediction back in.

    Features of row t only ever look at data up to and including row t, so the
    first step is predicted from real history. Every later step is predicted
    from a close this function generated itself, which is why the band has to
    widen with the horizon.
    """
    history = frame.copy()
    start = history.index[-1]
    cursor = start

    dates: list[str] = []
    prices: list[float] = []

    for _ in range(horizon):
        cursor = cursor + timedelta(days=1)
        last_features = add_features(history).iloc[[-1]]

        if bool(last_features[FEATURES].isna().any(axis=None)):
            predicted_return = 0.0
        else:
            predicted_return = sum(
                weights[name] * float(model.predict(last_features[FEATURES])[0])
                for name, model in models.items()
            )

        previous_close = float(history["close"].iloc[-1])
        new_close = previous_close * math.exp(predicted_return)

        history = pd.concat(
            [
                history,
                pd.DataFrame(
                    [
                        {
                            "open": previous_close,
                            "high": max(previous_close, new_close),
                            "low": min(previous_close, new_close),
                            "close": new_close,
                            "volume": float(history["volume"].iloc[-1]),
                        }
                    ],
                    index=[cursor],
                ),
            ]
        )

        dates.append(cursor.strftime("%Y-%m-%d"))
        prices.append(round(new_close, 6))

    band = [
        1.96 * band_rmse * math.sqrt(step) for step in range(1, horizon + 1)
    ]
    lower = [round(p * math.exp(-s), 6) for p, s in zip(prices, band)]
    upper = [round(p * math.exp(s), 6) for p, s in zip(prices, band)]

    return {
        "startDate": start.strftime("%Y-%m-%d"),
        "horizon": horizon,
        "dates": dates,
        "prices": prices,
        "lower": lower,
        "upper": upper,
        "method": (
            "Recursive multi-step. Each predicted close is appended to the "
            "history and the features are recomputed before the next day, so "
            "step two onward is forecasting our own output. The band is 1.96 x "
            "ensemble test RMSE scaled by sqrt(h), which is why it widens."
        ),
    }


# --------------------------------------------------------------------------
# Reporting helpers
# --------------------------------------------------------------------------

def _clean_prices(values: pd.Series | np.ndarray) -> list:
    array = np.asarray(values, dtype=float)
    decimals = 6 if np.nanmean(np.abs(array)) < 1 else 2
    return [round(float(v), decimals) for v in array]


def money_mae(value: float) -> str:
    """Dollar error, with decimals only when the coin trades low enough to need them."""
    digits = 0 if abs(value) >= 100 else 2
    return f"${value:,.{digits}f}"


def pipeline_steps(context: dict) -> list[dict]:
    data = context["data"]
    split = data["split"]
    cv = context["cv"]
    ensemble = context["config"]["ensemble"]
    best = context["metrics"]["ensemble"]

    return [
        {
            "id": "collect",
            "title": "Collect five years of daily bars",
            "body": (
                f"{data['rows']} daily candles for {context['yahooSymbol']} run from "
                f"{data['start']} to {data['end']}, pulled from the Yahoo Finance chart "
                "endpoint. One HTTP request, no API key."
            ),
            "stat": f"{data['rows']} rows",
        },
        {
            "id": "features",
            "title": "Engineer technical features",
            "body": (
                f"{data['featureCount']} inputs are derived from price and volume: returns "
                "and lags, moving-average distance, RSI, MACD, Bollinger position, rolling "
                "volatility, ATR, volume pressure and calendar cycles. Each row predicts the "
                "next day, never the day it describes."
            ),
            "stat": f"{data['featureCount']} features",
        },
        {
            "id": "split",
            "title": "Split in chronological order",
            "body": (
                f"The first {split['trainRows']} rows train the models and the last "
                f"{split['testRows']} rows are held back untouched. The cut sits at "
                f"{split['splitDate']}. Time series are never shuffled, so the split "
                "follows the calendar to stop the models from reading the future."
            ),
            "stat": f"{round(split['ratio'] * 100)} / {round((1 - split['ratio']) * 100)}",
        },
        {
            "id": "cv",
            "title": "Score both models with walk-forward validation",
            "body": (
                f"{len(cv['folds'])} expanding-window folds run inside the training "
                "block. Each fold trains up to that point and validates on the slice "
                "just after it, which reproduces how the model would really be used."
            ),
            "stat": f"{len(cv['folds'])} folds",
        },
        {
            "id": "blend",
            "title": "Weight the ensemble by cross-validation error",
            "body": (
                f"XGBoost averaged {cv['meanRmse']['xgboost']} RMSE and Gradient Boosting "
                f"averaged {cv['meanRmse']['gradientBoosting']}. Weights are the inverse of "
                f"those squared errors, which produced "
                f"{ensemble['weights']['xgboost']:.0%} and "
                f"{ensemble['weights']['gradientBoosting']:.0%}. The test set had no say."
            ),
            "stat": (
                f"{ensemble['weights']['xgboost']:.0%} / "
                f"{ensemble['weights']['gradientBoosting']:.0%}"
            ),
        },
        {
            "id": "evaluate",
            "title": "Judge the blend against held-out prices",
            "body": (
                f"On {context['metrics']['ensemble']['direction']['evaluatedOn']} unseen days "
                f"the ensemble reached R2 {best['price']['r2']:.3f}, a mean price error of "
                f"{money_mae(best['price']['mae'])} and "
                f"{best['direction']['accuracy']}% directional "
                "accuracy. These are the numbers the models never saw while learning."
            ),
            "stat": f"{best['direction']['accuracy']}%",
        },
    ]


def config_block(weights: dict) -> dict:
    return {
        "target": "Next-day log return",
        "split": {
            "method": "Chronological hold-out",
            "ratio": round(1 - TEST_RATIO, 2),
        },
        "crossValidation": {
            "method": "TimeSeriesSplit, expanding window",
            "folds": CV_FOLDS,
        },
        "seed": RANDOM_SEED,
        "models": {
            "xgboost": {"label": "XGBoost", "library": f"xgboost {xgb.__version__}",
                        "params": XGB_PARAMS},
            "gradientBoosting": {
                "label": "Gradient Boosting",
                "library": f"scikit-learn {sklearn.__version__}",
                "params": GBR_PARAMS,
            },
        },
        "ensemble": {
            "method": "Inverse-CV-RMSE weighted mean",
            "formula": "w_i = (1 / rmse_i^2) / sum(1 / rmse_j^2)",
            "weights": weights,
        },
    }


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------

def train_coin(coin_id: str) -> dict:
    ticker, name, symbol = COINS[coin_id]
    started = time.perf_counter()

    frame = fetch_yahoo(ticker)
    featured = add_features(frame)
    modelled = featured.dropna(subset=FEATURES + ["target"]).copy()

    if len(modelled) < 400:
        raise RuntimeError(f"{ticker} returned only {len(modelled)} usable rows")

    x_all = modelled[FEATURES]
    y_all = modelled["target"]

    split_at = int(len(modelled) * (1 - TEST_RATIO))
    x_train, x_test = x_all.iloc[:split_at], x_all.iloc[split_at:]
    y_train, y_test = y_all.iloc[:split_at], y_all.iloc[split_at:]

    weights, cv_summary = walk_forward_weights(x_train, y_train)

    models = make_models()
    for model in models.values():
        model.fit(x_train, y_train)

    predictions = {name_: model.predict(x_test) for name_, model in models.items()}
    blend = (
        weights["xgboost"] * predictions["xgboost"]
        + weights["gradientBoosting"] * predictions["gradientBoosting"]
    )

    test_close = modelled["close"].iloc[split_at:].to_numpy(dtype=float)
    metrics = {
        "xgboost": regression_metrics(y_test, predictions["xgboost"], test_close),
        "gradientBoosting": regression_metrics(
            y_test, predictions["gradientBoosting"], test_close
        ),
        "ensemble": regression_metrics(y_test, blend, test_close),
        # Persistence baseline: forecast tomorrow's return as zero, i.e. "the
        # price stays exactly where it is". Any model that cannot beat this is
        # not adding information, and price-space R2 is close to 1 for the
        # baseline too, which is exactly why the baseline is reported.
        "baseline": regression_metrics(y_test, np.zeros(len(y_test)), test_close),
    }
    metrics["baseline"]["label"] = "Naive persistence (predict no change)"
    metrics["baseline"]["direction"] = {
        "accuracy": None,
        "accuracyExcludingFlat": None,
        "evaluatedOn": int(len(y_test)),
        "predictsDirection": False,
        "note": "A zero-return forecast never calls a direction, so there is no accuracy to report.",
    }
    metrics["baseline"]["note"] = (
        "Predicts a 0% move tomorrow. Price-space R2 looks excellent for this "
        "row as well, because one-day-ahead prices are dominated by yesterday's "
        "price. Read the return-space R2 and the MAPE instead."
    )

    ensemble_return_rmse = metrics["ensemble"]["returns"]["rmse"]

    test_dates = [d.strftime("%Y-%m-%d") for d in modelled.index[split_at:]]
    actual_price = _clean_prices(test_close * np.exp(y_test.to_numpy(dtype=float)))

    history_slice = featured.iloc[-CONTEXT_DAYS:]
    duration = time.perf_counter() - started

    payload = {
        "coin": coin_id,
        "name": name,
        "symbol": symbol,
        "yahooSymbol": ticker,
        "trainedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "durationSec": round(duration, 2),
        "runtime": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scikitLearn": sklearn.__version__,
            "xgboost": xgb.__version__,
        },
        "source": {
            "provider": "Yahoo Finance",
            "endpoint": f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}",
            "granularity": "1d",
            "range": f"{YEARS}y",
            "note": (
                "The CoinGecko free tier stops at 365 days on market_chart, so five "
                "years of history comes from Yahoo instead."
            ),
        },
        "data": {
            "rows": int(len(modelled)),
            "rawRows": int(len(frame)),
            "start": modelled.index[0].strftime("%Y-%m-%d"),
            "end": modelled.index[-1].strftime("%Y-%m-%d"),
            "featureCount": len(FEATURES),
            "features": FEATURES,
            "featureGroups": FEATURE_GROUPS,
            "target": "Next-day log return",
            "split": {
                "ratio": round(1 - TEST_RATIO, 2),
                "trainRows": int(len(x_train)),
                "testRows": int(len(x_test)),
                "trainStart": modelled.index[0].strftime("%Y-%m-%d"),
                "trainEnd": modelled.index[split_at - 1].strftime("%Y-%m-%d"),
                "testStart": modelled.index[split_at].strftime("%Y-%m-%d"),
                "testEnd": modelled.index[-1].strftime("%Y-%m-%d"),
                "splitDate": modelled.index[split_at].strftime("%Y-%m-%d"),
            },
        },
        "config": config_block(weights),
        "cv": cv_summary,
        "metrics": metrics,
        "featureImportance": feature_importance(models),
        "test": {
            "dates": test_dates,
            "actualReturn": [round(float(v), 6) for v in y_test.to_numpy()],
            "actualPrice": actual_price,
            "lastClose": _clean_prices(test_close),
            "predicted": {
                "xgboost": _clean_prices(test_close * np.exp(predictions["xgboost"])),
                "gradientBoosting": _clean_prices(
                    test_close * np.exp(predictions["gradientBoosting"])
                ),
                "ensemble": _clean_prices(test_close * np.exp(blend)),
            },
            "predictedReturn": {
                "xgboost": [round(float(v), 6) for v in predictions["xgboost"]],
                "gradientBoosting": [
                    round(float(v), 6) for v in predictions["gradientBoosting"]
                ],
                "ensemble": [round(float(v), 6) for v in blend],
            },
        },
        "history": {
            "dates": [d.strftime("%Y-%m-%d") for d in history_slice.index],
            "close": _clean_prices(history_slice["close"].to_numpy()),
            "volume": [int(v) for v in history_slice["volume"].fillna(0).to_numpy()],
        },
        "forecast": recursive_forecast(
            featured, models, weights, FORECAST_DAYS, ensemble_return_rmse
        ),
    }

    payload["pipeline"] = pipeline_steps(payload)
    payload["summary"] = {
        "r2": metrics["ensemble"]["price"]["r2"],
        "returnR2": metrics["ensemble"]["returns"]["r2"],
        "mape": metrics["ensemble"]["price"]["mape"],
        "baselineMape": metrics["baseline"]["price"]["mape"],
        "mae": metrics["ensemble"]["price"]["mae"],
        "direction": metrics["ensemble"]["direction"]["accuracy"],
        "rows": int(len(modelled)),
        "start": payload["data"]["start"],
        "end": payload["data"]["end"],
        "featureCount": len(FEATURES),
        "trainedAt": payload["trainedAt"],
        "durationSec": payload["durationSec"],
        "weights": weights,
        "cvFolds": CV_FOLDS,
        "testRows": int(len(x_test)),
        # Does the ensemble actually earn its keep over predicting no change?
        "beatsBaseline": {
            "mape": metrics["ensemble"]["price"]["mape"]
            < metrics["baseline"]["price"]["mape"],
            "returnR2": metrics["ensemble"]["returns"]["r2"]
            > metrics["baseline"]["returns"]["r2"],
        },
        "forecast": payload["forecast"]["prices"][-1],
        "forecastDate": payload["forecast"]["dates"][-1],
        "lastClose": float(modelled["close"].iloc[-1]),
    }

    return payload


def write_payload(payload: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUT_DIR / f"{payload['coin']}.json"
    target.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"  wrote {target.relative_to(ROOT)} ({target.stat().st_size / 1024:.0f} KB)")


def write_index(payloads: list[dict]) -> None:
    """Write a slim index. The full payloads live in their own coin files;
    duplicating them here would multiply the response size by the coin count."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    slim = [
        {
            "coin": p["coin"],
            "name": p["name"],
            "symbol": p["symbol"],
            "yahooSymbol": p["yahooSymbol"],
            "trainedAt": p["trainedAt"],
            "durationSec": p["durationSec"],
            "source": p["source"]["provider"],
            "summary": p["summary"],
        }
        for p in payloads
    ]
    index = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "coins": sorted(slim, key=lambda e: e["summary"]["rows"], reverse=True),
    }
    target = OUT_DIR / "index.json"
    target.write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"  wrote {target.relative_to(ROOT)}")


def main(argv: list[str]) -> int:
    requested = argv[1:] or list(COINS)
    unknown = [coin for coin in requested if coin not in COINS]
    if unknown:
        print(f"Unknown coin(s): {', '.join(unknown)}", file=sys.stderr)
        print(f"Available: {', '.join(COINS)}", file=sys.stderr)
        return 2

    entries: list[dict] = []
    failures: list[str] = []

    for coin_id in requested:
        print(f"[{coin_id}] training ...", flush=True)
        try:
            payload = train_coin(coin_id)
        except Exception as exc:  # noqa: BLE001 - report and continue
            failures.append(f"{coin_id}: {exc}")
            print(f"[{coin_id}] FAILED - {exc}", file=sys.stderr, flush=True)
            continue

        write_payload(payload)
        entries.append(payload)
        summary = payload["summary"]
        print(
            f"[{coin_id}] rows={summary['rows']} r2={summary['r2']:.3f} "
            f"mape={summary['mape']:.2f}% dir={summary['direction']}% "
            f"({summary['durationSec']}s)",
            flush=True,
        )

    if entries:
        combined = [next(e for e in entries if e["coin"] == entry["coin"]) for entry in entries]
        write_index(combined)

    if failures:
        print(f"\n{len(failures)} coin(s) failed:", file=sys.stderr)
        for failure in failures:
            print(f"  {failure}", file=sys.stderr)
        return 1 if len(failures) == len(requested) else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
