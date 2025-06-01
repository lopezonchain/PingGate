// app/users/[peer]/ClientUser.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWalletClient } from "wagmi";
import { FiArrowLeft, FiShoppingCart, FiUser } from "react-icons/fi";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import {
  getServicesBy,
  getService,
  purchaseService,
} from "../../services/contractService";
import { resolveEnsName } from "../../services/nameResolver";
import { WarpcastService, Web3BioProfile } from "../../services/warpcastService";
import SuccessModal from "../../components/SuccessModal";
import LoadingOverlay from "../../components/LoadingOverlay";

interface ServiceDetails {
  id: bigint;
  seller: `0x${string}`;
  title: string;
  description: string;
  price: bigint;
  duration: bigint;
  active: boolean;
}

interface UserProfile {
  displayName: string;
  avatarUrl?: string;
  addressAbbrev: string;
}

export default function ClientUser({ peerAddress }: { peerAddress: string }) {
  const router = useRouter();
  const { data: walletClient } = useWalletClient();

  const normalizedPeer = peerAddress.toLowerCase();

  const [profile, setProfile] = useState<UserProfile>({
    displayName: normalizedPeer,
    addressAbbrev: `${normalizedPeer.slice(0, 6)}…${normalizedPeer.slice(-4)}`,
  });
  const [services, setServices] = useState<ServiceDetails[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [processingId, setProcessingId] = useState<bigint | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Montado / desmontado para evitar setState en componente desmontado
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // 1) Cargar perfil: Farcaster → ENS → fallback dirección abreviada
  useEffect(() => {
    if (!normalizedPeer) return;
    let active = true;
    (async () => {
      try {
        const warp = new WarpcastService();
        const ids = [`farcaster,${normalizedPeer}`];
        let bioProfiles: Web3BioProfile[] = [];
        try {
          bioProfiles = await warp.getWeb3BioProfiles(ids);
        } catch {
          bioProfiles = [];
        }
        const aliasMap: Record<string, Web3BioProfile> = {};
        bioProfiles.forEach((p) =>
          p.aliases?.forEach((alias) => {
            const [, addr] = alias.split(",");
            aliasMap[addr.toLowerCase()] = p;
          })
        );
        const bp = aliasMap[normalizedPeer];
        if (bp?.displayName && active) {
          if (isMounted.current) {
            setProfile({
              displayName: bp.displayName,
              avatarUrl: bp.avatar || undefined,
              addressAbbrev: `${normalizedPeer.slice(0, 6)}…${normalizedPeer.slice(-4)}`,
            });
          }
          return;
        }
        // Si no hay nombre Farcaster, intentar ENS
        try {
          const ens = await resolveEnsName(normalizedPeer);
          if (ens && active) {
            if (isMounted.current) {
              setProfile({
                displayName: ens,
                avatarUrl: undefined,
                addressAbbrev: `${normalizedPeer.slice(0, 6)}…${normalizedPeer.slice(-4)}`,
              });
            }
            return;
          }
        } catch {
          // ignorar
        }
      } catch {
        // ignorar
      } finally {
        if (active && isMounted.current) {
          setLoadingProfile(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [normalizedPeer]);

  // 2) Cargar servicios activos de este usuario
  useEffect(() => {
    if (!normalizedPeer) return;
    let active = true;
    (async () => {
      try {
        const ids: bigint[] = await getServicesBy(normalizedPeer as `0x${string}`);
        const loaded: ServiceDetails[] = [];
        for (const id of ids) {
          const svc = await getService(id);
          if (svc.active && svc.seller.toLowerCase() === normalizedPeer) {
            loaded.push(svc);
          }
        }
        if (active && isMounted.current) {
          setServices(loaded);
        }
      } catch (e: any) {
        console.error(e);
        if (active && isMounted.current) {
          setError("Failed to load services.");
        }
      } finally {
        if (active && isMounted.current) {
          setLoadingServices(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [normalizedPeer]);

  // 3) Compra de servicio
  const handlePurchase = async (svc: ServiceDetails) => {
    if (!walletClient) {
      toast.error("Connect your wallet first.");
      return;
    }
    setError(null);
    setProcessingId(svc.id);
    setShowLoading(true);

    try {
      await purchaseService(walletClient, svc.id, svc.price);
      // Éxito: mostrar SuccessModal
      if (isMounted.current) {
        setShowLoading(false);
        setShowSuccess(true);
      }
    } catch (e: any) {
      console.error(e);
      if (isMounted.current) {
        setShowLoading(false);
        toast.error(e.message || "Purchase failed.");
      }
    } finally {
      if (isMounted.current) {
        setProcessingId(null);
      }
    }
  };

  // Botón “Back” al Inbox (/)
  const goBack = () => {
    router.push("/");
  };

  if (!normalizedPeer) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0f0d14] text-white">
        <p className="text-gray-400">Invalid address.</p>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0f0d14] text-white">
        <p className="text-gray-400">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0d14] text-white p-4 max-w-lg mx-auto flex-1 flex flex-col min-h-0 max-h-screen relative">
      <button
        onClick={goBack}
        className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
      >
        <FiArrowLeft className="w-5 h-5 mr-2" />
        Pings Inbox
      </button>

      <div className="flex items-center space-x-4 mb-6">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="w-12 h-12 rounded-full object-cover border-2 border-purple-500"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center border-2 border-purple-500">
            <FiUser className="w-6 h-6 text-gray-400" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
          <p className="text-sm text-gray-400">{profile.addressAbbrev}</p>
        </div>
      </div>

      {loadingServices ? (
        <p className="text-gray-400">Loading services…</p>
      ) : error ? (
        <p className="mb-4 text-red-500">{error}</p>
      ) : services.length === 0 ? (
        <p className="text-gray-400">No active services found.</p>
      ) : (
        <ul className="space-y-6 flex-1 overflow-y-auto px-2 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
          {services.map((svc) => (
            <li
              key={svc.id.toString()}
              className="bg-[#1a1725] p-6 rounded-2xl shadow hover:shadow-2xl transition flex flex-col"
            >
              <h2 className="text-xl font-semibold mb-2">{svc.title}</h2>
              <p className="text-gray-300 mb-4 line-clamp-3">
                {svc.description}
              </p>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xl font-bold">
                  {ethers.formatEther(svc.price)} ETH
                </span>
                <button
                  onClick={() => handlePurchase(svc)}
                  disabled={processingId === svc.id}
                  className={`inline-flex items-center px-5 py-2 rounded-full text-white transition ${
                    processingId === svc.id
                      ? "bg-gray-600"
                      : "bg-purple-600 hover:bg-purple-700"
                  }`}
                >
                  <FiShoppingCart className="mr-2" />
                  {processingId === svc.id ? "Processing…" : "Buy"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showLoading && <LoadingOverlay onClose={() => setShowLoading(false)} />}
      {showSuccess && (
        <SuccessModal
          peerAddress={normalizedPeer}
          onClose={() => setShowSuccess(false)}
        />
      )}
    </div>
  );
}
