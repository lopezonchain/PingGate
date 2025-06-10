"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWalletClient } from "wagmi";
import {
    FiArrowLeft,
    FiUser,
} from "react-icons/fi";
import toast from "react-hot-toast";
import {
    getServicesBy,
    getService,
    purchaseService,
    getAverageRating,
    getReview,
    getSalesBy,
    publicClient,
} from "../../services/contractService";
import { resolveEnsName } from "../../services/nameResolver";
import { WarpcastService, Web3BioProfile } from "../../services/warpcastService";
import LoadingOverlay from "../../components/LoadingOverlay";
import SuccessModal from "../../components/SuccessModal";
import ServiceCard, { ServiceDetails } from "../../components/ServiceCard";
import BottomMenu from "@/app/components/BottomMenu";
import { WarpView } from "@/app/page-client";
import { base } from "viem/chains";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, EthBalance, Identity, Name } from "@coinbase/onchainkit/identity";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import sdk from "@farcaster/frame-sdk";
import Link from "next/link";

interface UserProfile {
    displayName: string;
    avatarUrl?: string;
    addressAbbrev: string;
    description?: string;
    links?: {
        farcaster?: { link: string; handle: string };
        twitter?: { link: string; handle: string };
    };
}

interface ClientUserProps {
    peerAddress: string;
}

