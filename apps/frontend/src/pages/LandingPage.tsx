
// pages/LandingPage.tsx
import { useAuth0 } from "@auth0/auth0-react";

export const LandingPage = () => {
  const { loginWithRedirect } = useAuth0();

  const handleLogin = () => {
    loginWithRedirect();
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Welcome to My App</h1>
      <p>Please login to access the dashboard.</p>
      <button onClick={handleLogin}>Login</button>
    </div>
  );
};

