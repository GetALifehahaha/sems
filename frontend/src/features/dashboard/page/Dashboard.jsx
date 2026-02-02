import React, {useState} from 'react'
import {Button, Header, PageTitle} from '../../../shared'
import FrequencyButton from '../component/FrequencyButton'

const Dashboard = () => {

  const [frequency, setFrequency] = useState('daily')

  const handleFrequency = (value) => {
    if (value == frequency) {setFrequency('daily'); return;}
      
    setFrequency(value);
  }

  return (
    <div className='p-6 flex flex-col'>
      <Header />
      <PageTitle className="my-8 ml-8">
        Welcome, ABC User
      </PageTitle>
      
      <div className='flex gap-2'>
          <Button text="Daily" className={`pr-18 ${frequency === "daily" && 'bg-primary text-white'}`} onClick={() => handleFrequency('daily')}/>
          <Button text="Weekly" className={`pr-18 ${frequency === "weekly" && 'bg-primary text-white'}`} onClick={() => handleFrequency('weekly')}/>
          <Button text="Monthly" className={`pr-18 ${frequency === "monthly" && 'bg-primary text-white'}`} onClick={() => handleFrequency('monthly')}/>
      </div>
    </div>
  )
}

export default Dashboard