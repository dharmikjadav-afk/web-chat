import { useEffect, useState } from "react";
import axios from "axios";

function ChatSidebar({ setSelectedUser, setMessages }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");

      const res = await axios.get("http://localhost:5000/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUsers(res.data);
    };

    fetchUsers();
  }, []);

  const openChat = async (user) => {
    const token = localStorage.getItem("token");

    const res = await axios.get(
      `http://localhost:5000/api/messages/${user._id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    setSelectedUser(user);
    setMessages(res.data);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
          Chats
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {users.map((user) => (
          <div
            key={user._id}
            onClick={() => openChat(user)}
            className="p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700"
          >
            <div className="font-medium text-gray-800 dark:text-white">
              {user.name}
            </div>

            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatSidebar;
