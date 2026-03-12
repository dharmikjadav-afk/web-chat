import { motion } from "framer-motion";

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 transition-colors duration-500">
      <div className="flex flex-col items-center gap-8">
        {/* Animated Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative flex items-center justify-center"
        >
          {/* glowing ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
            className="absolute w-24 h-24 rounded-full border-4 border-emerald-400/40"
          />

          {/* inner logo */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-xl">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
        </motion.div>

        {/* App Name */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-2xl font-semibold tracking-wide text-gray-800 dark:text-slate-100"
        >
          ChatApp
        </motion.h1>

        {/* Animated Progress Bar */}
        <div className="w-64 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-emerald-500"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Subtitle */}
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Connecting your conversations...
        </p>
      </div>
    </div>
  );
}

export default LoadingScreen;
