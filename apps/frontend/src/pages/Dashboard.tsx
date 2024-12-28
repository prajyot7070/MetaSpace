import React, { useState, useEffect } from 'react';
import { useAuth0 } from "@auth0/auth0-react";

interface Space {
  id: string;
  name: string;
  width: number;
  height?: number;
  thumbnail?: string;
  creatorId: string;
}

interface CreateSpaceForm {
  name: string;
  width: number;
  height?: number;
}

const API_BASE_URL = 'http://localhost:3000/api/v1/space'; 

export const Dashboard = () => {
  const { user, logout, isAuthenticated } = useAuth0();
  const [spaceId, setSpaceId] = useState("");
  const [mySpaces, setMySpaces] = useState<Space[]>([]);
  const [accessibleSpaces, setAccessibleSpaces] = useState<Space[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createSpaceForm, setCreateSpaceForm] = useState<CreateSpaceForm>({
    name: "",
    width: 800,
    height: 600
  });

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/create-space`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...createSpaceForm,
          creatorId: user?.sub
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      const newSpace = await response.json();
      setMySpaces([...mySpaces, newSpace.space]);
      setSuccess("Space created successfully!");
      setCreateSpaceForm({ name: "", width: 800, height: 600 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create space');
    }
  };

  const handleJoinSpace = async () => {
    try {
      if (!spaceId) {
        setError("Please enter a space ID");
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/${user?.sub}/${spaceId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      
      setSuccess("Successfully joined space!");
      setSpaceId("");
      // Refresh spaces after joining
      fetchSpaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join space');
    }
  };

  const handleDeleteSpace = async (spaceId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${user?.sub}/${spaceId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      
      setMySpaces(mySpaces.filter(space => space.id !== spaceId));
      setSuccess("Space deleted successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete space');
    }
  };

  const fetchSpaces = async () => {
    try {
      if (!user?.sub) return;

      // Fetch spaces created by user
      const mySpacesResponse = await fetch(`${API_BASE_URL}/${user.sub}/created-spaces`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!mySpacesResponse.ok) throw new Error('Failed to fetch my spaces');
      const mySpacesData = await mySpacesResponse.json();
      setMySpaces(mySpacesData.spaces || []);

      // Fetch spaces user has access to
      const accessibleSpacesResponse = await fetch(`${API_BASE_URL}/${user.sub}/accessible-spaces`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!accessibleSpacesResponse.ok) throw new Error('Failed to fetch accessible spaces');
      const accessibleSpacesData = await accessibleSpacesResponse.json();
      setAccessibleSpaces(accessibleSpacesData.spaces || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch spaces');
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.sub) {
      fetchSpaces();
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return <p className="text-center mt-8">Loading...</p>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-700 rounded-full flex items-center justify-center text-white text-xl">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
        </div>
        <button 
          onClick={handleLogout}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Create Space Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Create a Space</h2>
        <form onSubmit={handleCreateSpace} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Space Name"
              value={createSpaceForm.name}
              onChange={(e) => setCreateSpaceForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex gap-4">
            <input
              type="number"
              placeholder="Width"
              value={createSpaceForm.width}
              onChange={(e) => setCreateSpaceForm(prev => ({ ...prev, width: parseInt(e.target.value) }))}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              placeholder="Height"
              value={createSpaceForm.height}
              onChange={(e) => setCreateSpaceForm(prev => ({ ...prev, height: parseInt(e.target.value) }))}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create Space
          </button>
        </form>
      </div>

      {/* Join Space Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Join a Space</h2>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Enter Space ID"
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleJoinSpace}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Join Space
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      {/* My Spaces Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">My Spaces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mySpaces.map((space) => (
            <div 
              key={space.id} 
              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{space.name}</h3>
                  <p className="text-sm text-gray-500">ID: {space.id}</p>
                </div>
                <button 
                  onClick={() => handleDeleteSpace(space.id)}
                  className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accessible Spaces Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Accessible Spaces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accessibleSpaces.map((space) => (
            <div 
              key={space.id} 
              className="bg-gray-50 rounded-lg p-4 border border-gray-200"
            >
              <h3 className="font-medium">{space.name}</h3>
              <p className="text-sm text-gray-500">ID: {space.id}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
