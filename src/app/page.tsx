"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Instagram,
  Facebook,
  Phone,
  Briefcase,
  MapPin,
  Globe,
  Mail,
  MoreHorizontal,
  Verified,
  ChevronRight,
  Send,
  ExternalLink,
  MessageCircle,
  Sparkles,
  ArrowLeft,
  Share2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";
import { usePlatform } from "@/hooks/use-platform";
import { CompanySlider } from "@/components/company-slider";

// Profile Data
const profile = {
  username: "infolokerjombang",
  displayName: "@infolokerjombang",
  category: "Recruitment & Employment Agency",
  bio: "Info Loker Jombang #1 🏆\nCari kerja? Kami bantu! 💼\n#lokerjombang #lowongankerja",
  website: "infolokerjombang.net",
  avatarUrl: "/profile.png",
};

const links = [
  {
    id: "wa-pasang",
    label: "PASANG LOWONGAN KERJA",
    subLabel: "WA khusus pasang",
    url: "https://api.whatsapp.com/send/?phone=6283122866975&text=Hallo+Min%2C+Mau+Pasang+Loker+di+%40infolokerjombang&type=phone_number&app_absent=0",
    icon: Phone,
    color: "bg-green-500",
    // Premium button has its own hardcoded style
    baseTint: "border-green-500/30 bg-green-500/5",
    textHover: "group-hover:text-green-600 dark:group-hover:text-green-400"
  },
  {
    id: "instagram",
    label: "INSTAGRAM OFFICIAL",
    subLabel: "@infolokerjombang",
    url: "https://instagram.com/infolokerjombang",
    icon: Instagram,
    color: "bg-pink-600",
    baseTint: "border-pink-500/20 bg-pink-500/5 dark:bg-pink-500/10",
    textHover: "text-pink-600/90 dark:text-pink-400/90 group-hover:text-pink-600 dark:group-hover:text-pink-400"
  },
  {
    id: "facebook-1",
    label: "GRUB FACEBOOK 1",
    subLabel: "Komunitas Loker Jombang",
    url: "https://www.facebook.com/groups/infolokerjombangofficial",
    icon: Facebook,
    color: "bg-blue-600",
    baseTint: "border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10",
    textHover: "text-blue-600/90 dark:text-blue-400/90 group-hover:text-blue-600 dark:group-hover:text-blue-400"
  },
  {
    id: "facebook-2",
    label: "GRUB FACEBOOK 2",
    subLabel: "Info Loker Jombang",
    url: "https://www.facebook.com/groups/infolokerjombangofficial",
    icon: Facebook,
    color: "bg-blue-700",
    baseTint: "border-blue-600/20 bg-blue-600/5 dark:bg-blue-600/10",
    textHover: "text-blue-700/90 dark:text-blue-400/90 group-hover:text-blue-700 dark:group-hover:text-blue-400"
  },
  {
    id: "wa-channel",
    label: "SALURAN WHATSAPP",
    subLabel: "Update Info via Channel",
    url: "https://whatsapp.com/channel/0029Vb6x1Io3rZZd0HL0n017",
    icon: MessageCircle,
    color: "bg-emerald-600",
    baseTint: "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10",
    textHover: "text-emerald-600/90 dark:text-emerald-400/90 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
  },
  {
    id: "ig-channel",
    label: "SALURAN INSTAGRAM",
    subLabel: "Broadcast Instagram",
    url: "https://www.instagram.com/channel/AbbUBGXrX2tahexw/",
    icon: Send,
    color: "bg-fuchsia-600",
    baseTint: "border-fuchsia-500/20 bg-fuchsia-500/5 dark:bg-fuchsia-500/10",
    textHover: "text-fuchsia-600/90 dark:text-fuchsia-400/90 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400"
  },
];

const highlights = [
  { id: 1, title: "Testimoni", img: "⭐" },
  { id: 2, title: "Pricelist", img: "💰" },
  { id: 3, title: "Lokasi", img: "📍" },
  { id: 4, title: "Event", img: "🎉" },
];

const BackgroundGlow = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[100px] animate-pulse" />
    <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 rounded-full blur-[100px] animate-pulse delay-1000" />
    <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[100px] animate-pulse delay-2000" />
  </div>
);

