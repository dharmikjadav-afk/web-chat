import { createContext, useState, useEffect } from "react";
import { generateKeyPair } from "../crypto/crypto";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  const login = async (data) => {
    // ✅ Save token FIRST so API calls work immediately
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("userId", data.user.id);

    // Generate keys if not already present
    let publicKey = localStorage.getItem("publicKey");
    let privateKey = localStorage.getItem("privateKey");

    if (!publicKey || !privateKey) {
      console.log("Generating encryption keys...");
      const keyPair = await generateKeyPair();
      publicKey = keyPair.publicKey;
      privateKey = keyPair.privateKey;
      localStorage.setItem("publicKey", publicKey);
      localStorage.setItem("privateKey", privateKey);
    }

    // ✅ Save public key to backend AFTER token is stored
    try {
      const res = await fetch(
        "http://localhost:5000/api/auth/save-public-key",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.token}`, // ✅ use data.token directly
          },
          body: JSON.stringify({ publicKey }),
        },
      );
      const result = await res.json();
      console.log("Public key saved:", result.message);
    } catch (err) {
      console.error("Failed to save public key:", err);
    }

    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    // ✅ Keep keys so old messages stay decryptable
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
