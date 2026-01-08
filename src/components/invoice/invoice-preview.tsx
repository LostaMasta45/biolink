"use client";

import { cn } from "@/lib/utils";
import { formatRupiah, formatDate } from "@/lib/utils";
import type { InvoiceData, InvoiceTemplate, InvoiceColorTheme } from "@/lib/invoice-types";

interface InvoiceTemplateProps {
    invoice: InvoiceData;
    template: InvoiceTemplate;
    customLogoUrl?: string;
}

// Color theme configuration
const COLOR_THEMES: Record<InvoiceColorTheme, {
    text: string;
    bg: string;
    border: string;
    accent: string;
    light: string;
    dark: string;
    gradient: string;
}> = {
    default: { text: "text-slate-900", bg: "bg-slate-900", border: "border-slate-900", accent: "text-slate-600", light: "bg-slate-100", dark: "bg-slate-800", gradient: "from-slate-700 to-slate-900" },
    blue: { text: "text-blue-600", bg: "bg-blue-600", border: "border-blue-600", accent: "text-blue-500", light: "bg-blue-50", dark: "bg-blue-800", gradient: "from-blue-600 to-indigo-600" },
    green: { text: "text-emerald-600", bg: "bg-emerald-600", border: "border-emerald-600", accent: "text-emerald-500", light: "bg-emerald-50", dark: "bg-emerald-800", gradient: "from-emerald-600 to-teal-600" },
    purple: { text: "text-purple-600", bg: "bg-purple-600", border: "border-purple-600", accent: "text-purple-500", light: "bg-purple-50", dark: "bg-purple-800", gradient: "from-purple-600 to-pink-600" },
    red: { text: "text-red-600", bg: "bg-red-600", border: "border-red-600", accent: "text-red-500", light: "bg-red-50", dark: "bg-red-800", gradient: "from-red-600 to-orange-600" },
    orange: { text: "text-orange-600", bg: "bg-orange-600", border: "border-orange-600", accent: "text-orange-500", light: "bg-orange-50", dark: "bg-orange-800", gradient: "from-orange-600 to-amber-600" },
    pink: { text: "text-pink-600", bg: "bg-pink-600", border: "border-pink-600", accent: "text-pink-500", light: "bg-pink-50", dark: "bg-pink-800", gradient: "from-pink-600 to-rose-600" },
    indigo: { text: "text-indigo-600", bg: "bg-indigo-600", border: "border-indigo-600", accent: "text-indigo-500", light: "bg-indigo-50", dark: "bg-indigo-800", gradient: "from-indigo-600 to-violet-600" },
    slate: { text: "text-slate-800", bg: "bg-slate-800", border: "border-slate-800", accent: "text-slate-600", light: "bg-slate-100", dark: "bg-slate-900", gradient: "from-slate-800 to-black" },
};

type StyleConfig = {
    container: string;
    headerWrapper: string;
    header: string;
    logoWrapper: string;
    logoImage: string;
    title: string;
    meta: string;
    billTo: string;
    table: string;
    tableHeader: string;
    tableRow: string;
    totalWrapper: string;
    totalLabel: string;
    totalValue: string;
    footer: string;
    watermark: string;
};

