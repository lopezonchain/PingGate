// src/screens/MyServicesScreen.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiArrowLeft,
  FiEdit2,
  FiPauseCircle,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import { ethers } from "ethers";
import toast from "react-hot-toast";
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
  getEditFee,
} from "../services/contractService";
import { base } from "viem/chains";
import { WarpcastService } from "../services/warpcastService";
import SuccessServiceCreationModal from "../components/SuccessServiceCreationModal";

interface MyServicesScreenProps {
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


export default function MyServicesScreen({ onBack }: MyServicesScreenProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const sellerAddress = address as `0x${string}`;

  const [services, setServices] = useState<ServiceDetails[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [expanded, setExpanded] = useState<bigint | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  // Modal & form state
  const [showCreator, setShowCreator] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriceEth, setNewPriceEth] = useState("");
  const [newDurationValue, setNewDurationValue] = useState("");
  const [newDurationUnit, setNewDurationUnit] = useState<
    "days" | "hours" | "weeks"
  >("days");
  const [creationFee, setCreationFee] = useState<bigint>(
    BigInt(1000000000000000)
  );
  const [editFee, setEditFee] = useState<bigint>(BigInt(0));
  const [sendingCreate, setSendingCreate] = useState(false);
  const [sendingEditId, setSendingEditId] = useState<bigint | null>(null);

  // Error modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Success modal state
  const [showSuccess, setShowSuccess] = useState(false);

  // Track mounted status
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!sellerAddress) return;
    (async () => {
      setLoading(true);
      try {
        const ids = await getServicesBy(sellerAddress);
        const details = await Promise.all(ids.map((id) => getService(id)));
        if (isMounted.current) setServices(details);

        const salesRecs = await getSalesBy(sellerAddress);
        if (isMounted.current) setSales(salesRecs);
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Failed to load services");
      } finally {
        if (isMounted.current) setLoading(false);
      }
    })();
  }, [sellerAddress]);

  useEffect(() => {
    getCreationFee()
      .then((f) => {
        if (isMounted.current) setCreationFee(f);
      })
      .catch((e) => console.error(e));
    getEditFee()
      .then((f) => {
        if (isMounted.current) setEditFee(f);
      })
      .catch((e) => console.error(e));
  }, []);

  const toggle = (id: bigint) => {
    const opening = expanded !== id;
    setExpanded(opening ? id : null);
    if (!opening) return;
    (async () => {
      try {
        const avg = await getAverageRating(id);
        if (isMounted.current) {
          setRatings((p) => ({ ...p, [id.toString()]: avg }));
        }
        const recs = sales.filter((s) => s.serviceId === id);
        const list = await Promise.all(
          recs.map((s) =>
            getReview(id, s.buyer).then((rev) => ({ buyer: s.buyer, ...rev }))
          )
        );
        if (isMounted.current) {
          setReviews((p) => ({ ...p, [id.toString()]: list }));
        }
      } catch (e) {
        console.error("Failed to load reviews for", id, e);
      }
    })();
  };

  const ensureBase = async () => {
    if (!walletClient) throw new Error("Wallet not connected");
    if (walletClient.chain?.id !== base.id) {
      await walletClient.switchChain({ id: base.id });
    }
  };

  const onPause = async (id: bigint) => {
    try {
      await ensureBase();
      await pauseService(walletClient!, id);
      if (isMounted.current) {
        setServices((p) =>
          p.map((s) => (s.id === id ? { ...s, active: false } : s))
        );
        toast.success("Service paused");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Pause failed");
    }
  };

  const onEdit = async (svc: ServiceDetails) => {
    if (!walletClient) return;
    const newTitleInput = prompt("New title", svc.title) || svc.title;
    const newDescInput =
      prompt("New description", svc.description) || svc.description;
    const newPrice = prompt(
      `New price (ETH) — edit fee: ${ethers.formatEther(editFee)} ETH`,
      ethers.formatEther(svc.price)
    );
    if (!newPrice) return;
    const priceWei = ethers.parseEther(newPrice);

    setSendingEditId(svc.id);
    try {
      await ensureBase();
      await editService(
        walletClient,
        svc.id,
        newTitleInput,
        newDescInput,
        priceWei,
        editFee
      );
      if (isMounted.current) {
        setServices((p) =>
          p.map((s) =>
            s.id === svc.id
              ? {
                  ...s,
                  title: newTitleInput,
                  description: newDescInput,
                  price: priceWei,
                }
              : s
          )
        );
        toast.success("Service updated");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Edit failed");
    } finally {
      if (isMounted.current) setSendingEditId(null);
    }
  };

  const onCreate = async () => {
    if (!walletClient) return;
    setSendingCreate(true);
    setErrorMessage("");
    setShowErrorModal(false);

    try {
      if (!newTitle.trim() || !newDesc.trim()) {
        throw new Error("Title and description are required");
      }
      const priceNum = Number(newPriceEth);
      if (isNaN(priceNum) || priceNum <= 0) {
        throw new Error("Enter a valid price in ETH");
      }
      const priceWei = ethers.parseEther(newPriceEth);

      const durationNum = parseInt(newDurationValue, 10);
      if (isNaN(durationNum) || durationNum <= 0) {
        throw new Error("Enter a valid duration");
      }
      let seconds = 0;
      if (newDurationUnit === "days") seconds = durationNum * 24 * 3600;
      if (newDurationUnit === "hours") seconds = durationNum * 3600;
      if (newDurationUnit === "weeks") seconds = durationNum * 7 * 24 * 3600;

      await ensureBase();
      await createService(
        walletClient,
        newTitle.trim(),
        newDesc.trim(),
        priceWei,
        seconds,
        creationFee
      );
      toast.success("Service created");

      if (isMounted.current) {
        const ids = await getServicesBy(sellerAddress);
        const details = await Promise.all(ids.map((id) => getService(id)));
        setServices(details);
        setShowCreator(false);
        setNewTitle("");
        setNewDesc("");
        setNewPriceEth("");
        setNewDurationValue("");
        setNewDurationUnit("days");
        setShowSuccess(true);
      }
    } catch (e: any) {
      console.error(e);
      if (isMounted.current) {
        setErrorMessage(e.message || "Creation failed");
        setShowErrorModal(true);
      }
    } finally {
      if (isMounted.current) setSendingCreate(false);
    }
  };

  const handleShare = async () => {
    try {
      const svc = new WarpcastService();
      const link = `https://your-app-domain.com/users/${sellerAddress}`;
      //await svc.createPost(link); // assume createPost publishes text
      toast.success("Shared on Farcaster");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to share");
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
      <button
        onClick={onBack}
        className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
      >
        <FiArrowLeft className="w-5 h-5 mr-2" />
        Back
      </button>

      <h2 className="text-2xl font-bold mb-4 text-center">My Services</h2>

      {services.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-4">
          <p className="text-gray-400 text-center">
            You don’t have any services available. Want to start monetizing your
            inbox?
          </p>
          <button
            onClick={() => setShowCreator(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
          >
            Create Service
          </button>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto flex-1 px-2 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
          {services.map((svc) => {
            const idStr = svc.id.toString();
            const soldCount = sales.filter((s) => s.serviceId === svc.id).length;
            const revenue = Number(
              ethers.formatEther(svc.price * BigInt(soldCount))
            );
            const avg = ratings[idStr] ?? 0;
            const reviewList = reviews[idStr] || [];
            const isOpen = expanded === svc.id;
            const isEditing = sendingEditId === svc.id;

            return (
              <div
                key={idStr}
                className="bg-[#1a1725] rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 flex justify-between items-center cursor-pointer hover:bg-[#231c32]"
                  onClick={() => toggle(svc.id)}
                >
                  <div>
                    <p className="font-semibold">{svc.title}</p>
                    <p className="text-xs text-gray-400">
                      Sold: {soldCount} · Revenue: {revenue} ETH
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(svc);
                      }}
                      disabled={isEditing}
                    >
                      {isEditing ? "Saving…" : <FiEdit2 />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPause(svc.id);
                      }}
                    >
                      <FiPauseCircle />
                    </button>
                    {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                  </div>
                </div>

                {isOpen && (
                  <div className="p-4 border-t border-gray-700 space-y-2">
                    Average: {avg}/5
                    {reviewList.length > 0 ? (
                      reviewList.map((r, i) => (
                        <div key={i} className="bg-[#2a2438] p-2 rounded">
                          <p className="text-sm">
                            ⭐ Quality: {r.quality} · Communication: {r.communication} ·
                            Timeliness: {r.timeliness}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{r.comment}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No reviews yet</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setShowCreator(true)}
        className="fixed bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-700 text-white text-3xl w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
        aria-label="Add Service"
      >
        +
      </button>

      {/* Create Modal */}
      {showCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
          <div className="bg-[#1a1725] p-6 rounded-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Add New Service</h3>
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
            <input
              type="text"
              placeholder="Price (ETH)"
              value={newPriceEth}
              onChange={(e) => setNewPriceEth(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2a2438] text-white"
            />
            <div className="flex space-x-2">
              <input
                type="number"
                placeholder="Duration"
                value={newDurationValue}
                onChange={(e) => setNewDurationValue(e.target.value)}
                className="flex-1 p-3 rounded-lg bg-[#2a2438] text-white"
              />
              <select
                value={newDurationUnit}
                onChange={(e) =>
                  setNewDurationUnit(
                    e.target.value as "days" | "hours" | "weeks"
                  )
                }
                className="w-32 p-3 rounded-lg bg-[#2a2438] text-white"
              >
                <option value="days">Days</option>
                <option value="hours">Hours</option>
                <option value="weeks">Weeks</option>
              </select>
            </div>
            <p className="text-xs text-gray-400">
              Creation fee: {ethers.formatEther(creationFee)} ETH
            </p>
            <div className="flex justify-end space-x-3 mt-2">
              <button
                onClick={() => setShowCreator(false)}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white"
                disabled={sendingCreate}
              >
                Cancel
              </button>
              <button
                onClick={onCreate}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold"
                disabled={sendingCreate}
              >
                {sendingCreate ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
          <div className="bg-[#1a1725] p-6 rounded-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-red-500">Error</h3>
            <p className="text-gray-300">{errorMessage}</p>
            <button
              onClick={() => setShowErrorModal(false)}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <SuccessServiceCreationModal
          sellerAddress={sellerAddress}
          onClose={() => setShowSuccess(false)}
          onShare={handleShare}
        />
      )}
    </div>
  );
}
