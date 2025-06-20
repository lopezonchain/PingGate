// src/services/warpcastService.ts
export interface WarpcastUser {
  fid: number;
  displayName: string;
  profile: {
    bio: { text: string; mentions: any[] };
    channelMentions: any[];
    location: { placeId: string; description: string };
    description: string;
    earlyWalletAdopter: boolean;
  };
  username: string;
  followerCount: number;
  followingCount: number;
  pfp: { url: string };
  verified: boolean;
  referrerUsername: string;
  viewerContext: {
    following: boolean;
    followedBy: boolean;
    enableNotifications: boolean;
  };
}

export interface PrimaryAddressResult {
  fid: number;
  success: boolean;
  address?: {
    fid: number;
    protocol: string;
    address: string;
  };
}

export interface PaginatedUsers {
  users: WarpcastUser[];
  nextCursor?: string;
}

export interface Web3BioProfile {
  address: string;
  identity: string;
  platform: string;
  displayName: string;
  avatar: string;
  description: string;
  status: string | null;
  createdAt: string;
  email: string | null;
  location: string | null;
  header: string | null;
  contenthash: string | null;
  links: {
    [key: string]: {
      link: string;
      handle: string;
      sources: string[];
    };
  };
  social: {
    uid: number;
    follower: number;
    following: number;
  };
  aliases?: string[];
}

export class WarpcastService {
  // Apuntamos al proxy interno de Next.js para evitar CORS
  private baseUrl = '/api/warpcast';
  private web3BioBase = 'https://api.web3.bio';

  private async fetchPage<T>(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(this.baseUrl + path, window.location.href);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.append(k, String(v));
    });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json() as Promise<T>;
  }

  /** Obtiene todos tus followers paginando hasta que no haya más cursor */
  async getFollowers(fid: number): Promise<WarpcastUser[]> {
    return this._collectAllPages(cursor =>
      this.fetchPage<{
        result: { users: WarpcastUser[] };
        next?: { cursor: string };
      }>('/v2/followers', { fid, cursor }).then(d => ({
        users: d.result.users,
        nextCursor: d.next?.cursor
      }))
    );
  }

  /** Obtiene todos a quienes sigues + leastInteracted sólo de la primera página */
  async getFollowing(fid: number): Promise<{
    users: WarpcastUser[];
    leastInteracted: { count: number; users: WarpcastUser[] };
  }> {
    let leastInteracted = { count: 0, users: [] as WarpcastUser[] };

    const users = await this._collectAllPages(cursor =>
      this.fetchPage<{
        result: {
          users: WarpcastUser[];
          leastInteractedWith?: { count: number; users: WarpcastUser[] };
        };
        next?: { cursor: string };
      }>('/v2/following', { fid, cursor }).then(d => {
        if (!leastInteracted.users.length && d.result.leastInteractedWith) {
          leastInteracted = d.result.leastInteractedWith;
        }
        return {
          users: d.result.users,
          nextCursor: d.next?.cursor
        };
      })
    );

    return { users, leastInteracted };
  }

  /** Obtiene las wallets primarias de un listado de FIDs */
  async getPrimaryAddresses(
    fids: number[],
    protocol: 'ethereum' | 'solana' = 'ethereum'
  ): Promise<PrimaryAddressResult[]> {

    const url = new URL(`${this.baseUrl}/fc/primary-addresses`, window.location.href);
    url.searchParams.append('fids', fids.join(','));
    url.searchParams.append('protocol', protocol);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = (await res.json()) as { result: { addresses: PrimaryAddressResult[] } };
    return json.result.addresses;
  }

  /** Resuelve un fname de Farcaster al FID actual */
  async getFidByName(
    name: string
  ): Promise<number> {
    // Quitamos posible '@' para flexibilidad
    const clean = name.replace(/^@/, '');
    const url = `https://fnames.farcaster.xyz/transfers?name=${encodeURIComponent(clean)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FName API error: ${res.status}`);
    const json = await res.json() as { transfers: Array<{ to: number }> };
    if (json.transfers.length === 0) {
      throw new Error(`The name "${name}" is not registered`);
    }
    // El primer registro es la asignación original al FID
    return json.transfers[0].to;
  }

  /** Helper: recorre todas las páginas hasta que nextCursor sea undefined */
  private async _collectAllPages(
    fetchPage: (cursor?: string) => Promise<{ users: WarpcastUser[]; nextCursor?: string }>
  ): Promise<WarpcastUser[]> {
    const all: WarpcastUser[] = [];
    let cursor: string | undefined = undefined;
    do {
      const { users, nextCursor } = await fetchPage(cursor);
      all.push(...users);
      cursor = nextCursor;
    } while (cursor);
    return all;
  }

  /**
   * Obtiene en batch los perfiles de Web3.bio dado un array de IDs.
   * @param ids Array de identifiers en formato ["plataforma,address", ...]
   */
  async getWeb3BioProfiles(ids: string[]): Promise<Web3BioProfile[]> {
    // 1) Serializa el array completo
    const json = JSON.stringify(ids);
    // 2) URL-encode de la cadena JSON
    const encoded = encodeURIComponent(json);
    // 3) Úsalo como único segment en el path
    const url = `${this.web3BioBase}/profile/batch/${encoded}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Web3.bio API error: ${res.status}`);
    }
    return res.json() as Promise<Web3BioProfile[]>;
  }

  /**
   * Envía una notificación a través de tu API /api/notify
   *
   * @param fid        El Farcaster ID del destinatario
   * @param title      Título de la notificación
   * @param bodyText   Cuerpo de la notificación
   * @param myAddr     Tu dirección Ethereum (se usa para construir el targetUrl)
   */
  async notify(
    fid: number,
    title: string,
    bodyText: string,
    myAddr: string
  ): Promise<void> {
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid,
          notification: { title, body: bodyText },
          targetUrl: `https://pinggate.lopezonchain.xyz/conversation/${myAddr}`,
        }),
      });
      if (!res.ok) {
        console.error(`Notify failed: ${res.status} ${res.statusText}`);
      }
    } catch (error) {
      console.error("Notify error:", error);
    }
  }


}