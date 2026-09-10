'use client';
import { useState, type ReactNode } from 'react';
import { Popover as Primitive } from '@base-ui/react/popover';
import { Popover } from '@/components/ui/popover';
import { X } from 'lucide-react';
import { elementAnchor, type ReaderAnchor } from '@/lib/popover-anchor';
export default function ReaderPopover({
  anchor,
  onClose,
  children,
  className = '',
}: {
  anchor?: ReaderAnchor;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [fallback] = useState(() =>
    document.activeElement && document.activeElement !== document.body
      ? elementAnchor(document.activeElement)
      : { getBoundingClientRect: () => new DOMRect(48, 140, 1, 1) },
  );
  return (
    <Popover
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Primitive.Portal>
        <Primitive.Positioner
          anchor={anchor || fallback}
          positionMethod="fixed"
          side="bottom"
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
