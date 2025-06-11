import React, { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

interface FAQ {
    question: string;
    answer: string;
}

export default function FaqList() {
    const [searchTerm, setSearchTerm] = useState("");
    const [expanded, setExpanded] = useState<number | null>(null);

    const faqs: FAQ[] = [
        {
            question: "What is PingGate?",
            answer:
                "PingGate is a free to use and decentralized chat, where you can also offer services or hire experts, send crypto and much more. It lets you send messages directly between crypto wallets, and only you and the person you ping can read them",
        },
        {
            question: "What is XMTP?",
            answer:
                "XMTP is the chat tech! PingGate uses it because it is just incredible, you can find more about it on xmtp.org",
        },
        {
            question: "How do I chat with someone?",
            answer:
                "Find Experts in Explore. Try to reach anyone with their farcaster name, ens or wallet in the Pings Inbox + icon (right bottom)",
        },
        {
            question: "How can I earn on PingGate?",
            answer:
                "You can earn by offering paid services like coding, consulting, reviews, mentorship, support or whatever you want! Set a price in ETH, and clients who pay unlock a private chat with you. And all the data is stored onchain",
        },
        {
            question: "How do I find services or Experts?",
            answer:
                "Use the Explore tab: type any words you like, such as “coaching”, “design”, or “crypto”. You can search them by Title or Expert's name"
        },
        {
            question: "How do I receive chat notifications?",
            answer:
                "Right now notifications are only available through Farcaster app. Add miniapp and Enable notifications in order to receive them! ",
        },
        {
            question: "What is an Expert?",
            answer:
                "An Expert is anyone who creates a paid service. When you list a service, your chat becomes gated. Only people who pay that price can message you in PingGate",
        },
        {
            question: "What is a Client?",
            answer:
                "A Client is someone who pays for an Expert’s service. After payment, the Client gets access to a private chat with that Expert’s wallet",
        },
        {
            question: "Can I offer free pings?",
            answer:
                "By default it is completely free to chat with anyone. But when you offer a service your PingGate chat will gated",
        },
        {
            question: "Why Base and ETH?",
            answer:
                "Base is an Ethereum layer-2 with very low gas fees and fast confirmations. Using ETH ensures payments are secure and wallet-native",
        },
        {
            question: "How do I create my own service?",
            answer:
                "Go to My Services, click the + button, enter title, description, price in ETH, and estimated duration. Pay a creation fee in ETH (Base). Your service goes live immediately",
        },
        {
            question: "Why the creation and edit fees?",
            answer:
                "This is mainly for preventing misusage, flooding and attracting only serious people, while also helps the platform running",
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
            question: "How platform gains will be used?",
            answer:
                "PingGate is not meant to be just a marketplace, it wants to help the community by providing security in transactions. Any kind of funds will allow PingGate improving, and when all the job is done it'll start rewarding its users",
        },
        {
            question: "How do reviews work?",
            answer:
                "After buying a service, a Client can leave a rating and comment. Reviews help other people know which Experts are reliable. And gives info to the expert about the experience offered",
        },
        {
            question: "What are next steps for PingGate?",
            answer:
                "Next logical step is having a decentralized escrow system to give more security to everyone and share gains with anyone that wants to contribute. While also remaining focused about having a best chat implementation from all XMTP capabilities",
        },
    ];

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
        <div className="flex-1 flex flex-col">
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
