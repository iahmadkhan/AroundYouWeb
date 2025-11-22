import React from 'react';
import type { MerchantShop } from '../../../src/services/merchant/shopService';

interface MerchantShopCardProps {
  shop: MerchantShop;
  onPress?: () => void;
}

// Custom icons for stats
const OrdersIcon = () => (
  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
    <span className="text-green-600 text-base">📦</span>
  </div>
);

const CancelledIcon = () => (
  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
    <span className="text-red-600 text-base">❌</span>
  </div>
);

const RevenueIcon = () => (
  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
    <span className="text-blue-600 text-base">💰</span>
  </div>
);

export default function MerchantShopCard({ shop, onPress }: MerchantShopCardProps) {
  return (
    <div
      onClick={onPress}
      className="bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] shadow-sm border border-gray-100 hover:shadow-md"
    >
      {/* Shop Image and Name */}
      <div className="flex flex-row">
        {shop.image_url ? (
          <img
            src={shop.image_url}
            alt={shop.name}
            className="w-24 h-24 rounded-l-2xl object-cover"
          />
        ) : (
          <div className="w-24 h-24 bg-gray-200 rounded-l-2xl flex items-center justify-center">
            <span className="text-4xl">🏪</span>
          </div>
        )}
        
        <div className="flex-1 p-4 flex flex-col justify-center">
          <h4 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">
            {shop.name}
          </h4>
          <p className="text-sm text-gray-500 line-clamp-1">
            {shop.shop_type}
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100">
        <div className="flex flex-row justify-between items-center">
          {/* Orders Today */}
          <div className="flex flex-row items-center flex-1">
            <OrdersIcon />
            <div className="ml-2 flex-1">
              <p className="text-xs text-gray-500">Orders Today</p>
              <p className="text-base font-bold text-gray-900">{shop.orders_today || 0}</p>
            </div>
          </div>

          {/* Cancelled Today */}
          <div className="flex flex-row items-center flex-1 ml-4">
            <CancelledIcon />
            <div className="ml-2 flex-1">
              <p className="text-xs text-gray-500">Cancelled</p>
              <p className="text-base font-bold text-gray-900">{shop.orders_cancelled_today || 0}</p>
            </div>
          </div>

          {/* Revenue Today */}
          <div className="flex flex-row items-center flex-1 ml-4">
            <RevenueIcon />
            <div className="ml-2 flex-1">
              <p className="text-xs text-gray-500">Revenue</p>
              <p className="text-base font-bold text-gray-900">Rs {((shop.revenue_today as number) || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

