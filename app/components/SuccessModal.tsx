// src/components/SuccessModal.tsx
"use client";

import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { FiX, FiCheckCircle } from "react-icons/fi";
import { useRouter } from "next/navigation";

interface SuccessModalProps {
  peerAddress: string;
  onClose: () => void;
}

export default function SuccessModal({ peerAddress, onClose }: SuccessModalProps) {
  const router = useRouter();

  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 60,
      origin: { y: 0.6 },
    });
  }, []);

  const goToConversation = () => {
    router.push(`/conversation/${peerAddress}`);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 bg-[#0f0d14] border-t rounded-t-2xl p-6 shadow-xl z-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Purchase Successful!</h3>
        <button onClick={onClose} className="focus:outline-none">
          <FiX size={24} className="text-gray-400" />
        </button>
      </div>
      <div className="flex justify-center mb-6">
        <FiCheckCircle size={64} className="text-green-500" />
      </div>
      <p className="text-center text-gray-300 mb-6">
        Your purchase was completed successfully.
      </p>
      <button
        onClick={goToConversation}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
      >
        Go to Conversation
      </button>
    </div>
  );
}
