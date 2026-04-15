import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle, Pencil } from "lucide-react";
import { fetchJson } from "@/shared";

const GoalTracker = ({
    liveData = {},
    isLoading = false,
    targetKwh = 150,
    costRate = 12,
    cycleStartDay = 1,
    prefsLoading = false,
    onEditPreferences,
}) => {
    const [backendGoal, setBackendGoal] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        const loadGoal = async () => {
            try {
                const data = await fetchJson(
                    "/electrical/dashboard/goal-tracker/",
                    {
                        signal: controller.signal,
                        query: {
                            kwh: liveData.kwhConsumption,
                            payment_rate: costRate,
                        },
                    },
                );
                setBackendGoal(data);
            } catch {
                setBackendGoal(null);
            }
        };

        if (!isLoading) loadGoal();

        return () => controller.abort();
    }, [liveData.kwhConsumption, costRate, isLoading]);

    const goalData = useMemo(() => {
        const kwhUsed =
            backendGoal?.kwh_used !== undefined
                ? Number(backendGoal.kwh_used)
                : Number(liveData.kwhConsumption) || 0;
        const percentageUsed = (kwhUsed / targetKwh) * 100;
        const remaining = Math.max(0, targetKwh - kwhUsed);
        const costUsed =
            backendGoal?.cost_used !== undefined
                ? Number(backendGoal.cost_used).toFixed(2)
                : (kwhUsed * costRate).toFixed(2);

        const today = new Date().getDate();
        const daysInMonth = new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            0,
        ).getDate();
        const daysSinceCycleStart =
            today >= cycleStartDay
                ? today - cycleStartDay
                : daysInMonth - cycleStartDay + today;
        const cycleLengthDays =
            today >= cycleStartDay
                ? daysInMonth - cycleStartDay + 1
                : daysInMonth;
        const daysRemaining = Math.max(1, cycleLengthDays - daysSinceCycleStart - 1);
        const dailyAllowance = (remaining / daysRemaining).toFixed(2);

        let status = "on-track";
        let statusIcon = CheckCircle;
        let statusColor = "text-green-600";
        let statusLabel = "On Track";

        if (percentageUsed >= 100) {
            status = "exceeded";
            statusIcon = XCircle;
            statusColor = "text-red-600";
            statusLabel = "Budget Exceeded";
        } else if (percentageUsed >= 85) {
            status = "at-risk";
            statusIcon = AlertCircle;
            statusColor = "text-orange-600";
            statusLabel = "At Risk";
        }

        return {
            kwhUsed,
            percentageUsed: Math.min(percentageUsed, 100),
            remaining,
            costUsed,
            daysRemaining,
            dailyAllowance,
            status,
            statusIcon,
            statusColor,
            statusLabel,
        };
    }, [liveData.kwhConsumption, costRate, targetKwh, cycleStartDay, backendGoal]);

    const StatusIcon = goalData.statusIcon;

    return (
        <Card className="p-4 md:p-5">
            <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base md:text-lg font-bold">
                        Monthly Budget Tracker
                    </h3>
                    {onEditPreferences && (
                        <button
                            onClick={onEditPreferences}
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-text/50 hover:text-primary"
                            aria-label="Edit budget preferences"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                    {prefsLoading
                        ? "Loading preferences…"
                        : `Target: ${targetKwh} kWh · ₱${costRate}/kWh`}
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-32">
                    <p className="text-sm text-muted-foreground">
                        Loading budget data...
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Progress Bar */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-text/80">
                                Used: {goalData.kwhUsed.toFixed(2)} kWh
                            </span>
                            <span className="text-sm font-bold text-primary">
                                {goalData.percentageUsed.toFixed(0)}%
                            </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                    goalData.status === "on-track"
                                        ? "bg-green-500"
                                        : goalData.status === "at-risk"
                                          ? "bg-orange-500"
                                          : "bg-red-500"
                                }`}
                                style={{ width: `${goalData.percentageUsed}%` }}
                            />
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-2 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-0.5">
                                Remaining
                            </p>
                            <p className="font-bold text-primary">
                                {goalData.remaining.toFixed(1)} kWh
                            </p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-0.5">
                                Days Left
                            </p>
                            <p className="font-bold text-secondary">
                                {goalData.daysRemaining}
                            </p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-0.5">
                                Daily Allowance
                            </p>
                            <p className="font-bold">
                                {goalData.dailyAllowance} kWh
                            </p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-0.5">
                                Est. Cost
                            </p>
                            <p className="font-bold">₱{goalData.costUsed}</p>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center justify-center pt-2">
                        <Badge
                            variant={
                                goalData.status === "on-track"
                                    ? "default"
                                    : goalData.status === "at-risk"
                                      ? "secondary"
                                      : "destructive"
                            }
                            className="flex items-center gap-2"
                        >
                            <StatusIcon className="w-4 h-4" />
                            {goalData.statusLabel}
                        </Badge>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default GoalTracker;
