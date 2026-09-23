import CoinRow from "./CoinRow";

const Table = ({
    loading,
    error,
    coins,
    toggleWatchlist,
    watchlist,
    message,
    toggleForm,
}) => {
    const safeWatchlist = Array.isArray(watchlist) ? watchlist : [];

    return (
        <table className="w-full min-w-[760px] text-left dark:bg-gray-800 rounded-lg dark:shadow">
            <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:border-b">
                    {[
                        { label: "Rank", align: "text-center" },
                        { label: "Name", align: "text-left" },
                        { label: "Price", align: "text-right" },
                        { label: "24H %", align: "text-right" },
                        { label: "Market Cap", align: "text-right" },
                        { label: "", align: "text-left" },
                    ].map((header) => (
                        <th
                            key={header.label}
                            className={`px-6 py-3 text-xs font-semibold text-gray-500 tracking-wider uppercase dark:text-gray-400 ${header.align}`}
                        >
                            {header.label}
                        </th>
                    ))}
                </tr>
            </thead>

            <tbody>
                {message && (
                    <tr>
                        <td
                            colSpan="6"
                            className="text-center p-8 text-gray-500 dark:text-gray-400"
                        >
                            {message}
                        </td>
                    </tr>
                )}

                {loading && (
                    <tr>
                        <td
                            colSpan="6"
                            className="text-center p-8 text-gray-500 dark:text-gray-400"
                        >
                            Loading data...
                        </td>
                    </tr>
                )}

                {error && (
                    <tr>
                        <td
                            colSpan="6"
                            className="text-center p-8 text-red-500 dark:text-gray-400"
                        >
                            An Error Occured
                        </td>
                    </tr>
                )}

                {!loading &&
                    !error &&
                    coins.map((coin) => (
                        <CoinRow
                            key={coin.id}
                            coin={coin}
                            isStarred={safeWatchlist.includes(coin.id)}
                            toggleWatchlist={toggleWatchlist}
                            toggleForm={toggleForm}
                        />
                    ))}
            </tbody>
        </table>
    );
};

export default Table;