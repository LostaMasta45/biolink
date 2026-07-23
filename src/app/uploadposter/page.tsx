import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MessageCircle, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface UploadPosterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function UploadPosterPage({ searchParams }: UploadPosterPageProps) {
  const params = await searchParams;
  const resumeToken = firstParam(params.resume || params.token).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resumeToken)) {
    redirect(`/payment?resume=${encodeURIComponent(resumeToken)}`);
  }
  const adminWhatsapp = String(process.env.KIRIMDEV_PHONE_NUMBER_1 || "")
    .replace(/\D/g, "")
    .replace(/^0/, "62");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-50 px-4 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-emerald-100/70 to-transparent" />
      <Card className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border-emerald-100 bg-white shadow-xl">
        <CardContent className="p-7 text-center sm:p-10">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Upload className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Upload Poster melalui Link Pesanan
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
            Demi keamanan data, poster hanya dapat diunggah melalui link QRIS atau invoice
            yang terhubung langsung dengan pesanan Anda.
          </p>

          <div className="my-7 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-left">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="text-sm font-bold text-emerald-950">Nomor WhatsApp saja tidak digunakan lagi</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  Sistem membutuhkan token pesanan agar poster tidak tertaut ke transaksi customer lain.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Link href="/payment" className="block">
              <Button className="h-12 w-full rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800">
                Buka Halaman Pembayaran <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            {adminWhatsapp && (
              <a
                href={`https://wa.me/${adminWhatsapp}?text=Halo%20Admin%20InfoLokerJombang%2C%20saya%20membutuhkan%20link%20untuk%20upload%20poster%20pesanan.`}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <Button variant="outline" className="h-12 w-full rounded-xl font-bold">
                  <MessageCircle className="mr-2 h-4 w-4" /> Minta Link ke Admin
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
