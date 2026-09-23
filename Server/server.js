const express = require("express");
const cors = require("cors");
const db = require("./db");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const User = require("./models/Users");
const PORT = process.env.PORT || 3000;
const app = express();

app.use(
	cors({
		origin: process.env.CLIENT || "https://cryptotrack-ultimez.vercel.app",
		credentials: true,
	})
);

app.use(express.json());
const passport = require("./auth");
app.use(passport.initialize());

app.get("/", (req, res) => {
	return res.send("API is running");
});

app.post("/register", async (req, res) => {
	const { username, password } = req.body;
	try {
		const user = await User.findOne({ username });
		if (user) {
			return res.status(400).json({ Error: "User Already Exists" });
		}

		const newUser = new User({ username, password });
		const response = await newUser.save();
		return res
			.status(200)
			.json({ message: "User Registered Successfully" });
	} catch (err) {
		return res.status(500).json(err);
	}
});

app.post("/login", (req, res, next) => {
	passport.authenticate("local", { session: false }, (err, user, info) => {
		if (err) {
			return res.status(500).json({ error: "Authentication error" });
		}
		if (!user) {
			return res.status(400).json({ error: "Invalid credentials" });
		}

		const payload = { id: user._id, username: user.username };
		const token = jwt.sign(payload, process.env.JWT_SECRET, {
			expiresIn: "24h",
		});

		res.status(200).json({
			message: "Login successful",
			token: token,
			user: {
				id: user._id,
				username: user.username,
			},
		});
	})(req, res, next);
});

app.get(
	"/watchlist",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		try {
			const userId = req.user._id;
			const user = await User.findById(userId);
			if (!user) {
				return res.status(404).json({ Error: "User not Found" });
			}

			return res.json({ watchlist: user.watchlist });
		} catch (err) {
			return res.json(500).json(err);
		}
	}
);

app.get(
	"/portfolio",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		try {
			const userId = req.user._id;
			const user = await User.findById(userId);
			if (!user) {
				return res.status(404).json({ Error: "User not Found" });
			}

			return res.json(user.portfolio);
		} catch (err) {
			return res.json(500).json(err);
		}
	}
);

app.put(
	"/watchlist/add",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		const userId = req.user._id;
		const coin = req.body.coin;
		try {
			const user = await User.findByIdAndUpdate(
				userId,
				{ $addToSet: { watchlist: coin } },
				{ new: true }
			);

			if (!user) {
				return res.status(404).json({ Error: "User not Found" });
			}

			return res.status(200).json({ watchlist: user.watchlist });
		} catch (err) {
			return res.status(500).json(err.message);
		}
	}
);

app.put(
	"/watchlist/remove",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		const userId = req.user._id;
		const coin = req.body.coin;
		try {
			const user = await User.findByIdAndUpdate(
				userId,
				{ $pull: { watchlist: coin } },
				{ new: true }
			);

			if (!user) {
				return res.status(404).json({ Error: "User not Found" });
			}

			return res.status(200).json({ watchlist: user.watchlist });
		} catch (err) {
			return res.status(500).json(err.message);
		}
	}
);

