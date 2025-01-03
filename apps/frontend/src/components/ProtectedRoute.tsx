
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

interface ProtectedRouteProps {
  children: JSX.Element;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (isLoading) {
    return <div>Loading...</div>; // Show a loading state while Auth0 checks authentication
  }

  if (!isAuthenticated) {
    loginWithRedirect(); // Redirect user to login if not authenticated
    return null; // Don't render anything while redirecting
  }

  return children; // Render the protected component
};

export default ProtectedRoute;
