import React from "react";
import FaqList from "./FAQList";
import { WarpView } from "../page-client";
import BottomMenu from "./BottomMenu";

interface FaqScreenProps {
    onAction: (view: WarpView) => void;
}

export default function FaqScreen({ onAction }: FaqScreenProps) {
    return (
        <div className="h-full flex flex-col bg-[#0f0d14] text-white pb-14">
            {/* Contenedor principal: header + lista scrollable */}
            <div className="flex-1 flex flex-col min-h-0 p-4 overflow-y-auto scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
                <h2 className="text-3xl font-bold mb-4 text-center">FAQ</h2>
                <FaqList />
            </div>

            {/* Menú inferior fijo */}
            <div className="flex-shrink-0">
                <BottomMenu onAction={onAction} />
            </div>
        </div>
    );
}