// Template styles generator
const getTemplateStyles = (template: InvoiceTemplate, themeKey: InvoiceColorTheme = 'default'): StyleConfig => {
    const theme = COLOR_THEMES[themeKey];

    const styles: Record<InvoiceTemplate, StyleConfig> = {
        modern: {
            container: "bg-white text-slate-900 font-sans",
            headerWrapper: `flex flex-row justify-between items-start mb-12 border-b ${theme.border.replace('border-', 'border-').replace('600', '100')} pb-8`,
            header: "text-right",
            logoWrapper: "w-24 h-24 relative rounded-2xl overflow-hidden shadow-sm",
            logoImage: "object-cover w-full h-full",
            title: `text-4xl font-extrabold ${theme.text} tracking-tight uppercase`,
            meta: "text-slate-500 text-sm font-medium mt-2 space-y-1",
            billTo: `${theme.light} p-6 rounded-xl border ${theme.border.replace('border-', 'border-').replace('600', '100')}/50 mb-10`,
            table: "w-full border-collapse",
            tableHeader: `${theme.bg} text-white text-xs uppercase tracking-wider font-bold`,
            tableRow: `border-b border-slate-100 hover:${theme.light}/50 transition-colors`,
            totalWrapper: "bg-slate-50 p-8 rounded-xl space-y-4 w-96 ml-auto shadow-sm",
            totalLabel: "text-slate-500 font-medium text-sm tracking-wide",
            totalValue: `text-4xl font-bold ${theme.text} leading-none`,
            footer: "text-slate-400 text-xs mt-12 pt-8 border-t border-slate-100 text-center",
            watermark: `${theme.text.replace('text-', 'text-')}/5 font-extrabold`,
        },
        professional: {
            container: "bg-white text-slate-900 font-sans",
            headerWrapper: `${theme.bg} text-white p-10 -mx-10 -mt-10 mb-10 flex flex-row justify-between items-center shadow-lg`,
            header: "text-right",
            logoWrapper: "w-20 h-20 bg-white rounded-lg p-1",
            logoImage: "object-contain w-full h-full rounded",
            title: "text-3xl font-bold text-slate-100 tracking-wider uppercase",
            meta: "text-slate-300 text-sm font-medium mt-1",
            billTo: `pl-4 border-l-4 ${theme.border} mb-10`,
            table: "w-full border-collapse",
            tableHeader: `bg-slate-100 text-slate-900 text-xs uppercase tracking-wider font-bold border-y-2 ${theme.border}`,
            tableRow: "border-b border-slate-200",
            totalWrapper: `border-t-2 ${theme.border} pt-8 space-y-4 w-96 ml-auto`,
            totalLabel: "text-slate-600 font-bold uppercase text-xs tracking-widest",
            totalValue: "text-4xl font-black text-slate-900",
            footer: "text-slate-500 text-sm mt-12 text-center font-medium",
            watermark: "text-slate-900/5 font-black uppercase",
        },
        creative: {
            container: "bg-white text-slate-800 font-sans selection:bg-purple-100",
            headerWrapper: "flex flex-row-reverse justify-between items-start mb-12 relative z-10",
            header: "text-left",
            logoWrapper: "w-32 h-32 relative -mt-4 -mr-4 rounded-full border-4 border-white shadow-xl overflow-hidden",
            logoImage: "object-cover w-full h-full",
            title: `text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r ${theme.gradient} mb-2`,
            meta: "text-lg font-light text-slate-500",
            billTo: `bg-gradient-to-r ${theme.gradient.replace('from-', 'from-').replace('to-', 'to-').replace('600', '50')} p-6 rounded-2xl mb-10 border ${theme.border.replace('border-', 'border-').replace('600', '100')}`,
            table: "w-full border-separate border-spacing-y-2",
            tableHeader: `${theme.text.replace('text-', 'text-').replace('600', '900')}/50 text-xs uppercase tracking-widest font-bold`,
            tableRow: "bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow",
            totalWrapper: `bg-gradient-to-br ${theme.gradient} text-white p-6 rounded-2xl shadow-lg w-80 ml-auto transform rotate-1`,
            totalLabel: `${theme.text.replace('text-', 'text-').replace('600', '100')} font-medium`,
            totalValue: "text-3xl font-bold text-white",
            footer: `${theme.text.replace('text-', 'text-').replace('600', '400')} text-xs mt-12 text-center`,
            watermark: `${theme.text.replace('text-', 'text-')}/10 font-bold`,
        },
        classic: {
            container: "bg-[#fffdf5] text-serif text-slate-900",
            headerWrapper: `text-center mb-12 border-b-4 border-double ${theme.border} pb-8`,
            header: "mt-4",
            logoWrapper: "w-24 h-24 mx-auto mb-4 grayscale opacity-90",
            logoImage: "object-contain w-full h-full",
            title: "text-4xl font-serif font-bold text-slate-900 tracking-widest uppercase mb-4",
            meta: "text-slate-600 font-serif italic text-lg",
            billTo: "mb-10 text-center border-2 border-slate-200 p-6 max-w-lg mx-auto bg-white/50",
            table: `w-full border-collapse border-2 ${theme.border}`,
            tableHeader: `${theme.bg} text-[#fffdf5] font-serif uppercase tracking-widest p-4`,
            tableRow: "border-b border-slate-300 font-serif",
            totalWrapper: `mt-8 border-t-4 border-double ${theme.border} pt-4 w-full text-right`,
            totalLabel: "text-slate-600 font-serif italic text-xl",
            totalValue: "text-4xl font-serif font-bold text-slate-900 underline decoration-double decoration-slate-400",
            footer: "text-slate-500 font-serif italic mt-12 text-center",
            watermark: "text-slate-900/5 font-serif",
        },
        elegant: {
            container: "bg-white text-slate-800 font-sans tracking-wide",
            headerWrapper: "grid grid-cols-2 gap-12 mb-16 items-center",
            header: `text-left border-l-2 ${theme.border} pl-6`,
            logoWrapper: "w-20 h-20",
            logoImage: "object-contain w-full h-full",
            title: "text-2xl font-light text-slate-400 uppercase tracking-[0.3em] mb-2",
            meta: "text-slate-500 font-light",
            billTo: "pb-8 border-b border-slate-100 mb-10",
            table: "w-full",
            tableHeader: `${theme.text} text-xs font-bold uppercase tracking-widest pb-4 border-b ${theme.border.replace('border-', 'border-').replace('600', '100')}`,
            tableRow: "border-b border-slate-50",
            totalWrapper: `${theme.dark} text-white p-12 -mr-12 -mb-12 w-[calc(100%+6rem)] ml-[auto] mt-20 flex justify-between items-center shadow-lg`,
            totalLabel: `${theme.text} text-sm font-medium tracking-[0.25em] uppercase`,
            totalValue: "text-4xl font-light text-white tracking-wide",
            footer: "hidden",
            watermark: `${theme.text.replace('text-', 'text-')}/5 font-light`,
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
            totalWrapper: `${theme.bg.replace('bg-', 'bg-').replace('600', '400')} text-black p-8 rounded-2xl w-96 ml-auto mt-16 shadow-[0_0_50px_-10px_rgba(255,255,255,0.15)]`,
            totalLabel: "text-neutral-900 font-extrabold uppercase text-xs tracking-widest",
            totalValue: "text-5xl font-black text-black tracking-tight",
            footer: "text-neutral-600 text-xs mt-12 text-center",
            watermark: "text-neutral-800 font-black",
        },
        minimalist: {
            container: "bg-white text-slate-800 font-sans",
            headerWrapper: "flex flex-col items-center justify-center text-center mb-16",
            header: "mt-6 text-center",
            logoWrapper: "w-20 h-20 rounded-full bg-slate-50 p-4 mx-auto",
            logoImage: "object-contain w-full h-full",
            title: "text-lg font-medium tracking-[0.2em] text-slate-400 uppercase mt-4 mb-2",
            meta: "text-slate-500 text-sm font-light",
            billTo: "text-center mb-16 max-w-md mx-auto",
            table: "w-full",
            tableHeader: "text-slate-400 font-medium text-xs uppercase tracking-wider pb-4 border-b border-slate-100",
            tableRow: "border-b border-slate-50",
            totalWrapper: "flex justify-between items-center pt-8 border-t border-slate-100 mt-8",
            totalLabel: "text-slate-500 font-medium",
            totalValue: `text-4xl font-light ${theme.text}`,
            footer: "text-slate-300 text-[10px] mt-20 text-center uppercase tracking-widest",
            watermark: "hidden",
        },
        bold: {
            container: "bg-white text-black font-sans",
            headerWrapper: `${theme.bg} text-white p-12 -mx-10 -mt-10 mb-12`,
            header: "mt-4",
            logoWrapper: "w-28 h-28 bg-white p-2 mb-6",
            logoImage: "object-contain w-full h-full",
            title: "text-7xl font-black tracking-tighter opacity-20 absolute top-4 right-10",
            meta: "text-white/80 font-medium text-lg",
            billTo: `border-l-[6px] ${theme.border} pl-6 mb-12`,
            table: "w-full border-b-4 border-black",
            tableHeader: "font-black text-lg uppercase tracking-tight pb-4 border-b-4 border-black",
            tableRow: "border-b border-black font-bold text-lg",
            totalWrapper: "bg-black text-white p-10 mt-12 w-full text-right",
            totalLabel: "text-white/60 font-bold uppercase tracking-[0.2em] text-sm mb-2 block",
            totalValue: "text-6xl font-black tracking-tighter",
            footer: "font-black text-xs uppercase mt-12 pt-8 border-t-2 border-black",
            watermark: "text-black/5 font-black uppercase text-9xl",
        },
        tech: {
            container: "bg-slate-50 text-slate-800 font-mono",
            headerWrapper: `border-b border-dashed ${theme.border} pb-8 mb-8 flex justify-between items-start`,
            header: "text-right",
            logoWrapper: "w-16 h-16 border border-slate-300 p-2",
            logoImage: "object-contain w-full h-full grayscale",
            title: `text-xl font-bold ${theme.text} mb-2`,
            meta: "text-xs text-slate-500 space-y-1",
            billTo: "bg-white border border-slate-200 p-4 mb-8 text-sm",
            table: "w-full text-sm",
            tableHeader: `bg-slate-200 text-slate-700 font-bold p-2 text-left`,
            tableRow: "border-b border-dashed border-slate-300 hover:bg-white bg-slate-50/50",
            totalWrapper: `border border-slate-300 bg-white p-8 w-80 ml-auto mt-12 border-l-[8px] ${theme.border} shadow-md`,
            totalLabel: "text-xs font-bold uppercase text-slate-500 mb-2 block tracking-wider",
            totalValue: `text-3xl font-bold ${theme.text} font-mono tracking-tight`,
            footer: "text-[10px] text-slate-400 mt-8 font-mono border-t border-dashed border-slate-300 pt-4",
            watermark: `${theme.text.replace('text-', 'text-')}/5 font-mono`,
        },
        geometric: {
            container: "bg-white text-slate-900 font-sans relative",
            headerWrapper: "flex flex-row justify-between items-center mb-16 relative z-10",
            header: "text-right",
            logoWrapper: "w-24 h-24 rounded-full bg-slate-900 p-1 z-10",
            logoImage: "object-contain w-full h-full rounded-full bg-white",
            title: `text-4xl font-bold ${theme.text} mb-2 absolute top-0 right-0 opacity-10 scale-150 origin-top-right`,
            meta: "text-slate-500 font-medium mt-2",
            billTo: `relative z-10 bg-slate-50 p-8 rounded-tr-[3rem] border-l-8 ${theme.border} mb-12`,
            table: "w-full relative z-10",
            tableHeader: `${theme.text} text-sm font-bold uppercase tracking-widest pb-6 border-b-2 ${theme.border} mb-4`,
            tableRow: "border-b border-slate-100 py-4",
            totalWrapper: `relative z-10 ${theme.bg} text-white p-12 rounded-tl-[4rem] w-[28rem] ml-auto mt-16 shadow-xl`,
            totalLabel: "text-white/80 font-bold uppercase tracking-[0.15em] text-sm mb-2 block",
            totalValue: "text-5xl font-bold tracking-tight",
            footer: "relative z-10 text-slate-400 text-xs mt-16 text-center",
            watermark: `${theme.text.replace('text-', 'text-')}/5 font-black`,
        }
    };

    return styles[template];
};

