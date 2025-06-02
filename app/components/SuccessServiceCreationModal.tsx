// src/components/SuccessServiceCreationModal.tsx
"use client";

import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { FiX, FiCheckCircle, FiShare2 } from "react-icons/fi";
import { useRouter } from "next/navigation";

interface SuccessServiceCreationModalProps {
  sellerAddress: string;
  onClose: () => void;
  onShare?: () => void;
}

export default function SuccessServiceCreationModal({
  sellerAddress,
  onClose,
  onShare,
}: SuccessServiceCreationModalProps) {
  const router = useRouter();

  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 60,
      origin: { y: 0.6 },
    });
  }, []);

  const goToServices = () => {
    router.push(`/user/${sellerAddress}`);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 bg-[#0f0d14] border-t rounded-t-2xl p-6 shadow-xl z-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Service Created!</h3>
        <button onClick={onClose} className="focus:outline-none">
          <FiX size={24} className="text-gray-400" />
        </button>
      </div>
      <div className="flex justify-center mb-6">
        <FiCheckCircle size={64} className="text-green-500" />
      </div>
      <p className="text-center text-gray-300 mb-6">
        Your new service is live!
      </p>
      <button
        onClick={goToServices}
        className="w-full mb-3 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
      >
        Go to Your Services
      </button>
      {onShare && (
        <button
          onClick={onShare}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center justify-center gap-2"
        >
          <FiShare2 size={20} />
          Share Your Services
        </button>
      )}
    </div>
  );
}
