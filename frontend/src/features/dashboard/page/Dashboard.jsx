import React from 'react'
import {Header, PageTitle} from '../../../shared'

const Dashboard = () => {
  return (
    <div className='p-6 flex flex-col'>
      <Header />
      <PageTitle className="my-8">
        Welcome, ABC User
      </PageTitle>
    </div>
  )
}

export default Dashboard