export const getApiBaseUrl = () => {
    return import.meta.env.VITE_API_URL || "http://localhost:8000";
};

const DEFAULT_PREFERENCES = {
    target_kwh: 150,
    cost_rate: 12,
    cycle_start_day: 1,
};

const PREFERENCES_ENDPOINT = "/electrical/preferences/";
const NILP_FEEDBACK_ENDPOINT = "/electrical/nilp-feedback/";
const PREFERENCES_STORAGE_KEY = "sems.preferences";

const normalizePreferences = (payload = {}) => ({
    target_kwh: Number(payload.target_kwh ?? payload.targetKwh) || DEFAULT_PREFERENCES.target_kwh,
    cost_rate: Number(payload.cost_rate ?? payload.costRate) || DEFAULT_PREFERENCES.cost_rate,
    cycle_start_day:
        Number(payload.cycle_start_day ?? payload.cycleStartDay) ||
        DEFAULT_PREFERENCES.cycle_start_day,
});

const readStoredPreferences = () => {
    if (typeof window === "undefined") {
        return { ...DEFAULT_PREFERENCES };
    }

    try {
        const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_PREFERENCES };
        }

        return normalizePreferences(JSON.parse(raw));
    } catch {
        return { ...DEFAULT_PREFERENCES };
    }
};

const storePreferences = (preferences) => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.localStorage.setItem(
            PREFERENCES_STORAGE_KEY,
            JSON.stringify(normalizePreferences(preferences))
        );
    } catch {
        // Ignore storage write failures to keep UI responsive.
    }
};

export const buildUrl = (path, query = {}) => {
    const base = getApiBaseUrl();
    const url = new URL(path, base);

    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    });

    return url.toString();
};

const requestJson = async (path, { method = "GET", signal, query, body } = {}) => {
    const response = await fetch(buildUrl(path, query), {
        method,
        signal,
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "69420"
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
};

export const fetchJson = async (path, { signal, query } = {}) => {
    return requestJson(path, { method: "GET", signal, query });
};

export const patchJson = async (path, body, { signal, query } = {}) => {
    return requestJson(path, { method: "PATCH", signal, query, body });
};

export const postJson = async (path, body, { signal, query } = {}) => {
    return requestJson(path, { method: "POST", signal, query, body });
};

export const getPreferences = async (signal) => {
    try {
        const remotePreferences = await fetchJson(PREFERENCES_ENDPOINT, { signal });
        const normalized = normalizePreferences(remotePreferences);
        storePreferences(normalized);
        return normalized;
    } catch (error) {
        if (error?.name === "AbortError") {
            throw error;
        }

        return readStoredPreferences();
    }
};

export const updatePreferences = async (payload, { signal } = {}) => {
    const normalizedPayload = normalizePreferences(payload);

    try {
        const remotePreferences = await patchJson(
            PREFERENCES_ENDPOINT,
            normalizedPayload,
            { signal }
        );
        const normalized = normalizePreferences(remotePreferences ?? normalizedPayload);
        storePreferences(normalized);
        return normalized;
    } catch (error) {
        if (error?.name === "AbortError") {
            throw error;
        }

        storePreferences(normalizedPayload);
        return normalizedPayload;
    }
};

export const submitNilpFeedback = async (
    { applianceName, powerJumpWatts, currentJumpAmps, retrainNow = true },
    { signal } = {}
) => {
    return postJson(
        NILP_FEEDBACK_ENDPOINT,
        {
            appliance_name: applianceName,
            power_jump_watts: powerJumpWatts,
            current_jump_amps: currentJumpAmps,
            retrain_now: retrainNow,
        },
        { signal }
    );
};
