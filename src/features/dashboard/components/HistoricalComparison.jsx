import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { Button } from "@/shared";
import { useHistoricalComparisonData } from "../hooks/useHistoricalComparisonData";

const ComparisonDisplay = ({ comparison }) => {
    return (
        <div>
            <div className="mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {comparison.period}
                </p>
                <p className="text-sm text-text/70 mt-2">
                    Comparing two periods
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* This Period */}
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">
                        THIS PERIOD
                    </p>
                    <p className="text-xs text-text/70 mb-3">
                        {comparison.thisLabel}
                    </p>
                    <p className="text-3xl md:text-4xl font-bold text-primary">
                        {comparison.thisValue}
                        <span className="text-lg ml-1">{comparison.unit}</span>
                    </p>
                </div>

                {/* Last Period */}
                <div className="p-4 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">
                        LAST PERIOD
                    </p>
                    <p className="text-xs text-text/70 mb-3">
                        {comparison.lastLabel}
                    </p>
                    <p className="text-3xl md:text-4xl font-bold text-text/60">
                        {comparison.lastValue}
                        <span className="text-lg ml-1">{comparison.unit}</span>
                    </p>
                </div>
            </div>

            {/* Trend */}
            <div
                className={`flex items-center gap-3 p-4 rounded-lg mb-4 ${
                    comparison.isIncrease
                        ? "bg-red-500/10 border border-red-200"
                        : "bg-green-500/10 border border-green-200"
                }`}
            >
                {comparison.isIncrease ? (
                    <>
                        <TrendingUp className="w-5 h-5 text-red-600" />
                        <div>
                            <p className="text-sm font-bold text-red-600">
                                Usage Increased
                            </p>
                            <p className="text-xs text-red-600/80">
                                +{comparison.percentage}% (
                                {comparison.difference} {comparison.unit})
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <TrendingDown className="w-5 h-5 text-green-600" />
                        <div>
                            <p className="text-sm font-bold text-green-600">
                                Usage Decreased
                            </p>
                            <p className="text-xs text-green-600/80">
                                -{comparison.percentage}% (-
                                {comparison.difference} {comparison.unit})
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Cost Savings (Month-to-Month) */}
            {comparison.costSavings && (
                <div className="bg-green-500/10 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2 border border-green-200">
                    <TrendingDown className="w-4 h-4" />
                    <div>
                        <p className="text-sm font-bold">Potential Savings</p>
                        <p className="text-xs">
                            ₱{comparison.costSavings} vs last period
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

const HistoricalComparison = ({ isLoading = false }) => {
    const [selectedFilter, setSelectedFilter] = useState("month");
    const [customThisStart, setCustomThisStart] = useState("");
    const [customThisEnd, setCustomThisEnd] = useState("");
    const [customLastStart, setCustomLastStart] = useState("");
    const [customLastEnd, setCustomLastEnd] = useState("");
    const { selectedComparison } = useHistoricalComparisonData({
        isLoading,
        selectedFilter,
        customThisStart,
        customThisEnd,
        customLastStart,
        customLastEnd,
    });

    return (
        <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
                <h3 className="text-base md:text-lg font-bold">
                    Historical Comparison
                </h3>
                <div className="flex gap-2 bg-white p-1 rounded-lg w-fit shadow-sm">
                    {["week", "month", "year", "custom"].map((filter) => {
                        const label =
                            filter === "custom"
                                ? "Custom"
                                : filter.charAt(0).toUpperCase() +
                                  filter.slice(1);
                        const isSelected = filter === selectedFilter;
                        return (
                            <Button
                                key={filter}
                                text={label}
                                onClick={() => setSelectedFilter(filter)}
                                ariaPressed={isSelected}
                                className={`font-semibold text-xs rounded-lg py-1.5 px-3 ${
                                    isSelected
                                        ? "bg-primary text-white"
                                        : "text-text/70 hover:bg-background"
                                }`}
                            />
                        );
                    })}
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">
                        Loading historical data...
                    </p>
                </div>
            ) : selectedFilter === "custom" ? (
                <Card className="p-4 md:p-6 space-y-4">
                    <div>
                        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Select Custom Date Ranges
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            {/* This Period */}
                            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                                <p className="text-xs font-medium text-muted-foreground mb-3">
                                    THIS PERIOD
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-text/70 mb-1 block">
                                            Start Date
                                        </label>
                                        <input
                                            type="date"
                                            value={customThisStart}
                                            onChange={(e) =>
                                                setCustomThisStart(
                                                    e.target.value,
                                                )
                                            }
                                            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-text/70 mb-1 block">
                                            End Date
                                        </label>
                                        <input
                                            type="date"
                                            value={customThisEnd}
                                            onChange={(e) =>
                                                setCustomThisEnd(e.target.value)
                                            }
                                            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Last Period */}
                            <div className="p-4 rounded-lg bg-muted">
                                <p className="text-xs font-medium text-muted-foreground mb-3">
                                    LAST PERIOD
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-text/70 mb-1 block">
                                            Start Date
                                        </label>
                                        <input
                                            type="date"
                                            value={customLastStart}
                                            onChange={(e) =>
                                                setCustomLastStart(
                                                    e.target.value,
                                                )
                                            }
                                            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-text/70 mb-1 block">
                                            End Date
                                        </label>
                                        <input
                                            type="date"
                                            value={customLastEnd}
                                            onChange={(e) =>
                                                setCustomLastEnd(e.target.value)
                                            }
                                            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {selectedComparison && (
                            <div className="text-xs text-green-600 bg-green-500/10 px-3 py-2 rounded-lg">
                                ✓ Ready to compare the selected date ranges.
                            </div>
                        )}
                    </div>

                    {/* Show comparison if custom dates are filled */}
                    {selectedComparison && (
                        <>
                            <hr />
                            <ComparisonDisplay
                                comparison={selectedComparison}
                            />
                        </>
                    )}
                </Card>
            ) : selectedComparison ? (
                <Card className="p-4 md:p-6 hover:shadow-lg transition-shadow">
                    <ComparisonDisplay comparison={selectedComparison} />
                </Card>
            ) : null}
        </div>
    );
};

export default HistoricalComparison;
