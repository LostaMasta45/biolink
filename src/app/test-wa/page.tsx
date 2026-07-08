"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TestWaPage() {
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_whatsapp: "",
    package_name: "Paket Premium (Test)",
    amount: 150000
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{success: boolean, message: string} | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/test-wa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult({ success: true, message: data.message });
        setFormData(prev => ({ ...prev, customer_name: "", customer_whatsapp: "" })); // reset partial
      } else {
        setResult({ success: false, message: data.message + (data.error ? ` (${data.error})` : "") });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message || "Gagal menghubungi server" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 sm:p-8 flex items-center justify-center font-sans">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
        <div className="bg-primary p-6 text-primary-foreground text-center">
          <h1 className="text-2xl font-bold">Simulator Pembayaran</h1>
          <p className="text-primary-foreground/80 text-sm mt-1">
            Test Notifikasi WhatsApp Kirimdev
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="customer_name">Nama Lengkap</Label>
            <Input 
              id="customer_name" 
              name="customer_name" 
              placeholder="Misal: Budi Santoso"
              required 
              value={formData.customer_name} 
              onChange={handleChange} 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_whatsapp">Nomor WhatsApp</Label>
            <Input 
              id="customer_whatsapp" 
              name="customer_whatsapp" 
              placeholder="Misal: 081234567890" 
              required 
              value={formData.customer_whatsapp} 
              onChange={handleChange} 
            />
            <p className="text-xs text-muted-foreground">Pastikan nomor aktif dan terdaftar di WhatsApp.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="package_name">Pilih Paket (Dummy)</Label>
            <Input 
              id="package_name" 
              name="package_name" 
              value={formData.package_name} 
              onChange={handleChange} 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Nominal Pembayaran (Rp)</Label>
            <Input 
              id="amount" 
              name="amount" 
              type="number"
              value={formData.amount} 
              onChange={handleChange} 
            />
          </div>

          {result && (
            <div className={`p-4 rounded-xl text-sm font-medium ${result.success ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
              {result.message}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold mt-4 rounded-xl">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Memproses Pembayaran...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Bayar & Kirim Pesan WA
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
