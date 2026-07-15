"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function DeleteConfirmation({ label, onConfirm }: { label: string; onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); setOpen(false); } finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="icon" variant="ghost" aria-label={`Hapus ${label}`}><Trash2 className="text-destructive" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Hapus {label}?</DialogTitle><DialogDescription>Tindakan ini tidak dapat dibatalkan. Relasi terkait akan mengikuti aturan database.</DialogDescription></DialogHeader>
        <DialogFooter><DialogClose asChild><Button variant="outline">Batal</Button></DialogClose><Button variant="destructive" disabled={loading} onClick={handleConfirm}>{loading ? "Menghapus..." : "Hapus"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

