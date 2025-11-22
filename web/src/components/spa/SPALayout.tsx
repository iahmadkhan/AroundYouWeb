import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface SPALayoutProps {
  children: React.ReactNode;
  activeSidebarItem?: string;
  onSidebarItemClick?: (item: string) => void;
  headerTitle?: string;
  headerSubtitle?: string;
  shops?: Array<{ id: string; name: string }>;
  selectedShopId?: string;
  onShopChange?: (shopId: string) => void;
  tabs?: Array<{ id: string; label: string }>;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export default function SPALayout({
  children,
  activeSidebarItem = 'store-management',
  onSidebarItemClick,
  headerTitle,
  headerSubtitle,
  shops,
  selectedShopId,
  onShopChange,
  tabs,
  activeTab,
  onTabChange,
}: SPALayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeItem={activeSidebarItem}
        onItemClick={onSidebarItemClick}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
        isSidebarCollapsed ? 'ml-20' : 'ml-64'
      }`}>
        {/* Header */}
        <Header
          title={headerTitle}
          subtitle={headerSubtitle}
          shops={shops}
          selectedShopId={selectedShopId}
          onShopChange={onShopChange}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

