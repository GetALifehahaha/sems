import React from 'react'
import { allCaps } from '../../../shared/utils/allCaps'

const MeterDataBlock = ({label, labelText, data}) => {
	return (
		<div className='flex flex-1 bg-white rounded-2xl p-2.5 shadow-2xl'>
				<h5 className='flex aspect-square h-full justify-center items-center text-lg font-extrabold bg-primary rounded-xl text-block'>
					{label}
				</h5>
				<div className='flex flex-col ml-auto p-1'>
					<h5 className='flex-1 ml-auto self-center text-xs font-semibold text-text/50'>
						{allCaps(labelText)}
					</h5>
					<h5 className='flex-1 text-right self-center text-2xl font-semibold text-secondary'>
						{data} {label}
					</h5>
				</div>
			</div>
	)
}

export default MeterDataBlock