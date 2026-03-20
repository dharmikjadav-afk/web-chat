// src/utils/voiceRecorder.js

// ─────────────────────────────────────────────
// 🎤 Start Recording
// ─────────────────────────────────────────────
export const startRecording = async (
  mediaRecorderRef,
  audioChunksRef,
  setIsRecording,
) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start();
    setIsRecording(true);
  } catch (error) {
    console.error("Error starting recording:", error);
  }
};

// ─────────────────────────────────────────────
// 🎤 Stop Recording
// ─────────────────────────────────────────────
export const stopRecording = (mediaRecorderRef) => {
  return new Promise((resolve, reject) => {
    try {
      const recorder = mediaRecorderRef.current;

      if (!recorder) {
        return reject("No active recorder");
      }

      recorder.onstop = () => {
        resolve();
      };

      recorder.stop();
    } catch (error) {
      reject(error);
    }
  });
};

// ─────────────────────────────────────────────
// 🎧 Get Audio Blob
// ─────────────────────────────────────────────
export const getAudioBlob = (audioChunksRef) => {
  try {
    if (!audioChunksRef.current.length) return null;

    return new Blob(audioChunksRef.current, {
      type: "audio/webm",
    });
  } catch (error) {
    console.error("Error creating audio blob:", error);
    return null;
  }
};

// ─────────────────────────────────────────────
// 📤 Create FormData for Upload
// ─────────────────────────────────────────────
export const createAudioFormData = (audioBlob, receiverId) => {
  const formData = new FormData();

  formData.append("audio", audioBlob);
  formData.append("receiver", receiverId);

  return formData;
};
