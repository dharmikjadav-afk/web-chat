function MessageBubble({ message, isOwn }) {
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`px-4 py-2 rounded-lg max-w-xs text-sm shadow
        ${
          isOwn
            ? "bg-emerald-500 text-white rounded-br-sm"
            : "bg-white dark:bg-slate-700 text-gray-800 dark:text-white rounded-bl-sm"
        }`}
      >
        {/* 📝 TEXT MESSAGE */}
        {message.messageType !== "audio" && (
          <div>{message.text}</div>
        )}

        {/* 🎤 AUDIO MESSAGE */}
        {message.messageType === "audio" && message.audio && (
          <div className="flex flex-col gap-1">
            <audio
              controls
              className="w-full max-w-[200px]"
            >
              <source src={message.audio} type="audio/webm" />
              Your browser does not support audio.
            </audio>
          </div>
        )}

        {/* ⏱ TIMESTAMP */}
        {time && (
          <div className="text-xs opacity-70 mt-1 text-right">
            {time}
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;