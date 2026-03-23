import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Zap, BarChart3, DollarSign, Target, PhilippinePeso } from "lucide-react";
import { fetchJson } from "@/shared";

const QuickStatsCards = ({ liveData, isLoading, PAYMENT_RATE = 12 }) => {
    const StatIcons = { Zap, BarChart3, PhilippinePeso, Target };
    const [backendStats, setBackendStats] = useState({
        peak_usage_today: 0,
        average_usage: 0,
        projected_cost: 0,
        budget_usage_percent: 0,
    });

    useEffect(() => {
        const controller = new AbortController();

        const loadStats = async () => {
            try {
                const data = await fetchJson(
                    "/electrical/dashboard/quick-stats/",
                    {
                        signal: controller.signal,
                        query: {
                            kwh: liveData.kwhConsumption,
                            power: liveData.power,
                            current: liveData.current,
                            payment_rate: PAYMENT_RATE,
                        },
                    },
                );

                setBackendStats(data);
            } catch {
                setBackendStats({
                    peak_usage_today: 0,
                    average_usage: 0,
                    projected_cost: 0,
                    budget_usage_percent: 0,
                });
            }
        };

        if (!isLoading) {
            loadStats();
        }

        return () => controller.abort();
    }, [
        liveData.kwhConsumption,
        liveData.power,
        liveData.current,
        PAYMENT_RATE,
        isLoading,
    ]);

    const stats = useMemo(() => {
        const peakUsageToday = Number(backendStats?.peak_usage_today) || 0;
        const averageUsage = Number(backendStats?.average_usage) || 0;
        const budgetUsagePercent = Number(backendStats?.budget_usage_percent) || 0;
        const projectedCostValue = (Number(backendStats?.projected_cost) || 0).toFixed(2);

        return [
            {
                label: "Peak Usage Today",
                value: isLoading ? "--" : peakUsageToday.toFixed(2),
                unit: "kWh",
                icon: "Zap",
            },
            {
                label: "Average Usage",
                value: isLoading ? "--" : averageUsage.toFixed(2),
                unit: "kWh",
                icon: "BarChart3",
            },
            {
                label: "Projected Cost",
                value: isLoading ? "--" : `₱${projectedCostValue}`,
                unit: "this month",
                icon: "PhilippinePeso",
            },
            {
                label: "Budget Usage",
                value: isLoading ? "--" : `${Math.round(budgetUsagePercent)}%`,
                unit: "of 150 kWh",
                icon: "Target",
            },
        ];
    }, [isLoading, backendStats]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, idx) => {
                const IconComponent = StatIcons[stat.icon];
                return (
                    <Card
                        key={idx}
                        className="p-4 hover:shadow-lg transition-shadow"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">
                                    {stat.label}
                                </p>
                                <h3 className="text-xl md:text-2xl font-bold text-primary">
                                    {stat.value}
                                </h3>
                                <p className="text-xs text-text/60 mt-1">
                                    {stat.unit}
                                </p>
                            </div>
                            {IconComponent && (
                                <IconComponent className="w-6 h-6 text-primary" />
                            )}
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};

export default QuickStatsCards;
