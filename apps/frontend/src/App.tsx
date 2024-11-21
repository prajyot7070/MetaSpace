import './App.css'
import { Dashboard } from './pages/dashboard'
import { Home } from './pages/home'
import {BrowserRouter, Route, Routes} from 'react-router-dom'

function App() {

  return (
    <>
    <BrowserRouter>
    <Routes>
      <Route path='/dashboard' element={<Dashboard />} />
      <Route path='/' element={<Home />} />
    </Routes>
    </BrowserRouter>
   </>
  )
}

export default App
