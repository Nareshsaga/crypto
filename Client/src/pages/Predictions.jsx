import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "motion/react";

import Section from "../components/ml/Section";
import StatStrip from "../components/ml/StatStrip";
import PredictionChart from "../components/ml/PredictionChart";
import ModelTable from "../components/ml/ModelTable";
import Pipeline from "../components/ml/Pipeline";
import CrossValidation from "../components/ml/CrossValidation";
import FeatureImportance from "../components/ml/FeatureImportance";
import TrainingConfig from "../components/ml/TrainingConfig";
import ForecastChart from "../components/ml/ForecastChart";

import { SURFACE, longDate, integer, pct, fix, MODEL_META } from "../constants/ml";
import { trainCoin, useMLIndex, useMLModel } from "../hooks/useML";

const Skeleton = ({ className = "" }) => (
	<div
		className={`animate-pulse rounded-lg bg-gray-200/80 dark:bg-gray-700/50 ${className}`}
	/>
);

const CoinPicker = ({ coins, value, onChange }) => (
	<div
		className="control flex flex-wrap border border-gray-200 p-1 dark:border-gray-700"
		role="tablist"
		aria-label="Select a coin"
	>
		{coins.map((entry) => {
			const active = entry.coin === value;
			return (
				<button
					key={entry.coin}
					role="tab"
					aria-selected={active}
					onClick={() => onChange(entry.coin)}
					title={entry.name}
					className={`control px-3 py-1.5 font-mono text-xs font-medium tracking-wide transition-colors duration-150 ${
						active
							? "bg-blue-600 text-white"
							: "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-100"
					}`}
				>
					{entry.symbol}
				</button>
			);
		})}
	</div>
);

const Verdict = ({ model }) => {
	const beats = model.summary.beatsBaseline || {};
	const won = beats.mape;

	return (
		<div
			className={`control border px-4 py-2.5 text-xs leading-snug ${
				won
					? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
					: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
			}`}
			role="status"
		>
			<span className="font-semibold">
				{won ? "Beats" : "Does not beat"} naive persistence
			</span>
			<span className="block font-mono text-[11px] opacity-80">
				{pct(model.summary.mape)} vs {pct(model.summary.baselineMape)} error,
				return R&sup2; {fix(model.summary.returnR2, 3)}
			</span>
		</div>
	);
};

const Callout = ({ title, children, bare = false }) => (
	<div className={bare ? "p-5 sm:p-6" : `${SURFACE} p-5 sm:p-6`}>
		<p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{title}</p>
		<div className="mt-2 space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
			{children}
		</div>
	</div>
);

