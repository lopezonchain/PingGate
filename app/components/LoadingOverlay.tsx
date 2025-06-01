// src/components/LoadingOverlay.tsx
"use client";

import React, { useEffect } from "react";

interface LoadingOverlayProps {
  onClose?: () => void;
}

export default function LoadingOverlay({ onClose }: LoadingOverlayProps) {
  // Close overlay on any click
  useEffect(() => {
    const handleClick = () => {
      if (onClose) onClose();
    };
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      // Prevent immediate closure on mount—only clicks after render will close
      onClick={(e) => e.stopPropagation()}
    >
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500"></div>
    </div>
  );
}
