import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";

const StatusIndicator = ({
    isOnline = true,
    isLoading = false,
    error = null,
    lastUpdated = null,
}) => {
    const statusInfo = useMemo(() => {
        const now = new Date();
        let timeAgo = "Just now";

        if (lastUpdated) {
            const diff = now - new Date(lastUpdated);
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);

            if (minutes > 0) {
                timeAgo = `${minutes}m ago`;
            } else if (seconds > 0) {
                timeAgo = `${seconds}s ago`;
            }
        }

        return { timeAgo };
    }, [lastUpdated]);

    return (
        <div className="space-y-3 mb-6">
            {/* Status Badge Row */}
            <div className="flex flex-wrap items-center gap-3">
                <Badge
                    variant={isOnline ? "default" : "destructive"}
                    className="flex items-center gap-2"
                >
                    <span
                        className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400"} animate-pulse`}
                    />
                    {isOnline ? "System Online" : "System Offline"}
                </Badge>

                {isLoading && (
                    <Badge
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Updating...
                    </Badge>
                )}

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                    <Clock className="w-3 h-3" />
                    Last updated: {statusInfo.timeAgo}
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <Alert
                    variant="destructive"
                    className="border-destructive/30 bg-destructive/10"
                >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-destructive">
                        {error}
                    </AlertDescription>
                </Alert>
            )}

            {/* Success Status */}
            {!error && isOnline && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>All systems normal</span>
                </div>
            )}
        </div>
    );
};

export default StatusIndicator;