const Predictions = () => {
	const reduce = useReducedMotion();
	const { data: index, loading, error } = useMLIndex();
	const [coin, setCoin] = useState(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!coin && index?.coins?.length) setCoin(index.coins[0].coin);
	}, [index, coin]);

	const {
		data: model,
		loading: modelLoading,
		error: modelError,
		reload,
	} = useMLModel(coin);

	const coins = useMemo(() => index?.coins || [], [index]);

	const handleTrain = async () => {
		if (!coin || busy) return;
		setBusy(true);
		try {
			await trainCoin(coin);
			await reload();
			toast.success(`Retrained ${coin} on 5 years of daily data.`);
		} catch (err) {
			toast.error(err.message || "Training failed.");
		} finally {
			setBusy(false);
		}
	};

	/* ---------- empty state ---------- */
	if (!loading && (!index || !coins.length)) {
		return (
			<div className="min-h-screen bg-gray-50 px-4 py-14 dark:bg-gray-900 sm:px-8">
				<div className="mx-auto max-w-3xl text-center">
					<h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
						No models trained yet
					</h1>
					<p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
						{error ||
							"The training pipeline has not written any results."}{" "}
						Train every configured coin from the repository root:
					</p>
					<code className="control mt-5 inline-block bg-gray-900 px-4 py-2.5 font-mono text-sm text-gray-100 dark:bg-gray-100 dark:text-gray-900">
						python ml/train.py
					</code>
				</div>
			</div>
		);
	}

	/* ---------- index loading ---------- */
	if (loading && !index) {
		return (
			<div className="min-h-screen bg-gray-50 px-4 py-14 dark:bg-gray-900 sm:px-8">
				<div className="mx-auto max-w-6xl space-y-6">
					<Skeleton className="h-10 w-64" />
					<Skeleton className="h-28 w-full" />
					<Skeleton className="h-80 w-full" />
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 pb-20 dark:bg-gray-900">
			<div className="mx-auto max-w-6xl px-4 pt-10 sm:px-8">
				{/* ---------- page header ---------- */}
				<motion.header
					initial={reduce ? false : { opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
					className="flex flex-wrap items-end justify-between gap-5"
				>
					<div className="max-w-2xl">
						<p className="font-mono text-[11px] font-medium tracking-[0.18em] text-blue-600 uppercase dark:text-blue-400">
							Ensemble forecasting
						</p>
						<h1 className="mt-2 text-3xl font-semibold text-gray-900 sm:text-4xl dark:text-gray-50">
							XGBoost and Gradient Boosting
						</h1>
						<p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
							Five years of daily bars, thirty-two engineered features, and a
							chronological hold-out. Everything below is the actual run, from
							the fold scores to the feature splits.
						</p>
					</div>

					<div className="flex flex-col items-end gap-3">
						<CoinPicker coins={coins} value={coin} onChange={setCoin} />
						<button
							onClick={handleTrain}
							disabled={busy || !coin}
							className={`control px-4 py-2 text-xs font-medium transition-colors duration-150 ${
								busy
									? "cursor-wait bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
									: "bg-gray-900 text-white hover:bg-blue-600 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-blue-500"
							}`}
						>
							{busy ? "Retraining, about 25 seconds" : "Retrain this coin"}
						</button>
					</div>
				</motion.header>

				{modelError && (
					<div className="mt-8">
						<Callout title="Could not load this model">
							<p className="font-mono text-xs">{modelError}</p>
							<p>
								The Express server has to be running for this page to read its
								results. Start it with{" "}
								<code className="font-mono text-xs">npm start</code> inside{" "}
								<code className="font-mono text-xs">Server/</code>.
							</p>
						</Callout>
					</div>
				)}

				{(!model || modelLoading) && !modelError && (
					<div className="mt-8 space-y-6">
						<Skeleton className="h-32 w-full" />
						<Skeleton className="h-96 w-full" />
						<Skeleton className="h-72 w-full" />
					</div>
				)}

				{model && !modelLoading && (
					<div className="mt-8 space-y-12">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div className="flex items-baseline gap-3">
								<span className="font-mono text-sm tracking-wider text-gray-400 dark:text-gray-500">
									{model.yahooSymbol}
								</span>
								<span className="text-sm text-gray-500 dark:text-gray-400">
									{integer(model.summary.rows)} days from{" "}
									{longDate(model.summary.start)} to{" "}
									{longDate(model.summary.end)}
								</span>
							</div>
							<Verdict model={model} />
						</div>

						<StatStrip model={model} />

						<Section
							eyebrow="Test set"
							title="Actual against predicted"
							description={`${integer(
								model.summary.testRows
							)} days the models never saw while fitting. Switch to daily return to judge the model on the quantity it actually targets.`}
						>
							<PredictionChart model={model} />
						</Section>

						<Section
							title="Model comparison"
							description="Both boosters, their weighted blend, and the naive baseline that predicts no change at all."
						>
							<ModelTable model={model} />
						</Section>

						<Section
							eyebrow="Training"
							title="How this model was trained"
							description="Six steps, each carrying numbers from this run rather than a generic diagram."
						>
							<Pipeline model={model} />
						</Section>

						<Section
							title="Cross-validation and blend weights"
							description={`Expanding-window ${
								model.config.crossValidation.folds
							} folds inside the training block decide the weights before the test window exists.`}
						>
							<CrossValidation model={model} />
						</Section>

						<Section
							title="What the model looks at"
							description="Split gain across the full feature set, per model or averaged."
						>
							<FeatureImportance model={model} />
						</Section>

						<Section
							title="Training configuration"
							description="Source, split, environment and every hyperparameter that produced these numbers."
						>
							<TrainingConfig model={model} />
						</Section>

						<Section
							eyebrow="Forecast"
							title="Next 14 days"
							description="Recursive multi-step projection seeded from the last close, with a band that widens as the horizon grows."
						>
							<ForecastChart model={model} />
						</Section>

						<Section title="Read this before acting on any of it">
							{/* One container split by hairlines rather than three boxes. */}
							<div className={`${SURFACE} overflow-hidden divide-y divide-gray-200/80 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-gray-700/70`}>
								<Callout bare title="The baseline is honest">
									<p>
										Predicting a 0% move scores {pct(model.summary.baselineMape)}{" "}
										on price error. The ensemble scores{" "}
										{pct(model.summary.mape)}. When the blend does not beat
										that number it is not adding signal, and the verdict badge
										at the top of this page says so out loud.
									</p>
								</Callout>
								<Callout bare title="Return R&sup2; is the real score">
									<p>
										Price-space R&sup2; reads near 1 for any asset because
										tomorrow&rsquo;s price is mostly today&rsquo;s. A return
										R&sup2; of {fix(model.summary.returnR2, 3)} means the model
										explains essentially none of the day-to-day variance left
										over after that.
									</p>
								</Callout>
								<Callout bare title="Not financial advice">
									<p>
										This is a worked example of training an ensemble on market
										data. One hold-out window, one seed, no transaction costs,
										no slippage, daily bars only. Nothing here should be used
										to decide what to buy or sell.
									</p>
								</Callout>
							</div>
						</Section>

						<footer className="border-t border-gray-200 pt-6 text-xs leading-relaxed text-gray-400 dark:border-gray-700/60 dark:text-gray-500">
							Last trained {longDate(model.trainedAt)} in{" "}
							{model.durationSec.toFixed(1)}s across{" "}
							{MODEL_META.ensemble.label} weighting of{" "}
							{MODEL_META.xgboost.label} and {MODEL_META.gradientBoosting.label}{" "}
							&middot; data {model.source.provider} &middot; blends{" "}
							{pct(model.summary.weights.xgboost * 100, 1)} /{" "}
							{pct(model.summary.weights.gradientBoosting * 100, 1)}
						</footer>
					</div>
				)}
			</div>
		</div>
	);
};

export default Predictions;
