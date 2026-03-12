import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

function ChatWindow({ selectedUser, messages, setMessages }) {
  if (!selectedUser) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Select a user to start chatting
      </div>
    );
  }

  const currentUser = localStorage.getItem("userId");
  
  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          {selectedUser.name}
        </h3>
      </div>
      {/* Messages */}

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => {
          const senderId = msg.sender?._id || msg.sender;

          const isOwn = senderId === currentUser;

          return (
            <MessageBubble key={msg._id} message={msg.text} isOwn={isOwn} />
          );
        })}
      </div>
      <MessageInput selectedUser={selectedUser} setMessages={setMessages} />
    </div>
  );
}

export default ChatWindow;
