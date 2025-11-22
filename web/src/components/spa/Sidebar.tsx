import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Store,
  Phone,
  Globe,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  Truck,
  Boxes,
  List,
  FolderTree,
  FileText,
  User
} from 'lucide-react';

interface SidebarProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ 
  activeItem = 'store-management', 
  onItemClick,
  isCollapsed = false,
  onToggleCollapse 
}: SidebarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);

  // Auto-open inventory dropdown if a sub-item is active
  useEffect(() => {
    const isInventorySubItemActive = activeItem === 'all-items' || activeItem === 'categories' || activeItem === 'audit-log';
    if (isInventorySubItemActive) {
      setIsInventoryOpen(true);
    }
  }, [activeItem]);

  // Auto-open delivery dropdown if a sub-item is active
  useEffect(() => {
    const isDeliverySubItemActive = activeItem === 'delivery-areas' || activeItem === 'delivery-runners' || activeItem === 'delivery-logic' || activeItem === 'distance-tiering';
    if (isDeliverySubItemActive) {
      setIsDeliveryOpen(true);
    }
  }, [activeItem]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'shops', label: 'Shops', icon: Store },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'delivery', label: 'Delivery', icon: Truck },
    { id: 'help-center', label: 'Help Center', icon: HelpCircle },
  ];

  const settingsItems = [
    { id: 'contact-info', label: 'Contact Info', icon: Phone },
  ];

  const handleItemClick = (itemId: string) => {
    if (onItemClick) {
      onItemClick(itemId);
    }
  };

  const handleSettingsToggle = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const handleInventoryToggle = () => {
    setIsInventoryOpen(!isInventoryOpen);
  };

  const handleDeliveryToggle = () => {
    setIsDeliveryOpen(!isDeliveryOpen);
  };

  const inventorySubItems = [
    { id: 'all-items', label: 'All Items', icon: List },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'audit-log', label: 'Audit Log', icon: FileText },
  ];

  const deliverySubItems = [
    { id: 'delivery-areas', label: 'Delivery Areas', icon: Globe },
    { id: 'delivery-runners', label: 'Delivery Runners', icon: Truck },
    { id: 'delivery-logic', label: 'Delivery Logic', icon: Settings },
    { id: 'distance-tiering', label: 'Distance Tiering', icon: BarChart3 },
  ];

  return (
    <div className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-white to-gray-50 transition-all duration-300 ${
      isCollapsed ? 'w-20' : 'w-64'
    } z-40 flex flex-col border-r border-gray-200 shadow-lg`}>
      {/* Logo Section */}
      <div className="py-2 border-b border-gray-200 bg-white relative">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center flex-1">
              <div className="flex items-center justify-center w-full -m-2">
                <img 
                  src="/Applogo.svg" 
                  alt="AroundYou Logo" 
                  className="h-24 w-auto"
                />
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="flex items-center justify-center mx-auto w-full -m-2">
              <img 
                src="/iconblue.svg" 
                alt="AroundYou Icon" 
                className="h-12 w-12"
              />
            </div>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 absolute right-2 top-1/2 -translate-y-1/2"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight size={18} className="text-gray-600" />
              ) : (
                <ChevronLeft size={18} className="text-gray-600" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Menu Items */}
      <div className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isInventory = item.id === 'inventory';
            const isDelivery = item.id === 'delivery';
            const isActive = isInventory 
              ? (activeItem === 'inventory' || activeItem === 'all-items' || activeItem === 'categories' || activeItem === 'audit-log')
              : isDelivery
              ? (activeItem === 'delivery' || activeItem === 'delivery-areas' || activeItem === 'delivery-runners' || activeItem === 'delivery-logic' || activeItem === 'distance-tiering')
              : activeItem === item.id;
            
            // Special handling for inventory with dropdown
            if (isInventory && !isCollapsed) {
              return (
                <div key={item.id}>
                  <button
                    onClick={handleInventoryToggle}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-105 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-md border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                        isActive 
                          ? 'bg-blue-500 text-white shadow-sm' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Icon size={18} className="flex-shrink-0" />
                      </div>
                      <span className={`font-semibold text-sm ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                    </div>
                    {isInventoryOpen ? (
                      <ChevronUp size={18} className="text-gray-600" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-600" />
                    )}
                  </button>

                  {/* Inventory Dropdown */}
                  {isInventoryOpen && (
                    <div className="ml-4 mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      {inventorySubItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = activeItem === subItem.id;
                        
                        return (
                          <button
                            key={subItem.id}
                            onClick={() => {
                              handleItemClick(subItem.id);
                              // Keep dropdown open when clicking sub-items
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group hover:scale-105 ${
                              isSubActive
                                ? 'bg-gray-100 text-blue-600 shadow-sm'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <div className={`p-1 rounded-md transition-all duration-200 ${
                              isSubActive
                                ? 'bg-blue-100'
                                : 'bg-gray-100 group-hover:bg-gray-200'
                            }`}>
                              <SubIcon 
                                size={16} 
                                className={`flex-shrink-0 ${
                                  isSubActive
                                    ? 'text-blue-600'
                                    : 'text-gray-600'
                                }`} 
                              />
                            </div>
                            <span className={`text-sm font-medium whitespace-nowrap ${
                              isSubActive
                                ? 'text-blue-600'
                                : 'text-gray-700'
                            }`}>
                              {subItem.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            
            // Special handling for delivery with dropdown
            if (isDelivery && !isCollapsed) {
              return (
                <div key={item.id}>
                  <button
                    onClick={handleDeliveryToggle}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-105 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-md border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                        isActive 
                          ? 'bg-blue-500 text-white shadow-sm' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Icon size={18} className="flex-shrink-0" />
                      </div>
                      <span className={`font-semibold text-sm ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                    </div>
                    {isDeliveryOpen ? (
                      <ChevronUp size={18} className="text-gray-600" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-600" />
                    )}
                  </button>

                  {/* Delivery Dropdown */}
                  {isDeliveryOpen && (
                    <div className="ml-4 mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      {deliverySubItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = activeItem === subItem.id;
                        
                        return (
                          <button
                            key={subItem.id}
                            onClick={() => {
                              handleItemClick(subItem.id);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group hover:scale-105 ${
                              isSubActive
                                ? 'bg-gray-100 text-blue-600 shadow-sm'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <div className={`p-1 rounded-md transition-all duration-200 ${
                              isSubActive
                                ? 'bg-blue-100'
                                : 'bg-gray-100 group-hover:bg-gray-200'
                            }`}>
                              <SubIcon 
                                size={16} 
                                className={`flex-shrink-0 ${
                                  isSubActive
                                    ? 'text-blue-600'
                                    : 'text-gray-600'
                                }`} 
                              />
                            </div>
                            <span className={`text-sm font-medium whitespace-nowrap ${
                              isSubActive
                                ? 'text-blue-600'
                                : 'text-gray-700'
                            }`}>
                              {subItem.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Handle inventory when collapsed - just click through to all-items
            if (isInventory && isCollapsed) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick('all-items')}
                  className={`w-full flex items-center justify-center px-3 py-3 rounded-xl transition-all duration-200 group hover:scale-105 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-md border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm'
                  }`}
                  title="Inventory"
                >
                  <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-500 text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                  }`}>
                    <Icon size={18} className="flex-shrink-0" />
                  </div>
                </button>
              );
            }

            // Handle delivery when collapsed - just click through to delivery-areas
            if (isDelivery && isCollapsed) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick('delivery-areas')}
                  className={`w-full flex items-center justify-center px-3 py-3 rounded-xl transition-all duration-200 group hover:scale-105 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-md border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm'
                  }`}
                  title="Delivery"
                >
                  <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-500 text-white shadow-sm' 
                      : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                  }`}>
                    <Icon size={18} className="flex-shrink-0" />
                  </div>
                </button>
              );
            }
            
            // Regular menu items
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group hover:scale-105 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-md border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                }`}>
                  <Icon size={18} className="flex-shrink-0" />
                </div>
                {!isCollapsed && (
                  <span className={`font-semibold text-sm ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-gray-200 py-4 px-3 bg-white">
        <nav className="space-y-2">
          {!isCollapsed ? (
            <>
              <button
                onClick={() => handleItemClick('profile')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-105 text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm"
              >
                <div className="p-1.5 rounded-lg bg-gray-100">
                  <User size={18} className="text-gray-600" />
                </div>
                <span className="font-semibold text-sm text-gray-700">Profile</span>
              </button>

              <button
                onClick={handleSettingsToggle}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-105 ${
                  isSettingsOpen
                    ? 'bg-gray-100 text-gray-900 shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                    isSettingsOpen ? 'bg-gray-200' : 'bg-gray-100'
                  }`}>
                    <Settings size={18} className="text-gray-600" />
                  </div>
                  <span className="font-semibold text-sm text-gray-700">Settings</span>
                </div>
                {isSettingsOpen ? (
                  <ChevronUp size={18} className="text-gray-600" />
                ) : (
                  <ChevronDown size={18} className="text-gray-600" />
                )}
              </button>

              {/* Settings Dropdown */}
              {isSettingsOpen && (
                <div className="ml-4 mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {settingsItems.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = activeItem === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group hover:scale-105 ${
                          isActive
                            ? 'bg-gray-100 text-blue-600 shadow-sm'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <div className={`p-1 rounded-md transition-all duration-200 ${isActive ? 'bg-blue-100' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
                          <Icon 
                            size={16} 
                            className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} 
                          />
                        </div>
                        <span className={`text-sm font-medium whitespace-nowrap ${isActive ? 'text-blue-600' : 'text-gray-700'}`}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => handleItemClick('profile')}
                className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm hover:scale-105"
                title="Profile"
              >
                <div className="p-1.5 rounded-lg bg-gray-100">
                  <User size={18} className="text-gray-600" />
                </div>
              </button>
              <button
                onClick={handleSettingsToggle}
                className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm hover:scale-105"
                title="Settings"
              >
                <div className="p-1.5 rounded-lg bg-gray-100">
                  <Settings size={18} className="text-gray-600" />
                </div>
              </button>
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}

