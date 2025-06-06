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

  // Nuevo estado: dirección del avance (-1 = izquierda, +1 = derecha)
  const [direction, setDirection] = useState<number>(0);

  // Variants que usan “custom” = dirección:
  //   enter: viene desde derecha (if dir>0) o desde izquierda (if dir<0)
  //   center: posición normal
  //   exit: sale hacia la izquierda (if dir>0) o hacia la derecha (if dir<0)
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 200 : -200,
      scale: 0.95,
      opacity: 1,
    }),
    center: {
      x: 0,
      scale: 1,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -200 : 200,
      scale: 0.95,
      opacity: 1,
    }),
  };

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
    setDirection(-1);
    setCurrentIdx((prev) =>
      prev === 0 ? shuffledServices.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setAutoPlay(false);
    setDirection(1);
    setCurrentIdx((prev) => (prev + 1) % shuffledServices.length);
  };

  // Formatear priceWei (bigint) → ETH, eliminando ceros inútiles a la derecha
  const formatPrice = (priceWei: bigint): string => {
    const WEI_IN_ETH = BigInt("1000000000000000000");
    const integerPart = priceWei / WEI_IN_ETH;
    let fractionalPart = priceWei % WEI_IN_ETH;
    if (fractionalPart === BigInt(0)) {
      return integerPart.toString();
    }
    let fracStr = fractionalPart.toString().padStart(18, "0");
    fracStr = fracStr.replace(/0+$/, "");

    return `${integerPart.toString()}.${fracStr}`;
  };

  return (
    <div className="bg-[#0f0d14] text-white flex flex-col h-screen">
      {/* ======================
          1) HEADER FIJO (PingGate)
          ====================== */}
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
      <div className="mb-20 flex-grow overflow-y-auto scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
        <section className="relative w-full overflow-hidden flex-shrink-0">
          {shuffledServices.length > 0 ? (
            <div className="relative w-full h-56 sm:h-64 md:h-72 lg:h-80 overflow-hidden">
              <Link href={`/user/${shuffledServices[currentIdx].seller}`} passHref>
                <motion.a
                  key={shuffledServices[currentIdx].id.toString()}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 80, damping: 12 }}
                  className="absolute inset-0 block overflow-hidden"
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
                  {/* Overlay de degradado para contraste */}
                  <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-gray-800/40" />

                  {/* Contenido centrado */}
                  <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
                    {/* Nombre del experto (por encima del título) */}
                    <span className="text-indigo-300 text-base sm:text-lg md:text-xl font-medium mb-2">
                      {profiles[
                        shuffledServices[currentIdx].seller.toLowerCase()
                      ]?.displayName ||
                        shuffledServices[currentIdx].seller}
                    </span>

                    {/* Título principal en el centro */}
                    <h2 className="text-white text-xl font-extrabold text-center leading-tight">
                      {shuffledServices[currentIdx].title}
                    </h2>

                    {/* Precio justo debajo del título */}
                    <span className="mt-3 text-gray-200 text-lg sm:text-xl md:text-2xl font-semibold">
                      {formatPrice(shuffledServices[currentIdx].price)} ETH
                    </span>
                  </div>
                </motion.a>
              </Link>

              {/* Flecha Anterior */}
              <button
                onClick={handlePrev}
                className="absolute left-1 top-3/4 transform -translate-y-1/2 p-4 bg-white bg-opacity-20 backdrop-blur-sm rounded-full hover:bg-opacity-30 transition z-30"
                aria-label="Previous"
              >
                <FiChevronLeft size={28} className="text-white" />
              </button>

              {/* Flecha Siguiente */}
              <button
                onClick={handleNext}
                className="absolute right-1 top-3/4 transform -translate-y-1/2 p-4 bg-white bg-opacity-20 backdrop-blur-sm rounded-full hover:bg-opacity-30 transition z-30"
                aria-label="Next"
              >
                <FiChevronRight size={28} className="text-white" />
              </button>

              {/* Mensaje inferior */}
              <div className="absolute bottom-0 left-6">
                <span className="text-[0.625rem] text-gray-400">
                  Random Experts’ services selection. Thanks for using PingGate
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-56 sm:h-64 md:h-72 lg:h-80 flex justify-center items-center text-gray-500">
              Loading services...
            </div>
          )}
        </section>

        {/* Espacio superior opcional para separar del slider */}
        <div className="mt-1" />

        {/* Prominent Explore Section */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative bg-[#1a1725] overflow-hidden p-4"
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
        <section className="mt-1 mb-1">
          <div className="grid grid-cols-2 gap-1">
            {/* FAQ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="relative bg-[#1a1725] overflow-hidden p-4"
            >
              <FiHelpCircle className="absolute text-indigo-600 text-5xl opacity-20 top-3 right-3" />
              <button
                onClick={() => onAction("faq")}
                className="relative w-full flex items-center space-x-1 py-2"
              >
                <FiHelpCircle size={24} className="text-purple-400" />
                <span className="text-purple-400 font-medium">FAQ</span>
              </button>
              <p className="text-xs text-gray-400">
                Get answers to common questions
              </p>
            </motion.div>

            {/* My Services */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative bg-[#1a1725] overflow-hidden p-4"
            >
              <FiPlusCircle className="absolute text-indigo-600 text-5xl opacity-20 top-3 right-3" />
              <button
                onClick={() => onAction("myplans")}
                className="relative w-full flex items-center space-x-1 py-2"
              >
                <FiPlusCircle size={24} className="text-purple-400" />
                <span className="text-purple-400 font-medium">
                  My Services
                </span>
              </button>
              <p className="text-xs text-gray-400">
                Create & manage your offerings
              </p>
            </motion.div>
          </div>
          {/* Si necesitas más secciones debajo del grid, agrégalas aquí */}
        </section>

        <footer className="flex justify-between text-gray-500 text-xs px-4 pt-1 pb-2 mb-14 flex-shrink-0">
          <span>✦ Powered by XMTP</span>
          <span> & Base & Farcaster ✦</span>
        </footer>
      </div>

      <BottomMenu onAction={onAction} />
    </div>
  );
};

export default PingGateHome;
