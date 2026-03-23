import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/shared";

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

export const useHistoricalComparisonData = ({
    isLoading,
    selectedFilter,
    customThisStart,
    customThisEnd,
    customLastStart,
    customLastEnd,
}) => {
    const [backendComparison, setBackendComparison] = useState(null);

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
        if (!backendComparison) {
            return null;
        }
        return mapBackendComparison(backendComparison, selectedFilter);
    }, [backendComparison, selectedFilter]);

    return { selectedComparison };
};
