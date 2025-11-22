import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import * as authService from '../services/authService';
import type { User, UserRole } from '../services/authService';

const DEFAULT_ROLE_KEY = 'default_role';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<{ error: string | null }>;
  setDefaultRole: (role: 'consumer' | 'merchant') => Promise<void>;
  getDefaultRole: () => Promise<'consumer' | 'merchant'>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Debug: Log when AuthProvider renders
  React.useEffect(() => {
    console.log('AuthProvider mounted and context is available');
  }, []);

  const checkSession = React.useCallback(async () => {
    try {
      const { user: currentUser, error } = await authService.getCurrentUser();
      if (!error && currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let subscription: any = null;
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Check for existing session first
        await checkSession();

        if (!isMounted) return;

        // Listen for auth state changes
        try {
          const {
            data: { subscription: authSubscription },
          } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return;
            try {
              if (session?.user) {
                const { user: currentUser, error } = await authService.getCurrentUser();
                if (!error && currentUser) {
                  setUser(currentUser);
                } else {
                  setUser(null);
                }
              } else {
                setUser(null);
              }
            } catch (error) {
              console.error('Auth state change error:', error);
              if (isMounted) {
                setUser(null);
              }
            } finally {
              if (isMounted) {
                setLoading(false);
              }
            }
          });
          subscription = authSubscription;
        } catch (error) {
          console.error('Failed to set up auth state listener:', error);
          if (isMounted) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing from auth:', error);
        }
      }
    };
  }, [checkSession]);

  const signUp = React.useCallback(async (email: string, password: string, name?: string) => {
    setLoading(true);
    try {
      const { user: newUser, error } = await authService.signUpWithEmail(email, password, name);
      if (error) {
        return { error: error.message };
      }
      if (newUser) {
        setUser(newUser);
        return { error: null };
      }
      return { error: 'Failed to create account' };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { user: signedInUser, error } = await authService.signInWithEmail(email, password);
      if (error) {
        return { error: error.message };
      }
      if (signedInUser) {
        setUser(signedInUser);
        return { error: null };
      }
      return { error: 'Failed to sign in' };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = React.useCallback(async () => {
    setLoading(true);
    try {
      const { user: signedInUser, error } = await authService.signInWithGoogle();
      if (error) {
        return { error: error.message };
      }
      if (signedInUser) {
        setUser(signedInUser);
        return { error: null };
      }
      return { error: 'Failed to sign in with Google' };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = React.useCallback(async () => {
    setLoading(true);
    try {
      await authService.signOut();
      setUser(null);
      
      // Clear cart on logout
      try {
        const { useCartStore } = await import('../stores/cartStore');
        useCartStore.getState().setUserId(null);
        useCartStore.getState().clearCart();
      } catch (error) {
        console.error('Error clearing cart on logout:', error);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRole = React.useCallback(async (role: UserRole) => {
    if (!user) {
      return { error: 'No user logged in' };
    }
    try {
      const { error } = await authService.updateUserRole(user.id, role);
      if (error) {
        return { error: error.message };
      }
      // Update local user state
      setUser((prevUser) => prevUser ? { ...prevUser, role } : null);
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'An error occurred' };
    }
  }, [user]);

  const setDefaultRole = React.useCallback(async (role: 'consumer' | 'merchant') => {
    try {
      localStorage.setItem(DEFAULT_ROLE_KEY, role);
    } catch (error) {
      console.error('Error setting default role:', error);
    }
  }, []);

  const getDefaultRole = React.useCallback(async (): Promise<'consumer' | 'merchant'> => {
    try {
      const defaultRole = localStorage.getItem(DEFAULT_ROLE_KEY);
      return (defaultRole as 'consumer' | 'merchant') || 'consumer';
    } catch (error) {
      console.error('Error getting default role:', error);
      return 'consumer';
    }
  }, []);

  const value: AuthContextType = React.useMemo(() => ({
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateRole,
    setDefaultRole,
    getDefaultRole,
  }), [user, loading, signUp, signIn, signInWithGoogle, signOut, updateRole, setDefaultRole, getDefaultRole]);

  // Always render children, even if there's an initialization error
  // This ensures the context is always available
  // Wrap in try-catch to ensure provider always renders
  try {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  } catch (error) {
    console.error('Error rendering AuthProvider:', error);
    // Even if there's an error, still provide a minimal context value
    const fallbackValue: AuthContextType = {
      user: null,
      loading: false,
      signUp: async () => ({ error: 'Auth provider initialization failed' }),
      signIn: async () => ({ error: 'Auth provider initialization failed' }),
      signInWithGoogle: async () => ({ error: 'Auth provider initialization failed' }),
      signOut: async () => {},
      updateRole: async () => ({ error: 'Auth provider initialization failed' }),
      setDefaultRole: async () => {},
      getDefaultRole: async () => 'consumer',
    };
    return <AuthContext.Provider value={fallbackValue}>{children}</AuthContext.Provider>;
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Provide more helpful error message
    console.error('useAuth called outside AuthProvider. Make sure AuthProvider wraps your app.');
    throw new Error('useAuth must be used within an AuthProvider. Check that AuthProvider wraps your component tree.');
  }
  return context;
}

