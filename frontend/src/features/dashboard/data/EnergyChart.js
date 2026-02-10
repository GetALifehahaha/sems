export const DATA_CONFIG = {
    PERIOD_COUNT: 7,
    RANGES: {
        daily: { min: 15, max: 45 },
        weekly: { min: 150, max: 250 },
        monthly: { min: 400, max: 700 },
    },
    THRESHOLDS: {
        daily: 35,
        weekly: 200,
        monthly: 550,
    },
};

export const PESO_PER_KWH = 10.12;

export const calculatePayment = (kWh) => {
    return (kWh * PESO_PER_KWH).toFixed(2);
};

export const isHighConsumption = (value, frequency) => {
    return value > DATA_CONFIG.THRESHOLDS[frequency];
};

export const formatDate = (date, options) => {
    return date.toLocaleDateString("en-US", options);
};

export const generateConsumption = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const getSubtitle = (frequency) => {
    const subtitles = {
        daily: "Last 7 Days",
        weekly: "Last 7 Weeks",
        monthly: "Last 7 Months",
    };
    return subtitles[frequency] || "";
};

export const chartConfig = {
    consumption: {
        label: "Energy Consumption",
        color: "hsl(var(--chart-1))",
    },
};

export const getEnergyChartData = (frequency) => {
    const today = new Date();
    const { PERIOD_COUNT, RANGES } = DATA_CONFIG;

    switch (frequency) {
        case "daily": {
            return Array.from({ length: PERIOD_COUNT }, (_, i) => {
                const date = new Date(today);
                date.setDate(date.getDate() - (PERIOD_COUNT - 1 - i));

                const day = formatDate(date, { weekday: "short" });
                const dateStr = formatDate(date, {
                    month: "short",
                    day: "numeric",
                });

                return {
                    time: `${day} ${dateStr}`,
                    consumption: generateConsumption(
                        RANGES.daily.min,
                        RANGES.daily.max,
                    ),
                };
            });
        }
        case "weekly": {
            return Array.from({ length: PERIOD_COUNT }, (_, i) => {
                const weekNum = PERIOD_COUNT - i;
                return {
                    time: `Week ${weekNum}`,
                    consumption: generateConsumption(
                        RANGES.weekly.min,
                        RANGES.weekly.max,
                    ),
                };
            });
        }
        case "monthly": {
            return Array.from({ length: PERIOD_COUNT }, (_, i) => {
                const date = new Date(today);
                date.setMonth(date.getMonth() - (PERIOD_COUNT - 1 - i));
                const month = formatDate(date, { month: "short" });

                return {
                    time: month,
                    consumption: generateConsumption(
                        RANGES.monthly.min,
                        RANGES.monthly.max,
                    ),
                };
            });
        }
        default:
            console.warn(
                `Unknown frequency: ${frequency}. Defaulting to empty data.`,
            );
            return [];
    }
};
