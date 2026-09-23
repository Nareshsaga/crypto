import { SURFACE, money, pct, integer, fix, MODEL_META } from "../../constants/ml";

const Stat = ({ label, value, sub, accent = false }) => (
	<div
		className={`px-5 py-5 sm:px-6 ${
			accent
				? "bg-blue-50/70 dark:bg-blue-500/[0.07]"
				: ""
		}`}
	>
		<p className="text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
			{label}
		</p>
		<p
			className={`mt-2 font-mono tabular-nums ${
				accent
					? "text-3xl font-medium text-blue-700 sm:text-4xl dark:text-blue-400"
					: "text-2xl font-medium text-gray-900 dark:text-gray-50"
			}`}
		>
			{value}
		</p>
		{sub && (
			<p className="mt-1.5 text-xs leading-snug text-gray-500 dark:text-gray-400">
				{sub}
			</p>
		)}
	</div>
);

/*
 * Asymmetric strip: one wide headline number tinted into the accent, three
 * supporting numbers separated by hairlines rather than boxed as cards.
 */
const StatStrip = ({ model }) => {
	const summary = model.summary;
	const metrics = model.metrics;
	const beats = summary.beatsBaseline || {};

	return (
		<div
			className={`${SURFACE} overflow-hidden`}
			role="group"
			aria-label="Headline test metrics"
		>
			<div className="grid grid-cols-1 divide-y divide-gray-200/80 lg:grid-cols-4 lg:divide-x lg:divide-y-0 dark:divide-gray-700/70">
				<Stat
					accent
					label="Mean price error"
					value={pct(summary.mape)}
					sub={`Naive persistence scores ${pct(
						summary.baselineMape
					)} on the same window`}
				/>
				<Stat
					label="Return R²"
					value={fix(summary.returnR2, 3)}
					sub={
						beats.returnR2
							? "Beats predicting no change"
							: "Worse than predicting no change"
					}
				/>
				<Stat
					label="Direction called"
					value={pct(summary.direction, 1)}
					sub={`${integer(summary.testRows)} held-out days`}
				/>
				<Stat
					label="Daily error"
					value={money(metrics.ensemble.price.mae, 0)}
					sub={`${summary.featureCount} features, ${
						MODEL_META.ensemble.short
					} blend`}
				/>
			</div>
		</div>
	);
};

export default StatStrip;
