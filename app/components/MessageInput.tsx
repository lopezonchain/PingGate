import React, { useState } from "react";

export default function MessageInput({
  onSend,
}: {
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };
  return (
    <div className="mt-3 flex space-x-2">
      <input
        className="flex-1 px-4 py-2 bg-[#2a2438] text-white rounded-lg"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button
        onClick={submit}
        className="px-4 text-white rounded-lg bg-purple-600 hover:bg-purple-700 font-bold"
      >
        Send
      </button>
    </div>
  );
}
