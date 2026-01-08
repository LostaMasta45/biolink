"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight } from "lucide-react";

// Full list of 119 logos for the slider
const LOGOS = [
    "3SECOND JOMBANG_20251126_163410.png",
    "ABATA HOMESCHOOLING_20251126_163428.png",
    "AKBAR JAYA GROUP_20251126_163448.png",
    "ANEKA MEDIA ID_20251126_163541.png",
    "ARIES PUTRA_20251126_163608.png",
    "AURA BEAUTY CARE_20251126_163624.png",
    "AYUCITRA HIJAB_20251126_163646.png",
    "BABA GYOZA_20251126_163707.png",
    "BEAUTY STORE_20251126_163727.png",
    "BIMBEL GENIUS_20251126_163741.png",
    "CHURROCU JOMBANG_20251126_163803.png",
    "CLARICE BEAUTY CLINIC_20251126_163833.png",
    "COMU CAFFE_20251126_163850.png",
    "CV ALIANSYAH_20251126_163908.png",
    "CV HANEY ALAM SEJAHTERAH_20251126_163923.png",
    "CWIMEI SROJA_20251126_164004.png",
    "DELI GROUP_20251126_164027.png",
    "DHUHA SERVICE_20251126_164050.png",
    "DR ANANG WIB JOMBANG_20251126_164104.png",
    "EIGERINDO_20251126_164117.png",
    "ESTEH PRESIDEN_20251126_164130.png",
    "ESTEH SOLO INDONESIA_20251126_164144.png",
    "HAYDAN HEALTHY_20251126_164159.png",
    "ITS MONROE_20251126_164214.png",
    "KAUKABA STORE_20251126_164231.png",
    "KLINIK SAKINAH 74_20251126_164250.png",
    "LANTIKYA STORE_20251126_164306.png",
    "LOGO ABSHFRAGRANCE_20251126_165646.png",
    "LOGO AFINDO INFORMATIKA JOMBANG_20251126_165658.png",
    "LOGO ANEKA DROPSHIP_20251126_164331.png",
    "LOGO AP STORE JOMBANG_20251126_165711.png",
    "LOGO APOTEK SAMBONG DUKUH_20251126_165724.png",
    "LOGO ARTABOGA OFFICIAL_20251126_165736.png",
    "LOGO BBJ JOMBANG_20251126_165748.png",
    "LOGO CHICKROLL JOMBANG_20251126_165802.png",
    "LOGO CV. NR HERBAL CARE_20251126_165839.png",
    "LOGO CV. WAHANA SEJAHTERA FOODS_20251126_163052.png",
    "LOGO DJITOE COFFE_20251126_165910.png",
    "LOGO EAZYCOFFEE_20251126_165925.png",
    "LOGO GURU  IMBEL AHE ( KEDUNGPAPAR SUMOBITO )_20251126_170031.png",
    "LOGO HAKUI KOPI_20251126_170112.png",
    "LOGO INDOMARCO PRISMATAMA JOMBANG_20251126_163108.png",
    "LOGO J&T JOMBANG_20251126_170124.png",
    "LOGO JOMBANG POLOSAN_20251126_170137.png",
    "LOGO KEZIASPOT_20251126_163123.png",
    "LOGO LIBMIEDU_20251126_170203.png",
    "LOGO MAMA MEA JOMBANG_20251126_170223.png",
    "LOGO MITRA INDOTANI ABADI_20251126_163140.png",
    "LOGO MJM BATTERY_20251126_170235.png",
    "LOGO MRAYA OPTIK_20251126_170249.png",
    "LOGO MS GLOW BEAUTY JOMBANG_20251126_164346.png",
    "LOGO NARA GLAM_20251126_170329.png",
    "LOGO OIA STEAK_20251126_170356.png",
    "LOGO PAPAK AUTOCARE_20251126_170409.png",
    "LOGO PRIMA ACCOUNTING_20251126_170424.png",
    "LOGO PT PEIHAI_20251126_164403.png",
    "LOGO PT PESTAPORA ABADI_20251126_164421.png",
    "LOGO PT PHALOSARI UNGGUL JAYA_20251126_164436.png",
    "LOGO PT SALIM BROTHERS_20251126_164452.png",
    "LOGO PT SHOEI INDONESIA_20251126_164506.png",
    "LOGO PT. ALAM BAGA SHAKTI_20251126_163158.png",
    "LOGO PT. ANUGERAH MANDIRI SUKSESINDO_20251126_163219.png",
    "LOGO PT. FIRNANDO TEAM INDONESIA_20251126_163239.png",
    "LOGO PT. INDONESIA PRIORITAS SERVIS_20251126_170442.png",
    "LOGO PT. MATA ELANG PRIMA_20251126_163256.png",
    "LOGO PT. YAFIRA DIGITAL TECHNOLOGY_20251126_163311.png",
    "LOGO RASALOKA_20251126_170455.png",
    "LOGO RENA FACTORY_20251126_170508.png",
    "LOGO RUNCELL PATTIMURA_20251126_170522.png",
    "LOGO SBC GROUP_20251126_170534.png",
    "LOGO SCIENCE SOCIATY_20251126_170612.png",
    "LOGO SELLY SALON_20251126_164524.png",
    "LOGO SHICHI JAPANESE EATERY_20251126_170634.png",
    "LOGO SOMETHINC_20251126_164541.png",
    "LOGO SOSO GROUP_20251126_164556.png",
    "LOGO SPPG JOMBANG_20251126_163336.png",
    "LOGO SUMBERWANGI GRUP_20251126_170648.png",
    "LOGO SUZUKI AMM JOMBANG_20251126_170700.png",
    "LOGO TOPSELL_20251126_170732.png",
    "LOGO YAMAHA SEMPURNA MOTOR ( PETERONGAN)_20251126_163354.png",
    "MAJESTIC POOL N CAFE_20251126_164612.png",
    "MARINA COSMETIC_20251126_164627.png",
    "MASTER CHICKEN_20251126_164650.png",
    "MELLEBE BEAUTY STORE_20251126_164715.png",
    "MILENIAL MANDIRI CAREER_20251126_164730.png",
    "MISS CIMORY_20251126_164744.png",
    "MK SKIN_20251126_164758.png",
    "MODERN FASHION STORE_20251126_164813.png",
    "MOMOYO_20251126_164831.png",
    "MOOI DONAT_20251126_164847.png",
    "MULIA TRAVEL_20251126_164900.png",
    "NARA GLAM_20251126_164912.png",
    "NASI KEBULI ARAFH_20251126_164927.png",
    "NIBRAS HOUSE_20251126_164945.png",
    "NINETY HERO_20251126_165009.png",
    "OFERO INDONESIA_20251126_165029.png",
    "ORKA SHOES CARE_20251126_165041.png",
    "OT GROUP_20251126_165059.png",
    "OXY PARFUME_20251126_165113.png",
    "PANDALOVELY_20251126_165127.png",
    "PAUD AISYIYAH_20251126_165146.png",
    "PIZZA TARIK_20251126_165207.png",
    "POSKOPI ZIO_20251126_165227.png",
    "PT AIDAI INDONESIA_20251126_165239.png",
    "PT CHEIL JEDANG INDONESIA_20251126_165252.png",
    "PT KALLAZ INDONESIA_20251126_165306.png",
    "PT SAPTA KARYA MEGAH_20251126_165318.png",
    "PT SOLID ALODIA WIYJAYA_20251126_165332.png",
    "PT VENEZIA FOOT WEAR_20251126_165352.png",
    "PT XUILONG OUTDOOR_20251126_165412.png",
    "RESIK REK LAUNDRY_20251126_165428.png",
    "RGS APPAREL_20251126_165442.png",
    "ROCKET CHIKEN_20251126_165456.png",
    "SMAGROW_20251126_165514.png",
    "TARUNA CENDEKIA_20251126_165531.png",
    "TOKO EMAS GADJAH_20251126_165550.png",
    "TUNAS HONDA JOMBANG_20251126_165603.png",
    "VINASTKEI BEAUTY_20251126_165618.png",
    "WULING INDONESIA_20251126_165633.png"
];

