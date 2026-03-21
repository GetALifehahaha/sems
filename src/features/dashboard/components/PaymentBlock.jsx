import React from "react";
import { PhilippinePeso } from "lucide-react";

const PaymentBlock = ({ kwh = 0, rate = 0, isLoading = false }) => {
    const safeKwh = Number(kwh) || 0;
    const safeRate = Number(rate) || 0;
    const totalPayment = (safeKwh * safeRate).toFixed(2);

    return (
        <div className="p-4 md:p-8">
            <div>
                <div className="w-full flex gap-5 items-center justify-between">
                    <div className="rounded-full aspect-square p-4 border border-background bg-white shadow-xl flex justify-center items-center">
                        <PhilippinePeso className="text-primary" />
                    </div>

                    <h5 className="text-sm text-text/50 font-semibold uppercase tracking-wide leading-tight">
                        Estimated Consumption Payment
                    </h5>
                </div>

                <div className="flex flex-col gap-1 items-end w-full my-5 bg-primary p-6 md:p-10 justify-center rounded-xl relative min-h-40">
                    <div className="flex items-end">
                        <PhilippinePeso
                            className="text-white mb-2 mr-1"
                            size={28}
                        />
                        <h2 className="text-5xl md:text-7xl font-bold text-white leading-none">
                            {isLoading ? "--" : totalPayment}
                        </h2>
                    </div>
                    <p className="text-xs md:text-sm text-primary-foreground/85 font-medium absolute bottom-4">
                        {isLoading
                            ? "Refreshing payment estimate..."
                            : `${safeKwh.toFixed(2)} kWh x ₱${safeRate.toFixed(2)} = ₱${totalPayment}`}
                    </p>
                </div>
            </div>

            <div>
                <p className="text-text/70 text-xs md:text-sm text-right tracking-wide leading-relaxed italic">
                    Based on calculated kWh consumption data from SEMS and local
                    electrical rates.
                </p>
            </div>
        </div>
    );
};

export default PaymentBlock;
