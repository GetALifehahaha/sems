import React from 'react'

const MeterDataBlock = ({label, data}) => {
	return (
		<div className='flex flex-1 bg-white rounded-md p-2 '>
				<h5 className='flex h-fit px-2.5 py-0.5 justify-center items-center text-md font-semibold bg-primary rounded-sm text-block'>
					{label}
				</h5>
				<h5 className='flex-1 text-right self-center text-xl font-semibold'>
					{data}
				</h5>
			</div>
	)
}

export default MeterDataBlock