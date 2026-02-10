import React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, Rectangle } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
    getEnergyChartData,
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
    const chartData = getEnergyChartData(frequency);

    const CustomBar = (props) => {
        const { consumption } = props;
        const fill = isHighConsumption(consumption, frequency)
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
