import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { motion } from "framer-motion";
import { Shell } from "@/components/layout/Shell";
import { RequireAuth } from "@/auth/RequireAuth";
import { Smiley } from "@/components/decor/Smiley";

// Route-level code-splitting: each page (and its heavy deps, e.g. Recharts on
// the dashboard) loads on demand, keeping the initial bundle small.
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Upload = lazy(() => import("@/pages/Upload").then((m) => ({ default: m.Upload })));
const Receipts = lazy(() => import("@/pages/Receipts").then((m) => ({ default: m.Receipts })));
const Subscriptions = lazy(() => import("@/pages/Subscriptions").then((m) => ({ default: m.Subscriptions })));
const Assistant = lazy(() => import("@/pages/Assistant").then((m) => ({ default: m.Assistant })));
const NotFound = lazy(() => import("@/pages/NotFound").then((m) => ({ default: m.NotFound })));

function PageLoader() {
  return (
    <div className="grid place-items-center py-24">
      <motion.div
        animate={{ rotate: [0, 12, -12, 0], y: [0, -8, 0] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        <Smiley className="h-14 w-14" />
      </motion.div>
    </div>
  );
}

export default function App() {
  return (
    <RequireAuth>
      <Shell>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/receipts" element={<Receipts />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Shell>
    </RequireAuth>
  );
}
