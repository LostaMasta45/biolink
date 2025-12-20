"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, Phone, Building2, Calendar, Clock, Package, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatRupiah } from "@/lib/utils";
import type { PostingPackage, PostingAddon, QueuePost } from "@/lib/types";
import { uploadPoster, createPosting, updatePosting, calculateTotalPrice } from "@/lib/posting-service";
import toast from "react-hot-toast";

interface PostingFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    packages: PostingPackage[];
    addons: PostingAddon[];
    editData?: QueuePost | null;
    onSuccess: () => void;
}

export function PostingForm({ open, onOpenChange, packages, addons, editData, onSuccess }: PostingFormProps) {
    // Form state
    const [companyName, setCompanyName] = useState("");
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [scheduledDate, setScheduledDate] = useState("");
    const [scheduledTime, setScheduledTime] = useState("10:00");
    const [selectedPackageId, setSelectedPackageId] = useState<number>(3); // Default to popular
    const [selectedAddons, setSelectedAddons] = useState<number[]>([]);
    const [notes, setNotes] = useState("");

    // Poster state
    const [posterFile, setPosterFile] = useState<File | null>(null);
    const [posterPreview, setPosterPreview] = useState<string | null>(null);
    const [existingPosterUrl, setExistingPosterUrl] = useState<string | null>(null);

    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Populate form when editing
    useEffect(() => {
        if (editData) {
            setCompanyName(editData.company_name);
            setWhatsappNumber(editData.whatsapp_number);
            setScheduledDate(editData.scheduled_date);
            setScheduledTime(editData.scheduled_time || "10:00");
            setSelectedPackageId(editData.package_id);
            setSelectedAddons(editData.addons || []);
            setNotes(editData.notes || "");
            setExistingPosterUrl(editData.poster_url || null);
        } else {
            resetForm();
        }
    }, [editData, open]);

    const resetForm = () => {
        setCompanyName("");
        setWhatsappNumber("");
        setScheduledDate(new Date().toISOString().split("T")[0]);
        setScheduledTime("10:00");
        setSelectedPackageId(3);
        setSelectedAddons([]);
        setNotes("");
        setPosterFile(null);
        setPosterPreview(null);
        setExistingPosterUrl(null);
    };

    // Calculate total price
    const selectedPackage = packages.find(p => p.id === selectedPackageId);
    const totalPrice = calculateTotalPrice(
        selectedPackage?.price || 0,
        addons,
        selectedAddons
    );

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("Ukuran file maksimal 5MB");
                return;
            }
            setPosterFile(file);
            setPosterPreview(URL.createObjectURL(file));
            setExistingPosterUrl(null);
        }
    };

    const handleRemovePoster = () => {
        setPosterFile(null);
        setPosterPreview(null);
        setExistingPosterUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Handle addon toggle
    const toggleAddon = (addonId: number) => {
        setSelectedAddons(prev =>
            prev.includes(addonId)
                ? prev.filter(id => id !== addonId)
                : [...prev, addonId]
        );
    };

    // Handle form submit
    const handleSubmit = async () => {
        // Validation
        if (!companyName.trim()) {
            toast.error("Nama perusahaan harus diisi");
            return;
        }
        if (!whatsappNumber.trim()) {
            toast.error("Nomor WhatsApp harus diisi");
            return;
        }
        if (!scheduledDate) {
            toast.error("Tanggal posting harus diisi");
            return;
        }

        setIsSubmitting(true);

        try {
            let posterUrl = existingPosterUrl;

            // Upload new poster if selected
            if (posterFile) {
                const { url, error: uploadError } = await uploadPoster(posterFile);
                if (uploadError) {
                    toast.error(`Gagal upload poster: ${uploadError}`);
                    setIsSubmitting(false);
                    return;
                }
                posterUrl = url;
            }

            const postingData = {
                company_name: companyName.trim(),
                whatsapp_number: whatsappNumber.trim(),
                poster_url: posterUrl || undefined,
                scheduled_date: scheduledDate,
                scheduled_time: scheduledTime,
                package_id: selectedPackageId,
                addons: selectedAddons,
                total_price: totalPrice,
                status: "draft" as const,
                notes: notes.trim() || undefined,
            };

            if (editData) {
                // Update existing
                const { error } = await updatePosting(editData.id, postingData);
                if (error) {
                    toast.error(`Gagal update: ${error}`);
                    return;
                }
                toast.success("Posting berhasil diupdate!");
            } else {
                // Create new
                const { error } = await createPosting(postingData);
                if (error) {
                    toast.error(`Gagal membuat posting: ${error}`);
                    return;
                }
                toast.success("Posting berhasil ditambahkan!");
            }

            onSuccess();
            onOpenChange(false);
            resetForm();
        } catch (err) {
            console.error(err);
            toast.error("Terjadi kesalahan");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] p-0">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        {editData ? "Edit Posting" : "Tambah Posting Baru"}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(90vh-140px)]">
                    <div className="p-6 space-y-6">
                        {/* Company & WhatsApp */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4" />
                                    Nama Perusahaan
                                </Label>
                                <Input
                                    placeholder="PT Contoh Sejahtera"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    Nomor WhatsApp
                                </Label>
                                <Input
                                    placeholder="081234567890"
                                    value={whatsappNumber}
                                    onChange={(e) => setWhatsappNumber(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Poster Upload */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Poster Lowongan
                            </Label>
                            <div
                                className={cn(
                                    "relative border-2 border-dashed rounded-xl transition-colors",
                                    "hover:border-primary/50 hover:bg-primary/5",
                                    posterPreview || existingPosterUrl ? "border-primary" : "border-muted-foreground/30"
                                )}
                            >
                                {posterPreview || existingPosterUrl ? (
                                    <div className="relative aspect-[4/3] max-h-[300px] overflow-hidden rounded-lg">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={posterPreview || existingPosterUrl || ""}
                                            alt="Poster preview"
                                            className="w-full h-full object-contain bg-muted"
                                        />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-2 right-2 h-8 w-8"
                                            onClick={handleRemovePoster}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center py-10 cursor-pointer">
                                        <Upload className="w-10 h-10 text-muted-foreground/50 mb-3" />
                                        <span className="text-sm text-muted-foreground">
                                            Klik atau drag & drop untuk upload
                                        </span>
                                        <span className="text-xs text-muted-foreground/70 mt-1">
                                            PNG, JPG, max 5MB
                                        </span>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Tanggal Posting
                                </Label>
                                <Input
                                    type="date"
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Jam Posting
                                </Label>
                                <Input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Package Selection */}
                        <div className="space-y-3">
                            <Label className="flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                Pilih Paket
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {packages.map((pkg) => (
                                    <div
                                        key={pkg.id}
                                        onClick={() => setSelectedPackageId(pkg.id)}
                                        className={cn(
                                            "relative p-4 rounded-xl border-2 cursor-pointer transition-all",
                                            "hover:border-primary/50 hover:shadow-md",
                                            selectedPackageId === pkg.id
                                                ? "border-primary bg-primary/5 shadow-md"
                                                : "border-border"
                                        )}
                                    >
                                        {pkg.is_popular && (
                                            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                                                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-500 text-white rounded-full">
                                                    <Sparkles className="w-3 h-3" />
                                                    Favorit
                                                </span>
                                            </div>
                                        )}
                                        <div className="text-center">
                                            <h4 className="font-semibold">{pkg.name}</h4>
                                            <p className="text-xl font-bold text-primary mt-1">
                                                {formatRupiah(pkg.price)}
                                            </p>
                                            {pkg.description && (
                                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                                    {pkg.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Add-ons */}
                        <div className="space-y-3">
                            <Label>Tambahan (Opsional)</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {addons.map((addon) => (
                                    <div
                                        key={addon.id}
                                        onClick={() => toggleAddon(addon.id)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                            "hover:border-primary/50 hover:bg-primary/5",
                                            selectedAddons.includes(addon.id)
                                                ? "border-primary bg-primary/5"
                                                : "border-border"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                                            selectedAddons.includes(addon.id)
                                                ? "bg-primary border-primary"
                                                : "border-muted-foreground/30"
                                        )}>
                                            {selectedAddons.includes(addon.id) && (
                                                <Check className="w-3 h-3 text-primary-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{addon.name}</p>
                                        </div>
                                        <span className="text-sm font-semibold text-primary whitespace-nowrap">
                                            +{formatRupiah(addon.price)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label>Catatan (Opsional)</Label>
                            <Textarea
                                placeholder="Catatan tambahan..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                </ScrollArea>

                {/* Footer with Total */}
                <DialogFooter className="p-6 pt-0 border-t bg-muted/30">
                    <div className="flex items-center justify-between w-full gap-4">
                        <div className="text-left">
                            <p className="text-sm text-muted-foreground">Total Harga</p>
                            <p className="text-2xl font-bold text-primary">{formatRupiah(totalPrice)}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Batal
                            </Button>
                            <Button onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? "Menyimpan..." : editData ? "Update" : "Simpan"}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
