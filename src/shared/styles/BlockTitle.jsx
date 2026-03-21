import React from 'react'
import { cn } from '../utils/cn'

const BlockTitle = ({children, className=""}) => {
  return (
    <h1 className={cn('text-secondary text-[20px] font-bold', className)}>
        {children}
    </h1>
  )
}

export default BlockTitle