import { createContext, useContext, useState } from "react";

const CurrencyContext = createContext();

export const useCurrency = () => {
	const context = useContext(CurrencyContext);
	if (!context) {
		throw new Error(
			"useCurrency can only be used within an CurrencyProvider"
		);
	}

	return context;
};

export const CurrencyProvider = ({ children }) => {
	const [currency, setCurrency] = useState(["USD", 1]);

	// Money always closes out to cents unless the caller explicitly asks for
	// fewer (max = 0, used for whole-dollar figures such as market cap).
	// Clamped to `max` because Intl throws when min > max.
	const formatCurrency = (value, max = 2) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency[0],
			minimumFractionDigits: Math.min(2, max),
			maximumFractionDigits: max,
		}).format(value);
	};

	return (
		<CurrencyContext.Provider
			value={{ currency, formatCurrency, setCurrency }}
		>
			{children}
		</CurrencyContext.Provider>
	);
};
