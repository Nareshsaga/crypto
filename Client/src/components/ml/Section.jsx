import { motion, useReducedMotion } from "motion/react";

/*
 * Shared section frame. Sections reveal once on entry and stay put; motion
 * above intensity 3 has to collapse for reduced-motion users, so the fallback
 * here is a fully static render rather than an instant flash.
 */
const Section = ({ eyebrow, title, description, children, aside, delay = 0 }) => {
	const reduce = useReducedMotion();

	return (
		<motion.section
			initial={reduce ? false : { opacity: 0, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, amount: 0.12 }}
			transition={{
				duration: 0.55,
				delay,
				ease: [0.16, 1, 0.3, 1],
			}}
			className="scroll-mt-24"
		>
			{(eyebrow || title || description || aside) && (
				<header className="mb-5 flex flex-wrap items-end justify-between gap-4">
					<div className="max-w-2xl">
						{eyebrow && (
							<p className="mb-2 font-mono text-[11px] font-medium tracking-[0.18em] text-blue-600 uppercase dark:text-blue-400">
								{eyebrow}
							</p>
						)}
						{title && (
							<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50 sm:text-2xl">
								{title}
							</h2>
						)}
						{description && (
							<p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
								{description}
							</p>
						)}
					</div>
					{aside}
				</header>
			)}

			{children}
		</motion.section>
	);
};

export default Section;
