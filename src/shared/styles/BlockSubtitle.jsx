import React from 'react'
import { cn } from '../utils/cn'

const BlockSubtitle = ({children, className=""}) => {
  return (
    <h5 className={cn('text-text/50 text-[14px] font-medium', className)}>
        {children}
    </h5>
  )
}

export default BlockSubtitle