const statusWatermarks: Record<string, string> = {
    draft: "DRAFT",
    sent: "TERKIRIM",
    paid: "LUNAS",
    cancelled: "BATAL",
};

export function InvoicePreview({ invoice, template, customLogoUrl }: InvoiceTemplateProps) {
    const styles = getTemplateStyles(template, invoice.color_theme || "default");
    const showWatermark = invoice.status !== "draft";

    // Geometric circle decoration
    const isGeometric = template === 'geometric';

    return (
        <div className={cn(
            "relative overflow-hidden transition-all duration-300",
            "w-[794px] min-h-[1123px] p-[40px]", // A4 dimensions at 96dpi
            styles.container
        )}>
            {/* Geometric Decorations */}
            {isGeometric && (
                <>
                    <div className={cn("absolute top-0 left-0 w-64 h-64 rounded-br-full opacity-10", styles.totalWrapper.split(' ')[2])} />
                    <div className={cn("absolute bottom-0 right-0 w-96 h-96 rounded-tl-full opacity-5", styles.totalWrapper.split(' ')[2])} />
                </>
            )}

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
                            src={customLogoUrl || "/profile.png"}
                            alt="Logo ILJ"
                            className={styles.logoImage}
                        />
                    </div>
                    <div className={styles.header}>
                        <h1 className={styles.title}>INVOICE</h1>
                        {template !== 'bold' && template !== 'geometric' && ( // Hide redundant title in some templates
                            <div className={styles.meta}>
                                <p><span className="opacity-60">No.</span> {invoice.invoice_number}</p>
                                <p><span className="opacity-60">Tanggal:</span> {formatDate(invoice.invoice_date)}</p>
                                {invoice.due_date && (
                                    <p className="text-red-500/80"><span className="opacity-60 text-current">Jatuh Tempo:</span> {formatDate(invoice.due_date)}</p>
                                )}
                            </div>
                        )}
                        {(template === 'bold' || template === 'geometric') && ( // Custom meta layout for Bold/Geometric
                            <div className={styles.meta}>
                                <p className="text-2xl font-bold">{invoice.invoice_number}</p>
                                <p>{formatDate(invoice.invoice_date)}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sender & Receiver Info */}
                <div className="grid md:grid-cols-2 gap-12 mb-10">
                    <div>
                        <p className="text-xs uppercase font-bold opacity-40 mb-3 tracking-wider">Dari</p>
                        <h3 className="font-bold text-lg mb-1">{invoice.sender_name || "InfoLokerJombang"}</h3>
                        <p className="opacity-70 text-sm leading-relaxed">{invoice.sender_contact || "@infolokerjombang"}</p>
                        <p className="opacity-70 text-sm leading-relaxed">{invoice.sender_address || "Jombang, Jawa Timur"}</p>
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
                            <tr className={template === 'creative' ? "" : template === "modern" ? "" : template === "minimalist" ? "" : "border-b-2 border-current"}>
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
