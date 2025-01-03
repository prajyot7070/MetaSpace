import './App.css'

// App.tsx
import { Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { Dashboard } from "./pages/Dashboard";
import Callback from './pages/Callback';
import { Areana } from './pages/Areana';
//import ProtectedRoute from './components/ProtectedRoute';
const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/callback" element={<Callback />} />
      <Route path="/arena/:spaceId" element={<Areana /> } />
    </Routes>
  );
};

export default App;

