// src/components/PingGateHome.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  FiMessageSquare,
  FiSearch,
  FiBriefcase,
  FiStar,
  FiHelpCircle,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { WarpView } from "../page-client";
import { getActiveServices, Service } from "../services/contractService";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletClient } from "wagmi";
import AlertModal from "./AlertModal";

interface PingGateHomeProps {
  onAction: (view: WarpView) => void;
}

const DISPLAY_DURATION = 5000;
const FADE_DURATION = 0.8;
const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    scale: 0.8,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: FADE_DURATION,
      ease: [0.175, 0.885, 0.32, 1.275],
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    scale: 0.8,
    transition: { duration: FADE_DURATION / 2 },
  }),
};

const PingGateHome: React.FC<PingGateHomeProps> = ({ onAction }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Web3BioProfile>>({});
  const [[currentIdx, direction], setIndex] = useState<[number, number]>([0, 0]);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [showAlert, setShowAlert] = useState(false);

  // Wagmi wallet client → usar su address para saber si hay conexión
  const { data: walletClient } = useWalletClient();
  const myAddr = walletClient?.account.address.toLowerCase() || "";
  const isConnected = Boolean(myAddr);

  // Fetch services
  useEffect(() => {
    let active = true;
    getActiveServices()
      .then((d) => active && setServices(d))
      .catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  // Fetch profiles
  useEffect(() => {
    if (!services.length) return;
    const uniq = Array.from(
      new Set(services.map((s) => s.seller.toLowerCase()))
    );
    const ids = uniq.map((a) => `farcaster,${a}`);
    new WarpcastService()
      .getWeb3BioProfiles(ids)
      .then((bios) => {
        const map: Record<string, Web3BioProfile> = {};
        bios.forEach((p) =>
          p.aliases?.forEach((alias) => {
            const [pl, addr] = alias.split(",");
            if (pl === "farcaster") map[addr.toLowerCase()] = p;
          })
        );
        setProfiles(map);
      })
      .catch(console.error);
  }, [services]);

  // Shuffle once
  const shuffled = useMemo(() => {
    const a = [...services];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [services]);

  // Preload avatar
  const preload = useCallback(
    async (idx: number) => {
      setReady(false);
      const svc = shuffled[idx];
      const url = profiles[svc.seller.toLowerCase()]?.avatar;
      if (url) {
        await new Promise<void>((res) => {
          const img = new Image();
          img.src = url;
          img.onload = img.onerror = () => res();
        });
      }
      setReady(true);
    },
    [shuffled, profiles]
  );

  // Auto-slide
  useEffect(() => {
    if (!shuffled.length) return;
    preload(currentIdx);
    clearTimeout(timerRef.current!);
    timerRef.current = setTimeout(() => {
      setIndex([(currentIdx + 1) % shuffled.length, 1]);
    }, DISPLAY_DURATION);
    return () => clearTimeout(timerRef.current!);
  }, [currentIdx, preload, shuffled.length]);

  // Manual nav
  const changeSlide = (newDir: number) => {
    clearTimeout(timerRef.current!);
    setIndex([
      (currentIdx + newDir + shuffled.length) % shuffled.length,
      newDir,
    ]);
  };

  const formatPrice = (w: bigint) => {
    const WEI = BigInt("1000000000000000000");
    const whole = w / WEI;
    const frac = w % WEI;
    if (frac === BigInt(0)) return whole.toString();
    const s = frac.toString().padStart(18, "0").replace(/0+$/, "");
    return `${whole.toString()}.${s}`;
  };

  const handleActionClick = useCallback(
    (view: WarpView) => {
      if (view === "faq") {
        onAction(view);
      } else if (!isConnected) {
        setShowAlert(true);
      } else {
        onAction(view);
      }
    },
    [isConnected, onAction]
  );

  return (
    <div className="bg-[#0f0d14] text-white flex flex-col h-full">
      {showAlert && (
        <AlertModal
          message="Please Connect first!"
          onClose={() => setShowAlert(false)}
        />
      )}

      {/* HEADER */}
      <header className="flex flex-col items-center pb-1 px-4 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <img
            src="/PingGateLogo.png"
            alt="PingGate Logo"
            className="w-12 h-12 rounded-full animate-pulse"
          />
          <h1 className="text-3xl font-bold">PingGate</h1>
        </div>
        <p className="text-gray-400 text-sm text-center leading-snug">
          Monetize your inbox, connect with experts,
          <br />
          or just chat!!
        </p>
      </header>

      {/* MAIN */}
      <div className="flex-grow flex flex-col overflow-hidden">
        {/* SLIDER */}
        <section className="relative w-full flex-grow overflow-hidden">
          {shuffled.length > 0 ? (
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={currentIdx}
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0"
              >
                <Link
                  href={`/user/${shuffled[currentIdx].seller}`}
                  className="block w-full h-full bg-center bg-cover rounded-lg shadow-2xl"
                  aria-label="View service"
                  style={{
                    backgroundImage:
                      profiles[shuffled[currentIdx].seller.toLowerCase()]
                        ?.avatar
                        ? `url("${
                            profiles[
                              shuffled[currentIdx].seller.toLowerCase()
                            ].avatar
                          }")`
                        : undefined,
                    backgroundColor:
                      profiles[shuffled[currentIdx].seller.toLowerCase()]
                        ?.avatar === undefined
                        ? "#1b1826"
                        : undefined,
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-black/70 to-gray-900/50" />
                  <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
                    <span className="text-purple-400 text-base sm:text-xl md:text-2xl font-medium mb-1">
                      {
                        profiles[shuffled[currentIdx].seller.toLowerCase()]
                          ?.displayName ?? shuffled[currentIdx].seller
                      }
                    </span>
                    <h2 className="text-white text-2xl font-extrabold text-center leading-tight">
                      {shuffled[currentIdx].title}
                    </h2>
                    <span className="inline-block bg-purple-800 text-white text-lg sm:text-xl font-semibold px-3 py-1 rounded-full mt-4">
                      {formatPrice(shuffled[currentIdx].price)} ETH
                    </span>
                  </div>
                </Link>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              Loading services...
            </div>
          )}

          {/* NAV */}
          <motion.button
            onClick={() => changeSlide(-1)}
            aria-label="Previous"
            className="absolute left-4 bottom-[1px] p-3 bg-white bg-opacity-20 backdrop-blur-sm rounded-full hover:bg-opacity-40 transition z-20"
            initial={{ y: "-50%" }}
            whileHover={{ y: "-50%", scale: 1.2, rotate: -10 }}
          >
            <FiChevronLeft size={32} />
          </motion.button>
          <motion.button
            onClick={() => changeSlide(1)}
            aria-label="Next"
            className="absolute right-4 bottom-[1px] p-3 bg-white bg-opacity-20 backdrop-blur-sm rounded-full hover:bg-opacity-40 transition z-20"
            initial={{ y: "-50%" }}
            whileHover={{ y: "-50%", scale: 1.2, rotate: 10 }}
          >
            <FiChevronRight size={32} />
          </motion.button>
          <div className="absolute bottom-1 w-full flex justify-center text-[0.625rem] text-gray-400 uppercase tracking-widest">
            Random services. Thanks for using PingGate
          </div>
        </section>

        {/* EXPLORE */}
        <div className="mt-1">
          <div
            role="button"
            aria-label="Explore services"
            onClick={() => handleActionClick("explore")}
            className="relative bg-[#1a1725] overflow-hidden p-4 cursor-pointer group"
          >
            <FiSearch className="absolute text-indigo-600 text-6xl opacity-10 top-4 right-4 transform group-hover:rotate-12 transition" />
            <div className="flex items-center justify-center space-x-2 py-1">
              <FiSearch size={28} className="text-purple-400" />
              <span className="text-purple-400 font-semibold text-xl">
                Explore Services
              </span>
            </div>
          </div>
        </div>

        {/* GRID */}
        <div className="mt-1 grid grid-cols-2 gap-1 flex-shrink-0">
          {[
            {
              a: "faq",
              Icon: FiHelpCircle,
              label: "FAQ",
              desc: "Frequently asked questions, answered",
            },
            {
              a: "inbox",
              Icon: FiMessageSquare,
              label: "Pings",
              desc: "Check your messages. START PINGING!",
            },
            {
              a: "reviews",
              Icon: FiStar,
              label: "Reviews",
              desc: "Send or edit reviews of your purchases",
            },
            {
              a: "myservices",
              Icon: FiBriefcase,
              label: "My Services",
              desc: "Create and manage your offerings",
            },
          ].map(({ a, Icon, label, desc }) => (
            <div
              key={a}
              role="button"
              aria-label={label}
              onClick={() => handleActionClick(a as WarpView)}
              className="relative bg-[#1a1725] overflow-hidden p-2 flex flex-col items-center justify-center cursor-pointer group"
            >
              <Icon className="absolute text-indigo-600 text-8xl opacity-10 bottom-0 right-0 translate-x-1/4 translate-y-1/4 group-hover:text-indigo-400 transition" />
              <div className="flex items-center space-x-1 py-2">
                <Icon size={24} className="text-purple-400" />
                <span className="text-purple-400 font-medium">{label}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 max-w-[80%]">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="flex justify-center text-gray-500 text-xs px-4 pt-1 flex-shrink-0">
        <span>✦ Powered by XMTP & Base & Farcaster ✦</span>
      </footer>
    </div>
  );
};

export default PingGateHome;
