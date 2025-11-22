import React from 'react';
import type { OrderWithAll } from '../../../src/types/orders';

interface ThankYouOrderModalProps {
  order: OrderWithAll;
  isOpen: boolean;
  onClose: () => void;
}

export default function ThankYouOrderModal({ order, isOpen, onClose }: ThankYouOrderModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-blue-900 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              🎉
            </div>
            <div>
              <h2 className="text-2xl font-bold">Thank you for your order!</h2>
              <p className="text-sm/5 opacity-90 mt-1">
                Order #{order.order_number || order.id.slice(0, 8).toUpperCase()} has been delivered.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            We hope everything arrived just the way you wanted. Your feedback helps {order.shop?.name || 'the shop'} improve.
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-3">
              {order.shop?.image_url ? (
                <img
                  src={order.shop.image_url}
                  alt={order.shop.name}
                  className="w-14 h-14 rounded-lg object-cover border border-white/50 shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-white/60 border border-blue-100" />
              )}
              <div>
                <p className="text-xs uppercase font-semibold text-blue-700">Shop</p>
                <p className="font-semibold text-gray-900">{order.shop?.name || 'Shop'}</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}


