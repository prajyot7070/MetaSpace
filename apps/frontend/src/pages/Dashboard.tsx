
// pages/Dashboard.tsx
import { useAuth0 } from "@auth0/auth0-react";

export const Dashboard = () => {
  const { user, logout, isAuthenticated } = useAuth0();

  const handleLogout = () => {
    logout({ returnTo: window.location.origin }); // Redirect after logout
  };

  if (!isAuthenticated) {
    return <p>Loading...</p>;
  }

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Dashboard</h1>
      <div>
        <h2>Welcome, {user?.name}</h2>
        <img src={user?.picture} alt={user?.name} style={{ borderRadius: "50%" }} />
      </div>
      <button onClick={handleLogout} style={{ marginTop: "20px" }}>
        Logout
      </button>
    </div>
  );
};

