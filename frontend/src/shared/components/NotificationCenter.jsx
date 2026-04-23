import React, { useState } from "react";
import { Bell, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "../hooks/useNotifications";

const NotificationCenter = ({ liveData = {} }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dismissedIds, setDismissedIds] = useState(new Set());
    const notifications = useNotifications({
        liveData,
        dismissedIds,
    });

    const unreadCount = notifications.length;

    const dismissNotification = (id) => {
        setDismissedIds((prev) => new Set([...prev, id]));
    };

    const clearAll = () => {
        setDismissedIds(new Set(notifications.map((notif) => notif.id)));
    };

    const getColor = (severity) => {
        switch (severity) {
            case "critical":
                return "bg-red-500/10 border-red-200";
            case "high":
                return "bg-orange-500/10 border-orange-200";
            case "medium":
                return "bg-yellow-500/10 border-yellow-200";
            default:
                return "bg-green-500/10 border-green-200";
        }
    };

    const getTextColor = (severity) => {
        switch (severity) {
            case "critical":
                return "text-red-700";
            case "high":
                return "text-orange-700";
            case "medium":
                return "text-yellow-700";
            default:
                return "text-green-700";
        }
    };

    return (
        <div className="relative">
            {/* Bell Icon Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 hover:bg-background rounded-lg transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5 text-text" />
                {unreadCount > 0 && (
                    <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs p-0"
                    >
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-background z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-background">
                        <h3 className="font-semibold text-sm">Notifications</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-background rounded"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                No notifications
                            </div>
                        ) : (
                            <div className="divide-y divide-background">
                                {notifications.map((notif) => {
                                    const IconComponent = notif.icon;
                                    return (
                                        <div
                                            key={notif.id}
                                            className={`p-4 border-l-4 ${getColor(notif.severity)}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <IconComponent
                                                    className={`w-5 h-5 mt-0.5 shrink-0 ${getTextColor(notif.severity)}`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p
                                                        className={`text-sm font-semibold ${getTextColor(notif.severity)}`}
                                                    >
                                                        {notif.title}
                                                    </p>
                                                    <p className="text-xs text-text/70 mt-0.5 wrap-break-word">
                                                        {notif.message}
                                                    </p>
                                                    <p className="text-xs text-text/50 mt-1">
                                                        {notif.timestamp.toLocaleTimeString(
                                                            [],
                                                            {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            },
                                                        )}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() =>
                                                        dismissNotification(
                                                            notif.id,
                                                        )
                                                    }
                                                    className="p-1 hover:bg-background/50 rounded shrink-0"
                                                >
                                                    <X className="w-4 h-4 text-text/50" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-background">
                            <button
                                onClick={clearAll}
                                className="w-full text-xs text-center text-primary hover:underline font-medium"
                            >
                                Clear all notifications
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Click outside to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default NotificationCenter;
