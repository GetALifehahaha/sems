import React from 'react';
import { PhilippinePeso } from 'lucide-react'

const PaymentBlock = ({ kwh = 0, rate = 0 }) => {
    const totalPayment = (parseFloat(kwh) * parseFloat(rate)).toFixed(2)

    return (
        <div className='p-10'>
            <div>
                <div className='w-full flex gap-5 items-center justify-between'>
                    <div className='rounded-full aspect-square p-4 border border-background bg-white shadow-xl flex justify-center items-center'>
                        {/* <span className='text-white text-2xl font-bold font-urbanist'>₱</span> */}
                        <PhilippinePeso className='text-primary' />
                    </div>

                    <h5 className='text-sm text-text/50 font-semibold uppercase tracking-wide leading-tight'>
                        Estimated Consumption Payment
                    </h5>
                </div>

                <div className='flex flex-col gap-1 items-end w-full my-5 bg-primary p-15 justify-center rounded-xl relative'>
                    <div className='flex items-end'>
                        <PhilippinePeso className='text-white mb-3 mr-1' size={30} />
                        <h2 className='text-7xl font-bold text-white'>
                            {/* <span className='text-white text-5xl font-bold font-urbanist'>₱ </span> */
                            }
                            {totalPayment}
                        </h2>
                    </div>
                    <p className='text-sm text-white/50 font-medium absolute bottom-5'>
                        {kwh} kWh x ₱{rate} = ₱{totalPayment}
                    </p>
                </div>
            </div>

            <div>
                <p className='text-text/50 text-sm text-right tracking-wide leading-relaxed italic'>*Based on the calculated kWh consumption data from SEMS and local electrical ratings (i.e., Zamcelco)</p>
            </div>
        </div>
    )
}

export default PaymentBlock