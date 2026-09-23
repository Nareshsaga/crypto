import { SURFACE, MODEL_META, money, pct, fix, integer } from "../../constants/ml";

const ORDER = ["xgboost", "gradientBoosting", "ensemble", "baseline"];

const HEADERS = [
	{ key: "returnR2", label: "Return R²", hint: "Skill at predicting the day's return" },
	{ key: "rmse", label: "Return RMSE", hint: "Root mean squared error of the return" },
	{ key: "mae", label: "Price MAE", hint: "Average error in dollars" },
	{ key: "mape", label: "Price MAPE", hint: "Average error as a percentage" },
	{ key: "direction", label: "Direction", hint: "Share of days with the sign correct" },
];

const cellFor = (key, block) => {
	switch (key) {
		case "returnR2":
			return fix(block.returns.r2, 3);
		case "rmse":
			return fix(block.returns.rmse, 4);
		case "mae":
			return money(block.price.mae, 0);
		case "mape":
			return pct(block.price.mape);
		case "direction":
			return block.direction?.predictsDirection === false
				? "n/a"
				: pct(block.direction?.accuracy, 1);
		default:
			return "n/a";
	}
};

/*
 * All four rows in one table rather than four cards, so the eye can compare a
 * column straight down. Bottom hairlines only: a border on both sides of every
 * row turns a table into a grid of boxes.
 */
const ModelTable = ({ model }) => {
	const metrics = model.metrics;
	const beats = model.summary.beatsBaseline || {};
	const better = (won) =>
		won
			? "text-emerald-600 dark:text-emerald-400"
			: "text-red-600 dark:text-red-400";

	return (
		<div className={`${SURFACE} overflow-hidden`}>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[720px] border-collapse text-left">
					<thead>
						<tr className="border-b border-gray-200 dark:border-gray-700">
							<th className="px-5 py-3 text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
								Model
							</th>
							{HEADERS.map((header) => (
								<th
									key={header.key}
									title={header.hint}
									className="px-5 py-3 text-right text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400"
								>
									{header.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{ORDER.map((key) => {
							const block = metrics[key];
							const isEnsemble = key === "ensemble";
							const isBaseline = key === "baseline";

							return (
								<tr
									key={key}
									className={`border-b border-gray-100 last:border-b-0 dark:border-gray-700/50 ${
										isEnsemble
											? "bg-blue-50/60 dark:bg-blue-500/[0.07]"
											: isBaseline
											  ? "bg-gray-50/70 dark:bg-gray-900/40"
											  : ""
									}`}
								>
									<td className="px-5 py-3.5">
										<div className="flex items-center gap-2.5">
											<span className="font-mono text-[10px] tracking-wider text-gray-400 dark:text-gray-500">
												{MODEL_META[key].short}
											</span>
											<span
												className={`text-sm ${
													isEnsemble
														? "font-semibold text-gray-900 dark:text-gray-50"
														: "font-medium text-gray-700 dark:text-gray-300"
												}`}
											>
												{MODEL_META[key].label}
											</span>
										</div>
										{isEnsemble && (
											<p className="mt-0.5 pl-[34px] text-[11px] text-gray-500 dark:text-gray-400">
												{pct(model.config.ensemble.weights.xgboost * 100, 0)} XGB
												/ {pct(model.config.ensemble.weights.gradientBoosting * 100, 0)} GBR
											</p>
										)}
										{isBaseline && (
											<p className="mt-0.5 pl-[34px] text-[11px] text-gray-500 dark:text-gray-400">
												Forecast a 0% move
											</p>
										)}
									</td>
									{HEADERS.map((header) => {
										const value = cellFor(header.key, block);
										const accent =
											header.key === "mape" && isEnsemble
												? better(beats.mape)
												: header.key === "returnR2" && isEnsemble
												  ? better(beats.returnR2)
												  : "";
										return (
											<td
												key={header.key}
												className={`px-5 py-3.5 text-right font-mono text-sm tabular-nums ${
													isEnsemble
														? "text-gray-900 dark:text-gray-50"
														: "text-gray-600 dark:text-gray-400"
												} ${accent}`}
											>
												{value}
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<div className="border-t border-gray-100 px-5 py-4 text-xs leading-relaxed text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
				<p className="font-medium text-gray-700 dark:text-gray-300">
					How to read this
				</p>
				<p className="mt-1">
					Price-space R² sits near 1 for every row, including the naive one,
					because tomorrow's price is mostly yesterday's price. The columns that
					tell you anything are{" "}
					<strong className="font-medium text-gray-700 dark:text-gray-300">
						Return R²
					</strong>{" "}
					and{" "}
					<strong className="font-medium text-gray-700 dark:text-gray-300">
						Price MAPE
					</strong>
					, both measured against{" "}
					<strong className="font-medium text-gray-700 dark:text-gray-300">
						{integer(model.summary.testRows)}
					</strong>{" "}
					held-out days the models never saw while fitting. On this coin the
					ensemble {beats.mape ? "beats" : "does not beat"} the persistence
					baseline on error and {beats.returnR2 ? "beats" : "does not beat"} it
					on return R².
				</p>
			</div>
		</div>
	);
};

export default ModelTable;
