// src/components/AddressName.tsx
"use client";

import React, { useState, useEffect } from "react";
import { resolveNameLabel } from "../services/resolveNameLabel";
import { WarpcastService } from "../services/warpcastService";

// Función auxiliar para acortar direcciones mientras resolvemos
function abbreviateAddress(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

interface AddressNameProps {
  address: string;
}

/**
 * Muestra primero la dirección acortada,
 * luego intenta resolver el FID en Farcaster (via WarpcastService#getFidByAddress),
 * carga el perfil (username/displayName y pfp) con WarpcastService#getProfileByFid,
 * y si no encuentra nada, hace fallback a ENS.
 */
export default function AddressName({ address }: AddressNameProps) {
  const [label, setLabel] = useState<string>(abbreviateAddress(address));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const warpcast = new WarpcastService();

    async function lookup() {
      // 1️⃣ Intentar resolver Farcaster FID a partir de la dirección
      try {
        const fid = await warpcast.getFidByAddress(address);
        if (mounted && fid) {
          // 2️⃣ Obtener perfil de Farcaster por FID
          const profile = await warpcast.getProfileByFid(fid);
        if (mounted) {
        // elegimos displayName > username > fallback a dirección
        const name = profile.displayName ?? profile.username ?? abbreviateAddress(address);
        setLabel(name);

        // si hay URL de avatar, la usamos
        if (profile.pfpUrl) {
            setAvatarUrl(profile.pfpUrl);
        }
        return;
        }
        }
      } catch (e) {
        // Si falla Farcaster, seguiremos al ENS
        console.warn("Warpcast lookup failed:", e);
      }

      // 3️⃣ Fallback a ENS
      try {
        const ens = await resolveNameLabel(address);
        if (mounted && ens) {
          setLabel(ens);
        }
      } catch (e) {
        console.warn("ENS lookup failed:", e);
      }
    }

    lookup();

    return () => {
      mounted = false;
    };
  }, [address]);

  return (
    <span className="inline-flex items-center space-x-1">
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt=""
          className="w-5 h-5 rounded-full object-cover"
        />
      )}
      <span>{label}</span>
    </span>
  );
}
