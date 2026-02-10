import { createContext, useContext, useId } from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/shared/utils/cn";

const THEMES = { light: "", dark: ".dark" };

const ChartContext = createContext(null);

function useChart() {
    const context = useContext(ChartContext);
    if (!context) {
        throw new Error("useChart must be used within a <ChartContainer />");
    }
    return context;
}

const ChartContainer = ({ id, className, children, config, ref, ...props }) => {
    const uniqueId = useId();
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-chart={chartId}
                ref={ref}
                className={cn(
                    "flex aspect-video justify-center text-xs",
                    "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
                    "[&_.recharts-cartesian-grid_line]:stroke-border/50",
                    "[&_.recharts-layer]:outline-none",
                    "[&_.recharts-surface]:outline-none",
                    className,
                )}
                {...props}
            >
                <ChartStyle id={chartId} config={config} />
                <RechartsPrimitive.ResponsiveContainer>
                    {children}
                </RechartsPrimitive.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
};
ChartContainer.displayName = "ChartContainer";

const ChartStyle = ({ id, config }) => {
    const colorConfig = Object.entries(config).filter(([, cfg]) => cfg.color);

    if (!colorConfig.length) return null;

    return (
        <style
            dangerouslySetInnerHTML={{
                __html: Object.entries(THEMES)
                    .map(
                        ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig.map(([key, cfg]) => `  --color-${key}: ${cfg.color};`).join("\n")}
}`,
                    )
                    .join("\n"),
            }}
        />
    );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = ({
    active,
    payload,
    className,
    hideLabel = false,
    ref,
}) => {
    const { config } = useChart();

    if (!active || !payload?.length) return null;

    return (
        <div
            ref={ref}
            className={cn(
                "grid min-w-32 gap-1.5 rounded-lg border border-border/50",
                "bg-background px-2.5 py-1.5 text-xs shadow-xl",
                className,
            )}
        >
            {payload.map((item, index) => {
                const key = item.dataKey || "value";
                const label = config[key]?.label || item.name;

                return (
                    <div
                        key={index}
                        className="flex items-center justify-between gap-4"
                    >
                        <div className="flex items-center gap-2">
                            {/* Color dot indicator */}
                            <div
                                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                style={{ backgroundColor: item.color }}
                            />
                            {!hideLabel && (
                                <span className="text-muted-foreground">
                                    {label}
                                </span>
                            )}
                        </div>
                        {/* Value display */}
                        <span className="font-mono font-medium">
                            {item.value?.toLocaleString()}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
ChartTooltipContent.displayName = "ChartTooltipContent";

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartStyle };
