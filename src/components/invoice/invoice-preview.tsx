"use client";

import { cn } from "@/lib/utils";
import { formatRupiah, formatDate } from "@/lib/utils";
import type { InvoiceData, InvoiceTemplate } from "@/lib/invoice-types";

interface InvoiceTemplateProps {
    invoice: InvoiceData;
    template: InvoiceTemplate;
}

// Template styles configuration
const templateStyles: Record<InvoiceTemplate, {
    container: string;
    headerWrapper: string;
    header: string;
    logoWrapper: string;
    logoImage: string; // Styles for the img tag
    title: string;
    meta: string; // For invoice number, date, etc
    billTo: string;
    table: string;
    tableHeader: string;
    tableRow: string;
    totalWrapper: string;
    totalLabel: string;
    totalValue: string;
    footer: string;
    watermark: string;
}> = {
    modern: {
        container: "bg-white text-slate-900 font-sans",
        headerWrapper: "flex flex-row justify-between items-start mb-12 border-b border-emerald-100 pb-8",
        header: "text-right",
        logoWrapper: "w-24 h-24 relative rounded-2xl overflow-hidden shadow-sm",
        logoImage: "object-cover w-full h-full",
        title: "text-4xl font-extrabold text-emerald-600 tracking-tight uppercase",
        meta: "text-slate-500 text-sm font-medium mt-2 space-y-1",
        billTo: "bg-emerald-50/50 p-6 rounded-xl border border-emerald-100/50 mb-10",
        table: "w-full border-collapse",
        tableHeader: "bg-emerald-600 text-white text-xs uppercase tracking-wider font-bold",
        tableRow: "border-b border-emerald-50 hover:bg-emerald-50/30 transition-colors",
        totalWrapper: "bg-slate-50 p-6 rounded-xl space-y-2 w-72 ml-auto",
        totalLabel: "text-slate-500 font-medium",
        totalValue: "text-2xl font-bold text-emerald-600",
        footer: "text-slate-400 text-xs mt-12 pt-8 border-t border-slate-100 text-center",
        watermark: "text-emerald-500/5 font-extrabold",
    },
    professional: {
        container: "bg-white text-slate-900 font-sans",
        headerWrapper: "bg-slate-900 text-white p-10 -mx-10 -mt-10 mb-10 flex flex-row justify-between items-center shadow-lg",
        header: "text-right",
        logoWrapper: "w-20 h-20 bg-white rounded-lg p-1",
        logoImage: "object-contain w-full h-full rounded",
        title: "text-3xl font-bold text-slate-100 tracking-wider uppercase",
        meta: "text-slate-300 text-sm font-medium mt-1",
        billTo: "pl-4 border-l-4 border-slate-900 mb-10",
        table: "w-full border-collapse",
        tableHeader: "bg-slate-100 text-slate-900 text-xs uppercase tracking-wider font-bold border-y-2 border-slate-900",
        tableRow: "border-b border-slate-200",
        totalWrapper: "border-t-2 border-slate-900 pt-4 space-y-2 w-72 ml-auto",
        totalLabel: "text-slate-600 font-bold uppercase text-xs",
        totalValue: "text-3xl font-black text-slate-900",
        footer: "text-slate-500 text-sm mt-12 text-center font-medium",
        watermark: "text-slate-900/5 font-black uppercase",
    },
    creative: {
        container: "bg-white text-slate-800 font-sans selection:bg-purple-100",
        headerWrapper: "flex flex-row-reverse justify-between items-start mb-12 relative z-10",
        header: "text-left",
        logoWrapper: "w-32 h-32 relative -mt-4 -mr-4 rounded-full border-4 border-white shadow-xl overflow-hidden",
        logoImage: "object-cover w-full h-full",
        title: "text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2",
        meta: "text-lg font-light text-slate-500",
        billTo: "bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-2xl mb-10 border border-purple-100",
        table: "w-full border-separate border-spacing-y-2",
        tableHeader: "text-purple-900/50 text-xs uppercase tracking-widest font-bold",
        tableRow: "bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow",
        totalWrapper: "bg-gradient-to-br from-purple-600 to-pink-600 text-white p-6 rounded-2xl shadow-lg w-80 ml-auto transform rotate-1",
        totalLabel: "text-purple-100 font-medium",
        totalValue: "text-3xl font-bold text-white",
        footer: "text-purple-400 text-xs mt-12 text-center",
        watermark: "text-purple-500/10 font-bold",
    },
    classic: {
        container: "bg-[#fffdf5] text-serif text-slate-900", // Warm paper tone
        headerWrapper: "text-center mb-12 border-b-4 border-double border-slate-800 pb-8",
        header: "mt-4",
        logoWrapper: "w-24 h-24 mx-auto mb-4 grayscale opacity-90",
        logoImage: "object-contain w-full h-full",
        title: "text-4xl font-serif font-bold text-slate-900 tracking-widest uppercase mb-4",
        meta: "text-slate-600 font-serif italic text-lg",
        billTo: "mb-10 text-center border-2 border-slate-200 p-6 max-w-lg mx-auto bg-white/50",
        table: "w-full border-collapse border-2 border-slate-800",
        tableHeader: "bg-slate-800 text-[#fffdf5] font-serif uppercase tracking-widest p-4",
        tableRow: "border-b border-slate-300 font-serif",
        totalWrapper: "mt-8 border-t-4 border-double border-slate-800 pt-4 w-full text-right",
        totalLabel: "text-slate-600 font-serif italic text-xl",
        totalValue: "text-4xl font-serif font-bold text-slate-900 underline decoration-double decoration-slate-400",
        footer: "text-slate-500 font-serif italic mt-12 text-center",
        watermark: "text-slate-900/5 font-serif",
    },
    elegant: {
        container: "bg-white text-slate-800 font-sans tracking-wide",
        headerWrapper: "grid grid-cols-2 gap-12 mb-16 items-center",
        header: "text-left border-l-2 border-amber-400 pl-6",
        logoWrapper: "w-20 h-20",
        logoImage: "object-contain w-full h-full",
        title: "text-2xl font-light text-slate-400 uppercase tracking-[0.3em] mb-2",
        meta: "text-slate-500 font-light",
        billTo: "pb-8 border-b border-slate-100 mb-10",
        table: "w-full",
        tableHeader: "text-amber-600 text-xs font-bold uppercase tracking-widest pb-4 border-b border-amber-100",
        tableRow: "border-b border-slate-50",
        totalWrapper: "bg-slate-900 text-white p-8 -mr-10 -mb-10 w-[calc(100%+5rem)] ml-[auto] mt-12 flex justify-between items-center",
        totalLabel: "text-amber-400 text-sm font-medium tracking-widest uppercase",
        totalValue: "text-4xl font-light text-white",
        footer: "hidden", // No footer for cleaner look
        watermark: "text-amber-500/5 font-light",
    },
    dark: {
        container: "bg-neutral-950 text-neutral-100 font-sans antialiased",
        headerWrapper: "flex justify-between items-end mb-12 border-b border-neutral-800 pb-8",
        header: "text-right",
        logoWrapper: "w-24 h-24 bg-neutral-900 rounded-2xl p-2 border border-neutral-800",
        logoImage: "object-contain w-full h-full rounded-xl",
        title: "text-5xl font-bold text-white tracking-tighter mb-2",
        meta: "text-neutral-400 font-mono text-sm",
        billTo: "bg-neutral-900/50 p-6 rounded-xl border border-neutral-800 mb-10",
        table: "w-full",
        tableHeader: "text-neutral-500 text-xs font-bold uppercase tracking-wider pb-4",
        tableRow: "border-b border-neutral-900 hover:bg-neutral-900/50 transition-colors",
        totalWrapper: "bg-lime-400 text-black p-6 rounded-xl w-72 ml-auto mt-8 shadow-[0_0_30px_-5px_rgba(163,230,53,0.3)]",
        totalLabel: "text-lime-900 font-bold uppercase text-xs",
        totalValue: "text-3xl font-black text-black",
        footer: "text-neutral-600 text-xs mt-12 text-center",
        watermark: "text-neutral-800 font-black",
    },
};

