import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../../src/context/AuthContext';

export default function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signInWithGoogle, user, loading: authLoading } = useAuth();
  const returnTo = (location.state as any)?.returnTo;
  const returnState = (location.state as any)?.returnState;

  // Check for error query parameter from OAuth callback
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const errorParam = searchParams.get('error');
    if (errorParam) {
      if (errorParam === 'auth_failed') {
        setError('Google sign-in failed. Please try again.');
      } else if (errorParam === 'no_session') {
        setError('No session found. Please try signing in again.');
      } else {
        setError('An error occurred during sign-in. Please try again.');
      }
      // Clean up the URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  // Navigate back when user successfully logs in
  useEffect(() => {
    // Only navigate if user is set and auth is not loading
    if (user && !authLoading && !loading) {
      // Small delay to ensure state is fully updated
      const timer = setTimeout(() => {
        if (returnTo) {
          // Check if returnTo is a tab screen - if so, navigate to Home which contains tabs
          const tabScreens = ['HomeTab', 'SearchTab', 'ProfileTab'];
          if (tabScreens.includes(returnTo)) {
            navigate('/home');
          } else {
            navigate(`/${returnTo.toLowerCase()}`, { state: returnState });
          }
        } else {
          // Default to home page
          navigate('/home');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, loading, returnTo, returnState, navigate]);

  const handleEmailLogin = async () => {
    // Clear previous errors
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) {
        setLoading(false);
        // Make error messages more user-friendly
        let userFriendlyError = signInError;
        if (signInError.toLowerCase().includes('invalid login credentials') || 
            signInError.toLowerCase().includes('invalid credentials') ||
            signInError.toLowerCase().includes('email or password')) {
          userFriendlyError = 'Invalid login credentials';
        } else if (signInError.toLowerCase().includes('user not found')) {
          userFriendlyError = 'No account found with this email. Please sign up.';
        } else if (signInError.toLowerCase().includes('invalid email')) {
          userFriendlyError = 'Please enter a valid email address.';
        }
        setError(userFriendlyError);
        return;
      }
      // Reset loading state - navigation will happen via useEffect when user is set
      setLoading(false);
      setError(null);
    } catch (err: any) {
      setLoading(false);
      let userFriendlyError = err.message || 'An error occurred';
      if (userFriendlyError.toLowerCase().includes('invalid login credentials') || 
          userFriendlyError.toLowerCase().includes('invalid credentials')) {
        userFriendlyError = 'Invalid login credentials';
      }
      setError(userFriendlyError);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        setLoading(false);
        setError(`Google Sign-In Failed: ${googleError}`);
        return;
      }
      // If no error, the page will redirect to Google OAuth
      // Don't set loading to false - the component will unmount during redirect
      // The auth callback screen will handle the return and navigation
    } catch (err: any) {
      setLoading(false);
      setError(`Google Sign-In Failed: ${err.message || 'An error occurred'}`);
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-6 sm:py-8 md:py-12 px-3 sm:px-4">
      <div className="w-full max-w-md">
        {/* Close Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleClose}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>

        {/* Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header Section */}
          <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 text-center border-b border-gray-100 bg-gray-50">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
            <p className="text-gray-600 text-sm sm:text-base">Sign in to continue shopping AroundYou</p>
          </div>

          {/* Form Section */}
          <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8">
            {/* Email Input */}
            <div className="mb-4 sm:mb-5">
              <label className="text-gray-700 text-xs sm:text-sm font-semibold mb-2 block">Email</label>
              <input
                type="email"
                className={`w-full bg-white border-2 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-gray-900 text-sm sm:text-base focus:outline-none focus:ring-2 transition-all ${
                  error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null); // Clear error when user starts typing
                }}
                disabled={loading}
              />
            </div>

            {/* Password Input */}
            <div className="mb-5 sm:mb-6">
              <label className="text-gray-700 text-xs sm:text-sm font-semibold mb-2 block">Password</label>
              <input
                type="password"
                className={`w-full bg-white border-2 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-gray-900 text-sm sm:text-base focus:outline-none focus:ring-2 transition-all ${
                  error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null); // Clear error when user starts typing
                }}
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
              >
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </motion.div>
            )}

            {/* Login Button */}
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full bg-blue-600 rounded-lg py-2.5 sm:py-3 md:py-3.5 flex items-center justify-center mb-4 sm:mb-5 text-white text-sm sm:text-base font-semibold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleEmailLogin}
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </motion.button>

            {/* Divider */}
            <div className="flex flex-row items-center my-4 sm:my-5 md:my-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="mx-3 sm:mx-4 text-gray-500 text-xs sm:text-sm font-medium">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Google Sign-In Button */}
            <motion.button
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full bg-white border-2 border-gray-200 rounded-lg py-2.5 sm:py-3 md:py-3.5 flex items-center justify-center mb-5 sm:mb-6 text-gray-700 text-sm sm:text-base font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="truncate">Continue with Google</span>
            </motion.button>

            {/* Sign Up Link */}
            <div className="flex flex-row justify-center items-center flex-wrap gap-1 mt-4 sm:mt-5 md:mt-6">
              <span className="text-gray-600 text-xs sm:text-sm">Don't have an account? </span>
              <button
                onClick={() => navigate('/signup', { state: { returnTo, returnState } })}
                disabled={loading}
                className="text-blue-600 font-semibold text-xs sm:text-sm hover:underline"
              >
                Sign Up
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

