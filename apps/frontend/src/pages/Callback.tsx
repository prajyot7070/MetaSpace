
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const Callback = () => {
  const { isLoading, user, isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    const saveUserToDatabase = async () => {
      if (isAuthenticated && user) {
        try {
          const response = await fetch('http://localhost:3000/api/v1/user/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: user.sub, // Auth0 unique identifier
              username: user.given_name || user.name,
              profilePicture: user.picture,
              email: user.email,
              role: 'User',
            }),
            credentials: 'include', // Include cookies if needed
          });
          navigate('/dashboard');
          if (!response.ok) {
            throw new Error('Failed to send user data to backend');
          }
        }  catch (error) {
          console.error('Error sending user data:', error);
        }
      }
    };

    saveUserToDatabase();
  }, [isAuthenticated, user, navigate]); // Dependency array includes `navigate`

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return null;
};

export default Callback;

