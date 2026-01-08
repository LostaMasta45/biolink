"use client";

import { formatRupiah, formatDate } from "@/lib/utils";
import type { InvoiceData, InvoiceTemplate, InvoiceColorTheme } from "@/lib/invoice-types";

interface PrintableInvoiceProps {
    invoice: InvoiceData;
    template: InvoiceTemplate;
}

// Hex color palette system
const THEME_PALETTES: Record<InvoiceColorTheme, {
    primary: string;
    secondary: string;
    accent: string;
    light: string;
    dark: string;
    text: string;
}> = {
    default: { primary: '#059669', secondary: '#10b981', accent: '#34d399', light: '#ecfdf5', dark: '#064e3b', text: '#059669' }, // Emerald
    blue: { primary: '#2563eb', secondary: '#3b82f6', accent: '#60a5fa', light: '#eff6ff', dark: '#1e3a8a', text: '#2563eb' },
    green: { primary: '#059669', secondary: '#10b981', accent: '#34d399', light: '#ecfdf5', dark: '#064e3b', text: '#059669' },
    purple: { primary: '#9333ea', secondary: '#a855f7', accent: '#c084fc', light: '#faf5ff', dark: '#581c87', text: '#9333ea' },
    red: { primary: '#dc2626', secondary: '#ef4444', accent: '#f87171', light: '#fef2f2', dark: '#7f1d1d', text: '#dc2626' },
    orange: { primary: '#ea580c', secondary: '#f97316', accent: '#fb923c', light: '#fff7ed', dark: '#7c2d12', text: '#ea580c' },
    pink: { primary: '#db2777', secondary: '#ec4899', accent: '#f472b6', light: '#fdf2f8', dark: '#831843', text: '#db2777' },
    indigo: { primary: '#4f46e5', secondary: '#6366f1', accent: '#818cf8', light: '#eef2ff', dark: '#312e81', text: '#4f46e5' },
    slate: { primary: '#1e293b', secondary: '#334155', accent: '#475569', light: '#f8fafc', dark: '#0f172a', text: '#1e293b' },
};

// Base colors
const colors = {
    white: '#ffffff',
    black: '#000000',
    slate50: '#f8fafc',
    slate100: '#f1f5f9',
    slate200: '#e2e8f0',
    slate300: '#cbd5e1',
    slate400: '#94a3b8',
    slate500: '#64748b',
    slate900: '#0f172a',
};

type TemplateConfig = {
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
};

