import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const Callback = () => {
  const { isLoading, user, isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      const addUserToDB = async () => {
        const response = await fetch('http://localhost:3000/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
          }),
        });

        const data = await response.json();
        console.log(data);
      };

      addUserToDB();
    }
  }, [isAuthenticated, user]);

  navigate("/dashboard");

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return null;
};

export default Callback;
