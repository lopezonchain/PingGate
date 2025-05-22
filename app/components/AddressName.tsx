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
 * Muestra primero la dirección acortada, resuelve ENS.
 */
export default function AddressName({ address }: AddressNameProps) {
  const [label, setLabel] = useState<string>(abbreviateAddress(address));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const warpcast = new WarpcastService();

    async function lookup() {
      

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
