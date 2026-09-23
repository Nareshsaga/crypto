import { useMemo, useState } from "react";
import { SURFACE, MODEL_META, PALETTE } from "../../constants/ml";
import useTheme from "../../hooks/useTheme";

const MODELS = ["merged", "xgboost", "gradientBoosting"];
const TOP = 12;

const groupOf = (groups) => {
	const lookup = {};
	Object.entries(groups || {}).forEach(([group, features]) => {
		features.forEach((feature) => {
			if (!lookup[feature]) lookup[feature] = group;
		});
	});
	return (feature) => lookup[feature] || "Other";
};

/*
 * Horizontal bars rather than a pie: twelve slices cannot be compared by eye,
 * but twelve lengths can.
 */
const FeatureImportance = ({ model }) => {
	const { theme } = useTheme();
	const pal = PALETTE[theme === "dark" ? "dark" : "light"];
	const [source, setSource] = useState("merged");

	const rows = useMemo(
		() => (model.featureImportance[source] || []).slice(0, TOP),
		[model, source]
	);

	const group = useMemo(
		() => groupOf(model.data.featureGroups),
		[model.data.featureGroups]
	);

	const max = Math.max(...rows.map((row) => row.value), 0.0001);
	const barColor =
		source === "xgboost"
			? pal.xgboost
			: source === "gradientBoosting"
			  ? pal.gradientBoosting
			  : pal.ensemble;

	return (
		<div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
			<div className={`${SURFACE} p-5 sm:p-6`}>
				<div
					className="control mb-5 inline-flex border border-gray-200 p-0.5 dark:border-gray-700"
					role="tablist"
					aria-label="Importance source"
				>
					{MODELS.map((key) => (
						<button
							key={key}
							role="tab"
							aria-selected={source === key}
							onClick={() => setSource(key)}
							className={`control px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
								source === key
									? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
									: "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
							}`}
						>
							{key === "merged"
								? "Both"
								: MODEL_META[key].label}
						</button>
					))}
				</div>

				<ol className="space-y-2.5">
					{rows.map((row, index) => (
						<li key={row.feature} className="flex items-center gap-3">
							<span className="w-5 shrink-0 text-right font-mono text-[11px] text-gray-400 tabular-nums dark:text-gray-500">
								{index + 1}
							</span>
							<span className="w-40 shrink-0 truncate font-mono text-xs text-gray-700 dark:text-gray-300">
								{row.feature}
							</span>
							<span className="h-4 flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-700/50">
								<span
									className="block h-full rounded-sm transition-[width] duration-500 ease-out"
									style={{
										width: `${Math.max(1.5, (row.value / max) * 100)}%`,
										background: barColor,
									}}
								/>
							</span>
							<span className="w-14 shrink-0 text-right font-mono text-xs text-gray-500 tabular-nums dark:text-gray-400">
								{(row.value * 100).toFixed(1)}%
							</span>
						</li>
					))}
				</ol>

				<p className="mt-5 border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
					Share of total split gain. Both models are gradient boosters over
					tree splits, so these numbers say which inputs the splits leaned on
					most, not which inputs cause price to move.
				</p>
			</div>

			<div className={`${SURFACE} p-5 sm:p-6`}>
				<p className="text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
					Feature set
				</p>
				<p className="mt-2 font-mono text-3xl font-medium text-gray-900 tabular-nums dark:text-gray-50">
					{model.data.featureCount}
				</p>
				<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
					derived inputs, grouped as
				</p>

				<dl className="mt-4 space-y-3">
					{Object.entries(model.data.featureGroups || {}).map(
						([name, features]) => (
							<div
								key={name}
								className="border-b border-gray-100 pb-3 last:border-b-0 dark:border-gray-700/50"
							>
								<dt className="flex items-baseline justify-between gap-3 text-sm font-medium text-gray-800 dark:text-gray-200">
									<span>{name}</span>
									<span className="font-mono text-xs text-gray-500 tabular-nums dark:text-gray-400">
										{features.length}
									</span>
								</dt>
								<dd className="mt-1 font-mono text-[11px] leading-relaxed text-gray-500 break-words dark:text-gray-400">
									{features.join(", ")}
								</dd>
							</div>
						)
					)}
				</dl>

				<p className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
					Top feature today:{" "}
					<span className="font-mono text-gray-600 dark:text-gray-300">
						{group(rows[0]?.feature)} / {rows[0]?.feature}
					</span>
				</p>
			</div>
		</div>
	);
};

export default FeatureImportance;
