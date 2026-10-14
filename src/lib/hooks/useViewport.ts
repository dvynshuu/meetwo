import { useState, useEffect } from 'react';

export interface ViewportState {
  width: number;
  height: number;
  visualViewportHeight: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isKeyboardOpen: boolean;
  keyboardHeight: number;
}

export function useViewport(): ViewportState {
  const [viewport, setViewport] = useState<ViewportState>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    const vv = typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.height : h;
    const kbHeight = Math.max(0, h - vv);
    const isKbOpen = kbHeight > 150;

    return {
      width: w,
      height: h,
      visualViewportHeight: vv,
      isMobile: w < 768,
      isTablet: w >= 768 && w <= 1024,
      isDesktop: w > 1024,
      isLandscape: w > h,
      isKeyboardOpen: isKbOpen,
      keyboardHeight: kbHeight,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUpdate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const vv = window.visualViewport ? window.visualViewport.height : h;
      const kbHeight = Math.max(0, h - vv);
      const isKbOpen = kbHeight > 150;

      // Synchronize CSS custom properties on documentElement for instant CSS layout reactivity
      document.documentElement.style.setProperty('--viewport-height', `${h}px`);
      document.documentElement.style.setProperty('--visual-viewport-height', `${vv}px`);
      document.documentElement.style.setProperty('--keyboard-height', `${kbHeight}px`);

      setViewport({
        width: w,
        height: h,
        visualViewportHeight: vv,
        isMobile: w < 768,
        isTablet: w >= 768 && w <= 1024,
        isDesktop: w > 1024,
        isLandscape: w > h,
        isKeyboardOpen: isKbOpen,
        keyboardHeight: kbHeight,
      });
    };

    // Initialize CSS properties immediately on mount
    handleUpdate();

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('orientationchange', handleUpdate, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleUpdate, { passive: true });
      window.visualViewport.addEventListener('scroll', handleUpdate, { passive: true });
    }

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleUpdate);
        window.visualViewport.removeEventListener('scroll', handleUpdate);
      }
    };
  }, []);

  return viewport;
}
