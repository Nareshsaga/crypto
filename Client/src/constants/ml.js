export const API_URL =
	import.meta.env.VITE_API_URL || "http://localhost:3000";

/*
 * One surface treatment for the whole page: 12px radius, hairline border, and
 * a shadow so diffuse it only reads as depth rather than as a drop shadow.
 */
export const SURFACE =
	"surface border border-gray-200/80 dark:border-gray-700/70 bg-white dark:bg-gray-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)]";

/* Chart palette: one blue accent for the model under test, neutral ink for
 * reality, and a desaturated slate for the second model. */
export const PALETTE = {
	light: {
		actual: "#0f172a",
		ensemble: "#2563eb",
		xgboost: "#3b82f6",
		gradientBoosting: "#94a3b8",
		band: "#2563eb",
		grid: "#e5e7eb",
		axis: "#9ca3af",
		tooltipBg: "#ffffff",
		tooltipBorder: "#e5e7eb",
		tooltipText: "#111827",
	},
	dark: {
		actual: "#e5e7eb",
		ensemble: "#60a5fa",
		xgboost: "#3b82f6",
		gradientBoosting: "#64748b",
		band: "#60a5fa",
		grid: "#374151",
		axis: "#9ca3af",
		tooltipBg: "#1f2937",
		tooltipBorder: "#374151",
		tooltipText: "#f3f4f6",
	},
};

export const MODEL_META = {
	xgboost: { label: "XGBoost", short: "XGB" },
	gradientBoosting: { label: "Gradient Boosting", short: "GBR" },
	ensemble: { label: "Ensemble", short: "ENS" },
	baseline: { label: "Naive persistence", short: "BASE" },
};

/* ---- formatters ---- */

export const pct = (value, digits = 2) =>
	value === null || value === undefined || Number.isNaN(value)
		? "n/a"
		: `${Number(value).toFixed(digits)}%`;

export const fix = (value, digits = 2) =>
	value === null || value === undefined || Number.isNaN(value)
		? "n/a"
		: Number(value).toFixed(digits);

export const money = (value, digits = 2) =>
	value === null || value === undefined || Number.isNaN(value)
		? "n/a"
		: new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: "USD",
				minimumFractionDigits: digits,
				maximumFractionDigits: digits,
		  }).format(value);

export const compact = (value) =>
	value === null || value === undefined || Number.isNaN(value)
		? "n/a"
		: new Intl.NumberFormat("en-US", {
				notation: "compact",
				maximumFractionDigits: 1,
		  }).format(value);

/* Crypto spans six orders of magnitude, from DOGE cents to BTC five figures,
 * so axis and tooltip precision follow the value rather than one fixed rule. */
export const priceDigits = (value) => {
	const abs = Math.abs(Number(value) || 0);
	if (abs >= 1000) return 0;
	if (abs >= 1) return 2;
	return 4;
};

export const axisPrice = (value) => {
	const abs = Math.abs(Number(value) || 0);
	if (abs >= 1000) return compact(value);
	if (abs >= 1) return Number(value).toFixed(0);
	return Number(value).toFixed(4);
};

export const integer = (value) =>
	value === null || value === undefined || Number.isNaN(value)
		? "n/a"
		: new Intl.NumberFormat("en-US").format(Math.round(value));

export const longDate = (iso) => {
	if (!iso) return "n/a";
	const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
};

export const shortDate = (iso) => {
	if (!iso) return "";
	const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
