import React from "react";
import { cn } from "../utils/cn";

const Button = ({
    className,
    icon = null,
    text = "",
    children,
    onClick,
    type = "button",
    disabled = false,
    ariaPressed,
}) => {
    return (
        <button
            type={type}
            disabled={disabled}
            aria-pressed={ariaPressed}
            onClick={onClick}
            className={cn(
                "text-text py-2 px-4.5 rounded-2xl bg-block cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60",
                className,
            )}
        >
            {icon}
            {children ?? text}
        </button>
    );
};

export default Button;
