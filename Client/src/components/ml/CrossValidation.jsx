import { SURFACE, MODEL_META, PALETTE, pct } from "../../constants/ml";
import useTheme from "../../hooks/useTheme";

/*
 * Walk-forward folds on the left, the weights they produced on the right. The
 * weighting is decided entirely inside the training block, which is the part
 * worth showing a reader.
 */
const CrossValidation = ({ model }) => {
	const { theme } = useTheme();
	const pal = PALETTE[theme === "dark" ? "dark" : "light"];

	const folds = model.cv.folds;
	const mean = model.cv.meanRmse;
	const weights = model.config.ensemble.weights;
	const rmseValues = folds.flatMap((f) => [
		f.xgboostRmse,
		f.gradientBoostingRmse,
	]);
	const minRmse = Math.min(...rmseValues);
	const maxRmse = Math.max(...rmseValues);

	const rows = [
		{ key: "xgboost", mean: mean.xgboost, weight: weights.xgboost, color: pal.xgboost },
		{
			key: "gradientBoosting",
			mean: mean.gradientBoosting,
			weight: weights.gradientBoosting,
			color: pal.gradientBoosting,
		},
	];

	return (
		<div className="grid gap-4 lg:grid-cols-[1.25fr_1fr] items-start">
			<div className={`${SURFACE} overflow-hidden`}>
				<div className="overflow-x-auto">
					<table className="w-full min-w-[520px] border-collapse text-left">
						<thead>
							<tr className="border-b border-gray-200 dark:border-gray-700">
								<th className="px-5 py-3 text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
									Fold
								</th>
								<th className="px-5 py-3 text-right text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
									Train rows
								</th>
								<th className="px-5 py-3 text-right text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
									Valid rows
								</th>
								<th className="px-5 py-3 text-right text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
									XGB RMSE
								</th>
								<th className="px-5 py-3 text-right text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
									GBR RMSE
								</th>
							</tr>
						</thead>
						<tbody>
							{folds.map((fold) => {
								const xgbWins = fold.xgboostRmse < fold.gradientBoostingRmse;
								return (
									<tr
										key={fold.fold}
										className="border-b border-gray-100 last:border-b-0 dark:border-gray-700/50"
									>
										<td className="px-5 py-3 font-mono text-sm text-gray-700 tabular-nums dark:text-gray-300">
											{fold.fold}
										</td>
										<td className="px-5 py-3 text-right font-mono text-sm text-gray-600 tabular-nums dark:text-gray-400">
											{fold.trainRows}
										</td>
										<td className="px-5 py-3 text-right font-mono text-sm text-gray-600 tabular-nums dark:text-gray-400">
											{fold.validRows}
										</td>
										<td
											className={`px-5 py-3 text-right font-mono text-sm tabular-nums ${
												xgbWins
													? "text-gray-900 dark:text-gray-50"
													: "text-gray-500 dark:text-gray-400"
											}`}
										>
											{fold.xgboostRmse.toFixed(4)}
										</td>
										<td
											className={`px-5 py-3 text-right font-mono text-sm tabular-nums ${
												!xgbWins
													? "text-gray-900 dark:text-gray-50"
													: "text-gray-500 dark:text-gray-400"
											}`}
										>
											{fold.gradientBoostingRmse.toFixed(4)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			<div className={`${SURFACE} p-5`}>
				<p className="text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
					Blend weights
				</p>

				<div className="mt-4 space-y-5">
					{rows.map((row) => (
						<div key={row.key}>
							<div className="flex items-baseline justify-between gap-3">
								<span className="text-sm font-medium text-gray-800 dark:text-gray-200">
									{MODEL_META[row.key].label}
								</span>
								<span className="font-mono text-lg text-gray-900 tabular-nums dark:text-gray-50">
									{pct(row.weight * 100, 1)}
								</span>
							</div>
							<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/60">
								<div
									className="h-full rounded-full transition-[width] duration-500 ease-out"
									style={{
										width: `${Math.max(2, row.weight * 100)}%`,
										background: row.color,
									}}
								/>
							</div>
							<p className="mt-1.5 font-mono text-[11px] text-gray-500 tabular-nums dark:text-gray-400">
								mean RMSE {row.mean.toFixed(5)}
							</p>
						</div>
					))}
				</div>

				<div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700/60">
					<p className="font-mono text-xs leading-relaxed text-gray-600 dark:text-gray-400">
						{model.config.ensemble.formula}
					</p>
					<p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
						Inverse squared error, so the model that was consistently closer on
						validated history takes the larger share. The test window never
						entered this calculation.
					</p>
				</div>

				<p className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
					Return RMSE ranged from{" "}
					{pct(minRmse * 100, 2)}{" "}
					to{" "}
					{pct(maxRmse * 100, 2)}{" "}
					across the {folds.length} folds.
				</p>
			</div>
		</div>
	);
};

export default CrossValidation;
