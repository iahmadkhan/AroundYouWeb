import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../src/context/AuthContext';

export default function SignUpScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
  const returnTo = (location.state as any)?.returnTo;

  // Navigate back when user successfully signs up
  useEffect(() => {
    // Only navigate if user is set and auth is not loading
    if (user && !authLoading && !loading) {
      // Small delay to ensure state is fully updated
      const timer = setTimeout(() => {
        if (returnTo) {
          const tabScreens = ['HomeTab', 'SearchTab', 'ProfileTab'];
          if (tabScreens.includes(returnTo)) {
            navigate('/home');
          } else {
            navigate(`/${returnTo.toLowerCase()}`);
          }
        } else {
          // Default to home page
          navigate('/home');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading, loading, returnTo, navigate]);

  // Show loading state while auth is initializing - moved after hooks
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const handleEmailSignUp = async () => {
    // Clear previous errors
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: signUpError } = await signUp(email.trim(), password);
      if (signUpError) {
        setLoading(false);
        // Make error messages more user-friendly
        let userFriendlyError = signUpError;
        if (signUpError.toLowerCase().includes('user already registered') || 
            signUpError.toLowerCase().includes('already registered') ||
            signUpError.toLowerCase().includes('email already')) {
          userFriendlyError = 'User already registered';
        } else if (signUpError.toLowerCase().includes('invalid email')) {
          userFriendlyError = 'Please enter a valid email address.';
        } else if (signUpError.toLowerCase().includes('password')) {
          userFriendlyError = 'Password must be at least 6 characters long.';
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
      if (userFriendlyError.toLowerCase().includes('user already registered') || 
          userFriendlyError.toLowerCase().includes('already registered')) {
        userFriendlyError = 'User already registered';
      }
      setError(userFriendlyError);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        setLoading(false);
        setError(`Google Sign-Up Failed: ${googleError}`);
        return;
      }
      // If no error, the page will redirect to Google OAuth
      // Don't set loading to false - the component will unmount during redirect
      // The auth callback screen will handle the return and navigation
    } catch (err: any) {
      setLoading(false);
      setError(`Google Sign-Up Failed: ${err.message || 'An error occurred'}`);
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-6 sm:py-8 md:py-12 px-3 sm:px-4">
      <div className="w-full max-w-md">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Card Container */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
          {/* Header Section */}
          <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 text-center border-b border-gray-100 bg-gray-50">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Create account</h1>
            <p className="text-gray-600 text-sm sm:text-base">Sign up to start shopping AroundYou</p>
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
              <p className="text-gray-500 text-xs mt-2">At least 6 characters</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Sign Up Button */}
            <button
              className="w-full bg-blue-600 rounded-lg py-2.5 sm:py-3 md:py-3.5 flex items-center justify-center mb-4 sm:mb-5 text-white text-sm sm:text-base font-semibold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleEmailSignUp}
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Sign Up'
              )}
            </button>

            {/* Divider */}
            <div className="flex flex-row items-center my-4 sm:my-5 md:my-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="mx-3 sm:mx-4 text-gray-500 text-xs sm:text-sm font-medium">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Google Sign-Up Button */}
            <button
              className="w-full bg-white border-2 border-gray-200 rounded-lg py-2.5 sm:py-3 md:py-3.5 flex items-center justify-center mb-5 sm:mb-6 text-gray-700 text-sm sm:text-base font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleGoogleSignUp}
              disabled={loading}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="truncate">Continue with Google</span>
            </button>

            {/* Sign In Link */}
            <div className="flex flex-row justify-center items-center flex-wrap gap-1 mt-4 sm:mt-5 md:mt-6">
              <span className="text-gray-600 text-xs sm:text-sm">Already have an account? </span>
              <button
                onClick={() => navigate('/login', { state: { returnTo } })}
                disabled={loading}
                className="text-blue-600 font-semibold text-xs sm:text-sm hover:underline"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

