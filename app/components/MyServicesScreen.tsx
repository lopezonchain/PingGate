// src/screens/MyServicesScreen.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  FiEdit2,
  FiPauseCircle,
  FiChevronDown,
  FiChevronUp,
  FiPlus,
  FiPlayCircle,
  FiCopy,
  FiSend,
  FiShare2,
} from "react-icons/fi";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import {
  getServicesBy,
  getService,
  getSalesBy,
  getReview,
  pauseService,
  resumeService,
  editService,
  createService,
  getCreationFee,
  getEditFee,
  Service,
} from "../services/contractService";
import { base } from "viem/chains";
import { createPublicClient, http } from "viem";
import SuccessServiceCreationModal from "../components/SuccessServiceCreationModal";
import LoadingOverlay from "../components/LoadingOverlay";
import { WarpView } from "../page-client";
import BottomMenu from "./BottomMenu";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";

interface MyServicesScreenProps {
  onAction: (view: WarpView) => void;
}

interface SaleRecord {
  serviceId: bigint;
  buyer: `0x${string}`;
  timestamp: bigint;
}

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://base.llamarpc.com"),
});

// Helper: format wei to ETH string without trailing zeros
const formatEtherTrimmed = (wei: bigint): string => {
  const raw = ethers.formatEther(wei);
  return Number(raw)
    .toFixed(18)
    .replace(/\.?0+$/, "");
};

