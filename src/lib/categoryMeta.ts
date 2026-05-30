import {
  ShoppingCart,
  UtensilsCrossed,
  Car,
  RefreshCw,
  ShoppingBag,
  Clapperboard,
  HeartPulse,
  ReceiptText,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "./database.types";

export const CATEGORY_META: Record<Category, { color: string; icon: LucideIcon }> = {
  Groceries: { color: "#9BE8C7", icon: ShoppingCart },
  Dining: { color: "#FF4FA3", icon: UtensilsCrossed },
  Transport: { color: "#A9C9FF", icon: Car },
  Subscription: { color: "#C9A7FF", icon: RefreshCw },
  Shopping: { color: "#FFC2E2", icon: ShoppingBag },
  Entertainment: { color: "#FFC400", icon: Clapperboard },
  Health: { color: "#FF4B2B", icon: HeartPulse },
  Bills: { color: "#2563FF", icon: ReceiptText },
  Other: { color: "#161616", icon: Package },
};
