
import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";
import { useCurrency } from "../context/CurrencyContext";

const Form = ({
	title,
	buttonText,
	coinData,
	toggleForm,
	action,
	portfolio,
}) => {
	const { currency } = useCurrency();

	const [amount, setAmount] = useState(0);

	const [price, setPrice] = useState(
		coinData?.current_price
			? (coinData.current_price * currency[1]).toFixed(2)
			: ""
	);

	const isSelling =
		buttonText === "Remove" || buttonText === "Sell";

	const [warning, setWarning] = useState(null);

	const handleSubmit = () => {
		setWarning(null);

		if (!amount || Number(amount) <= 0) {
			setWarning("Amount cannot be empty or zero.");
			return;
		}

		if (!price || Number(price) <= 0) {
			setWarning(
				`${isSelling ? "Sell price" : "Buy price"} cannot be empty or zero.`
			);
			return;
		}

		if (isSelling) {
			const ownedCoins =
				portfolio?.[coinData?.id]?.coins || 0;

			if (Number(amount) > Number(ownedCoins)) {
				setWarning(
					<>
						Amount exceeds your owned {coinData.name}.
						<br />
						You have {ownedCoins} coins.
					</>
				);
				return;
			}
		}

		const totalValue =
			(Number(amount) * Number(price)) / currency[1];

		// Form always sends positive values.
		// App.jsx converts them to negative when removing.
		action(
			coinData.id,
			totalValue,
			Number(amount)
		);
	};

	return (
		<div className="flex w-screen justify-center items-center">
			<div className="fixed top-1/5 w-fit shadow-2xl p-8 rounded-xl bg-white mx-6 dark:bg-gray-800">

				<div className="flex justify-between items-center mb-6">
					<h2 className="text-xl font-bold text-gray-800 dark:text-white">
						{title}
					</h2>

					<button
						type="button"
						aria-label="Close form"
						className="text-gray-500 hover:text-red-500 cursor-pointer"
						onClick={() => toggleForm()}
					>
						<CloseIcon />
					</button>
				</div>

				<div className="flex items-center gap-3 mb-5">
					<img
						src={coinData.image}
						alt={coinData.name}
						className="w-10 h-10 rounded-full"
					/>

					<div>
						<p className="font-semibold text-gray-800 dark:text-white">
							{coinData.name}
						</p>

						<p className="text-sm text-gray-500 uppercase">
							{coinData.symbol}
						</p>
					</div>
				</div>

				<div className="mb-4">
					<label
						htmlFor="trade-price"
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>
						{isSelling ? "Sell Price" : "Buy Price"}
					</label>

					<input
						id="trade-price"
						type="number"
						step="any"
						min="0"
						value={price}
						onChange={(e) => setPrice(e.target.value)}
						className="w-full border border-gray-300 rounded-md px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>

				<div className="mb-4">
					<label
						htmlFor="trade-amount"
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
					>
						Amount of Coins
					</label>

					<input
						id="trade-amount"
						type="number"
						step="any"
						min="0"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						className="w-full border border-gray-300 rounded-md px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>

				{warning && (
					<div className="text-red-700 dark:text-red-400 text-sm mb-4">
						{warning}
					</div>
				)}

				<button
					type="button"
					className={`w-full py-2 rounded-md text-white font-semibold cursor-pointer transition-all duration-200 ${
						isSelling
							? "bg-red-700 hover:bg-red-800"
							: "bg-green-700 hover:bg-green-800"
					}`}
					onClick={handleSubmit}
				>
					{buttonText}
				</button>

			</div>
		</div>
	);
};

export default Form;

