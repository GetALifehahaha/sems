import React, { useState, useEffect } from "react";
import {
	Button,
	Header,
	PageTitle,
	Footer,
	BodyText,
	BlockTitle,
	BlockSubtitle,
} from "../../../shared";
import Style from "../styles/Style";
import { MeterDataBlock, EnergyChart, PaymentBlock } from "../";
import { cn } from '../../../shared/utils/cn'
import { capitalize } from '../../../shared/utils/capitalize.js'
import { Smartphone, Zap } from 'lucide-react'

const Dashboard = () => {
	const [frequency, setFrequency] = useState("daily");

	// State to hold live data from Django
	const [liveData, setLiveData] = useState({
		voltage: 0,
		power: 0,
		current: 0,
		kwh_consumption: 0
	});

	useEffect(() => {
		const fetchLatestData = async () => {
			try {
				// Uses the environment variable from your .env file
				const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
				const response = await fetch(`${apiUrl}/electrical/readings-latest/`);
				if (response.ok) {
					const data = await response.json();
					setLiveData({
						voltage: parseFloat(data.voltage).toFixed(1),
						power: parseFloat(data.power).toFixed(1),
						current: parseFloat(data.current).toFixed(3),
						kwh_consumption: parseFloat(data.kwh_consumption).toFixed(2)
					});
				}
			} catch (error) {
				console.error("Error fetching live data:", error);
			}
		};

		fetchLatestData(); // Fetch immediately on load
		const intervalId = setInterval(fetchLatestData, 3000); // Poll every 3 seconds

		return () => clearInterval(intervalId); // Cleanup on unmount
	}, []);

	const handleFrequency = (value) => {
		if (value == frequency) { setFrequency('daily'); return; }
		setFrequency(value);
	}

	return (
		<div className='p-6 flex flex-col mb-8'>
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
							<MeterDataBlock label="V" labelText="Voltage" data={liveData.voltage} unit="V" />
							<MeterDataBlock label="P" labelText="Power" data={liveData.power} unit="W" />
							<MeterDataBlock label="C" labelText="Current" data={liveData.current} unit="A" />
						</div>

						{/* The Count */}
						<div className='flex flex-col flex-1 bg-white rounded-2xl shadow-2xl p-4 items-start'>
							{/* Upper Portion */}
							<div className="flex w-full justify-between items-center">
								{/* Icon */}
								<div className='rounded-full aspect-square p-4 border border-background bg-white shadow-xl flex justify-center items-center'>
									<Zap className="text-primary" />
								</div>

								<h5 className='text-sm text-text/50 font-semibold uppercase tracking-wide leading-tight'>
									Estimated Energy Consumption
								</h5>
							</div>

							{/* Middle: The Numbers */}
							<div className="p-4 rounded-xl bg-linear-120 from-primary to-secondary shadow-xl h-24 min-w-1/2 ml-auto flex flex-row gap-2 items-end justify-end">
								<div className='w-1 h-full rounded-4xl bg-white mr-auto'>
								</div>
								<h1 className='text-6xl text-white font-bold'>
									{liveData.kwh_consumption}
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
						<PaymentBlock kwh={liveData.kwh_consumption} rate={12} />
					</div>
					<div className='flex-1/2'>
					</div>
				</div>
			</div>

			<div className="h-8"></div>
		</div>
	)
}

export default Dashboard