"use client";

import { useState, useRef, useEffect } from "react";
import {
    Plus,
    Trash2,
    Download,
    Send,
    Building2,
    Phone,
    MapPin,
    Save,
    FileImage,
    File,
    Palette,
    Percent,
    CreditCard,
    Check,
    FileText,
    Settings,
    Eye,
    History,
    Pencil,
    X,
    Loader2,
    Hash,
} from "lucide-react";
import { formatRupiah, formatDate, generateInvoiceNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";

import type { InvoiceData, InvoiceItemData, InvoiceTemplate, InvoiceStatus, DiscountType, BankAccount } from "@/lib/invoice-types";
import { INVOICE_TEMPLATES, INVOICE_STATUSES } from "@/lib/invoice-types";
import { saveInvoice, getBankAccounts, getInvoices, getInvoiceById, deleteInvoice } from "@/lib/invoice-service";
import { InvoicePreview } from "@/components/invoice/invoice-preview";
import { PrintableInvoice } from "@/components/invoice/printable-invoice";


const defaultItems: InvoiceItemData[] = [
    { id: "1", description: "Posting Loker", quantity: 1, price: 50000 },
];

const defaultBankAccounts: BankAccount[] = [
    { id: "1", bank_name: "BCA", account_number: "1234567890", account_name: "InfoLokerJombang", is_default: true, created_at: "" },
    { id: "2", bank_name: "Mandiri", account_number: "0987654321", account_name: "InfoLokerJombang", is_default: false, created_at: "" },
    { id: "3", bank_name: "Dana", account_number: "081234567890", account_name: "InfoLokerJombang", is_default: false, created_at: "" },
];

export default function InvoicePage() {
    const invoiceRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const downloadRef = useRef<HTMLDivElement>(null);

    // Form state
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [clientAddress, setClientAddress] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
    const [dueDate, setDueDate] = useState("");
    const [items, setItems] = useState<InvoiceItemData[]>(defaultItems);
    const [notes, setNotes] = useState("Pembayaran via Transfer BCA/Dana/GoPay\nKonfirmasi ke WhatsApp Admin setelah transfer.");

    // Invoice number - now editable
    const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber(1));
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

    // Template & Status
    const [template, setTemplate] = useState<InvoiceTemplate>("modern");
    const [status, setStatus] = useState<InvoiceStatus>("draft");

    // Discount & Tax
    const [discountType, setDiscountType] = useState<DiscountType>("nominal");
    const [discountValue, setDiscountValue] = useState(0);
    const [taxEnabled, setTaxEnabled] = useState(false);
    const [taxPercent, setTaxPercent] = useState(11);

    // Bank Account - with toggle
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(defaultBankAccounts);
    const [selectedBank, setSelectedBank] = useState<BankAccount | null>(defaultBankAccounts[0]);
    const [showBankAccount, setShowBankAccount] = useState(true);

    // UI states
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("form");

    // History states
    const [invoices, setInvoices] = useState<InvoiceData[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [previewInvoice, setPreviewInvoice] = useState<InvoiceData | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadBankAccounts();
    }, []);

    // Load history when tab changes
    useEffect(() => {
        if (activeTab === "history") {
            loadInvoices();
        }
    }, [activeTab]);

    const loadBankAccounts = async () => {
        const { data } = await getBankAccounts();
        if (data.length > 0) {
            setBankAccounts(data);
            const defaultBank = data.find(b => b.is_default) || data[0];
            setSelectedBank(defaultBank);
        }
    };

    const loadInvoices = async () => {
        setIsLoadingHistory(true);
        const { data, error } = await getInvoices();
        setIsLoadingHistory(false);

        if (error) {
            toast.error(`Gagal memuat histori: ${error}`);
        } else {
            setInvoices(data);
        }
    };

    // Calculations
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const discountAmount = discountType === "percent"
        ? (subtotal * discountValue / 100)
        : discountValue;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = taxEnabled ? (afterDiscount * taxPercent / 100) : 0;
    const total = afterDiscount + taxAmount;

    // Build invoice data object
    const invoiceData: InvoiceData = {
        id: editingInvoiceId || undefined,
        invoice_number: invoiceNumber,
        client_name: clientName,
        client_phone: clientPhone,
        client_address: clientAddress,
        invoice_date: invoiceDate,
        due_date: dueDate || undefined,
        items,
        subtotal,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        tax_enabled: taxEnabled,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        total,
        bank_name: showBankAccount ? selectedBank?.bank_name : undefined,
        bank_account_number: showBankAccount ? selectedBank?.account_number : undefined,
        bank_account_name: showBankAccount ? selectedBank?.account_name : undefined,
        template,
        status,
        notes,
    };

    const addItem = () => {
        setItems([...items, { id: Date.now().toString(), description: "", quantity: 1, price: 0 }]);
    };

    const removeItem = (id: string) => {
        if (items.length > 1) setItems(items.filter((item) => item.id !== id));
    };

    const updateItem = (id: string, field: keyof InvoiceItemData, value: string | number) => {
        setItems(items.map((item) => item.id === id ? { ...item, [field]: value } : item));
    };

    const resetForm = () => {
        setClientName("");
        setClientPhone("");
        setClientAddress("");
        setInvoiceDate(new Date().toISOString().split("T")[0]);
        setDueDate("");
        setItems(defaultItems);
        setNotes("Pembayaran via Transfer BCA/Dana/GoPay\nKonfirmasi ke WhatsApp Admin setelah transfer.");
        setInvoiceNumber(generateInvoiceNumber(Math.floor(Math.random() * 1000)));
        setEditingInvoiceId(null);
        setTemplate("modern");
        setStatus("draft");
        setDiscountType("nominal");
        setDiscountValue(0);
        setTaxEnabled(false);
        setTaxPercent(11);
        setShowBankAccount(true);
        const defaultBank = bankAccounts.find(b => b.is_default) || bankAccounts[0];
        setSelectedBank(defaultBank);
    };

    const handleSaveInvoice = async () => {
        if (!clientName.trim()) {
            toast.error("Nama klien harus diisi!");
            return;
        }

        setIsSaving(true);
        const { data, error } = await saveInvoice(invoiceData);
        setIsSaving(false);

        if (error) {
            toast.error(`Gagal menyimpan: ${error}`);
        } else {
            toast.success(editingInvoiceId ? "Invoice berhasil diupdate!" : "Invoice berhasil disimpan!");
            if (data?.id) {
                setEditingInvoiceId(data.id);
            }
            // Refresh history
            loadInvoices();
        }
    };

    const handleEditInvoice = async (id: string) => {
        const { data, error } = await getInvoiceById(id);

        if (error || !data) {
            toast.error(`Gagal memuat invoice: ${error}`);
            return;
        }

        // Load data into form
        setEditingInvoiceId(data.id || null);
        setInvoiceNumber(data.invoice_number);
        setClientName(data.client_name);
        setClientPhone(data.client_phone || "");
        setClientAddress(data.client_address || "");
        setInvoiceDate(data.invoice_date);
        setDueDate(data.due_date || "");
        setItems(data.items.length > 0 ? data.items : defaultItems);
        setNotes(data.notes || "");
        setTemplate(data.template);
        setStatus(data.status);
        setDiscountType(data.discount_type);
        setDiscountValue(data.discount_value);
        setTaxEnabled(data.tax_enabled);
        setTaxPercent(data.tax_percent);

        // Bank account
        if (data.bank_name) {
            setShowBankAccount(true);
            const matchedBank = bankAccounts.find(b => b.bank_name === data.bank_name);
            if (matchedBank) {
                setSelectedBank(matchedBank);
            }
        } else {
            setShowBankAccount(false);
        }

        // Switch to form tab
        setActiveTab("form");
        toast.success("Invoice dimuat untuk diedit");
    };

    const handleDeleteInvoice = async () => {
        if (!deleteConfirmId) return;

        setIsDeleting(true);
        const { error } = await deleteInvoice(deleteConfirmId);
        setIsDeleting(false);
        setDeleteConfirmId(null);

        if (error) {
            toast.error(`Gagal menghapus: ${error}`);
        } else {
            toast.success("Invoice berhasil dihapus!");
            // If deleting currently editing invoice, reset form
            if (editingInvoiceId === deleteConfirmId) {
                resetForm();
            }
            loadInvoices();
        }
    };

    const handlePreviewInvoice = async (id: string) => {
        const { data, error } = await getInvoiceById(id);
        if (error || !data) {
            toast.error(`Gagal memuat preview: ${error}`);
            return;
        }
        setPreviewInvoice(data);
    };

    const handleShareWhatsApp = () => {
        const message = `
*INVOICE ${invoiceNumber}*
Tanggal: ${formatDate(invoiceDate)}
${dueDate ? `Jatuh Tempo: ${formatDate(dueDate)}` : ""}

Kepada: ${clientName || "Pelanggan"}
${clientPhone ? `Telp: ${clientPhone}` : ""}

📋 *Detail:*
${items.map((item) => `- ${item.description}: ${item.quantity}x ${formatRupiah(item.price)} = ${formatRupiah(item.quantity * item.price)}`).join("\n")}

Subtotal: ${formatRupiah(subtotal)}
${discountAmount > 0 ? `Diskon: -${formatRupiah(discountAmount)}` : ""}
${taxEnabled ? `PPN (${taxPercent}%): ${formatRupiah(taxAmount)}` : ""}
💰 *Total: ${formatRupiah(total)}*

${showBankAccount && selectedBank ? `📌 *Transfer ke:*\n${selectedBank.bank_name} ${selectedBank.account_number}\na.n. ${selectedBank.account_name}` : ""}

${notes ? `📝 Catatan:\n${notes}` : ""}

---
InfoLokerJombang
    `.trim();

        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    };

    const handleDownload = async (format: "pdf" | "png" | "jpeg") => {
        const loadingToast = toast.loading("Generating...");

        try {
            // Generate pure HTML string for invoice (no external CSS dependencies)
            const generateInvoiceHTML = () => {
                const colors = {
                    emerald600: '#059669',
                    emerald50: '#ecfdf5',
                    emerald100: '#d1fae5',
                    slate50: '#f8fafc',
                    slate100: '#f1f5f9',
                    slate200: '#e2e8f0',
                    slate400: '#94a3b8',
                    slate500: '#64748b',
                    slate800: '#1e293b',
                    slate900: '#0f172a',
                    red500: '#ef4444',
                    white: '#ffffff',
                };

                const statusWatermarks: Record<string, string> = {
                    draft: "DRAFT", sent: "TERKIRIM", paid: "LUNAS", cancelled: "BATAL",
                };

                const showWatermark = status !== "draft";

                return `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body { 
                                font-family: system-ui, -apple-system, sans-serif;
                                background: ${colors.white};
                                color: ${colors.slate900};
                                width: 794px;
                                min-height: 1123px;
                            }
                            .container { padding: 40px; position: relative; }
                            .watermark {
                                position: absolute; inset: 0;
                                display: flex; align-items: center; justify-content: center;
                                pointer-events: none; z-index: 0;
                            }
                            .watermark span {
                                font-size: 128px; font-weight: 700;
                                transform: rotate(-12deg); opacity: 0.05;
                                color: ${colors.emerald600};
                            }
                            .content { position: relative; z-index: 10; }
                            .header {
                                display: flex; justify-content: space-between; align-items: flex-start;
                                margin-bottom: 48px; border-bottom: 1px solid ${colors.emerald100}; padding-bottom: 32px;
                            }
                            .logo { width: 96px; height: 96px; border-radius: 16px; overflow: hidden; }
                            .logo img { width: 100%; height: 100%; object-fit: cover; }
                            .title { font-size: 32px; font-weight: 800; color: ${colors.emerald600}; text-transform: uppercase; letter-spacing: -0.025em; }
                            .meta { color: ${colors.slate500}; font-size: 14px; font-weight: 500; margin-top: 8px; text-align: right; }
                            .meta p { margin: 4px 0; }
                            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-bottom: 40px; }
                            .from-label, .to-label { font-size: 12px; font-weight: 700; opacity: 0.4; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
                            .from-name, .to-name { font-weight: 700; font-size: 18px; margin-bottom: 4px; }
                            .info-sub { opacity: 0.7; font-size: 14px; }
                            .bill-to { background: ${colors.emerald50}; padding: 24px; border-radius: 12px; border: 1px solid ${colors.emerald100}; }
                            table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
                            th { background: ${colors.emerald600}; color: ${colors.white}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; padding: 16px; text-align: left; }
                            th.center { text-align: center; }
                            th.right { text-align: right; }
                            td { padding: 16px; border-bottom: 1px solid ${colors.emerald50}; }
                            td.center { text-align: center; opacity: 0.8; }
                            td.right { text-align: right; }
                            td.bold { font-weight: 700; }
                            .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 32px; }
                            .bank-box { padding: 20px; border-radius: 12px; border: 1px dashed rgba(0,0,0,0.2); background: rgba(0,0,0,0.02); margin-bottom: 24px; }
                            .bank-label { font-size: 12px; font-weight: 700; opacity: 0.5; margin-bottom: 12px; text-transform: uppercase; }
                            .bank-name { font-weight: 700; font-size: 18px; }
                            .bank-number { font-family: monospace; font-size: 20px; letter-spacing: 0.05em; }
                            .bank-holder { font-size: 14px; opacity: 0.7; }
                            .notes { opacity: 0.7; font-size: 14px; }
                            .notes-label { font-weight: 700; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; }
                            .notes-text { white-space: pre-line; line-height: 1.6; }
                            .totals { background: ${colors.slate50}; padding: 24px; border-radius: 12px; width: 288px; margin-left: auto; }
                            .total-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; margin-bottom: 8px; }
                            .total-row.discount { color: ${colors.red500}; }
                            .total-row span:first-child { opacity: 0.7; }
                            .total-row span:last-child { font-weight: 600; }
                            .grand-total { padding-top: 16px; margin-top: 8px; border-top: 1px solid rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: flex-end; }
                            .grand-label { color: ${colors.slate500}; font-weight: 500; }
                            .grand-value { font-size: 24px; font-weight: 700; color: ${colors.emerald600}; }
                            .footer-msg { color: ${colors.slate400}; font-size: 12px; margin-top: 48px; padding-top: 32px; border-top: 1px solid ${colors.slate100}; text-align: center; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            ${showWatermark ? `<div class="watermark"><span>${statusWatermarks[status]}</span></div>` : ''}
                            <div class="content">
                                <div class="header">
                                    <div class="logo">
                                        <img src="/profile.png" alt="Logo" />
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="title">INVOICE</div>
                                        <div class="meta">
                                            <p><span style="opacity: 0.6;">No.</span> ${invoiceNumber}</p>
                                            <p><span style="opacity: 0.6;">Tanggal:</span> ${formatDate(invoiceDate)}</p>
                                            ${dueDate ? `<p style="color: ${colors.red500};"><span style="opacity: 0.6;">Jatuh Tempo:</span> ${formatDate(dueDate)}</p>` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="info-grid">
                                    <div>
                                        <div class="from-label">Dari</div>
                                        <div class="from-name">InfoLokerJombang</div>
                                        <div class="info-sub">@infolokerjombang</div>
                                        <div class="info-sub">Jombang, Jawa Timur</div>
                                    </div>
                                    <div class="bill-to">
                                        <div class="to-label">Kepada</div>
                                        <div class="to-name">${clientName || "Nama Klien"}</div>
                                        ${clientPhone ? `<div class="info-sub">${clientPhone}</div>` : ''}
                                        ${clientAddress ? `<div class="info-sub" style="margin-top: 4px;">${clientAddress}</div>` : ''}
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
                                        ${items.map(item => `
                                            <tr>
                                                <td class="bold">${item.description || "Deskripsi Item..."}</td>
                                                <td class="center">${item.quantity}</td>
                                                <td class="right">${formatRupiah(item.price)}</td>
                                                <td class="right bold">${formatRupiah(item.quantity * item.price)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                                <div class="footer-grid">
                                    <div>
                                        ${showBankAccount && selectedBank ? `
                                            <div class="bank-box">
                                                <div class="bank-label">Pembayaran</div>
                                                <div class="bank-name">${selectedBank.bank_name}</div>
                                                <div class="bank-number">${selectedBank.account_number}</div>
                                                <div class="bank-holder">a.n. ${selectedBank.account_name}</div>
                                            </div>
                                        ` : ''}
                                        ${notes ? `
                                            <div class="notes">
                                                <div class="notes-label">Catatan</div>
                                                <div class="notes-text">${notes}</div>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div>
                                        <div class="totals">
                                            <div class="total-row">
                                                <span>Subtotal</span>
                                                <span>${formatRupiah(subtotal)}</span>
                                            </div>
                                            ${discountAmount > 0 ? `
                                                <div class="total-row discount">
                                                    <span>Diskon ${discountType === "percent" ? `(${discountValue}%)` : ""}</span>
                                                    <span>-${formatRupiah(discountAmount)}</span>
                                                </div>
                                            ` : ''}
                                            ${taxEnabled ? `
                                                <div class="total-row">
                                                    <span>PPN (${taxPercent}%)</span>
                                                    <span>${formatRupiah(taxAmount)}</span>
                                                </div>
                                            ` : ''}
                                            <div class="grand-total">
                                                <span class="grand-label">Total Tagihan</span>
                                                <span class="grand-value">${formatRupiah(total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="footer-msg">
                                    Terima kasih atas kepercayaan Anda bekerja sama dengan InfoLokerJombang.
                                </div>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
            };

            // Create isolated iframe
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

            // Write pure HTML to iframe (completely isolated from parent CSS)
            iframeDoc.open();
            iframeDoc.write(generateInvoiceHTML());
            iframeDoc.close();

            // Wait for iframe content to render (including image)
            await new Promise(resolve => setTimeout(resolve, 500));

            // Generate canvas from iframe body
            const canvas = await html2canvas(iframeDoc.body, {
                scale: 2,
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false,
                allowTaint: true,
                width: 794,
            });

            // Clean up iframe
            document.body.removeChild(iframe);

            if (format === "pdf") {
                const imgData = canvas.toDataURL("image/png");
                const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                const imgWidth = 210;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
                pdf.save(`invoice-${invoiceNumber}.pdf`);
            } else {
                const link = document.createElement("a");
                link.download = `invoice-${invoiceNumber}.${format === "jpeg" ? "jpg" : "png"}`;
                link.href = canvas.toDataURL(format === "jpeg" ? "image/jpeg" : "image/png", 0.95);
                link.click();
            }

            toast.dismiss(loadingToast);
            toast.success("Download berhasil!");
        } catch (err) {
            console.error("Download error:", err);
            toast.dismiss(loadingToast);
            toast.error("Gagal generate file. Coba lagi.");
        }
    };

    const getStatusBadge = (invoiceStatus: InvoiceStatus) => {
        const statusConfig = INVOICE_STATUSES.find(s => s.id === invoiceStatus);
        return statusConfig ? (
            <Badge className={statusConfig.color}>{statusConfig.name}</Badge>
        ) : (
            <Badge>{invoiceStatus}</Badge>
        );
    };

    return (
        <div className="space-y-6 pb-48 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Invoice Generator</h1>
                    <p className="text-muted-foreground">Buat invoice profesional dengan berbagai template</p>
                </div>
                <div className="hidden md:flex items-center gap-2">
                    {editingInvoiceId && (
                        <Button variant="ghost" onClick={resetForm}>
                            <Plus className="mr-2 h-4 w-4" />
                            Buat Baru
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleSaveInvoice} disabled={isSaving}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? "Saving..." : editingInvoiceId ? "Update" : "Simpan"}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                                <File className="mr-2 h-4 w-4" /> PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload("png")}>
                                <FileImage className="mr-2 h-4 w-4" /> PNG
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload("jpeg")}>
                                <FileImage className="mr-2 h-4 w-4" /> JPEG
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={handleShareWhatsApp} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Send className="mr-2 h-4 w-4" />
                        WhatsApp
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {/* Tab List */}
                <div className="sticky top-0 z-40 bg-background/95 backdrop-blur pb-2 md:pb-0 pt-2 -mt-2">
                    <TabsList className="grid w-full grid-cols-5 md:grid-cols-4 h-12">
                        <TabsTrigger value="form" className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span className="hidden sm:inline">Form</span>
                        </TabsTrigger>
                        <TabsTrigger value="template" className="flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            <span className="hidden sm:inline">Template</span>
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            <span className="hidden sm:inline">Settings</span>
                        </TabsTrigger>
                        <TabsTrigger value="history" className="flex items-center gap-2">
                            <History className="w-4 h-4" />
                            <span className="hidden sm:inline">Histori</span>
                        </TabsTrigger>
                        <TabsTrigger value="preview" className="flex md:hidden items-center gap-2">
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Preview</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="grid xl:grid-cols-2 gap-6 mt-4">
                    {/* Left: Editor Content (Form, Template, Settings, History) */}
                    <div className="space-y-6 overflow-hidden">
                        <TabsContent value="form" className="space-y-4 m-0">
                            {/* Editing indicator */}
                            {editingInvoiceId && (
                                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                    <Pencil className="w-4 h-4 text-amber-600" />
                                    <span className="text-sm text-amber-700 dark:text-amber-300">
                                        Mengedit invoice: <strong>{invoiceNumber}</strong>
                                    </span>
                                    <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={resetForm}>
                                        <X className="w-3 h-3 mr-1" /> Batal
                                    </Button>
                                </div>
                            )}

                            {/* Invoice Number */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Hash className="w-4 h-4" /> No. Invoice
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Input
                                        placeholder="INV-202412-001"
                                        value={invoiceNumber}
                                        onChange={(e) => setInvoiceNumber(e.target.value)}
                                        className="h-12 text-base font-mono"
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Format bebas. Contoh: INV-202412-001, INVOICE/2024/001, dll.
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Client Info */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Info Klien</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
                                        <Input
                                            placeholder="Nama Perusahaan / Klien"
                                            value={clientName}
                                            onChange={(e) => setClientName(e.target.value)}
                                            className="h-12 flex-1 min-w-0 text-base"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-5 h-5 text-muted-foreground shrink-0" />
                                        <Input
                                            placeholder="No. Telepon"
                                            value={clientPhone}
                                            onChange={(e) => setClientPhone(e.target.value)}
                                            className="h-12 flex-1 min-w-0 text-base"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
                                        <Input
                                            placeholder="Alamat (opsional)"
                                            value={clientAddress}
                                            onChange={(e) => setClientAddress(e.target.value)}
                                            className="h-12 flex-1 min-w-0 text-base"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Dates */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Tanggal</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs mb-1.5 block">Tanggal Invoice</Label>
                                        <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-12 text-base" />
                                    </div>
                                    <div>
                                        <Label className="text-xs mb-1.5 block">Jatuh Tempo</Label>
                                        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-12 text-base" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Items */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Item</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {/* Desktop Table */}
                                    <div className="hidden md:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Deskripsi</TableHead>
                                                    <TableHead className="w-24 text-center">Qty</TableHead>
                                                    <TableHead className="w-32 text-right">Harga</TableHead>
                                                    <TableHead className="w-10"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.map((item) => (
                                                    <TableRow key={item.id}>
                                                        <TableCell>
                                                            <Input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="Nama item..." className="border-0 p-0 h-auto shadow-none focus-visible:ring-0" />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))} min={1} className="border-0 p-0 h-auto shadow-none text-center focus-visible:ring-0" />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input type="number" value={item.price} onChange={(e) => updateItem(item.id, "price", Number(e.target.value))} min={0} className="border-0 p-0 h-auto shadow-none text-right focus-visible:ring-0" />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeItem(item.id)}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Mobile Cards */}
                                    <div className="md:hidden space-y-3">
                                        {items.map((item) => (
                                            <div key={item.id} className="p-4 border rounded-xl bg-card shadow-sm space-y-3 relative">
                                                <div className="pr-10">
                                                    <Label className="text-xs text-muted-foreground mb-1 block">Deskripsi</Label>
                                                    <Input
                                                        value={item.description}
                                                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                                                        placeholder="Jasa Desain..."
                                                        className="h-10 text-base"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-xs text-muted-foreground mb-1 block">Qty</Label>
                                                        <Input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                                                            min={1}
                                                            className="h-10 text-base"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-muted-foreground mb-1 block">Harga</Label>
                                                        <Input
                                                            type="number"
                                                            value={item.price}
                                                            onChange={(e) => updateItem(item.id, "price", Number(e.target.value))}
                                                            min={0}
                                                            className="h-10 text-base"
                                                        />
                                                    </div>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full"
                                                    onClick={() => removeItem(item.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    <Button onClick={addItem} variant="outline" className="mt-4 w-full h-12 md:w-auto border-dashed rounded-xl">
                                        <Plus className="w-4 h-4 mr-2" /> Tambah Item
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Notes */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Catatan</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan pembayaran..." rows={3} className="text-base" />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="template" className="space-y-4 m-0">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Palette className="w-4 h-4" /> Pilih Template
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-3">
                                        {INVOICE_TEMPLATES.map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => setTemplate(t.id)}
                                                className={`p-4 rounded-xl border-2 text-left transition-all ${template === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                                            >
                                                <div className="font-medium">{t.name}</div>
                                                <div className="text-xs text-muted-foreground">{t.description}</div>
                                                {template === t.id && <Check className="w-4 h-4 text-primary mt-2" />}
                                            </button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Status Invoice</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {INVOICE_STATUSES.map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => setStatus(s.id)}
                                                className={`px-4 py-2 rounded-full border-2 transition-all ${status === s.id ? "border-primary" : "border-border"}`}
                                            >
                                                <Badge className={s.color}>{s.name}</Badge>
                                            </button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="settings" className="space-y-4 m-0">
                            {/* Discount */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Percent className="w-4 h-4" /> Diskon
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex gap-2">
                                        <Select value={discountType} onValueChange={(v: DiscountType) => setDiscountType(v)}>
                                            <SelectTrigger className="w-28 sm:w-32 shrink-0 h-11">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="nominal">Nominal</SelectItem>
                                                <SelectItem value="percent">Persen (%)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} min={0} placeholder={discountType === "percent" ? "0%" : "Rp 0"} className="h-11 flex-1 min-w-0" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Tax */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">PPN / Pajak</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label>Aktifkan PPN</Label>
                                        <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
                                    </div>
                                    {taxEnabled && (
                                        <div className="flex items-center gap-2">
                                            <Label className="w-20">Persentase</Label>
                                            <Input type="number" value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} min={0} max={100} className="w-24" />
                                            <span className="text-muted-foreground">%</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Bank Account */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <CreditCard className="w-4 h-4" /> Rekening Bank
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label>Tampilkan Rekening</Label>
                                        <Switch checked={showBankAccount} onCheckedChange={setShowBankAccount} />
                                    </div>
                                    {showBankAccount && (
                                        <>
                                            <Select value={selectedBank?.id} onValueChange={(v) => setSelectedBank(bankAccounts.find(b => b.id === v) || null)}>
                                                <SelectTrigger className="h-12">
                                                    <SelectValue placeholder="Pilih rekening" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {bankAccounts.map((bank) => (
                                                        <SelectItem key={bank.id} value={bank.id}>
                                                            {bank.bank_name} - {bank.account_number}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {selectedBank && (
                                                <div className="p-4 bg-muted/50 rounded-xl text-sm border border-border/50">
                                                    <p className="font-medium text-base">{selectedBank.bank_name}</p>
                                                    <p className="font-mono text-lg">{selectedBank.account_number}</p>
                                                    <p className="text-muted-foreground mt-1">a.n. {selectedBank.account_name}</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {!showBankAccount && (
                                        <p className="text-sm text-muted-foreground">
                                            Info rekening tidak akan ditampilkan di invoice.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* History Tab */}
                        <TabsContent value="history" className="m-0">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <History className="w-4 h-4" /> Histori Invoice
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingHistory ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : invoices.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p>Belum ada invoice tersimpan</p>
                                            <p className="text-sm">Buat invoice baru dan simpan untuk melihat di sini</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Desktop Table */}
                                            <div className="hidden md:block">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>No. Invoice</TableHead>
                                                            <TableHead>Klien</TableHead>
                                                            <TableHead>Tanggal</TableHead>
                                                            <TableHead className="text-right">Total</TableHead>
                                                            <TableHead>Status</TableHead>
                                                            <TableHead className="text-right">Aksi</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {invoices.map((inv) => (
                                                            <TableRow key={inv.id}>
                                                                <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                                                                <TableCell>{inv.client_name}</TableCell>
                                                                <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                                                                <TableCell className="text-right font-medium">{formatRupiah(inv.total)}</TableCell>
                                                                <TableCell>{getStatusBadge(inv.status)}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreviewInvoice(inv.id!)}>
                                                                            <Eye className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditInvoice(inv.id!)}>
                                                                            <Pencil className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmId(inv.id!)}>
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            {/* Mobile Cards */}
                                            <div className="md:hidden space-y-3">
                                                {invoices.map((inv) => (
                                                    <div key={inv.id} className="p-4 border rounded-xl bg-card shadow-sm">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div>
                                                                <p className="font-mono text-sm font-medium">{inv.invoice_number}</p>
                                                                <p className="text-muted-foreground">{inv.client_name}</p>
                                                            </div>
                                                            {getStatusBadge(inv.status)}
                                                        </div>
                                                        <div className="flex items-center justify-between text-sm mb-3">
                                                            <span className="text-muted-foreground">{formatDate(inv.invoice_date)}</span>
                                                            <span className="font-medium">{formatRupiah(inv.total)}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button variant="outline" size="sm" className="flex-1" onClick={() => handlePreviewInvoice(inv.id!)}>
                                                                <Eye className="w-4 h-4 mr-1" /> Preview
                                                            </Button>
                                                            <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditInvoice(inv.id!)}>
                                                                <Pencil className="w-4 h-4 mr-1" /> Edit
                                                            </Button>
                                                            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmId(inv.id!)}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Mobile Preview Tab Content */}
                        <TabsContent value="preview" className="md:hidden m-0">
                            <Card className="border-0 shadow-none bg-transparent w-full">
                                <CardContent className="p-0 w-full">
                                    <div className="w-full overflow-hidden bg-muted/10 rounded-lg mb-4">
                                        <div className="flex justify-center p-2">
                                            <div
                                                className="shadow-lg origin-top"
                                                style={{
                                                    transform: 'scale(0.42)',
                                                    transformOrigin: 'top center',
                                                    marginBottom: '-650px' // Compensate for scaled height (1123 * 0.42 ≈ 472, negative margin = 1123 - 472)
                                                }}
                                            >
                                                <InvoicePreview invoice={invoiceData} template={template} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-1">
                                        <div className="text-center text-xs text-muted-foreground mb-4">
                                            Preview disesuaikan untuk layar HP.
                                            <br />Download untuk hasil resolusi penuh (A4).
                                        </div>

                                        {/* Integrated Mobile Actions */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                onClick={handleShareWhatsApp}
                                                className="col-span-2 h-12 text-base bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-500/20 w-full"
                                            >
                                                <Send className="mr-2 h-5 w-5" />
                                                Kirim WhatsApp
                                            </Button>

                                            <Button
                                                variant="outline"
                                                onClick={handleSaveInvoice}
                                                disabled={isSaving}
                                                className="h-12 text-base rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 w-full"
                                            >
                                                <Save className="mr-2 h-5 w-5" />
                                                {isSaving ? "Saving..." : editingInvoiceId ? "Update" : "Simpan"}
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="h-12 text-base rounded-xl w-full">
                                                        <Download className="mr-2 h-5 w-5" />
                                                        Download
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 text-base">
                                                    <DropdownMenuItem onClick={() => handleDownload("pdf")} className="py-3">
                                                        <File className="mr-2 h-4 w-4" /> PDF Document
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDownload("png")} className="py-3">
                                                        <FileImage className="mr-2 h-4 w-4" /> Image (PNG)
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDownload("jpeg")} className="py-3">
                                                        <FileImage className="mr-2 h-4 w-4" /> Image (JPEG)
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </div>

                    {/* Right: Desktop Preview (Always Visible) */}
                    <div className="hidden md:block overflow-hidden">
                        <Card className="sticky top-6">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Preview</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 overflow-hidden rounded-b-lg bg-muted/20">
                                {/* Scaled Container for A4 Preview - fits within card */}
                                <div className="w-full flex justify-center">
                                    <div
                                        className="origin-top shadow-lg"
                                        style={{
                                            transform: 'scale(0.6)',
                                            transformOrigin: 'top center',
                                            marginBottom: '-450px' // Compensate for scaled height
                                        }}
                                        ref={invoiceRef}
                                    >
                                        <InvoicePreview invoice={invoiceData} template={template} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </Tabs>

            {/* Hidden Off-Screen Container for Download - Always renders at full A4 scale */}
            <div
                style={{
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    width: '794px',
                    height: 'auto',
                    backgroundColor: '#ffffff',
                    zIndex: -9999,
                    opacity: 0,
                    pointerEvents: 'none',
                    overflow: 'hidden'
                }}
                aria-hidden="true"
            >
                <div ref={downloadRef} style={{ backgroundColor: '#ffffff', width: '794px' }}>
                    <PrintableInvoice invoice={invoiceData} template={template} />
                </div>
            </div>

            {/* Preview Dialog */}
            <Dialog open={!!previewInvoice} onOpenChange={(open) => !open && setPreviewInvoice(null)}>
                <DialogContent className="max-w-[95vw] md:max-w-[600px] max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Preview Invoice</DialogTitle>
                        <DialogDescription>
                            {previewInvoice?.invoice_number} - {previewInvoice?.client_name}
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh]">
                        {previewInvoice && (
                            <div ref={previewRef} className="bg-muted/20 p-2 flex justify-center">
                                <div
                                    className="shadow-lg origin-top"
                                    style={{
                                        transform: 'scale(0.65)',
                                        transformOrigin: 'top center',
                                        marginBottom: '-400px'
                                    }}
                                >
                                    <InvoicePreview invoice={previewInvoice} template={previewInvoice.template} />
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewInvoice(null)}>
                            Tutup
                        </Button>
                        <Button onClick={() => {
                            if (previewInvoice?.id) {
                                handleEditInvoice(previewInvoice.id);
                                setPreviewInvoice(null);
                            }
                        }}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit Invoice
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus Invoice?</DialogTitle>
                        <DialogDescription>
                            Invoice yang dihapus tidak dapat dikembalikan. Yakin ingin menghapus?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)} disabled={isDeleting}>
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteInvoice} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
