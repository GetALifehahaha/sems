import React, { useState, useEffect } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, Rectangle } from "recharts";
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
            <h3 className="text-center font-bold text-base mb-2">
                Energy Consumption
            </h3>
            <p className="text-center text-sm text-muted-foreground mb-4">
                {getSubtitle(frequency)}
            </p>
            <ChartContainer config={chartConfig} className="h-full w-full">
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
            </ChartContainer>
        </div>
    );
};

export default EnergyChart;
