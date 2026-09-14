import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: string;
  showHandle?: boolean;
  className?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  headerAction,
  children,
  maxHeight = '85vh',
  showHandle = true,
  className = '',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const [dragY, setDragY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Touch drag-to-dismiss gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    currentYRef.current = touch.clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    currentYRef.current = touch.clientY;
    const deltaY = currentYRef.current - startYRef.current;
    if (deltaY > 0) {
      // Dragging downward
      setDragY(deltaY);
    } else {
      // Slight upward resistance
      setDragY(deltaY * 0.15);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const deltaY = currentYRef.current - startYRef.current;
    if (deltaY > 80) {
      onClose();
    }
    setDragY(0);
  };

  if (!isOpen) return null;

  const content = (
    <div className="bottom-sheet-portal" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="bottom-sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        ref={sheetRef}
        className={`bottom-sheet-container ${className} ${isDragging ? 'is-dragging' : ''}`}
        style={{
          maxHeight,
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle Bar */}
        {showHandle && (
          <div className="bottom-sheet-handle-wrap">
            <div className="bottom-sheet-handle" />
          </div>
        )}

        {/* Header (optional) */}
        {(title || headerAction) && (
          <div className="bottom-sheet-header">
            <div className="bottom-sheet-title">{title}</div>
            <div className="bottom-sheet-actions">
              {headerAction}
              <button
                type="button"
                className="bottom-sheet-close-btn"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="bottom-sheet-body" onTouchStart={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
