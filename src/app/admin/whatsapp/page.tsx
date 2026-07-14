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
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ArrowLeft,
  Copy,
  ExternalLink,
  Info,
  Shield,
  Bot,
  Hash,
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
// WhatsApp Admin Dashboard
// ============================================

export default function WhatsAppAdminPage() {
  const [accounts, setAccounts] = useState<WAAccount[]>([]);
  const [commands, setCommands] = useState<WACommand[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [testingAccount, setTestingAccount] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
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
        },
      }));
    } catch {
      setTestResults(prev => ({
        ...prev,
        [phoneId]: { success: false, message: "Network error" },
      }));
    } finally {
      setTestingAccount(null);
    }
  };

  // Test self-trigger
  const handleTestSelfTrigger = async (phoneId: string) => {
    setSendingTest(phoneId);
    try {
      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_self_trigger", phoneId }),
      });
      const result = await res.json();
      setLogs(prev => [
        {
          command: "🧪 Test Self-Trigger",
          status: result.success ? "success" : "error",
          time: new Date().toLocaleTimeString("id-ID"),
          response: result.message || result.error || "",
        },
        ...prev,
      ]);
    } catch {
      setLogs(prev => [
        {
          command: "🧪 Test Self-Trigger",
          status: "error",
          time: new Date().toLocaleTimeString("id-ID"),
          response: "Network error",
        },
        ...prev,
      ]);
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
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw size={32} className="text-emerald-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="text-emerald-400" size={28} />
              WhatsApp Command Center
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Self-trigger, monitoring & webhook management
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 rounded-2xl bg-white/5 backdrop-blur-sm">
        {([
          { id: "overview", label: "Overview", icon: Smartphone },
          { id: "commands", label: "Commands", icon: Terminal },
          { id: "webhook", label: "Webhook Setup", icon: Zap },
          { id: "test", label: "Test & Log", icon: Bot },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Account Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {accounts.map((account) => (
                <div
                  key={account.phoneId}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                        <Smartphone className="text-emerald-400" size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{account.label}</h3>
                        <p className="text-sm text-white/50 font-mono">
                          {formatPhone(account.phoneNumber)}
                        </p>
                      </div>
                    </div>
                    {testResults[account.phoneId] && (
                      <span
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${
                          testResults[account.phoneId].success
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {testResults[account.phoneId].success ? (
                          <Wifi size={12} />
                        ) : (
                          <WifiOff size={12} />
                        )}
                        {testResults[account.phoneId].message}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-white/40 text-xs">Phone ID</p>
                      <p className="font-mono text-white/70 mt-1 truncate">{account.phoneId}</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-white/40 text-xs">Status</p>
                      <p className="text-white/70 mt-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Aktif
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTestConnection(account.phoneId)}
                      disabled={testingAccount === account.phoneId}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm disabled:opacity-50"
                    >
                      {testingAccount === account.phoneId ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Wifi size={14} />
                      )}
                      Test Koneksi
                    </button>
                    <button
                      onClick={() => handleTestSelfTrigger(account.phoneId)}
                      disabled={sendingTest === account.phoneId}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors text-sm disabled:opacity-50"
                    >
                      {sendingTest === account.phoneId ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      Test Self-Trigger
                    </button>
                  </div>
                </div>
              ))}

              {accounts.length === 0 && (
                <div className="col-span-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-12 text-center">
                  <WifiOff className="mx-auto mb-4 text-white/20" size={48} />
                  <h3 className="text-lg font-medium text-white/60">Belum Ada Akun</h3>
                  <p className="text-sm text-white/30 mt-2 max-w-md mx-auto">
                    Tambahkan KIRIMDEV_PHONE_ID_1 dan KIRIMDEV_PHONE_NUMBER_1 di file .env.local
                  </p>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                  <Smartphone size={16} />
                  Akun Terhubung
                </div>
                <p className="text-3xl font-bold text-emerald-400">{accounts.length}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                  <Terminal size={16} />
                  Total Commands
                </div>
                <p className="text-3xl font-bold text-cyan-400">{commands.length}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                  <CheckCircle2 size={16} />
                  Commands Aktif
                </div>
                <p className="text-3xl font-bold text-violet-400">
                  {commands.filter((c) => c.enabled).length}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "commands" && (
          <motion.div
            key="commands"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Terminal className="text-cyan-400" size={20} />
                  Self-Trigger Commands
                </h2>
                <span className="text-xs text-white/30 bg-white/5 px-3 py-1 rounded-full">
                  {commands.filter((c) => c.enabled).length}/{commands.length} aktif
                </span>
              </div>

              <p className="text-sm text-white/40 mb-6">
                Kirim command berikut ke chat nomor WA bisnis Anda untuk menjalankannya.
                Bot akan membaca pesan dari diri sendiri dan membalas otomatis.
              </p>

              <div className="space-y-3">
                {commands.map((cmd) => (
                  <div
                    key={cmd.name}
                    className={`rounded-xl border p-4 transition-all ${
                      cmd.enabled
                        ? "bg-white/[0.02] border-white/[0.08] hover:border-emerald-500/30"
                        : "bg-white/[0.01] border-white/[0.04] opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <code className="text-emerald-400 font-bold text-base bg-emerald-500/10 px-2.5 py-0.5 rounded-lg">
                            {cmd.name}
                          </code>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              cmd.enabled
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {cmd.enabled ? "Aktif" : "Nonaktif"}
                          </span>
                        </div>
                        <p className="text-sm text-white/60 mt-2">{cmd.description}</p>
                        <p className="text-xs text-white/30 mt-1.5 font-mono">
                          Contoh: {cmd.usage}
                        </p>
                      </div>
                      <button
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title={cmd.enabled ? "Nonaktifkan" : "Aktifkan"}
                      >
                        {cmd.enabled ? (
                          <ToggleRight className="text-emerald-400" size={24} />
                        ) : (
                          <ToggleLeft className="text-white/30" size={24} />
                        )}
                      </button>
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Webhook URL Card */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Zap className="text-amber-400" size={20} />
                Webhook URL
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/30 rounded-xl px-4 py-3 font-mono text-sm text-emerald-400 border border-white/[0.06]">
                  {webhookUrl || "https://your-domain.com/api/webhook/whatsapp"}
                </div>
                <button
                  onClick={handleCopyWebhook}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm"
                >
                  {copied ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Step-by-step Tutorial */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
                <Info className="text-blue-400" size={20} />
                Tutorial Setup Webhook KirimDev
              </h2>

              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mb-2">Buka Dashboard KirimDev</h3>
                    <p className="text-sm text-white/50 mb-3">
                      Login ke{" "}
                      <a
                        href="https://app.kirim.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:underline inline-flex items-center gap-1"
                      >
                        app.kirim.dev <ExternalLink size={12} />
                      </a>{" "}
                      lalu masuk ke menu <strong>Settings → Webhook</strong>
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mb-2">Klik &quot;Tambah Webhook&quot;</h3>
                    <p className="text-sm text-white/50 mb-3">Isi form webhook dengan data berikut:</p>
                    <div className="rounded-xl bg-black/30 border border-white/[0.06] p-4 space-y-3 text-sm">
                      <div>
                        <span className="text-white/40">URL endpoint:</span>
                        <code className="ml-2 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          {webhookUrl || "https://your-domain.com/api/webhook/whatsapp"}
                        </code>
                      </div>
                      <div>
                        <span className="text-white/40">Deskripsi:</span>
                        <span className="ml-2 text-white/70">Webhook ILJ-Hub Self-Trigger</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      Pilih Event yang Di-subscribe
                      <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">
                        PENTING
                      </span>
                    </h3>
                    <p className="text-sm text-white/50 mb-3">
                      Centang event berikut. <strong className="text-amber-400">message.received</strong> wajib dicentang agar self-trigger berfungsi:
                    </p>
                    <div className="rounded-xl bg-black/30 border border-white/[0.06] p-4 space-y-2 text-sm">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <code className="text-emerald-400">message.received</code>
                        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full ml-auto">
                          WAJIB
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <code className="text-white/60">message.sent</code>
                        <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full ml-auto">
                          Disarankan
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-white/20" />
                        <code className="text-white/40">message.status</code>
                        <span className="text-xs text-white/20 ml-auto">Opsional</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-white/20" />
                        <code className="text-white/40">message.revoked</code>
                        <span className="text-xs text-white/20 ml-auto">Opsional</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-white/20" />
                        <code className="text-white/40">message.edited</code>
                        <span className="text-xs text-white/20 ml-auto">Opsional</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    4
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mb-2">Pilih Akun WhatsApp</h3>
                    <p className="text-sm text-white/50 mb-3">
                      Anda bisa <strong>mengosongkan</strong> pilihan akun agar webhook menerima event dari <strong>semua nomor</strong> yang terhubung 
                      (Lostamasta + InfoLokerJombang), atau pilih salah satu saja.
                    </p>
                    <div className="rounded-xl bg-black/30 border border-white/[0.06] p-4 space-y-2 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-400" />
                        <span className="text-white/70">+62 831-2286-6975</span>
                        <span className="text-white/40">— Lostamasta</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full border border-white/20" />
                        <span className="text-white/70">+62 897-4266-000</span>
                        <span className="text-white/40">— InfoLokerJombang</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    5
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mb-2">Klik &quot;Simpan&quot; & Test</h3>
                    <p className="text-sm text-white/50 mb-3">
                      Setelah menyimpan, kembali ke halaman ini dan gunakan tombol{" "}
                      <strong className="text-emerald-400">&quot;Test Self-Trigger&quot;</strong> di tab Overview 
                      untuk memverifikasi webhook sudah terhubung.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ENV Setup Guide */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Shield className="text-violet-400" size={20} />
                Environment Variables (.env.local)
              </h2>
              <p className="text-sm text-white/40 mb-4">
                Pastikan variabel berikut sudah diset di file <code className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">.env.local</code>:
              </p>
              <div className="rounded-xl bg-black/50 border border-white/[0.06] p-4 font-mono text-sm space-y-1 overflow-x-auto">
                <p className="text-white/30"># API Key (sama untuk semua akun)</p>
                <p><span className="text-cyan-400">KIRIMDEV_API_KEY</span><span className="text-white/30">=</span><span className="text-amber-400">sk-xxxxxxxxxxxxxxxxx</span></p>
                <p className="mt-3 text-white/30"># Akun 1: Lostamasta</p>
                <p><span className="text-cyan-400">KIRIMDEV_PHONE_ID_1</span><span className="text-white/30">=</span><span className="text-amber-400">phone_id_dari_kirimdev</span></p>
                <p><span className="text-cyan-400">KIRIMDEV_PHONE_NUMBER_1</span><span className="text-white/30">=</span><span className="text-amber-400">6283122866975</span></p>
                <p className="mt-3 text-white/30"># Akun 2: InfoLokerJombang</p>
                <p><span className="text-cyan-400">KIRIMDEV_PHONE_ID_2</span><span className="text-white/30">=</span><span className="text-amber-400">phone_id_dari_kirimdev</span></p>
                <p><span className="text-cyan-400">KIRIMDEV_PHONE_NUMBER_2</span><span className="text-white/30">=</span><span className="text-amber-400">628974266000</span></p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "test" && (
          <motion.div
            key="test"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Quick Test */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Bot className="text-emerald-400" size={20} />
                Quick Self-Trigger Test
              </h2>
              <p className="text-sm text-white/40 mb-4">
                Pilih akun dan kirim pesan test untuk memverifikasi self-trigger berjalan:
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {accounts.map((account) => (
                  <button
                    key={account.phoneId}
                    onClick={() => handleTestSelfTrigger(account.phoneId)}
                    disabled={sendingTest === account.phoneId}
                    className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all disabled:opacity-50 text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      {sendingTest === account.phoneId ? (
                        <RefreshCw size={18} className="text-emerald-400 animate-spin" />
                      ) : (
                        <Send size={18} className="text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{account.label}</p>
                      <p className="text-xs text-white/40">{formatPhone(account.phoneNumber)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Command Cheatsheet */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Hash className="text-cyan-400" size={20} />
                Command Cheatsheet
              </h2>
              <p className="text-sm text-white/40 mb-4">
                Buka WhatsApp di HP, kirim pesan ke nomor bisnis Anda sendiri:
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {commands.map((cmd) => (
                  <div
                    key={cmd.name}
                    className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/[0.04]"
                  >
                    <code className="text-emerald-400 font-bold text-sm bg-emerald-500/10 px-2 py-0.5 rounded">
                      {cmd.name}
                    </code>
                    <span className="text-xs text-white/40 flex-1">{cmd.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Log */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Clock className="text-amber-400" size={20} />
                Log Aktivitas
              </h2>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-white/20">
                  <Clock size={32} className="mx-auto mb-3" />
                  <p className="text-sm">Belum ada aktivitas. Coba test self-trigger di atas.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/[0.04] text-sm"
                    >
                      {log.status === "success" ? (
                        <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                      ) : log.status === "error" ? (
                        <XCircle size={16} className="text-red-400 flex-shrink-0" />
                      ) : (
                        <Clock size={16} className="text-amber-400 flex-shrink-0 animate-pulse" />
                      )}
                      <span className="text-white/40 font-mono text-xs flex-shrink-0">{log.time}</span>
                      <span className="font-medium flex-shrink-0">{log.command}</span>
                      <span className="text-white/30 truncate flex-1">{log.response}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
