import { NavLink } from "react-router-dom";
import { LayoutDashboard, Upload, ReceiptText, RefreshCw, MessageCircleHeart } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, color: "bg-sky", end: true },
  { to: "/upload", label: "Upload", icon: Upload, color: "bg-mint" },
  { to: "/receipts", label: "Receipts", icon: ReceiptText, color: "bg-butter" },
  { to: "/subscriptions", label: "Subs", icon: RefreshCw, color: "bg-lilac" },
  { to: "/assistant", label: "Sameer", icon: MessageCircleHeart, color: "bg-hotpink" },
];

export function NavBar() {
  return (
    <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
      {links.map(({ to, label, icon: Icon, color, end }) => (
        <NavLink key={to} to={to} end={end}>
          {({ isActive }) => (
            <span
              className={cn(
                "press inline-flex items-center gap-2 rounded-lg border-[3px] border-ink px-3 py-2",
                "font-mono text-xs font-bold uppercase tracking-widest shadow-hard-sm",
                isActive ? color : "bg-white",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.75} />
              {label}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
