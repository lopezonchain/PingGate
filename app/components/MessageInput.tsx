// src/components/MessageInput.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiX, FiSend, FiPlus, FiImage, FiFile } from "react-icons/fi";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";

const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export default function MessageInput({
  onSend,
}: {
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalOpen) textareaRef.current?.focus();
  }, [modalOpen]);

  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
    setModalOpen(false);
    setMenuOpen(false);
    setShowPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  //  ← Parámetros intercambiados para coincidir con la firma de emoji-picker-react
  const onEmojiClick = (
    emojiData: EmojiClickData,
    event: React.MouseEvent<HTMLButtonElement | HTMLImageElement>
  ) => {
    setText((prev) => prev + emojiData.emoji);
    setShowPicker(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      alert("⚠️ El archivo supera 1 MB y podría fallar al enviarse.");
    }
    // Aquí podrías gestionar el envío del archivo…
    e.target.value = "";
    setMenuOpen(false);
  };

  return (
    <>
      {/* INPUT REDUCIDO CON BOTÓN + */}
      <div className="mt-3 flex items-center space-x-2 relative">
        <button
          onClick={() => {
            setMenuOpen((o) => !o);
            setModalOpen(false);
          }}
          className="p-2 bg-[#2a2438] text-white rounded-lg"
        >
          <FiPlus />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full mb-2 left-0 z-50 w-40 bg-[#0f0d14] rounded-lg shadow-lg p-2 flex flex-col space-y-1">
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

        <input
          className="flex-1 min-w-0 px-4 py-2 bg-[#2a2438] text-white rounded-lg cursor-text"
          placeholder="Type a message..."
          value={text}
          readOnly
          onClick={() => {
            setModalOpen(true);
            setMenuOpen(false);
          }}
        />

        <button
          onClick={() => text.trim() && submit()}
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

      {/* EMOJI PICKER en overlay */}
      {showPicker && (
        <Picker
          onEmojiClick={onEmojiClick}
          theme="dark"
          pickerStyle={{
            position: "fixed",
            bottom: "80px",
            right: "20px",
            zIndex: 2000,
          }}
        />
      )}

      {/* MODAL FULLSCREEN */}
      {modalOpen && (
        <div className="fixed w-full inset-0 z-50 flex justify-center items-center bg-black bg-opacity-75">
          <div className="w-full max-w-md h-full bg-[#0f0d14] rounded-lg overflow-hidden flex flex-col">
            <div className="flex justify-end p-4">
              <button
                onClick={() => setModalOpen(false)}
                className="text-white text-2xl"
              >
                <FiX />
              </button>
            </div>

            <div className="flex-1 px-4 pb-4">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
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
                onClick={() => {
                  setMenuOpen((o) => !o);
                  setModalOpen(true);
                }}
                className="p-2 bg-[#2a2438] rounded-lg text-white"
              >
                <FiPlus />
              </button>
              <button
                onClick={submit}
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
