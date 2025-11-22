import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { type MerchantShop } from '../../../../src/services/merchant/shopService';
import { getImageUrl } from '../../utils/imageUtils';
import { ArrowLeft } from 'lucide-react';

interface ViewShopScreenProps {
  shop?: MerchantShop;
  onClose?: () => void;
}

export default function ViewShopScreen({ shop: propShop, onClose }: ViewShopScreenProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const shop: MerchantShop | null = propShop || (location.state as any)?.shop || null;

  if (!shop) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <p className="text-gray-600 mb-4 font-medium">No shop data provided</p>
            <button
              onClick={() => {
                if (onClose) {
                  onClose();
                } else {
                  navigate('/merchantdashboard', { state: { activeSidebarItem: 'shops' } });
                }
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const shopImageUrl = shop.image_url ? getImageUrl(shop.image_url) : null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Shop Details</h2>
          <button
            onClick={() => {
              if (onClose) {
                onClose();
              } else {
                navigate('/merchantdashboard', { state: { activeSidebarItem: 'shops' } });
              }
            }}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Shop Image */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Shop Picture
            </label>
            {shopImageUrl ? (
              <img
                src={shopImageUrl}
                alt={shop.name}
                className="w-full h-48 object-cover rounded-xl border border-gray-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-48 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-200">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Shop Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Shop Name
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-300 text-gray-900">
              {shop.name || 'N/A'}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Description
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-300 text-gray-900 min-h-[100px]">
              {shop.description || 'No description'}
            </div>
          </div>

          {/* Shop Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Shop Type
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-300 text-gray-900">
              {shop.shop_type || 'N/A'}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Address
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-300 text-gray-900">
              {shop.address || 'No address'}
            </div>
            {shop.latitude && shop.longitude && (
              <p className="text-xs text-gray-500 mt-2">
                Coordinates: {shop.latitude.toFixed(6)}, {shop.longitude.toFixed(6)}
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Status
            </label>
            <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold ${
              shop.is_open 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-gray-100 text-gray-800 border border-gray-200'
            }`}>
              {shop.is_open ? 'Open' : 'Closed'}
            </span>
          </div>

          {/* Tags */}
          {shop.tags && shop.tags.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {shop.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Created Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Created
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-300 text-gray-900">
              {formatDate(shop.created_at)}
            </div>
          </div>

          {/* Close Button */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => {
                if (onClose) {
                  onClose();
                } else {
                  navigate('/merchantdashboard', { state: { activeSidebarItem: 'shops' } });
                }
              }}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