const LOGO_PATH = "/LogoPerusahaan/";

export function CompanySlider() {
    // Triple the array to ensure smooth infinite scrolling without gaps
    const sliderContent = [...LOGOS, ...LOGOS, ...LOGOS];

    // Filter "LOGO " prefix for better display name
    const cleanName = (name: string) => {
        return name
            .replace(/^LOGO\s+/, "")
            .replace(/_\d+.*$/, "")
            .replace(/\.png$/, "");
    };

    return (
        <div className="w-full py-2 mb-2">
            <Dialog>
                <DialogTrigger asChild>
                    <div className="text-center mb-4 cursor-pointer group select-none">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary/80 transition-all border border-transparent hover:border-border/50">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
                                Telah Dipercaya oleh 200+ Perusahaan
                            </h3>
                            <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-all opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5" />
                        </div>
                    </div>
                </DialogTrigger>

                <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50">
                    <DialogHeader className="p-6 pb-2 border-b">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <span>🏢</span>
                            Partner Perusahaan
                            <span className="text-sm font-normal text-muted-foreground ml-auto bg-secondary px-2 py-0.5 rounded-md">
                                {LOGOS.length} Mitra
                            </span>
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="h-full p-6">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 pb-20">
                            {LOGOS.map((logo, index) => (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.005 }}
                                    key={`modal-${index}`}
                                    className="aspect-square bg-white rounded-xl shadow-sm border border-border/10 flex items-center justify-center p-4 hover:shadow-md hover:border-primary/20 transition-all group"
                                >
                                    <div className="relative w-full h-full">
                                        <Image
                                            src={`${LOGO_PATH}${encodeURIComponent(logo)}`}
                                            alt={cleanName(logo)}
                                            fill
                                            className="object-contain" // removed p-1 to allow fuller usage
                                            sizes="(max-width: 768px) 33vw, (max-width: 1200px) 25vw, 16vw"
                                        />
                                    </div>
                                    {/* Tooltip on hover could go here, but simple is better */}
                                </motion.div>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <div className="relative w-full overflow-hidden mask-gradient-x">
                {/* Left & Right Fade Masks */}
                <div className="absolute top-0 left-0 w-16 h-full bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                <div className="absolute top-0 right-0 w-16 h-full bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

                <motion.div
                    className="flex gap-4 w-fit" // Increased gap slightly
                    animate={{
                        x: ["0%", "-33.33%"],
                    }}
                    transition={{
                        duration: 200, // Slower speed (was 120)
                        ease: "linear",
                        repeat: Infinity,
                    }}
                >
                    {sliderContent.map((logo, index) => (
                        <div
                            key={`${logo}-${index}`}
                            className="relative w-16 h-16 flex-shrink-0 bg-white rounded-xl shadow-sm border border-border/10 flex items-center justify-center p-2"
                        >
                            <Image
                                src={`${LOGO_PATH}${encodeURIComponent(logo)}`}
                                alt="Company Logo"
                                fill
                                className="object-contain p-1"
                                sizes="64px"
                            />
                        </div>
                    ))}
                </motion.div>
            </div>
        </div>
    );
}
