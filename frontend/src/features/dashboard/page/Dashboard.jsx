import React, {
    useCallback,
    useDeferredValue,
    useEffect,
    useId,
    useState,
    useTransition,
    useRef
} from "react";
import { Button, Header } from "../../../shared";
import {
    MeterDataBlock,
    EnergyChart,
    PaymentBlock,
    QuickStatsCards,
    StatusIndicator,
    HourlyBreakdown,
    GoalTracker,
    HistoricalComparison,
    PreferencesModal,
    usePreferences,
} from "..";
import { Zap, Monitor, Fan, Coffee, Plug, Lightbulb, Tv, Activity } from "lucide-react";
import { fetchJson, submitNilpFeedback } from "@/shared";

const FREQUENCY_OPTIONS = ["daily", "weekly", "monthly"];
const FEEDBACK_HISTORY_KEY = "sems.nilp.feedbackHistory";
const ACTIVE_CARD_CONFIDENCE_THRESHOLD = 0.75;
const POSSIBLE_CARD_CONFIDENCE_THRESHOLD = 0.4;

const deriveActiveCounts = (activeAppliances = [], activeDeviceCount, activeTypeCount) => {
    const safeAppliances = Array.isArray(activeAppliances) ? activeAppliances : [];

    const fallbackDeviceCount = safeAppliances.length;
    const fallbackTypeCount = new Set(
        safeAppliances
            .map((item) => String(item?.name || "").trim().toLowerCase())
            .filter(Boolean)
    ).size;

    const parsedDeviceCount = Number(activeDeviceCount);
    const parsedTypeCount = Number(activeTypeCount);

    return {
        activeDeviceCount: Number.isFinite(parsedDeviceCount) && parsedDeviceCount >= 0
            ? parsedDeviceCount
            : fallbackDeviceCount,
        activeTypeCount: Number.isFinite(parsedTypeCount) && parsedTypeCount >= 0
            ? parsedTypeCount
            : fallbackTypeCount,
    };
};

const trimTrailingSlash = (value = "") => String(value).replace(/\/+$/, "");

const getWsUrl = () => {
    const configuredWsBase = trimTrailingSlash(import.meta.env.VITE_WS_URL || "");
    if (configuredWsBase) {
        return `${configuredWsBase}/ws/electrical/`;
    }

    const configuredApiBase = import.meta.env.VITE_API_URL || "";
    if (configuredApiBase) {
        try {
            const apiUrl = new URL(configuredApiBase);
            const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
            return `${wsProtocol}//${apiUrl.host}/ws/electrical/`;
        } catch {
            // Fall back to browser location below if API URL parsing fails.
        }
    }

    if (typeof window !== "undefined") {
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${wsProtocol}//${window.location.host}/ws/electrical/`;
    }

    return "ws://localhost:8000/ws/electrical/";
};

const getApplianceIcon = (applianceName) => {
    const name = (applianceName || "").toLowerCase();
    if (name.includes("fan")) return <Fan className="w-5 h-5 text-blue-500" />;
    if (name.includes("laptop") || name.includes("computer") || name.includes("pc")) return <Monitor className="w-5 h-5 text-purple-500" />;
    if (name.includes("coffee") || name.includes("heater")) return <Coffee className="w-5 h-5 text-orange-500" />;
    if (name.includes("light") || name.includes("bulb")) return <Lightbulb className="w-5 h-5 text-yellow-500" />;
    if (name.includes("tv") || name.includes("television")) return <Tv className="w-5 h-5 text-indigo-500" />;
    return <Plug className="w-5 h-5 text-gray-500" />;
};

const getConfidenceMeta = (rawConfidence) => {
    const confidence = Number(rawConfidence) || 0;
    if (confidence >= 0.75) {
        return {
            label: `High ${(confidence * 100).toFixed(0)}%`,
            className: "bg-green-100 text-green-700",
        };
    }

    if (confidence >= 0.5) {
        return {
            label: `Medium ${(confidence * 100).toFixed(0)}%`,
            className: "bg-amber-100 text-amber-700",
        };
    }

    return {
        label: `Low ${(confidence * 100).toFixed(0)}%`,
        className: "bg-red-100 text-red-700",
    };
};

