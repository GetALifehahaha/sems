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
import { fetchJson } from "@/shared";

const FREQUENCY_OPTIONS = ["daily", "weekly", "monthly"];

const getWsUrl = () => {
    const baseUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
    return `${baseUrl}/ws/electrical/`;
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
        activeAppliances: []
    });
    const [isLiveLoading, setIsLiveLoading] = useState(true);
    const [liveError, setLiveError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);

    const startOfDayOffset = useRef(0);

    useEffect(() => {
        let activeController = new AbortController();
        const fetchInitial = async () => {
            try {
                const data = await fetchJson("/electrical/readings/latest/", {
                    signal: activeController.signal,
                });

                const initialKwh = Number(data.kwh_consumption) || 0;
                const initialToday = Number(data.today_kwh_usage) || 0;

                startOfDayOffset.current = initialKwh - initialToday;

                setLiveData({
                    voltage: Number(data.voltage) || 0,
                    power: Number(data.power) || 0,
                    current: Number(data.current) || 0,
                    kwhConsumption: initialKwh,
                    todayKwhUsage: initialToday,
                    monthKwhUsage: Number(data.month_kwh_usage) || 0,
                    activeAppliances: data.active_appliances || []
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
        let isMounted = true;

        const connect = () => {
            if (!isMounted) return;

            const wsUrl = getWsUrl();
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("🟢 Connected to live data stream!");
                setLiveError("");
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    setLiveData((prev) => {
                        const newLifetimeKwh = Number(data.kwh_consumption) || prev.kwhConsumption;
                        const liveTodayUsage = Math.max(0, newLifetimeKwh - startOfDayOffset.current);

                        return {
                            ...prev,
                            voltage: Number(data.voltage) || prev.voltage,
                            power: Number(data.power) || prev.power,
                            current: Number(data.current) || prev.current,
                            kwhConsumption: newLifetimeKwh,
                            todayKwhUsage: liveTodayUsage,
                            activeAppliances: data.active_appliances || prev.activeAppliances || []
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

    return (
        <div className="p-4 md:p-6 flex flex-col mb-8">
            <Header liveData={liveData} PAYMENT_RATE={paymentRate} />

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
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${liveData.power > 2 ? "bg-green-400" : "bg-gray-400"}`}></span>
                                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${liveData.power > 2 ? "bg-green-500" : "bg-gray-500"}`}></span>
                                    </span>
                                </div>

                                {/* Scrolling Box */}
                                <div className="max-h-72 overflow-y-auto pr-2 pb-2 custom-scrollbar">
                                    {liveData.power < 2 || !liveData.activeAppliances || liveData.activeAppliances.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-xl border border-border/50">
                                            <Plug className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                                            <p className="text-sm font-bold text-text/60">No Devices Detected</p>
                                            <p className="text-xs text-muted-foreground mt-1">Plug in an appliance to see live stats.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {liveData.activeAppliances.map((app, idx) => {
                                                const costPerHour = ((app.power / 1000) * paymentRate).toFixed(2);
                                                return (
                                                    <div key={idx} className="flex flex-col p-4 bg-white rounded-xl border border-border/60 shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1.5 bg-muted/50 rounded-lg">
                                                                    {getApplianceIcon(app.name)}
                                                                </div>
                                                                <span className="text-sm font-bold text-text/90 capitalize">{app.name}</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ACTIVE</span>
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
                                                    </div>
                                                );
                                            })}
                                        </div>
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