"use client";

import { formatRupiah, formatDate } from "@/lib/utils";
import type { InvoiceData, InvoiceTemplate } from "@/lib/invoice-types";

interface PrintableInvoiceProps {
    invoice: InvoiceData;
    template: InvoiceTemplate;
}

// Hex color palette for print (no oklch/lab)
const colors = {
    white: '#ffffff',
    black: '#000000',
    slate50: '#f8fafc',
    slate100: '#f1f5f9',
    slate200: '#e2e8f0',
    slate300: '#cbd5e1',
    slate400: '#94a3b8',
    slate500: '#64748b',
    slate600: '#475569',
    slate700: '#334155',
    slate800: '#1e293b',
    slate900: '#0f172a',
    emerald50: '#ecfdf5',
    emerald100: '#d1fae5',
    emerald500: '#10b981',
    emerald600: '#059669',
    purple50: '#faf5ff',
    purple100: '#f3e8ff',
    purple600: '#9333ea',
    purple700: '#7c3aed',
    pink600: '#db2777',
    amber400: '#fbbf24',
    red500: '#ef4444',
    lime400: '#a3e635',
    neutral800: '#262626',
    neutral900: '#171717',
    neutral950: '#0a0a0a',
};

const templateConfigs: Record<InvoiceTemplate, {
    container: React.CSSProperties;
    headerWrapper: React.CSSProperties;
    header: React.CSSProperties;
    title: React.CSSProperties;
    meta: React.CSSProperties;
    billTo: React.CSSProperties;
    tableHeader: React.CSSProperties;
    tableRow: React.CSSProperties;
    totalWrapper: React.CSSProperties;
    totalLabel: React.CSSProperties;
    totalValue: React.CSSProperties;
}> = {
    modern: {
        container: { backgroundColor: colors.white, color: colors.slate900, fontFamily: 'system-ui, sans-serif' },
        headerWrapper: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px', borderBottom: `1px solid ${colors.emerald100}`, paddingBottom: '32px' },
        header: { textAlign: 'right' as const },
        title: { fontSize: '32px', fontWeight: 800, color: colors.emerald600, textTransform: 'uppercase' as const, letterSpacing: '-0.025em' },
        meta: { color: colors.slate500, fontSize: '14px', fontWeight: 500, marginTop: '8px' },
        billTo: { backgroundColor: colors.emerald50, padding: '24px', borderRadius: '12px', border: `1px solid ${colors.emerald100}`, marginBottom: '40px' },
        tableHeader: { backgroundColor: colors.emerald600, color: colors.white, fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 700 },
        tableRow: { borderBottom: `1px solid ${colors.emerald50}` },
        totalWrapper: { backgroundColor: colors.slate50, padding: '24px', borderRadius: '12px', width: '288px', marginLeft: 'auto' },
        totalLabel: { color: colors.slate500, fontWeight: 500 },
        totalValue: { fontSize: '24px', fontWeight: 700, color: colors.emerald600 },
    },
    professional: {
        container: { backgroundColor: colors.white, color: colors.slate900, fontFamily: 'system-ui, sans-serif' },
        headerWrapper: { backgroundColor: colors.slate900, color: colors.white, padding: '40px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        header: { textAlign: 'right' as const },
        title: { fontSize: '28px', fontWeight: 700, color: colors.slate100, textTransform: 'uppercase' as const, letterSpacing: '0.1em' },
        meta: { color: colors.slate300, fontSize: '14px', fontWeight: 500, marginTop: '4px' },
        billTo: { paddingLeft: '16px', borderLeft: `4px solid ${colors.slate900}`, marginBottom: '40px' },
        tableHeader: { backgroundColor: colors.slate100, color: colors.slate900, fontSize: '12px', textTransform: 'uppercase' as const, fontWeight: 700, borderTop: `2px solid ${colors.slate900}`, borderBottom: `2px solid ${colors.slate900}` },
        tableRow: { borderBottom: `1px solid ${colors.slate200}` },
        totalWrapper: { borderTop: `2px solid ${colors.slate900}`, paddingTop: '16px', width: '288px', marginLeft: 'auto' },
        totalLabel: { color: colors.slate600, fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' as const },
        totalValue: { fontSize: '28px', fontWeight: 900, color: colors.slate900 },
    },
    creative: {
        container: { backgroundColor: colors.white, color: colors.slate800, fontFamily: 'system-ui, sans-serif' },
        headerWrapper: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px' },
        header: { textAlign: 'left' as const },
        title: { fontSize: '40px', fontWeight: 900, background: `linear-gradient(135deg, ${colors.purple600}, ${colors.pink600})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '8px' },
        meta: { fontSize: '18px', fontWeight: 300, color: colors.slate500 },
        billTo: { background: `linear-gradient(135deg, ${colors.purple50}, ${colors.pink600}20)`, padding: '24px', borderRadius: '16px', marginBottom: '40px', border: `1px solid ${colors.purple100}` },
        tableHeader: { color: colors.purple700, fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 700, opacity: 0.5 },
        tableRow: { backgroundColor: colors.white, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px', marginBottom: '8px' },
        totalWrapper: { background: `linear-gradient(135deg, ${colors.purple600}, ${colors.pink600})`, color: colors.white, padding: '24px', borderRadius: '16px', width: '320px', marginLeft: 'auto', transform: 'rotate(1deg)' },
        totalLabel: { color: colors.purple100, fontWeight: 500 },
        totalValue: { fontSize: '28px', fontWeight: 700, color: colors.white },
    },
    classic: {
        container: { backgroundColor: '#fffdf5', color: colors.slate900, fontFamily: 'Georgia, serif' },
        headerWrapper: { textAlign: 'center' as const, marginBottom: '48px', borderBottom: `4px double ${colors.slate800}`, paddingBottom: '32px' },
        header: { marginTop: '16px' },
        title: { fontSize: '32px', fontWeight: 700, color: colors.slate900, textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '16px' },
        meta: { color: colors.slate600, fontSize: '18px', fontStyle: 'italic' as const },
        billTo: { marginBottom: '40px', textAlign: 'center' as const, border: `2px solid ${colors.slate200}`, padding: '24px', maxWidth: '512px', margin: '0 auto 40px', backgroundColor: 'rgba(255,255,255,0.5)' },
        tableHeader: { backgroundColor: colors.slate800, color: '#fffdf5', textTransform: 'uppercase' as const, letterSpacing: '0.1em', padding: '16px' },
        tableRow: { borderBottom: `1px solid ${colors.slate300}` },
        totalWrapper: { marginTop: '32px', borderTop: `4px double ${colors.slate800}`, paddingTop: '16px', textAlign: 'right' as const },
        totalLabel: { color: colors.slate600, fontStyle: 'italic' as const, fontSize: '20px' },
        totalValue: { fontSize: '32px', fontWeight: 700, color: colors.slate900, textDecoration: 'underline double' },
    },
    elegant: {
        container: { backgroundColor: colors.white, color: colors.slate800, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.025em' },
        headerWrapper: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '64px', alignItems: 'center' },
        header: { textAlign: 'left' as const, borderLeft: `2px solid ${colors.amber400}`, paddingLeft: '24px' },
        title: { fontSize: '20px', fontWeight: 300, color: colors.slate400, textTransform: 'uppercase' as const, letterSpacing: '0.3em', marginBottom: '8px' },
        meta: { color: colors.slate500, fontWeight: 300 },
        billTo: { paddingBottom: '32px', borderBottom: `1px solid ${colors.slate100}`, marginBottom: '40px' },
        tableHeader: { color: colors.amber400, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', paddingBottom: '16px', borderBottom: `1px solid ${colors.amber400}20` },
        tableRow: { borderBottom: `1px solid ${colors.slate50}` },
        totalWrapper: { backgroundColor: colors.slate900, color: colors.white, padding: '32px', marginTop: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        totalLabel: { color: colors.amber400, fontSize: '14px', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.1em' },
        totalValue: { fontSize: '32px', fontWeight: 300, color: colors.white },
    },
    dark: {
        container: { backgroundColor: colors.neutral950, color: colors.slate100, fontFamily: 'system-ui, sans-serif' },
        headerWrapper: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '48px', borderBottom: `1px solid ${colors.neutral800}`, paddingBottom: '32px' },
        header: { textAlign: 'right' as const },
        title: { fontSize: '40px', fontWeight: 700, color: colors.white, letterSpacing: '-0.025em', marginBottom: '8px' },
        meta: { color: colors.slate400, fontSize: '14px', fontFamily: 'monospace' },
        billTo: { backgroundColor: `${colors.neutral900}80`, padding: '24px', borderRadius: '12px', border: `1px solid ${colors.neutral800}`, marginBottom: '40px' },
        tableHeader: { color: colors.slate500, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', paddingBottom: '16px' },
        tableRow: { borderBottom: `1px solid ${colors.neutral900}` },
        totalWrapper: { backgroundColor: colors.lime400, color: colors.black, padding: '24px', borderRadius: '12px', width: '288px', marginLeft: 'auto', marginTop: '32px' },
        totalLabel: { color: colors.slate800, fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' as const },
        totalValue: { fontSize: '28px', fontWeight: 900, color: colors.black },
    },
};

const statusWatermarks: Record<string, string> = {
    draft: "DRAFT",
    sent: "TERKIRIM",
    paid: "LUNAS",
    cancelled: "BATAL",
};

export function PrintableInvoice({ invoice, template }: PrintableInvoiceProps) {
    const config = templateConfigs[template];
    const showWatermark = invoice.status !== "draft";

    return (
        <div style={{
            ...config.container,
            position: 'relative',
            width: '794px',
            minHeight: '1123px',
            padding: '40px',
            overflow: 'hidden',
            boxSizing: 'border-box'
        }}>
            {/* Watermark */}
            {showWatermark && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}>
                    <span style={{
                        fontSize: '128px',
                        fontWeight: 700,
                        transform: 'rotate(-12deg)',
                        opacity: 0.05,
                        userSelect: 'none',
                    }}>
                        {statusWatermarks[invoice.status]}
                    </span>
                </div>
            )}

            <div style={{ position: 'relative', zIndex: 10 }}>
                {/* Header */}
                <div style={config.headerWrapper}>
                    <div style={{ width: '96px', height: '96px', borderRadius: '16px', overflow: 'hidden' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/profile.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={config.header}>
                        <h1 style={config.title}>INVOICE</h1>
                        <div style={config.meta}>
                            <p><span style={{ opacity: 0.6 }}>No.</span> {invoice.invoice_number}</p>
                            <p><span style={{ opacity: 0.6 }}>Tanggal:</span> {formatDate(invoice.invoice_date)}</p>
                            {invoice.due_date && (
                                <p style={{ color: colors.red500 }}>
                                    <span style={{ opacity: 0.6 }}>Jatuh Tempo:</span> {formatDate(invoice.due_date)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* From/To */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '40px' }}>
                    <div>
                        <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.4, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dari</p>
                        <h3 style={{ fontWeight: 700, fontSize: '18px', marginBottom: '4px' }}>InfoLokerJombang</h3>
                        <p style={{ opacity: 0.7, fontSize: '14px' }}>@infolokerjombang</p>
                        <p style={{ opacity: 0.7, fontSize: '14px' }}>Jombang, Jawa Timur</p>
                    </div>
                    <div style={config.billTo}>
                        <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.4, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kepada</p>
                        <h3 style={{ fontWeight: 700, fontSize: '18px', marginBottom: '4px' }}>{invoice.client_name || "Nama Klien"}</h3>
                        {invoice.client_phone && <p style={{ opacity: 0.7, fontSize: '14px' }}>{invoice.client_phone}</p>}
                        {invoice.client_address && <p style={{ opacity: 0.7, fontSize: '14px', marginTop: '4px' }}>{invoice.client_address}</p>}
                    </div>
                </div>

                {/* Items Table */}
                <div style={{ marginBottom: '32px', minHeight: '200px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ ...config.tableHeader, textAlign: 'left', padding: '16px' }}>Deskripsi</th>
                                <th style={{ ...config.tableHeader, textAlign: 'center', padding: '16px', width: '96px' }}>Qty</th>
                                <th style={{ ...config.tableHeader, textAlign: 'right', padding: '16px', width: '160px' }}>Harga</th>
                                <th style={{ ...config.tableHeader, textAlign: 'right', padding: '16px', width: '160px' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.items.map((item, idx) => (
                                <tr key={idx} style={config.tableRow}>
                                    <td style={{ padding: '16px', fontWeight: 500 }}>{item.description || "Deskripsi Item..."}</td>
                                    <td style={{ padding: '16px', textAlign: 'center', opacity: 0.8 }}>{item.quantity}</td>
                                    <td style={{ padding: '16px', textAlign: 'right', opacity: 0.8 }}>{formatRupiah(item.price)}</td>
                                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: 700, width: '160px' }}>
                                        {formatRupiah(item.quantity * item.price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'flex-start', marginTop: '32px' }}>
                    {/* Left: Bank Info & Notes */}
                    <div>
                        {invoice.bank_name && (
                            <div style={{ padding: '20px', borderRadius: '12px', border: '1px dashed rgba(0,0,0,0.2)', backgroundColor: 'rgba(0,0,0,0.02)', marginBottom: '24px' }}>
                                <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.5, marginBottom: '12px', textTransform: 'uppercase' }}>Pembayaran</p>
                                <p style={{ fontWeight: 700, fontSize: '18px' }}>{invoice.bank_name}</p>
                                <p style={{ fontFamily: 'monospace', fontSize: '20px', letterSpacing: '0.05em' }}>{invoice.bank_account_number}</p>
                                <p style={{ fontSize: '14px', opacity: 0.7 }}>a.n. {invoice.bank_account_name}</p>
                            </div>
                        )}

                        {invoice.notes && (
                            <div style={{ opacity: 0.7, fontSize: '14px' }}>
                                <p style={{ fontWeight: 700, marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>Catatan</p>
                                <p style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>{invoice.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Totals */}
                    <div>
                        <div style={config.totalWrapper}>
                            <div style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', marginBottom: '8px' }}>
                                    <span style={{ opacity: 0.7 }}>Subtotal</span>
                                    <span style={{ fontWeight: 600 }}>{formatRupiah(invoice.subtotal)}</span>
                                </div>
                                {invoice.discount_amount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: colors.red500, marginBottom: '8px' }}>
                                        <span>Diskon {invoice.discount_type === "percent" ? `(${invoice.discount_value}%)` : ""}</span>
                                        <span>-{formatRupiah(invoice.discount_amount)}</span>
                                    </div>
                                )}
                                {invoice.tax_enabled && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', marginBottom: '8px' }}>
                                        <span style={{ opacity: 0.7 }}>PPN ({invoice.tax_percent}%)</span>
                                        <span>{formatRupiah(invoice.tax_amount)}</span>
                                    </div>
                                )}
                                <div style={{ paddingTop: '16px', marginTop: '8px', borderTop: '1px solid rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <span style={config.totalLabel}>Total Tagihan</span>
                                    <span style={config.totalValue}>{formatRupiah(invoice.total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Message */}
                <div style={{ color: colors.slate400, fontSize: '12px', marginTop: '48px', paddingTop: '32px', borderTop: `1px solid ${colors.slate100}`, textAlign: 'center' }}>
                    <p>Terima kasih atas kepercayaan Anda bekerja sama dengan InfoLokerJombang.</p>
                </div>
            </div>
        </div>
    );
}
