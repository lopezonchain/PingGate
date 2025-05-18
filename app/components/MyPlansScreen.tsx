"use client";

import React, { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import {
  getServicesBy,
  getService,
  getSalesBy,
  getAverageRating,
  getReview,
  pauseService,
  editService,
  createService,
  getCreationFee,
} from "../services/contractService";
import { FiArrowLeft, FiEdit2, FiPauseCircle, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { ethers } from "ethers";
import toast from "react-hot-toast";

interface MyPlansScreenProps {
  onBack: () => void;
}

interface ServiceDetails {
  id: bigint;
  seller: `0x${string}`;
  title: string;
  description: string;
  price: bigint;
  duration: bigint;
  active: boolean;
}

interface SaleRecord {
  serviceId: bigint;
  buyer: `0x${string}`;
  timestamp: bigint;
}

export default function MyPlansScreen({ onBack }: MyPlansScreenProps) {
  const { data: walletClient } = useWalletClient();
  const address = walletClient?.account.address!;
  const [services, setServices] = useState<ServiceDetails[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expanded, setExpanded] = useState<bigint | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  // For "Add Plan" modal
  const [showCreator, setShowCreator] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriceEth, setNewPriceEth] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [creationFee, setCreationFee] = useState<bigint>(BigInt(0));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>("");

  // load my services & sales
  useEffect(() => {
    if (!walletClient) return;
    (async () => {
      setLoading(true);
      try {
        const ids = await getServicesBy(address);
        const details = await Promise.all(ids.map((id) => getService(id)));
        setServices(details);
        const salesRecs = await getSalesBy(address);
        setSales(salesRecs);
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Failed to load plans");
      } finally {
        setLoading(false);
      }
    })();
  }, [walletClient, address]);

  // fetch creationFee once
  useEffect(() => {
    if (!walletClient) return;
    getCreationFee()
      .then((fee) => setCreationFee(fee))
      .catch((e) => console.error("Could not load creationFee", e));
  }, [walletClient]);

  const toggle = (id: bigint) => {
    const opening = expanded !== id;
    setExpanded(opening ? id : null);
    if (opening) {
      (async () => {
        try {
          const avg = await getAverageRating(id);
          setRatings((p) => ({ ...p, [id.toString()]: Number(avg) }));
          const recs = sales.filter((s) => s.serviceId === id);
          const list = await Promise.all(
            recs.map((s) =>
              getReview(id, s.buyer).then((rev) => ({
                buyer: s.buyer,
                ...rev,
              }))
            )
          );
          setReviews((p) => ({ ...p, [id.toString()]: list }));
        } catch (e) {
          console.error("Failed to load reviews for", id, e);
        }
      })();
    }
  };

  const onPause = async (id: bigint) => {
    if (!walletClient) return;
    try {
      await pauseService(walletClient, Number(id));
      setServices((p) =>
        p.map((s) => (s.id === id ? { ...s, active: false } : s))
      );
      toast.success("Paused");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Pause failed");
    }
  };

  const onEdit = async (svc: ServiceDetails) => {
    if (!walletClient) return;
    const newTitle = prompt("New title", svc.title) || svc.title;
    const newDesc = prompt("New description", svc.description) || svc.description;
    const newPrice = prompt(
      "New price (ETH)",
      ethers.formatEther(svc.price)
    );
    if (!newPrice) return;
    const priceWei = ethers.parseEther(newPrice);
    try {
      await editService(
        walletClient,
        Number(svc.id),
        newTitle,
        newDesc,
        priceWei,
        BigInt(0) // fee is handled within the helper
      );
      setServices((p) =>
        p.map((s) =>
          s.id === svc.id
            ? { ...s, title: newTitle, description: newDesc, price: priceWei }
            : s
        )
      );
      toast.success("Updated");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Edit failed");
    }
  };

  const onCreate = async () => {
    if (!walletClient) return;
    setSending(true);
    setError("");
    try {
      const priceWei = ethers.parseEther(newPriceEth || "0");
      const durationSecs = Number(newDuration);
      await createService(
        walletClient,
        newTitle,
        newDesc,
        priceWei,
        durationSecs,
        creationFee
      );
      toast.success("Service created");
      // refresh list
      const ids = await getServicesBy(address);
      const details = await Promise.all(ids.map((id) => getService(id)));
      setServices(details);
      setShowCreator(false);
      // reset form
      setNewTitle("");
      setNewDesc("");
      setNewPriceEth("");
      setNewDuration("");
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-[90%] flex flex-col bg-[#0f0d14] text-white relative">
      {/* Back */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
      >
        <FiArrowLeft className="w-5 h-5 mr-2" />
        Back
      </button>

      <h2 className="text-2xl font-bold mb-4 text-center">My Plans</h2>

      <div className="space-y-4 overflow-y-auto flex-1 px-2">
        {services.map((svc) => {
          const key = svc.id.toString();
          const soldCount = sales.filter((s) => s.serviceId === svc.id).length;
          const revenue = Number(
            ethers.formatEther(svc.price * BigInt(soldCount))
          );
          const avg = ratings[key] ?? 0;
          const isOpen = expanded === svc.id;
          return (
            <div
              key={key}
              className="bg-[#1a1725] rounded-lg overflow-hidden"
            >
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-[#231c32]"
                onClick={() => toggle(svc.id)}
              >
                <div>
                  <p className="font-semibold">{svc.title}</p>
                  <p className="text-xs text-gray-400">
                    Sold: {soldCount} · Revenue: {revenue} ETH · Rating: {avg}/5
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={() => onEdit(svc)}>
                    <FiEdit2 />
                  </button>
                  <button onClick={() => onPause(svc.id)}>
                    <FiPauseCircle />
                  </button>
                  {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                </div>
              </div>
              {isOpen && (
                <div className="p-4 border-t border-gray-700 space-y-2">
                  {(reviews[key] || []).map((r, i) => (
                    <div key={i} className="bg-[#2a2438] p-2 rounded">
                      <p className="text-sm">
                        ⭐ Quality: {r.quality} · Communication: {r.communication} ·
                        Timeliness: {r.timeliness}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating "+" button to add a plan */}
      <button
        onClick={() => setShowCreator(true)}
        className="fixed bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-700 text-white text-3xl w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
        aria-label="Add Plan"
      >
        +
      </button>

      {/* Add Plan Modal */}
      {showCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
          <div className="bg-[#1a1725] p-6 rounded-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Add New Plan</h3>
            {error && <p className="text-red-500">{error}</p>}
            <input
              type="text"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2a2438] text-white"
            />
            <textarea
              rows={3}
              placeholder="Description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2a2438] text-white"
            />
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Price (ETH)"
                value={newPriceEth}
                onChange={(e) => setNewPriceEth(e.target.value)}
                className="flex-1 p-3 rounded-lg bg-[#2a2438] text-white"
              />
              <input
                type="number"
                placeholder="Duration (s)"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className="w-32 p-3 rounded-lg bg-[#2a2438] text-white"
              />
            </div>
            <p className="text-xs text-gray-400">
              Creation fee: {ethers.formatEther(creationFee)} ETH
            </p>
            <div className="flex justify-end space-x-3 mt-2">
              <button
                onClick={() => setShowCreator(false)}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white"
                disabled={sending}
              >
                Cancel
              </button>
              <button
                onClick={onCreate}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold"
                disabled={sending}
              >
                {sending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
