"use client";

import { useRef, useState } from "react";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";

interface InvoiceClientProps {
    order: any;
}

export default function InvoiceClient({ order }: InvoiceClientProps) {
    const invoiceRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const isPaid = order.status === "PAID";
    const invoiceDate = new Date(order.created_at || Date.now()).toISOString();
    
    // Construct items list for UI & PDF
    const items = [
        {
            description: order.package_name,
            quantity: 1,
            price: order.amount,
        }
    ];

    if (order.addon_names && order.addons) {
        order.addon_names.forEach((name: string, idx: number) => {
            if (name && order.addons[idx]) {
                items.push({
                    description: name,
                    quantity: 1,
                    price: order.addons[idx],
                });
            }
        });
    }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const total = order.total_amount || subtotal;
    const statusWatermark = isPaid ? "LUNAS" : "PENDING";

    const handleDownload = async () => {
        if (!invoiceRef.current) return;
        setIsDownloading(true);
        const loadingToast = toast.loading("Generating PDF...");

        try {
            // Kita render ulang iframe sementara khusus untuk html2canvas 
            // agar memastikan scaling persis 794px terlepas dari ukuran layar mobile/desktop
            const invoiceHtml = invoiceRef.current.outerHTML;
            const styleSheets = Array.from(document.styleSheets)
                .map(styleSheet => {
                    try {
                        return Array.from(styleSheet.cssRules)
                            .map(rule => rule.cssText)
                            .join('');
                    } catch (e) {
                        return '';
                    }
                })
                .join('\n');

            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.left = '-9999px';
            iframe.style.top = '0';
            iframe.style.width = '794px';
            iframe.style.height = '1123px';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) throw new Error('Cannot create iframe');

            iframeDoc.open();
            iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        ${styleSheets}
                        /* Pastikan font Tailwind ter-load dengan baik dan reset margin */
                        body { margin: 0; padding: 0; background: white; -webkit-font-smoothing: antialiased; font-family: ui-sans-serif, system-ui, sans-serif; }
                    </style>
                </head>
                <body>
                    ${invoiceHtml}
                </body>
                </html>
            `);
            iframeDoc.close();

            await new Promise(resolve => setTimeout(resolve, 500)); // Tunggu font dan image load

            // Gunakan body iframe sebagai referensi html2canvas
            const targetElement = iframeDoc.body.firstElementChild as HTMLElement;
            
            const canvas = await html2canvas(targetElement, {
                scale: 2,
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false,
                width: 794,
                windowWidth: 794,
            });

            document.body.removeChild(iframe);

            const safeSenderName = (order.customer_name || "Invoice").replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "_").substring(0, 30);
            const fileName = `${order.order_id}_${safeSenderName}`;

            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
            pdf.save(`${fileName}.pdf`);

            toast.dismiss(loadingToast);
            toast.success("Download berhasil!");
        } catch (err) {
            console.error("Download error:", err);
            toast.dismiss(loadingToast);
            toast.error("Gagal generate PDF. Coba lagi.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="w-full flex flex-col items-center pb-24 font-sans">
            
            {/* CONTAINER INVOICE (UKURAN A4) */}
            <div className="overflow-x-auto w-full flex justify-center custom-scrollbar">
                <div 
                    ref={invoiceRef}
                    className="bg-white relative shadow-sm border border-slate-200"
                    style={{ 
                        width: '794px', 
                        minWidth: '794px',
                        minHeight: '1123px',
                        padding: '40px',
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
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Dari</div>
                                <div className="font-bold text-lg mb-1">InfoLokerJombang</div>
                                <div className="text-sm text-slate-600">@infolokerjombang</div>
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
                                        <div className="font-bold text-lg mb-1">BCA / DANA / OVO</div>
                                        <div className="text-sm text-slate-500">Silakan hubungi admin via WhatsApp untuk nomor rekening / QRIS.</div>
                                    </div>
                                )}
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Catatan</div>
                                    <div className="text-sm text-slate-600 leading-relaxed">
                                        {isPaid 
                                            ? 'Terima kasih, pembayaran telah kami terima.' 
                                            : 'Mohon selesaikan pembayaran agar pesanan dapat segera diproses.'}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end">
                                <div className="bg-slate-50 p-6 rounded-xl w-72 h-fit border border-slate-100">
                                    <div className="flex justify-between items-center text-sm mb-4 border-b border-slate-200 pb-4">
                                        <span className="text-slate-500 font-medium">Subtotal</span>
                                        <span className="font-semibold text-slate-700">{formatRupiah(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
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

            {/* FLOATING DOWNLOAD BUTTON */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                <Button 
                    size="lg" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl rounded-full px-8 h-14 text-base font-semibold shadow-emerald-600/20"
                    onClick={handleDownload}
                    disabled={isDownloading}
                >
                    <Download className="mr-2 h-5 w-5" />
                    {isDownloading ? "Memproses PDF..." : "Download Invoice"}
                </Button>
            </div>
        </div>
    );
}
