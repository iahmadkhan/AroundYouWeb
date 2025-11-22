import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { useLocationSelection } from '../../../src/context/LocationContext';
import { useUserLocation } from '../../../src/hooks/consumer/useUserLocation';

export default function SearchScreen() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { selectedAddress } = useLocationSelection();
  const { placeLabel, loading: locationLoading } = useUserLocation();

  // Get query from navigation state if available
  useEffect(() => {
    if (location.state?.query) {
      setQuery(location.state.query);
    }
  }, [location.state]);

  return (
    <div className="w-full">
      {/* Header with Location and Actions */}
      <Header
        onFavPress={() => navigate('/favorites')}
        onCartPress={() => navigate('/cart')}
        onLocationPress={() => navigate('/addresssearch')}
        locationLabel={
          selectedAddress?.label ||
          (locationLoading ? 'Fetching your location…' : (placeLabel || 'Select your address'))
        }
      />

      {/* Search Section */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">Search</h1>
          <p className="text-gray-500 text-sm sm:text-base md:text-lg">Find shops, items, and products</p>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <div className="flex flex-row items-center bg-gray-50 rounded-lg sm:rounded-xl px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all duration-200 shadow-sm hover:shadow-md">
            <span className="text-gray-400 text-lg sm:text-xl mr-2 sm:mr-3 flex-shrink-0">🔍</span>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, shops…"
              className="flex-1 text-gray-800 text-sm sm:text-base bg-transparent border-none outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="ml-3 text-gray-400 hover:text-gray-600 transition-colors text-lg"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Results Placeholder */}
          {query && (
            <div className="mt-8 text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                <span className="text-4xl">🔍</span>
              </div>
              <p className="text-gray-500 text-lg">
                Search results for "<span className="font-semibold text-gray-900">{query}</span>" will appear here
              </p>
            </div>
          )}

          {/* Empty State */}
          {!query && (
            <div className="mt-8 text-center py-12">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-6">
                <span className="text-5xl">🔍</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Start searching</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Type in the search bar above to find shops and products
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

