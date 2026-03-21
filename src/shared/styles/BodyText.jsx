import React from 'react'
import { cn } from '../utils/cn'

const BodyText = ({children, className}) => {
  return (
    <h5 className={cn('', className)}>
        {children}
    </h5>
  )
}

export default BodyText