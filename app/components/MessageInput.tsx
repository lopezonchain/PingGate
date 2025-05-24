import React, { useState, useRef, useEffect } from "react";
import {
  FiX,
  FiSend,
  FiPlus,
  FiImage,
  FiFile,
  FiTrash2,
  FiSmile,
  FiDollarSign,
} from "react-icons/fi";
import dynamic from "next/dynamic";
import { EmojiClickData, Theme } from "emoji-picker-react";

const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export type XMTPAttachment = {
  filename: string;
  mimeType: string;
  data: Uint8Array;
};

interface MessageInputProps {
  /** Ahora acepta: texto (string) o attachment XMTP */
  onSend: (payload: string | XMTPAttachment) => void;
  /** Si está en conversación inline o no */
  inConversation?: boolean;
}

export default function MessageInput({
  onSend,
  inConversation = false,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [menuAnchor, setMenuAnchor] =
    useState<{ x: number; y: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineTextRef = useRef<HTMLTextAreaElement>(null);

  // Ajusta la altura del textarea inline según el contenido
  const adjustInlineHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    if (modalOpen) textareaRef.current?.focus();
  }, [modalOpen]);

  useEffect(() => {
    if (inConversation) adjustInlineHeight(inlineTextRef.current);
  }, [text, inConversation]);

  const closeModal = () => {
    setModalOpen(false);
    setMenuOpen(false);
    setShowPicker(false);
  };

  const resetAll = () => {
    setText("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setSelectedFile(null);
    }
    closeModal();
  };

  const submitText = async () => {
    if (selectedFile) {
      const buffer = await selectedFile.arrayBuffer();
      const data = new Uint8Array(buffer);
      const attachment = {
        filename: selectedFile.name,
        mimeType: selectedFile.type,
        data,
      };
      onSend(attachment);
    } else if (text.trim()) {
      onSend(text);
    } else {
      return;
    }
    resetAll();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitText();
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData, event: MouseEvent) => {
    const img = event.target as HTMLImageElement;
    const filename = img.src.split("/").pop() || "";
    const code = filename.split(".")[0];
    const chars = code.split("-").map((c) => parseInt(c, 16));
    const emoji = String.fromCodePoint(...chars);
    setText((prev) => prev + emoji);
    setShowPicker(false);
    setMenuOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      alert("⚠️ El archivo supera 1 MB y podría fallar al enviarse.");
    }
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    setMenuOpen(false);
    e.target.value = "";
  };

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setMenuAnchor({ x: e.clientX, y: e.clientY });
    setMenuOpen((o) => !o);
  };

  const openModal = () => {
    if (!inConversation) {
      setModalOpen(true);
    }
    setMenuOpen(false);
  };

  const removeAttachment = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setSelectedFile(null);
    }
  };

  return (
    <>
      {/* INLINE INPUT */}
      <div className="mt-3 flex items-end space-x-2">
        <button
          onClick={openMenu}
          className="p-2 mb-2 bg-[#2a2438] text-white rounded-lg"
        >
          <FiPlus />
        </button>

        <div className="flex-1 relative">
          {previewUrl ? (
            <div className="relative inline-block">
              <img
                src={previewUrl}
                alt="preview"
                className="w-20 h-20 object-cover rounded-lg"
              />
              <button
                onClick={removeAttachment}
                className="absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-full"
              >
                <FiTrash2 className="text-white" size={12} />
              </button>
            </div>
          ) : inConversation ? (
            <textarea
              ref={inlineTextRef}
              className="w-full px-4 bg-[#2a2438] text-white rounded-lg resize-none overflow-hidden
                transition-shadow duration-200
                focus:shadow-[0_0_8px_rgba(139,92,246,0.5)]
                focus:outline-none focus:ring-0 focus:border focus:border-[#8b5cf6]
                focus-visible:outline-none focus-visible:ring-0"
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onInput={(e) => adjustInlineHeight(e.currentTarget)}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <input
              className="w-full px-4 py-2 bg-[#2a2438] text-white rounded-lg cursor-text"
              placeholder="Type a message..."
              value={text}
              readOnly
              onClick={openModal}
            />
          )}
        </div>

        <button
          onClick={submitText}
          className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white mb-2"
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
          className={`
            fixed z-[60] bg-[#0f0d14] rounded-lg shadow-lg p-2 flex flex-col space-y-1
            w-56 sm:w-40 min-w-[250px] max-w-[300px] max-h-[50vh] overflow-auto
          `}
          style={{
            top: `${Math.min(menuAnchor.y, window.innerHeight - 10)}px`,
            left: `${Math.min(menuAnchor.x, window.innerWidth - 10)}px`,
            transform: "translate(0, -100%)",
          }}
        >
          <button
            onClick={() => setMenuOpen(false)}
            className="self-end pt-2 pr-4 hover:bg-[#231c32] rounded text-white"
            aria-label="Cerrar menú"
          >
            <FiX />
          </button>

          <button
            onClick={() => {
              setShowPicker(true);
              setMenuOpen(false);
            }}
            className="flex items-center px-3 py-2 hover:bg-[#231c32] rounded text-white"
          >
            <FiSmile className="mr-2" /> Emoji
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-3 py-2 hover:bg-[#231c32] rounded text-white"
          >
            <FiImage className="mr-2" /> Image
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-3 py-2 hover:bg-[#231c32] rounded text-white"
          >
            <FiFile className="mr-2" /> File
          </button>
          <button className="flex items-center px-3 py-2 hover:bg-[#231c32] rounded text-white">
            <FiDollarSign className="mr-2" /> Crypto
          </button>
        </div>
      )}

      {/* EMOJI PICKER */}
      {showPicker && (
        <div className="fixed inset-0 flex items-center justify-center z-[55]">
          <Picker onEmojiClick={onEmojiClick} theme={Theme.DARK} />
        </div>
      )}

      {/* FULLSCREEN MODAL */}
      {!inConversation && modalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-black bg-opacity-75">
          <div className="w-full max-w-md h-full bg-[#0f0d14] rounded-lg overflow-hidden flex flex-col">
            <div className="flex justify-end p-4">
              <button onClick={closeModal} className="text-white text-2xl">
                <FiX />
              </button>
            </div>
            <div className="flex-1 px-4 pb-4">
              {previewUrl && (
                <div className="mb-4 relative">
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="w-full object-contain rounded-lg"
                  />
                  <button
                    onClick={removeAttachment}
                    className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 rounded-full"
                  >
                    <FiTrash2 className="text-white" size={16} />
                  </button>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={(e) => {
                  e.currentTarget.setSelectionRange(
                    e.currentTarget.value.length,
                    e.currentTarget.value.length
                  );
                }}
                className="w-full h-full
                  bg-[#1a1725] text-white p-4 rounded-lg
                  scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600
                  focus:outline-none"
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