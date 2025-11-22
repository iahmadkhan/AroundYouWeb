import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../src/context/AuthContext';
import * as merchantService from '../../../../src/services/merchant/merchantService';

export default function MerchantRegistrationSurveyScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedShopType, setSelectedShopType] = useState<merchantService.ShopType | null>(null);
  const [selectedNumberOfShops, setSelectedNumberOfShops] = useState<merchantService.NumberOfShops | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const shopTypes: { value: merchantService.ShopType; label: string }[] = [
    { value: 'grocery', label: 'Grocery' },
    { value: 'meat', label: 'Meat' },
    { value: 'vegetable', label: 'Vegetable' },
    { value: 'mart', label: 'Mart' },
    { value: 'other', label: 'Other' },
  ];

  const numberOfShopsOptions: { value: merchantService.NumberOfShops; label: string }[] = [
    { value: '1', label: 'Just one shop' },
    { value: '2', label: 'Two shops' },
    { value: '3+', label: 'Three or more shops' },
  ];

  const handleCreateAccount = async () => {
    if (!selectedShopType || !selectedNumberOfShops || !user) {
      alert('Missing Information: Please select both shop type and number of shops.');
      return;
    }

    setIsCreating(true);
    try {
      const { error } = await merchantService.createMerchantAccount(user.id, {
        shop_type: selectedShopType,
        number_of_shops: selectedNumberOfShops,
      });

      if (error) {
        alert(`Error: ${error.message}`);
        return;
      }

      // Navigate to merchant dashboard
      navigate('/merchantdashboard', { replace: true });
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to create merchant account'}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero header */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-blue-100 mb-2">
              Become a Partner
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Merchant Registration
            </h1>
            <p className="mt-2 text-sm md:text-base text-blue-100 max-w-2xl">
              Tell us a bit about your business so we can set up the perfect merchant workspace for you.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 text-blue-50 text-sm">
            <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-xl">🏬</span>
            </div>
            <div className="leading-tight">
              <p className="font-semibold">Takes less than a minute</p>
              <p className="text-xs text-blue-100">No contracts or fees to get started.</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left: form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Business Details</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Choose the options that best describe your shop.
                    </p>
                  </div>
                  <span className="hidden md:inline-flex items-center rounded-full bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1">
                    Step 1 of 1
                  </span>
                </div>

                <div className="px-6 py-6 space-y-8">
                  {/* Shop type */}
                  <section>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">Type of shop</h3>
                    <p className="text-xs text-gray-500 mb-4">
                      This helps customers find you in the right category.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {shopTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setSelectedShopType(type.value)}
                          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all hover:border-blue-400 hover:bg-blue-50/40 ${
                            selectedShopType === type.value
                              ? 'border-blue-600 bg-blue-50 shadow-sm'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                selectedShopType === type.value ? 'text-blue-700' : 'text-gray-900'
                              }`}
                            >
                              {type.label}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {type.value === 'grocery' && 'Everyday essentials and pantry items.'}
                              {type.value === 'meat' && 'Butcher, meat, and poultry products.'}
                              {type.value === 'vegetable' && 'Fresh vegetables and fruits.'}
                              {type.value === 'mart' && 'Mini-mart / convenience store.'}
                              {type.value === 'other' && 'Something a bit different? Choose this.'}
                            </p>
                          </div>
                          <div
                            className={`ml-3 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                              selectedShopType === type.value
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-gray-300 bg-white text-transparent'
                            }`}
                          >
                            ✓
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Number of shops */}
                  <section>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">How many shops do you manage?</h3>
                    <p className="text-xs text-gray-500 mb-4">
                      We use this to optimize your dashboard for single or multi-branch businesses.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {numberOfShopsOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSelectedNumberOfShops(option.value)}
                          className={`rounded-xl border px-4 py-3 text-left transition-all hover:border-blue-400 hover:bg-blue-50/40 ${
                            selectedNumberOfShops === option.value
                              ? 'border-blue-600 bg-blue-50 shadow-sm'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <p
                            className={`text-sm font-semibold ${
                              selectedNumberOfShops === option.value ? 'text-blue-700' : 'text-gray-900'
                            }`}
                          >
                            {option.label}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {option.value === '1' && 'Perfect for single-location shops.'}
                            {option.value === '2' && 'Great for growing, two-branch businesses.'}
                            {option.value === '3+' && 'Best for chains and multi-branch partners.'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Actions */}
                  <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      By continuing, you agree to follow AroundYou&apos;s merchant policies.
                    </p>
                    <button
                      type="button"
                      onClick={handleCreateAccount}
                      disabled={!selectedShopType || !selectedNumberOfShops || isCreating}
                      className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isCreating && (
                        <div className="w-4 h-4 border-[2px] border-white border-t-transparent rounded-full animate-spin mr-2" />
                      )}
                      {isCreating ? 'Creating account…' : 'Create merchant account'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: info / benefits */}
            <aside className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">What you get as a merchant</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-500">✓</span>
                    <span>Real-time order management and status tracking.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-500">✓</span>
                    <span>Delivery runner coordination built into the dashboard.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-500">✓</span>
                    <span>Analytics on orders, revenue, and performance.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-500">✓</span>
                    <span>Easy product and price management for all your branches.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">
                  Need help?
                </p>
                <p className="text-sm text-blue-900 mb-2">
                  Our team can walk you through the setup and help you add your first shop.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/help')}
                  className="inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-900"
                >
                  Go to Help Center
                  <svg className="w-3.5 h-3.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