const getTemplateConfig = (template: InvoiceTemplate, themeKey: InvoiceColorTheme = 'default'): TemplateConfig => {
    const palette = THEME_PALETTES[themeKey];

    const configs: Record<InvoiceTemplate, TemplateConfig> = {
        modern: {
            container: { backgroundColor: colors.white, color: colors.slate900, fontFamily: 'system-ui, sans-serif' },
            headerWrapper: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px', borderBottom: `1px solid ${palette.light}`, paddingBottom: '32px' },
            header: { textAlign: 'right' as const },
            title: { fontSize: '32px', fontWeight: 800, color: palette.primary, textTransform: 'uppercase' as const, letterSpacing: '-0.025em' },
            meta: { color: colors.slate500, fontSize: '14px', fontWeight: 500, marginTop: '8px' },
            billTo: { backgroundColor: palette.light, padding: '24px', borderRadius: '12px', border: `1px solid ${palette.secondary}20`, marginBottom: '40px' },
            tableHeader: { backgroundColor: palette.primary, color: colors.white, fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 700, padding: '16px' },
            tableRow: { borderBottom: `1px solid ${palette.light}` },
            totalWrapper: { backgroundColor: colors.slate50, padding: '32px', borderRadius: '16px', width: '384px', marginLeft: 'auto' },
            totalLabel: { color: colors.slate500, fontWeight: 500, fontSize: '14px', letterSpacing: '0.05em' },
            totalValue: { fontSize: '36px', fontWeight: 700, color: palette.text, lineHeight: 1 },
        },
        professional: {
            container: { backgroundColor: colors.white, color: colors.slate900, fontFamily: 'system-ui, sans-serif' },
            headerWrapper: { backgroundColor: palette.dark, color: colors.white, padding: '40px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
            header: { textAlign: 'right' as const },
            title: { fontSize: '28px', fontWeight: 700, color: colors.white, textTransform: 'uppercase' as const, letterSpacing: '0.1em' },
            meta: { color: colors.slate300, fontSize: '14px', fontWeight: 500, marginTop: '4px' },
            billTo: { paddingLeft: '16px', borderLeft: `4px solid ${palette.dark}`, marginBottom: '40px' },
            tableHeader: { backgroundColor: colors.slate100, color: colors.slate900, fontSize: '12px', textTransform: 'uppercase' as const, fontWeight: 700, borderTop: `2px solid ${palette.dark}`, borderBottom: `2px solid ${palette.dark}`, padding: '16px' },
            tableRow: { borderBottom: `1px solid ${colors.slate200}` },
            totalWrapper: { borderTop: `2px solid ${palette.dark}`, paddingTop: '32px', width: '384px', marginLeft: 'auto' },
            totalLabel: { color: colors.slate500, fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.1em' },
            totalValue: { fontSize: '36px', fontWeight: 900, color: colors.slate900 },
        },
        creative: {
            container: { backgroundColor: colors.white, color: colors.slate900, fontFamily: 'system-ui, sans-serif' },
            headerWrapper: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px' },
            header: { textAlign: 'left' as const },
            title: { fontSize: '40px', fontWeight: 900, background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '8px', color: palette.primary },
            meta: { fontSize: '18px', fontWeight: 300, color: colors.slate500 },
            billTo: { background: `linear-gradient(135deg, ${palette.light}, ${palette.secondary}10)`, padding: '24px', borderRadius: '16px', marginBottom: '40px', border: `1px solid ${palette.secondary}20` },
            tableHeader: { color: palette.dark, fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 700, opacity: 0.7, padding: '16px' },
            tableRow: { backgroundColor: colors.white, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderRadius: '8px', marginBottom: '8px' },
            totalWrapper: { background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`, color: colors.white, padding: '24px', borderRadius: '16px', width: '320px', marginLeft: 'auto', transform: 'rotate(1deg)' },
            totalLabel: { color: colors.white, fontWeight: 500, opacity: 0.9 },
            totalValue: { fontSize: '28px', fontWeight: 700, color: colors.white },
        },
        classic: {
            container: { backgroundColor: '#fffdf5', color: colors.slate900, fontFamily: 'Georgia, serif' },
            headerWrapper: { textAlign: 'center' as const, marginBottom: '48px', borderBottom: `4px double ${colors.slate900}`, paddingBottom: '32px' },
            header: { marginTop: '16px' },
            title: { fontSize: '32px', fontWeight: 700, color: colors.slate900, textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '16px' },
            meta: { color: colors.slate500, fontSize: '18px', fontStyle: 'italic' as const },
            billTo: { marginBottom: '40px', textAlign: 'center' as const, border: `2px solid ${colors.slate200}`, padding: '24px', maxWidth: '512px', margin: '0 auto 40px', backgroundColor: 'rgba(255,255,255,0.5)' },
            tableHeader: { backgroundColor: colors.slate900, color: '#fffdf5', textTransform: 'uppercase' as const, letterSpacing: '0.1em', padding: '16px' },
            tableRow: { borderBottom: `1px solid ${colors.slate300}` },
            totalWrapper: { marginTop: '32px', borderTop: `4px double ${colors.slate900}`, paddingTop: '16px', textAlign: 'right' as const },
            totalLabel: { color: colors.slate500, fontStyle: 'italic' as const, fontSize: '20px' },
            totalValue: { fontSize: '32px', fontWeight: 700, color: colors.slate900, textDecoration: 'underline double' },
        },
        elegant: {
            container: { backgroundColor: colors.white, color: colors.slate900, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.025em' },
            headerWrapper: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '64px', alignItems: 'center' },
            header: { textAlign: 'left' as const, borderLeft: `2px solid ${palette.accent}`, paddingLeft: '24px' },
            title: { fontSize: '20px', fontWeight: 300, color: colors.slate400, textTransform: 'uppercase' as const, letterSpacing: '0.3em', marginBottom: '8px' },
            meta: { color: colors.slate500, fontWeight: 300 },
            billTo: { paddingBottom: '32px', borderBottom: `1px solid ${colors.slate100}`, marginBottom: '40px' },
            tableHeader: { color: palette.primary, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', padding: '16px', borderBottom: `1px solid ${palette.primary}30` },
            tableRow: { borderBottom: `1px solid ${colors.slate50}` },
            totalWrapper: { backgroundColor: colors.slate900, color: colors.white, padding: '48px', marginTop: '64px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
            totalLabel: { color: palette.accent, fontSize: '14px', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.25em' },
            totalValue: { fontSize: '40px', fontWeight: 300, color: colors.white },
        },
        dark: {
            container: { backgroundColor: '#0a0a0a', color: colors.slate100, fontFamily: 'system-ui, sans-serif' },
            headerWrapper: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '48px', borderBottom: `1px solid ${colors.slate900}`, paddingBottom: '32px' },
            header: { textAlign: 'right' as const },
            title: { fontSize: '40px', fontWeight: 700, color: colors.white, letterSpacing: '-0.025em', marginBottom: '8px' },
            meta: { color: colors.slate400, fontSize: '14px', fontFamily: 'monospace' },
            billTo: { backgroundColor: '#171717', padding: '24px', borderRadius: '12px', border: `1px solid ${colors.slate900}`, marginBottom: '40px' },
            tableHeader: { color: colors.slate500, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '16px' },
            tableRow: { borderBottom: `1px solid ${colors.slate900}` },
            totalWrapper: { backgroundColor: palette.accent, color: colors.black, padding: '32px', borderRadius: '16px', width: '384px', marginLeft: 'auto', marginTop: '64px' },
            totalLabel: { color: colors.slate900, fontWeight: 800, fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.1em' },
            totalValue: { fontSize: '42px', fontWeight: 900, color: colors.black },
        },
        minimalist: {
            container: { backgroundColor: colors.white, color: colors.slate900, fontFamily: 'system-ui, sans-serif' },
            headerWrapper: { textAlign: 'center' as const, marginBottom: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
            header: { marginTop: '24px', textAlign: 'center' as const },
            title: { fontSize: '18px', fontWeight: 500, letterSpacing: '0.2em', color: colors.slate400, textTransform: 'uppercase' as const, marginTop: '16px', marginBottom: '8px' },
            meta: { color: colors.slate500, fontSize: '14px', fontWeight: 300 },
            billTo: { textAlign: 'center' as const, marginBottom: '64px', maxWidth: '448px', margin: '0 auto 64px' },
            tableHeader: { color: colors.slate400, fontWeight: 500, fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '16px', borderBottom: `1px solid ${colors.slate100}` },
            tableRow: { borderBottom: `1px solid ${colors.slate50}` },
            totalWrapper: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '32px', borderTop: `1px solid ${colors.slate100}`, marginTop: '32px' },
            totalLabel: { color: colors.slate500, fontWeight: 500 },
            totalValue: { fontSize: '36px', fontWeight: 300, color: palette.text },
        },
        bold: {
            container: { backgroundColor: colors.white, color: colors.black, fontFamily: 'system-ui, sans-serif' },
            headerWrapper: { backgroundColor: palette.dark, color: colors.white, padding: '48px', margin: '-40px -40px 48px', position: 'relative' },
            header: { marginTop: '16px', position: 'relative', zIndex: 10 },
            title: { fontSize: '72px', fontWeight: 900, color: colors.white, opacity: 0.2, position: 'absolute', top: '16px', right: '40px', letterSpacing: '-0.05em', margin: 0 },
            meta: { color: 'rgba(255,255,255,0.8)', fontSize: '18px', fontWeight: 500 },
            billTo: { borderLeft: `6px solid ${palette.primary}`, paddingLeft: '24px', marginBottom: '48px' },
            tableHeader: { fontSize: '18px', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '-0.025em', padding: '16px', borderBottom: `4px solid ${colors.black}` },
            tableRow: { borderBottom: `1px solid ${colors.black}`, fontSize: '18px', fontWeight: 700 },
            totalWrapper: { backgroundColor: colors.black, color: colors.white, padding: '40px', marginTop: '48px', textAlign: 'right' as const },
            totalLabel: { color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.2em', fontSize: '14px', display: 'block', marginBottom: '8px' },
            totalValue: { fontSize: '64px', fontWeight: 900, letterSpacing: '-0.025em' },
        },
        tech: {
            container: { backgroundColor: colors.slate50, color: colors.slate900, fontFamily: 'monospace' },
            headerWrapper: { borderBottom: `1px dashed ${palette.primary}`, paddingBottom: '32px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
            header: { textAlign: 'right' as const },
            title: { fontSize: '24px', fontWeight: 700, color: palette.primary, marginBottom: '8px' },
            meta: { fontSize: '12px', color: colors.slate500 },
            billTo: { backgroundColor: colors.white, border: `1px solid ${colors.slate200}`, padding: '16px', marginBottom: '32px', fontSize: '14px' },
            tableHeader: { backgroundColor: colors.slate200, color: colors.slate900, fontWeight: 700, padding: '8px', textAlign: 'left' as const },
            tableRow: { borderBottom: `1px dashed ${colors.slate300}`, backgroundColor: 'rgba(255,255,255,0.5)' },
            totalWrapper: { border: `1px solid ${colors.slate300}`, backgroundColor: colors.white, padding: '32px', width: '320px', marginLeft: 'auto', marginTop: '48px', borderLeft: `8px solid ${palette.primary}` },
            totalLabel: { fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' as const, color: colors.slate500, display: 'block', marginBottom: '8px', letterSpacing: '0.05em' },
            totalValue: { fontSize: '32px', fontWeight: 700, color: palette.text },
        },
        geometric: {
            container: { backgroundColor: colors.white, color: colors.slate900, fontFamily: 'system-ui, sans-serif' },
            headerWrapper: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '64px', position: 'relative', zIndex: 10 },
            header: { textAlign: 'right' as const },
            title: { fontSize: '36px', fontWeight: 700, color: palette.primary, marginBottom: '8px' },
            meta: { color: colors.slate500, fontWeight: 500, marginTop: '8px' },
            billTo: { position: 'relative', zIndex: 10, backgroundColor: colors.slate50, padding: '32px', borderTopRightRadius: '48px', borderLeft: `8px solid ${palette.primary}`, marginBottom: '48px' },
            tableHeader: { color: palette.primary, fontSize: '14px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', padding: '16px 16px 24px 16px', borderBottom: `2px solid ${palette.primary}`, marginBottom: '16px' },
            tableRow: { borderBottom: `1px solid ${colors.slate100}`, padding: '16px 0' },
            totalWrapper: { position: 'relative', zIndex: 10, backgroundColor: palette.primary, color: colors.white, padding: '48px', borderTopLeftRadius: '64px', width: '448px', marginLeft: 'auto', marginTop: '64px' },
            totalLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.15em', fontSize: '14px', display: 'block', marginBottom: '8px' },
            totalValue: { fontSize: '48px', fontWeight: 700 },
        },
    };

    return configs[template];
};

const statusWatermarks: Record<string, string> = {
    draft: "DRAFT",
    sent: "TERKIRIM",
    paid: "LUNAS",
    cancelled: "BATAL",
};

export function PrintableInvoice({ invoice, template }: PrintableInvoiceProps) {
    const config = getTemplateConfig(template, invoice.color_theme || "default");
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
                        color: 'currentColor'
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
                        {template !== 'bold' && template !== 'geometric' && (
                            <div style={config.meta}>
                                <p><span style={{ opacity: 0.6 }}>No.</span> {invoice.invoice_number}</p>
                                <p><span style={{ opacity: 0.6 }}>Tanggal:</span> {formatDate(invoice.invoice_date)}</p>
                                {invoice.due_date && (
                                    <p style={{ color: '#ef4444' }}>
                                        <span style={{ opacity: 0.6, color: 'inherit' }}>Jatuh Tempo:</span> {formatDate(invoice.due_date)}
                                    </p>
                                )}
                            </div>
                        )}
                        {(template === 'bold' || template === 'geometric') && (
                            <div style={config.meta}>
                                <p style={{ fontSize: '24px', fontWeight: 700 }}>{invoice.invoice_number}</p>
                                <p>{formatDate(invoice.invoice_date)}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* From/To */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '40px' }}>
                    <div>
                        <p style={{ fontSize: '12px', fontWeight: 700, opacity: 0.4, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dari</p>
                        <h3 style={{ fontWeight: 700, fontSize: '18px', marginBottom: '4px' }}>{invoice.sender_name || "InfoLokerJombang"}</h3>
                        <p style={{ opacity: 0.7, fontSize: '14px' }}>{invoice.sender_contact || "@infolokerjombang"}</p>
                        <p style={{ opacity: 0.7, fontSize: '14px' }}>{invoice.sender_address || "Jombang, Jawa Timur"}</p>
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
                                <th style={{ ...config.tableHeader, textAlign: 'left' }}>Deskripsi</th>
                                <th style={{ ...config.tableHeader, textAlign: 'center', width: '96px' }}>Qty</th>
                                <th style={{ ...config.tableHeader, textAlign: 'right', width: '160px' }}>Harga</th>
                                <th style={{ ...config.tableHeader, textAlign: 'right', width: '160px' }}>Total</th>
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#ef4444', marginBottom: '8px' }}>
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
