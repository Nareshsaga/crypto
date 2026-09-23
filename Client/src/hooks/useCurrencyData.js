import { useState, useEffect } from "react";

const CURRENCY_API =
    "https://api.frankfurter.dev/v1/latest?from=USD";

export default function useCurrencyData() {
    const [currencyData, setCurrencyData] = useState({
        rates: {},
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const getCurrency = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(CURRENCY_API);

                if (!response.ok) {
                    throw new Error(
                        `Currency API error: ${response.status}`
                    );
                }

                const data = await response.json();

                if (!data.rates) {
                    throw new Error("Currency rates not found");
                }

                setCurrencyData(data);
            } catch (err) {
                console.error("Currency API Error:", err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        getCurrency();
    }, []);

    return {
        currencyData,
        loading,
        error,
    };
}