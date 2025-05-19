"use client";

import React, { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import { getActiveServices, purchaseService } from "../services/contractService";
import { FiShoppingCart, FiArrowLeft } from "react-icons/fi";
import { ethers } from "ethers";
import toast from "react-hot-toast";

interface ServiceDetails {
    id: bigint;
    seller: `0x${string}`;
    title: string;
    description: string;
    price: bigint;
    duration: bigint;
    active: boolean;
}

interface ExploreScreenProps {
    onBack: () => void;
}

export default function ExploreScreen({ onBack }: ExploreScreenProps) {
    const { data: walletClient } = useWalletClient();
    const [services, setServices] = useState<ServiceDetails[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const list = await getActiveServices();
                setServices(list);
            } catch (e: any) {
                console.error("Failed to load services", e);
                toast.error(e.message || "Error fetching services");
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
            await purchaseService(walletClient, BigInt(id), price);
            toast.success("Purchased!");
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Purchase failed");
        }
    };

    if (loading) {
        return (
            <div className="h-full p-4 bg-[#0f0d14] text-white flex items-center justify-center">
                <span className="text-gray-400">Loading…</span>
            </div>
        );
    }

    return (
        <div className="h-[90%] flex flex-col bg-[#0f0d14] text-white relative">
            <button
                onClick={onBack}
                className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
            >
                <FiArrowLeft className="w-5 h-5 mr-2" />
                Back
            </button>

            <h2 className="text-2xl font-bold mb-4 text-center">Explore Services</h2>

            {services.length === 0 ? (
                <p className="text-gray-400">No services available</p>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {services.map((svc) => (
                        <div
                            key={svc.id.toString()}
                            className="bg-[#1a1725] p-4 rounded-lg flex flex-col"
                        >
                            <h3 className="font-semibold text-lg">{svc.title}</h3>
                            <p className="text-sm text-gray-400 line-clamp-2 mt-1">
                                {svc.description}
                            </p>
                            <p className="mt-2">
                                Price: {ethers.formatEther(svc.price)} ETH
                            </p>
                            <button
                                onClick={() => onBuy(svc.id, svc.price)}
                                className="mt-3 inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50"
                                disabled={!walletClient}
                            >
                                <FiShoppingCart className="mr-2" /> Buy
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