const Dashboard = () => {
    const [frequency, setFrequency] = useState("daily");
    const [isPending, startTransition] = useTransition();
    const deferredFrequency = useDeferredValue(frequency);
    const frequencyGroupId = useId();

    const [liveData, setLiveData] = useState({
        voltage: 0,
        power: 0,
        current: 0,
        kwhConsumption: 0,
        todayKwhUsage: 0,
        monthKwhUsage: 0,
        activeAppliances: [],
        activeDeviceCount: 0,
        activeTypeCount: 0,
        notifications: [],
    });
    const [isLiveLoading, setIsLiveLoading] = useState(true);
    const [liveError, setLiveError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);
    const [feedbackBusyId, setFeedbackBusyId] = useState(null);
    const [feedbackNotice, setFeedbackNotice] = useState(null);
    const [feedbackHistory, setFeedbackHistory] = useState([]);

    const startOfDayOffset = useRef(0);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(FEEDBACK_HISTORY_KEY);
            if (!raw) {
                return;
            }

            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                setFeedbackHistory(parsed.slice(0, 8));
            }
        } catch {
            // Ignore localStorage parse errors and start with empty history.
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(
                FEEDBACK_HISTORY_KEY,
                JSON.stringify(feedbackHistory.slice(0, 8))
            );
        } catch {
            // Ignore localStorage write errors.
        }
    }, [feedbackHistory]);

    useEffect(() => {
        let activeController = new AbortController();
        const fetchInitial = async () => {
            try {
                const data = await fetchJson("/electrical/readings/latest/", {
                    signal: activeController.signal,
                });

                const initialKwh = Number(data.kwh_consumption) || 0;
                const initialToday = Number(data.today_kwh_usage) || 0;
                const activeAppliances = data.active_appliances || [];
                const counts = deriveActiveCounts(
                    activeAppliances,
                    data.active_device_count,
                    data.active_type_count
                );

                startOfDayOffset.current = initialKwh - initialToday;

                setLiveData({
                    voltage: Number(data.voltage) || 0,
                    power: Number(data.power) || 0,
                    current: Number(data.current) || 0,
                    kwhConsumption: initialKwh,
                    todayKwhUsage: initialToday,
                    monthKwhUsage: Number(data.month_kwh_usage) || 0,
                    activeAppliances,
                    activeDeviceCount: counts.activeDeviceCount,
                    activeTypeCount: counts.activeTypeCount,
                    notifications: Array.isArray(data.notifications) ? data.notifications : [],
                });
                setLastUpdated(new Date());
                setIsLiveLoading(false);
            } catch (err) {
                if (err?.name !== "AbortError") {
                    console.error("Failed to fetch initial data", err);
                }
            }
        };
        fetchInitial();
        return () => activeController.abort();
    }, []);

    useEffect(() => {
        let socket;
        let retryTimeout;
        let heartbeatTimer;
        let isMounted = true;

        const stopHeartbeat = () => {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
        };

        const startHeartbeat = () => {
            stopHeartbeat();
            heartbeatTimer = setInterval(() => {
                if (socket?.readyState === WebSocket.OPEN) {
                    socket.send("ping");
                }
            }, 25000);
        };

        const connect = () => {
            if (!isMounted) return;

            const wsUrl = getWsUrl();
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("🟢 Connected to live data stream!");
                setLiveError("");
                startHeartbeat();
            };

            socket.onmessage = (event) => {
                try {
                    if (event.data === "pong") {
                        return;
                    }

                    const data = JSON.parse(event.data);

                    setLiveData((prev) => {
                        const newLifetimeKwh = Number(data.kwh_consumption) || prev.kwhConsumption;
                        const liveTodayUsage = Math.max(0, newLifetimeKwh - startOfDayOffset.current);
                        const activeAppliances = data.active_appliances || prev.activeAppliances || [];
                        const counts = deriveActiveCounts(
                            activeAppliances,
                            data.active_device_count,
                            data.active_type_count
                        );

                        return {
                            ...prev,
                            voltage: Number(data.voltage) || prev.voltage,
                            power: Number(data.power) || prev.power,
                            current: Number(data.current) || prev.current,
                            kwhConsumption: newLifetimeKwh,
                            todayKwhUsage: liveTodayUsage,
                            activeAppliances,
                            activeDeviceCount: counts.activeDeviceCount,
                            activeTypeCount: counts.activeTypeCount,
                            notifications: Array.isArray(data.notifications)
                                ? data.notifications
                                : prev.notifications,
                        };
                    });

                    setLastUpdated(new Date());
                    setIsLiveLoading(false);
                } catch (error) {
                    console.error("Error parsing live data:", error);
                }
            };

            socket.onerror = (error) => {
                console.error("WebSocket Error:", error);
                setLiveError("Live stream connection lost.");
            };

            socket.onclose = () => {
                stopHeartbeat();
                console.log("🔴 WebSocket Disconnected. Retrying in 5s...");
                setLiveError("Live stream paused. Reconnecting...");
                if (isMounted) {
                    retryTimeout = setTimeout(connect, 5000);
                }
            };
        };

        connect();

        return () => {
            isMounted = false;
            clearTimeout(retryTimeout);
            stopHeartbeat();
            if (socket) {
                socket.onopen = null;
                socket.onmessage = null;
                socket.onerror = null;
                socket.onclose = null;
                socket.close();
            }
        };
    }, []);

    const { prefs, loading: prefsLoading, saving, error: saveError, savePreferences } = usePreferences();
    const [showPrefsModal, setShowPrefsModal] = useState(false);
    const paymentRate = Number(prefs?.costRate) || 0;

    const handleFrequency = useCallback((value) => {
        startTransition(() => {
            setFrequency(value);
        });
    }, []);

    const handleNilpFeedback = useCallback(async (app) => {
        if (!app) {
            return;
        }

        const suggested = String(app.name || "").trim();
        const previousLabel = suggested;
        const correctedName = window.prompt(
            "Correct appliance label:",
            suggested
        );

        if (!correctedName) {
            return;
        }

        const trimmedName = correctedName.trim();
        if (!trimmedName) {
            return;
        }

        const feedbackId = app.id || `${app.name}-${app.power}-${app.current}`;
        setFeedbackBusyId(feedbackId);

        try {
            const response = await submitNilpFeedback({
                applianceName: trimmedName,
                powerJumpWatts: Number(app.power) || 0,
                currentJumpAmps: Number(app.current) || 0,
                retrainNow: true,
            });

            setLiveData((prev) => {
                const updatedAppliances = (prev.activeAppliances || []).map((item) => {
                    const isTarget = item.id
                        ? item.id === app.id
                        : item.name === app.name &&
                        Number(item.power) === Number(app.power) &&
                        Number(item.current) === Number(app.current);

                    if (!isTarget) {
                        return item;
                    }

                    return {
                        ...item,
                        name: trimmedName,
                        confidence: 1,
                        candidates: [],
                    };
                });

                const counts = deriveActiveCounts(updatedAppliances);

                return {
                    ...prev,
                    activeAppliances: updatedAppliances,
                    activeDeviceCount: counts.activeDeviceCount,
                    activeTypeCount: counts.activeTypeCount,
                };
            });

            const retrained = Boolean(response?.retrained);
            const reloaded = Boolean(response?.model_reloaded);
            const trainingError = response?.training_error;

            setFeedbackNotice({
                type: retrained && reloaded && !trainingError ? "success" : "error",
                text:
                    retrained && reloaded && !trainingError
                        ? `Saved correction: ${trimmedName} (model updated)`
                        : trainingError
                            ? `Saved correction, but retrain failed: ${trainingError}`
                            : "Saved correction, but model was not reloaded.",
            });

            setFeedbackHistory((prev) => [
                {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    previousLabel,
                    correctedLabel: trimmedName,
                    power: Number(app.power) || 0,
                    current: Number(app.current) || 0,
                    retrained,
                    reloaded,
                    trainingError: trainingError || null,
                    createdAt: new Date().toISOString(),
                },
                ...prev,
            ].slice(0, 8));
        } catch {
            setFeedbackNotice({
                type: "error",
                text: "Failed to save correction. Please try again.",
            });
        } finally {
            setFeedbackBusyId(null);
        }
    }, []);

    const formattedLiveData = isLiveLoading
        ? {
            voltage: "--",
            power: "--",
            current: "--",
            kwhConsumption: "--",
            todayKwhUsage: "--",
        }
        : {
            voltage: liveData.voltage.toFixed(1),
            power: liveData.power.toFixed(1),
            current: liveData.current.toFixed(3),
            kwhConsumption: liveData.todayKwhUsage.toFixed(2),
            todayKwhUsage: liveData.todayKwhUsage.toFixed(2),
        };

    const allDetectedAppliances = Array.isArray(liveData.activeAppliances)
        ? liveData.activeAppliances
        : [];

    const highConfidenceAppliances = allDetectedAppliances.filter(
        (app) => Number(app?.confidence || 0) >= ACTIVE_CARD_CONFIDENCE_THRESHOLD
    );

    const possibleAppliances = allDetectedAppliances.filter((app) => {
        const confidence = Number(app?.confidence || 0);
        return (
            confidence >= POSSIBLE_CARD_CONFIDENCE_THRESHOLD
            && confidence < ACTIVE_CARD_CONFIDENCE_THRESHOLD
        );
    });

    const hiddenLowConfidenceCount = Math.max(
        0,
        allDetectedAppliances.length - highConfidenceAppliances.length - possibleAppliances.length
    );

    return (
        <div className="p-4 md:p-6 flex flex-col mb-8">
            <Header liveData={liveData} />

            {showPrefsModal && (
                <PreferencesModal
                    prefs={prefs}
                    saving={saving}
                    saveError={saveError}
                    onSave={savePreferences}
                    onClose={() => setShowPrefsModal(false)}
                />
            )}

            <QuickStatsCards
                liveData={liveData}
                isLoading={isLiveLoading}
                PAYMENT_RATE={paymentRate}
            />

            <StatusIndicator
                isOnline={!liveError}
                isLoading={isLiveLoading}
                error={liveError}
                lastUpdated={lastUpdated}
            />

            <div className="flex flex-wrap items-center gap-3 mb-6">
                <span id={frequencyGroupId} className="sr-only">
                    Select energy chart frequency
                </span>
                <div
                    className="flex gap-2 bg-white p-1 rounded-xl w-fit shadow-sm"
                    role="group"
                    aria-labelledby={frequencyGroupId}
                >
                    {FREQUENCY_OPTIONS.map((value) => {
                        const isSelected = value === frequency;
                        return (
                            <Button
                                key={value}
                                text={
                                    value.charAt(0).toUpperCase() +
                                    value.slice(1)
                                }
                                onClick={() => handleFrequency(value)}
                                ariaPressed={isSelected}
                                className={`font-semibold text-sm rounded-lg py-1.5 px-4 ${isSelected ? "bg-primary text-white" : "text-text/70 hover:bg-background"}`}
                            />
                        );
                    })}
                </div>
                {isPending && (
                    <p className="text-sm text-text/70">Refreshing chart...</p>
                )}
            </div>

            <div className="flex flex-col xl:flex-row gap-6 mb-6">
                <div className="flex flex-col gap-6 flex-1">
                    <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
                        <div className="flex flex-col gap-4">
                            <MeterDataBlock
                                label="V"
                                labelText="Voltage"
                                data={formattedLiveData.voltage}
                                unit="V"
                            />
                            <MeterDataBlock
                                label="P"
                                labelText="Power"
                                data={formattedLiveData.power}
                                unit="W"
                            />
                            <MeterDataBlock
                                label="C"
                                labelText="Current"
                                data={formattedLiveData.current}
                                unit="A"
                            />
                        </div>

                        <div className="flex flex-col bg-white rounded-2xl shadow-xl p-4 md:p-5">

                            {/* --- THE HEADER --- */}
                            <div className="flex w-full justify-between items-center gap-4">
                                <div className="rounded-full aspect-square p-3 border border-background bg-white shadow-lg flex justify-center items-center">
                                    <Zap className="text-primary" />
                                </div>
                                <h3 className="text-xs md:text-sm text-text/70 font-semibold uppercase tracking-wide leading-tight text-right">
                                    Estimated Energy Consumption (Today)
                                </h3>
                            </div>

                            {/* --- THE FIX: BIG TOTAL MOVED TO TOP --- */}
                            <div className="p-4 mt-5 rounded-xl bg-linear-120 from-primary to-secondary shadow-lg w-full flex flex-row gap-3 items-center justify-between">
                                <div className="w-1.5 h-32 rounded-4xl bg-white/80" />
                                <div className="flex flex-col items-end">
                                    <div className="flex items-baseline gap-2">
                                        <h2 className="text-5xl md:text-6xl text-white font-bold leading-none">
                                            {formattedLiveData.kwhConsumption}
                                        </h2>
                                        <p className="text-sm text-white/90 font-semibold">
                                            kWh
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <p className="mt-3 mb-2 text-xs font-medium text-text/60 text-right">
                                Based on estimated power consumption measured by SEMS.
                            </p>

                            {/* --- THE FIX: DETAILED APPLIANCE GRID WITH SCROLLING --- */}
                            <div className="mt-4 flex flex-col flex-1">
                                <div className="flex justify-between items-center mb-3 px-1">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Activity className="w-4 h-4" /> Itemized Billing
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <p className="text-[10px] text-muted-foreground font-semibold">
                                            {highConfidenceAppliances.length} active • {possibleAppliances.length} possible
                                            {hiddenLowConfidenceCount > 0 ? ` • ${hiddenLowConfidenceCount} hidden` : ""}
                                        </p>
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${liveData.power > 2 ? "bg-green-400" : "bg-gray-400"}`}></span>
                                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${liveData.power > 2 ? "bg-green-500" : "bg-gray-500"}`}></span>
                                        </span>
                                    </div>
                                </div>

                                {/* Scrolling Box */}
                                <div className="max-h-72 overflow-y-auto pr-2 pb-2 custom-scrollbar">
                                    {feedbackNotice && (
                                        <div
                                            className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${feedbackNotice.type === "success"
                                                ? "bg-green-50 text-green-700 border border-green-200"
                                                : "bg-red-50 text-red-700 border border-red-200"
                                                }`}
                                        >
                                            {feedbackNotice.text}
                                        </div>
                                    )}

                                    {feedbackHistory.length > 0 && (
                                        <div className="mb-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                                            <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">
                                                Recent Label Corrections
                                            </p>
                                            <div className="space-y-2">
                                                {feedbackHistory.slice(0, 4).map((entry) => (
                                                    <div key={entry.id} className="text-[11px] leading-snug">
                                                        <p className="font-semibold text-text/80">
                                                            {entry.previousLabel || "Unknown"} → {entry.correctedLabel}
                                                        </p>
                                                        <p className="text-muted-foreground">
                                                            {new Date(entry.createdAt).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                            {entry.retrained && entry.reloaded
                                                                ? " • model updated"
                                                                : " • pending model refresh"}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {liveData.power < 2 || allDetectedAppliances.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-xl border border-border/50">
                                            <Plug className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                                            <p className="text-sm font-bold text-text/60">No Devices Detected</p>
                                            <p className="text-xs text-muted-foreground mt-1">Plug in an appliance to see live stats.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {highConfidenceAppliances.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {highConfidenceAppliances.map((app, idx) => {
                                                        const costPerHour = ((app.power / 1000) * paymentRate).toFixed(2);
                                                        const confidenceMeta = getConfidenceMeta(app.confidence);
                                                        const feedbackId = app.id || `${app.name}-${idx}`;
                                                        const candidateLabels = Array.isArray(app.candidates)
                                                            ? app.candidates
                                                                .filter((candidate) => candidate?.label && candidate.label !== app.name)
                                                                .slice(0, 2)
                                                                .map((candidate) => `${candidate.label} ${(Number(candidate.confidence || 0) * 100).toFixed(0)}%`)
                                                            : [];

                                                        return (
                                                            <div key={feedbackId} className="flex flex-col p-4 bg-white rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="p-1.5 bg-muted/50 rounded-lg">
                                                                            {getApplianceIcon(app.name)}
                                                                        </div>
                                                                        <span className="text-sm font-bold text-text/90 capitalize">{app.name}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ACTIVE</span>
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${confidenceMeta.className}`}>
                                                                            {confidenceMeta.label}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-y-3 gap-x-2 mt-1">
                                                                    <div>
                                                                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Power</p>
                                                                        <p className="text-sm font-bold text-primary">{app.power} <span className="text-[10px] text-text/60 font-normal">W</span></p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Current</p>
                                                                        <p className="text-sm font-bold">{app.current} <span className="text-[10px] text-text/60 font-normal">A</span></p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-medium text-muted-foreground uppercase">Voltage</p>
                                                                        <p className="text-sm font-bold">{app.voltage} <span className="text-[10px] text-text/60 font-normal">V</span></p>
                                                                    </div>
                                                                    <div className="bg-primary/5 p-1.5 -m-1.5 rounded-md border border-primary/10">
                                                                        <p className="text-[10px] font-bold text-primary uppercase">Est. Cost</p>
                                                                        <p className="text-sm font-bold text-primary">₱{costPerHour} <span className="text-[10px] text-primary/70 font-normal">/hr</span></p>
                                                                    </div>
                                                                </div>

                                                                {candidateLabels.length > 0 && (
                                                                    <p className="mt-3 text-[11px] text-muted-foreground leading-snug">
                                                                        Possible: {candidateLabels.join(", ")}
                                                                    </p>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    disabled={feedbackBusyId === feedbackId}
                                                                    onClick={() => handleNilpFeedback(app)}
                                                                    className="mt-3 text-[11px] font-semibold text-primary hover:text-primary/80 disabled:opacity-60 disabled:cursor-not-allowed text-left"
                                                                >
                                                                    {feedbackBusyId === feedbackId
                                                                        ? "Saving correction..."
                                                                        : "Correct label"}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center p-4 bg-muted/20 rounded-xl border border-border/50">
                                                    <p className="text-sm font-bold text-text/60">No High-Confidence Devices Yet</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Check Possible Devices below while the model stabilizes.</p>
                                                </div>
                                            )}

                                            {possibleAppliances.length > 0 && (
                                                <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/50 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-2">
                                                        Possible Devices (Lower Confidence)
                                                    </p>
                                                    <div className="space-y-2">
                                                        {possibleAppliances.map((app, idx) => {
                                                            const confidenceMeta = getConfidenceMeta(app.confidence);
                                                            const feedbackId = app.id || `${app.name}-${idx}-possible`;
                                                            const candidateLabels = Array.isArray(app.candidates)
                                                                ? app.candidates
                                                                    .filter((candidate) => candidate?.label && candidate.label !== app.name)
                                                                    .slice(0, 2)
                                                                    .map((candidate) => `${candidate.label} ${(Number(candidate.confidence || 0) * 100).toFixed(0)}%`)
                                                                : [];

                                                            return (
                                                                <div key={feedbackId} className="rounded-lg border border-amber-200/60 bg-white p-2.5">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="p-1 bg-muted/40 rounded-md">
                                                                                {getApplianceIcon(app.name)}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-text/85 capitalize">{app.name}</p>
                                                                                <p className="text-[10px] text-muted-foreground">
                                                                                    {app.power}W • {app.current}A • {app.voltage}V
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${confidenceMeta.className}`}>
                                                                            {confidenceMeta.label}
                                                                        </span>
                                                                    </div>

                                                                    {candidateLabels.length > 0 && (
                                                                        <p className="mt-1.5 text-[10px] text-muted-foreground leading-snug">
                                                                            Possible: {candidateLabels.join(", ")}
                                                                        </p>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        disabled={feedbackBusyId === feedbackId}
                                                                        onClick={() => handleNilpFeedback(app)}
                                                                        className="mt-2 text-[10px] font-semibold text-primary hover:text-primary/80 disabled:opacity-60 disabled:cursor-not-allowed text-left"
                                                                    >
                                                                        {feedbackBusyId === feedbackId
                                                                            ? "Saving correction..."
                                                                            : "Correct label"}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <EnergyChart frequency={deferredFrequency} />
                    </div>
                </div>

                <div className="w-full xl:w-80">
                    <GoalTracker
                        liveData={liveData}
                        isLoading={isLiveLoading}
                        targetKwh={prefs.targetKwh}
                        costRate={prefs.costRate}
                        cycleStartDay={prefs.cycleStartDay}
                        prefsLoading={prefsLoading}
                        onEditPreferences={() => setShowPrefsModal(true)}
                    />
                </div>
            </div>

            <HistoricalComparison
                liveData={liveData}
                isLoading={isLiveLoading}
            />

            <HourlyBreakdown isLoading={isLiveLoading} />

            <div className="mt-6 bg-white rounded-2xl shadow-xl">
                <PaymentBlock
                    kwh={liveData.todayKwhUsage}
                    rate={paymentRate}
                    isLoading={isLiveLoading}
                />
            </div>
        </div>
    );
};

export default Dashboard;