import React from 'react'
import {Button} from '../../../shared'

const FrequencyButton = () => {
  return (
    <div className='flex gap-2'>
        <Button text="Daily"/>
        <Button text="Weekly"/>
        <Button text="Monthly"/>
    </div>
  )
}

export default FrequencyButton