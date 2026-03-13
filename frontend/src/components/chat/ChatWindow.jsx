import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

function ChatWindow({
  selectedUser,
  messages,
  setMessages,
  currentUser,
  onlineUsers,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!selectedUser) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400 dark:text-slate-500">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <span className="text-3xl">💬</span>
        </div>
        <p className="text-sm font-medium">Select a user to start chatting</p>
      </div>
    );
  }

  const selectedUserId = selectedUser._id || selectedUser.id;
  const isOnline = onlineUsers?.includes(String(selectedUserId));

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
            {selectedUser.name?.charAt(0).toUpperCase()}
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white dark:border-slate-800 rounded-full" />
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white leading-tight">
            {selectedUser.name}
          </h3>
          <p
            className={`text-xs font-medium ${isOnline ? "text-green-400" : "text-gray-400 dark:text-slate-400"}`}
          >
            {isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 dark:text-slate-500">
              No messages yet. Say hi! 👋
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            // ✅ THE FIX: String() both sides to handle
            // populated objects, plain IDs, and ObjectIds
            const senderId = String(
              msg.sender?._id || msg.sender?.id || msg.sender || "",
            );
            const isOwn = senderId === String(currentUser);

            return <MessageBubble key={msg._id} message={msg} isOwn={isOwn} />;
          })
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        selectedUser={selectedUser}
        setMessages={setMessages}
        currentUser={currentUser}
      />
    </div>
  );
}

export default ChatWindow;
