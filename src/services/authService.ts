import { supabase, supabaseAdmin } from './supabase';

export type UserRole = 'consumer' | 'merchant' | 'admin';

export interface User {
  id: string;
  email: string | null;
  name?: string | null;
  role: UserRole;
  created_at: string;
}

export interface AuthError {
  message: string;
}

// Email & Password Sign Up
export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || null,
          role: 'consumer', // Default role is consumer
        },
      },
    });

    if (error) {
      return { user: null, error: { message: error.message } };
    }

    if (!data.user) {
      return { user: null, error: { message: 'Failed to create user' } };
    }

    // Auto-confirm user email using Admin API (service_role key)
    // This bypasses email confirmation requirement
    if (supabaseAdmin && !data.user.email_confirmed_at) {
      try {
        const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
          data.user.id,
          {
            email_confirm: true,
          }
        );
        if (confirmError) {
          console.warn('Failed to auto-confirm user:', confirmError);
        }
      } catch (error) {
        console.warn('Error confirming user:', error);
      }
    }

    // Profile is automatically created by trigger function handle_new_user()
    // Wait a moment for the trigger to complete, then fetch the profile
    await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

    // Fetch the user profile (created by trigger)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // If profile doesn't exist yet (trigger might be delayed), use function to create it
    // This bypasses RLS because the function is SECURITY DEFINER
    if (profileError && profileError.code === 'PGRST116') {
      const { error: createError } = await supabase.rpc('create_user_profile_if_not_exists', {
        user_id: data.user.id,
        user_email: data.user.email || '',
        user_name: name || data.user.user_metadata?.name || null,
        user_role: 'consumer',
      });

      if (createError) {
        console.warn('Fallback profile creation error:', createError);
      }

      // Fetch again after function call
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const user: User = {
        id: data.user.id,
        email: data.user.email || null,
        name: newProfile?.name || name || data.user.user_metadata?.name || null,
        role: (newProfile?.role as UserRole) || 'consumer',
        created_at: data.user.created_at,
      };

      return { user, error: null };
    }

    // Use profile data if available
    const user: User = {
      id: data.user.id,
      email: data.user.email || null,
      name: profile?.name || name || data.user.user_metadata?.name || null,
      role: (profile?.role as UserRole) || 'consumer',
      created_at: data.user.created_at,
    };

    return { user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Email & Password Sign In
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error: { message: error.message } };
    }

    if (!data.user) {
      return { user: null, error: { message: 'Failed to sign in' } };
    }

    // Fetch user profile to get role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // If profile doesn't exist, use function to create it (bypasses RLS)
    if (profileError && profileError.code === 'PGRST116') {
      const { error: createError } = await supabase.rpc('create_user_profile_if_not_exists', {
        user_id: data.user.id,
        user_email: data.user.email || '',
        user_name: data.user.user_metadata?.name || null,
        user_role: 'consumer',
      });

      if (createError) {
        console.warn('Profile creation error:', createError);
      }

      // Fetch again after function call
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      const user: User = {
        id: data.user.id,
        email: data.user.email || null,
        name: newProfile?.name || data.user.user_metadata?.name || null,
        role: (newProfile?.role as UserRole) || 'consumer',
        created_at: data.user.created_at,
      };

      return { user, error: null };
    }

    const user: User = {
      id: data.user.id,
      email: data.user.email || null,
      name: profile?.name || data.user.user_metadata?.name || null,
      role: (profile?.role as UserRole) || 'consumer',
      created_at: data.user.created_at,
    };

    return { user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Google Sign In (Web version - uses redirect flow)
export async function signInWithGoogle(): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    // For web, use the current origin + callback path
    const isBrowser = typeof globalThis !== 'undefined' && 'window' in globalThis;
    
    let redirectTo: string;
    if (isBrowser && (globalThis as any).window?.location) {
      const origin = (globalThis as any).window.location.origin;
      redirectTo = `${origin}/auth/callback`;
      console.log('[signInWithGoogle] Using redirect URL:', redirectTo);
    } else {
      redirectTo = 'http://localhost:3000/auth/callback';
      console.log('[signInWithGoogle] Fallback redirect URL:', redirectTo);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('[signInWithGoogle] OAuth error:', error);
      return { user: null, error: { message: error.message } };
    }

    // For web, redirect to the OAuth URL
    // Supabase will handle the callback and redirect back to redirectTo
    // The session will be automatically established via detectSessionInUrl
    if (data.url && isBrowser && (globalThis as any).window) {
      console.log('[signInWithGoogle] Redirecting to OAuth URL');
      (globalThis as any).window.location.href = data.url;
      // Return a pending state - the actual user will be available after redirect
      return { user: null, error: null };
    }

    console.error('[signInWithGoogle] No OAuth URL returned');
    return { user: null, error: { message: 'Google sign-in failed: No OAuth URL returned' } };
  } catch (error: any) {
    console.error('[signInWithGoogle] Exception:', error);
    return { user: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Sign Out
export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: { message: error.message } };
    }
    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'An error occurred' } };
  }
}

// Get Current User
export async function getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const { data: { user: authUser }, error } = await supabase.auth.getUser();

    if (error || !authUser) {
      return { user: null, error: error ? { message: error.message } : null };
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, try to create it using the function
      const { error: createError } = await supabase.rpc('create_user_profile_if_not_exists', {
        user_id: authUser.id,
        user_email: authUser.email || '',
        user_name: authUser.user_metadata?.name || null,
        user_role: 'consumer',
      });

      // Fetch again after function call (even if it failed, try to get profile)
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      const user: User = {
        id: authUser.id,
      email: authUser.email || null,
        name: newProfile?.name || authUser.user_metadata?.name || null,
        role: (newProfile?.role as UserRole) || 'consumer',
        created_at: authUser.created_at,
      };
      return { user, error: null };
    }

    const user: User = {
      id: authUser.id,
      email: authUser.email || null,
      name: profile?.name || authUser.user_metadata?.name || null,
      role: (profile?.role as UserRole) || 'consumer',
      created_at: authUser.created_at,
    };

    return { user, error: null };
  } catch (error: any) {
    return { user: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Update User Role
export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      return { error: { message: error.message } };
    }

    return { error: null };
  } catch (error: any) {
    return { error: { message: error.message || 'An error occurred' } };
  }
}

