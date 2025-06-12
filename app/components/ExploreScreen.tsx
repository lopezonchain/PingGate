// src/screens/ExploreScreen.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useWalletClient, useAccount } from "wagmi";
import { FiRefreshCw } from "react-icons/fi";
import toast from "react-hot-toast";
import {
  getActiveServices,
  purchaseService,
  getAverageRating,
  getReview,
  getSalesBy,
  publicClient,
  Service,
} from "../services/contractService";
import { resolveEnsName } from "../services/nameResolver";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";
import LoadingOverlay from "../components/LoadingOverlay";
import SuccessModal from "../components/SuccessModal";
import ServiceCard from "./ServiceCard";
import BottomMenu from "./BottomMenu";
import { WarpView } from "../page-client";
import { base } from "viem/chains";
import { badWords } from "./PingGateHome";

interface SellerProfile {
  name: string;
  avatarUrl?: string;
}

interface ExploreScreenProps {
  onAction: (view: WarpView) => void;
}

export default function ExploreScreen({ onAction }: ExploreScreenProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [services, setServices] = useState<Service[]>([]);
  const [displayed, setDisplayed] = useState<Service[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SellerProfile>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<
    Record<string, { buyer: string; quality: number; communication: number; timeliness: number; comment: string }[]>
  >({});
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<bigint | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successPeer, setSuccessPeer] = useState<string>("");

  // Load all data on mount
  useEffect(() => {
    const warp = new WarpcastService();
    (async () => {
      try {
        // Cargamos todos los servicios
        const list = await getActiveServices();

        // Filtramos los que contienen malas palabras en el title o seller
        const filtered = list.filter((svc) => {
          const text = `${svc.title} ${svc.seller}`.toLowerCase();
          return !badWords.some((w) => text.includes(w));
        });

        // Guardamos los filtrados
        setServices(filtered);
        setDisplayed(filtered);

        // Load profiles usando `filtered`
        const sellers = Array.from(
          new Set(filtered.map((s) => s.seller.toLowerCase()))
        );
        const ids = sellers.map((a) => `farcaster,${a}`);
        let bios: Web3BioProfile[] = [];
        try {
          bios = await warp.getWeb3BioProfiles(ids);
        } catch {}
        const bioMap: Record<string, Web3BioProfile> = {};
        bios.forEach((p) =>
          p.aliases?.forEach((alias) => {
            const [ref, addr] = alias.split(",");
            if (ref === "farcaster") bioMap[addr.toLowerCase()] = p;
          })
        );
        const profEntries = await Promise.all(
          sellers.map(async (addr) => {
            const p = bioMap[addr];
            let name = p?.displayName;
            const avatarUrl = p?.avatar;
            if (!name) {
              try {
                name = await resolveEnsName(addr);
              } catch {}
            }
            if (!name) name = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
            return [addr, { name, avatarUrl }] as const;
          })
        );
        setProfiles(Object.fromEntries(profEntries));

        // Load ratings usando `filtered`
        const ratingEntries = await Promise.all(
          filtered.map(async (svc) => [
            svc.id.toString(),
            await getAverageRating(svc.id),
          ] as [string, number])
        );
        setRatings(Object.fromEntries(ratingEntries));

        // Load reviews usando `filtered`
        const reviewEntries = await Promise.all(
          filtered.map(async (svc) => {
            const sales = await getSalesBy(svc.seller);
            const buyers = sales
              .filter((r) => r.serviceId === svc.id)
              .map((r) => r.buyer);
            const revs = await Promise.all(
              buyers.map(async (b) => {
                const r = await getReview(svc.id, b);
                return {
                  buyer: b,
                  quality: r.quality,
                  communication: r.communication,
                  timeliness: r.timeliness,
                  comment: r.comment,
                };
              })
            );
            return [svc.id.toString(), revs] as [string, typeof revs];
          })
        );
        setReviews(Object.fromEntries(reviewEntries));
      } catch (e) {
        console.error(e);
        toast.error("Error loading services");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // toggle expand
  const toggleReviews = (id: bigint) => {
    const key = id.toString();
    setExpandedService((prev) => (prev === key ? null : key));
  };

  // search/filter
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const low = term.toLowerCase();
    setDisplayed(
      services.filter((svc) => {
        const sellerName = profiles[svc.seller.toLowerCase()]?.name.toLowerCase() || "";
        return svc.title.toLowerCase().includes(low) || sellerName.includes(low);
      })
    );
  };

  const handleRandomize = () => {
    const arr = [...displayed];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setDisplayed(arr);
  };

  // 2) Ensure the user is on Base network before a tx
  async function ensureBaseNetwork(): Promise<boolean> {
    if (!walletClient) {
      toast.error("Connect your wallet first");
      return false;
    }
    if (walletClient.chain?.id !== base.id) {
      try {
        await walletClient.switchChain(base);
        // wallet prompt appears; user must approve
        toast.success("Switched to Base network");
        return false; // transaction must be retried
      } catch {
        toast.error("Please switch your wallet to the Base network");
        return false;
      }
    }
    return true;
  }

  // 3) Buy flow
  const onBuy = async (id: bigint, price: bigint, sellerAddress: string) => {
    setProcessingId(id);
    try {
      const ok = await ensureBaseNetwork();
      if (!ok) {
        setProcessingId(null);
        return;
      }
      const hash = await purchaseService(walletClient!, id, price);
      await publicClient.waitForTransactionReceipt({ hash });
      setSuccessPeer(sellerAddress);
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
      <div className="h-full bg-[#0f0d14] text-white flex items-center justify-center">
        <span className="text-gray-400">Loading services…</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0f0d14] text-white py-2">
      <div className="flex-1 flex flex-col min-h-0 pb-14">
        <h2 className="text-3xl font-bold mb-4 text-center">Explore Services</h2>

        <div className="flex items-center gap-2 mb-4 px-4">
          <input
            className="flex-1 p-2 rounded-lg bg-[#1a1725] text-white"
            placeholder="Search by title or seller"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button onClick={handleRandomize} className="p-2 bg-purple-600 rounded-lg">
            <FiRefreshCw className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex-1 flex flex-col py-2 overflow-y-auto scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
          {displayed.length === 0 ? (
            <p className="text-gray-400 text-center">No services available</p>
          ) : (
            displayed.map((svc) => {
              const key = svc.id.toString();
              const addr = svc.seller.toLowerCase();
              const prof = profiles[addr] || { name: `${addr.slice(0, 6)}…${addr.slice(-4)}` };
              return (
                <ServiceCard
                  key={key}
                  svc={svc}
                  prof={prof}
                  avgRating={ratings[key] ?? 0}
                  reviews={reviews[key] || []}
                  isExpanded={expandedService === key}
                  onToggleReviews={() => toggleReviews(svc.id)}
                  onBuy={(id, price) => onBuy(id, price, addr)}
                  processingId={processingId}
                  walletConnected={!!walletClient}
                />
              );
            })
          )}
        </div>

        <BottomMenu onAction={onAction} />
      </div>

      {processingId !== null && <LoadingOverlay />}
      {showSuccess && <SuccessModal peerAddress={successPeer} onClose={() => setShowSuccess(false)} />}
    </div>
  );
}
