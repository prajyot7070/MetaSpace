import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import PhaserGame from './components/PhaserGame'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
      <PhaserGame />
      </div>
   </>
  )
}

export default App
