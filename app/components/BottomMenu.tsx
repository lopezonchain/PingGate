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
      <ul className="flex">
        {[
          { key: "faq", icon: FiHelpCircle, label: "FAQ", view: "faq" as const },
          { key: "reviews", icon: FiStar, label: "Reviews", view: "reviews" as const },
          // Central “Pings”
          { key: "inbox", icon: FiMessageSquare, label: "Pings", view: "inbox" as const, highlighted: true },
          { key: "myservices", icon: FiBriefcase, label: "MyServices", view: "myservices" as const },
          { key: "explore", icon: FiSearch, label: "Explore", view: "explore" as const },
        ].map(({ key, icon: Icon, label, view, highlighted }) => (
          <li key={key} className="flex-1">
            <button
              onClick={() => onAction(view)}
              aria-label={label}
              className={`
                group
                w-full
                flex flex-col items-center justify-center
                py-2
                transition-all duration-200
                ${ highlighted
                  ? "-mt-6 bg-[#1a1725] border-2 border-indigo-500 rounded-full p-3 text-white shadow-lg hover:scale-110"
                  : "text-gray-400 hover:text-white hover:bg-indigo-800"
                }
              `}
            >
              <Icon
                size={ highlighted ? 28 : 24 }
                className={highlighted
                  ? ""
                  : "group-hover:text-white transition-colors"
                }
              />
              <span className={`
                text-xs mt-1
                ${ highlighted ? "text-gray-200" : "group-hover:text-white" }
              `}>
                {label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default BottomMenu;
