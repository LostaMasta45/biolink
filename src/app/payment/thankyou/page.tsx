"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    CheckCircle2,
    MessageCircle,
    Instagram,
    ArrowLeft,
    Copy,
    Heart,
    Sparkles,
    FileText,
    Download,
    Loader2,
    Home,
    Clock,
    ShieldCheck,
    Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatRupiah } from "@/lib/utils";
import type { InvoiceData, InvoiceItemData } from "@/lib/invoice-types";

function ThankYouContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get("order") || "";
    const packageName = searchParams.get("package") || "";
    const amount = parseInt(searchParams.get("amount") || "0");
    const customerName = searchParams.get("name") || "";
    const customerCompany = searchParams.get("company") || "";

    const [copied, setCopied] = useState(false);
    const [showConfetti, setShowConfetti] = useState(true);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowConfetti(false), 4000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Fetch order details to generate invoice
        const fetchOrderDetails = async () => {
            if (!orderId) return;
            const supabase = createClient();
            const { data, error } = await supabase
                .from("payment_orders")
                .select("*")
                .eq("order_id", orderId)
                .single();

            if (!error && data) {
                // Construct InvoiceData
                const items: InvoiceItemData[] = [
                    {
                        id: "1",
                        description: data.package_name,
                        quantity: 1,
                        price: data.amount,
                    }
                ];

                // Add addons
                if (data.addon_names && Array.isArray(data.addon_names)) {
                    // We don't have individual addon prices saved, so we distribute the remaining total amount.
                    // Or we just add them as 0 price items if total_amount is not available.
                    // In reality, total_amount = amount + addons.
                    let addonsTotal = (data.total_amount || data.amount) - data.amount;
                    if (addonsTotal > 0 && data.addon_names.length > 0) {
                        const pricePerAddon = Math.round(addonsTotal / data.addon_names.length);
                        data.addon_names.forEach((name: string, idx: number) => {
                            items.push({
                                id: `addon-${idx}`,
                                description: `Add-on: ${name}`,
                                quantity: 1,
                                price: pricePerAddon
                            });
                        });
                    } else if (data.addon_names.length > 0) {
                        data.addon_names.forEach((name: string, idx: number) => {
                            items.push({
                                id: `addon-${idx}`,
                                description: `Add-on: ${name}`,
                                quantity: 1,
                                price: 0
                            });
                        });
                    }
                }

                setInvoiceData({
                    invoice_number: `INV-${data.order_id.replace("ORD-", "")}`,
                    client_name: data.customer_name,
                    client_phone: data.customer_whatsapp,
                    client_address: data.customer_company, // Using company as address field
                    invoice_date: new Date(data.created_at).toISOString().split("T")[0],
                    items,
                    subtotal: data.total_amount || data.amount,
                    discount_type: "nominal",
                    discount_value: 0,
                    discount_amount: 0,
                    tax_enabled: false,
                    tax_percent: 0,
                    tax_amount: 0,
                    total: data.total_amount || data.amount,
                    status: data.status === "PAID" ? "paid" : "draft",
                    template: "modern",
                    color_theme: "default",
                    notes: "Pembayaran via QRIS.\nKonfirmasi ke WhatsApp Admin setelah pembayaran berhasil.",
                    sender_name: "InfoLokerJombang",
                    sender_contact: "@infolokerjombang",
                    sender_address: "Jombang, Jawa Timur",
                });
            }
        };

        fetchOrderDetails();
    }, [orderId]);

    const handleDownload = async (format: "pdf" | "png") => {
        if (!invoiceData) return;
        setIsDownloading(true);
        const loadingToast = toast.loading("Generating Invoice...");

        try {
            const generateInvoiceHTML = () => {
                const colors = {
                    primary: '#059669',
                    light: '#ecfdf5',
                    lightBorder: '#10b98120',
                    slate50: '#f8fafc',
                    slate100: '#f1f5f9',
                    slate200: '#e2e8f0',
                    slate400: '#94a3b8',
                    slate500: '#64748b',
                    slate900: '#0f172a',
                    white: '#ffffff',
                };
                const showWatermark = invoiceData.status !== "draft";
                return `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body { font-family: system-ui, -apple-system, sans-serif; background: ${colors.white}; color: ${colors.slate900}; width: 794px; min-height: 1123px; }
                            .container { padding: 48px; position: relative; }
                            .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
                            .watermark span { font-size: 128px; font-weight: 700; transform: rotate(-12deg); opacity: 0.05; color: ${colors.primary}; }
                            .content { position: relative; z-index: 10; }
                            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; border-bottom: 1px solid ${colors.light}; padding-bottom: 32px; }
                            .logo { width: 96px; height: 96px; border-radius: 16px; overflow: hidden; }
                            .logo img { width: 100%; height: 100%; object-fit: cover; }
                            .title { font-size: 32px; font-weight: 800; color: ${colors.primary}; text-transform: uppercase; letter-spacing: -0.025em; }
                            .meta { color: ${colors.slate500}; font-size: 14px; font-weight: 500; margin-top: 8px; text-align: right; }
                            .meta p { margin: 4px 0; }
                            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-bottom: 40px; }
                            .from-label, .to-label { font-size: 12px; font-weight: 700; opacity: 0.4; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
                            .from-name, .to-name { font-weight: 700; font-size: 18px; margin-bottom: 4px; color: ${colors.slate900}; }
                            .info-sub { opacity: 0.7; font-size: 14px; color: ${colors.slate500}; }
                            .bill-to { background: ${colors.light}; padding: 24px; border-radius: 12px; border: 1px solid ${colors.lightBorder}; }
                            table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
                            th { background: ${colors.primary}; color: ${colors.white}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; padding: 16px; text-align: left; }
                            th.center { text-align: center; }
                            th.right { text-align: right; }
                            td { padding: 16px; border-bottom: 1px solid ${colors.slate100}; font-size: 14px; }
                            td.center { text-align: center; opacity: 0.8; }
                            td.right { text-align: right; }
                            td.bold { font-weight: 600; color: ${colors.slate900}; }
                            .footer-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 48px; margin-top: 32px; }
                            .bank-box { padding: 20px; border-radius: 12px; border: 1px dashed ${colors.slate400}; background: ${colors.slate50}; margin-bottom: 24px; }
                            .bank-label { font-size: 12px; font-weight: 700; color: ${colors.slate500}; margin-bottom: 12px; text-transform: uppercase; }
                            .bank-name { font-weight: 700; font-size: 18px; color: ${colors.primary}; }
                            .bank-number { font-family: monospace; font-size: 20px; letter-spacing: 0.05em; margin: 4px 0; font-weight: 600; }
                            .bank-holder { font-size: 14px; color: ${colors.slate500}; }
                            .notes { color: ${colors.slate500}; font-size: 14px; }
                            .notes-label { font-weight: 700; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: ${colors.slate400}; }
                            .notes-text { white-space: pre-line; line-height: 1.6; }
                            .totals { background: ${colors.slate50}; padding: 24px; border-radius: 12px; }
                            .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; margin-bottom: 12px; color: ${colors.slate500}; }
                            .total-row span:last-child { font-weight: 600; color: ${colors.slate900}; }
                            .grand-total { padding-top: 16px; margin-top: 8px; border-top: 1px solid ${colors.slate200}; display: flex; justify-content: space-between; align-items: flex-end; }
                            .grand-label { color: ${colors.slate500}; font-weight: 600; text-transform: uppercase; font-size: 14px; }
                            .grand-value { font-size: 28px; font-weight: 800; color: ${colors.primary}; line-height: 1; }
                            .footer-msg { color: ${colors.slate400}; font-size: 12px; margin-top: 48px; padding-top: 32px; border-top: 1px solid ${colors.slate100}; text-align: center; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            ${showWatermark ? `<div class="watermark"><span>LUNAS</span></div>` : ''}
                            <div class="content">
                                <div class="header">
                                    <div class="logo">
                                        <img src="${window.location.origin}/profile.png" alt="InfoLokerJombang Logo" />
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="title">INVOICE</div>
                                        <div class="meta">
                                            <p><span style="opacity: 0.6;">No.</span> ${invoiceData.invoice_number}</p>
                                            <p><span style="opacity: 0.6;">Tanggal:</span> ${formatDate(invoiceData.invoice_date)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="info-grid">
                                    <div>
                                        <div class="from-label">Dari</div>
                                        <div class="from-name">${invoiceData.sender_name}</div>
                                        <div class="info-sub">${invoiceData.sender_contact}</div>
                                        <div class="info-sub">${invoiceData.sender_address}</div>
                                    </div>
                                    <div class="bill-to">
                                        <div class="to-label">Kepada</div>
                                        <div class="to-name">${invoiceData.client_name}</div>
                                        ${invoiceData.client_phone ? `<div class="info-sub">${invoiceData.client_phone}</div>` : ''}
                                        ${invoiceData.client_address ? `<div class="info-sub" style="margin-top: 4px;">${invoiceData.client_address}</div>` : ''}
                                    </div>
                                </div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Deskripsi</th>
                                            <th class="center" style="width: 96px;">Qty</th>
                                            <th class="right" style="width: 160px;">Harga</th>
                                            <th class="right" style="width: 160px;">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${invoiceData.items.map(item => `
                                            <tr>
                                                <td class="bold">${item.description}</td>
                                                <td class="center">${item.quantity}</td>
                                                <td class="right">${formatRupiah(item.price)}</td>
                                                <td class="right bold">${formatRupiah(item.quantity * item.price)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                                <div class="footer-grid">
                                    <div>
                                        <div class="bank-box">
                                            <div class="bank-label">Pembayaran</div>
                                            <div class="bank-name">QRIS</div>
                                            <div class="bank-number">LUNAS</div>
                                            <div class="bank-holder">Otomatis Terverifikasi</div>
                                        </div>
                                        <div class="notes">
                                            <div class="notes-label">Catatan</div>
                                            <div class="notes-text">${invoiceData.notes}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="totals">
                                            <div class="total-row">
                                                <span>Subtotal</span>
                                                <span>${formatRupiah(invoiceData.subtotal)}</span>
                                            </div>
                                            <div class="grand-total">
                                                <span class="grand-label">Total Tagihan</span>
                                                <span class="grand-value">${formatRupiah(invoiceData.total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="footer-msg">
                                    Terima kasih atas kepercayaan Anda bekerja sama dengan ${invoiceData.sender_name}.
                                </div>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
            };

            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.left = '-9999px';
            iframe.style.top = '0';
            iframe.style.width = '794px';
            iframe.style.height = '1123px';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) {
                document.body.removeChild(iframe);
                throw new Error('Cannot create iframe document');
            }

            iframeDoc.open();
            iframeDoc.write(generateInvoiceHTML());
            iframeDoc.close();

            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(iframeDoc.body, {
                scale: 2,
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false,
                width: 794,
            });

            document.body.removeChild(iframe);

            const safeSenderName = invoiceData.sender_name?.replace(/[^a-zA-Z0-9\\s-]/g, "").replace(/\\s+/g, "_").substring(0, 30) || "Invoice";
            const fileName = `${invoiceData.invoice_number}_${safeSenderName}`;

            if (format === "pdf") {
                const imgData = canvas.toDataURL("image/png");
                const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                const imgWidth = 210;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
                pdf.save(`${fileName}.pdf`);
            } else {
                const link = document.createElement("a");
                link.download = `${fileName}.png`;
                link.href = canvas.toDataURL("image/png", 0.95);
                link.click();
            }

            toast.dismiss(loadingToast);
            toast.success("Download berhasil!");
        } catch (err) {
            console.error("Download error:", err);
            toast.dismiss(loadingToast);
            toast.error("Gagal generate file. Coba lagi.");
        } finally {
            setIsDownloading(false);
        }
    };

    const copyOrderId = () => {
        navigator.clipboard.writeText(orderId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // WhatsApp message template
    const waMessage = encodeURIComponent(
        `Halo min, saya sudah bayar pasang loker via QRIS.\n\nOrder ID: ${orderId}\nNama: ${customerName}\nPerusahaan: ${customerCompany}\nPaket: ${packageName}\nTotal: Rp ${amount.toLocaleString("id-ID")}\n\nMohon segera diproses ya, terima kasih! 🙏`
    );
    const waLink = `https://api.whatsapp.com/send/?phone=6283122866975&text=${waMessage}&type=phone_number&app_absent=0`;

    return (
        <>
            {/* Desktop View */}
            <div className="hidden md:block min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/5 relative overflow-hidden">
                {/* Confetti Animation */}
                {showConfetti && (
                    <div className="fixed inset-0 z-50 pointer-events-none">
                        {Array.from({ length: 50 }).map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{
                                    opacity: 1,
                                    x: Math.random() * 800 - 400, // Relative to center
                                    y: -20,
                                    rotate: 0,
                                    scale: Math.random() * 0.5 + 0.5,
                                }}
                                animate={{
                                    opacity: 0,
                                    y: 1000,
                                    rotate: Math.random() * 720 - 360,
                                }}
                                transition={{
                                    duration: Math.random() * 2 + 2,
                                    delay: Math.random() * 1,
                                    ease: "easeOut",
                                }}
                                className="absolute w-3 h-3 rounded-sm"
                                style={{
                                    backgroundColor: [
                                        "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
                                        "#ec4899", "#06b6d4", "#f97316",
                                    ][i % 8],
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Header */}
                <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
                    <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                <span className="text-white font-bold text-[10px]">ILJ</span>
                            </div>
                            <div>
                                <h1 className="font-bold text-sm text-foreground leading-none">
                                    infolokerjombang
                                </h1>
                                <p className="text-[10px] text-emerald-500 font-semibold">Pembayaran Berhasil</p>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-2xl mx-auto px-4 py-8">
                    {/* Success Icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                        className="flex justify-center mb-6"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl scale-150" />
                            <div className="relative bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full p-5 shadow-2xl shadow-emerald-500/40">
                                <CheckCircle2 className="w-14 h-14 text-white" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-center mb-8"
                    >
                        <h1 className="text-3xl font-extrabold text-foreground mb-2">
                            Terima Kasih! 🎉
                        </h1>
                        <p className="text-muted-foreground">
                            Pembayaran Anda telah berhasil diterima
                        </p>
                    </motion.div>

                    {/* Order Details Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <Card className="p-6 mb-6 border-emerald-500/20 bg-emerald-500/5">
                            <div className="space-y-4">
                                {/* Order ID */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Order ID</span>
                                    <button
                                        onClick={copyOrderId}
                                        className="flex items-center gap-2 text-sm font-mono font-bold text-foreground hover:text-primary transition-colors"
                                    >
                                        {orderId}
                                        {copied ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </button>
                                </div>

                                <div className="border-t border-border/50" />

                                {/* Customer Info */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Nama</span>
                                    <span className="text-sm font-semibold text-foreground">{customerName}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Perusahaan</span>
                                    <span className="text-sm font-semibold text-foreground">{customerCompany}</span>
                                </div>

                                <div className="border-t border-border/50" />

                                {/* Package */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Paket</span>
                                    <span className="text-sm font-semibold text-foreground">{packageName}</span>
                                </div>

                                {/* Total */}
                                <div className="flex items-center justify-between bg-emerald-500/10 rounded-xl p-3 -mx-1">
                                    <span className="font-bold text-foreground">Total Bayar</span>
                                    <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                                        Rp {amount.toLocaleString("id-ID")}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Next Steps */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <Card className="p-6 mb-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <h3 className="font-bold text-foreground">Langkah Selanjutnya</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-xs font-bold text-primary">1</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Konfirmasi via WhatsApp</p>
                                        <p className="text-xs text-muted-foreground">Kirim bukti pembayaran dan detail loker ke admin</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-xs font-bold text-primary">2</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Kirim Materi Lowongan</p>
                                        <p className="text-xs text-muted-foreground">Kirimkan poster / detail lowongan kerja yang ingin diposting</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-xs font-bold text-primary">3</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Lowongan Diposting 🎉</p>
                                        <p className="text-xs text-muted-foreground">Tim kami akan memposting lowongan Anda sesuai paket yang dipilih</p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Download Invoice Options */}
                    {invoiceData && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.65 }}
                            className="mb-6"
                        >
                            <Card className="p-5 border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                        <FileText className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-foreground">Invoice Tersedia</h3>
                                        <p className="text-xs text-muted-foreground">Download bukti pembayaran Anda</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownload("png")}
                                        disabled={isDownloading}
                                        className="rounded-lg bg-background"
                                    >
                                        {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                        PNG
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleDownload("pdf")}
                                        disabled={isDownloading}
                                        className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                                    >
                                        {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                                        PDF
                                    </Button>
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {/* Action Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="space-y-3"
                    >
                        {/* WhatsApp CTA */}
                        <a href={waLink} target="_blank" rel="noopener noreferrer" className="block">
                            <Button
                                size="lg"
                                className="w-full rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/30 h-12"
                            >
                                <MessageCircle className="w-5 h-5 mr-2" />
                                Konfirmasi via WhatsApp
                            </Button>
                        </a>

                        {/* Instagram */}
                        <a
                            href="https://instagram.com/infolokerjombang"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                        >
                            <Button
                                variant="outline"
                                size="lg"
                                className="w-full rounded-xl font-semibold h-12"
                            >
                                <Instagram className="w-5 h-5 mr-2" />
                                Follow @infolokerjombang
                            </Button>
                        </a>

                        {/* Back to Home */}
                        <Link href="/" className="block">
                            <Button
                                variant="ghost"
                                size="lg"
                                className="w-full rounded-xl font-semibold h-12 text-muted-foreground"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Kembali ke Beranda
                            </Button>
                        </Link>
                    </motion.div>

                    {/* Footer Note */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="text-center mt-10"
                    >
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            Dibuat dengan <Heart className="w-3 h-3 text-red-500 fill-red-500" /> oleh InfoLokerJombang
                        </p>
                    </motion.div>
                </main>
            </div>

            {/* Mobile View */}
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="md:hidden min-h-screen bg-[#00a550] flex flex-col font-sans relative overflow-x-hidden"
            >
                {/* Background elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="absolute top-1/4 left-0 w-48 h-48 bg-[#008c44] rounded-full blur-2xl -translate-x-1/2 pointer-events-none" />
                
                {/* Header */}
                <div className="flex justify-center items-center px-6 pt-12 pb-16 text-white relative z-10">
                    <span className="font-bold text-lg tracking-tight">Status Pembayaran</span>
                </div>
                
                {/* Floating Content Card */}
                <div className="flex-1 bg-[#f8fafc] rounded-t-[32px] pt-20 px-6 pb-8 flex flex-col items-center relative shadow-[0_-20px_40px_rgba(0,0,0,0.15)] z-20">
                    {/* Floating Success Icon */}
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-28 h-28 z-30">
                        <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                            className="w-full h-full bg-white rounded-full p-2.5 shadow-xl"
                        >
                            <div className="w-full h-full bg-[#00a550] rounded-full flex items-center justify-center relative overflow-hidden">
                                <motion.div 
                                    animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                                    className="absolute inset-0 bg-white/60 rounded-full"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    <CheckCircle2 className="w-14 h-14 text-white relative z-10" strokeWidth={2.5} />
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                    
                    <motion.h2 
                        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                        className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-800 to-slate-500 mb-3 tracking-tight text-center leading-tight"
                    >
                        Pembayaran Diproses
                    </motion.h2>
                    
                    <motion.div 
                        initial="hidden" animate="visible"
                        variants={{
                            hidden: { opacity: 0 },
                            visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.4 } }
                        }}
                        className="w-full mb-8 space-y-4"
                    >
                        <motion.p 
                            variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                            className="text-slate-500 text-[13.5px] font-medium text-center mb-6 max-w-[280px] mx-auto leading-relaxed"
                        >
                            Terima kasih telah mempercayakan publikasi lowongan perusahaan Anda kepada Infolokerjombang.
                        </motion.p>

                        <motion.div 
                            variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                            className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex gap-3 text-left"
                        >
                            <div className="mt-0.5 w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                <Clock className="w-4 h-4 text-blue-500" />
                            </div>
                            <p className="text-slate-600 text-[13px] leading-relaxed">
                                <strong className="text-slate-800 block mb-0.5">Sedang Kami Cek</strong>
                                Data dan pembayaran sudah diterima. Tim akan segera menghubungi via WhatsApp untuk jadwal tayang.
                            </p>
                        </motion.div>

                        <motion.div 
                            variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                            className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex gap-3 text-left"
                        >
                            <div className="mt-0.5 w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-4 h-4 text-amber-500" />
                            </div>
                            <p className="text-slate-600 text-[13px] leading-relaxed">
                                <strong className="text-slate-800 block mb-0.5">Simpan Bukti</strong>
                                Mohon simpan bukti pembayaran untuk berjaga-jaga ya.
                            </p>
                        </motion.div>

                        <motion.div 
                            variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                            className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex gap-3 text-left"
                        >
                            <div className="mt-0.5 w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                <Zap className="w-4 h-4 text-emerald-500" />
                            </div>
                            <p className="text-slate-600 text-[13px] leading-relaxed">
                                <strong className="text-slate-800 block mb-0.5">Siap Tampil</strong>
                                Lowongan kamu akan segera menjangkau ribuan pencari kerja di Jombang.
                            </p>
                        </motion.div>
                    </motion.div>
                    
                    {/* Receipt Card */}
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                        className="w-full bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_5px_15px_-5px_rgba(0,0,0,0.05)] mb-8"
                    >
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100 border-dashed">
                            <span className="text-slate-500 text-sm font-medium">Nominal</span>
                            <span className="text-xl font-black text-slate-800">Rp {amount.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs font-medium">Tanggal</span>
                                <span className="text-slate-700 text-xs font-bold">{new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs font-medium">Metode</span>
                                <span className="text-slate-700 text-xs font-bold">QRIS</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs font-medium">ID Transaksi</span>
                                <span className="text-slate-700 text-xs font-mono font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{orderId}</span>
                            </div>
                        </div>
                    </motion.div>
                    
                    {/* Action Buttons */}
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}
                        className="w-full space-y-3 mt-auto"
                    >
                        <a href={waLink} target="_blank" rel="noopener noreferrer" className="block">
                            <div className="w-full bg-[#00a550] hover:bg-[#008c44] text-white py-4 rounded-2xl font-bold text-[15px] flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all">
                                <MessageCircle className="w-5 h-5" /> Konfirmasi ke Admin
                            </div>
                        </a>
                        <Link href="/" className="w-full bg-emerald-50 hover:bg-emerald-100 text-[#00a550] py-4 rounded-2xl font-bold text-[15px] flex justify-center items-center gap-2 active:scale-[0.98] transition-all">
                            <Home className="w-5 h-5" /> Kembali ke Beranda
                        </Link>
                    </motion.div>
                </div>
            </motion.div>
        </>
    );
}

export default function ThankYouPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        }>
            <ThankYouContent />
        </Suspense>
    );
}
