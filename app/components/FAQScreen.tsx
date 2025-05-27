// src/screens/FaqScreen.tsx
"use client";

import React, { useState } from "react";
import { FiArrowLeft, FiChevronDown, FiChevronUp } from "react-icons/fi";

interface FAQ {
    question: string;
    answer: string;
}

interface FaqScreenProps {
    onBack: () => void;
}

const faqs: FAQ[] = [
    {
        question: "What is PingGate?",
        answer: "PingGate is a decentralized marketplace where you can offer or purchase expert services using ETH on the Base network. It integrates on-chain payments and off-chain communication."
    },
    {
        question: "How do I explore services?",
        answer: "Use the Explore tab to see all active services. You can search by keyword or seller name, and purchase services directly with a click."
    },
    {
        question: "How can I create my own service?",
        answer: "Go to My Services and click the + button. Fill in title, description, price and duration. Pay a small creation fee in ETH, and your service is live."
    },
    {
        question: "What happens when someone purchases my service?",
        answer: "When someone buys your service, they pay the listed price in ETH. Your contact becomes accessible via a gated chat, so only buyers can message you."
    },
    {
        question: "How do reviews work?",
        answer: "After purchasing a service, buyers can leave a star-based review and comment. Reviews help others choose quality services and calculate average ratings."
    },
    {
        question: "Why do we use ETH on the Base network?",
        answer: "Using ETH on Base offers very low gas fees compared to other networks, making transactions affordable and fast."
    },
    {
        question: "How does chat gating work?",
        answer: "Once you create a service, your chat is gated: only users who purchase your service unlock the ability to message you on PingGate."
    }
];

export default function FaqScreen({ onBack }: FaqScreenProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [expanded, setExpanded] = useState<number | null>(null);

    const filtered = faqs.filter(
        ({ question, answer }) =>
            question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            answer.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggle = (index: number) => {
        setExpanded(expanded === index ? null : index);
    };

    return (
        <div className="h-full flex flex-col bg-[#0f0d14] text-white p-4">
            <button
                onClick={onBack}
                className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
            >
                <FiArrowLeft className="w-5 h-5 mr-2" />
                Back
            </button>

            <h2 className="text-3xl font-bold mb-4 text-center">Frequently Asked Questions</h2>

            <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search FAQs"
                className="mb-6 p-2 rounded-lg bg-[#1a1725] text-white placeholder-gray-500 w-full"
            />

            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
                {filtered.length === 0 ? (
                    <p className="text-gray-400 text-center">No FAQs match your search.</p>
                ) : (
                    filtered.map((faq, idx) => {
                        const isOpen = expanded === idx;
                        return (
                            <div key={idx} className="w-full bg-[#1a1725] rounded-2xl shadow-lg transition">
                                <button
                                    onClick={() => toggle(idx)}
                                    className="w-full flex justify-between items-center p-4 text-left"
                                >
                                    <span className="font-medium text-lg">{faq.question}</span>
                                    {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                                </button>
                                {isOpen && (
                                    <div className="px-4 pb-4 text-gray-300">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