export default function ClientUser({ peerAddress }: ClientUserProps) {
    const router = useRouter();
    const { data: walletClient } = useWalletClient();
    const { address, isConnected, chainId } = useAccount();
    const peer = peerAddress.toLowerCase();

    // Perfil
    const [profile, setProfile] = useState<UserProfile>({
        displayName: peer,
        addressAbbrev: `${peer.slice(0, 6)}…${peer.slice(-4)}`,
    });
    const [loadingProfile, setLoadingProfile] = useState(true);

    // Servicios
    const [services, setServices] = useState<ServiceDetails[]>([]);
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [reviews, setReviews] = useState<Record<string, any[]>>({});
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [loadingServices, setLoadingServices] = useState(true);

    // Compra
    const [processingId, setProcessingId] = useState<bigint | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // onAction para el menú inferior
    const onAction = (view: WarpView) => {
        router.push(`/?view=${view}`);
    };

    const { setFrameReady, isFrameReady } = useMiniKit();

    // SDK Farcaster ready
    useEffect(() => {
        if (!isFrameReady) setFrameReady();
        (async () => {
            await sdk.actions.ready({ disableNativeGestures: true });
        })();
    }, [isFrameReady, setFrameReady]);

    useEffect(() => {
        if (!isConnected) return;

        if (chainId !== base.id || walletClient?.chain?.id != base.id) {
            walletClient?.switchChain(base).then(() => toast.success("Change Base chain…"))
                .catch(() =>
                    toast.error("Please change to Base network")
                );
        }

    }, [isConnected, chainId, walletClient]);

    // Cargar perfil (Farcaster + ENS)
    useEffect(() => {
        if (!peer) return;
        let active = true;
        (async () => {
            try {
                const warp = new WarpcastService();
                const bios = await warp
                    .getWeb3BioProfiles([`farcaster,${peer}`])
                    .catch(() => []);
                const map: Record<string, Web3BioProfile> = {};
                bios.forEach((p) =>
                    p.aliases?.forEach((a) => {
                        const [, addr] = a.split(",");
                        map[addr.toLowerCase()] = p;
                    })
                );
                const bp = map[peer];
                if (bp && active) {
                    setProfile({
                        displayName: bp.displayName || peer,
                        avatarUrl: bp.avatar,
                        addressAbbrev: `${peer.slice(0, 6)}…${peer.slice(-4)}`,
                        description: bp.description,
                        links: {
                            farcaster:
                                bp.links?.farcaster && {
                                    link: bp.links.farcaster.link,
                                    handle: bp.links.farcaster.handle,
                                },
                            twitter:
                                bp.links?.twitter && {
                                    link: bp.links.twitter.link,
                                    handle: bp.links.twitter.handle,
                                },
                        },
                    });
                } else {
                    const ens = await resolveEnsName(peer).catch(() => null);
                    if (ens && active) {
                        setProfile((prev) => ({ ...prev, displayName: ens }));
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                active && setLoadingProfile(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [peer]);

    // Cargar servicios + ratings + reviews
    useEffect(() => {
        if (!peer) return;
        let active = true;
        (async () => {
            try {
                const ids = await getServicesBy(peer as `0x${string}`);
                const svcs: ServiceDetails[] = [];
                for (const id of ids) {
                    const svc = await getService(id);
                    if (svc.active && svc.seller.toLowerCase() === peer) {
                        svcs.push(svc);
                    }
                }
                if (!active) return;
                setServices(svcs);

                const ratingEntries = await Promise.all(
                    svcs.map((svc) =>
                        getAverageRating(svc.id).then(
                            (avg) => [svc.id.toString(), avg] as [string, number]
                        )
                    )
                );
                active && setRatings(Object.fromEntries(ratingEntries));

                const reviewEntries = await Promise.all(
                    svcs.map(async (svc) => {
                        const sales = await getSalesBy(svc.seller);
                        const buyers = sales
                            .filter((r) => r.serviceId === svc.id)
                            .map((r) => r.buyer);
                        const revs = await Promise.all(
                            buyers.map((b) =>
                                getReview(svc.id, b).then((r) => ({
                                    buyer: b,
                                    quality: r.quality,
                                    communication: r.communication,
                                    timeliness: r.timeliness,
                                    comment: r.comment,
                                }))
                            )
                        );
                        return [svc.id.toString(), revs] as [string, any[]];
                    })
                );
                active && setReviews(Object.fromEntries(reviewEntries));
            } catch (e) {
                console.error(e);
                toast.error("Error loading services");
            } finally {
                active && setLoadingServices(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [peer]);

    // Compra
    const handleBuy = async (id: bigint, price: bigint) => {
        if (!walletClient) {
            toast.error("Connect your wallet first");
            return;
        }
        setProcessingId(id);
        try {
            // ya forzamos Base en el efecto de carga
            const hash = await purchaseService(walletClient, id, price);
            await publicClient.waitForTransactionReceipt({ hash });
            setShowSuccess(true);
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Purchase failed");
        } finally {
            setProcessingId(null);
        }
    };

    const closeSuccess = () => {
        setShowSuccess(false);
        router.push(`/?view=home`);
    };

    // Loading
    if (loadingProfile || loadingServices) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#0f0d14] text-white">
                <p className="text-gray-400">Loading…</p>
            </div>
        );
    }

    return (
        <div className="bg-[#0f0d14] text-white w-full max-w-md mx-auto flex flex-col h-screen px-1">
            <header className="flex justify-between items-center mb-3 h-11">
                <Link href="/?view=home" shallow>
                    <img src="/PingGateLogoNoBG.png" alt="PingGate Home" className="w-12 h-12"/>
                </Link>
                <div className="flex justify-end space-x-2 w-full z-50 pt-2">
                    <Wallet>
                        <ConnectWallet>
                            <Avatar className="h-6 w-6" />
                            <Name />
                        </ConnectWallet>
                        <WalletDropdown className="z-[200]">
                            <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                                <Avatar />
                                <Name />
                                <Address />
                                <EthBalance />
                            </Identity>
                            <WalletDropdownDisconnect />
                        </WalletDropdown>
                    </Wallet>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto py-4 pb-20 space-y-6 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
                {/* Perfil */}
                <section className="text-center space-y-2">
                    <div className="flex">
                        {profile.avatarUrl ? (
                            <img
                                src={profile.avatarUrl}
                                alt={profile.displayName}
                                className="mx-auto w-16 h-14 rounded-full border-2 border-purple-500"
                            />
                        ) : (
                            <div className="mx-auto w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center border-2 border-purple-500">
                                <FiUser className="w-6 h-6 text-gray-400" />
                            </div>
                        )}
                        <div className="flex-1 justify-start items-start">
                            <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
                            <a
                                href={`https://basescan.org/address/${peer}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-sm text-gray-400 hover:underline"
                            >
                                {profile.addressAbbrev}
                            </a>
                        </div>
                    </div>

                    {profile.description && (
                        <p className="text-sm text-gray-400">{profile.description}</p>
                    )}
                    <div className="flex justify-center space-x-6">
                        {profile.links?.farcaster && (
                            <a
                                href={profile.links.farcaster.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-1 transition-opacity hover:opacity-80"
                            >
                                <img
                                    src="/logos/farcaster-2025.png"
                                    width={26}
                                    height={26}
                                    alt="Farcaster"
                                />
                                <span className="text-xs text-indigo-300">
                                    @{profile.links.farcaster.handle}
                                </span>
                            </a>
                        )}
                        {profile.links?.twitter && (
                            <a
                                href={profile.links.twitter.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-1 transition-opacity hover:opacity-80"
                            >
                                <img src="/logos/x-2025.png" width={26} height={26} alt="X" />
                                <span className="text-xs text-blue-300">
                                    @{profile.links.twitter.handle}
                                </span>
                            </a>
                        )}
                    </div>
                </section>

                {/* Servicios */}
                <section>
                    {services.length === 0 ? (
                        <p className="text-gray-400 text-center">No services found</p>
                    ) : (
                        services.map((svc) => (
                            <ServiceCard
                                key={svc.id.toString()}
                                svc={svc}
                                prof={{
                                    name: profile.displayName,
                                    avatarUrl: profile.avatarUrl,
                                }}
                                avgRating={ratings[svc.id.toString()] ?? 0}
                                reviews={reviews[svc.id.toString()] || []}
                                isExpanded={expandedId === svc.id.toString()}
                                onToggleReviews={(id) =>
                                    setExpandedId((prev) =>
                                        prev === id.toString() ? null : id.toString()
                                    )
                                }
                                onBuy={handleBuy}
                                processingId={processingId}
                                walletConnected={!!walletClient}
                            />
                        ))
                    )}
                </section>

                {/* Menú inferior */}
                <BottomMenu onAction={onAction} />
            </main>

            {processingId !== null && <LoadingOverlay />}
            {showSuccess && <SuccessModal peerAddress={peer} onClose={closeSuccess} />}
        </div>
    );
}
