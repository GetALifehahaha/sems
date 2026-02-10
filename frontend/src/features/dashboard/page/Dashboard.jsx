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
import { MeterDataBlock, EnergyChart, PaymentBlock } from "../";
import { cn } from '../../../shared/utils/cn'
import { capitalize } from '../../../shared/utils/capitalize.js'
import Style from '../styles/Style'
import { SampleData } from '../data/SampleData.js'
import { MeterDataBlock } from '../'
import { Smartphone, Zap } from 'lucide-react'

const Dashboard = () => {
    const [frequency, setFrequency] = useState("daily");

    const handleFrequency = (value) => {
        if (value == frequency) {
            setFrequency("daily");
            return;
        }

	const handleFrequency = (value) => {
		if (value == frequency) { setFrequency('daily'); return; }

		setFrequency(value);
	}

	return (
		<div className='p-6 flex flex-col'>
			<Header />

			{/* Frequency Toggle */}
			<div className='flex gap-2 bg-white p-1 rounded-md w-fit'>
				<Button text="Daily" className={`font-semibold text-text/50 text-sm rounded-sm py-1 ${frequency === "daily" && 'bg-primary text-white rounded-r-full'}`} onClick={() => handleFrequency('daily')} />
				<Button text="Weekly" className={`font-semibold text-text/50 text-sm rounded-sm py-1 ${frequency === "weekly" && 'bg-primary text-white rounded-full'}`} onClick={() => handleFrequency('weekly')} />
				<Button text="Monthly" className={`font-semibold text-text/50 text-sm rounded-sm py-1 ${frequency === "monthly" && 'bg-primary text-white rounded-l-full'}`} onClick={() => handleFrequency('monthly')} />
			</div>

			{/* Main Layout */}
			<div className='flex flex-col md:flex-row gap-8 mt-8 h-320 md:h-160'>
				<div className="flex flex-col gap-8 flex-1">
					<div className="basis-1/3 flex flex-row gap-4">
						{/* Three Musketeers */}
						<div className='basis-1/3 flex flex-col gap-4'>
							<MeterDataBlock label="V" labelText="Voltage" data={SampleData.voltage} />
							<MeterDataBlock label="P" labelText="Power" data={SampleData.power} />
							<MeterDataBlock label="C" labelText="Current" data={SampleData.current} />
						</div>

						{/* The Count */}
						<div className='flex flex-col flex-1 bg-white rounded-2xl shadow-2xl p-4 items-start'>
							{/* Upper Portion */}
							<div className="flex w-full justify-between items-center">
								{/* Icon */}
								<div className='rounded-full aspect-square p-4 border border-background bg-white shadow-xl flex justify-center items-center'>
									<Zap className="text-primary" />
								</div>


							</div>

							{/* Middle: The Numbers */}
							<div className="p-4 rounded-xl bg-linear-120 from-primary to-secondary shadow-xl h-24 min-w-1/2 ml-auto flex flex-row gap-2 items-end justify-end">
								<div className='w-1 h-full rounded-4xl bg-white mr-auto'>
								</div>
								<h1 className='text-6xl text-white font-bold'>
									{SampleData.kWh}
								</h1>
								<h5 className='text-sm text-white/75 font-semibold mb-1'>
									kwh
								</h5>
							</div>

							{/* Bottom Portion */}
							<div className="ml-auto mt-auto">
								<h5 className='text-xs font-medium text-text/25'>*Based on the estimated power consumption data measured by SEMS</h5>
							</div>
						</div>
					</div>
					<div className="flex-1 bg-white rounded-2xl shadow-2xl">
              <EnergyChart frequency={frequency} />
					</div>
				</div>
				<div className="flex-1 bg-white rounded-2xl flex flex-col p-4 shadow-2xl">
					<div className='flex-1/2 border-b-2 border-b-text/25'>
						<PaymentBlock kwh={SampleData.kWh} rate={12} />
					</div>
					<div className='flex-1/2'>

					</div>
				</div>
			</div>
		</div>
	)
}

export default Dashboard
