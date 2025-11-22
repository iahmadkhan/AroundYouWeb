import React from 'react';
import FavoriteIcon from '../../../src/icons/FavoriteIcon';
import CartIcon from '../../../src/icons/CartIcon';

interface HeaderProps {
  onFavPress?: () => void;
  onCartPress?: () => void;
  onLocationPress?: () => void;
  locationLabel?: string;
}

export default function Header({
  onFavPress,
  onCartPress,
  onLocationPress,
  locationLabel,
}: HeaderProps) {
  return (
    <div className="w-full mb-6">
      <div className="flex flex-row items-center justify-between gap-4">
        {/* Location Selector */}
        <button
          onClick={onLocationPress}
          className="flex-1 flex items-center bg-white rounded-lg px-4 py-3 shadow-sm hover:shadow-md transition-all border border-gray-200 hover:border-blue-300"
        >
          <span className="text-lg mr-2">📍</span>
          <span className="flex-1 text-gray-800 text-sm font-medium truncate text-left">
            {locationLabel || 'Select your address'}
          </span>
          <span className="ml-2 text-gray-500 text-sm">▾</span>
        </button>

        {/* Action Buttons */}
        <div className="flex flex-row items-center gap-2">
          <button
            onClick={onFavPress}
            className="w-12 h-12 rounded-lg bg-white shadow-sm flex items-center justify-center hover:shadow-md transition-all border border-gray-200 hover:border-blue-300"
            title="Favorites"
          >
            <FavoriteIcon size={20} color="#3b82f6" />
          </button>
          <button
            onClick={onCartPress}
            className="w-12 h-12 rounded-lg bg-white shadow-sm flex items-center justify-center hover:shadow-md transition-all border border-gray-200 hover:border-blue-300"
            title="Cart"
          >
            <CartIcon size={20} color="#3b82f6" />
          </button>
        </div>
      </div>
    </div>
  );
}

