import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  shops?: Array<{ id: string; name: string }>;
  selectedShopId?: string;
  onShopChange?: (shopId: string) => void;
  tabs?: Array<{ id: string; label: string }>;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export default function Header({
  title = 'Store Management',
  subtitle,
  shops = [],
  selectedShopId,
  onShopChange,
  tabs = [],
  activeTab,
  onTabChange,
}: HeaderProps) {
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  
  const selectedShop = shops.find(shop => shop.id === selectedShopId) || shops[0];

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Top Section: Title and Shop Selector */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>

        {/* Shop Dropdown */}
        {shops.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setIsShopDropdownOpen(!isShopDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="font-medium text-gray-900">{selectedShop?.name || 'Select Shop'}</span>
              <span className="text-xs text-gray-500">Outlets</span>
              <ChevronDown 
                size={16} 
                className={`text-gray-500 transition-transform ${isShopDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isShopDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsShopDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                  {shops.map((shop) => (
                    <button
                      key={shop.id}
                      onClick={() => {
                        if (onShopChange) {
                          onShopChange(shop.id);
                        }
                        setIsShopDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${
                        selectedShopId === shop.id ? 'bg-gray-50 text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {shop.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs Section */}
      {tabs.length > 0 && (
        <div className="px-6 border-t border-gray-100">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange && onTabChange(tab.id)}
                  className={`px-4 py-3 text-sm font-semibold transition-all duration-200 border-b-2 ${
                    isActive
                      ? 'text-blue-600 border-blue-600'
                      : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

