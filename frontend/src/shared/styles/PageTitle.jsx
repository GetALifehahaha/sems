import React from 'react'
import { cn } from '../utils/cn'

const PageTitle = ({children, className}) => {
  return (
    <h1 className={cn('text-primary text-[20px] font-medium', className)}>
        {children}
    </h1>
  )
}

export default PageTitle