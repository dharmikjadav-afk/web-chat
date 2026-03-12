import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

function Chat() {
  const { logout } = useContext(AuthContext);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">Chat Page 🚀</h1>

      <button
        onClick={logout}
        className="px-6 py-2 bg-red-500 text-white rounded-lg"
      >
        Logout
      </button>
    </div>
  );
}

export default Chat;
