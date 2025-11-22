import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../src/services/supabase';

export default function AuthCallbackScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase automatically handles the OAuth callback from the URL hash.
        // We just ping once to confirm we can talk to auth, then immediately go home.
        const { error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('Session error after callback:', sessionError);
        }
        // AuthProvider will hydrate user/profile on /home; no extra waits here.
        navigate('/home');
      } catch (error) {
        console.error('Auth callback error:', error);
        // On unexpected errors, still go home instead of bouncing back to login with an error flag.
        navigate('/home');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

