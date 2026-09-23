import {
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import { useCurrency } from "../context/CurrencyContext";

export default function BarChartComponent({ chart = [] }) {
    const { currency, formatCurrency } = useCurrency();

    if (!chart.length) {
        return (
            <div className="flex items-center justify-center h-full">
                No data to display.
            </div>
        );
    }

    // Give each coin enough horizontal space
    const chartWidth = Math.max(chart.length * 140, 700);

    return (
        <div className="w-full overflow-x-auto">
            <div style={{ width: `${chartWidth}px`, height: "350px" }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chart}
                        margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 60,
                        }}
                        barGap={5}
                    >
                        <CartesianGrid strokeDasharray="3 3" />

                        <XAxis
                            dataKey="name"
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                            height={70}
                        />

                        <YAxis
                            tickFormatter={(value) =>
                                new Intl.NumberFormat("en-US", {
                                    notation: "compact",
                                    compactDisplay: "short",
                                }).format(value * currency[1])
                            }
                        />

                        <Tooltip
                            formatter={(value, name) => [
                                formatCurrency(value * currency[1]),
                                name,
                            ]}
                        />

                        <Legend />

                        <Bar
                            dataKey="total"
                            name="Total Investment"
                            fill="#AF19FF"
                            barSize={25}
                        />

                        <Bar
                            dataKey="value"
                            name="Current Value"
                            fill="#00C49F"
                            barSize={25}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}