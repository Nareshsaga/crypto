import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Header from "./components/Header";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Watchlist from "./pages/Watchlist";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";

import { useAuth } from "./context/AuthContext";

import {
    portfolioAPI,
    watchlistAPI,
} from "./services/api";

function App() {
    const { isAuthenticated, logout: authLogout, loading: authLoading } = useAuth();

    const [watchlist, setWatchlist] = useState([]);
    const [portfolio, setPortfolio] = useState({});
    const [form, setForm] = useState(false);
    const [coinData, setCoinData] = useState({});

    useEffect(() => {
        if (isAuthenticated) {
            loadWatchlist();
            loadPortfolio();
        } else {
            setWatchlist([]);
            setPortfolio({});
        }
    }, [isAuthenticated]);

    async function loadWatchlist() {
        try {
            const data = await watchlistAPI.get();

            setWatchlist(
                Array.isArray(data) ? data : []
            );
        } catch (error) {
            console.error("Failed to load watchlist:", error);
            setWatchlist([]);
        }
    }

    async function loadPortfolio() {
        try {
            const data = await portfolioAPI.get();
            setPortfolio(data);
        } catch (error) {
            console.error("Failed to load portfolio:", error);
        }
    }

    function toggleForm(coin = null) {
        setCoinData(coin || {});
        setForm((value) => !value);
    }

    async function addCoin(id, totalInvestment, coins) {
        try {
            const data = {
                totalInvestment: parseFloat(totalInvestment),
                coins: parseFloat(coins),
            };

            const updatedPortfolio = await portfolioAPI.update(id, data);

            setPortfolio(updatedPortfolio);
            toggleForm();

            toast.success("Portfolio updated successfully.");
        } catch (error) {
            console.error("Failed to add coin:", error);
            toast.error("Failed to update portfolio.");
        }
    }

    async function removeCoin(id, totalInvestment, coins) {
        try {
            const data = {
                totalInvestment: -Math.abs(parseFloat(totalInvestment)),
                coins: -Math.abs(parseFloat(coins)),
            };

            const updatedPortfolio = await portfolioAPI.update(id, data);

            setPortfolio(updatedPortfolio);
            toggleForm();

            toast.success("Coin removed from portfolio.");
        } catch (error) {
            console.error("Failed to remove coin:", error);
            toast.error("Failed to remove coin.");
        }
    }

    async function toggleWatchlist(id) {
    try {
        let updated;

        if (watchlist.includes(id)) {
            updated = await watchlistAPI.remove(id);
        } else {
            updated = await watchlistAPI.add(id);
        }

        const updatedList = Array.isArray(updated)
            ? updated
            : updated?.watchlist || [];

        setWatchlist(updatedList);
    } catch (error) {
        console.error("Failed to update watchlist:", error);
    }
}
    function handleLogout() {
        authLogout();
        setWatchlist([]);
        setPortfolio({});
        setForm(false);
        setCoinData({});
    }

    if (authLoading) {
        return <div>Loading...</div>;
    }

    return (
        <>
            <ToastContainer />

            {isAuthenticated && (
                <Header handleLogout={handleLogout} />
            )}

            <Routes>

                {/* HOME */}
                <Route
                    path="/"
                    element={
                        <Home
                            watchlist={watchlist}
                            toggleWatchlist={toggleWatchlist}
                            addCoin={addCoin}
                            form={form}
                            toggleForm={toggleForm}
                            coinData={coinData}
                        />
                    }
                />

                {/* DASHBOARD */}
                <Route
                    path="/dashboard"
                    element={
                        isAuthenticated ? (
                            <Dashboard
                                watchlist={watchlist}
                                toggleWatchlist={toggleWatchlist}
                                portfolio={portfolio}
                                addCoin={addCoin}
                                removeCoin={removeCoin}
                                form={form}
                                toggleForm={toggleForm}
                                coinData={coinData}
                            />
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />

                {/* LOGIN */}
                <Route
                    path="/login"
                    element={
                        isAuthenticated ? (
                            <Navigate to="/dashboard" replace />
                        ) : (
                            <Login />
                        )
                    }
                />

                {/* SIGN UP */}
                <Route
                    path="/signup"
                    element={
                        isAuthenticated ? (
                            <Navigate to="/dashboard" replace />
                        ) : (
                            <SignUp />
                        )
                    }
                />

                {/* WATCHLIST */}
                <Route
                    path="/watchlist"
                    element={
                        isAuthenticated ? (
                            <Watchlist
                                watchlist={watchlist}
                                toggleWatchlist={toggleWatchlist}
                                addCoin={addCoin}
                                form={form}
                                toggleForm={toggleForm}
                                coinData={coinData}
                            />
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />

            </Routes>
        </>
    );
}

export default App;