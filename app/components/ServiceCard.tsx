// src/components/ServiceCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiUser, FiChevronDown, FiChevronUp, FiShoppingCart } from "react-icons/fi";
import { ethers } from "ethers";
import { Service } from "../services/contractService";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";

interface Review {
  buyer: string;
  quality: number;
  communication: number;
  timeliness: number;
  comment: string;
}

export interface SellerProfile {
  name: string;
  avatarUrl?: string;
}

interface ServiceCardProps {
  svc: Service;
  prof: SellerProfile;
  avgRating: number;
  reviews: Review[];
  isExpanded: boolean;
  onToggleReviews: (id: bigint) => void;
  onBuy: (id: bigint, price: bigint, seller: string) => void;
  processingId: bigint | null;
  walletConnected: boolean;
}

function abbreviateAddress(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  svc,
  prof,
  avgRating,
  reviews,
  isExpanded,
  onToggleReviews,
  onBuy,
  processingId,
  walletConnected,
}) => {
  // Filtrar reviews con comentario y puntuación
  const meaningful = reviews.filter(
    (r) =>
      r.comment.trim() !== "" &&
      (r.quality > 0 || r.communication > 0 || r.timeliness > 0)
  );
  const count = meaningful.length;

  // Warpcast para cargar perfiles de buyers
  const warpcast = useMemo(() => new WarpcastService(), []);
  const [buyerProfiles, setBuyerProfiles] = useState<Record<string, Web3BioProfile>>({});

  useEffect(() => {
    if (!isExpanded || count === 0) return;

    const addrs = meaningful
      .map((r) => r.buyer.toLowerCase())
      .filter((a, i, arr) => !!a && !buyerProfiles[a] && arr.indexOf(a) === i);

    if (addrs.length === 0) return;

    (async () => {
      try {
        const ids = addrs.map((a) => `farcaster,${a}`);
        const bios = await warpcast.getWeb3BioProfiles(ids);
        const aliasMap: Record<string, Web3BioProfile> = {};
        bios.forEach((p) =>
          p.aliases?.forEach((alias) => {
            const [, addr] = alias.split(",");
            aliasMap[addr.toLowerCase()] = p;
          })
        );
        setBuyerProfiles((prev) => ({
          ...prev,
          ...aliasMap,
        }));
      } catch (e) {
        console.error("Error fetching buyer profiles:", e);
      }
    })();
  }, [isExpanded, meaningful, warpcast, buyerProfiles]);

  return (
    <div className="w-full bg-[#1a1725] rounded-2xl shadow-lg hover:shadow-2xl transition p-6 flex flex-col mb-2">
      {/* Header vendedor */}
      <div className="flex items-center mb-4 space-x-4">
        {prof.avatarUrl ? (
          <Link href={`/user/${svc.seller.toLowerCase()}`}>
            <img
              src={prof.avatarUrl}
              alt={prof.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-purple-500 hover:scale-105 transition cursor-pointer"
            />
          </Link>
        ) : (
          <Link href={`/user/${svc.seller.toLowerCase()}`}>
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center border-2 border-purple-500 cursor-pointer">
              <FiUser className="w-6 h-6 text-gray-400" />
            </div>
          </Link>
        )}
        <Link href={`/user/${svc.seller.toLowerCase()}`}>
          <p className="text-lg font-medium cursor-pointer">{prof.name}</p>
        </Link>
      </div>

      {/* Título y descripción */}
      <h3 className="font-semibold text-xl mb-2">{svc.title}</h3>
      <p className="text-sm text-gray-400 mb-2 break-words whitespace-pre-wrap">
        {svc.description}
      </p>

      {/* Rating / reviews */}
      {count > 0 ? (
        <button
          onClick={() => onToggleReviews(svc.id)}
          className="ml-2 text-xs text-gray-300"
        >
          <p className="text-sm text-yellow-400 mb-2 flex items-center">
            ⭐ {avgRating.toFixed(1)} / 5.0 ({count} {count === 1 ? "review" : "reviews"})
            {isExpanded ? <FiChevronUp className="ml-1" /> : <FiChevronDown className="ml-1" />}
          </p>
        </button>
      ) : (
        <p className="text-sm text-gray-400 mb-2">⭐ 0 reviews</p>
      )}

      {/* Detalle de reviews */}
      {isExpanded && count > 0 && (
        <div className="bg-[#2a2438] p-4 rounded mb-4 space-y-3">
          {meaningful.map((r, idx) => {
            const buyer = r.buyer.toLowerCase();
            const prof = buyerProfiles[buyer];
            const displayName = prof?.displayName || abbreviateAddress(buyer);
            const avatar = prof?.avatar;
            return (
              <div key={idx} className="flex items-start space-x-3">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={displayName}
                    className="w-8 h-8 rounded-full object-cover border"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                    <FiUser className="w-4 h-4 text-gray-300" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-sm">
                    ⭐ Quality: {r.quality.toFixed(1)} <br /> 💬 Communication:{" "}
                    {r.communication.toFixed(1)} <br /> ⏱️ Timeliness:{" "}
                    {r.timeliness.toFixed(1)}
                  </p>
                  <p className="mt-1 text-xs text-gray-300">{r.comment}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: precio y botón de compra */}
      <div className="mt-auto flex items-center justify-end">
        <span className="text-xl font-bold mr-4">
          {ethers.formatEther(svc.price)} ETH
        </span>
        <button
          onClick={() => onBuy(svc.id, svc.price, svc.seller)}
          className="inline-flex items-center px-5 py-2 bg-purple-600 hover:bg-purple-700 rounded-full transition disabled:opacity-50"
          disabled={!walletConnected || processingId === svc.id}
        >
          {processingId !== svc.id ? (
            <FiShoppingCart className="mr-2" />
          ) : (
            <FiShoppingCart className="mr-2 animate-spin" />
          )}
          {processingId === svc.id ? "Processing…" : "Buy"}
        </button>
      </div>
    </div>
  );
};

export default ServiceCard;
