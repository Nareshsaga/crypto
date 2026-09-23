import { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Header from "./components/Header";
import Menu from "./components/Menu";
import Home from "./pages/Home";
import Watchlist from "./pages/Watchlist";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";

// Dashboard pulls in jsPDF and the chart library, and Predictions pulls in the
// chart library. Home is the landing page and needs neither, so both load on
// demand instead of being parsed before first paint.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Predictions = lazy(() => import("./pages/Predictions"));

import { useAuth } from "./context/AuthContext";

import {
    portfolioAPI,
    watchlistAPI,
} from "./services/api";

function RouteFallback() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <span
                role="status"
                aria-label="Loading"
                className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
            />
        </div>
    );
}

function App() {
    const { isAuthenticated, logout: authLogout, loading: authLoading } = useAuth();

    const [watchlist, setWatchlist] = useState([]);
    const [portfolio, setPortfolio] = useState({});
    const [form, setForm] = useState(false);
    const [coinData, setCoinData] = useState({});
    const [menu, setMenu] = useState(false);

    const location = useLocation();

    // The drawer should never outlive the navigation that opened it.
    useEffect(() => {
        setMenu(false);
    }, [location.pathname]);

    function toggleMenu() {
        setMenu((value) => !value);
    }

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

            {/* The predictions page is public, so the header renders either way:
                without it a signed-out visitor on / has no way to reach login. */}
            <Header
                menu={menu}
                toggleMenu={toggleMenu}
                handleLogout={handleLogout}
            />
            <AnimatePresence>
                {menu && <Menu handleLogout={handleLogout} />}
            </AnimatePresence>

            <Suspense fallback={<RouteFallback />}>
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

                {/* PREDICTIONS (public: no account needed to read a model) */}
                <Route path="/predictions" element={<Predictions portfolio={portfolio} />} />

            </Routes>
            </Suspense>
        </>
    );
}

export default App;