// src/components/BottomMenu.tsx
"use client";

import React from "react";
import {
  FiSearch,
  FiStar,
  FiHelpCircle,
  FiMessageSquare,
  FiBriefcase,
} from "react-icons/fi";
import { WarpView } from "../page-client";

interface BottomMenuProps {
  onAction: (view: WarpView) => void;
}

const BottomMenu: React.FC<BottomMenuProps> = ({ onAction }) => {
  return (
    <nav className="fixed bottom-0 left-0 w-full bg-[#1a1725] border-t border-[#2a2735] z-50">
      <ul className="flex items-center px-4">
        {/* FAQ */}
        <li className="flex-1 flex flex-col items-center">
          <button
            onClick={() => onAction("faq")}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="FAQ"
          >
            <FiHelpCircle size={24} />
          </button>
          <span className="text-xs text-gray-400 mt-1">FAQ</span>
        </li>

        {/* Reviews */}
        <li className="flex-1 flex flex-col items-center">
          <button
            onClick={() => onAction("reviews")}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Reviews"
          >
            <FiStar size={24} />
          </button>
          <span className="text-xs text-gray-400 mt-1">Reviews</span>
        </li>

        {/* Pings (highlighted) */}
        <li className="flex-1 flex flex-col items-center relative -mt-6">
          <button
            onClick={() => onAction("inbox")}
            className="bg-[#1a1725] border-2 border-indigo-500 rounded-full p-4 text-white hover:shadow-lg transition-shadow duration-200"
            aria-label="Pings"
          >
            <FiMessageSquare size={28} />
          </button>
          <span className="text-xs text-gray-400 mt-1">Pings</span>
        </li>

        {/* My Services */}
        <li className="flex-1 flex flex-col items-center">
          <button
            onClick={() => onAction("myplans")}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="My Services"
          >
            <FiBriefcase size={24} />
          </button>
          <span className="text-xs text-gray-400 mt-1">My Services</span>
        </li>

        {/* Explore */}
        <li className="flex-1 flex flex-col items-center">
          <button
            onClick={() => onAction("explore")}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Explore"
          >
            <FiSearch size={24} />
          </button>
          <span className="text-xs text-gray-400 mt-1">Explore</span>
        </li>
      </ul>
    </nav>
  );
};

export default BottomMenu;
