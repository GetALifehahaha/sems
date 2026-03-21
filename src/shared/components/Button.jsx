import React from 'react'
import { cn } from '../utils/cn'

const Button = ({className, icon=null, text="", onClick}) => {
  return (
    <button onClick={onClick} className={cn('text-text py-2 px-4.5 rounded-2xl bg-block cursor-pointer', className)}>
      {text.length > 1 && text}
    </button>
  )
}

export default Button