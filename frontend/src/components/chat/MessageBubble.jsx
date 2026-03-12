function MessageBubble({ message, isOwn }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`px-4 py-2 rounded-lg max-w-xs text-sm shadow
        ${
          isOwn
            ? "bg-emerald-500 text-white"
            : "bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white"
        }`}
      >
        {message}
        <div className="text-xs opacity-70 mt-1">
          {message.createdAt &&
            new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
