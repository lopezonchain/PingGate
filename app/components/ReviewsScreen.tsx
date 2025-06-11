"use client";

import React, { useEffect, useState } from "react";
import { FiArrowLeft, FiEdit2, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import { useAccount, useWalletClient } from "wagmi";
import {
  getPurchasesBy,
  getService,
  getReview,
  submitReview,
  getAverageRating,
  Service,
} from "../services/contractService";
import { WarpView } from "../page-client";
import BottomMenu from "./BottomMenu";

interface ReviewRecord {
  quality: number;
  communication: number;
  timeliness: number;
  comment: string;
  timestamp: bigint;
}

interface ReviewForm {
  quality: number;
  communication: number;
  timeliness: number;
  comment: string;
}

const MAX_RATING = 5;

function StarRating({
  rating,
  onChange,
  readOnly = false,
}: {
  rating: number;
  onChange: (val: number) => void;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex space-x-1">
      {Array.from({ length: MAX_RATING }, (_, i) => i + 1).map((val) => (
        <button
          key={val}
          type="button"
          disabled={readOnly}
          onClick={() => onChange(val)}
          onMouseEnter={() => setHover(val)}
          onMouseLeave={() => setHover(0)}
          className="p-1 transition-transform transform hover:scale-110 focus:outline-none"
        >
          <FaStar
            size={20}
            className={
              val <= (hover || rating) ? "text-yellow-400" : "text-gray-600"
            }
          />
        </button>
      ))}
    </div>
  );
}

interface ReviewsScreenProps {
  onAction: (view: WarpView) => void;
}

export default function ReviewsScreen({ onAction }: ReviewsScreenProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [servicesMap, setServicesMap] = useState<
    Record<string, Service>
  >({});
  const [reviewsMap, setReviewsMap] = useState<Record<string, ReviewRecord>>(
    {}
  );
  const [forms, setForms] = useState<Record<string, ReviewForm>>({});
  const [averages, setAverages] = useState<Record<string, number>>({});

  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const [completedKeys, setCompletedKeys] = useState<string[]>([]);
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());

  // NEW: which tab is active
  const [activeTab, setActiveTab] = useState<"pending" | "completed">(
    "pending"
  );

  useEffect(() => {
    if (!address) return;
    (async () => {
      try {
        const purchaseIds = await getPurchasesBy(address);
        const pKeys: string[] = [];
        const cKeys: string[] = [];

        await Promise.all(
          purchaseIds.map(async (serviceId, idx) => {
            const key = `${serviceId.toString()}_${idx}`;
            const svc = await getService(serviceId);
            const revOnChain = await getReview(serviceId, address);
            const record: ReviewRecord = {
              quality: Number(revOnChain.quality),
              communication: Number(revOnChain.communication),
              timeliness: Number(revOnChain.timeliness),
              comment: revOnChain.comment,
              timestamp: revOnChain.timestamp,
            };

            setServicesMap((m) => ({ ...m, [key]: svc }));
            setReviewsMap((m) => ({ ...m, [key]: record }));
            setForms((m) => ({
              ...m,
              [key]: {
                quality: record.quality,
                communication: record.communication,
                timeliness: record.timeliness,
                comment: record.comment,
              },
            }));

            if (record.timestamp === BigInt(0)) {
              pKeys.push(key);
            } else {
              cKeys.push(key);
              const avg = await getAverageRating(serviceId);
              setAverages((a) => ({ ...a, [key]: avg }));
            }
          })
        );

        setPendingKeys(pKeys);
        setCompletedKeys(cKeys);
      } catch (e) {
        console.error("Error loading reviews:", e);
      }
    })();
  }, [address]);

  const handleSubmit = async (key: string) => {
    if (!walletClient || !address) return;
    const [idStr] = key.split("_");
    const serviceId = BigInt(idStr);
    const form = forms[key];

    try {
      await submitReview(
        walletClient,
        serviceId,
        form.quality,
        form.communication,
        form.timeliness,
        form.comment
      );
      const nowTs = BigInt(Math.floor(Date.now() / 1000));
      setReviewsMap((m) => ({ ...m, [key]: { ...form, timestamp: nowTs } }));
      const newAvg = await getAverageRating(serviceId);
      setAverages((a) => ({ ...a, [key]: newAvg }));

      if (pendingKeys.includes(key)) {
        setPendingKeys((p) => p.filter((k) => k !== key));
        setCompletedKeys((c) => [key, ...c]);
      }
      setEditingKeys((s) => {
        const ns = new Set(s);
        ns.delete(key);
        return ns;
      });
    } catch (e) {
      console.error("Submit review failed:", e);
    }
  };

  const startEdit = (key: string) =>
    setEditingKeys((s) => new Set(s).add(key));
  const cancelEdit = (key: string) => {
    setEditingKeys((s) => {
      const ns = new Set(s);
      ns.delete(key);
      return ns;
    });
    const rev = reviewsMap[key];
    setForms((m) => ({
      ...m,
      [key]: {
        quality: rev.quality,
        communication: rev.communication,
        timeliness: rev.timeliness,
        comment: rev.comment,
      },
    }));
  };

  const renderCard = (key: string, isPending: boolean) => {
    const svc = servicesMap[key]!;
    const form = forms[key]!;
    const rev = reviewsMap[key]!;
    const avg = averages[key]!;
    const isEditing = editingKeys.has(key);

    return (
      <div key={key} className="bg-[#1a1725] p-4 rounded-lg mb-4">
        <h4 className="text-lg font-semibold text-white mb-4">{svc.title}</h4>

        {(isPending || isEditing) ? (
          <div className="flex flex-col items-center space-y-4">
            {(["quality", "communication", "timeliness"] as const).map(
              (field) => (
                <div
                  key={field}
                  className="flex flex-col items-center"
                >
                  <label className="text-sm text-gray-300 capitalize mb-1">
                    {field}
                  </label>
                  <StarRating
                    rating={form[field]}
                    onChange={(val) =>
                      setForms((m) => ({
                        ...m,
                        [key]: { ...m[key], [field]: val },
                      }))
                    }
                  />
                </div>
              )
            )}

            <textarea
              rows={3}
              placeholder="Comment..."
              value={form.comment}
              onChange={(e) =>
                setForms((m) => ({
                  ...m,
                  [key]: { ...m[key], comment: e.target.value },
                }))
              }
              className="w-full bg-[#2a2438] text-white p-2 rounded-lg focus:outline-none"
            />

            <button
              onClick={() => handleSubmit(key)}
              className="w-full flex items-center justify-center py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
            >
              <FiCheckCircle className="mr-2" />
              {isEditing ? "Save" : "Submit"}
            </button>

            {isEditing && (
              <button
                onClick={() => cancelEdit(key)}
                className="w-full flex items-center justify-center py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition"
              >
                <FiXCircle className="mr-2" /> Cancel
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            {(["quality", "communication", "timeliness"] as const).map(
              (field) => (
                <div
                  key={field}
                  className="flex flex-col items-center"
                >
                  <label className="text-sm text-gray-400 capitalize mb-1">
                    {field}
                  </label>
                  <StarRating rating={rev[field]} onChange={() => { }} readOnly />
                </div>
              )
            )}

            <p className="text-gray-400 italic">“{rev.comment}”</p>
            <span className="text-gray-400">
              Average rating:{" "}
              <strong className="text-yellow-400">{avg.toFixed(1)}</strong>
            </span>

            <button
              onClick={() => startEdit(key)}
              className="text-yellow-400 hover:text-yellow-300 transition"
              aria-label="Edit review"
            >
              <FiEdit2 size={20} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0f0d14] text-white p-4">
      <div className="flex-1 flex flex-col min-h-0 bg-[#0f0d14] text-white pb-10">

        <h2 className="text-2xl font-bold mb-4 text-center">My Reviews</h2>

        {/* Tab Switcher */}
        <div className="flex justify-center space-x-4 mb-6">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 font-semibold rounded-t-lg ${activeTab === "pending"
              ? "bg-purple-600 text-white"
              : "bg-[#1a1725] text-gray-400 hover:text-white"
              }`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-4 py-2 font-semibold rounded-t-lg ${activeTab === "completed"
              ? "bg-purple-600 text-white"
              : "bg-[#1a1725] text-gray-400 hover:text-white"
              }`}
          >
            Completed
          </button>
        </div>

        <div className="overflow-y-auto scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
          {activeTab === "pending" ? (
            <section>
              <h3 className="font-semibold mb-2">Pending Reviews</h3>
              {pendingKeys.length === 0 ? (
                <p className="text-gray-400">No pending reviews</p>
              ) : (
                pendingKeys.map((key) => renderCard(key, true))
              )}
            </section>
          ) : (
            <section>
              <h3 className="font-semibold mb-2">Completed Reviews</h3>
              {completedKeys.length === 0 ? (
                <p className="text-gray-400">
                  You haven’t submitted any reviews yet
                </p>
              ) : (
                completedKeys.map((key) => renderCard(key, false))
              )}
            </section>
          )}
        </div>
      </div>
      <div>
        <BottomMenu onAction={onAction} />
      </div>
    </div>
  );
}
