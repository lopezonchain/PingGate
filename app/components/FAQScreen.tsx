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
    answer:
      "PingGate is a free and decentralized chat, where you can also offer services or hire experts, send crypto and much more. It lets you send messages directly between crypto wallets, so only you and the person you ping can read them.",
  },
  {
    question: "How do I chat with someone?",
    answer:
      "Find Experts in Explore. Try to reach anyone with their farcaster name, ens or wallet in the Pings Inbox + icon (right bottom corner).",
  },
  {
    question: "How can I earn on PingGate?",
    answer:
      "You can earn by offering paid services like coding, consulting, reviews, mentorship, support or whatever you want! Set a price in ETH, and clients who pay unlock a private chat with you.",
  },
  {
    question: "What is an Expert?",
    answer:
      "An Expert is anyone who creates a paid service. When you list a service, your chat becomes gated. Only people who pay that price can message you in that gated chat.",
  },
  {
    question: "What is a Client?",
    answer:
      "A Client is someone who pays for an Expert’s service. After payment, the Client gets access to a private chat with that Expert’s wallet.",
  },
  {
    question: "Can I offer free pings?",
    answer:
      "Yes. Even if your main chat is gated, you can add a free service so people can still send you free pings anytime.",
  },
  {
    question: "Where do payments go?",
    answer:
      "Payments use ETH on the Base network. This means very low fees and fast transactions compared to other networks.",
  },
  {
    question: "Why Base and ETH?",
    answer:
      "Base is an Ethereum layer-2 with very low gas fees and fast confirmations. Using ETH ensures payments are secure and wallet-native.",
  },
  {
    question: "How do I create my own service?",
    answer:
      "Go to My Services, click the + button, enter title, description, price in ETH, and estimated duration. Pay a creation fee in ETH (Base). Your service goes live immediately.",
  },
  {
    question: "When someone buys my service, what happens?",
    answer:
      "When a buyer pays, they unlock a gated chat with your wallet. You’ll see them as a Client and can reply privately in that chat. Also you will receive 92% of the funds while the platform keeps 8% as fee",
  },
  {
    question: "What are the platform fees?",
    answer:
      "There is a fixed fee to create and edit services, and 8% fee of every service buy. This will help the platform keep improving and offering more and more!",
  },
  {
    question: "How do reviews work?",
    answer:
      "After buying a service, a Client can leave a rating and comment. Reviews help other people know which Experts are reliable. And gives info to the expert about the experience offered.",
  },
  {
    question: "How do I find services or Experts?",
    answer:
      "Use the Explore tab: type any words you like, such as “coaching”, “design”, or “crypto”. The search checks each word anywhere in the question or answer, so it finds all matching services.",
  },
  {
    question: "How do I receive chat notifications?",
    answer:
      "Right now notifications are only available through Farcaster app. Add miniapp and Enable notifications in order to receive them! ",
  },
];

export default function FaqScreen({ onBack }: FaqScreenProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  // Split search into terms, filter FAQs if ALL terms appear anywhere
  const filtered = faqs.filter(({ question, answer }) => {
    const text = (question + " " + answer).toLowerCase();
    return searchTerm
      .toLowerCase()
      .split(/\s+/)
      .every((term) => term === "" || text.includes(term));
  });

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

      <h2 className="text-3xl font-bold mb-4 text-center">
        FAQ
      </h2>

      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search FAQs"
        className="mb-6 p-2 rounded-lg bg-[#1a1725] text-white placeholder-gray-500 w-full"
      />

      <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-center">
            No FAQs match your search.
          </p>
        ) : (
          filtered.map((faq, idx) => {
            const isOpen = expanded === idx;
            return (
              <div
                key={idx}
                className="w-full bg-[#1a1725] rounded-2xl shadow-lg transition"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full flex justify-between items-center p-4 text-left"
                >
                  <span className="font-medium text-lg">{faq.question}</span>
                  {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-gray-300">{faq.answer}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
