import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
	SURFACE,
	fix,
	longDate,
	money,
	pct,
	priceDigits,
} from "../../constants/ml";
import { useAuth } from "../../context/AuthContext";

const tone = (value) =>
	value >= 0
		? "text-emerald-700 dark:text-emerald-400"
		: "text-red-700 dark:text-red-400";

const Cell = ({ label, children }) => (
	<div>
		<p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
			{label}
		</p>
		<p className="mt-1 font-mono text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50 sm:text-base">
			{children}
		</p>
	</div>
);

/*
 * Formats the number separately from the sign check: money() and pct()
 * return strings, and comparing a string with >= is always false, which
 * would silently drop the + from every positive figure.
 */
const signed = (value, formatted) =>
	`${value >= 0 ? "+" : ""}${formatted}`;

/*
 * The chart above this panel is a price path; this is the same path expressed
 * as money. Two views share one set of forecast numbers: any amount a visitor
 * picks, and - when they are signed in and hold this coin - their actual
 * position measured against what they paid. Every figure is priced at the
 * model's last close, because that is the price the forecast is seeded from,
 * so the arithmetic lines up with the chart directly above it.
 */
const Projection = ({ model, portfolio }) => {
	const { isAuthenticated } = useAuth();
	const [amount, setAmount] = useState("1000");

	const stats = useMemo(() => {
		const last = model.summary.lastClose;
		const index = model.forecast.horizon - 1;
		const mid = model.forecast.prices[index];
		return {
			last,
			mid,
			low: model.forecast.lower[index],
			high: model.forecast.upper[index],
			changePct: ((mid - last) / last) * 100,
			digits: priceDigits(last),
			date: model.forecast.dates[index],
		};
	}, [model]);

	const holding = portfolio?.[model.coin];
	const ownsIt =
		isAuthenticated &&
		holding &&
		Number(holding.coins) > 0 &&
		Number(holding.totalInvestment) > 0;

	const position = useMemo(() => {
		if (!ownsIt) return null;
		const coins = Number(holding.coins);
		const cost = Number(holding.totalInvestment);
		const mid = coins * stats.mid;
		const pnl = mid - cost;
		return {
			cost,
			now: coins * stats.last,
			mid,
			best: coins * stats.high,
			worst: coins * stats.low,
			pnl,
			pnlPct: (pnl / cost) * 100,
		};
	}, [ownsIt, holding, stats]);

	const value = Number(amount);
	const hasAmount = Number.isFinite(value) && value > 0;
	const units = hasAmount ? value / stats.last : null;
	const projected = hasAmount ? units * stats.mid : null;
	const profit = hasAmount ? projected - value : null;

	return (
		<div className={`${SURFACE} overflow-hidden`}>
			{/* ---- the visitor's own holding, projected ---- */}
			{position && (
				<div className="border-b border-gray-200/80 p-5 sm:p-6 dark:border-gray-700/70">
					<p className="font-mono text-[11px] font-medium tracking-[0.18em] text-blue-600 uppercase dark:text-blue-400">
						Your position &middot; {model.name}
					</p>

					<div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
						<span
							id="position-pnl"
							className={`font-mono text-2xl font-medium tabular-nums sm:text-3xl ${tone(position.pnl)}`}
						>
							{signed(position.pnl, money(position.pnl, 2))}
						</span>
						<span
							className={`font-mono text-sm tabular-nums ${tone(position.pnl)}`}
						>
							{signed(position.pnlPct, pct(position.pnlPct, 1))}
						</span>
						<span className="text-xs text-gray-500 dark:text-gray-400">
							projected profit by {longDate(stats.date)}
						</span>
					</div>

					<div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
						<Cell label="Invested">{money(position.cost, 2)}</Cell>
						<Cell label="Value at last close">{money(position.now, 2)}</Cell>
						<Cell label="Projected value">{money(position.mid, 2)}</Cell>
						<Cell label="95% range">
							{money(position.worst, 2)} &ndash; {money(position.best, 2)}
						</Cell>
					</div>
				</div>
			)}

			{/* ---- any amount, no account needed ---- */}
			<div className="p-5 sm:p-6">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<label
							htmlFor="projection-amount"
							className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
						>
							Amount to project (USD)
						</label>
						<div className="mt-1 flex items-center gap-2">
							<span className="font-mono text-sm text-gray-400 dark:text-gray-500">
								$
							</span>
							<input
								id="projection-amount"
								type="number"
								min="0"
								step="any"
								inputMode="decimal"
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								className="w-36 border border-gray-200 bg-white px-3 py-2 font-mono text-sm tabular-nums text-gray-900 outline-none transition-colors duration-150 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-50"
							/>
						</div>
					</div>

					<p className="text-xs text-gray-500 dark:text-gray-400">
						Entry at the model&rsquo;s last close of{" "}
						<span className="font-mono text-gray-700 tabular-nums dark:text-gray-200">
							{money(stats.last, stats.digits)}
						</span>{" "}
						&middot; target {longDate(stats.date)}
					</p>
				</div>

				{hasAmount ? (
					<>
						<div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
							<span
								id="projection-value"
								aria-live="polite"
								className="font-mono text-2xl font-medium tabular-nums text-gray-900 sm:text-3xl dark:text-gray-50"
							>
								{money(projected, 2)}
							</span>
							<span
								className={`font-mono text-sm tabular-nums ${tone(profit)}`}
							>
								{signed(profit, money(profit, 2))} (
								{signed(stats.changePct, pct(stats.changePct, 1))})
							</span>
						</div>

						<div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
							<Cell label="Units you'd hold">
								{fix(units, units < 1 ? 6 : 2)} {model.symbol}
							</Cell>
							<Cell label="Entry price">{money(stats.last, stats.digits)}</Cell>
							<Cell label="Best case (95%)">
								{money(units * stats.high, 2)}
							</Cell>
							<Cell label="Worst case (95%)">
								{money(units * stats.low, 2)}
							</Cell>
						</div>
					</>
				) : (
					<p className="mt-5 text-sm text-gray-500 dark:text-gray-400">
						Enter an amount greater than zero to see the projection.
					</p>
				)}
			</div>

			{!isAuthenticated && (
				<p className="border-t border-gray-100 px-5 py-4 text-xs text-gray-500 sm:px-6 dark:border-gray-700/60 dark:text-gray-400">
					<Link
						to="/login"
						className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
					>
						Log in
					</Link>{" "}
					to see this same forecast applied to the position you actually hold.
				</p>
			)}

			<p className="border-t border-gray-100 px-5 py-4 text-xs leading-relaxed text-gray-500 sm:px-6 dark:border-gray-700/60 dark:text-gray-400">
				Midpoint of the model&rsquo;s own 14-day forecast, with the range read
				from its 95% band. Entry uses the last close because that is what the
				forecast is seeded from &mdash; no fees, no slippage, and this run{" "}
				{model.summary.beatsBaseline?.mape ? "beats" : "does not beat"} naive
				persistence on price error ({pct(model.summary.mape)} vs{" "}
				{pct(model.summary.baselineMape)}). Illustration, not financial advice.
			</p>
		</div>
	);
};

export default Projection;
