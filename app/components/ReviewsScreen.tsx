// src/components/ReviewsScreen.tsx
"use client";

import React, { useEffect, useState } from "react";
import { FiArrowLeft, FiEdit2, FiCheckCircle } from "react-icons/fi";
import { useWalletClient } from "wagmi";
import {
    getPurchasesBy,
    getService,
    getReview,
    submitReview,
    getAverageRating,
} from "../services/contractService";

interface ServiceDetails {
    id: bigint;
    seller: `0x${string}`;
    title: string;
    description: string;
    price: bigint;
    duration: bigint;
    active: boolean;
}

interface ReviewForm {
    q: number;
    c: number;
    t: number;
    comment: string;
}

interface ReviewsScreenProps {
    onBack: () => void;
}

export default function ReviewsScreen({ onBack }: ReviewsScreenProps) {
    const { data: walletClient } = useWalletClient();
    const address = walletClient?.account.address!;
    const [pending, setPending] = useState<bigint[]>([]);
    const [completed, setCompleted] = useState<bigint[]>([]);
    const [services, setServices] = useState<Record<string, ServiceDetails>>({});
    const [reviews, setReviews] = useState<Record<string, ReturnType<typeof getReview>>>({});
    const [averages, setAverages] = useState<Record<string, number>>({});
    const [form, setForm] = useState<Record<string, ReviewForm>>({});

    useEffect(() => {
        (async () => {
            const ids = await getPurchasesBy(address);
            const pend: bigint[] = [];
            const comp: bigint[] = [];

            for (const id of ids) {
                // 1️⃣ Traer datos del servicio
                const svc = await getService(id);
                setServices((p) => ({ ...p, [id.toString()]: svc }));

                // 2️⃣ Leer review on‐chain
                const rev = await getReview(id, address);
                // 3️⃣ Inicializar form con datos existentes
                setForm((p) => ({
                    ...p,
                    [id.toString()]: {
                        q: rev.quality,
                        c: rev.communication,
                        t: rev.timeliness,
                        comment: rev.comment,
                    },
                }));

                if (rev.timestamp === BigInt(0)) {
                    pend.push(id);
                } else {
                    comp.push(id);
                    setReviews((p) => ({ ...p, [id.toString()]: rev }));
                    // 4️⃣ Leer nota media de ese servicio
                    const avg = await getAverageRating(id);
                    setAverages((a) => ({ ...a, [id.toString()]: avg }));
                }
            }

            setPending(pend);
            setCompleted(comp);
        })();
    }, [walletClient]);

    const onSubmit = async (id: bigint) => {
        const f = form[id.toString()];
        await submitReview(
            walletClient!,
            Number(id),
            f.q,
            f.c,
            f.t,
            f.comment
        );
        // actualizar estados locales
        setPending((p) => p.filter((x) => x !== id));
        setCompleted((c) => [id, ...c]);
        setReviews((r) => ({
            ...r,
            [id.toString()]: {
                quality: f.q,
                communication: f.c,
                timeliness: f.t,
                comment: f.comment,
                timestamp: BigInt(Math.floor(Date.now() / 1000)),
            },
        }));
        // recalc nota media tras review
        const newAvg = await getAverageRating(id);
        setAverages((a) => ({ ...a, [id.toString()]: newAvg }));
    };

    return (
        <div className="h-[90%] flex flex-col bg-[#0f0d14] text-white relative">
            <button
                onClick={onBack}
                className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
            >
                <FiArrowLeft className="w-5 h-5 mr-2" />
                Back
            </button>

            <h2 className="text-2xl font-bold mb-4 text-center">My Reviews</h2>

            {/* PENDING */}
            <section className="mb-6">
                <h3 className="font-semibold mb-2">Pending Reviews</h3>
                {pending.length === 0 && (
                    <p className="text-gray-400">No pending reviews</p>
                )}
                {pending.map((id) => {
                    const svc = services[id.toString()]!;
                    const f = form[id.toString()];
                    return (
                        <div
                            key={id.toString()}
                            className="bg-[#1a1725] p-4 rounded-lg mb-4"
                        >
                            <p className="font-semibold">{svc.title}</p>
                            <div className="mt-2 space-y-2">
                                {/** Campos de puntuación */}
                                <div>
                                    <label>Quality 0–5</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={5}
                                        value={f.q}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                [id.toString()]: {
                                                    ...p[id.toString()],
                                                    q: Number(e.target.value),
                                                },
                                            }))
                                        }
                                        className="ml-2 w-12 bg-[#2a2438] p-1 rounded"
                                    />
                                </div>
                                <div>
                                    <label>Communication 0–5</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={5}
                                        value={f.c}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                [id.toString()]: {
                                                    ...p[id.toString()],
                                                    c: Number(e.target.value),
                                                },
                                            }))
                                        }
                                        className="ml-2 w-12 bg-[#2a2438] p-1 rounded"
                                    />
                                </div>
                                <div>
                                    <label>Timeliness 0–5</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={5}
                                        value={f.t}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                [id.toString()]: {
                                                    ...p[id.toString()],
                                                    t: Number(e.target.value),
                                                },
                                            }))
                                        }
                                        className="ml-2 w-12 bg-[#2a2438] p-1 rounded"
                                    />
                                </div>

                                {/** Comentario */}
                                <textarea
                                    rows={2}
                                    placeholder="Comment"
                                    value={f.comment}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            [id.toString()]: {
                                                ...p[id.toString()],
                                                comment: e.target.value,
                                            },
                                        }))
                                    }
                                    className="w-full bg-[#2a2438] p-2 rounded"
                                />

                                {/** Botón enviar */}
                                <button
                                    onClick={() => onSubmit(id)}
                                    className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
                                >
                                    <FiCheckCircle className="mr-2" /> Submit
                                </button>
                            </div>
                        </div>
                    );
                })}
            </section>

            {/* COMPLETED */}
            <section>
                <h3 className="font-semibold mb-2">Completed Reviews</h3>
                {completed.length === 0 && (
                    <p className="text-gray-400">No reviews yet</p>
                )}
                {completed.map((id) => {
                    const svc = services[id.toString()]!;
                    const rev = reviews[id.toString()]!;
                    const avg = averages[id.toString()];
                    return (
                        <div
                            key={id.toString()}
                            className="bg-[#1a1725] p-4 rounded-lg mb-4"
                        >
                            <p className="font-semibold">{svc.title}</p>

                            <div className="flex justify-between items-center mt-2">
                                <p className="text-sm">
                                    ⭐ {rev.quality}, 🗣️ {rev.communication}, ⏱️ {rev.timeliness}
                                </p>
                                <span className="text-xs text-gray-400">
                                    Avg ★ {avg}
                                </span>
                                <button
                                    onClick={() => {
                                        /* aquí podrías reusar el mismo formulario para editar */
                                    }}
                                    className="text-yellow-400"
                                >
                                    <FiEdit2 />
                                </button>
                            </div>

                            <p className="text-xs text-gray-400 mt-1">{rev.comment}</p>
                        </div>
                    );
                })}
            </section>
        </div>
    );
}
