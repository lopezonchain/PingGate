// src/screens/ExploreScreen.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import { FiShoppingCart, FiArrowLeft, FiUser, FiRefreshCw } from "react-icons/fi";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import { getActiveServices, purchaseService } from "../services/contractService";
import { resolveEnsName } from "../services/nameResolver";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";

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
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const warp = new WarpcastService();
        (async () => {
            try {
                const list = await getActiveServices();
                setServices(list);
                setDisplayed(list);

                const sellers = Array.from(new Set(list.map(s => s.seller.toLowerCase())));
                const ids = sellers.map(addr => `farcaster,${addr}`);

                let bioProfiles: Web3BioProfile[] = [];
                try { bioProfiles = await warp.getWeb3BioProfiles(ids); } catch { }

                const bioMap: Record<string, Web3BioProfile> = {};
                bioProfiles.forEach(p => {
                    p.aliases?.forEach(alias => {
                        const [platform, addr] = alias.split(",");
                        if (platform === "farcaster") bioMap[addr.toLowerCase()] = p;
                    });
                });

                const entries = await Promise.all(sellers.map(async addr => {
                    const p = bioMap[addr];
                    let name: string | undefined;
                    let avatarUrl: string | undefined;
                    if (p?.displayName) {
                        name = p.displayName;
                        avatarUrl = p.avatar;
                    }
                    if (!name) {
                        try { const ens = await resolveEnsName(addr); if (ens) name = ens; } catch { }
                    }
                    if (!name) name = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
                    return [addr, { name, avatarUrl }];
                }));

                setProfiles(Object.fromEntries(entries));
            } catch (e: any) {
                console.error(e);
                toast.error("Error loading services");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const onBuy = async (id: bigint, price: bigint) => {
        if (!walletClient) {
            toast.error("Connect your wallet first");
            return;
        }
        try {
            await purchaseService(walletClient, id, price);
            toast.success("Purchased!");
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Purchase failed");
        }
    };

    const handleSearch = (term: string) => {
        setSearchTerm(term);
        const lower = term.toLowerCase();
        setDisplayed(services.filter(svc => {
            const sellerName = profiles[svc.seller.toLowerCase()]?.name.toLowerCase() || "";
            return svc.title.toLowerCase().includes(lower) || sellerName.includes(lower);
        }));
    };

    const handleRandomize = () => {
        const shuffled = [...displayed];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setDisplayed(shuffled);
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
                    onChange={e => handleSearch(e.target.value)}
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
                    displayed.map(svc => {
                        const addr = svc.seller.toLowerCase();
                        const prof = profiles[addr] || { name: `${addr.slice(0, 6)}…${addr.slice(-4)}` };
                        return (
                            <div key={svc.id.toString()} className="w-full bg-[#1a1725] rounded-2xl shadow-lg hover:shadow-2xl transition p-6 flex flex-col">
                                <div className="flex items-center mb-4 space-x-4">
                                    {prof.avatarUrl ? (
                                        <img src={prof.avatarUrl} alt={prof.name} className="w-12 h-12 rounded-full object-cover border-2 border-purple-500 hover:scale-105 transition" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center border-2 border-purple-500">
                                            <FiUser className="w-6 h-6 text-gray-400" />
                                        </div>
                                    )}
                                    <p className="text-lg font-medium">{prof.name}</p>
                                </div>
                                <h3 className="font-semibold text-xl mb-2">{svc.title}</h3>
                                <p className="text-sm text-gray-400 line-clamp-3 mb-4">{svc.description}</p>
                                <div className="mt-auto flex items-center justify-between">
                                    <span className="text-xl font-bold">{ethers.formatEther(svc.price)} ETH</span>
                                    <button
                                        onClick={() => onBuy(svc.id, svc.price)}
                                        className="inline-flex items-center px-5 py-2 bg-purple-600 hover:bg-purple-700 rounded-full transition disabled:opacity-50"
                                        disabled={!walletClient}
                                    >
                                        <FiShoppingCart className="mr-2" /> Buy
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}