import { useEffect, useMemo, useState, useRef } from "react";
import { AlertCircle, Bell, CheckCircle } from "lucide-react";
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

export const useNotifications = ({ liveData, paymentRate, dismissedIds }) => {
    const [backendNotifications, setBackendNotifications] = useState([]);

    // Store the latest values in a ref so the interval can read them 
    // without requiring them in the useEffect dependency array.
    const latestData = useRef({
        kwh: 0,
        power: 0,
        current: 0,
        paymentRate: 0
    });

    useEffect(() => {
        latestData.current = {
            kwh: Number(liveData?.kwhConsumption) || 0,
            power: Number(liveData?.power) || 0,
            current: Number(liveData?.current) || 0,
            paymentRate: paymentRate,
        };
    }, [liveData, paymentRate]);

    useEffect(() => {
        const controller = new AbortController();

        const loadNotifications = async () => {
            try {
                // Read from the ref to get the most recent data
                const currentData = latestData.current;
                
                const data = await fetchJson("/electrical/notifications/", {
                    signal: controller.signal,
                    query: {
                        kwh: currentData.kwh,
                        power: currentData.power,
                        current: currentData.current,
                        payment_rate: currentData.paymentRate,
                    },
                });

                console.log("Fetched notifications:", data);

                if (Array.isArray(data)) {
                    setBackendNotifications(data);
                } else if (Array.isArray(data?.notifications)) {
                    setBackendNotifications(data.notifications);
                } else {
                    setBackendNotifications([]);
                }
            } catch (err) {
                if (err?.name !== "AbortError") {
                    setBackendNotifications([]);
                }
            }
        };

        // Fire immediately on mount, then strictly every 10 seconds
        loadNotifications();
        const timer = window.setInterval(loadNotifications, 10000);

        return () => {
            window.clearInterval(timer);
            controller.abort();
        };
    }, []); // Empty dependency array prevents the teardown loop

    return useMemo(() => {
        const source = backendNotifications.map(mapBackendNotification);
        return source.filter((alert) => !dismissedIds.has(alert.id));
    }, [backendNotifications, dismissedIds]);
};