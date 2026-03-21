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
