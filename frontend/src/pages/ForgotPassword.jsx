import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";

function ForgotPassword() {

  const [email,setEmail] = useState("");
  const [loading,setLoading] = useState(false);

  const submit = async (e)=>{

    e.preventDefault();

    if(!email){
      return toast.error("Please enter your email");
    }

    try{

      setLoading(true);

      await axios.post(
        "http://localhost:5000/api/auth/forgot-password",
        { email }
      );

      toast.success("Reset link sent to your email");

      setEmail("");

    }catch(err){

      toast.error(
        err.response?.data?.message || "Error sending email"
      );

    }finally{

      setLoading(false);

    }

  };

  return (

    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-slate-900">

      <motion.div
        initial={{opacity:0,y:40}}
        animate={{opacity:1,y:0}}
        transition={{duration:0.5}}
        className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-slate-700"
      >

        <h2 className="text-2xl font-semibold text-center text-gray-800 dark:text-white mb-2">
          Forgot Password
        </h2>

        <p className="text-center text-gray-500 dark:text-slate-400 mb-6">
          Enter your email to receive a password reset link
        </p>

        <form onSubmit={submit} className="space-y-4">

          <div className="relative">

            <Mail className="absolute left-3 top-3 text-gray-400" size={20}/>

            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              className="w-full pl-10 p-3 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            />

          </div>

          <button
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-lg transition disabled:opacity-60"
          >

            {loading ? "Sending..." : "Send Reset Link"}

          </button>

        </form>

      </motion.div>

    </div>

  );

}

export default ForgotPassword;