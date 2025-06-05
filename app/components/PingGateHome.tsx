// src/components/PingGateHome.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  FiMessageSquare,
  FiSearch,
  FiPlusCircle,
  FiStar,
  FiHelpCircle,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { WarpView } from "../page-client";
import BottomMenu from "./BottomMenu";
import { getActiveServices, Service } from "../services/contractService";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";

interface PingGateHomeProps {
  onAction: (view: WarpView) => void;
}

const PingGateHome: React.FC<PingGateHomeProps> = ({ onAction }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Web3BioProfile>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  // Fetch active services on mount
  useEffect(() => {
    let mounted = true;
    async function fetchServices() {
      try {
        const data = await getActiveServices();
        if (mounted) {
          setServices(data);
        }
      } catch (err) {
        console.error("Error fetching services:", err);
      }
    }
    fetchServices();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Web3.bio profiles for all unique sellers
  useEffect(() => {
    if (services.length === 0) return;
    const uniqueSellers = Array.from(
      new Set(services.map((s) => s.seller.toLowerCase()))
    );
    const ids = uniqueSellers.map((addr) => `farcaster,${addr}`);

    const warp = new WarpcastService();
    async function fetchProfiles() {
      try {
        const bioProfiles: Web3BioProfile[] = await warp.getWeb3BioProfiles(ids);
        const lookup: Record<string, Web3BioProfile> = {};
        bioProfiles.forEach((p) => {
          p.aliases?.forEach((alias) => {
            const [platform, addr] = alias.split(",");
            if (platform === "farcaster") {
              lookup[addr.toLowerCase()] = p;
            }
          });
        });
        setProfiles(lookup);
      } catch (err) {
        console.error("Error fetching Web3.bio profiles:", err);
      }
    }
    fetchProfiles();
  }, [services]);

  // Shuffle once when services load
  const shuffledServices = useMemo(() => {
    const arr = [...services];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [services]);

  // Auto-advance the slider every 5 seconds
  useEffect(() => {
    if (!autoPlay || shuffledServices.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % shuffledServices.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoPlay, shuffledServices]);

  const handlePrev = () => {
    setAutoPlay(false);
    setCurrentIdx((prev) =>
      prev === 0 ? shuffledServices.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setAutoPlay(false);
    setCurrentIdx((prev) => (prev + 1) % shuffledServices.length);
  };

  return (
    <div className="bg-[#0f0d14] text-white flex flex-col h-screen pb-16">
      {/* Header with Logo & Title */}
      <header className="flex flex-col items-center pb-4 px-4">
        <div className="flex items-center space-x-3">
          <img
            src="/PingGateLogo.png"
            alt="PingGate Logo"
            className="w-12 h-12 rounded-full animate-pulse"
          />
          <h1 className="text-3xl font-bold">PingGate</h1>
        </div>
        <p className="text-gray-400 text-center mt-2 leading-snug">
          Monetize your inbox, connect with experts,
          <br />
          or just chat in private.
        </p>
      </header>

      {/* Slider: Random Services with background avatar */}
      <section className="relative w-full overflow-hidden">
        {shuffledServices.length > 0 ? (
          <div className="relative h-40 sm:h-48 md:h-56 lg:h-64">
            <Link
              href={`/user/${shuffledServices[currentIdx].seller}`}
              passHref
            >
              <motion.a
                key={shuffledServices[currentIdx].id.toString()}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 mx-4 rounded-2xl shadow-xl overflow-hidden hover:cursor-pointer"
                style={{
                  backgroundImage: profiles[
                    shuffledServices[currentIdx].seller.toLowerCase()
                  ]?.avatar
                    ? `url("${profiles[
                      shuffledServices[currentIdx].seller.toLowerCase()
                    ].avatar}")`
                    : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: profiles[
                    shuffledServices[currentIdx].seller.toLowerCase()
                  ]?.avatar
                    ? undefined
                    : "#1b1826",
                }}
              >
                {/* Overlay de degradado */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#1b1826]/80 to-[#2f2c42]/80" />

                {/* Titulo */}
                <h2 className="absolute top-0 left-0 w-full bg-black/50 backdrop-blur-sm text-white border-10 text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-center py-2">
                  <p className="glow-modern">{shuffledServices[currentIdx].title}</p>
                </h2>

                <div className="relative z-10 flex flex-col items-center justify-center h-full p-4 pt-12 pb-4">
                  {/* Display Name o Wallet */}
                  <span className="text-indigo-300 text-sm mb-1">
                    {profiles[
                      shuffledServices[currentIdx].seller.toLowerCase()
                    ]?.displayName ||
                      shuffledServices[currentIdx].seller}
                  </span>

                  {/* Descripción */}
                  <p className="text-gray-300 text-xs sm:text-sm text-center mx-4">
                    {profiles[
                      shuffledServices[currentIdx].seller.toLowerCase()
                    ]?.description ||
                      shuffledServices[currentIdx].description}
                  </p>
                </div>
              </motion.a>
            </Link>

            {/* Botones Prev/Next (más grandes, rectangulares, encima del slider) */}
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 h-10 w-8 bg-[#2b283c] rounded-r-md hover:bg-[#3c394f] transition-colors z-20"
              aria-label="Previous"
            >
              <FiChevronLeft size={20} className="text-gray-400" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 h-10 w-8 bg-[#2b283c] rounded-l-md hover:bg-[#3c394f] transition-colors z-20"
              aria-label="Next"
            >
              <FiChevronRight size={20} className="text-gray-400" />
            </button>

            <div className="absolute bottom-0 left-2">
              <span className="text-[0.625rem] text-gray-500">
                Random Experts’ services selection. Thanks for using PingGate
              </span>
            </div>
          </div>
        ) : (
          <div className="h-40 sm:h-48 md:h-56 lg:h-64 flex justify-center items-center text-gray-500">
            Loading services...
          </div>
        )}
      </section>

      {/* Scrollable area under slider */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500 px-4 mt-4">
        {/* Prominent Explore Section */}
        <section className="mb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative bg-[#1a1725] rounded-2xl overflow-hidden p-4"
          >
            {/* Faded background icon */}
            <FiSearch className="absolute text-indigo-600 text-6xl opacity-20 top-4 right-4" />
            <button
              onClick={() => onAction("explore")}
              className="relative w-full flex items-center justify-center space-x-2 py-1"
            >
              <FiSearch size={28} className="text-purple-400" />
              <span className="text-purple-400 font-semibold text-xl">
                Explore Services
              </span>
            </button>
          </motion.div>
        </section>

        {/* Other Options Grid */}
        <section className="mb-4">
          <div className="grid grid-cols-2 gap-4">
            {/* FAQ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="relative bg-[#1a1725] rounded-2xl overflow-hidden p-4"
            >
              <FiHelpCircle className="absolute text-indigo-600 text-5xl opacity-20 top-3 right-3" />
              <button
                onClick={() => onAction("faq")}
                className="relative w-full flex items-center space-x-2 py-3"
              >
                <FiHelpCircle size={24} className="text-purple-400" />
                <span className="text-purple-400 font-medium">FAQ</span>
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Get answers to common questions
              </p>
            </motion.div>

            {/* My Services */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative bg-[#1a1725] rounded-2xl overflow-hidden p-4"
            >
              <FiPlusCircle className="absolute text-indigo-600 text-5xl opacity-20 top-3 right-3" />
              <button
                onClick={() => onAction("myplans")}
                className="relative w-full flex items-center space-x-2 py-3"
              >
                <FiPlusCircle size={24} className="text-purple-400" />
                <span className="text-purple-400 font-medium">
                  My Services
                </span>
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Create & manage your offerings
              </p>
            </motion.div>

            {/* Reviews */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="relative bg-[#1a1725] rounded-2xl overflow-hidden p-4"
            >
              <FiStar className="absolute text-indigo-600 text-5xl opacity-20 top-3 right-3" />
              <button
                onClick={() => onAction("reviews")}
                className="relative w-full flex items-center space-x-2 py-3"
              >
                <FiStar size={24} className="text-purple-400" />
                <span className="text-purple-400 font-medium">
                  Reviews
                </span>
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Reviews of services you bought
              </p>
            </motion.div>

            {/* Pings Inbox */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative bg-[#1a1725] rounded-2xl overflow-hidden p-4"
            >
              <FiMessageSquare className="absolute text-indigo-600 text-5xl opacity-20 top-3 right-3" />
              <button
                onClick={() => onAction("inbox")}
                className="relative w-full flex items-center space-x-2 py-3"
              >
                <FiMessageSquare size={24} className="text-purple-400" />
                <span className="text-purple-400 font-medium">
                  Pings
                </span>
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Check messages & start conversations
              </p>
            </motion.div>
          </div>
        </section>
      </div>

      {/* Footer Branding */}
      <footer className="flex justify-between text-gray-500 text-xs px-4 pb-4 pt-1 mb-16">
        <span>✦ Powered by XMTP</span>
        <span> & Base & Farcaster ✦</span>
      </footer>

      {/* Bottom Navigation Menu */}
      <BottomMenu onAction={onAction} />
    </div>
  );
};

export default PingGateHome;
