import { useState, useContext } from "react";
import { motion } from "framer-motion";
import { User, Mail, Lock, Eye, EyeOff, Camera } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { registerUser } from "../api/auth";
import { AuthContext } from "../context/AuthContext";
import { useForm } from "react-hook-form";

function Register() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const password = watch("password");

  const handleImage = (e) => {
    const file = e.target.files[0];

    if (file) {
      const preview = URL.createObjectURL(file);
      setAvatar(preview);
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoading(true);

      const res = await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      login(res);

      toast.success("Account created successfully");

      navigate("/chat");
    } catch (err) {
      toast.error(err.response?.data?.message || "Register failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md p-8 rounded-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 shadow-2xl"
      >
        {/* Avatar Upload */}

        <div className="flex justify-center mb-6">
          <label className="relative cursor-pointer">
            <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
              {avatar ? (
                <img
                  src={avatar}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                "U"
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImage}
            />

            <div className="absolute bottom-0 right-0 bg-emerald-500 p-1 rounded-full">
              <Camera size={16} color="white" />
            </div>
          </label>
        </div>

        {/* Title */}

        <h2 className="text-2xl font-semibold text-center text-gray-800 dark:text-slate-100">
          Create Account
        </h2>

        <p className="text-center text-gray-500 dark:text-slate-400 mb-6">
          Start your conversation today
        </p>

        {/* Form */}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Name */}

          <div className="relative">
            <User className="absolute left-3 top-3 text-gray-400" size={20} />

            <input
              type="text"
              placeholder="Full Name"
              {...register("name", { required: "Name is required" })}
              className="w-full pl-10 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />

            {errors.name && (
              <p className="text-red-500 text-sm mt-1">
                {errors.name.message}
              </p>
            )}
          </div>
          

          {/* Email */}

          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />

            <input
              type="email"
              placeholder="Email Address"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^\S+@\S+$/i,
                  message: "Invalid email address",
                },
              })}
              className="w-full pl-10 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />

            {errors.email && (
              <p className="text-red-500 text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}

          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 6,
                  message: "Password must be at least 6 characters",
                },
              })}
              className="w-full pl-10 pr-10 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>

            {errors.password && (
              <p className="text-red-500 text-sm mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm Password */}

          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />

            <input
              type="password"
              placeholder="Confirm Password"
              {...register("confirmPassword", {
                required: "Confirm password is required",
                validate: (value) =>
                  value === password || "Passwords do not match",
              })}
              className="w-full pl-10 p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />

            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Register Button */}

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={loading}
            className="w-full p-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Register"}
          </motion.button>
        </form>

        {/* Login Link */}

        <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
          Already have an account?
          <Link to="/" className="text-emerald-500 ml-1 hover:underline">
            Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Register;