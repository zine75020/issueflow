"use client";

import { CloseIcon } from "@/components/icons";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center max-md:p-0 p-4">
      <div
        className="absolute inset-0 bg-black/50 max-md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-xl max-h-[90vh] overflow-y-auto max-md:h-full max-md:max-h-full max-md:max-w-full max-md:rounded-none max-md:border-0"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex items-center justify-center text-muted hover:text-fg max-md:h-11 max-md:w-11"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