export default function MyServicesScreen({ onAction }: MyServicesScreenProps) {
  const warpcast = useMemo(() => new WarpcastService(), []);
  
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const sellerAddress = address as `0x${string}`;

  const [services, setServices] = useState<Service[]>([]);
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

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(
    null
  );
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriceEth, setEditPriceEth] = useState("");

  const [creationFee, setCreationFee] = useState<bigint>(
    BigInt(5000000000000000)
  );
  const [editFee, setEditFee] = useState<bigint>(BigInt(2500000000000000));
  const [sendingCreate, setSendingCreate] = useState(false);
  const [sendingEdit, setSendingEdit] = useState(false);

  // Overlay & error/success
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const [showShareOptions, setShowShareOptions] = useState(false);
  const serviceUrl = `https://farcaster.xyz/miniapps/EeMMAjeUSYta/pinggate/user/${sellerAddress}`;
  const serviceWebUrl = `https://pinggate.lopezonchain.xyz/user/${sellerAddress}`;

  const TITLE_MAX_BYTES = 100;
  const DESC_MAX_BYTES = 1000;

  const [buyerProfiles, setBuyerProfiles] = useState<Record<string, Web3BioProfile>>({});

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Initial load: services, sales, compute local ratings & valid reviews only
  useEffect(() => {
    if (!sellerAddress) return;
    (async () => {
      setLoading(true);
      try {
        const ids = await getServicesBy(sellerAddress);
        const details = await Promise.all(ids.map((id) => getService(id)));
        const salesRecs = await getSalesBy(sellerAddress);

        const ratingsObj: Record<string, number> = {};
        const reviewsObj: Record<string, any[]> = {};

        await Promise.all(
          details.map(async (svc) => {
            const recs = salesRecs.filter((s) => s.serviceId === svc.id);
            const raw = await Promise.all(
              recs.map((s) =>
                getReview(svc.id, s.buyer).then((rev) => ({
                  buyer: s.buyer,
                  timestamp: s.timestamp,
                  quality: rev.quality,
                  communication: rev.communication,
                  timeliness: rev.timeliness,
                  comment: rev.comment,
                }))
              )
            );
            // filter out reviews with no comment and all-zero scores
            const valid = raw.filter(
              (r) =>
                r.comment?.trim() &&
                (r.quality > 0 || r.communication > 0 || r.timeliness > 0)
            );
            reviewsObj[svc.id.toString()] = valid;
            // compute local average rating: mean of (quality+comm+time)/3
            if (valid.length > 0) {
              const sum = valid.reduce(
                (acc, r) => acc + (r.quality + r.communication + r.timeliness) / 3,
                0
              );
              ratingsObj[svc.id.toString()] = sum / valid.length;
            } else {
              ratingsObj[svc.id.toString()] = 0;
            }
          })
        );

        if (isMounted.current) {
          setServices(details);
          setSales(salesRecs);
          setRatings(ratingsObj);
          setReviews(reviewsObj);
          const allBuyers = Object.values(reviewsObj).flat().map(r => r.buyer.toLowerCase());
          const uniqueBuyers = Array.from(new Set(allBuyers));
          const ids = uniqueBuyers.map(addr => `farcaster,${addr}`);
          const bios = await warpcast.getWeb3BioProfiles(ids);
          const map: Record<string, Web3BioProfile> = {};
          bios.forEach((p: Web3BioProfile) =>
             p.aliases?.forEach(a => {
              const [, addr] = a.split(",");
              map[addr.toLowerCase()] = p;
            })
          );
          setBuyerProfiles(map);
        }
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Failed to load services");
      } finally {
        if (isMounted.current) setLoading(false);
      }
    })();
  }, [sellerAddress]);

  // Load fees
  useEffect(() => {
    getCreationFee()
      .then((f) => {
        if (isMounted.current) setCreationFee(f);
      })
      .catch(console.error);
    getEditFee()
      .then((f) => {
        if (isMounted.current) setEditFee(f);
      })
      .catch(console.error);
  }, []);

    const countBytes = (str: string): number =>
  new TextEncoder().encode(str).length;

  const handleNewTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (countBytes(v) <= TITLE_MAX_BYTES) {
      setNewTitle(v);
    }
  };

  const handleNewDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    if (countBytes(v) <= DESC_MAX_BYTES) {
      setNewDesc(v);
    }
  };
  
  const ensureBase = async () => {
    if (!walletClient) throw new Error("Wallet not connected");
    if (walletClient.chain?.id !== base.id) {
      await walletClient.switchChain(base);
    }
  };

  const onTogglePause = async (id: bigint, isActive: boolean) => {
    try {
      await ensureBase();
      if (isActive) {
        await pauseService(walletClient!, id);
      } else {
        await resumeService(walletClient!, id);
      }

      if (isMounted.current) {
        setServices((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, active: !isActive } : s
          )
        );
        toast.success(isActive ? "Service paused" : "Service reactivated");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Action failed");
    }
  };

  const onOpenEdit = (svc: Service) => {
    setEditingService(svc);
    setEditTitle(svc.title);
    setEditDesc(svc.description);
    setEditPriceEth(ethers.formatEther(svc.price));
    setShowEditModal(true);
  };

  const onEditSubmit = async () => {
    if (!editingService) return;
    setSendingEdit(true);
    try {
      const priceWei = ethers.parseEther(editPriceEth);
      await ensureBase();
      await editService(
        walletClient!,
        editingService.id,
        editTitle.trim(),
        editDesc.trim(),
        priceWei,
        editFee
      );
      setServices((prev) =>
        prev.map((s) =>
          s.id === editingService.id
            ? {
              ...s,
              title: editTitle,
              description: editDesc,
              price: priceWei,
            }
            : s
        )
      );
      toast.success("Service updated");
      setShowEditModal(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Edit failed");
    } finally {
      setSendingEdit(false);
    }
  };

  const onCreate = async () => {
    setSendingCreate(true);
    setErrorMessage("");
    setShowErrorModal(false);
    setShowLoadingOverlay(true);
    try {
      if (!newTitle.trim() || !newDesc.trim())
        throw new Error("Title and description required");
      const priceNum = Number(newPriceEth);
      if (isNaN(priceNum) || priceNum <= 0) throw new Error("Invalid ETH price");
      const priceWei = ethers.parseEther(newPriceEth);

      await ensureBase();
      const tx = await createService(
        walletClient!,
        newTitle.trim(),
        newDesc.trim(),
        priceWei,
        creationFee
      );
      await publicClient.waitForTransactionReceipt({ hash: tx });
      toast.success("Service created");
      const ids = await getServicesBy(sellerAddress);
      const details = await Promise.all(ids.map((id) => getService(id)));
      setServices(details);
      setShowCreator(false);
      setNewTitle("");
      setNewDesc("");
      setNewPriceEth("");
      setShowSuccess(true);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Creation failed");
      setShowErrorModal(true);
    } finally {
      setSendingCreate(false);
      setShowLoadingOverlay(false);
    }
  };

  const handleShare = useCallback(() => {
    const text = `🚀 I just created a service with PingGate by @lopezonchain.eth!\nCheck it out here: ${serviceUrl}`;
    const shareUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank");
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(serviceUrl);
      toast.success("Link copied to clipboard");
    } catch (err) {
      console.error("Copy failed", err);
      toast.error("Failed to copy link");
    }
    setShowShareOptions(false);
  };

  const handleCopyWeb = async () => {
    try {
      await navigator.clipboard.writeText(serviceWebUrl);
      toast.success("Link copied to clipboard");
    } catch (err) {
      console.error("Copy failed", err);
      toast.error("Failed to copy link");
    }
    setShowShareOptions(false);
  };


  const handleCast = () => {
    const text = `🚀 Check out my services on PingGate, the onchain chat marketplace!\nBuilt by @lopezonchain.eth 💬🛠️\n\n${serviceUrl}`;
    const shareUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank");
    setShowShareOptions(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        Loading…
      </div>
    );
  }

  // Summary calculations
  const totalServices = services.length;
  const totalSales = sales.length;
  const totalReviews = Object.values(reviews).flat().length;
  const totalRevenueWei = services.reduce(
    (sum, svc) =>
      sum + svc.price * BigInt(sales.filter((s) => s.serviceId === svc.id).length),
    BigInt(0)
  );
  const totalRevenue = formatEtherTrimmed(totalRevenueWei);
  const weightedSum = services.reduce((sum, svc) => {
    const valid = reviews[svc.id.toString()] || [];
    return sum + (ratings[svc.id.toString()] || 0) * valid.length;
  }, 0);
  const averageRating =
    totalReviews > 0 ? (weightedSum / totalReviews).toFixed(1) : "0.0";

  return (
    <div className="h-full flex flex-col bg-[#0f0d14] text-white relative">
      <header className="p-4 text-center">
        <h2 className="text-2xl font-bold mb-2">My Services</h2>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
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
          <>
            <div className="flex flex-wrap text-center justify-center p-2 text-sm text-gray-400">
              <div className="w-1/2 sm:w-auto p-2">
                <p className="text-lg font-bold text-purple-500">{totalServices}</p>
                Services
              </div>
              <div className="w-1/2 sm:w-auto p-2">
                <p className="text-lg font-bold text-purple-500">{totalSales}</p>
                Sales
              </div>
              <div className="w-1/2 sm:w-auto p-2">
                <p className="text-lg font-bold text-purple-500">{totalReviews}</p>
                Reviews
              </div>
              <div className="w-1/2 sm:w-auto p-2">
                <p className="text-lg font-bold text-purple-500">
                  {averageRating} / 5.0
                </p>
                Avg Rating
              </div>
              <div className="w-1/2 sm:w-auto p-2">
                <p className="text-lg font-bold text-purple-500">{totalRevenue} ETH</p>
                Revenue
              </div>

            </div>
            <div className="relative flex w-full justify-center ">
              <button
                onClick={() => setShowShareOptions((prev) => !prev)}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg mb-1"
              >
                <FiShare2 />
                <span>Share My Services</span>
              </button>

              {showShareOptions && (
                <div className="absolute top-full mt-2 bg-[#1a1725] border border-gray-700 rounded-lg shadow-lg w-52 z-[150]">
                  <button
                    onClick={handleCast}
                    className="w-full flex items-center px-4 py-2 text-sm hover:bg-[#2a2438] text-white"
                  >
                    <FiSend className="mr-2" />
                    Cast My Services
                  </button>
                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center px-4 py-2 text-sm hover:bg-[#2a2438] text-white"
                  >
                    <FiCopy className="mr-2" />
                    Copy My services link (Miniapp)
                  </button>
                  <button
                    onClick={handleCopyWeb}
                    className="w-full flex items-center px-4 py-2 text-sm hover:bg-[#2a2438] text-white"
                  >
                    <FiCopy className="mr-2" />
                    Copy My services link (Web)
                  </button>
                </div>
              )}
            </div>

            {services.map((svc) => {
              const idStr = svc.id.toString();
              const soldCount = sales.filter((s) => s.serviceId === svc.id).length;
              const revenue = formatEtherTrimmed(
                svc.price * BigInt(soldCount)
              );
              const avg = ratings[idStr] || 0;
              const valid = reviews[idStr] || [];
              const isOpen = expanded === svc.id;
              return (
                <div
                  key={idStr}
                  className="bg-[#1a1725] rounded-lg overflow-hidden mb-1"
                >
                  <button
                    className="w-full p-4 flex justify-between items-center hover:bg-[#231c32]"
                    onClick={() => setExpanded(isOpen ? null : svc.id)}
                  >
                    <div className="w-full">
                      <p className="text-base font-medium pr-4">{svc.title}</p>
                      <p className="text-xs text-gray-400 pr-4">
                        Sold: {soldCount} · {revenue} ETH
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEdit(svc);
                        }}
                        className="p-2 bg-[#2a2438] rounded-full hover:bg-[#3a3248]"
                      >
                        <FiEdit2 size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePause(svc.id, svc.active);
                        }}
                        className="p-2 bg-[#2a2438] rounded-full hover:bg-[#3a3248]"
                      >
                        {svc.active ? <FiPauseCircle size={18} /> : <FiPlayCircle size={18} />}
                      </button>
                      {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 border-t border-gray-700 bg-[#1e1931] space-y-2">
                      <p className="text-sm font-semibold">
                        Average Rating: {avg.toFixed(1)} / 5.0
                      </p>
                      {valid.length > 0 ? (
                        valid.map((r, i) => {
                          const addr = r.buyer.toLowerCase();
                          const prof = buyerProfiles[addr];
                          const displayName = prof?.displayName || `${addr.slice(0,6)}…${addr.slice(-4)}`;
                          return (
                            <div key={i} className="bg-[#2a2438] p-3 rounded-lg space-y-2">
                              {/* Avatar + Nombre */}
                              <div className="flex items-center space-x-2">
                                {prof?.avatar ? (
                                  <img src={prof.avatar} alt={displayName}
                                    className="w-6 h-6 rounded-full object-cover"/>
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-gray-600"/>
                                )}
                                <span className="text-sm font-medium text-white">
                                  {displayName}
                                </span>
                              </div>
                              {/* Scores */}
                              <p className="text-sm text-gray-200">
                                ⭐ Quality: {r.quality.toFixed(1)} <br />
                                💬 Communication: {r.communication.toFixed(1)} <br />
                                ⏱️ Timeliness: {r.timeliness.toFixed(1)}
                              </p>
                              {/* Comentario */}
                              <p className="mt-1 text-xs text-gray-400 italic">“{r.comment}”</p>
                              {/* Fecha */}
                              <p className="mt-1 text-xs text-gray-500">
                                {new Date(Number(r.timestamp) * 1000).toLocaleString()}
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-gray-500 text-sm">No reviews yet</p>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </>
        )}
      </main>

      <BottomMenu onAction={onAction} />

      <button
        onClick={() => setShowCreator(true)}
        className="fixed bottom-14 right-[10%] bg-purple-600 hover:bg-purple-700 text-white text-3xl w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
        aria-label="Create Service"
      >
        <FiPlus />
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
              onChange={handleNewTitleChange}
              className="w-full p-3 rounded-lg bg-[#2a2438] text-white"
            />
            <p className="text-xs text-gray-400">
              {countBytes(newTitle)} / {TITLE_MAX_BYTES} bytes
            </p>

            <textarea
              rows={3}
              placeholder="Description"
              value={newDesc}
              onChange={handleNewDescChange}
              className="w-full p-3 rounded-lg bg-[#2a2438] text-white"
            />
            <p className="text-xs text-gray-400">
              {countBytes(newDesc)} / {DESC_MAX_BYTES} bytes
            </p>
            <input
              type="text"
              placeholder="Price (ETH)"
              value={newPriceEth}
              onChange={(e) => setNewPriceEth(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2a2438] text-white"
            />
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

      {/* Edit Modal */}
      {showEditModal && editingService && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
          <div className="bg-[#1a1725] p-6 rounded-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Service</h3>
            <input
              type="text"
              placeholder="Title"
              value={newTitle}
              onChange={handleNewTitleChange}
              className="w-full p-3 rounded-lg bg-[#2a2438] text-white"
            />
            <p className="text-xs text-gray-400">
              {countBytes(newTitle)} / {TITLE_MAX_BYTES} bytes
            </p>

            <textarea
              rows={3}
              placeholder="Description"
              value={newDesc}
              onChange={handleNewDescChange}
              className="w-full p-3 rounded-lg bg-[#2a2438] text-white"
            />
            <p className="text-xs text-gray-400">
              {countBytes(newDesc)} / {DESC_MAX_BYTES} bytes
            </p>
            <input
              type="text"
              placeholder="Price (ETH)"
              value={editPriceEth}
              onChange={(e) => setEditPriceEth(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2a2438] text-white"
            />
            <p className="text-xs text-gray-400">
              Edit fee: {ethers.formatEther(editFee)} ETH
            </p>
            <div className="flex justify-end space-x-3 mt-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white"
                disabled={sendingEdit}
              >
                Cancel
              </button>
              <button
                onClick={onEditSubmit}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold"
                disabled={sendingEdit}
              >
                {sendingEdit ? "Saving..." : "Save"}
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
            <p className="text-gray-300 h-[200px] overflow-y-scroll overflow-x-hidden">{errorMessage}</p>
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

      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <LoadingOverlay onClose={() => setShowLoadingOverlay(false)} />
      )}
    </div>
  );
}
