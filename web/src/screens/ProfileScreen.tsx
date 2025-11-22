import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../src/context/AuthContext';
import { useMerchantAccount } from '../../../src/hooks/merchant/useMerchantAccount';
import { useQueryClient } from 'react-query';
import { supabase } from '../../../src/services/supabase';
import OrdersIcon from '../../../src/icons/OrdersIcon';
import AddressIcon from '../../../src/icons/AddressIcon';
import FavoriteIcon from '../../../src/icons/FavoriteIcon';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isConsumerDefault, setIsConsumerDefault] = useState(true);
  const [isSwitchingToMerchant, setIsSwitchingToMerchant] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const { user, signOut, setDefaultRole, getDefaultRole } = useAuth();
  const queryClient = useQueryClient();
  const { data: merchantAccount, isLoading: isLoadingMerchant, error: merchantError } = useMerchantAccount(user?.id);

  const loadDefaultRole = async () => {
    try {
      if (getDefaultRole) {
        const role = await getDefaultRole();
        setIsConsumerDefault(role === 'consumer');
      } else {
        setIsConsumerDefault(true);
      }
    } catch (error) {
      setIsConsumerDefault(true);
    }
  };

  useEffect(() => {
    loadDefaultRole();
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      setEditedName(user.name || '');
      fetchProfilePicture();
    }
  }, [user]);

  const fetchProfilePicture = async () => {
    if (!user) return;
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!error && profile && (profile as any).avatar_url) {
        setProfilePicture((profile as any).avatar_url);
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    }
  };

  const handleSaveName = async () => {
    if (!user || !editedName.trim()) return;
    
    setIsSavingName(true);
    try {
      // @ts-ignore - name column exists in user_profiles table
      const { error } = await supabase
        .from('user_profiles')
        // @ts-ignore
        .update({ name: editedName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      // Update user in context by refreshing
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (profile) {
          // Trigger auth context refresh by checking session
          window.location.reload(); // Simple refresh to update user context
        }
      }
      
      setIsEditingName(false);
    } catch (error: any) {
      console.error('Error updating name:', error);
      // Error is logged to console, user can see the issue and try again
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSignInPress = () => {
    navigate('/login', { state: { returnTo: 'Home' } });
  };

  const handleSwitchToMerchant = async () => {
    if (!user) {
      alert('Please log in first');
      return;
    }

    setIsSwitchingToMerchant(true);
    try {
      // If we have cached data, use it immediately (fast path)
      if (merchantAccount !== undefined) {
        if (merchantAccount) {
          navigate('/merchantdashboard');
        } else {
          navigate('/merchantregistrationsurvey');
        }
        setIsSwitchingToMerchant(false);
        return;
      }

      // If still loading, wait for the query to complete
      if (isLoadingMerchant) {
        try {
          const result = await queryClient.fetchQuery(['merchant-account', user.id]);
          if (result) {
            navigate('/merchantdashboard');
          } else {
            navigate('/merchantregistrationsurvey');
          }
        } catch (error: any) {
          console.error('Error fetching merchant account:', error);
          alert(`Error: ${error?.message || 'Failed to check merchant account. Please try again.'}`);
        }
        setIsSwitchingToMerchant(false);
        return;
      }

      // If there's an error, show it
      if (merchantError) {
        console.error('Error fetching merchant account:', merchantError);
        alert(`Error: ${merchantError.message || 'Failed to check merchant account. Please try again.'}`);
        setIsSwitchingToMerchant(false);
        return;
      }

      // Fallback: navigate based on merchant account
      if (merchantAccount) {
        navigate('/merchantdashboard');
      } else {
        navigate('/merchantregistrationsurvey');
      }
    } catch (error: any) {
      console.error('Exception in handleSwitchToMerchant:', error);
      alert(`Error: ${error?.message || 'Failed to check merchant account'}`);
    } finally {
      setIsSwitchingToMerchant(false);
    }
  };

  const handleSetAsDefault = async (value: boolean) => {
    try {
      if (value) {
        if (setDefaultRole) {
          await setDefaultRole('consumer');
        }
        setIsConsumerDefault(true);
      } else {
        if (setDefaultRole) {
          await setDefaultRole('merchant');
        }
        setIsConsumerDefault(false);
      }
    } catch (error) {
      console.error('Error setting default role:', error);
      // Error is logged to console, user can see the issue and try again
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate('/home');
    } catch (error: any) {
      alert(`Logout Error: ${error?.message || 'Failed to logout. Please try again.'}`);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2">Profile</h1>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg">Manage your account and preferences</p>
        </div>

        {!user ? (
          // Not logged in state
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-8 sm:p-10 md:p-12 text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-4xl sm:text-5xl">👤</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Welcome to AroundYou</h2>
              <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-6 sm:mb-8 max-w-md mx-auto px-4">
                Sign in to access your account, manage orders, and enjoy personalized shopping
              </p>
              <button
                className="px-8 sm:px-10 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white text-base sm:text-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                onClick={handleSignInPress}
              >
                Sign Up / Login
              </button>
            </div>
          </div>
        ) : (
          // Logged in state - Two Column Layout
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            {/* Left Column - Profile Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 overflow-hidden lg:sticky lg:top-8">
                {/* Profile Header */}
                <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 px-4 sm:px-5 md:px-6 py-6 sm:py-7 md:py-8 text-center">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                      {profilePicture ? (
                        <img 
                          src={profilePicture} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl sm:text-4xl">👤</span>
                      )}
                    </div>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 truncate px-2">
                    {user.name || 'User'}
                  </h2>
                  <p className="text-blue-100 text-xs sm:text-sm truncate px-2">{user.email || 'Not set'}</p>
                </div>

                {/* Quick Actions */}
                <div className="p-4 sm:p-5 md:p-6">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 sm:mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <SquareAction 
                      title="Orders" 
                      icon={<OrdersIcon size={24} color="#3B82F6" />}
                      onPress={() => navigate('/orders')} 
                    />
                    <SquareAction 
                      title="Favourites" 
                      icon={<FavoriteIcon size={24} color="#3B82F6" />}
                      onPress={() => navigate('/favorites')} 
                    />
                    <SquareAction 
                      title="Addresses" 
                      icon={<AddressIcon size={24} color="#3B82F6" />}
                      onPress={() => navigate('/consumeraddressmanagement')} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Settings and Info */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
              {/* Account Information Card */}
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-4 sm:px-5 md:px-6 py-4 sm:py-5 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Account Information</h2>
                </div>
                <div className="p-4 sm:p-5 md:p-6">
                  <div className="space-y-4 sm:space-y-5 md:space-y-6">
                    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Full Name</p>
                        {isEditingName ? (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                            <input
                              type="text"
                              value={editedName}
                              onChange={(e) => setEditedName(e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                              autoFocus
                            />
                            <div className="flex gap-2">
                            <button
                              onClick={handleSaveName}
                              disabled={isSavingName}
                                className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-xs sm:text-sm font-medium"
                            >
                              {isSavingName ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setIsEditingName(false);
                                setEditedName(user.name || '');
                              }}
                                className="px-3 sm:px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs sm:text-sm font-medium"
                            >
                              Cancel
                            </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                              {user.name || 'Not set'}
                            </p>
                            <button
                              onClick={() => setIsEditingName(true)}
                              className="ml-2 sm:ml-4 p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                              title="Edit name"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Email Address</p>
                        <p className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                          {user.email || 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Settings Card */}
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-4 sm:px-5 md:px-6 py-4 sm:py-5 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Settings</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  <ListItem
                    title="Language"
                    description="Change your preferred language"
                    right={<span className="text-gray-600 font-medium">English</span>}
                    onPress={() => {}}
                  />
                  <ListItem
                    title="Push Notifications"
                    description="Receive notifications about orders and updates"
                    right={
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pushEnabled}
                          onChange={(e) => setPushEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    }
                  />
                  {user && (
                    <>
                      <ListItem
                        title="Switch to Merchant"
                        description="Manage your shop and products"
                        onPress={handleSwitchToMerchant}
                        right={
                          isSwitchingToMerchant ? (
                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )
                        }
                      />
                      <ListItem
                        title="Set this role as default"
                        description="Automatically use this role when you sign in"
                        right={
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isConsumerDefault}
                              onChange={(e) => handleSetAsDefault(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        }
                      />
                    </>
                  )}
                  <ListItem 
                    title="Terms & Policies" 
                    description="Read our terms of service and privacy policy"
                    onPress={() => navigate('/terms')}
                    right={
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    }
                  />
                  <ListItem 
                    title="Suggestion or Complaint" 
                    description="Share your feedback with us"
                    onPress={() => navigate('/feedback')}
                    right={
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    }
                  />
                  <ListItem 
                    title="FAQs" 
                    description="Frequently asked questions"
                    onPress={() => navigate('/help')}
                    right={
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    }
                  />
                </div>
              </div>

              {/* Logout Button */}
              {user && (
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-5 md:p-6">
                  <button
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center py-3 sm:py-4 text-white text-sm sm:text-base font-semibold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm">Version 0.1</p>
        </div>
      </div>
    </div>
  );
}

function SquareAction({ title, icon, onPress }: { title: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 rounded-lg sm:rounded-xl hover:bg-blue-50 transition-all border border-gray-200 hover:border-blue-300 hover:shadow-md group"
    >
      <div className="flex-shrink-0">{icon}</div>
      <span className="text-gray-800 font-semibold text-xs sm:text-sm group-hover:text-blue-600">{title}</span>
      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 ml-auto group-hover:text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function ListItem({ title, description, right, onPress }: { title: string; description?: string; right?: React.ReactNode; onPress?: () => void }) {
  return (
    <button
      onClick={onPress}
      className="w-full flex flex-row items-center justify-between px-4 sm:px-5 md:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors group"
    >
      <div className="flex-1 text-left min-w-0">
        <span className="text-gray-900 text-sm sm:text-base font-medium block group-hover:text-blue-600 truncate">{title}</span>
        {description && (
          <span className="text-gray-500 text-xs sm:text-sm mt-0.5 block line-clamp-2">{description}</span>
        )}
      </div>
      {right && <div className="ml-2 sm:ml-4 flex-shrink-0">{right}</div>}
    </button>
  );
}

