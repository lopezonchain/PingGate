// src/services/warpcastService.ts
import { JsonRpcProvider, Contract } from "ethers";

export interface WarpcastProfile {
  displayName?: string;
  username?: string;
  pfpUrl?: string;
}

export class WarpcastService {
  // 1️⃣ On-chain: provider + IdRegistry to get fid from any primary custody address :contentReference[oaicite:0]{index=0}
  private provider = new JsonRpcProvider("https://mainnet.optimism.io");
  private idRegistry = new Contract(
    "0x00000000fc6c5f01fc30151999387bb99a9f489b",
    ["function idOf(address) view returns (uint256)"],
    this.provider
  );

  // 2️⃣ Warpcast’s public HTTP API base URL :contentReference[oaicite:1]{index=1}
  private readonly API_BASE = "https://api.warpcast.com";

  /**
   * Dado un wallet primary, resuelve su FID on-chain.
   * Lanza si el contrato retorna 0.
   */
  async getFidByAddress(address: string): Promise<number> {
    const fid: Number = await this.idRegistry.idOf(address);
    if (fid === 0) {
      throw new Error(`No se encontró FID para la dirección ${address}`);
    }
    return Number(fid);
  }

  /**
   * Llama al endpoint público de Warpcast para obtener
   * los datos de usuario asociados a ese FID (pfp, displayName, username).
   * Usa `/v1/userDataByFid`, que devuelve todos los mensajes de user data para el FID :contentReference[oaicite:2]{index=2}.
   */
  async getProfileByFid(fid: number): Promise<WarpcastProfile> {
    const url = `${this.API_BASE}/v2/user?fid=${fid}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Warpcast profile API error: ${res.status}`);
    }

    const json = (await res.json()) as {
      result: {
        user: {
          displayName?: string;
          username?: string;
          profilePicture?: { url: string };
          pfp?: { url: string };
        };
      };
    };

    const user = json.result.user;
    const profile: WarpcastProfile = {
      displayName: user.displayName,
      username: user.username,
    };

    // Primero intentamos la nueva propiedad `profilePicture`,
    // si no existe, probamos `pfp` (compatibilidad con v1/v2).
    if (user.profilePicture?.url) {
      profile.pfpUrl = user.profilePicture.url;
    } else if (user.pfp?.url) {
      profile.pfpUrl = user.pfp.url;
    }

    return profile;
  }

  /**
   * Fetch the user's primary custody address from Warpcast.
   * Endpoint: `/fc/primary-address?fid=…&protocol=ethereum` 
   */
  async getPrimaryAddress(fid: number, protocol: "ethereum" | "solana" = "ethereum"): Promise<string> {
    const url = new URL(`${this.API_BASE}/fc/primary-address`);
    url.searchParams.set("fid", String(fid));
    url.searchParams.set("protocol", protocol);
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Warpcast primary-address API error: ${res.status}`);
    }
    const json = (await res.json()) as {
      result: { address: { address: string } };
    };
    return json.result.address.address;
  }
}
