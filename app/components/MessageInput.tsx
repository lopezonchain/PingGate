// src/components/MessageInput.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FiX,
  FiSend,
  FiPlus,
  FiImage,
  FiFile,
} from "react-icons/fi";
import dynamic from "next/dynamic";
import { EmojiClickData, Theme } from "emoji-picker-react";

const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export default function MessageInput({
  onSend,
}: {
  onSend: (payload: string | File) => void;
}) {
  const [text, setText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [menuAnchor, setMenuAnchor] =
    useState<{ x: number; y: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalOpen) textareaRef.current?.focus();
  }, [modalOpen]);

  const resetAll = () => {
    setText("");
    setModalOpen(false);
    setMenuOpen(false);
    setShowPicker(false);
    setMenuAnchor(null);
  };

  const submitText = () => {
    if (!text.trim()) return;
    onSend(text);
    resetAll();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitText();
    }
  };

  // ➤ firma correcta: primero EmojiClickData, luego DOM MouseEvent
  const onEmojiClick = (
    emojiData: EmojiClickData,
    event: MouseEvent
  ) => {
    // extraemos Unicode desde la URL del sprite
    const img = event.target as HTMLImageElement;
    const filename = img.src.split("/").pop() || "";
    const code = filename.split(".")[0];           // ej. "1f609"
    const chars = code.split("-").map(c => parseInt(c, 16));
    const emoji = String.fromCodePoint(...chars);
    setText(prev => prev + emoji);
    setShowPicker(false);
    setMenuOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      alert("⚠️ El archivo supera 1 MB y podría fallar al enviarse.");
    }
    onSend(file);
    resetAll();
    e.target.value = "";
  };

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setMenuAnchor({ x: e.clientX, y: e.clientY });
    setMenuOpen(o => !o);
    if (!modalOpen) setModalOpen(false);
  };

  const openModal = () => {
    setModalOpen(true);
    setMenuOpen(false);
  };

  return (
    <>
      {/* INLINE INPUT */}
      <div className="mt-3 flex items-center space-x-2">
        <button
          onClick={openMenu}
          className="p-2 bg-[#2a2438] text-white rounded-lg"
        >
          <FiPlus />
        </button>

        <input
          className="flex-1 min-w-0 px-4 py-2 bg-[#2a2438] text-white rounded-lg cursor-text"
          placeholder="Type a message..."
          value={text}
          readOnly
          onClick={openModal}
        />

        <button
          onClick={submitText}
          className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
        >
          <FiSend />
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* FLOATING MENU */}
      {menuOpen && menuAnchor && (
        <div
          className="z-50 w-40 bg-[#0f0d14] rounded-lg shadow-lg p-2 flex flex-col space-y-1"
          style={{
            position: "fixed",
            top: menuAnchor.y,
            left: menuAnchor.x,
            transform: "translate(-50%, -100%)",
          }}
        >
          <button
            onClick={() => {
              setShowPicker(true);
              setMenuOpen(false);
            }}
            className="flex items-center px-3 py-2 hover:bg-[#231c32] rounded text-white"
          >
            <FiPlus className="mr-2" /> Emoji
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-3 py-2 hover:bg-[#231c32] rounded text-white"
          >
            <FiImage className="mr-2" /> Imagen
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-3 py-2 hover:bg-[#231c32] rounded text-white"
          >
            <FiFile className="mr-2" /> Archivo
          </button>
        </div>
      )}

      {/* EMOJI PICKER OVERLAY */}
      {showPicker && (
        <Picker
          onEmojiClick={onEmojiClick}
          theme={Theme.DARK}
          style={{
            position: "fixed",
            bottom: "80px",
            right: "20px",
            zIndex: 2000,
          }}
        />
      )}

      {/* FULLSCREEN MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-black bg-opacity-75">
          <div className="w-full max-w-md h-full bg-[#0f0d14] rounded-lg overflow-hidden flex flex-col">
            <div className="flex justify-end p-4">
              <button onClick={resetAll} className="text-white text-2xl">
                <FiX />
              </button>
            </div>
            <div className="flex-1 px-4 pb-4">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="
                  w-full h-full
                  bg-[#1a1725] text-white p-4 rounded-lg
                  scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600
                  focus:outline-none
                "
                placeholder="Type your message…"
              />
            </div>
            <div className="p-4 border-t border-gray-700 flex space-x-2">
              <button
                onClick={openMenu}
                className="p-2 bg-[#2a2438] rounded-lg text-white"
              >
                <FiPlus />
              </button>
              <button
                onClick={submitText}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-bold"
              >
                <FiSend />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
