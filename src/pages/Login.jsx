import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Droplets, Lock, User, Eye, EyeOff, Stethoscope, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const Login = () => {
  const { login, user, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    const result = await login(username, password);
    if (!result.success) {
      setError(result.message);
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/15 rounded-full filter blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-cyan-500/15 rounded-full filter blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 sm:p-10 border border-white/20"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-cyan-500 text-white mb-4 shadow-lg shadow-blue-500/30">
            <Stethoscope size={32} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Staff Portal</h1>
          <p className="text-slate-500 text-sm mt-1">CHO • Sanitization • Barangay Officials</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-sm flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-600 mt-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Staff Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User size={18} />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter staff username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-blue-700 to-cyan-600 hover:from-blue-800 hover:to-cyan-700 text-white font-semibold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In as Staff</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Role-Adaptive Security</span>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
