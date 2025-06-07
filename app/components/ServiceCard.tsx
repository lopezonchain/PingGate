// src/components/ServiceCard.tsx
"use client";

import React from "react";
import Link from "next/link";
import { FiUser, FiChevronDown, FiChevronUp, FiShoppingCart } from "react-icons/fi";
import { ethers } from "ethers";

interface Review {
  buyer: string;
  quality: number;
  communication: number;
  timeliness: number;
  comment: string;
}

export interface ServiceDetails {
  id: bigint;
  seller: `0x${string}`;
  title: string;
  description: string;
  price: bigint;
  duration: bigint;
  active: boolean;
}

export interface SellerProfile {
  name: string;
  avatarUrl?: string;
}

interface ServiceCardProps {
  svc: ServiceDetails;
  prof: SellerProfile;
  avgRating: number;
  reviews: Review[];
  isExpanded: boolean;
  onToggleReviews: (id: bigint) => void;
  onBuy: (id: bigint, price: bigint, seller: string) => void;
  processingId: bigint | null;
  walletConnected: boolean;
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

  return (
    <div className="w-full bg-[#1a1725] rounded-2xl shadow-lg hover:shadow-2xl transition p-6 flex flex-col">
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
        <p className="text-sm text-yellow-400 mb-2">
          ⭐ {avgRating.toFixed(1)} / 5.0 ({count} {count === 1 ? "review" : "reviews"})
          <button
            onClick={() => onToggleReviews(svc.id)}
            className="ml-2 text-xs text-gray-300"
          >
            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        </p>
      ) : (
        <p className="text-sm text-gray-400 mb-2">
          Be the first buying this service!
        </p>
      )}

      {/* Detalle de reviews */}
      {isExpanded && count > 0 && (
        <div className="bg-[#2a2438] p-4 rounded mb-4">
          {meaningful.map((r, idx) => (
            <div key={idx} className="mb-3">
              <p className="text-sm">
                ⭐ Quality: {r.quality} · Communication: {r.communication} · Timeliness: {r.timeliness}
              </p>
              <p className="text-xs text-gray-300 mt-1">{r.comment}</p>
            </div>
          ))}
        </div>
      )}

      {/* Footer: precio y botón de compra */}
      <div className="mt-auto flex items-center justify-between">
        <span className="text-xl font-bold">
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
