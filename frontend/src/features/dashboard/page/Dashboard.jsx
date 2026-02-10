import React, { useState } from 'react'
import {
	Button,
	Header,
	PageTitle,
	Footer,
	BodyText,
	BlockTitle,
	BlockSubtitle
} from '../../../shared'
import { cn } from '../../../shared/utils/cn'
import { capitalize } from '../../../shared/utils/capitalize.js'
import Style from '../styles/Style'
import { SampleData } from '../data/SampleData.js'
import { MeterDataBlock, PaymentBlock } from '../'
import { Zap } from 'lucide-react'
const Dashboard = () => {

	const [frequency, setFrequency] = useState('daily')

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
							<MeterDataBlock label="V" labelText="Voltage" data={220} />
							<MeterDataBlock label="P" labelText="Power" data={10} />
							<MeterDataBlock label="C" labelText="Current" data={0.045} />
						</div>

						{/* The Count */}
						<div className='flex flex-1 bg-white rounded-2xl shadow-2xl p-4'>
							{/* Upper Portion */}
							<div className="">
								{/* Icon */}
								<div className='rounded-full aspect-square p-4 border border-background bg-white shadow-xl flex justify-center items-center'>
									<Zap className="text-primary" />
								</div>


							</div>

							{/* Middle: The Numbers */}
							<div className=""></div>

							{/* Bottom Portion */}
							<div className=""></div>
						</div>
					</div>
					<div className="flex-1 bg-white rounded-2xl shadow-2xl">

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
