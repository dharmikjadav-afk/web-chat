import { useState, useContext } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { loginUser } from "../api/auth";
import { AuthContext } from "../context/AuthContext";

function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      return toast.error("Please fill all fields");
    }

    try {
      setLoading(true);

      const res = await loginUser({
        email,
        password,
      });

      // Save user using AuthContext
      login(res);

      toast.success("Login successful");

      navigate("/chat");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 transition-colors">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md p-8 rounded-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 shadow-2xl"
      >
        {/* Logo */}

        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-emerald-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            C
          </div>
        </div>

        {/* Title */}

        <h2 className="text-2xl font-semibold text-center text-gray-800 dark:text-slate-100">
          Welcome Back
        </h2>

        <p className="text-center text-gray-500 dark:text-slate-400 mb-6">
          Login to continue chatting
        </p>

        {/* Form */}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}

          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Password */}

          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-10 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Forgot Password */}

          <div className="flex justify-end text-sm">
            <Link
              to="/forgot-password"
              className="text-emerald-500 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {/* Login Button */}

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={loading}
            className="w-full p-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </motion.button>
        </form>

        {/* Register */}

        <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
          Don't have an account?
          <Link
            to="/register"
            className="text-emerald-500 ml-1 hover:underline"
          >
            Register
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Login;
