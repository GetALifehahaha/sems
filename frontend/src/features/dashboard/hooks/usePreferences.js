import { useCallback, useEffect, useState } from "react";
import { getPreferences, updatePreferences } from "@/shared";

export const PREFERENCE_DEFAULTS = { targetKwh: 150, costRate: 12, cycleStartDay: 1 };

const normalize = (data) => ({
    targetKwh: Number(data?.target_kwh) || PREFERENCE_DEFAULTS.targetKwh,
    costRate: Number(data?.cost_rate) || PREFERENCE_DEFAULTS.costRate,
    cycleStartDay: Number(data?.cycle_start_day) || PREFERENCE_DEFAULTS.cycleStartDay,
});

export const usePreferences = () => {
    const [prefs, setPrefs] = useState(PREFERENCE_DEFAULTS);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        getPreferences(controller.signal)
            .then((data) => setPrefs(normalize(data)))
            .catch((err) => {
                if (err?.name !== "AbortError") setLoading(false);
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, []);

    const savePreferences = useCallback(async ({ targetKwh, costRate, cycleStartDay }) => {
        setSaving(true);
        setError(null);
        try {
            const data = await updatePreferences({
                target_kwh: targetKwh,
                cost_rate: costRate,
                cycle_start_day: cycleStartDay,
            });
            setPrefs(normalize(data));
            return true;
        } catch {
            setError("Failed to save preferences. Please try again.");
            return false;
        } finally {
            setSaving(false);
        }
    }, []);

    return { prefs, loading, saving, error, savePreferences };
};
