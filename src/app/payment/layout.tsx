import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Bayar Pasang Loker | InfoLokerJombang",
    description: "Bayar cepat via QRIS untuk pasang lowongan kerja di InfoLokerJombang. Pilih paket, isi data, bayar langsung!",
};

export default function PaymentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background">
            {children}
        </div>
    );
}
