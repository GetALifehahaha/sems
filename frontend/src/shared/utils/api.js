export const getApiBaseUrl = () => {
    return import.meta.env.VITE_API_URL || "http://localhost:8000";
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

export const fetchJson = async (path, { signal, query } = {}) => {
    const response = await fetch(buildUrl(path, query), { signal });

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
};

export const patchJson = async (path, body, { signal } = {}) => {
    const response = await fetch(buildUrl(path), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
};

const PREFERENCES_PATH = "/electrical/preferences/";

export const getPreferences = (signal) =>
    fetchJson(PREFERENCES_PATH, { signal });

export const updatePreferences = (body, signal) =>
    patchJson(PREFERENCES_PATH, body, { signal });
