"use client";

import { formatRupiah, formatDate } from "@/lib/utils";
import { Download, File, FileImage, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";

interface InvoiceClientProps {
    order: any;
}

export default function InvoiceClient({ order }: InvoiceClientProps) {
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

    const handleDownload = async (format: "pdf" | "png" | "jpeg") => {
        const loadingToast = toast.loading("Generating Invoice...");

        try {
            // Generate pure HTML string for invoice (no external CSS dependencies)
            const generateInvoiceHTML = () => {
                // InfoLokerJombang Theme Colors
                const colors = {
                    primary: '#2563eb', // Blue
                    light: '#eff6ff',
                    lightBorder: '#bfdbfe',
                    slate50: '#f8fafc',
                    slate100: '#f1f5f9',
                    slate400: '#94a3b8',
                    slate500: '#64748b',
                    slate900: '#0f172a',
                    red500: '#ef4444',
                    white: '#ffffff',
                };

                const statusWatermark = isPaid ? "LUNAS" : "PENDING";
                
                // Get the current domain for logo URL
                const baseUrl = window.location.origin;
                const logoUrl = `${baseUrl}/profile.png`;

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
                                color: ${isPaid ? '#059669' : colors.primary};
                            }
                            .content { position: relative; z-index: 10; }
                            .header {
                                display: flex; justify-content: space-between; align-items: flex-start;
                                margin-bottom: 48px; border-bottom: 1px solid ${colors.light}; padding-bottom: 32px;
                            }
                            .logo { width: 96px; height: 96px; border-radius: 16px; overflow: hidden; }
                            .logo img { width: 100%; height: 100%; object-fit: cover; }
                            .title { font-size: 32px; font-weight: 800; color: ${colors.primary}; text-transform: uppercase; letter-spacing: -0.025em; }
                            .meta { color: ${colors.slate500}; font-size: 14px; font-weight: 500; margin-top: 8px; text-align: right; }
                            .meta p { margin: 4px 0; }
                            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-bottom: 40px; }
                            .from-label, .to-label { font-size: 12px; font-weight: 700; opacity: 0.4; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
                            .from-name, .to-name { font-weight: 700; font-size: 18px; margin-bottom: 4px; }
                            .info-sub { opacity: 0.7; font-size: 14px; }
                            .bill-to { background: ${colors.light}; padding: 24px; border-radius: 12px; border: 1px solid ${colors.lightBorder}; }
                            table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
                            th { background: ${colors.primary}; color: ${colors.white}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; padding: 16px; text-align: left; }
                            th.center { text-align: center; }
                            th.right { text-align: right; }
                            td { padding: 16px; border-bottom: 1px solid ${colors.light}; }
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
                            .total-row span:first-child { opacity: 0.7; }
                            .total-row span:last-child { font-weight: 600; }
                            .grand-total { padding-top: 16px; margin-top: 8px; border-top: 1px solid rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: flex-end; }
                            .grand-label { color: ${colors.slate500}; font-weight: 500; }
                            .grand-value { font-size: 24px; font-weight: 700; color: ${colors.primary}; }
                            .footer-msg { color: ${colors.slate400}; font-size: 12px; margin-top: 48px; padding-top: 32px; border-top: 1px solid ${colors.slate100}; text-align: center; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="watermark"><span>${statusWatermark}</span></div>
                            <div class="content">
                                <div class="header">
                                    <div class="logo">
                                        <img src="${logoUrl}" alt="Logo" crossorigin="anonymous" />
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="title">INVOICE</div>
                                        <div class="meta">
                                            <p><span style="opacity: 0.6;">No.</span> ${order.order_id}</p>
                                            <p><span style="opacity: 0.6;">Tanggal:</span> ${formatDate(invoiceDate)}</p>
                                            <p style="color: ${isPaid ? '#059669' : colors.red500}; font-weight: 700;"><span style="opacity: 0.6; font-weight: 500; color: ${colors.slate500}">Status:</span> ${statusWatermark}</p>
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
                                        <div class="to-name">${order.customer_name}</div>
                                        ${order.customer_whatsapp ? `<div class="info-sub">${order.customer_whatsapp}</div>` : ''}
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
                                        ${!isPaid ? `
                                        <div class="bank-box">
                                            <div class="bank-label">Panduan Pembayaran</div>
                                            <div class="bank-name">BCA / DANA / OVO</div>
                                            <div class="bank-holder">Silakan hubungi admin via WhatsApp untuk nomor rekening / QRIS.</div>
                                        </div>
                                        ` : ''}
                                        <div class="notes">
                                            <div class="notes-label">Catatan</div>
                                            <div class="notes-text">${isPaid ? 'Terima kasih, pembayaran telah kami terima.' : 'Mohon selesaikan pembayaran agar pesanan dapat diproses.'}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div class="totals">
                                            <div class="total-row">
                                                <span>Subtotal</span>
                                                <span>${formatRupiah(subtotal)}</span>
                                            </div>
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
                allowTaint: true,
                width: 794,
            });

            document.body.removeChild(iframe);

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
                link.download = `${fileName}.${format === "jpeg" ? "jpg" : "png"}`;
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

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="text-center sm:text-left">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoice #{order.order_id}</h1>
                    <p className="text-slate-500 mt-1">Diterbitkan pada {formatDate(invoiceDate)}</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="bg-primary hover:bg-primary/90">
                                <Download className="mr-2 h-4 w-4" />
                                Download Invoice
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleDownload("pdf")} className="cursor-pointer py-3">
                                <File className="mr-2 h-4 w-4" /> PDF Document
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload("png")} className="cursor-pointer py-3">
                                <FileImage className="mr-2 h-4 w-4" /> Image (PNG)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload("jpeg")} className="cursor-pointer py-3">
                                <FileImage className="mr-2 h-4 w-4" /> Image (JPEG)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <Card className="overflow-hidden border-0 shadow-xl bg-white/50 backdrop-blur">
                <CardHeader className="bg-white dark:bg-slate-900 border-b p-6 sm:p-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                                <FileTextIcon className="w-8 h-8 text-primary" />
                            </div>
                            <h2 className="text-xl font-semibold">Tagihan Kepada:</h2>
                            <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{order.customer_name}</p>
                            <p className="text-slate-500">{order.customer_whatsapp}</p>
                        </div>
                        <div className="text-right">
                            <Badge variant={isPaid ? "default" : "secondary"} className={`${isPaid ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-500 hover:bg-amber-600"} text-white px-4 py-1.5 text-sm uppercase tracking-wider`}>
                                {isPaid ? (
                                    <span className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-1.5" /> LUNAS</span>
                                ) : (
                                    "PENDING"
                                )}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="p-6 font-semibold text-slate-500 text-sm uppercase tracking-wider">Deskripsi Layanan</th>
                                    <th className="p-6 font-semibold text-slate-500 text-sm uppercase tracking-wider text-center">Qty</th>
                                    <th className="p-6 font-semibold text-slate-500 text-sm uppercase tracking-wider text-right">Harga</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {items.map((item, index) => (
                                    <tr key={index} className="bg-white dark:bg-slate-950">
                                        <td className="p-6 font-medium text-slate-900 dark:text-white">{item.description}</td>
                                        <td className="p-6 text-center text-slate-500">{item.quantity}</td>
                                        <td className="p-6 text-right font-medium">{formatRupiah(item.price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>

                <CardFooter className="bg-slate-50 dark:bg-slate-900/50 p-6 sm:p-10 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div className="w-full sm:w-auto">
                        {!isPaid && (
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50">
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-500 mb-1">Status Pembayaran:</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Silakan selesaikan pembayaran dan hubungi Admin.</p>
                            </div>
                        )}
                        {isPaid && (
                            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-500 mb-1">Terima Kasih!</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Pembayaran telah kami terima.</p>
                            </div>
                        )}
                    </div>
                    <div className="w-full sm:w-auto text-right">
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Total Tagihan</p>
                        <p className="text-4xl font-bold text-primary">{formatRupiah(total)}</p>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

function FileTextIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}
