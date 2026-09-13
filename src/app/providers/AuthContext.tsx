import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserStatus } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { mockStore } from '../../lib/supabase/mockStore';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
  isDemoMode: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (username: string, email: string, password?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  switchDemoUser: (userId: string) => void;
  setStatus: (status: UserStatus) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isProduction =
    (import.meta as any).env?.VITE_APP_ENV === 'production' ||
    (import.meta as any).env?.PROD;

  const loadUserProfile = async (userId: string, authUser?: any): Promise<User> => {
    if (!supabase) throw new Error('Supabase client not initialized');

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        return {
          id: profile.id,
          username: profile.username,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          bio: profile.bio,
          status: profile.status || 'online',
          createdAt: profile.created_at,
        };
      }
    } catch (e) {
      console.warn('Failed to query profile, creating fallback:', e);
    }

    // Fallback if profile row does not exist yet
    const username =
      authUser?.user_metadata?.username ||
      authUser?.email?.split('@')[0] ||
      `user_${userId.slice(0, 6)}`;
    const displayName =
      authUser?.user_metadata?.display_name ||
      authUser?.user_metadata?.username ||
      authUser?.email?.split('@')[0] ||
      'Meetwo Member';

    const fallbackUser: User = {
      id: userId,
      username,
      displayName,
      avatarUrl:
        authUser?.user_metadata?.avatar_url ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
      bio: 'Hey there! I am using Meetwo.',
      status: 'online',
      createdAt: authUser?.created_at || new Date().toISOString(),
    };

    // Attempt to insert profile in database
    try {
      await supabase.from('profiles').insert({
        id: fallbackUser.id,
        username: fallbackUser.username,
        display_name: fallbackUser.displayName,
        avatar_url: fallbackUser.avatarUrl,
        bio: fallbackUser.bio,
        status: fallbackUser.status,
      });
    } catch {}

    return fallbackUser;
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            const user = await loadUserProfile(session.user.id, session.user);
            if (isMounted) setCurrentUser(user);
          } else if (isMounted) {
            // Not logged in
            setCurrentUser(null);
          }
        } else if (isProduction) {
          if (isMounted) {
            setCurrentUser(null);
            setError('Supabase is not configured for production authentication.');
          }
        } else {
          // Development / Local Store mode
          const localUser = mockStore.getCurrentUser();
          if (isMounted) setCurrentUser(localUser);
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initAuth();

    // Setup Supabase auth state change listener (cross-tab sync, token refresh, sign in/out)
    let authSubscription: { unsubscribe: () => void } | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            const user = await loadUserProfile(session.user.id, session.user);
            if (isMounted) setCurrentUser(user);
          }
        } else if (event === 'SIGNED_OUT') {
          if (isMounted) setCurrentUser(null);
        }
      });
      authSubscription = data.subscription;
    }

    // Listen to mock store user updates (multi-tab dev mode)
    const unsubscribeMock = mockStore.subscribe('USER_UPDATED', (updatedUser: User) => {
      if (isMounted) {
        setCurrentUser((prev) => (prev?.id === updatedUser.id ? updatedUser : prev));
      }
    });

    return () => {
      isMounted = false;
      if (authSubscription) authSubscription.unsubscribe();
      unsubscribeMock();
    };
  }, []);

  const login = async (email: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: password || 'password123',
        });
        if (authError) throw authError;

        if (data.user) {
          const user = await loadUserProfile(data.user.id, data.user);
          setCurrentUser(user);
        }
        return true;
      } else {
        // Fallback local mode login
        const existingUsers = mockStore.getAllUsers();
        const existing =
          existingUsers.find(
            (u) =>
              u.username.toLowerCase() === email.toLowerCase() ||
              u.displayName.toLowerCase() === email.toLowerCase()
          ) || {
            id: `user-${Date.now()}`,
            username: email.split('@')[0],
            displayName: email.split('@')[0],
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
            bio: 'Hey there! I am using Meetwo.',
            status: 'online' as UserStatus,
            createdAt: new Date().toISOString(),
          };

        mockStore.setCurrentUser(existing);
        setCurrentUser(existing);
        return true;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (username: string, email: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password: password || 'password123',
          options: {
            data: {
              username,
              display_name: username,
            },
          },
        });
        if (authError) throw authError;

        if (data.user) {
          const user = await loadUserProfile(data.user.id, data.user);
          setCurrentUser(user);
        }
        return true;
      } else {
        // Local mode sign up
        const newUser: User = {
          id: `user-${Date.now()}`,
          username: username.toLowerCase().replace(/\s+/g, '_'),
          displayName: username,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
          bio: 'Hey there! I am using Meetwo.',
          status: 'online',
          createdAt: new Date().toISOString(),
        };
        mockStore.setCurrentUser(newUser);
        setCurrentUser(newUser);
        return true;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      setCurrentUser(null);
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const updated: User = { ...currentUser, ...updates, updatedAt: new Date().toISOString() };
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('profiles')
        .update({
          display_name: updated.displayName,
          username: updated.username,
          bio: updated.bio,
          avatar_url: updated.avatarUrl,
          status: updated.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);
    }
    mockStore.setCurrentUser(updated);
    setCurrentUser(updated);
  };

  const setStatus = async (status: UserStatus) => {
    await updateProfile({ status });
  };

  const switchDemoUser = (userId: string) => {
    if (isProduction) return;
    const target = mockStore.getAllUsers().find((u) => u.id === userId);
    if (target) {
      mockStore.setCurrentUser(target);
      setCurrentUser(target);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        error,
        isDemoMode: !isProduction && !isSupabaseConfigured,
        login,
        signup,
        logout,
        updateProfile,
        switchDemoUser,
        setStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
