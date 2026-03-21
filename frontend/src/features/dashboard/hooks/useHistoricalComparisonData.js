import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/shared";

const buildPresetComparisons = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDay();

    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - currentDay);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(weekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekEnd);
    lastWeekEnd.setDate(weekEnd.getDate() - 7);

    const monthStart = new Date(currentYear, currentMonth, 1);
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1);

    const formatDate = (date) => {
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };

    const formatMonth = (date) => {
        return date.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
        });
    };

    return [
        {
            period: "Week-to-Week",
            filterKey: "week",
            thisLabel: `${formatDate(weekStart)} - ${formatDate(weekEnd)}`,
            lastLabel: `${formatDate(lastWeekStart)} - ${formatDate(lastWeekEnd)}`,
            thisValue: 85,
            lastValue: 92,
            unit: "kWh",
        },
        {
            period: "Month-to-Month",
            filterKey: "month",
            thisLabel: formatMonth(monthStart),
            lastLabel: formatMonth(lastMonthStart),
            thisValue: 450,
            lastValue: 510,
            unit: "kWh",
            costSavings: 120,
        },
        {
            period: "Year-to-Year",
            filterKey: "year",
            thisLabel: `${currentYear} (YTD)`,
            lastLabel: `${currentYear - 1} (YTD)`,
            thisValue: 2850,
            lastValue: 3100,
            unit: "kWh",
        },
    ].map((comp) => {
        const difference = comp.thisValue - comp.lastValue;
        const percentage = ((difference / comp.lastValue) * 100).toFixed(1);
        const isIncrease = difference > 0;

        return {
            ...comp,
            difference: Math.abs(difference),
            percentage: Math.abs(percentage),
            isIncrease,
            trend: isIncrease ? "up" : "down",
        };
    });
};

const mapBackendComparison = (backendComparison, selectedFilter) => {
    const thisValue = Number(backendComparison.this_value ?? 0);
    const lastValue = Number(backendComparison.last_value ?? 0);
    const difference = Math.abs(thisValue - lastValue);
    const isIncrease = thisValue > lastValue;
    const percentage =
        lastValue > 0
            ? Math.abs(((thisValue - lastValue) / lastValue) * 100).toFixed(1)
            : "0.0";

    return {
        period: backendComparison.period || "Custom Comparison",
        filterKey: selectedFilter,
        thisLabel: backendComparison.this_label || "This period",
        lastLabel: backendComparison.last_label || "Last period",
        thisValue,
        lastValue,
        unit: backendComparison.unit || "kWh",
        costSavings: Number(backendComparison.cost_savings ?? 0),
        difference,
        percentage,
        isIncrease,
    };
};

const buildCustomFallbackComparison = ({
    customThisStart,
    customThisEnd,
    customLastStart,
    customLastEnd,
}) => {
    if (
        !customThisStart ||
        !customThisEnd ||
        !customLastStart ||
        !customLastEnd
    ) {
        return null;
    }

    return {
        period: "Custom Comparison",
        filterKey: "custom",
        thisLabel: `${customThisStart} to ${customThisEnd}`,
        lastLabel: `${customLastStart} to ${customLastEnd}`,
        thisValue: 95,
        lastValue: 110,
        unit: "kWh",
        costSavings: 180,
        difference: Math.abs(95 - 110),
        percentage: (((95 - 110) / 110) * 100).toFixed(1),
        isIncrease: 95 > 110,
    };
};

export const useHistoricalComparisonData = ({
    isLoading,
    selectedFilter,
    customThisStart,
    customThisEnd,
    customLastStart,
    customLastEnd,
}) => {
    const [backendComparison, setBackendComparison] = useState(null);

    const comparisonData = useMemo(() => buildPresetComparisons(), []);

    useEffect(() => {
        const controller = new AbortController();

        const loadComparison = async () => {
            const isCustom = selectedFilter === "custom";
            const hasCustomDates =
                customThisStart &&
                customThisEnd &&
                customLastStart &&
                customLastEnd;

            if (isCustom && !hasCustomDates) {
                setBackendComparison(null);
                return;
            }

            try {
                const data = await fetchJson(
                    "/electrical/dashboard/historical-comparison/",
                    {
                        signal: controller.signal,
                        query: {
                            filter: selectedFilter,
                            this_start: customThisStart,
                            this_end: customThisEnd,
                            last_start: customLastStart,
                            last_end: customLastEnd,
                        },
                    },
                );
                setBackendComparison(data);
            } catch {
                setBackendComparison(null);
            }
        };

        if (!isLoading) {
            loadComparison();
        }

        return () => controller.abort();
    }, [
        isLoading,
        selectedFilter,
        customThisStart,
        customThisEnd,
        customLastStart,
        customLastEnd,
    ]);

    const selectedComparison = useMemo(() => {
        if (backendComparison) {
            return mapBackendComparison(backendComparison, selectedFilter);
        }

        if (selectedFilter === "custom") {
            return buildCustomFallbackComparison({
                customThisStart,
                customThisEnd,
                customLastStart,
                customLastEnd,
            });
        }

        return comparisonData.find((comp) => comp.filterKey === selectedFilter);
    }, [
        backendComparison,
        selectedFilter,
        customThisStart,
        customThisEnd,
        customLastStart,
        customLastEnd,
        comparisonData,
    ]);

    return { selectedComparison };
};
