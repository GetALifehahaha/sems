import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { fetchJson } from "@/shared";

const HourlyBreakdown = ({ isLoading = false }) => {
    const [backendHourlyData, setBackendHourlyData] = useState([]);

    useEffect(() => {
        const controller = new AbortController();

        const loadHourly = async () => {
            try {
                const data = await fetchJson(
                    "/electrical/dashboard/hourly-breakdown/",
                    {
                        signal: controller.signal,
                    },
                );

                if (Array.isArray(data) && data.length > 0) {
                    const mapped = data.map((item) => {
                        const hourRaw =
                            item.hour ??
                            item.displayHour ??
                            item.period ??
                            "00";
                        const hour = String(hourRaw)
                            .padStart(2, "0")
                            .slice(0, 2);

                        return {
                            hour: `${hour}:00`,
                            displayHour: hour,
                            consumption: Number(
                                item.consumption ?? item.kwh ?? 0,
                            ),
                        };
                    });

                    setBackendHourlyData(mapped);
                } else {
                    setBackendHourlyData([]);
                }
            } catch {
                setBackendHourlyData([]);
            }
        };

        if (!isLoading) {
            loadHourly();
        }

        return () => controller.abort();
    }, [isLoading]);

    const resolvedHourlyData = useMemo(() => backendHourlyData, [backendHourlyData]);

    const peakHour = useMemo(() => {
        if (!resolvedHourlyData.length) {
            return { hour: "00:00", consumption: 0 };
        }
        return resolvedHourlyData.reduce((max, curr) =>
            curr.consumption > max.consumption ? curr : max,
        );
    }, [resolvedHourlyData]);

    return (
        <Card className="p-4 md:p-5 min-h-75">
            <div className="mb-4">
                <h3 className="text-base md:text-lg font-bold mb-1">
                    Hourly Consumption (Last 24H)
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">
                    Peak at {peakHour.hour}: {peakHour.consumption} kWh
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-56">
                    <p className="text-sm text-muted-foreground">
                        Loading hourly data...
                    </p>
                </div>
            ) : resolvedHourlyData.length === 0 ? (
                <div className="flex items-center justify-center h-56">
                    <p className="text-sm text-muted-foreground">
                        No hourly data available yet.
                    </p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                        data={resolvedHourlyData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                    >
                        <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 3"
                            stroke="var(--color-border)"
                        />
                        <XAxis
                            dataKey="displayHour"
                            tick={{ fontSize: 11 }}
                            tickInterval={2}
                            stroke="var(--color-muted-foreground)"
                        />
                        <YAxis
                            tick={{ fontSize: 11 }}
                            stroke="var(--color-muted-foreground)"
                            label={{
                                value: "kWh",
                                angle: -90,
                                position: "insideLeft",
                            }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "var(--color-background)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "8px",
                            }}
                            formatter={(value) => [
                                `${value} kWh`,
                                "Consumption",
                            ]}
                            labelFormatter={(label) => `${label}`}
                        />
                        <Bar
                            dataKey="consumption"
                            fill="var(--color-primary)"
                            radius={[4, 4, 0, 0]}
                            isAnimationActive={true}
                        />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </Card>
    );
};

export default HourlyBreakdown;
