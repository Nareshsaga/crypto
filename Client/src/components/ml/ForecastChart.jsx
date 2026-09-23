import { useMemo } from "react";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	PALETTE,
	SURFACE,
	axisPrice,
	longDate,
	money,
	priceDigits,
	shortDate,
} from "../../constants/ml";
import useTheme from "../../hooks/useTheme";

const HISTORY_TAIL = 45;

/*
 * Real history butting up against a recursive 14-day forecast, with a band
 * that widens as the model starts forecasting its own output. The last real
 * close seeds the forecast line so the two join instead of leaving a gap.
 */
const ForecastChart = ({ model }) => {
	const { theme } = useTheme();
	const pal = PALETTE[theme === "dark" ? "dark" : "light"];

	const { rows, lastClose, forecast } = useMemo(() => {
		const { history, forecast: fc } = model;
		const start = Math.max(0, history.dates.length - HISTORY_TAIL);

		const built = history.dates.slice(start).map((date, offset) => ({
			date,
			actual: history.close[start + offset],
			forecast: null,
			upper: null,
			lower: null,
			band: null,
			history: history.close[start + offset],
		}));

		const tail = built[built.length - 1];
		const anchor = tail ? tail.actual : model.summary.lastClose;
		if (tail) {
			tail.forecast = anchor;
			tail.upper = anchor;
			tail.lower = anchor;
			tail.band = [anchor, anchor];
		}

		fc.dates.forEach((date, i) => {
			const lower = fc.lower[i];
			const upper = fc.upper[i];
			built.push({
				date,
				actual: null,
				forecast: fc.prices[i],
				upper,
				lower,
				band: [lower, upper],
				history: null,
			});
		});

		return { rows: built, lastClose: anchor, forecast: fc };
	}, [model]);

	const renderTooltip = ({ active: on, payload, label }) => {
		if (!on || !payload?.length) return null;
		const point = payload[0]?.payload;
		if (!point) return null;

		return (
			<div className="surface px-3 py-2 shadow-lg" style={{
				background: pal.tooltipBg,
				border: `1px solid ${pal.tooltipBorder}`,
				color: pal.tooltipText,
			}}>
				<p className="mb-1 font-mono text-[10px] tracking-wider text-gray-400 uppercase">
					{longDate(label)}
				</p>
				{point.history != null && (
					<p className="font-mono text-xs tabular-nums">
						<span className="text-gray-400">Close</span>{" "}
						{money(point.history, priceDigits(point.history))}
					</p>
				)}
				{point.forecast != null && (
					<p className="font-mono text-xs tabular-nums">
						<span style={{ color: pal.ensemble }}>Forecast</span>{" "}
						{money(point.forecast, priceDigits(point.forecast))}
					</p>
				)}
				{point.upper != null && point.lower != null && (
					<p className="font-mono text-[11px] tabular-nums text-gray-400">
						95% band {money(point.lower, priceDigits(point.lower))} to{" "}
						{money(point.upper, priceDigits(point.upper))}
					</p>
				)}
			</div>
		);
	};

	const change = ((forecast.prices[forecast.prices.length - 1] - lastClose) / lastClose) * 100;

	return (
		<div className={`${SURFACE} p-4 sm:p-6`}>
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<div>
					<p className="text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
						Next {forecast.horizon} days
					</p>
					<p className="mt-1 font-mono text-2xl font-medium text-gray-900 tabular-nums dark:text-gray-50">
						{money(forecast.prices[forecast.prices.length - 1])}
						<span
							className={`ml-3 text-sm font-normal ${
								change >= 0
									? "text-emerald-600 dark:text-emerald-400"
									: "text-red-600 dark:text-red-400"
							}`}
						>
							{change >= 0 ? "+" : ""}
							{change.toFixed(1)}%
						</span>
					</p>
				</div>
				<p className="max-w-md text-xs leading-relaxed text-gray-500 dark:text-gray-400">
					{forecast.method}
				</p>
			</div>

			<div className="h-[300px] w-full sm:h-[360px]">
				<ResponsiveContainer width="100%" height="100%">
					<ComposedChart
						data={rows}
						margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
					>
						<CartesianGrid
							stroke={pal.grid}
							strokeDasharray="2 4"
							vertical={false}
						/>
						<XAxis
							dataKey="date"
							tickFormatter={shortDate}
							stroke={pal.axis}
							tick={{ fontSize: 11, fontFamily: "inherit" }}
							tickLine={false}
							axisLine={{ stroke: pal.grid }}
							interval="preserveStartEnd"
							minTickGap={44}
						/>
						<YAxis
							stroke={pal.axis}
							tick={{ fontSize: 11, fontFamily: "inherit" }}
							tickLine={false}
							axisLine={false}
							width={56}
							tickFormatter={axisPrice}
							domain={["auto", "auto"]}
						/>
						<Tooltip content={renderTooltip} cursor={{ stroke: pal.axis, strokeDasharray: "3 3" }} />

						<Area
							type="linear"
							dataKey="band"
							stroke="none"
							fill={pal.band}
							fillOpacity={0.13}
							isAnimationActive={false}
							name="Band"
						/>
						<Line
							type="linear"
							dataKey="history"
							name="Close"
							stroke={pal.actual}
							strokeWidth={1.6}
							dot={false}
							isAnimationActive={false}
						/>
						<Line
							type="linear"
							dataKey="forecast"
							name="Forecast"
							stroke={pal.ensemble}
							strokeWidth={2}
							strokeDasharray="6 4"
							dot={false}
							isAnimationActive={false}
						/>
					</ComposedChart>
				</ResponsiveContainer>
			</div>

			<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
				<span className="flex items-center gap-2">
					<span className="h-0.5 w-5" style={{ background: pal.actual }} />
					Last {HISTORY_TAIL} days
				</span>
				<span className="flex items-center gap-2">
					<span className="h-0.5 w-5" style={{ background: pal.ensemble }} />
					Ensemble forecast
				</span>
				<span className="flex items-center gap-2">
					<span
						className="h-2.5 w-5 rounded-sm"
						style={{ background: pal.band, opacity: 0.25 }}
					/>
					95% band
				</span>
				<span className="ml-auto font-mono text-[11px] text-gray-400">
					Trained {longDate(model.trainedAt)}
				</span>
			</div>
		</div>
	);
};

export default ForecastChart;
