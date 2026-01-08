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
    const [posterFiles, setPosterFiles] = useState<File[]>([]);
    const [posterPreviews, setPosterPreviews] = useState<string[]>([]);
    const [existingGallery, setExistingGallery] = useState<string[]>([]);

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

            // Handle existing gallery
            if (editData.gallery && editData.gallery.length > 0) {
                setExistingGallery(editData.gallery);
            } else if (editData.poster_url) {
                // Fallback for old single url data
                setExistingGallery([editData.poster_url]);
            } else {
                setExistingGallery([]);
            }
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
        setPosterFiles([]);
        setPosterPreviews([]);
        setExistingGallery([]);
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
        const files = Array.from(e.target.files || []);

        const validFiles: File[] = [];
        const newPreviews: string[] = [];

        files.forEach(file => {
            // Increased limit to 50MB
            if (file.size > 50 * 1024 * 1024) {
                toast.error(`File ${file.name} terlalu besar (max 50MB)`);
                return;
            }
            validFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
        });

        if (validFiles.length > 0) {
            setPosterFiles(prev => [...prev, ...validFiles]);
            setPosterPreviews(prev => [...prev, ...newPreviews]);
        }

        // Reset input for consistent change events
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleRemoveNew = (index: number) => {
        setPosterFiles(prev => prev.filter((_, i) => i !== index));
        setPosterPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveExisting = (index: number) => {
        setExistingGallery(prev => prev.filter((_, i) => i !== index));
    };

    // Handle addon toggle
    const toggleAddon = (addonId: number) => {
        setSelectedAddons(prev =>
            prev.includes(addonId)
                ? prev.filter(id => id !== addonId)
                : [...prev, addonId]
        );
    };

    // Handle WhatsApp Formatting
    const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, ""); // Remove non-digits

        // Auto-format logic
        if (value.startsWith("0")) {
            value = "62" + value.slice(1);
        } else if (value.startsWith("8")) {
            value = "62" + value;
        }

        setWhatsappNumber(value);
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
            // Start with existing gallery
            const finalGallery = [...existingGallery];

            // Upload new posters
            if (posterFiles.length > 0) {
                const uploadPromises = posterFiles.map(file => uploadPoster(file));
                const results = await Promise.all(uploadPromises);

                // Check for errors
                const failed = results.filter(r => r.error);
                if (failed.length > 0) {
                    toast.error(`Gagal upload ${failed.length} gambar`);
                    setIsSubmitting(false);
                    return;
                }

                // Collect successful URLs
                results.forEach(r => {
                    if (r.url) finalGallery.push(r.url);
                });
            }

            const postingData = {
                company_name: companyName.trim(),
                whatsapp_number: whatsappNumber.trim(),
                gallery: finalGallery,
                poster_url: undefined, // Let service handle joining
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
                                    placeholder="6281234567890"
                                    value={whatsappNumber}
                                    onChange={handleWhatsappChange}
                                />
                            </div>
                        </div>

                        {/* Poster Upload */}
                        <div className="space-y-4">
                            <Label className="flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Poster Lowongan
                            </Label>

                            {/* Gallery Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {/* Existing & New Previews */}
                                {[...(existingGallery || []), ...posterPreviews].map((url, index) => (
                                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden border bg-muted group">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={url}
                                            alt={`Poster ${index + 1}`}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="h-8 w-8 rounded-full"
                                                onClick={() => {
                                                    // Determine if it's an existing URL or a new file preview
                                                    const existingCount = existingGallery?.length || 0;
                                                    if (index < existingCount) {
                                                        handleRemoveExisting(index);
                                                    } else {
                                                        handleRemoveNew(index - existingCount);
                                                    }
                                                }}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                {/* Add Button */}
                                <label className={cn(
                                    "relative aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all",
                                    "hover:border-primary/50 hover:bg-primary/5 border-muted-foreground/30",
                                    (existingGallery?.length || 0) + posterFiles.length === 0 ? "col-span-2 md:col-span-3 aspect-[3/1]" : ""
                                )}>
                                    <div className="flex flex-col items-center gap-2 p-4 text-center">
                                        <div className="p-3 bg-muted rounded-full">
                                            <Upload className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium">
                                                {(existingGallery?.length || 0) + posterFiles.length === 0 ? "Upload Poster" : "Tambah Poster"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                PNG, JPG (Max 5MB)
                                            </p>
                                        </div>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />
                                </label>
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
