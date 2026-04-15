import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, CheckCircle, TrendingUp, Zap } from "lucide-react";
import { fetchJson } from "@/shared";

const mapBackendNotification = (notif, idx) => {
    return {
        id: notif.id || `backend_${idx}`,
        type: notif.type || "info",
        icon:
            notif.type === "error"
                ? AlertCircle
                : notif.type === "success"
                  ? CheckCircle
                  : notif.type === "warning"
                    ? AlertCircle
                    : Bell,
        title: notif.title || "Notification",
        message: notif.message || "",
        severity: notif.severity || "low",
        timestamp: notif.timestamp ? new Date(notif.timestamp) : new Date(),
    };
};

const buildLocalNotifications = ({ liveData, paymentRate, targetKwh = 150 }) => {
    const alerts = [];
    const kwhValue = Number(liveData.kwhConsumption) || 0;
    const power = Number(liveData.power) || 0;
    const current = Number(liveData.current) || 0;

    const budgetUsagePercent = (kwhValue / targetKwh) * 100;
    if (budgetUsagePercent >= 85 && budgetUsagePercent < 100) {
        alerts.push({
            id: "budget_warning",
            type: "warning",
            icon: AlertCircle,
            title: "Budget Alert",
            message: `You're at ${budgetUsagePercent.toFixed(0)}% of monthly limit`,
            severity: "high",
            timestamp: new Date(),
        });
    }

    if (budgetUsagePercent >= 100) {
        alerts.push({
            id: "budget_exceeded",
            type: "error",
            icon: AlertCircle,
            title: "Budget Exceeded",
            message: `You've used ${budgetUsagePercent.toFixed(0)}% of your monthly limit`,
            severity: "critical",
            timestamp: new Date(),
        });
    }

    if (power > 2500) {
        alerts.push({
            id: "high_consumption",
            type: "warning",
            icon: Zap,
            title: "High Consumption",
            message: `High power usage: ${power}W detected`,
            severity: "high",
            timestamp: new Date(),
        });
    }

    if (current > 15) {
        alerts.push({
            id: "high_current",
            type: "warning",
            icon: AlertCircle,
            title: "High Current",
            message: `Current load: ${current.toFixed(2)}A (monitor appliances)`,
            severity: "medium",
            timestamp: new Date(),
        });
    }

    const projectedCost = (kwhValue * paymentRate).toFixed(2);
    if (projectedCost > 1800) {
        alerts.push({
            id: "cost_high",
            type: "warning",
            icon: TrendingUp,
            title: "Cost Projection",
            message: `Projected cost: ₱${projectedCost} (higher than usual)`,
            severity: "high",
            timestamp: new Date(),
        });
    }

    if (alerts.length === 0) {
        alerts.push({
            id: "system_ok",
            type: "success",
            icon: CheckCircle,
            title: "System Status",
            message: "All systems operating normally",
            severity: "low",
            timestamp: new Date(),
        });
    }

    return alerts;
};

export const useNotifications = ({ liveData, paymentRate, targetKwh = 150, dismissedIds }) => {
    const [backendNotifications, setBackendNotifications] = useState(null);

    const kwh = Number(liveData?.kwhConsumption) || 0;
    const power = Number(liveData?.power) || 0;
    const current = Number(liveData?.current) || 0;

    useEffect(() => {
        const controller = new AbortController();

        const loadNotifications = async () => {
            try {
                const data = await fetchJson("/electrical/notifications/", {
                    signal: controller.signal,
                    query: {
                        kwh,
                        power,
                        current,
                        payment_rate: paymentRate,
                    },
                });

                if (Array.isArray(data)) {
                    setBackendNotifications(data);
                } else if (Array.isArray(data?.notifications)) {
                    setBackendNotifications(data.notifications);
                } else {
                    setBackendNotifications(null);
                }
            } catch {
                setBackendNotifications(null);
            }
        };

        loadNotifications();
        const timer = window.setInterval(loadNotifications, 10000);

        return () => {
            window.clearInterval(timer);
            controller.abort();
        };
    }, [kwh, power, current, paymentRate]);

    return useMemo(() => {
        const source =
            backendNotifications?.length > 0
                ? backendNotifications.map(mapBackendNotification)
                : buildLocalNotifications({ liveData, paymentRate, targetKwh });

        return source.filter((alert) => !dismissedIds.has(alert.id));
    }, [backendNotifications, dismissedIds, liveData, paymentRate, targetKwh]);
};
