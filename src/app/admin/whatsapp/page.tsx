"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Smartphone,
  Wifi,
  WifiOff,
  Send,
  RefreshCw,
  Terminal,
  CheckCircle2,
  Zap,
  ArrowLeft,
  Copy,
  ExternalLink,
  Info,
  Shield,
  Bot,
  Hash,
  ChevronRight,
  Server,
  Activity,
  Check,
  Crown,
  XCircle,
  Clock,
  FileText,
  ListTodo
} from "lucide-react";
import Link from "next/link";

// ============================================
// Types
// ============================================

interface WAAccount {
  phoneId: string;
  label: string;
  phoneNumber: string;
  connected?: boolean;
}

interface WACommand {
  name: string;
  description: string;
  usage: string;
  enabled: boolean;
}

interface LogEntry {
  command: string;
  status: "success" | "error" | "pending";
  time: string;
  response: string;
}

// ============================================
// WhatsApp Admin Dashboard (Premium UI)
// ============================================

export default function WhatsAppAdminPage() {
  const [accounts, setAccounts] = useState<WAAccount[]>([]);
  const [commands, setCommands] = useState<WACommand[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [testingAccount, setTestingAccount] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; details?: any }>>({});
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "commands" | "webhook" | "test">("overview");
  const [copied, setCopied] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/whatsapp");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        setCommands(data.commands || []);
        setWebhookUrl(data.webhookUrl || "");
      }
    } catch (error) {
      console.error("Failed to fetch WA data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Test connection
  const handleTestConnection = async (phoneId: string) => {
    setTestingAccount(phoneId);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_connection", phoneId }),
      });
      const result = await res.json();
      setTestResults(prev => ({
        ...prev,
        [phoneId]: {
          success: result.connected,
          message: result.connected ? "Terhubung!" : result.error || "Gagal",
          details: result.details,
        },
      }));
      // Auto expand log if error
      if (!result.connected) {
        setExpandedLog(phoneId);
      }
    } catch {
      setTestResults(prev => ({
        ...prev,
        [phoneId]: { success: false, message: "Network error" },
      }));
    } finally {
      setTestingAccount(null);
    }
  };

  // Test Admin Command
  const handleTestSelfTrigger = async (phoneId: string, customCommand?: string) => {
    setSendingTest(phoneId);
    const commandName = customCommand ? `Simulasi: ${customCommand}` : "🧪 Test Admin Command";
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "test_self_trigger", 
          phoneId,
          message: customCommand
        }),
      });
      const result = await res.json();
      setLogs(prev => [
        {
          command: commandName,
          status: result.success ? "success" : "error",
          time: new Date().toLocaleTimeString("id-ID"),
          response: result.message || result.error || "",
        },
        ...prev,
      ]);
      // Beralih ke tab test untuk melihat hasil
      setActiveTab("test");
    } catch {
      setLogs(prev => [
        {
          command: commandName,
          status: "error",
          time: new Date().toLocaleTimeString("id-ID"),
          response: "Network error",
        },
        ...prev,
      ]);
      setActiveTab("test");
    } finally {
      setSendingTest(null);
    }
  };

  // Copy webhook URL
  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format phone number for display
  const formatPhone = (phone: string) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("62")) {
      const local = cleaned.slice(2);
      return `+62 ${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1120]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-emerald-400 border-opacity-80" />
        </motion.div>
      </div>
    );
  }

  // Get Bot Phone ID for Quick Actions
  const botPhoneId = accounts.length > 1 ? accounts[1].phoneId : (accounts[0]?.phoneId || "");

  return (
    <div className="space-y-8 pb-20 relative w-full overflow-x-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 backdrop-blur-md transition-all hover:scale-105"
          >
            <ArrowLeft size={20} className="text-white/70" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <div className="relative">
                <MessageSquare className="text-emerald-400" size={28} />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
                Command Center
              </span>
            </h1>
            <p className="text-xs md:text-sm text-white/50 mt-1 font-medium">
              Dual-Account Architecture & Webhook Management
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 backdrop-blur-md transition-all shadow-lg hover:shadow-white/5 text-sm font-medium w-full md:w-auto"
        >
          <RefreshCw size={16} className="text-emerald-400" />
          Refresh Data
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative z-10">
        {([
          { id: "overview", label: "Overview", icon: Smartphone },
          { id: "commands", label: "Commands", icon: Terminal },
          { id: "webhook", label: "Webhook", icon: Zap },
          { id: "test", label: "Activity Logs", icon: Activity },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 md:px-4 rounded-xl text-xs md:text-sm font-semibold transition-all duration-300 relative ${
              activeTab === tab.id
                ? "text-emerald-300 bg-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                : "text-white/40 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            <tab.icon size={16} className={activeTab === tab.id ? "text-emerald-400" : ""} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="relative z-10 w-full">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Quick Actions Panel */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 backdrop-blur-xl p-5">
                <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                  <Zap className="text-amber-400" size={20} /> Quick Actions (Simulator)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button 
                    onClick={() => handleTestSelfTrigger(botPhoneId, "!buat_invoice")}
                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 transition-all gap-2"
                  >
                    <FileText size={24} className="text-emerald-400" />
                    <span className="text-xs font-bold text-center">Buat Invoice</span>
                  </button>
                  <button 
                    onClick={() => handleTestSelfTrigger(botPhoneId, "!rekap")}
                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 transition-all gap-2"
                  >
                    <ListTodo size={24} className="text-cyan-400" />
                    <span className="text-xs font-bold text-center">Rekap Harian</span>
                  </button>
                  <button 
                    onClick={() => handleTestSelfTrigger(botPhoneId, "!tagihan")}
                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/30 transition-all gap-2"
                  >
                    <Clock size={24} className="text-orange-400" />
                    <span className="text-xs font-bold text-center">Cek Pending</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab("test")}
                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 hover:bg-violet-500/10 border border-white/10 hover:border-violet-500/30 transition-all gap-2"
                  >
                    <Activity size={24} className="text-violet-400" />
                    <span className="text-xs font-bold text-center">Sent / Receive Logs</span>
                  </button>
                </div>
              </div>

              {/* Account Cards */}
              <div className="grid gap-6 md:grid-cols-2">
                {accounts.map((account, index) => {
                  const isAdmin = index === 0;
                  const isBot = index === 1;
                  
                  return (
                    <motion.div
                      whileHover={{ y: -2 }}
                      key={account.phoneId}
                      className={`rounded-2xl border backdrop-blur-xl p-5 transition-all shadow-xl ${
                        isAdmin 
                          ? "bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20 shadow-amber-500/5" 
                          : isBot
                            ? "bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20 shadow-blue-500/5"
                            : "bg-white/5 border-white/10"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner shrink-0 ${
                            isAdmin ? "bg-amber-500/20 text-amber-400" : isBot ? "bg-blue-500/20 text-blue-400" : "bg-white/10 text-white"
                          }`}>
                            {isAdmin ? <Crown size={24} /> : isBot ? <Bot size={24} /> : <Smartphone size={24} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <h3 className="font-bold text-lg">{account.label}</h3>
                              {isAdmin && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">MASTER</span>}
                              {isBot && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">BOT</span>}
                            </div>
                            <p className="text-xs text-white/50 font-mono font-medium">
                              {formatPhone(account.phoneNumber)}
                            </p>
                          </div>
                        </div>
                        {testResults[account.phoneId] && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={`flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg w-full sm:w-auto ${
                              testResults[account.phoneId].success
                                ? "bg-emerald-500 text-white shadow-emerald-500/30"
                                : "bg-red-500 text-white shadow-red-500/30"
                            }`}
                          >
                            {testResults[account.phoneId].success ? (
                              <Wifi size={12} />
                            ) : (
                              <WifiOff size={12} />
                            )}
                            {testResults[account.phoneId].message}
                          </motion.span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-4">
                        <div className="rounded-xl bg-black/40 border border-white/5 p-3 overflow-hidden">
                          <p className="text-white/40 text-[10px] font-medium mb-1">Phone ID</p>
                          <p className="font-mono text-white/80 truncate text-xs">{account.phoneId}</p>
                        </div>
                        <div className="rounded-xl bg-black/40 border border-white/5 p-3 overflow-hidden">
                          <p className="text-white/40 text-[10px] font-medium mb-1">Tugas Akun</p>
                          <p className="text-white/80 text-xs truncate">
                            {isAdmin ? "Kirim Perintah" : isBot ? "Bot Pengeksekusi" : "Akun Tambahan"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => handleTestConnection(account.phoneId)}
                          disabled={testingAccount === account.phoneId}
                          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs font-semibold disabled:opacity-50"
                        >
                          {testingAccount === account.phoneId ? (
                            <RefreshCw size={14} className="animate-spin text-emerald-400" />
                          ) : (
                            <Wifi size={14} className="text-white/60" />
                          )}
                          Ping API
                        </button>
                        {!isAdmin && (
                          <button
                            onClick={() => handleTestSelfTrigger(account.phoneId)}
                            disabled={sendingTest === account.phoneId}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors text-xs font-semibold disabled:opacity-50 ${
                              isBot
                                  ? "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30"
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {sendingTest === account.phoneId ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Send size={14} />
                            )}
                            Test Kirim
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {testResults[account.phoneId]?.details && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mt-4"
                          >
                            <div className="p-4 rounded-xl bg-black/60 border border-red-500/20 w-full relative">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/0 via-red-500/50 to-red-500/0" />
                              <p className="text-red-400 text-xs font-bold mb-2 flex items-center gap-2">
                                <Terminal size={12} /> Diagnostic Log
                              </p>
                              <pre className="text-[10px] text-white/70 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                                {JSON.stringify(testResults[account.phoneId].details, null, 2)}
                              </pre>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                {accounts.length === 0 && (
                  <div className="col-span-1 md:col-span-2 rounded-3xl bg-white/5 border border-white/10 p-8 md:p-16 text-center backdrop-blur-md">
                    <WifiOff className="mx-auto mb-6 text-white/20" size={64} />
                    <h3 className="text-2xl font-bold text-white/80 mb-2">Belum Ada Akun</h3>
                    <p className="text-white/40 max-w-md mx-auto text-sm">
                      Harap konfigurasi KIRIMDEV_PHONE_ID_1 dan KIRIMDEV_PHONE_NUMBER_1 di file <code className="text-emerald-400 px-2 py-1 bg-emerald-400/10 rounded-md">.env.local</code>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "commands" && (
            <motion.div
              key="commands"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Terminal className="text-cyan-400" size={24} />
                      Interactive Command Center
                    </h2>
                    <p className="text-white/50 text-xs mt-1 font-medium">
                      Gunakan <strong className="text-amber-400">Akun 1 (Master)</strong> untuk mengirim pesan ke <strong className="text-blue-400">Akun 2 (Bot)</strong>.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 self-start md:self-auto">
                    <Activity className="text-emerald-400" size={14} />
                    <span className="font-bold text-sm">{commands.filter((c) => c.enabled).length}</span>
                    <span className="text-white/40 text-xs">/ {commands.length} Aktif</span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {commands.map((cmd) => (
                    <div
                      key={cmd.name}
                      className={`relative overflow-hidden rounded-xl border backdrop-blur-md p-4 transition-all duration-300 group flex flex-col ${
                        cmd.enabled
                          ? "bg-white/[0.03] border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/5"
                          : "bg-white/[0.01] border-white/5 opacity-60 grayscale"
                      }`}
                    >
                      <div className="relative z-10 flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-base text-white flex items-center gap-2">
                            {cmd.name}
                          </h3>
                        </div>
                        {cmd.enabled ? (
                          <div className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded-full border border-emerald-500/30 shrink-0">
                            ON
                          </div>
                        ) : (
                          <div className="px-2 py-0.5 bg-white/10 text-white/40 text-[9px] font-bold rounded-full border border-white/10 shrink-0">
                            OFF
                          </div>
                        )}
                      </div>
                      
                      {/* Fully readable description (no height limits) */}
                      <p className="text-xs text-white/70 mb-4 flex-grow leading-relaxed">
                        {cmd.description}
                      </p>
                      
                      <div className="relative z-10 pt-3 border-t border-white/10 mt-auto">
                        <code className="text-[10px] bg-black/60 text-cyan-300 px-2 py-1.5 rounded border border-cyan-500/20 block font-mono whitespace-pre-wrap break-all">
                          {cmd.usage}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "webhook" && (
            <motion.div
              key="webhook"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-5 md:p-8">
                <div className="mb-6 md:mb-8 border-b border-white/10 pb-4 md:pb-6">
                  <h2 className="text-xl md:text-2xl font-bold flex items-center gap-3">
                    <Zap className="text-amber-400" size={24} />
                    Webhook Flow
                  </h2>
                  <p className="text-white/50 mt-2 font-medium max-w-2xl text-xs md:text-sm">
                    Webhook adalah jembatan komunikasi. Tanpa webhook, bot hanya bisa mengirim pesan. Dengan webhook, bot bisa "mendengarkan" perintah Anda secara real-time.
                  </p>
                </div>

                <div className="bg-black/60 rounded-2xl border border-white/10 p-4 md:p-6 mb-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 w-full overflow-hidden">
                      <p className="text-xs md:text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Endpoint URL</p>
                      <code className="text-xs md:text-sm text-emerald-300 font-mono block break-all whitespace-pre-wrap">
                        {webhookUrl || "Loading..."}
                      </code>
                    </div>
                    <button
                      onClick={handleCopyWebhook}
                      className="shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all font-semibold w-full sm:w-auto text-sm"
                    >
                      {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                      {copied ? "Copied!" : "Copy URL"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "test" && (
            <motion.div
              key="test"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl p-5 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 border-b border-white/10 pb-4 md:pb-6">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-3">
                      <Activity className="text-violet-400" size={24} />
                      Activity / Send & Receive Logs
                    </h2>
                    <p className="text-white/50 mt-2 font-medium text-xs md:text-sm">History eksekusi command via dashboard simulator.</p>
                  </div>
                  {logs.length > 0 && (
                    <button 
                      onClick={() => setLogs([])}
                      className="text-xs font-bold px-4 py-2 bg-white/5 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-colors shrink-0"
                    >
                      Clear Logs
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {logs.length === 0 ? (
                    <div className="text-center py-12 bg-white/5 border border-white/5 rounded-2xl px-4">
                      <Activity className="mx-auto text-white/20 mb-4" size={48} />
                      <p className="text-white/40 text-sm">Belum ada log aktivitas.<br/>Coba jalankan Quick Action "Buat Invoice" di tab Overview.</p>
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div
                        key={i}
                        className={`p-4 md:p-5 rounded-2xl border transition-all ${
                          log.status === "success"
                            ? "bg-emerald-500/5 border-emerald-500/10"
                            : "bg-red-500/5 border-red-500/10"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <span className="font-bold flex items-center gap-2 text-sm md:text-base">
                            {log.status === "success" ? (
                              <CheckCircle2 className="text-emerald-400" size={18} shrink-0 />
                            ) : (
                              <XCircle className="text-red-400" size={18} shrink-0 />
                            )}
                            {log.command}
                          </span>
                          <span className="text-[10px] md:text-xs text-white/40 flex items-center gap-1 bg-black/40 px-2 py-1 rounded-md shrink-0 self-start sm:self-auto">
                            <Clock size={12} />
                            {log.time}
                          </span>
                        </div>
                        <div className="bg-black/60 rounded-xl p-3 border border-white/5 w-full">
                           <p className={`text-xs md:text-sm font-mono whitespace-pre-wrap break-words ${
                            log.status === "success" ? "text-emerald-300" : "text-red-300"
                          }`}>
                            {log.response}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
