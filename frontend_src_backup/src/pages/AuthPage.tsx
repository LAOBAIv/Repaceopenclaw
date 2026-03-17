import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuthStore } from "../stores/authStore";

type Mode = "login" | "register";

export function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (!form.username.trim()) return setError("请输入用户名");
      if (form.password !== form.confirmPassword) return setError("两次密码不一致");
      if (form.password.length < 6) return setError("密码长度不能少于6位");
    }

    setLoading(true);
    try {
      let result;
      if (mode === "login") {
        result = await authApi.login({ email: form.email, password: form.password });
      } else {
        result = await authApi.register({
          username: form.username,
          email: form.email,
          password: form.password,
        });
      }
      login(result.user, result.token);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">RepaceClaw</h1>
          <p className="text-gray-400 text-sm mt-1">AI 智能体协作平台</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {/* Tab */}
          <div className="flex bg-gray-800 rounded-lg p-1 mb-6">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "login"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => { setMode("login"); setError(""); }}
            >
              登录
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "register"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => { setMode("register"); setError(""); }}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">用户名</label>
                <input
                  name="username"
                  type="text"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="请输入用户名"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">邮箱</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="请输入邮箱"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">密码</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder={mode === "register" ? "至少6位" : "请输入密码"}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                required
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">确认密码</label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="再次输入密码"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors mt-2"
            >
              {loading ? "请稍候..." : mode === "login" ? "登录" : "注册"}
            </button>
          </form>

          {mode === "login" && (
            <p className="text-center text-sm text-gray-500 mt-4">
              还没有账号？
              <button
                className="text-indigo-400 hover:text-indigo-300 ml-1"
                onClick={() => { setMode("register"); setError(""); }}
              >
                立即注册
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
