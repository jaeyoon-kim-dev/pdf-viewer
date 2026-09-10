'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Popover as Primitive } from '@base-ui/react/popover';
import { Popover } from '@/components/ui/popover';
import { X } from 'lucide-react';
import { elementAnchor, type ReaderAnchor } from '@/lib/popover-anchor';
export default function ReaderPopover({
  anchor,
  onClose,
  children,
  className = '',
  side = 'bottom',
}: {
  anchor?: ReaderAnchor;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  side?: 'top' | 'bottom';
}) {
  // A pointer-up can mount this popover before the same gesture's click arrives.
  // Only a subsequent pointer-down may begin an outside-click dismissal.
  const outsideArmed = useRef(false);
  useEffect(() => {
    const arm = () => {
      outsideArmed.current = true;
    };
    document.addEventListener('pointerdown', arm, true);
    return () => document.removeEventListener('pointerdown', arm, true);
  }, []);
  const [fallback] = useState(() =>
    document.activeElement && document.activeElement !== document.body
      ? elementAnchor(document.activeElement)
      : { getBoundingClientRect: () => new DOMRect(48, 140, 1, 1) },
  );
  return (
    <Popover
      open
      modal={false}
      onOpenChange={(open, details) => {
        if (
          !open &&
          (details.reason === 'outside-press' ||
            details.reason === 'focus-out') &&
          !outsideArmed.current
        ) {
          details.cancel();
          return;
        }
        if (!open) onClose();
      }}
    >
      <Primitive.Portal>
        <Primitive.Positioner
          anchor={anchor || fallback}
          positionMethod="fixed"
          side={side}
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="reader-popover-positioner"
        >
          <Primitive.Popup
            initialFocus={false}
            finalFocus={false}
            className={`reader-popover ${className}`}
          >
            <button
              className="icon-button popover-close"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={16} />
            </button>
            {children}
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Popover>
  );
}
