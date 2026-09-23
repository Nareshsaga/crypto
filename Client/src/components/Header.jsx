import { NavLink } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import CurrencySelector from "./CurrencySelector";
import { useAuth } from "../context/AuthContext";
import BrightnessMediumIcon from "@mui/icons-material/BrightnessMedium";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import useTheme from "../hooks/useTheme";

const Header = ({ menu, toggleMenu, handleLogout }) => {
	const { isAuthenticated } = useAuth();
	const { theme, setTheme } = useTheme();

	const themeButton = (
		<button
			type="button"
			aria-label="Toggle color theme"
			className="flex justify-center items-center rounded-full p-2 cursor-pointer hover:bg-gray-100 transition-all duration-200 dark:text-white dark:hover:bg-gray-900"
			onClick={() => {
				theme === "light" ? setTheme("dark") : setTheme("light");
			}}
		>
			{theme === "light" ? (
				<BrightnessMediumIcon sx={{ color: "#fcba03" }} />
			) : (
				<DarkModeIcon />
			)}
		</button>
	);

	return (
		<div className="bg-white shadow-md h-16 flex justify-between items-center px-4 select-none z-40 sticky top-0 dark:bg-gray-800 dark:border-b dark:border-gray-800">
			<NavLink
				to="/"
				className="text-2xl font-bold text-blue-700 dark:text-blue-500"
			>
				CryptoTrack
			</NavLink>
			{/* list semantics: every direct child of <ul> is an <li> (axe: list) */}
			<ul className="hidden sm:flex items-center gap-4">
				<li className="flex">
					<NavLink
						to="/"
						className={({ isActive }) =>
							`rounded-sm px-3 py-2 text-sm font-medium ${
								isActive
									? "bg-blue-200 text-blue-700 dark:bg-blue-700/20 dark:text-gray-100"
									: "dark:text-gray-300 dark:hover:text-white dark:hover:bg-blue-500/10 text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
							}`
						}
					>
						Home
					</NavLink>
				</li>
				<li className="flex">
					<NavLink
						to="/predictions"
						className={({ isActive }) =>
							`rounded-sm px-3 py-2 text-sm font-medium ${
								isActive
									? "bg-blue-200 text-blue-700 dark:bg-blue-700/20 dark:text-gray-100"
									: "dark:text-gray-300 dark:hover:text-white dark:hover:bg-blue-500/10 text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
							}`
						}
					>
						Predictions
					</NavLink>
				</li>
				{isAuthenticated ? (
					<>
						<li className="flex">
							<NavLink
								to="/dashboard"
								className={({ isActive }) =>
									`rounded-sm px-3 py-2 text-sm font-medium ${
										isActive
											? "bg-blue-200 text-blue-700 dark:bg-blue-700/20 dark:text-gray-100"
											: "dark:text-gray-300 dark:hover:text-white dark:hover:bg-blue-500/10 text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
									}`
								}
							>
								Dashboard
							</NavLink>
						</li>
						<li className="flex">
							<NavLink
								to="/watchlist"
								className={({ isActive }) =>
									`rounded-sm px-3 py-2 text-sm font-medium ${
										isActive
											? "bg-blue-200 text-blue-700 dark:bg-blue-700/20 dark:text-gray-100"
											: "dark:text-gray-300 dark:hover:text-white dark:hover:bg-blue-500/10 text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
									}`
								}
							>
								Watchlist
							</NavLink>
						</li>

						<li className="flex">
							<CurrencySelector />
						</li>

						<li className="flex">
							<button
								type="button"
								onClick={handleLogout}
								className="rounded-sm px-3 py-2 text-sm font-medium cursor-pointer text-white bg-blue-600 hover:bg-blue-700"
							>
								Logout
							</button>
						</li>
					</>
				) : (
					<>
						<li className="flex">
							<NavLink
								to="/login"
								className={({ isActive }) =>
									`rounded-sm px-3 py-2 text-sm font-medium cursor-pointer ${
										isActive
											? "bg-blue-200 text-blue-700 dark:bg-blue-700/20 dark:text-gray-100"
											: "dark:text-gray-300 dark:hover:text-white dark:hover:bg-blue-500/10 text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
									}`
								}
							>
								Login
							</NavLink>
						</li>
						<li className="flex">
							<CurrencySelector />
						</li>
						<li className="flex">
							<NavLink
								to="/signup"
								className={({ isActive }) =>
									`rounded-sm px-3 py-2 text-sm font-medium cursor-pointer text-white ${
										isActive
											? "bg-blue-700"
											: "bg-blue-600 hover:bg-blue-700"
									}`
								}
							>
								Sign Up
							</NavLink>
						</li>
					</>
				)}
				<li className="flex">{themeButton}</li>
			</ul>
			<div className="flex gap-3 sm:hidden items-center ml-4">
				{themeButton}
				<CurrencySelector />
				<button
					type="button"
					onClick={toggleMenu}
					aria-label={menu ? "Close menu" : "Open menu"}
					aria-expanded={menu}
					className="sm:hidden hover:bg-blue-100 p-3 flex justify-center items-center rounded-3xl cursor-pointer dark:text-white dark:hover:bg-blue-900/20"
				>
					{menu ? (
						<CloseIcon fontSize="small" />
					) : (
						<MenuIcon fontSize="small" />
					)}
				</button>
			</div>
		</div>
	);
};

export default Header;