const statusWatermarks: Record<string, string> = {
    draft: "DRAFT",
    sent: "TERKIRIM",
    paid: "LUNAS",
    cancelled: "BATAL",
};

export function InvoicePreview({ invoice, template }: InvoiceTemplateProps) {
    const styles = templateStyles[template];
    const showWatermark = invoice.status !== "draft";

    return (
        <div className={cn(
            "relative overflow-hidden transition-all duration-300",
            "w-[794px] min-h-[1123px] p-[40px]", // A4 dimensions at 96dpi
            styles.container
        )}>
            {/* Watermark */}
            {showWatermark && (
                <div className={cn(
                    "absolute inset-0 flex items-center justify-center pointer-events-none z-0",
                    styles.watermark
                )}>
                    <span className="text-9xl font-bold -rotate-12 opacity-30 select-none">
                        {statusWatermarks[invoice.status]}
                    </span>
                </div>
            )}

            <div className="relative z-10">
                {/* Header Section */}
                <div className={styles.headerWrapper}>
                    <div className={styles.logoWrapper}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/profile.png"
                            alt="Logo ILJ"
                            className={styles.logoImage}
                        />
                    </div>
                    <div className={styles.header}>
                        <h1 className={styles.title}>INVOICE</h1>
                        <div className={styles.meta}>
                            <p><span className="opacity-60">No.</span> {invoice.invoice_number}</p>
                            <p><span className="opacity-60">Tanggal:</span> {formatDate(invoice.invoice_date)}</p>
                            {invoice.due_date && (
                                <p className="text-red-500/80"><span className="opacity-60 text-current">Jatuh Tempo:</span> {formatDate(invoice.due_date)}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sender & Receiver Info */}
                <div className="grid md:grid-cols-2 gap-12 mb-10">
                    <div>
                        <p className="text-xs uppercase font-bold opacity-40 mb-3 tracking-wider">Dari</p>
                        <h3 className="font-bold text-lg mb-1">InfoLokerJombang</h3>
                        <p className="opacity-70 text-sm leading-relaxed">@infolokerjombang</p>
                        <p className="opacity-70 text-sm leading-relaxed">Jombang, Jawa Timur</p>
                    </div>
                    <div className={styles.billTo}>
                        <p className="text-xs uppercase font-bold opacity-40 mb-3 tracking-wider">Kepada</p>
                        <h3 className="font-bold text-lg mb-1">{invoice.client_name || "Nama Klien"}</h3>
                        {invoice.client_phone && <p className="opacity-70 text-sm">{invoice.client_phone}</p>}
                        {invoice.client_address && <p className="opacity-70 text-sm mt-1">{invoice.client_address}</p>}
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-8 min-h-[200px]">
                    <table className={styles.table}>
                        <thead>
                            <tr className={template === 'creative' ? "" : template === "modern" ? "" : "border-b-2 border-current"}>
                                <th className={cn("text-left p-4", styles.tableHeader)}>Deskripsi</th>
                                <th className={cn("text-center p-4 w-24", styles.tableHeader)}>Qty</th>
                                <th className={cn("text-right p-4 w-40", styles.tableHeader)}>Harga</th>
                                <th className={cn("text-right p-4 w-40", styles.tableHeader)}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.items.map((item, idx) => (
                                <tr key={idx} className={styles.tableRow}>
                                    <td className="p-4 font-medium">{item.description || "Deskripsi Item..."}</td>
                                    <td className="p-4 text-center opacity-80">{item.quantity}</td>
                                    <td className="p-4 text-right opacity-80">{formatRupiah(item.price)}</td>
                                    <td className="p-4 text-right font-bold w-40 relative">
                                        <span className={template === 'creative' ? "bg-purple-50 px-2 py-1 rounded text-purple-700" : ""}>
                                            {formatRupiah(item.quantity * item.price)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Financials & Footer */}
                <div className="grid md:grid-cols-2 gap-12 items-start mt-8">
                    {/* Left: Bank Info & Notes */}
                    <div className="space-y-8">
                        {invoice.bank_name && (
                            <div className="p-5 rounded-xl border border-dashed border-current/20 bg-current/5">
                                <p className="text-xs uppercase font-bold opacity-50 mb-3">Pembayaran</p>
                                <div className="space-y-1">
                                    <p className="font-bold text-lg">{invoice.bank_name}</p>
                                    <p className="font-mono text-xl tracking-wide select-all">{invoice.bank_account_number}</p>
                                    <p className="text-sm opacity-70">a.n. {invoice.bank_account_name}</p>
                                </div>
                            </div>
                        )}

                        {invoice.notes && (
                            <div className="opacity-70 text-sm">
                                <p className="font-bold mb-2 text-xs uppercase tracking-wider opacity-70">Catatan</p>
                                <p className="whitespace-pre-line leading-relaxed">{invoice.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Totals */}
                    <div>
                        <div className={styles.totalWrapper}>
                            <div className="space-y-3 p-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="opacity-70">Subtotal</span>
                                    <span className="font-semibold">{formatRupiah(invoice.subtotal)}</span>
                                </div>
                                {invoice.discount_amount > 0 && (
                                    <div className="flex justify-between items-center text-sm text-red-500">
                                        <span>Diskon {invoice.discount_type === "percent" ? `(${invoice.discount_value}%)` : ""}</span>
                                        <span>-{formatRupiah(invoice.discount_amount)}</span>
                                    </div>
                                )}
                                {invoice.tax_enabled && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="opacity-70">PPN ({invoice.tax_percent}%)</span>
                                        <span>{formatRupiah(invoice.tax_amount)}</span>
                                    </div>
                                )}
                                <div className="pt-4 mt-2 border-t border-current/10 flex justify-between items-end">
                                    <span className={styles.totalLabel}>Total Tagihan</span>
                                    <span className={styles.totalValue}>{formatRupiah(invoice.total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Message */}
                <div className={styles.footer}>
                    <p>Terima kasih atas kepercayaan Anda bekerja sama dengan InfoLokerJombang.</p>
                </div>
            </div>
        </div>
    );
}
