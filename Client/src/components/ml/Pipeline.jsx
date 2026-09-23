import { motion, useReducedMotion } from "motion/react";
import { SURFACE } from "../../constants/ml";

/*
 * The training story, told with this run's actual numbers rather than a
 * generic diagram. Each step carries a stat pulled from the payload.
 */
const Pipeline = ({ model }) => {
	const reduce = useReducedMotion();
	const steps = model.pipeline;

	return (
		<div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
			<ol className="relative">
				<span
					aria-hidden="true"
					className="absolute top-2 bottom-2 left-[15px] w-px bg-gray-200 dark:bg-gray-700"
				/>
				{steps.map((step, index) => (
					<motion.li
						key={step.id}
						initial={reduce ? false : { opacity: 0, x: -12 }}
						whileInView={{ opacity: 1, x: 0 }}
						viewport={{ once: true, amount: 0.4 }}
						transition={{
							duration: 0.5,
							delay: index * 0.05,
							ease: [0.16, 1, 0.3, 1],
						}}
						className="relative flex gap-4 pb-6 last:pb-0"
					>
						<span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-white font-mono text-xs text-blue-700 tabular-nums dark:border-blue-500/40 dark:bg-gray-800 dark:text-blue-300">
							{index + 1}
						</span>
						<div className="min-w-0 pt-1">
							<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
									{step.title}
								</h3>
								<span className="font-mono text-[11px] tracking-wide text-blue-600 dark:text-blue-400">
									{step.stat}
								</span>
							</div>
							<p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
								{step.body}
							</p>
						</div>
					</motion.li>
				))}
			</ol>

			<aside className={`${SURFACE} h-fit p-5 sm:p-6`}>
				<p className="text-[11px] font-medium tracking-[0.1em] text-gray-500 uppercase dark:text-gray-400">
					What the boosters are doing
				</p>

				<div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
					<p>
						Both models are gradient boosting. Each starts from a flat
						prediction, measures what it got wrong, then fits a small decision
						tree to <em className="text-gray-900 dark:text-gray-100">just the
						residuals</em>. Repeat a few hundred times and the trees add into one
						model.
					</p>
					<p>
						<strong className="font-medium text-gray-900 dark:text-gray-100">
							XGBoost
						</strong>{" "}
						and{" "}
						<strong className="font-medium text-gray-900 dark:text-gray-100">
							sklearn's GradientBoosting
						</strong>{" "}
						implement that same idea with different regularisation, leaf
						requirements and update rules. They make different mistakes, which
						is the whole reason averaging them can help.
					</p>
					<p>
						The target is the next day's log return, not the price. Returns are
						roughly stationary, so the models learn a quantity whose scale stays
						put across five years instead of one that drifts from a few cents to
						ninety thousand dollars.
					</p>
				</div>

				<div className="mt-5 space-y-3 border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
					<p>
						<strong className="font-medium text-gray-700 dark:text-gray-300">
							Not shuffled.
						</strong>{" "}
						Every split follows the calendar. Shuffling would let a model trained
						on a 2024 crash predict a 2023 recovery and score brilliantly while
						failing the moment it meets real data.
					</p>
					<p>
						<strong className="font-medium text-gray-700 dark:text-gray-300">
							Fitted twice.
						</strong>{" "}
						Once inside cross-validation to assign blend weights, once on the
						full training block for the reported result. The held-out window is
						touched a single time, at the end.
					</p>
				</div>
			</aside>
		</div>
	);
};

export default Pipeline;
