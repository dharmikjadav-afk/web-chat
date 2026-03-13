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
        {/* message text */}
        <div>{message.text}</div>

        {/* timestamp */}
        {time && (
          <div className="text-xs opacity-70 mt-1 text-right">{time}</div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
