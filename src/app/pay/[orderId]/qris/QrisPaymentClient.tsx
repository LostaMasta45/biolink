"use client";

import { QrisDisplay } from "@/components/payment/qris-display";
import { useRouter } from "next/navigation";

interface QrisPaymentClientProps {
  orderId: string;
  accessToken: string;
  totalAmount: number;
  qrisImage: string | null;
  qrisUrl: string | null;
  expiredAt: string;
  packageName: string;
}

export default function QrisPaymentClient(props: QrisPaymentClientProps) {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:py-12">
      <div className="mx-auto mb-6 max-w-md text-center md:mb-8">
        <p className="text-sm font-semibold text-emerald-600">Pembayaran QRIS</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {props.packageName}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Scan QRIS di bawah untuk menyelesaikan pembayaran. Status akan diperbarui otomatis.
        </p>
      </div>
      <QrisDisplay
        orderId={props.orderId}
        accessToken={props.accessToken}
        totalAmount={props.totalAmount}
        qrisImage={props.qrisImage}
        qrisUrl={props.qrisUrl}
        expiredAt={props.expiredAt}
        onPaymentSuccess={() => router.replace(`/payment?resume=${encodeURIComponent(props.accessToken)}`)}
        onPaymentExpired={() => undefined}
      />
    </main>
  );
}
