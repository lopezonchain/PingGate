import React from "react";
import { FiArrowLeft } from "react-icons/fi";
import FaqList from "./FAQList";

interface FaqScreenProps {
  onBack: () => void;
}

export default function FaqScreen({ onBack }: FaqScreenProps) {
  return (
    <div className="h-full flex flex-col bg-[#0f0d14] text-white p-4">
      <button
        onClick={onBack}
        className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
      >
        <FiArrowLeft className="w-5 h-5 mr-2" />
        Back
      </button>

      <h2 className="text-3xl font-bold mb-4 text-center">FAQ</h2>

      <FaqList />
    </div>
  );
}
