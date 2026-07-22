"use client";

import { useEffect, useRef, useState } from "react";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Download, FileText, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";

type InvoiceItem = { description: string; quantity: number; price: number };
type InvoiceOrder = {
    order_id: string;
    status: string;
    created_at?: string;
    invoice_date?: string;
    customer_name?: string;
    customer_whatsapp?: string;
    package_name?: string;
    amount?: number;
    total_amount?: number;
    total?: number;
    subtotal?: number;
    discount_type?: string;
    discount_value?: number;
    discount_amount?: number;
    tax_amount?: number;
    tax_enabled?: boolean;
    tax_percent?: number;
    sender_name?: string;
    notes?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_account_name?: string;
    is_new_format?: boolean;
    raw_items?: InvoiceItem[];
    price_snapshot?: Array<{ name: string; quantity: number; unit_price: number }>;
};

interface InvoiceClientProps {
    order: InvoiceOrder;
}

function escapeInvoiceHtml(value: unknown) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export default function InvoiceClient({ order }: InvoiceClientProps) {
    const invoiceRef = useRef<HTMLDivElement>(null);
    const previewViewportRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [previewScale, setPreviewScale] = useState(1);
    const invoiceWidth = 794;
    const invoiceHeight = 1123;

    const isPaid = order.status === "PAID" || order.status === "paid";
    const invoiceDate = new Date(order.created_at || order.invoice_date || Date.now()).toISOString();
    
    // Construct items list for UI & PDF
    let items: InvoiceItem[] = [];
    if (order.is_new_format && order.raw_items?.length) {
        items = order.raw_items;
    } else if (Array.isArray(order.price_snapshot) && order.price_snapshot.length) {
        items = order.price_snapshot.map((item: { name: string; quantity: number; unit_price: number }) => ({
            description: item.name,
            quantity: item.quantity,
            price: item.unit_price,
        }));
    } else {
        items = [
            {
                description: order.package_name || "Layanan InfoLokerJombang",
                quantity: 1,
                price: order.amount || 0,
            }
        ];

    }

    const subtotal = order.subtotal || items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const discountAmount = order.discount_amount || 0;
    const taxAmount = order.tax_amount || 0;
    const total = order.total_amount || order.total || (subtotal - discountAmount + taxAmount);
    const statusWatermark = isPaid ? "LUNAS" : "PENDING";

    // Keep the invoice artwork at its desktop/A4 dimensions, then scale only
    // its on-screen preview on small viewports. The exported element remains
    // the original 794px layout.
    useEffect(() => {
        const viewport = previewViewportRef.current;
        if (!viewport) return;
        const updateScale = () => {
            const available = viewport.clientWidth;
            setPreviewScale(Math.min(1, Math.max(0.1, (available - 8) / invoiceWidth)));
        };
        updateScale();
        const observer = new ResizeObserver(updateScale);
        observer.observe(viewport);
        return () => observer.disconnect();
    }, []);

    const handleDownload = async (format: "pdf" | "png" | "jpg") => {
        setIsDownloading(true);
        const loadingToast = toast.loading(`Generating ${format.toUpperCase()}...`);

        try {
            // The responsive preview has CSS transforms. Render a plain A4
            // document instead so html2canvas always receives supported CSS.
            const formattedItems = items.map((item) => `
                <tr><td class="bold">${escapeInvoiceHtml(item.description)}</td><td class="center">${item.quantity}</td><td class="right">${escapeInvoiceHtml(formatRupiah(item.price))}</td><td class="right bold">${escapeInvoiceHtml(formatRupiah(item.quantity * item.price))}</td></tr>`).join("");
            const paymentGuide = !isPaid ? (order.bank_name ? `
                <div class="payment-box"><div class="label">Panduan Pembayaran</div><div class="bank-name">${escapeInvoiceHtml(order.bank_name)}</div><div class="bank-number">${escapeInvoiceHtml(order.bank_account_number)}</div><div class="muted">a.n. ${escapeInvoiceHtml(order.bank_account_name)}</div></div>` : `
                <div class="payment-box"><div class="label">Panduan Pembayaran</div><div class="bank-name">BCA / DANA / OVO</div><div class="muted">Silakan hubungi admin via WhatsApp untuk nomor rekening / QRIS.</div></div>`) : "";
            const invoiceHtml = `<!doctype html><html><head><meta charset="utf-8" /><style>
                *{box-sizing:border-box}body{margin:0;width:794px;min-height:1123px;background:#fff;color:#0f172a;font-family:Arial,Helvetica,sans-serif}.page{min-height:1123px;padding:40px;position:relative;overflow:hidden}.watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:${isPaid ? "#059669" : "#2563eb"};opacity:.035;font-size:128px;font-weight:800;transform:rotate(-12deg)}.content{position:relative;z-index:1}.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:32px;margin-bottom:48px;border-bottom:1px solid #dbeafe}.logo{width:96px;height:96px;border-radius:16px;overflow:hidden;background:#f8fafc;border:1px solid #f1f5f9}.logo img{width:100%;height:100%;object-fit:cover}.title{color:#2563eb;font-size:32px;font-weight:800;text-align:right;letter-spacing:-1px}.meta{color:#64748b;font-size:14px;line-height:1.7;text-align:right}.status{color:${isPaid ? "#059669" : "#f43f5e"};font-weight:700}.info{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-bottom:40px}.label{color:#94a3b8;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px}.from-name,.to-name{color:#1e293b;font-size:18px;font-weight:700;margin-bottom:4px}.muted{color:#64748b;font-size:14px;line-height:1.55}.bill-to{padding:24px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff}table{width:100%;border-collapse:collapse;margin-bottom:32px}th{padding:16px;background:#2563eb;color:#fff;font-size:12px;font-weight:700;letter-spacing:1px;text-align:left;text-transform:uppercase}td{padding:16px;border-bottom:1px solid #f1f5f9;font-size:14px}.center{text-align:center}.right{text-align:right}.bold{color:#1e293b;font-weight:700}.bottom{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:32px}.payment-box{margin-bottom:24px;padding:20px;border:1px dashed #94a3b8;border-radius:12px;background:#f8fafc}.bank-name{color:#1e293b;font-size:18px;font-weight:700;margin-bottom:4px}.bank-number{color:#334155;font-family:monospace;font-size:16px;margin-bottom:4px}.notes{color:#64748b;font-size:14px;line-height:1.6;white-space:pre-line}.totals{padding:24px;border:1px solid #f1f5f9;border-radius:12px;background:#f8fafc}.row{display:flex;justify-content:space-between;margin-bottom:16px;color:#64748b;font-size:14px}.row strong{color:#334155}.discount{color:#ef4444}.grand{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e2e8f0;margin-top:8px;padding-top:16px}.grand span:first-child{color:#64748b;font-size:14px;font-weight:600}.grand strong{color:#2563eb;font-size:24px}.footer{margin-top:128px;padding-top:32px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px;font-weight:600;text-align:center}
                </style></head><body><div class="page"><div class="watermark">${statusWatermark}</div><div class="content">
                <div class="header"><div class="logo"><img src="${window.location.origin}/profile.png" alt="InfoLokerJombang" /></div><div><div class="title">INVOICE</div><div class="meta"><div>No. ${escapeInvoiceHtml(order.order_id)}</div><div>Tanggal: ${escapeInvoiceHtml(formatDate(invoiceDate))}</div><div class="status">Status: ${statusWatermark}</div></div></div></div>
                <div class="info"><div><div class="label">Dari</div><div class="from-name">${escapeInvoiceHtml(order.sender_name || "InfoLokerJombang")}</div><div class="muted">@infolokerjombang<br/>Jombang, Jawa Timur</div></div><div class="bill-to"><div class="label">Kepada</div><div class="to-name">${escapeInvoiceHtml(order.customer_name)}</div>${order.customer_whatsapp ? `<div class="muted">${escapeInvoiceHtml(order.customer_whatsapp)}</div>` : ""}</div></div>
                <table><thead><tr><th>Deskripsi</th><th class="center" style="width:96px">Qty</th><th class="right" style="width:160px">Harga</th><th class="right" style="width:160px">Total</th></tr></thead><tbody>${formattedItems}</tbody></table>
                <div class="bottom"><div>${paymentGuide}<div class="label">Catatan</div><div class="notes">${escapeInvoiceHtml(order.notes || (isPaid ? "Terima kasih, pembayaran telah kami terima." : "Mohon selesaikan pembayaran agar pesanan dapat segera diproses."))}</div></div><div class="totals"><div class="row"><span>Subtotal</span><strong>${escapeInvoiceHtml(formatRupiah(subtotal))}</strong></div>${discountAmount > 0 ? `<div class="row discount"><span>Diskon</span><strong>-${escapeInvoiceHtml(formatRupiah(discountAmount))}</strong></div>` : ""}${taxAmount > 0 ? `<div class="row"><span>PPN${order.tax_percent ? ` (${order.tax_percent}%)` : ""}</span><strong>${escapeInvoiceHtml(formatRupiah(taxAmount))}</strong></div>` : ""}<div class="grand"><span>Total Tagihan</span><strong>${escapeInvoiceHtml(formatRupiah(total))}</strong></div></div></div><div class="footer">Terima kasih atas kepercayaan Anda bekerja sama dengan InfoLokerJombang.</div>
                </div></div></body></html>`;
            const iframe = document.createElement("iframe");
            iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${invoiceWidth}px;height:${invoiceHeight}px;border:0;visibility:hidden;`;
            document.body.appendChild(iframe);
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) throw new Error("Dokumen invoice tidak dapat dibuat");
            iframeDoc.open();
            iframeDoc.write(invoiceHtml);
            iframeDoc.close();
            try {
                await Promise.all(Array.from(iframeDoc.images).map((image) => new Promise<void>((resolve) => {
                    if (image.complete) return resolve();
                    image.addEventListener("load", () => resolve(), { once: true });
                    image.addEventListener("error", () => resolve(), { once: true });
                    window.setTimeout(resolve, 1500);
                })));
                const canvas = await html2canvas(iframeDoc.body, {
                    scale: 2,
                    backgroundColor: "#ffffff",
                    useCORS: true,
                    allowTaint: false,
                    logging: false,
                    width: invoiceWidth,
                    windowWidth: invoiceWidth,
                });

                const safeSenderName = (order.customer_name || "Invoice").replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").substring(0, 30);
                const fileName = `${order.order_id}_${safeSenderName}`;

                if (format === "pdf") {
                    const imgData = canvas.toDataURL("image/png");
                    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                    const imgWidth = 210;
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
                    pdf.save(`${fileName}.pdf`);
                } else {
                    const link = document.createElement("a");
                    link.download = `${fileName}.${format}`;
                    link.href = canvas.toDataURL(`image/${format === "jpg" ? "jpeg" : "png"}`, 0.95);
                    link.click();
                }
            } finally {
                iframe.remove();
            }

            toast.dismiss(loadingToast);
            toast.success("Download berhasil!");
        } catch (err) {
            console.error("Download error:", err);
            toast.dismiss(loadingToast);
            toast.error("Gagal generate file. Silakan coba lagi.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="w-full flex flex-col items-center pb-24 font-sans">
            
            {/* CONTAINER INVOICE (UKURAN A4) */}
            <div
                ref={previewViewportRef}
                className="w-full overflow-hidden md:overflow-x-auto md:custom-scrollbar"
                style={{ minHeight: `${invoiceHeight * previewScale}px` }}
            >
                <div 
                    className="mx-auto"
                    style={{ width: `${invoiceWidth * previewScale}px`, height: `${invoiceHeight * previewScale}px` }}
                >
                    <div
                        ref={invoiceRef}
                        className="bg-white relative shadow-sm border border-slate-200"
                        style={{
                            width: `${invoiceWidth}px`,
                            minWidth: `${invoiceWidth}px`,
                            minHeight: `${invoiceHeight}px`,
                            padding: '40px',
                            transform: `scale(${previewScale})`,
                            transformOrigin: 'top left',
                        }}
                    >
                    {/* WATERMARK */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                        <span 
                            className={`text-[128px] font-bold transform -rotate-12 opacity-[0.03] select-none ${isPaid ? 'text-emerald-600' : 'text-blue-600'}`}
                            style={{ WebkitTextStroke: '2px currentColor' }}
                        >
                            {statusWatermark}
                        </span>
                    </div>

                    <div className="relative z-10 text-slate-900">
                        {/* HEADER */}
                        <div className="flex justify-between items-start mb-12 border-b border-blue-50 pb-8">
                            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                <img src="/profile.png" alt="Logo InfoLokerJombang" className="w-full h-full object-cover" crossOrigin="anonymous" />
                            </div>
                            <div className="text-right">
                                <h1 className="text-4xl font-extrabold text-blue-600 uppercase tracking-tight mb-2">INVOICE</h1>
                                <div className="text-slate-500 text-sm font-medium space-y-1">
                                    <p><span className="opacity-60 mr-2">No.</span> {order.order_id}</p>
                                    <p><span className="opacity-60 mr-2">Tanggal:</span> {formatDate(invoiceDate)}</p>
                                    <p className={`font-bold mt-1 ${isPaid ? 'text-emerald-600' : 'text-rose-500'}`}>
                                        <span className="opacity-60 font-medium text-slate-500 mr-2">Status:</span> 
                                        {statusWatermark}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* INFO PENGIRIM & PENERIMA */}
                        <div className="grid grid-cols-2 gap-12 mb-10">
                            <div className="space-y-1">
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Dari</h2>
                                <div className="font-bold text-slate-800 text-lg">{order.sender_name || "InfoLokerJombang"}</div>
                                <div className="text-slate-500 font-medium">@infolokerjombang</div>
                                <div className="text-sm text-slate-600">Jombang, Jawa Timur</div>
                            </div>
                            <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">Kepada</div>
                                <div className="font-bold text-lg mb-1 text-slate-800">{order.customer_name}</div>
                                {order.customer_whatsapp && (
                                    <div className="text-sm text-slate-600">{order.customer_whatsapp}</div>
                                )}
                            </div>
                        </div>

                        {/* TABEL ITEM */}
                        <div className="mb-8">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-blue-600 text-white">
                                        <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider rounded-tl-lg">Deskripsi</th>
                                        <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-center w-24">Qty</th>
                                        <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-right w-40">Harga</th>
                                        <th className="py-4 px-4 text-xs font-bold uppercase tracking-wider text-right w-40 rounded-tr-lg">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={index} className="border-b border-slate-100">
                                            <td className="py-4 px-4 font-bold text-slate-800">{item.description}</td>
                                            <td className="py-4 px-4 text-center text-slate-500 font-medium">{item.quantity}</td>
                                            <td className="py-4 px-4 text-right text-slate-600">{formatRupiah(item.price)}</td>
                                            <td className="py-4 px-4 text-right font-bold text-slate-800">{formatRupiah(item.quantity * item.price)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* CATATAN DAN TOTAL */}
                        <div className="grid grid-cols-2 gap-12 mt-8">
                            <div>
                                {!isPaid && (
                                    <div className="p-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 mb-6">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-3">Panduan Pembayaran</div>
                                        {order.bank_name ? (
                                            <>
                                                <div className="font-bold text-lg mb-1">{order.bank_name}</div>
                                                <div className="text-sm font-mono text-slate-700 mb-1">{order.bank_account_number}</div>
                                                <div className="text-xs text-slate-500">a.n. {order.bank_account_name}</div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="font-bold text-lg mb-1">BCA / DANA / OVO</div>
                                                <div className="text-sm text-slate-500">Silakan hubungi admin via WhatsApp untuk nomor rekening / QRIS.</div>
                                            </>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Catatan</div>
                                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                                        {order.notes ? order.notes : (isPaid 
                                            ? 'Terima kasih, pembayaran telah kami terima.' 
                                            : 'Mohon selesaikan pembayaran agar pesanan dapat segera diproses.')}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end">
                                <div className="bg-slate-50 p-6 rounded-xl w-72 h-fit border border-slate-100">
                                    <div className="flex justify-between items-center text-sm mb-4">
                                        <span className="text-slate-500 font-medium">Subtotal</span>
                                        <span className="font-semibold text-slate-700">{formatRupiah(subtotal)}</span>
                                    </div>
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between items-center text-sm mb-4 text-red-500">
                                            <span className="font-medium">Diskon</span>
                                            <span className="font-semibold">-{formatRupiah(discountAmount)}</span>
                                        </div>
                                    )}
                                    {taxAmount > 0 && (
                                        <div className="flex justify-between items-center text-sm mb-4">
                                            <span className="text-slate-500 font-medium">PPN {order.tax_percent ? `(${order.tax_percent}%)` : ''}</span>
                                            <span className="font-semibold text-slate-700">{formatRupiah(taxAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-end border-t border-slate-200 pt-4 mt-2">
                                        <span className="text-slate-500 font-medium">Total Tagihan</span>
                                        <span className="text-2xl font-bold text-blue-600">{formatRupiah(total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="mt-32 pt-8 border-t border-slate-100 text-center">
                            <p className="text-xs text-slate-400 font-medium">
                                Terima kasih atas kepercayaan Anda bekerja sama dengan InfoLokerJombang.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            </div>

            {/* FLOATING DOWNLOAD BUTTON */}
            <div className="fixed bottom-5 left-1/2 z-50 hidden -translate-x-1/2 sm:block sm:bottom-8">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button 
                            size="lg" 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl rounded-full px-8 h-14 text-base font-semibold shadow-emerald-600/20"
                            disabled={isDownloading}
                        >
                            <Download className="mr-2 h-5 w-5" />
                            {isDownloading ? "Memproses..." : "Download Invoice"}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-56 mb-2 p-2 rounded-xl border border-slate-200 shadow-xl bg-white">
                        <DropdownMenuItem onClick={() => handleDownload("pdf")} className="cursor-pointer py-3 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 focus:bg-emerald-50 focus:text-emerald-700 transition-colors">
                            <FileText className="mr-3 h-5 w-5 text-emerald-600" /> 
                            <span className="font-medium text-slate-700">Download PDF</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload("png")} className="cursor-pointer py-3 rounded-lg hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:text-blue-700 transition-colors mt-1">
                            <FileImage className="mr-3 h-5 w-5 text-blue-600" /> 
                            <span className="font-medium text-slate-700">Download PNG Image</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload("jpg")} className="cursor-pointer py-3 rounded-lg hover:bg-amber-50 hover:text-amber-700 focus:bg-amber-50 focus:text-amber-700 transition-colors mt-1">
                            <FileImage className="mr-3 h-5 w-5 text-amber-600" /> 
                            <span className="font-medium text-slate-700">Download JPG Image</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="fixed bottom-4 left-4 right-4 z-50 flex gap-2 sm:hidden">
                <Button className="h-12 flex-1 bg-emerald-600 text-white shadow-lg hover:bg-emerald-700" onClick={() => handleDownload("pdf")} disabled={isDownloading}>
                    <FileText className="mr-2 h-4 w-4" /> PDF
                </Button>
                <Button className="h-12 flex-1 bg-blue-600 text-white shadow-lg hover:bg-blue-700" onClick={() => handleDownload("png")} disabled={isDownloading}>
                    <FileImage className="mr-2 h-4 w-4" /> PNG
                </Button>
            </div>
        </div>
    );
}
