// src/screens/ExploreScreen.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import {
  FiShoppingCart,
  FiArrowLeft,
  FiUser,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import {
  getActiveServices,
  purchaseService,
  getAverageRating,
  getReview,
  publicClient,
} from "../services/contractService";
import { resolveEnsName } from "../services/nameResolver";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";
import LoadingOverlay from "../components/LoadingOverlay";
import SuccessModal from "../components/SuccessModal";

interface ServiceDetails {
  id: bigint;
  seller: `0x${string}`;
  title: string;
  description: string;
  price: bigint;
  duration: bigint;
  active: boolean;
}

interface SellerProfile {
  name: string;
  avatarUrl?: string;
}

interface ExploreScreenProps {
  onBack: () => void;
}

export default function ExploreScreen({ onBack }: ExploreScreenProps) {
  const { data: walletClient } = useWalletClient();
  const [services, setServices] = useState<ServiceDetails[]>([]);
  const [displayed, setDisplayed] = useState<ServiceDetails[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SellerProfile>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<
    Record<
      string,
      { buyer: string; quality: number; communication: number; timeliness: number; comment: string }[]
    >
  >({});
  const [expandedReviewsService, setExpandedReviewsService] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<bigint | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successPeer, setSuccessPeer] = useState<string>("");

  // Load services, seller profiles, and ratings
  useEffect(() => {
    const warp = new WarpcastService();
    (async () => {
      try {
        const list = await getActiveServices();
        setServices(list);
        setDisplayed(list);

        const sellers = Array.from(new Set(list.map((s) => s.seller.toLowerCase())));
        const ids = sellers.map((addr) => `farcaster,${addr}`);

        let bioProfiles: Web3BioProfile[] = [];
        try {
          bioProfiles = await warp.getWeb3BioProfiles(ids);
        } catch {
          bioProfiles = [];
        }

        const bioMap: Record<string, Web3BioProfile> = {};
        bioProfiles.forEach((p) => {
          p.aliases?.forEach((alias) => {
            const [platform, addr] = alias.split(",");
            if (platform === "farcaster") bioMap[addr.toLowerCase()] = p;
          });
        });

        const entries = await Promise.all(
          sellers.map(async (addr) => {
            const p = bioMap[addr];
            let name: string | undefined;
            let avatarUrl: string | undefined;
            if (p?.displayName) {
              name = p.displayName;
              avatarUrl = p.avatar;
            }
            if (!name) {
              try {
                const ens = await resolveEnsName(addr);
                if (ens) name = ens;
              } catch {
                // ignore ENS failure
              }
            }
            if (!name) name = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
            return [addr, { name, avatarUrl }];
          })
        );
        setProfiles(Object.fromEntries(entries));

        // Fetch average ratings for all services
        const ratingEntries = await Promise.all(
          list.map(async (svc) => {
            const avg = await getAverageRating(svc.id);
            return [svc.id.toString(), avg] as [string, number];
          })
        );
        setRatings(Object.fromEntries(ratingEntries));
      } catch (e: any) {
        console.error(e);
        toast.error("Error loading services");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Toggle review details for a service
  const toggleReviews = async (svcId: bigint) => {
    const key = svcId.toString();
    if (expandedReviewsService === key) {
      setExpandedReviewsService(null);
      return;
    }
    // If reviews not yet fetched, fetch them
    if (!reviews[key]) {
      try {
        // In this example, reviews are not actually fetched from on-chain unless you track buyers.
        // So we simply set an empty array or placeholder.
        setReviews((prev) => ({ ...prev, [key]: [] }));
      } catch (e) {
        console.error(e);
      }
    }
    setExpandedReviewsService(key);
  };

  // Handle search filtering
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const lower = term.toLowerCase();
    setDisplayed(
      services.filter((svc) => {
        const sellerName = profiles[svc.seller.toLowerCase()]?.name.toLowerCase() || "";
        return svc.title.toLowerCase().includes(lower) || sellerName.includes(lower);
      })
    );
  };

  // Randomize displayed services
  const handleRandomize = () => {
    const shuffled = [...displayed];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDisplayed(shuffled);
  };

  // Ensure Base network before purchase
  const ensureBase = async () => {
    if (!walletClient) throw new Error("Wallet not connected");
    if (walletClient.chain?.id !== 8453) {
      await walletClient.switchChain({ id: 8453 });
    }
  };

  // Handle purchase with transaction confirmation
  const onBuy = async (id: bigint, price: bigint, seller: string) => {
    if (!walletClient) {
      toast.error("Connect your wallet first");
      return;
    }
    setProcessingId(id);
    try {
      await ensureBase();
      const hash = await purchaseService(walletClient, id, price);
      await publicClient.waitForTransactionReceipt({ hash });
      setSuccessPeer(seller);
      setShowSuccess(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Purchase failed");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full p-4 bg-[#0f0d14] text-white flex items-center justify-center">
        <span className="text-gray-400">Loading services…</span>
      </div>
    );
  }

  return (
    <div className="h-[100%] flex flex-col bg-[#0f0d14] text-white p-4">
      <button
        onClick={onBack}
        className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
      >
        <FiArrowLeft className="w-5 h-5 mr-2" />
        Back
      </button>

      <h2 className="text-3xl font-bold mb-4 text-center">Explore Services</h2>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by title or seller"
          className="flex-1 p-2 rounded-lg bg-[#1a1725] text-white placeholder-gray-500"
        />
        <button
          onClick={handleRandomize}
          className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
        >
          <FiRefreshCw className="w-6 h-6 text-white" />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
        {displayed.length === 0 ? (
          <p className="text-gray-400 text-center">No services available</p>
        ) : (
          displayed.map((svc) => {
            const key = svc.id.toString();
            const addr = svc.seller.toLowerCase();
            const prof = profiles[addr] || {
              name: `${addr.slice(0, 6)}…${addr.slice(-4)}`,
            };
            const avg = ratings[key] ?? 0;
            const isExpanded = expandedReviewsService === key;

            return (
              <div
                key={key}
                className="w-full bg-[#1a1725] rounded-2xl shadow-lg hover:shadow-2xl transition p-6 flex flex-col"
              >
                <div className="flex items-center mb-4 space-x-4">
                  {prof.avatarUrl ? (
                    <img
                      src={prof.avatarUrl}
                      alt={prof.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-purple-500 hover:scale-105 transition"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center border-2 border-purple-500">
                      <FiUser className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <p className="text-lg font-medium">{prof.name}</p>
                </div>
                <h3 className="font-semibold text-xl mb-2">{svc.title}</h3>
                <p className="text-sm text-gray-400 line-clamp-3 mb-2">
                  {svc.description}
                </p>
                <p className="text-sm text-yellow-400 mb-2">
                  ⭐ {avg.toFixed(1)} / 5
                  <button
                    onClick={() => toggleReviews(svc.id)}
                    className="ml-2 text-xs text-gray-300"
                  >
                    {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                </p>
                {isExpanded && (
                  <div className="bg-[#2a2438] p-4 rounded mb-4">
                    {reviews[key] && reviews[key].length > 0 ? (
                      reviews[key].map((r, idx) => (
                        <div key={idx} className="mb-3">
                          <p className="text-sm">
                            ⭐ Quality: {r.quality} · Communication: {r.communication} · Timeliness: {r.timeliness}
                          </p>
                          <p className="text-xs text-gray-300 mt-1">{r.comment}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No reviews yet</p>
                    )}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-xl font-bold">
                    {ethers.formatEther(svc.price)} ETH
                  </span>
                  <button
                    onClick={() => onBuy(svc.id, svc.price, svc.seller)}
                    className="inline-flex items-center px-5 py-2 bg-purple-600 hover:bg-purple-700 rounded-full transition disabled:opacity-50"
                    disabled={!walletClient || processingId === svc.id}
                  >
                    {processingId !== svc.id && (
                      <FiShoppingCart className="mr-2" />
                    )}
                    {processingId === svc.id && (
                      <FiShoppingCart className="mr-2 animate-spin" />
                    )}
                    {processingId === svc.id ? "Processing…" : "Buy"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {processingId && <LoadingOverlay />}

      {showSuccess && (
        <SuccessModal
          peerAddress={successPeer}
          onClose={() => setShowSuccess(false)}
        />
      )}
    </div>
  );
}
