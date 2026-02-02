import React from 'react'
import {Dashboard} from './features/dashboard'
import { BrowserRouter, Routes, Route} from 'react-router-dom'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App