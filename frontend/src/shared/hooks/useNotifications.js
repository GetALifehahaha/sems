import { useMemo } from "react";
import { AlertCircle, Bell, CheckCircle } from "lucide-react";

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

export const useNotifications = ({ liveData, dismissedIds }) => {
    return useMemo(() => {
        const backendNotifications = Array.isArray(liveData?.notifications)
            ? liveData.notifications
            : [];
        const source = backendNotifications.map(mapBackendNotification);
        return source.filter((alert) => !dismissedIds.has(alert.id));
    }, [liveData, dismissedIds]);
};