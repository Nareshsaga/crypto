import { useMemo, useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	PALETTE,
	SURFACE,
	longDate,
	money,
	pct,
	priceDigits,
	axisPrice,
	shortDate,
	MODEL_META,
} from "../../constants/ml";
import useTheme from "../../hooks/useTheme";

const SERIES_KEYS = ["ensemble", "xgboost", "gradientBoosting"];

const tooltipBox = (pal) => ({
	background: pal.tooltipBg,
	border: `1px solid ${pal.tooltipBorder}`,
	color: pal.tooltipText,
});

/*
 * Actual against predicted over the held-out window. Defaults to price, which
 * is the number a reader can check against a chart they already trust, with a
 * return view for judging the model on its own terms.
 */
const PredictionChart = ({ model }) => {
	const { theme } = useTheme();
	const pal = PALETTE[theme === "dark" ? "dark" : "light"];

	const [mode, setMode] = useState("price");
	const [active, setActive] = useState({
		ensemble: true,
		xgboost: false,
		gradientBoosting: false,
	});

	const rows = useMemo(() => {
		const { test } = model;
		return test.dates.map((date, i) => ({
			date,
			actualPrice: test.actualPrice[i],
			ensemblePrice: test.predicted.ensemble[i],
			xgboostPrice: test.predicted.xgboost[i],
			gradientBoostingPrice: test.predicted.gradientBoosting[i],
			actualReturn: test.actualReturn[i],
			ensembleReturn: test.predictedReturn.ensemble[i],
			xgboostReturn: test.predictedReturn.xgboost[i],
			gradientBoostingReturn: test.predictedReturn.gradientBoosting[i],
		}));
	}, [model]);

	const isPrice = mode === "price";
	const suffix = isPrice ? "Price" : "Return";

	const renderTooltip = ({ active: on, payload, label }) => {
		if (!on || !payload?.length) return null;
		const visible = payload.filter((p) => p.value !== null && p.value !== undefined);
		if (!visible.length) return null;

		return (
			<div
				className="surface px-3 py-2 shadow-lg"
				style={tooltipBox(pal)}
			>
				<p className="mb-1 font-mono text-[10px] tracking-wider text-gray-400 uppercase">
					{longDate(label)}
				</p>
				{visible.map((p) => (
					<p key={p.dataKey} className="font-mono text-xs tabular-nums">
						<span
							className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
							style={{ background: p.stroke }}
						/>
						<span className="text-gray-400">{p.name}</span>{" "}
						{isPrice
							? money(p.value, priceDigits(p.value))
							: pct(Number(p.value) * 100, 2)}
					</p>
				))}
			</div>
		);
	};

	const toggle = (key) =>
		setActive((prev) => ({ ...prev, [key]: !prev[key] }));

	return (
		<div className={`${SURFACE} p-4 sm:p-6`}>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div
					className="control flex border border-gray-200 p-0.5 dark:border-gray-700"
					role="tablist"
					aria-label="Chart metric"
				>
					{["price", "return"].map((value) => (
						<button
							key={value}
							role="tab"
							aria-selected={mode === value}
							onClick={() => setMode(value)}
							className={`control px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
								mode === value
									? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
									: "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
							}`}
						>
							{value === "price" ? "Price" : "Daily return"}
						</button>
					))}
				</div>

				<div className="flex flex-wrap gap-1.5">
					{SERIES_KEYS.map((key) => (
						<button
							key={key}
							onClick={() => toggle(key)}
							aria-pressed={active[key]}
							className={`control border px-2.5 py-1.5 font-mono text-[11px] transition-colors duration-150 ${
								active[key]
									? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300"
									: "border-gray-200 text-gray-400 hover:text-gray-600 dark:border-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
							}`}
						>
							{MODEL_META[key].short}
						</button>
					))}
				</div>
			</div>

			<div className="h-[340px] w-full sm:h-[400px]">
				<ResponsiveContainer width="100%" height="100%">
					<LineChart
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
							minTickGap={48}
						/>
						<YAxis
							stroke={pal.axis}
							tick={{ fontSize: 11, fontFamily: "inherit" }}
							tickLine={false}
							axisLine={false}
							width={54}
							tickFormatter={(v) =>
								isPrice ? axisPrice(v) : `${(v * 100).toFixed(1)}%`
							}
						/>
						<Tooltip
							content={renderTooltip}
							cursor={{ stroke: pal.axis, strokeDasharray: "3 3" }}
						/>

						<Line
							type="linear"
							dataKey={`actual${suffix}`}
							name="Actual"
							stroke={pal.actual}
							strokeWidth={1.4}
							dot={false}
							isAnimationActive={false}
						/>
						{SERIES_KEYS.filter((key) => active[key]).map((key) => (
							<Line
								key={key}
								type="linear"
								dataKey={`${key}${suffix}`}
								name={MODEL_META[key].label}
								stroke={pal[key]}
								strokeWidth={key === "ensemble" ? 2 : 1.4}
								strokeDasharray={key === "gradientBoosting" ? "5 3" : undefined}
								dot={false}
								isAnimationActive={false}
							/>
						))}
					</LineChart>
				</ResponsiveContainer>
			</div>

			<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
				<span className="flex items-center gap-2">
					<span
						className="h-0.5 w-5"
						style={{ background: pal.actual }}
					/>
					Actual
				</span>
				{SERIES_KEYS.filter((key) => active[key]).map((key) => (
					<span key={key} className="flex items-center gap-2">
						<span
							className="h-0.5 w-5"
							style={{ background: pal[key] }}
						/>
						{MODEL_META[key].label}
					</span>
				))}
				<span className="ml-auto font-mono text-[11px] text-gray-400">
					{longDate(rows[0]?.date)} to {longDate(rows[rows.length - 1]?.date)}
				</span>
			</div>
		</div>
	);
};

export default PredictionChart;
