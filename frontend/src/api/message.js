import axios from "axios";

// Base URL
const API = "http://localhost:5000/api/messages";

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");

  return {
    Authorization: `Bearer ${token}`,
  };
};

// ─────────────────────────────────────────────
// 📤 SEND TEXT / ENCRYPTED MESSAGE
// ─────────────────────────────────────────────
export const sendMessageApi = async (data) => {
  try {
    const res = await axios.post(API, data, {
      headers: getAuthHeaders(),
    });

    return res.data;
  } catch (error) {
    console.error("sendMessageApi error:", error);
    throw error;
  }
};

// ─────────────────────────────────────────────
// 🎤 SEND AUDIO MESSAGE
// ─────────────────────────────────────────────
export const sendAudioMessageApi = async (formData) => {
  try {
    const res = await axios.post(API, formData, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data;
  } catch (error) {
    console.error("sendAudioMessageApi error:", error);
    throw error;
  }
};

// ─────────────────────────────────────────────
// 📥 GET CHAT MESSAGES
// ─────────────────────────────────────────────
export const getMessagesApi = async (userId) => {
  try {
    const res = await axios.get(`${API}/${userId}`, {
      headers: getAuthHeaders(),
    });

    return res.data;
  } catch (error) {
    console.error("getMessagesApi error:", error);
    throw error;
  }
};
