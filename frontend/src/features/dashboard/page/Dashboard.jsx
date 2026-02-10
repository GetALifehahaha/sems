import React, { useState } from "react";
import {
    Button,
    Header,
    PageTitle,
    Footer,
    BodyText,
    BlockTitle,
    BlockSubtitle,
} from "../../../shared";
import { cn } from "../../../shared/utils/cn";
import { capitalize } from "../../../shared/utils/capitalize.js";
import Style from "../styles/Style";
// import SampleData from '../data/SampleData.js'
import { MeterDataBlock, EnergyChart } from "../";

const Dashboard = () => {
    const [frequency, setFrequency] = useState("daily");

    const handleFrequency = (value) => {
        if (value == frequency) {
            setFrequency("daily");
            return;
        }

        setFrequency(value);
    };

    return (
        <div className="p-6 flex flex-col">
            <Header />

            <div className="flex gap-2 bg-background border-4 border-white p-1 rounded-md w-fit">
                <Button
                    text="Daily"
                    className={`font-semibold text-text/50 text-sm rounded-sm py-1 bg-background ${frequency === "daily" && "bg-primary text-white"}`}
                    onClick={() => handleFrequency("daily")}
                />
                <Button
                    text="Weekly"
                    className={`font-semibold text-text/50 text-sm rounded-sm py-1 bg-background ${frequency === "weekly" && "bg-primary text-white"}`}
                    onClick={() => handleFrequency("weekly")}
                />
                <Button
                    text="Monthly"
                    className={`font-semibold text-text/50 text-sm rounded-sm py-1 bg-background ${frequency === "monthly" && "bg-primary text-white"}`}
                    onClick={() => handleFrequency("monthly")}
                />
            </div>

            {/* Main Layout */}
            <div className="flex flex-col md:flex-row gap-8 mt-8 h-320 md:h-160">
                <div className="flex flex-col gap-8 flex-1">
                    <div className="basis-1/3 flex flex-row gap-4">
                        <div className="basis-1/3 flex flex-col gap-4">
                            <MeterDataBlock label="Voltage" data={220} />
                            <MeterDataBlock label="Power" data={10} />
                            <MeterDataBlock label="Current" data={0.045} />
                        </div>
                        <div className="flex flex-1 bg-white rounded-md"></div>
                    </div>
                    <div className="flex-1 bg-white rounded-md p-4">
                        <EnergyChart frequency={frequency} />
                    </div>
                </div>
                <div className="flex-1 bg-white rounded-md flex flex-col p-4">
                    <div className="flex-1/2 border-b-2 border-b-text/25"></div>
                    <div className="flex-1/2"></div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
