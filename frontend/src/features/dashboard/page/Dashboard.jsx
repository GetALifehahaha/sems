import React, {
    useCallback,
    useDeferredValue,
    useEffect,
    useId,
    useMemo,
    useState,
    useTransition,
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
} from "..";
import { Zap } from "lucide-react";
import { fetchJson } from "@/shared";

const FREQUENCY_OPTIONS = ["daily", "weekly", "monthly"];
const PAYMENT_RATE = 12;

// Helper to grab the right WebSocket URL
const getWsUrl = () => {
    const baseUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
    return `${baseUrl}/ws/electrical/`;
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
    });
    const [isLiveLoading, setIsLiveLoading] = useState(true);
    const [liveError, setLiveError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);

    // 1. Fetch initial data ONCE so the screen isn't empty while connecting
    useEffect(() => {
        let activeController = new AbortController();
        const fetchInitial = async () => {
            try {
                const data = await fetchJson("/electrical/readings/latest/", {
                    signal: activeController.signal,
                });
                setLiveData({
                    voltage: Number(data.voltage) || 0,
                    power: Number(data.power) || 0,
                    current: Number(data.current) || 0,
                    kwhConsumption: Number(data.kwh_consumption) || 0,
                    todayKwhUsage: Number(data.today_kwh_usage) || 0,
                    monthKwhUsage: Number(data.month_kwh_usage) || 0,
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

    // 2. The LIVE WebSocket Phone Line!
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
                    setLiveData((prev) => ({
                        ...prev,
                        voltage: Number(data.voltage) || prev.voltage,
                        power: Number(data.power) || prev.power,
                        current: Number(data.current) || prev.current,
                        kwhConsumption: Number(data.kwh_consumption) || prev.kwhConsumption,
                    }));
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
                // Detach handlers before close to prevent onclose from firing
                socket.onopen = null;
                socket.onmessage = null;
                socket.onerror = null;
                socket.onclose = null;
                socket.close();
            }
        };
    }, []);

    const handleFrequency = useCallback((value) => {
        startTransition(() => {
            setFrequency(value);
        });
    }, []);

    const formattedLiveData = useMemo(() => {
        if (isLiveLoading) {
            return {
                voltage: "--",
                power: "--",
                current: "--",
                kwhConsumption: "--",
                todayKwhUsage: "--",
            };
        }

        return {
            voltage: liveData.voltage.toFixed(1),
            power: liveData.power.toFixed(1),
            current: liveData.current.toFixed(3),
            kwhConsumption: liveData.todayKwhUsage.toFixed(2),
            todayKwhUsage: liveData.todayKwhUsage.toFixed(2),
        };
    }, [isLiveLoading, liveData]);

    return (
        <div className="p-4 md:p-6 flex flex-col mb-8">
            <Header liveData={liveData} PAYMENT_RATE={PAYMENT_RATE} />

            <QuickStatsCards
                liveData={liveData}
                isLoading={isLiveLoading}
                PAYMENT_RATE={PAYMENT_RATE}
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
                            <div className="flex w-full justify-between items-center gap-4">
                                <div className="rounded-full aspect-square p-3 border border-background bg-white shadow-lg flex justify-center items-center">
                                    <Zap className="text-primary" />
                                </div>
                                <h3 className="text-xs md:text-sm text-text/70 font-semibold uppercase tracking-wide leading-tight text-right">
                                    Estimated Energy Consumption (Today)
                                </h3>
                            </div>

                            <div className="p-4 mt-4 rounded-xl bg-linear-120 from-primary to-secondary shadow-lg min-h-28 ml-auto w-full max-w-md flex flex-row gap-3 items-end justify-end">
                                <div className="w-1 h-full rounded-4xl bg-white/90 mr-auto" />
                                <h2 className="text-5xl md:text-6xl text-white font-bold leading-none">
                                    {formattedLiveData.kwhConsumption}
                                </h2>
                                <p className="text-sm text-white/90 font-semibold mb-1">
                                    kWh
                                </p>
                            </div>

                            <p className="ml-auto mt-4 text-xs font-medium text-text/60 text-right">
                                Based on estimated power consumption measured by
                                SEMS.
                            </p>
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
                        PAYMENT_RATE={PAYMENT_RATE}
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
                    rate={PAYMENT_RATE}
                    isLoading={isLiveLoading}
                />
            </div>
        </div>
    );
};

export default Dashboard;