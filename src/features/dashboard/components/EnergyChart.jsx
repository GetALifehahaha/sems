import React, { useState, useEffect } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, Rectangle } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
    getSubtitle,
    chartConfig,
    isHighConsumption,
    calculatePayment,
} from "../data/EnergyChart";

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;

    const consumption = payload[0].value;
    const payment = calculatePayment(consumption);

    return (
        <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm shadow-xl">
            <p className="font-medium">Energy Consumption: {consumption} kWh</p>
            <p className="text-muted-foreground">Payment: ₱ {payment}</p>
        </div>
    );
};

const EnergyChart = ({ frequency = "daily" }) => {
    const [chartData, setChartData] = useState([]);

    useEffect(() => {
        const fetchChartData = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

                // Fetch the periodic data from your Django backend
                const response = await fetch(`${apiUrl}/electrical/readings-periodic/?period=${frequency}`);

                if (response.ok) {
                    const data = await response.json();

                    // Format the Django data for Recharts
                    const formattedData = data.map(item => {
                        const date = new Date(item.period);
                        let timeLabel = "";

                        if (frequency === "daily") {
                            timeLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                        } else if (frequency === "weekly") {
                            timeLabel = `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                        } else if (frequency === "monthly") {
                            timeLabel = date.toLocaleDateString("en-US", { month: "short" });
                        }

                        return {
                            time: timeLabel,
                            consumption: parseFloat(item.kwh_consumption).toFixed(2),
                        };
                    });

                    setChartData(formattedData);
                }
            } catch (error) {
                console.error("Error fetching chart data:", error);
            }
        };

        fetchChartData();
        // Set up a timer to refresh the chart every 10 seconds
        const interval = setInterval(fetchChartData, 10000);
        return () => clearInterval(interval);
    }, [frequency]);

    const CustomBar = (props) => {
        const { consumption } = props;
        // Make sure it handles the parsed float value
        const fill = isHighConsumption(parseFloat(consumption), frequency)
            ? "#ef4444"
            : "var(--color-consumption)";
        return <Rectangle {...props} fill={fill} radius={8} />;
    };

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
                        tickMargin={10}
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