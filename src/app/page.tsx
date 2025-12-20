"use client";

import { motion } from "framer-motion";
import {
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
  Sparkles
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

// Profile Data
const profile = {
  username: "infolokerjombang",
  displayName: "Loker Jombang & Tentang Jombang",
  category: "Recruitment & Employment Agency",
  bio: "Info Loker Jombang #1 🏆\nCari kerja? Kami bantu! 💼\n#lokerjombang #lowongankerja",
  website: "infolokerjombang.net",
  avatarUrl: "/profile.png",
  stats: {
    posts: "9.755",
    followers: "205 rb",
    following: "1.155",
  },
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

export default function Home() {
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

      {/* Navbar / Top Bar with Glassmorphism */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-border/10 sticky top-0 bg-background/60 backdrop-blur-xl z-50 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-1 font-bold text-lg">
          <span>{profile.username}</span>
          <Verified className="w-4 h-4 text-blue-500 fill-blue-500 text-white" />
        </div>
        <div className="flex items-center gap-4">
          <ModeToggle />
          <MoreHorizontal className="w-6 h-6" />
        </div>
      </div>

      <main className="max-w-md mx-auto pt-6 px-4 pb-20">
        {/* Profile Header */}
        <div className="flex items-center justify-between mb-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
              className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-green-500 via-emerald-400 to-blue-500 p-[2px] opacity-80 blur-sm"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
              className="absolute -inset-1 rounded-full bg-gradient-to-tr from-green-600 via-emerald-500 to-blue-600 p-[2px]"
            >
              <div className="rounded-full bg-background p-[2px] w-full h-full"></div>
            </motion.div>
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-background relative z-10 shadow-xl">
              <AvatarImage src={profile.avatarUrl} className="object-cover" />
              <AvatarFallback>ILJ</AvatarFallback>
            </Avatar>
          </motion.div>

          <div className="flex-1 flex justify-around text-center ml-4">
            <div>
              <div className="font-bold text-lg sm:text-xl">{profile.stats.posts}</div>
              <div className="text-xs sm:text-sm text-center">kiriman</div>
            </div>
            <div>
              <div className="font-bold text-lg sm:text-xl">{profile.stats.followers}</div>
              <div className="text-xs sm:text-sm text-center">pengikut</div>
            </div>
            <div>
              <div className="font-bold text-lg sm:text-xl">{profile.stats.following}</div>
              <div className="text-xs sm:text-sm text-center">diikuti</div>
            </div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="space-y-1 mb-6">
          <div className="font-bold">{profile.displayName}</div>
          <div className="text-muted-foreground text-sm">{profile.category}</div>
          <div className="whitespace-pre-line text-sm leading-relaxed">{profile.bio}</div>
          <a
            href={`https://${profile.website}`}
            className="text-blue-900 dark:text-blue-400 font-medium text-sm flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            {profile.website}
          </a>
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
                  "flex items-center p-3 gap-4 backdrop-blur-sm border transition-all duration-300 shadow-sm relative overflow-hidden group",
                  isPremium
                    ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 active:scale-95"
                    : cn(
                      "hover:shadow-md active:scale-95",
                      link.baseTint // Permanent tint applied here
                    )
                )}>
                  {/* Premium Shine Effect */}
                  {isPremium && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite] pointer-events-none" />
                  )}

                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg transform group-hover:rotate-6 transition-transform duration-300 relative z-10",
                      link.color,
                      isPremium && "shadow-emerald-500/20 ring-2 ring-emerald-500/20"
                    )}
                  >
                    <link.icon className={cn("w-5 h-5", isPremium && "animate-pulse")} />
                  </div>

                  <div className="flex-1 min-w-0 relative z-10">
                    <div className="font-bold text-sm truncate flex items-center gap-2">
                      <span className={cn(
                        isPremium
                          ? "bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent font-extrabold tracking-wide"
                          : cn("transition-colors", link.textHover) // Permanent colored text
                      )}>
                        {link.label}
                      </span>
                      {isPremium && (
                        <Verified className="w-4 h-4 text-emerald-500 fill-emerald-500 text-white animate-bounce" />
                      )}
                    </div>
                    <div className={cn("text-xs truncate", isPremium ? "text-emerald-600/80 dark:text-emerald-400/80 font-medium" : "text-muted-foreground")}>
                      {link.subLabel}
                    </div>
                  </div>

                  <div className={cn("p-1 rounded-full transition-all", isPremium ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-background/20")}>
                    <ChevronRight className={cn("w-4 h-4 transition-transform group-hover:translate-x-0.5", !isPremium && "text-muted-foreground/70 group-hover:text-foreground")} />
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
