import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../constants/ml";
import api from "../services/api";

export function useMLIndex() {
	const [version, setVersion] = useState(0);
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
	}, [version]);

	// Training rewrites index.json — bumping the version re-reads it so a
	// newly trained coin appears in the picker without a page reload.
	const reload = useCallback(() => setVersion((value) => value + 1), []);

	return { ...state, reload };
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

export async function trainCoin(coin, meta) {
	// Shared axios instance: it attaches the Bearer token and, on 401, runs
	// the session-expiry interceptor before the error reaches the caller.
	// `meta` carries { ticker, name } when training a coin beyond the default
	// set — the server validates both before spawning the pipeline.
	try {
		const response = await api.post(`/ml/${coin}/train`, meta ?? {});
		return response.data;
	} catch (err) {
		const body = err.response?.data;
		const status = err.response?.status;
		throw new Error(body?.error || `Training failed (${status ?? err.message})`);
	}
}

/**
 * Debounced coin search, served by our own GET /search route (CoinGecko is
 * the upstream there). Going through the API keeps the request same-origin,
 * and failures come back as a visible error instead of a silent empty list.
 */
export function useCoinSearch(query) {
	const [results, setResults] = useState([]);
	const [searching, setSearching] = useState(false);
	const [error, setError] = useState(null);

	useEffect(() => {
		const trimmed = (query || "").trim();
		if (trimmed.length < 2) {
			setResults([]);
			setSearching(false);
			setError(null);
			return undefined;
		}

		let cancelled = false;
		setSearching(true);
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(
					`${API_URL}/search?query=${encodeURIComponent(trimmed)}`,
				);
				const body = await res.json().catch(() => null);
				if (!res.ok) {
					throw new Error(body?.error || `Search failed (${res.status})`);
				}
				if (!cancelled) {
					setResults(body.coins || []);
					setError(null);
				}
			} catch (err) {
				if (!cancelled) {
					setResults([]);
					setError(err.message || "Coin search is unavailable right now.");
				}
			} finally {
				if (!cancelled) setSearching(false);
			}
		}, 300);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [query]);

	return { results, searching, error };
}
