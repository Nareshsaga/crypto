import { SURFACE, MODEL_META, longDate, integer, pct } from "../../constants/ml";

const Group = ({ label, children }) => (
	<div className="border-b border-gray-100 px-5 py-4 last:border-b-0 dark:border-gray-700/50">
		<p className="mb-3 text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
			{label}
		</p>
		<dl className="grid gap-y-2.5 gap-x-6 sm:grid-cols-2">{children}</dl>
	</div>
);

const Row = ({ term, children }) => (
	<div className="flex items-baseline justify-between gap-4">
		<dt className="text-sm text-gray-500 dark:text-gray-400">{term}</dt>
		<dd className="text-right font-mono text-sm text-gray-900 tabular-nums dark:text-gray-100">
			{children}
		</dd>
	</div>
);

const Params = ({ model, which }) => {
	const block = model.config.models[which];
	return (
		<div className="flex-1 border-b border-gray-100 px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 dark:border-gray-700/50">
			<p className="text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
				{block.label}
			</p>
			<p className="mt-0.5 font-mono text-[11px] text-gray-400 dark:text-gray-500">
				{block.library}
			</p>
			<dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
				{Object.entries(block.params).map(([key, value]) => (
					<div key={key} className="contents">
						<dt className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
							{key}
						</dt>
						<dd className="text-right font-mono text-[11px] text-gray-900 tabular-nums dark:text-gray-100">
							{String(value)}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
};

/*
 * The full specification of the run, grouped as prose-sized chunks instead of
 * one 20-row hairline table.
 */
const TrainingConfig = ({ model }) => {
	const { data, config, runtime, source } = model;
	const split = data.split;

	return (
		<div className="grid items-start gap-4 lg:grid-cols-2">
			<div className={`${SURFACE} overflow-hidden`}>
				<Group label="Data source">
					<Row term="Provider">{source.provider}</Row>
					<Row term="Granularity">{source.granularity}</Row>
					<Row term="Range">{source.range}</Row>
					<Row term="Rows fetched">{integer(data.rawRows)}</Row>
				</Group>

				<Group label="Dataset">
					<Row term="Usable rows">{integer(data.rows)}</Row>
					<Row term="First day">{longDate(data.start)}</Row>
					<Row term="Last day">{longDate(data.end)}</Row>
					<Row term="Features">{data.featureCount}</Row>
					<Row term="Target">{data.target}</Row>
					<Row term="Ticker">{model.yahooSymbol}</Row>
				</Group>

				<Group label="Train and test">
					<Row term="Method">{config.split.method}</Row>
					<Row term="Train share">{pct(config.split.ratio * 100, 0)}</Row>
					<Row term="Train rows">{integer(split.trainRows)}</Row>
					<Row term="Test rows">{integer(split.testRows)}</Row>
					<Row term="Train ends">{longDate(split.trainEnd)}</Row>
					<Row term="Test starts">{longDate(split.testStart)}</Row>
				</Group>
			</div>

			<div className="flex flex-col gap-4">
				<div className={`${SURFACE} overflow-hidden`}>
					<Group label="Environment">
						<Row term="Python">{runtime.python}</Row>
						<Row term="XGBoost">{runtime.xgboost}</Row>
						<Row term="scikit-learn">{runtime.scikitLearn}</Row>
						<Row term="pandas">{runtime.pandas}</Row>
						<Row term="NumPy">{runtime.numpy}</Row>
						<Row term="Random seed">{config.seed}</Row>
						<Row term="Cross-validation">{config.crossValidation.method}</Row>
						<Row term="Folds">{config.crossValidation.folds}</Row>
						<Row term="Trained">{longDate(model.trainedAt)}</Row>
						<Row term="Fit time">{model.durationSec.toFixed(1)}s</Row>
					</Group>
				</div>

				<div className={`${SURFACE} overflow-hidden`}>
					<p className="border-b border-gray-100 px-5 pt-4 pb-1 text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:border-gray-700/50 dark:text-gray-400">
						Hyperparameters
					</p>
					<div className="flex flex-col sm:flex-row">
						<Params model={model} which="xgboost" />
						<Params model={model} which="gradientBoosting" />
					</div>
					<p className="border-t border-gray-100 px-5 py-3 text-xs leading-relaxed text-gray-500 dark:border-gray-700/50 dark:text-gray-400">
						Blend rule: {config.ensemble.method}, producing{" "}
						{MODEL_META.xgboost.short}{" "}
						{pct(config.ensemble.weights.xgboost * 100, 1)} and{" "}
						{MODEL_META.gradientBoosting.short}{" "}
						{pct(config.ensemble.weights.gradientBoosting * 100, 1)}.
					</p>
				</div>

				<div className={`${SURFACE} px-5 py-4`}>
					<p className="text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
						Why Yahoo
					</p>
					<p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
						{source.note}
					</p>
				</div>
			</div>
		</div>
	);
};

export default TrainingConfig;
