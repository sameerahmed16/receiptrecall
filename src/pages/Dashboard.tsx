import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RetroWindow } from "@/components/ui/RetroWindow";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Starburst } from "@/components/decor/Shapes";
import { formatMoney } from "@/lib/utils";
import { useDashboardData, useAnomalies, type DashboardData } from "@/lib/queries";
import { CATEGORY_META } from "@/lib/categoryMeta";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ReceiptText,
  Tag,
  Zap,
} from "lucide-react";

export function Dashboard() {
  const { data, isLoading } = useDashboardData();
  const { data: anomalies } = useAnomalies();
  const empty = !isLoading && (!data || data.receiptCount === 0);

  return (
    <div className="space-y-6">
      <RetroWindow title="dashboard.exe" titleBarColor="bg-sky">
        <Hero data={data} loading={isLoading} empty={empty} />
      </RetroWindow>

      {!empty && anomalies && anomalies.length > 0 && (
        <AnomalyAlerts anomalies={anomalies} />
      )}

      {!empty && (
        <>
          <StatCards data={data} loading={isLoading} />
          <div className="grid gap-6 lg:grid-cols-2">
            <RetroWindow title="spending_by_category.chart" titleBarColor="bg-blush">
              <CategoryPie data={data} loading={isLoading} />
            </RetroWindow>
            <RetroWindow title="spending_over_time.chart" titleBarColor="bg-mint">
              <TimeBar data={data} loading={isLoading} />
            </RetroWindow>
          </div>
        </>
      )}
    </div>
  );
}

function AnomalyAlerts({ anomalies }: { anomalies: import("@/lib/anomalies").Anomaly[] }) {
  return (
    <div className="space-y-2">
      {anomalies.map((a) => (
        <div
          key={a.category}
          className="flex items-center gap-3 rounded-xl border-[3px] border-ink bg-sunshine px-4 py-3 shadow-hard-sm"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-[3px] border-ink bg-white">
            <Zap className="h-5 w-5" strokeWidth={2.75} />
          </div>
          <p className="font-body text-sm">
            <span className="font-display font-bold uppercase">Heads up — </span>
            {a.message}
          </p>
        </div>
      ))}
    </div>
  );
}

function Hero({
  data,
  loading,
  empty,
}: {
  data?: DashboardData;
  loading: boolean;
  empty: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border-[3px] border-ink bg-gradient-to-br from-blush via-lilac to-sky p-6">
      <Starburst className="absolute -right-4 -top-4 h-20 w-20 opacity-90" fill="var(--color-sunshine)" />
      <p className="font-mono text-xs uppercase tracking-widest text-ink/70">
        spent this month
      </p>
      <p className="mt-1 font-display text-5xl font-extrabold text-ink bubble-shadow">
        {loading ? "…" : formatMoney(data?.totalThisMonth ?? 0)}
      </p>
      {empty ? (
        <>
          <p className="mt-2 max-w-md font-body text-sm text-ink/80">
            No receipts yet. Snap a photo or drop a screenshot and watch your
            spending come to life.
          </p>
          <Link to="/upload" className="mt-4 inline-block">
            <Button variant="pink">+ Add your first receipt</Button>
          </Link>
        </>
      ) : (
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink/70">
          {formatMoney(data?.totalAllTime ?? 0)} tracked all-time
        </p>
      )}
    </div>
  );
}

function StatCards({ data, loading }: { data?: DashboardData; loading: boolean }) {
  const top = data?.byCategory[0];
  const mom = data?.momChangePct ?? null;
  const cards = [
    {
      label: "This month",
      value: formatMoney(data?.totalThisMonth ?? 0),
      icon: Wallet,
      color: "bg-mint",
    },
    {
      label: "Receipts",
      value: String(data?.receiptCount ?? 0),
      icon: ReceiptText,
      color: "bg-sky",
    },
    {
      label: "Top category",
      value: top ? top.category : "—",
      icon: Tag,
      color: "bg-butter",
    },
    {
      label: "vs last month",
      value: mom == null ? "—" : `${mom > 0 ? "+" : ""}${mom}%`,
      icon: mom != null && mom < 0 ? TrendingDown : TrendingUp,
      color: mom != null && mom < 0 ? "bg-mint" : "bg-blush",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <Card key={label} color={color} className="flex flex-col gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg border-[3px] border-ink bg-white">
            <Icon className="h-5 w-5" strokeWidth={2.75} />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/70">{label}</p>
          <p className="truncate font-display text-2xl font-extrabold">
            {loading ? "…" : value}
          </p>
        </Card>
      ))}
    </div>
  );
}

function CategoryPie({ data, loading }: { data?: DashboardData; loading: boolean }) {
  const rows = data?.byCategory.filter((c) => c.amount > 0) ?? [];
  if (loading) return <ChartSkeleton />;
  if (rows.length === 0) return <ChartEmpty label="No categorized spending yet" />;

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={rows}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={80}
            stroke="#161616"
            strokeWidth={3}
          >
            {rows.map((r) => (
              <Cell key={r.category} fill={CATEGORY_META[r.category].color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => formatMoney(v)}
            contentStyle={tooltipStyle}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <span
            key={r.category}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
          >
            <span
              className="h-2.5 w-2.5 rounded-full border border-ink"
              style={{ background: CATEGORY_META[r.category].color }}
            />
            {r.category} {formatMoney(r.amount)}
          </span>
        ))}
      </div>
    </div>
  );
}

function TimeBar({ data, loading }: { data?: DashboardData; loading: boolean }) {
  const rows = data?.overTime ?? [];
  if (loading) return <ChartSkeleton />;
  if (rows.length === 0) return <ChartEmpty label="Spending timeline appears here" />;

  return (
    <ResponsiveContainer width="100%" height={232}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis
          dataKey="month"
          tick={{ fontFamily: "Space Mono", fontSize: 10 }}
          stroke="#161616"
        />
        <YAxis tick={{ fontFamily: "Space Mono", fontSize: 10 }} stroke="#161616" />
        <Tooltip
          formatter={(v: number) => formatMoney(v)}
          cursor={{ fill: "rgba(22,22,22,0.06)" }}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="amount" fill="#2563FF" stroke="#161616" strokeWidth={3} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const tooltipStyle = {
  border: "3px solid #161616",
  borderRadius: 10,
  fontFamily: "Space Mono",
  fontSize: 12,
  boxShadow: "3px 3px 0 0 #161616",
};

function ChartSkeleton() {
  return <div className="h-48 animate-pulse rounded-lg border-[3px] border-dashed border-ink/30 bg-cream" />;
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="grid h-48 place-items-center rounded-lg border-[3px] border-dashed border-ink/40 bg-cream">
      <p className="px-4 text-center font-mono text-xs uppercase tracking-widest text-ink/50">
        {label}
      </p>
    </div>
  );
}
