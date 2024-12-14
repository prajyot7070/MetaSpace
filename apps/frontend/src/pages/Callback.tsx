import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';

const Callback = () => {
  const { handleRedirectCallback, isLoading } = useAuth0();
  const navigate = useNavigate();

  navigate("/dashboard");

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return null;
};

export default Callback;
