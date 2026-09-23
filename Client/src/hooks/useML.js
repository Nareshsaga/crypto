import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../constants/ml";

export function useMLIndex() {
	const [state, setState] = useState({
		data: null,
		loading: true,
		error: null,
	});

	useEffect(() => {
		let cancelled = false;

		(async () => {
			setState((prev) => ({ ...prev, loading: true, error: null }));
			try {
				const res = await fetch(`${API_URL}/ml`);
				const body = await res.json().catch(() => null);
				if (!res.ok) {
					throw new Error(body?.error || `Request failed (${res.status})`);
				}
				if (!cancelled) {
					setState({ data: body, loading: false, error: null });
				}
			} catch (err) {
				if (!cancelled) {
					setState({ data: null, loading: false, error: err.message });
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	return state;
}

export function useMLModel(coin) {
	const [version, setVersion] = useState(0);
	const [state, setState] = useState({
		data: null,
		loading: true,
		error: null,
	});

	useEffect(() => {
		if (!coin) return undefined;
		let cancelled = false;

		(async () => {
			setState((prev) => ({ ...prev, loading: true, error: null }));
			try {
				const res = await fetch(`${API_URL}/ml/${coin}`);
				const body = await res.json().catch(() => null);
				if (!res.ok) {
					throw new Error(body?.error || `Request failed (${res.status})`);
				}
				if (!cancelled) {
					setState({ data: body, loading: false, error: null });
				}
			} catch (err) {
				if (!cancelled) {
					setState({ data: null, loading: false, error: err.message });
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [coin, version]);

	// Bumping a counter is what actually re-runs the effect above.
	const reload = useCallback(() => setVersion((value) => value + 1), []);

	return { ...state, reload };
}

export async function trainCoin(coin) {
	const res = await fetch(`${API_URL}/ml/${coin}/train`, { method: "POST" });
	const body = await res.json().catch(() => null);
	if (!res.ok) {
		throw new Error(body?.error || `Training failed (${res.status})`);
	}
	return body;
}
