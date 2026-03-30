import React, { useState, useEffect } from "react";
import { Bar, BarChart, Area, AreaChart, CartesianGrid, XAxis, Rectangle } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
    getSubtitle,
    chartConfig,
    isHighConsumption,
    calculatePayment,
} from "../data/EnergyChart";
import { fetchJson } from "@/shared";

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    const consumption = Number(payload[0].value) || 0;
    const payment = calculatePayment(consumption);

    return (
        <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm shadow-xl">
            <p className="font-medium">
                Energy Consumption: {consumption.toFixed(2)} kWh
            </p>
            <p className="text-muted-foreground">Payment: ₱ {payment}</p>
        </div>
    );
};

const EnergyChart = ({ frequency = "daily" }) => {
    const [chartData, setChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    // This is the state that controls our side-by-side toggle button
    const [chartType, setChartType] = useState("bar");

    useEffect(() => {
        let activeController = null;

        const fetchChartData = async () => {
            activeController?.abort();
            activeController = new AbortController();

            try {
                const data = await fetchJson("/electrical/readings/periodic/", {
                    signal: activeController.signal,
                    query: { period: frequency },
                });

                const formattedData = data.map((item) => {
                    const date = new Date(item.period);
                    let timeLabel = "";

                    if (frequency === "daily") {
                        timeLabel = date.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                        });
                    } else if (frequency === "weekly") {
                        timeLabel = `Week of ${date.toLocaleDateString(
                            "en-US",
                            {
                                month: "short",
                                day: "numeric",
                            },
                        )}`;
                    } else if (frequency === "monthly") {
                        timeLabel = date.toLocaleDateString("en-US", {
                            month: "short",
                        });
                    }

                    const consumption = Number(item.kwh_consumption) || 0;
                    return {
                        time: timeLabel,
                        consumption,
                    };
                });

                setChartData(formattedData);
                setError("");
            } catch (error) {
                if (error?.name === "AbortError") {
                    return;
                }
                console.error("Error fetching chart data:", error);
                setError("Unable to load chart data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchChartData();
        const interval = window.setInterval(fetchChartData, 5000);

        return () => {
            window.clearInterval(interval);
            activeController?.abort();
        };
    }, [frequency]);

    const CustomBar = (props) => {
        const consumption = Number(props?.payload?.consumption) || 0;
        const fill = isHighConsumption(consumption, frequency)
            ? "#ef4444"
            : "var(--color-consumption)";
        return <Rectangle {...props} fill={fill} radius={[8, 8, 0, 0]} />;
    };

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center p-4">
                <p className="text-sm text-destructive">{error}</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center p-4">
                <p className="text-sm text-muted-foreground">
                    Loading chart data...
                </p>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col p-4">

            {/* The Header and our side-by-side toggle switch */}
            <div className="flex justify-between items-center mb-4 px-2">
                <div>
                    <h3 className="font-bold text-base mb-1">
                        Energy Consumption
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {getSubtitle(frequency)}
                    </p>
                </div>

                {/* Side-by-side buttons wrapped in a gray pill shape */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50">
                    <button
                        onClick={() => setChartType("bar")}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${chartType === "bar"
                            ? "bg-white text-primary shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            }`}
                    >
                        Bar
                    </button>
                    <button
                        onClick={() => setChartType("area")}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${chartType === "area"
                            ? "bg-white text-primary shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            }`}
                    >
                        Area
                    </button>
                </div>
            </div>

            <ChartContainer config={chartConfig} className="h-full w-full min-h-62.5">
                {/* This asks: Is chartType equal to "bar"? If yes, show BarChart. If no, show AreaChart. */}
                {chartType === "bar" ? (
                    <BarChart accessibilityLayer data={chartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="time"
                            tickLine={false}
                            tickMargin={8}
                            minTickGap={24}
                            axisLine={false}
                        />
                        <ChartTooltip cursor={false} content={<CustomTooltip />} />
                        <Bar dataKey="consumption" shape={<CustomBar />} />
                    </BarChart>
                ) : (
                    <AreaChart accessibilityLayer data={chartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="time"
                            tickLine={false}
                            tickMargin={8}
                            minTickGap={24}
                            axisLine={false}
                        />
                        <ChartTooltip cursor={false} content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="consumption"
                            stroke="var(--color-consumption)"
                            fill="var(--color-consumption)"
                            fillOpacity={0.2}
                            strokeWidth={3}
                        />
                    </AreaChart>
                )}
            </ChartContainer>
        </div>
    );
};

export default EnergyChart;