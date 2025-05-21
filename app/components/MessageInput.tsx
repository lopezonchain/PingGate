"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiX, FiSend } from "react-icons/fi";

export default function MessageInput({
  onSend,
}: {
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (modalOpen) {
      textareaRef.current?.focus();
    }
  }, [modalOpen]);

  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
    setModalOpen(false);
  };

  return (
    <>
      {/* inline pequeño */}
      <div className="mt-3 flex space-x-2">
        <input
          className="flex-1 min-w-0 px-4 py-2 bg-[#2a2438] text-white rounded-lg cursor-text"
          placeholder="Type a message..."
          value={text}
          readOnly
          onClick={() => setModalOpen(true)}
        />
        <button
          onClick={() => text.trim() && submit()}
          className="px-4 text-white rounded-lg bg-purple-600 hover:bg-purple-700 font-bold"
        >
          Send
        </button>
      </div>

      {/* modal fullscreen */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black bg-opacity-75">
          {/* cabecera con cerrar */}
          <div className="max-w-md p-4 flex justify-end">
            <button
              onClick={() => setModalOpen(false)}
              className="text-white text-2xl"
            >
              <FiX />
            </button>
          </div>

          {/* textarea auto-creciente */}
          <div className="flex-1 max-w-md px-4 pb-4">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={`
                w-full h-full resize-none
                bg-[#1a1725] text-white p-4 rounded-lg
                scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600
                focus:outline-none
              `}
              placeholder="Type your message..."
            />
          </div>

          {/* botón fijo abajo */}
          <div className="p-4 max-w-md border-t border-gray-700 bg-[#0f0d14]">
            <button
              onClick={submit}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-bold"
            >
              <FiSend />
              <span>Send</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