app.put(
	"/portfolio/update",
	passport.authenticate("jwt", { session: false }),
	async (req, res) => {
		const userId = req.user._id;
		const { coin, coinData } = req.body;

		try {
			if (
				!coin ||
				!coinData ||
				typeof coinData.totalInvestment !== "number" ||
				typeof coinData.coins !== "number"
			) {
				return res.status(400).json({ error: "Invalid input data" });
			}

			const user = await User.findById(userId);
			if (!user) {
				return res.status(404).json({ error: "User not found" });
			}

			const portfolio = user.portfolio;
			const existingCoinData = portfolio.get(coin);

			if (existingCoinData) {
				const newCoins = existingCoinData.coins + coinData.coins;

				if (coinData.coins < 0) {
					const sellAmount = Math.abs(coinData.coins);
					const ownedCoins = existingCoinData.coins;

					if (sellAmount > ownedCoins) {
						return res.status(400).json({
							error: `Cannot sell ${sellAmount} coins. You only own ${ownedCoins} coins.`,
						});
					}
				}

				if (newCoins <= 0) {
					portfolio.delete(coin);
				} else {
					let newTotalInvestment;

					if (coinData.coins < 0) {
						const remainingRatio =
							newCoins / existingCoinData.coins;
						newTotalInvestment =
							existingCoinData.totalInvestment * remainingRatio;
					} else {
						newTotalInvestment =
							existingCoinData.totalInvestment +
							coinData.totalInvestment;
					}

					existingCoinData.totalInvestment = newTotalInvestment;
					existingCoinData.coins = newCoins;
					portfolio.set(coin, existingCoinData);
				}
			} else {
				if (coinData.totalInvestment > 0 && coinData.coins > 0) {
					portfolio.set(coin, coinData);
				} else if (coinData.coins < 0) {
					return res.status(400).json({
						error: "Cannot sell coins that are not in your portfolio",
					});
				}
			}

			user.markModified("portfolio");

			const updatedUser = await user.save();
			return res.status(200).json(updatedUser.portfolio);
		} catch (err) {
			return res.status(500).json(err.message);
		}
	}
);

const ML_DATA_DIR = path.join(__dirname, "ml-data");
const ML_SCRIPT = path.join(__dirname, "..", "ml", "train.py");
const ML_COINS = [
	"bitcoin",
	"ethereum",
	"solana",
	"ripple",
	"cardano",
	"dogecoin",
];

const training = new Set();

function readMlData(file) {
	const target = path.join(ML_DATA_DIR, file);
	if (!fs.existsSync(target)) {
		return null;
	}
	return JSON.parse(fs.readFileSync(target, "utf8"));
}

app.get("/ml", (req, res) => {
	const index = readMlData("index.json");
	if (!index) {
		return res.status(404).json({
			error: "No models trained yet",
			hint: "Run `python ml/train.py` from the repository root.",
		});
	}
	return res.json(index);
});

app.get("/ml/:coin", (req, res) => {
	const coin = req.params.coin;

	// Allowlist before touching the filesystem: no path traversal, no surprise files.
	if (!ML_COINS.includes(coin)) {
		return res.status(404).json({
			error: `Unknown coin "${coin}"`,
			available: ML_COINS,
		});
	}

	const payload = readMlData(`${coin}.json`);
	if (!payload) {
		return res.status(404).json({
			error: `No trained model for "${coin}"`,
			hint: "Run `python ml/train.py` from the repository root.",
		});
	}
	return res.json(payload);
});

app.post("/ml/:coin/train", (req, res) => {
	const coin = req.params.coin;

	if (!ML_COINS.includes(coin)) {
		return res.status(404).json({
			error: `Unknown coin "${coin}"`,
			available: ML_COINS,
		});
	}
	if (training.has(coin)) {
		return res.status(409).json({ error: `${coin} is already training` });
	}

	training.add(coin);
	const python = process.platform === "win32" ? "python" : "python3";
	const child = spawn(python, [ML_SCRIPT, coin], {
		cwd: path.join(__dirname, ".."),
		windowsHide: true,
	});

	let stdout = "";
	let stderr = "";
	child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
	child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

	const watchdog = setTimeout(() => {
		child.kill();
	}, 300000);

	child.on("close", (code) => {
		clearTimeout(watchdog);
		training.delete(coin);

		if (code !== 0) {
			return res.status(500).json({
				error: `Training failed for ${coin}`,
				detail: (stderr || stdout).slice(-2000),
			});
		}
		return res.json({ coin, message: "Training complete", log: stdout });
	});

	child.on("error", (err) => {
		clearTimeout(watchdog);
		training.delete(coin);
		return res.status(500).json({
			error: "Could not start Python",
			detail: err.message,
		});
	});
});

app.listen(PORT);
