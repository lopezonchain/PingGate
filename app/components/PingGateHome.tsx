// src/components/PingGateHome.tsx
"use client";

import React, { useCallback, useState } from "react";
import {
  FiUser,
  FiInbox,
  FiSearch,
  FiPlusCircle,
  FiInfo,
  FiStar,
  FiAirplay
} from "react-icons/fi";
import { WarpView } from "../page-client";
import { motion } from 'framer-motion';

interface PingGateHomeProps {
  onAction: (view: WarpView) => void;
}

const PingGateHome: React.FC<PingGateHomeProps> = ({ onAction }) => {
  const [openDesc, setOpenDesc] = useState<string | null>(null);

  const actions: {
    icon: JSX.Element;
    label: string;
    desc: string;
    action: WarpView;
    enabled: boolean;
    fee: number;
  }[] = [
    {
      icon: <FiInbox />,
      label: "Inbox",
      desc: "View and reply to messages. Chats are sorted by latest activity, with unread indicators.",
      action: "inbox",
      enabled: true,
      fee: 0,
    },
    {
      icon: <FiPlusCircle />,
      label: "My Services",
      desc: "Create and manage your own paid DM or consultation offerings.",
      action: "myplans",
      enabled: false,
      fee: 0,
    },
    {
      icon: <FiSearch />,
      label: "Explore",
      desc: "Browse other users' profiles and plans. Pay to message and start chatting.",
      action: "explore",
      enabled: false,
      fee: 0,
    },
    {
      icon: <FiStar />,
      label: "Reviews",
      desc: "Check feedback from users or leave reviews after your own interactions.",
      action: "reviews",
      enabled: false,
      fee: 0,
    },
  ];

  const handleShare = useCallback(() => {
    const text = `Try PingGate 💬 Monetize your inbox or message experts onchain! Powered by @xmtp @base & @farcaster and created by @lopezonchain.eth ✨ https://pinggate.lopezonchain.xyz`;
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }, []);

  return (
    <div className="bg-[#0f0d14] text-white px-4 py-3 flex flex-col items-center w-full">
      {/* Header */}
      <div className="flex items-end mb-4 items-center">
        <h1 className="text-4xl font-bold">PingGate</h1>
        <img
          src="/PingGateLogo.png"
          alt="PingGate Logo"
          className="w-12 h-12 ml-4 rounded-full animate-pulse"/>
      </div>
      <p className="text-sm text-gray-400 mb-6 text-center leading-snug">
        Monetize your inbox, connect with experts or just chat
      </p>

      {/* Actions list */}
      <div className="flex flex-col space-y-4 w-full max-w-md">
        {actions.map(({ icon, label, desc, action, enabled, fee }, idx) => {
          const isOpen = openDesc === action;

          return (
            <motion.div
              key={action}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
            >
              <div className="relative">
                <motion.button
                  onClick={() => enabled && onAction(action)}
                  disabled={!enabled}
                  whileHover={enabled ? { scale: 1.02 } : {}}
                  whileTap={enabled ? { scale: 0.98 } : {}}
                  className={`
                    relative w-full rounded-2xl px-5 py-4 pr-16 flex items-center
                    ${enabled
                      ? 'bg-[#1a1725] hover:shadow-lg'
                      : 'bg-[#1a1725] opacity-50 cursor-not-allowed'}
                    transition-shadow duration-200
                  `}
                >
                  {/* Icon + label */}
                  <div className="flex justify-center items-center w-full space-x-2">
                    <span className="text-lg">{icon}</span>
                    <span className="font-semibold text-xl">
                      {label}
                    </span>
                  </div>

                  {/* Info toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDesc(isOpen ? null : action);
                    }}
                    className="absolute inset-y-0 right-0 w-12 flex items-center justify-center"
                    aria-label="Show description"
                  >
                    <div className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors">
                      <FiInfo className="text-2xl" />
                    </div>
                  </button>
                </motion.button>

                {/* Description */}
                <div
                  className={`
                    overflow-hidden transition-[max-height] duration-300
                    ${isOpen ? 'max-h-40 mt-2' : 'max-h-0'}
                  `}
                >
                  <p className="text-s text-gray-400 px-6 pb-2">{desc}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Share + Support */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: actions.length * 0.1, duration: 0.5 }}
        className="flex flex-col mt-6 w-full max-w-sm space-y-2"
      >
        <motion.button
          onClick={handleShare}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex justify-center items-center py-3 rounded-2xl bg-purple-600
            hover:bg-purple-700 transition-colors duration-200 shadow-lg">
          <FiAirplay className="mr-2" /> Share <FiAirplay className="ml-2" />
        </motion.button>
      </motion.div>

      {/* Footer */}
      <footer className="mt-4 text-xs text-gray-500 text-center">
        ✦ Powered by XMTP, Base & Farcaster ✦
      </footer>
    </div>
  );
};

export default PingGateHome;
