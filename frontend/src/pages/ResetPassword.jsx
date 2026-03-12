import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff } from "lucide-react";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      return toast.error("Please fill all fields");
    }

    if (password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    if (password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }

    try {
      setLoading(true);

      await axios.post(
        `http://localhost:5000/api/auth/reset-password/${token}`,
        { password },
      );

      toast.success("Password reset successful");

      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-slate-900">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-slate-700"
      >
        <h2 className="text-2xl font-semibold text-center mb-2 text-gray-800 dark:text-white">
          Reset Password
        </h2>

        <p className="text-center text-gray-500 dark:text-slate-400 mb-6">
          Enter your new password below
        </p>

        <form onSubmit={submit} className="space-y-4">
          {/* New Password */}

          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />

            <input
              type={showPassword ? "text" : "password"}
              placeholder="New Password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-10 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Confirm Password */}

          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />

            <input
              type="password"
              placeholder="Confirm Password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full pl-10 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <button
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-lg transition disabled:opacity-60"
          >
            {loading ? "Updating..." : "Reset Password"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default ResetPassword;
