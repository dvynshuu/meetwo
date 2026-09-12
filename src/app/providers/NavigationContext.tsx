import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { NavigationEntry } from '../../types';

const RECENT_KEY = 'mw:nav:recent';
const MAX_RECENTS = 10;

interface NavigationContextType {
  history: NavigationEntry[];
  currentIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  recentDestinations: NavigationEntry[];
  pushNavigation: (entry: NavigationEntry) => void;
  goBack: () => NavigationEntry | null;
  goForward: () => NavigationEntry | null;
  clearRecents: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [history, setHistory] = useState<NavigationEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [recentDestinations, setRecentDestinations] = useState<NavigationEntry[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save recents to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentDestinations));
    } catch (e) {
      console.warn('Failed to save recent destinations:', e);
    }
  }, [recentDestinations]);

  const pushNavigation = useCallback((entry: NavigationEntry) => {
    // 1. Update history
    setHistory((prev) => {
      // Truncate any forward history if we are currently mid-stack
      const nextHistory = prev.slice(0, currentIndex + 1);
      // Avoid consecutive duplicate
      const last = nextHistory[nextHistory.length - 1];
      if (last && last.id === entry.id && last.type === entry.type) {
        return nextHistory;
      }
      return [...nextHistory, entry];
    });
    setCurrentIndex((prev) => prev + 1);

    // 2. Update recent destinations (deduplicate and put at front)
    setRecentDestinations((prev) => {
      const filtered = prev.filter((item) => !(item.id === entry.id && item.type === entry.type));
      return [entry, ...filtered].slice(0, MAX_RECENTS);
    });
  }, [currentIndex]);

  const goBack = useCallback((): NavigationEntry | null => {
    if (currentIndex > 0) {
      const targetIndex = currentIndex - 1;
      setCurrentIndex(targetIndex);
      return history[targetIndex] || null;
    }
    return null;
  }, [currentIndex, history]);

  const goForward = useCallback((): NavigationEntry | null => {
    if (currentIndex < history.length - 1) {
      const targetIndex = currentIndex + 1;
      setCurrentIndex(targetIndex);
      return history[targetIndex] || null;
    }
    return null;
  }, [currentIndex, history]);

  const clearRecents = useCallback(() => {
    setRecentDestinations([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {}
  }, []);

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;

  return (
    <NavigationContext.Provider
      value={{
        history,
        currentIndex,
        canGoBack,
        canGoForward,
        recentDestinations,
        pushNavigation,
        goBack,
        goForward,
        clearRecents,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