// Native Mobile Header for APK
const NativeHeader = () => (
  <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/20 safe-area-top">
    {/* Safe area padding for notch/status bar */}
    <div className="pt-[env(safe-area-inset-top)]" />
    <div className="flex items-center justify-between px-4 h-14">
      <div className="flex items-center gap-3">
        <Avatar className="w-8 h-8 border-2 border-primary/20">
          <AvatarImage src="/profile.png" />
          <AvatarFallback>ILJ</AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-1">
          <span className="font-bold text-base">ILJ Hub</span>
          <Verified className="w-4 h-4 text-blue-500 fill-blue-500" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted/50 active:scale-95 transition-all">
          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
);

export default function Home() {
  const { isNativeApp } = usePlatform();
  const [stats, setStats] = useState({ posts: "9.800+", followers: "205rb" });

  useEffect(() => {
    // Fetch Instagram stats from API
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/instagram-stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch Instagram stats", err);
      }
    };
    fetchStats();
  }, []);

  const containerVars = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVars = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="theme-biolink min-h-screen bg-background/50 text-foreground font-sans relative overflow-x-hidden selection:bg-primary/30">
      <BackgroundGlow />

      {/* Native Header for APK */}
      {isNativeApp && <NativeHeader />}

      {/* Navbar / Top Bar with Glassmorphism - Hidden on Mobile & APK */}
      {!isNativeApp && (
        <div className="hidden sm:flex justify-between items-center px-4 py-3 border-b border-border/10 sticky top-0 bg-background/60 backdrop-blur-xl z-50 shadow-sm transition-all duration-300">
          <div className="flex items-center gap-1 font-bold text-lg">
            <span>{profile.username}</span>
            <Verified className="w-4 h-4 text-blue-500 fill-blue-500 text-white" />
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <MoreHorizontal className="w-6 h-6" />
          </div>
        </div>
      )}

      <main className={cn(
        "max-w-md mx-auto px-4 pb-20 relative",
        isNativeApp ? "pt-4" : "pt-6"
      )}>
        {/* Mobile Mode Toggle (Absolute Top Right) - Only for Web */}
        {!isNativeApp && (
          <div className="absolute top-4 right-4 sm:hidden z-50">
            <ModeToggle />
          </div>
        )}

        {/* Profile Header (Centered Layout) */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* 1. Avatar */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative mb-4"
          >
            {/* Animated Rings */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
              className="absolute -inset-2 rounded-full bg-gradient-to-tr from-green-500 via-emerald-400 to-blue-500 p-[2px] opacity-80 blur-sm"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
              className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-green-600 via-emerald-500 to-blue-600 p-[2px]"
            >
              <div className="rounded-full bg-background p-[2px] w-full h-full"></div>
            </motion.div>

            <Avatar className="w-28 h-28 sm:w-32 sm:h-32 border-4 border-background relative z-10 shadow-2xl">
              <AvatarImage src={profile.avatarUrl} className="object-cover" />
              <AvatarFallback>ILJ</AvatarFallback>
            </Avatar>

            {/* Verification Badge Absolute Positioned */}
            <div className="absolute bottom-1 right-1 z-20 bg-background rounded-full p-1 shadow-sm">
              <Verified className="w-6 h-6 text-blue-500 fill-blue-500 text-white" />
            </div>
          </motion.div>

          {/* 2. Bio & Description */}
          <div className="space-y-2 mb-6 max-w-sm">
            <h1 className="font-bold text-2xl tracking-tight">{profile.displayName}</h1>
            <Badge variant="secondary" className="mb-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none px-3 py-1">
              {profile.category}
            </Badge>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {profile.bio}
            </p>
            <a
              href={`https://${profile.website}`}
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium text-sm hover:underline mt-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {profile.website}
            </a>
          </div>

          {/* 3. Stats (Glass Card) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="grid grid-cols-3 gap-0 w-full max-w-[340px] bg-gradient-to-b from-white/10 to-white/5 dark:from-white/5 dark:to-transparent backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden group"
          >
            {/* Background decorative elements */}
            <div className="absolute top-0 left-1/4 w-1/2 h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

            <div className="flex flex-col items-center justify-center relative z-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-1"
              >
                <Briefcase className="w-4 h-4" />
              </motion.div>
              <span className="font-bold text-lg leading-tight text-foreground">{stats.posts}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Lowongan</span>
            </div>

            <div className="flex flex-col items-center justify-center relative z-10 border-x border-white/10 dark:border-white/5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
                className="w-8 h-8 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center mb-1"
              >
                <User className="w-4 h-4" />
              </motion.div>
              <span className="font-bold text-lg leading-tight text-foreground">{stats.followers}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Follower</span>
            </div>

            <div className="flex flex-col items-center justify-center relative z-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
                className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-1"
              >
                <Verified className="w-4 h-4" />
              </motion.div>
              <span className="font-bold text-lg leading-tight text-foreground">200++</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Perusahaan</span>
            </div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-8">
          <Button asChild className="flex-1 bg-primary text-white hover:bg-primary/90 font-semibold h-8 text-sm">
            <a href="https://instagram.com/infolokerjombang" target="_blank" rel="noopener noreferrer">
              Follow
            </a>
          </Button>
          <Button asChild variant="secondary" className="flex-1 h-8 text-sm font-semibold border border-border">
            <a href="https://instagram.com/infolokerjombang" target="_blank" rel="noopener noreferrer">
              Message
            </a>
          </Button>
        </div>

        {/* Story Highlights Removed */}


        {/* Company Logo Slider */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mb-6"
        >
          <CompanySlider />
        </motion.div>

        {/* Links List - "Content" */}
        <motion.div
          variants={containerVars}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="h-[1px] flex-1 bg-border"></div>
            <span className="text-xs font-semibold text-muted-foreground">QUICK LINKS</span>
            <div className="h-[1px] flex-1 bg-border"></div>
          </div>

          {links.map((link) => {
            const isPremium = link.id === "wa-pasang";

            // Special Premium Card for WA Pasang
            if (isPremium) {
              return (
                <motion.a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variants={itemVars}
                  whileHover={{ scale: 1.03, y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  className="block group relative"
                >
                  {/* Outer Glow */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-3xl blur-lg opacity-40 group-hover:opacity-70 transition-all duration-500 animate-pulse" />

                  {/* Main Card */}
                  <div className="relative bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-5 border border-emerald-500/30 overflow-hidden shadow-2xl">
                    {/* Animated Background Pattern */}
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.3),transparent_50%)]" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(20,184,166,0.3),transparent_50%)]" />
                    </div>

                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />

                    {/* Top Badge */}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-amber-500/30">
                      <Sparkles className="w-3 h-3" />
                      HOT
                    </div>

                    {/* Content */}
                    <div className="relative flex items-center gap-4 mt-2">
                      {/* Icon Container */}
                      <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500 rounded-2xl blur-md opacity-60" />
                        <div className="relative w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-emerald-500/20">
                          <Phone className="w-7 h-7 text-white drop-shadow-md" />
                        </div>
                        {/* Pulse Ring */}
                        <div className="absolute -inset-1 rounded-2xl border-2 border-emerald-400/50 animate-ping opacity-30" />
                      </div>

                      {/* Text */}
                      <div className="flex-1">
                        <h3 className="font-extrabold text-lg text-white tracking-tight leading-tight mb-1 drop-shadow-sm">
                          PASANG LOWONGAN
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <MessageCircle className="w-3 h-3" />
                            WA Khusus Admin
                          </span>
                        </div>
                      </div>

                      {/* Arrow Button */}
                      <div className="relative">
                        <div className="absolute inset-0 bg-emerald-400 rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
                        <div className="relative w-11 h-11 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                          <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Accent Line */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                  </div>
                </motion.a>
              );
            }

            // Regular Links
            return (
              <motion.a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                variants={itemVars}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="block group"
              >
                <Card className={cn(
                  "relative overflow-hidden border transition-all duration-300 shadow-sm group",
                  "flex items-center p-3.5 gap-4",
                  "hover:shadow-md backdrop-blur-sm bg-background/40 hover:bg-background/60",
                  link.baseTint
                )}>
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3",
                      link.color
                    )}
                  >
                    <link.icon className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0 z-10">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-base tracking-tight leading-none mb-1 text-foreground group-hover:text-primary transition-colors">
                        {link.label}
                      </span>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors truncate">
                        {link.subLabel}
                      </span>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 bg-transparent text-muted-foreground/50 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-hover:bg-primary/10 group-hover:text-primary">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </Card>
              </motion.a>
            );
          })}
        </motion.div>
      </main>
    </div>
  );
}
