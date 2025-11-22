import React from 'react';

export default function HelpCenterScreen() {
  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Help Center</h1>
          <p className="text-gray-500 text-lg">Get help with your account, orders, and more</p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 hover:shadow-md transition-all duration-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🛒</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">How to place an order?</h3>
                <p className="text-gray-600">Browse shops, add items to cart, and checkout to place your order.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 hover:shadow-md transition-all duration-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📍</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">How to track my order?</h3>
                <p className="text-gray-600">Go to Orders section to view your order status and tracking information.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 hover:shadow-md transition-all duration-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🏠</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">How to change my address?</h3>
                <p className="text-gray-600">Click on the location selector in the navigation bar to update your delivery address.</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl shadow-lg p-6 md:p-8 text-white">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">💬</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Contact Support</h3>
                <p className="text-blue-50 mb-3">Need more help? Contact our support team.</p>
                <p className="text-lg font-semibold">support@aroundyou.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

