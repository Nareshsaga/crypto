import { useCurrency } from "../context/CurrencyContext";
import useCurrencyData from "../hooks/useCurrencyData";

const CurrencySelector = () => {
    const { currency, setCurrency } = useCurrency();
    const { currencyData, loading, error } = useCurrencyData();

    if (loading) {
        return <span className="text-sm">Loading...</span>;
    }

    if (error) {
        return <span className="text-sm text-red-500">Currency error</span>;
    }

    const rates = currencyData?.rates || {};

    const handleChange = (e) => {
        const code = e.target.value;

        if (code === "USD") {
            setCurrency(["USD", 1]);
        } else {
            setCurrency([code, rates[code]]);
        }
    };

    return (
        <select
            value={currency[0]}
            onChange={handleChange}
            className="bg-white border border-gray-300 text-sm text-gray-600 font-semibold py-1.5 px-3 rounded-md shadow-sm cursor-pointer focus:outline-none"
        >
            <option value="USD">USD</option>

            {Object.keys(rates).map((code) => (
                <option key={code} value={code}>
                    {code}
                </option>
            ))}
        </select>
    );
};

export default CurrencySelector;