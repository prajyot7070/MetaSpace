import './App.css'

// App.tsx
import { Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { Dashboard } from "./pages/Dashboard";
import Callback from './pages/Callback';
const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/callback" element={<Callback />} />
    </Routes>
  );
};

export default App;

