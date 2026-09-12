import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserStatus } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { mockStore, SEED_USERS } from '../../lib/supabase/mockStore';

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

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              setCurrentUser({
                id: profile.id,
                username: profile.username,
                displayName: profile.display_name,
                avatarUrl: profile.avatar_url,
                bio: profile.bio,
                status: profile.status || 'online',
                createdAt: profile.created_at,
              });
            }
          }
        } else {
          // Demo / Local Store mode
          const localUser = mockStore.getCurrentUser();
          setCurrentUser(localUser);
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen to mock store user updates (multi-tab)
    const unsubscribe = mockStore.subscribe('USER_UPDATED', (updatedUser: User) => {
      setCurrentUser((prev) => (prev?.id === updatedUser.id ? updatedUser : prev));
    });

    return () => unsubscribe();
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
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profile) {
            setCurrentUser({
              id: profile.id,
              username: profile.username,
              displayName: profile.display_name,
              avatarUrl: profile.avatar_url,
              bio: profile.bio,
              status: profile.status || 'online',
              createdAt: profile.created_at,
            });
          }
        }
        return true;
      } else {
        // Fallback / Demo Mode login
        const existing = SEED_USERS.find(
          (u) => u.username.toLowerCase() === email.toLowerCase() || u.displayName.toLowerCase() === email.toLowerCase()
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
          const newUser: User = {
            id: data.user.id,
            username,
            displayName: username,
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
            status: 'online',
            createdAt: new Date().toISOString(),
          };
          setCurrentUser(newUser);
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
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      setCurrentUser(null);
      return;
    }
    // Local / Demo mode fallback
    const guestUser: User = {
      id: `guest-${Date.now()}`,
      username: 'guest',
      displayName: 'Guest User',
      status: 'offline',
      createdAt: new Date().toISOString(),
    };
    mockStore.setCurrentUser(guestUser);
    setCurrentUser(guestUser);
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const updated: User = { ...currentUser, ...updates, updatedAt: new Date().toISOString() };
    if (isSupabaseConfigured && supabase) {
      await supabase.from('profiles').update({
        display_name: updated.displayName,
        username: updated.username,
        bio: updated.bio,
        avatar_url: updated.avatarUrl,
        status: updated.status,
      }).eq('id', currentUser.id);
    }
    mockStore.setCurrentUser(updated);
    setCurrentUser(updated);
  };

  const setStatus = async (status: UserStatus) => {
    await updateProfile({ status });
  };

  const switchDemoUser = (userId: string) => {
    const target = SEED_USERS.find((u) => u.id === userId);
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
        isDemoMode: !isSupabaseConfigured,
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
