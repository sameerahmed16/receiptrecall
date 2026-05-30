import { type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { Login } from "@/pages/Login";
import { Smiley } from "@/components/decor/Smiley";
import { motion } from "framer-motion";

/** Gate: shows a boot splash while loading, the login window if signed out. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0], y: [0, -8, 0] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          <Smiley className="h-16 w-16" />
        </motion.div>
      </div>
    );
  }

  if (!session) return <Login />;

  return <>{children}</>;
}
