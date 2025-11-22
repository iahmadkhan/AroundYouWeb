import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../../src/context/AuthContext';
import { supabase } from '../../../../src/services/supabase';
import OrdersIcon from '../../../../src/icons/OrdersIcon';
import StoreIcon from '../../../../src/icons/ShopIcon';
import SettingsIcon from '../../../../src/icons/EditIcon';
import FavoriteIcon from '../../../../src/icons/FavoriteIcon';

export default function MerchantProfileScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMerchantDefault, setIsMerchantDefault] = useState(true);
  const [isSwitchingToConsumer, setIsSwitchingToConsumer] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const { user, signOut, setDefaultRole, getDefaultRole } = useAuth();

  useEffect(() => {
    const loadDefaultRole = async () => {
      try {
        if (getDefaultRole) {
          const role = await getDefaultRole();
          setIsMerchantDefault(role === 'merchant');
        } else {
          setIsMerchantDefault(true);
        }
      } catch {
        setIsMerchantDefault(true);
      }
    };

    loadDefaultRole();
  }, [getDefaultRole, location.pathname]);

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
      const updatePayload: { name: string } = { name: editedName.trim() };
      // @ts-ignore - name column exists in user_profiles table
      const { error } = await supabase
        .from('user_profiles')
        // @ts-ignore
        .update(updatePayload)
        .eq('id', user.id);

      if (error) throw error;

      window.location.reload();
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

  const handleSwitchToConsumer = async () => {
    if (!user) {
      alert('Please log in first');
      return;
    }

    setIsSwitchingToConsumer(true);
    try {
      navigate('/home');
    } finally {
      setIsSwitchingToConsumer(false);
    }
  };

  const handleSetAsDefault = async (value: boolean) => {
    try {
      if (value) {
        if (setDefaultRole) {
          await setDefaultRole('merchant');
        }
        setIsMerchantDefault(true);
      } else {
        if (setDefaultRole) {
          await setDefaultRole('consumer');
        }
        setIsMerchantDefault(false);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">Merchant Profile</h1>
          <p className="text-gray-600 text-lg">Manage your merchant account and preferences</p>
        </div>

        {!user ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-5xl">👤</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Welcome to AroundYou</h2>
              <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
                Sign in to access your merchant dashboard and manage your shop.
              </p>
              <button
                className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white text-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                onClick={handleSignInPress}
              >
                Sign Up / Login
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden sticky top-8">
                <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 px-6 py-8 text-center">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                      {profilePicture ? (
                        <img 
                          src={profilePicture} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">👤</span>
                      )}
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {user.name || 'Merchant'}
                  </h2>
                  <p className="text-blue-100 text-sm">{user.email || 'Not set'}</p>
                </div>

                <div className="p-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <SquareAction 
                      title="Dashboard" 
                      icon={<StoreIcon size={24} color="#3B82F6" />}
                      onPress={() => navigate('/merchantdashboard')}
                    />
                    <SquareAction 
                      title="Orders" 
                      icon={<OrdersIcon size={24} color="#3B82F6" />}
                      onPress={() => navigate('/merchantdashboard', { state: { activeSidebarItem: 'orders' } })}
                    />
                    <SquareAction 
                      title="Inventory" 
                      icon={<SettingsIcon size={24} color="#3B82F6" />}
                      onPress={() => navigate('/merchantdashboard', { state: { activeSidebarItem: 'inventory' } })}
                    />
                    <SquareAction 
                      title="Favorites" 
                      icon={<FavoriteIcon size={24} color="#3B82F6" />}
                      onPress={() => navigate('/favorites')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-xl font-bold text-gray-900">Account Information</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-500 mb-1">Full Name</p>
                        {isEditingName ? (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="text"
                              value={editedName}
                              onChange={(e) => setEditedName(e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={handleSaveName}
                              disabled={isSavingName}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                            >
                              {isSavingName ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setIsEditingName(false);
                                setEditedName(user.name || '');
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-lg font-semibold text-gray-900">
                              {user.name || 'Not set'}
                            </p>
                            <button
                              onClick={() => setIsEditingName(true)}
                              className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit name"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-500 mb-1">Email Address</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {user.email || 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-xl font-bold text-gray-900">Settings</h2>
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
                        title="Switch to Consumer"
                        description="Browse shops and place orders as a customer"
                        onPress={handleSwitchToConsumer}
                        right={
                          isSwitchingToConsumer ? (
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
                        description="Automatically use merchant mode when you sign in"
                        right={
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isMerchantDefault}
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
                    title="Logout"
                    description="Sign out of your account"
                    onPress={handleLogout}
                    right={
                      isLoggingOut ? (
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 11-4 0v-1m0-8v-1a2 2 0 114 0v1" />
                        </svg>
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SquareActionProps {
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
}

function SquareAction({ title, icon, onPress }: SquareActionProps) {
  return (
    <button
      onClick={onPress}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 text-xl">
          {icon}
        </div>
        <span className="text-gray-800 font-semibold text-sm">{title}</span>
      </div>
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

interface ListItemProps {
  title: string;
  description: string;
  right?: React.ReactNode;
  onPress?: () => void;
}

function ListItem({ title, description, right, onPress }: ListItemProps) {
  return (
    <button
      onClick={onPress}
      className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
    >
      <div>
        <p className="text-base font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      {right}
    </button>
  );
}

