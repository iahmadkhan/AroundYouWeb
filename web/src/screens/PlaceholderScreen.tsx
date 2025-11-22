import React from 'react';
import { useNavigate } from 'react-router-dom';

interface PlaceholderScreenProps {
  title?: string;
  message?: string;
}

export default function PlaceholderScreen({ 
  title = 'Coming Soon', 
  message = 'This screen is not yet available on web.' 
}: PlaceholderScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="flex-1 bg-gray-50 min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
        <div className="text-6xl mb-4">🚧</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <button
          onClick={() => navigate(-1)}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

