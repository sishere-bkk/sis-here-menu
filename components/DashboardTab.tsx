"use client";

import { useEffect, useState, type ReactNode } from "react";

const CHANNEL_LABELS: Record<string, string> = {
  online_menu: "เมนูออนไลน์",
  grab: "Grab",
  lineman: "LINE MAN",
};

const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  "วัตถุดิบ": "#8B3A2B",
  "ค่าแรง": "#E8792F",
  "ค่าแก๊ส": "#B85A1F",
  "ค่าบรรจุภัณฑ์": "#C9962F",
  "ค่าซ่อมอุปกรณ์": "#6B8E4E",
  "ค่าเดินทาง": "#4E7A8E",
  "อื่นๆ": "#C9C2B4",
};
const EXPENSE_COLOR_FALLBACK = "#A89F91";
// "ส่วนตัว" ไม่นับเป็นต้นทุนร้าน เลยไม่รวมในกราฟ/ยอดรวมของแดชบอร์ดฝั่งรายจ่ายและเทียบกำไร
const PERSONAL_CATEGORY = "ส่วนตัว";

type Summary = {
  totalSales: number;
  orderCount: number;
  avgOrderValue: number;
  byChannel: Record<string, number>;
  topItems: [string, number][];
  totalItemQty: number;
  allTimeByChannel: Record<string, number>;
  allTimeTotalSales: number;
  orderDetails: {
    id: number;
    channel: string;
    totalAmount: number;
    createdAt: string;
    platformOrderNo: string | null;
    orderType: string | null;
    tableNumber: string | null;
  }[];
};

type DailySale = { date: string; label: string; total: number };

type Trends = {
  dailySales: DailySale[];
  thisWeekTotal: number;
  lastWeekTotal: number;
  weekChangePct: number | null;
  thisMonthTotal: number;
  lastMonthSamePeriodTotal: number;
  monthChangePct: number | null;
  monthCompareDayCount: number;
  weekByChannel: Record<string, number>;
  monthByChannel: Record<string, number>;
};

type TopItemsData = {
  topWeekItems: [string, number][];
  topMonthItems: [string, number][];
  bottomMonthItems: [string, number][];
  zeroSoldCount: number;
  monthDayCount: number;
  totalWeekQty: number;
  totalMonthQty: number;
};

type ExpenseEntry = {
  id: number;
  expense_date: string;
  amount: number;
  category: string;
  note: string | null;
  source: string;
};

type ExpenseSummary = {
  todayTotal: number;
  todayCount: number;
  todayEntries: ExpenseEntry[];
  allTimeTotal: number;
  allTimeByCategory: Record<string, number>;
};

type ExpenseTrends = {
  dailyExpenses: DailySale[];
  thisWeekTotal: number;
  lastWeekTotal: number;
  weekChangePct: number | null;
  thisMonthTotal: number;
  lastMonthSamePeriodTotal: number;
  monthChangePct: number | null;
  monthCompareDayCount: number;
  weekByCategory: Record<string, number>;
  monthByCategory: Record<string, number>;
};

// สีสำหรับกราฟวงกลม เมนู (ไล่ตามลำดับ 1-5 ของ top5 แล้วที่เหลือใช้สีเทาเป็น "อื่นๆ")
const ITEM_PIE_COLORS = ["#8B3A2B", "#E8792F", "#B85A1F", "#F2B705", "#3A2A18"];
const OTHERS_COLOR = "#C9C2B4";
// สีช่องทาง ใช้สีเดียวกับที่ตั้งไว้ในหน้าคีย์ออเดอร์ ให้สอดคล้องกันทั้งระบบ
const CHANNEL_COLORS: Record<string, string> = {
  online_menu: "#E8792F",
  grab: "#0F6B3D",
  lineman: "#16A34A",
};

// ---------------------------------------------------------------------------
// ตัวห่อหลัก: สลับ 3 แท็บ รายรับ / รายจ่าย / เทียบรายรับ-จ่าย
// ---------------------------------------------------------------------------
export default function DashboardTab() {
  const [mainTab, setMainTab] = useState<"income" | "expense" | "compare">("income");

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-2xl bg-forest/10 p-1">
        <button
          onClick={() => setMainTab("income")}
          className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:py-2.5 sm:text-sm ${
            mainTab === "income" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
          }`}
        >
          📈 รายรับ
        </button>
        <button
          onClick={() => setMainTab("expense")}
          className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:py-2.5 sm:text-sm ${
            mainTab === "expense" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
          }`}
        >
          📉 รายจ่าย
        </button>
        <button
          onClick={() => setMainTab("compare")}
          className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:py-2.5 sm:text-sm ${
            mainTab === "compare" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
          }`}
        >
          ⚖️ เทียบรายรับ-จ่าย
        </button>
      </div>

      {mainTab === "income" && <IncomeDashboard />}
      {mainTab === "expense" && <ExpenseDashboard />}
      {mainTab === "compare" && <CompareDashboard />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// แท็บ "รายรับ" — เนื้อหาเดิมทั้งหมดของ DashboardTab เดิม ย้ายมาไว้ในนี้เฉยๆ
// ---------------------------------------------------------------------------
function IncomeDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [topItemsData, setTopItemsData] = useState<TopItemsData | null>(null);
  const [topItemsLoading, setTopItemsLoading] = useState(true);
  const [showOrderDetail, setShowOrderDetail] = useState(false);

  useEffect(() => {
    function load() {
      fetch("/api/dashboard-summary")
        .then((res) => res.json())
        .then((json) => {
          setData(json);
          setLoading(false);
        });
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function loadTrends() {
      fetch("/api/dashboard-trends")
        .then((res) => res.json())
        .then((json) => {
          setTrends(json);
          setTrendsLoading(false);
        });
    }
    loadTrends();
    const interval = setInterval(loadTrends, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function loadTopItems() {
      fetch("/api/dashboard-top-items")
        .then((res) => res.json())
        .then((json) => {
          setTopItemsData(json);
          setTopItemsLoading(false);
        });
    }
    loadTopItems();
    const interval = setInterval(loadTopItems, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="text-ink/50">กำลังโหลด...</p>;
  if (!data) return <p className="text-ink/50">โหลดข้อมูลไม่สำเร็จ</p>;

  return (
    <div>
      <div className="mb-4 flex gap-3">
        <Card label="ยอดขายวันนี้" value={`${data.totalSales.toLocaleString()} บาท`} onClick={() => setShowOrderDetail(true)} />
        <Card label="Order วันนี้" value={`${data.orderCount}`} onClick={() => setShowOrderDetail(true)} />
        <Card label="เฉลี่ย/บิล วันนี้" value={`${data.avgOrderValue.toFixed(0)} บาท`} onClick={() => setShowOrderDetail(true)} />
      </div>
      <p style={{ marginTop: -8, marginBottom: 16, fontSize: 11, color: "#3A2A18", opacity: 0.4 }}>
        แตะกล่องด้านบนเพื่อดูว่ายอดวันนี้มาจากบิลไหนบ้าง
      </p>

      {showOrderDetail && (
        <OrderDetailModal data={data} onClose={() => setShowOrderDetail(false)} />
      )}

      <Section icon="📈" title="ยอดขายย้อนหลัง 7 วัน">
        {trendsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!trendsLoading && !trends && (
          <p className="text-xs text-ink/40">โหลดข้อมูลไม่สำเร็จ</p>
        )}
        {trends && <DailyBarChart days={trends.dailySales} barColor="#8B3A2B" todayColor="#E8792F" />}

        {trends && (
          <div className="mt-3 flex gap-3">
            <CompareCard
              label="สัปดาห์นี้ (7 วันล่าสุด)"
              current={trends.thisWeekTotal}
              previous={trends.lastWeekTotal}
              pct={trends.weekChangePct}
              previousLabel="สัปดาห์ก่อน"
              goodDirection="up"
            />
            <CompareCard
              label={`เดือนนี้ (${trends.monthCompareDayCount} วันแรก)`}
              current={trends.thisMonthTotal}
              previous={trends.lastMonthSamePeriodTotal}
              pct={trends.monthChangePct}
              previousLabel={`เดือนก่อน (${trends.monthCompareDayCount} วันแรกเท่ากัน)`}
              goodDirection="up"
            />
          </div>
        )}
      </Section>

      <Section icon="🛍️" title="ยอดขายแยกตามช่องทาง" subtitle="ยอดสะสมทั้งหมด">
        {Object.keys(data.allTimeByChannel).length === 0 && <Empty />}
        {Object.entries(data.allTimeByChannel).map(([ch, amount]) => (
          <BarRow
            key={ch}
            label={CHANNEL_LABELS[ch] ?? ch}
            value={amount}
            max={data.allTimeTotalSales || 1}
            display={`${amount.toLocaleString()} บาท`}
          />
        ))}
        {Object.keys(data.allTimeByChannel).length > 0 && (
          <div className="mt-3">
            <DonutChart
              segments={Object.entries(data.allTimeByChannel).map(([ch, amount]) => ({
                label: CHANNEL_LABELS[ch] ?? ch,
                value: amount,
                color: CHANNEL_COLORS[ch] ?? OTHERS_COLOR,
              }))}
            />
          </div>
        )}
      </Section>

      <Section icon="🛍️" title="ยอดขายแยกตามช่องทาง สัปดาห์นี้">
        {trendsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!trendsLoading && trends && Object.keys(trends.weekByChannel).length === 0 && <Empty />}
        {!trendsLoading &&
          trends &&
          Object.entries(trends.weekByChannel).map(([ch, amount]) => (
            <BarRow
              key={ch}
              label={CHANNEL_LABELS[ch] ?? ch}
              value={amount}
              max={trends.thisWeekTotal || 1}
              display={`${amount.toLocaleString()} บาท`}
            />
          ))}
      </Section>

      <Section icon="🛍️" title="ยอดขายแยกตามช่องทาง เดือนนี้">
        {trendsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!trendsLoading && trends && Object.keys(trends.monthByChannel).length === 0 && <Empty />}
        {!trendsLoading &&
          trends &&
          Object.entries(trends.monthByChannel).map(([ch, amount]) => (
            <BarRow
              key={ch}
              label={CHANNEL_LABELS[ch] ?? ch}
              value={amount}
              max={trends.thisMonthTotal || 1}
              display={`${amount.toLocaleString()} บาท`}
            />
          ))}
      </Section>

      <Section icon="🔥" title="เมนูขายดี Top 5 สัปดาห์นี้" subtitle="ไม่รวมหมวดเครื่องดื่ม">
        {topItemsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!topItemsLoading && topItemsData && (
          <>
            <TopItemsList items={topItemsData.topWeekItems} unit="ชิ้น" />
            {topItemsData.topWeekItems.length > 0 && (
              <div className="mt-3">
                <ItemPie items={topItemsData.topWeekItems} totalQty={topItemsData.totalWeekQty} />
              </div>
            )}
          </>
        )}
      </Section>

      <Section icon="🔥" title="เมนูขายดี Top 5 เดือนนี้" subtitle="ไม่รวมหมวดเครื่องดื่ม">
        {topItemsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!topItemsLoading && topItemsData && (
          <>
            <TopItemsList items={topItemsData.topMonthItems} unit="ชิ้น" />
            {topItemsData.topMonthItems.length > 0 && (
              <div className="mt-3">
                <ItemPie items={topItemsData.topMonthItems} totalQty={topItemsData.totalMonthQty} />
              </div>
            )}
          </>
        )}
      </Section>

      <Section
        icon="📉"
        title="เมนูขายน้อยสุด Top 5 เดือนนี้"
        subtitle={
          "ไม่รวมหมวดเครื่องดื่ม" +
          (!topItemsLoading && topItemsData && topItemsData.zeroSoldCount > 0
            ? ` • มีเมนูขาย 0 ชิ้นเดือนนี้ทั้งหมด ${topItemsData.zeroSoldCount} รายการ`
            : "")
        }
      >
        {topItemsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!topItemsLoading && topItemsData && (
          <TopItemsList items={topItemsData.bottomMonthItems} unit="ชิ้น" />
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// แท็บ "รายจ่าย" — ใหม่ โครงเดียวกับแท็บรายรับ แต่ดึงจาก /api/expense-summary, /api/expense-trends
// ---------------------------------------------------------------------------
function ExpenseDashboard() {
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [trends, setTrends] = useState<ExpenseTrends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    function load() {
      fetch("/api/expense-summary")
        .then((res) => res.json())
        .then((json) => {
          setSummary(json);
          setSummaryLoading(false);
        });
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function loadTrends() {
      fetch("/api/expense-trends")
        .then((res) => res.json())
        .then((json) => {
          setTrends(json);
          setTrendsLoading(false);
        });
    }
    loadTrends();
    const interval = setInterval(loadTrends, 30000);
    return () => clearInterval(interval);
  }, []);

  if (summaryLoading) return <p className="text-ink/50">กำลังโหลด...</p>;
  if (!summary) return <p className="text-ink/50">โหลดข้อมูลไม่สำเร็จ</p>;

  // ตัดหมวด "ส่วนตัว" ออกจากยอดรวม/กราฟ เพราะไม่ใช่ต้นทุนร้าน
  const businessCategoryEntries = Object.entries(summary.allTimeByCategory).filter(
    ([cat]) => cat !== PERSONAL_CATEGORY
  );
  const businessAllTimeTotal = businessCategoryEntries.reduce((s, [, v]) => s + v, 0);
  const businessTodayEntries = summary.todayEntries.filter((e) => e.category !== PERSONAL_CATEGORY);
  const businessTodayTotal = businessTodayEntries.reduce((s, e) => s + Number(e.amount), 0);

  const weekCategoryEntries = trends
    ? Object.entries(trends.weekByCategory).filter(([cat]) => cat !== PERSONAL_CATEGORY)
    : [];
  const weekBusinessTotal = weekCategoryEntries.reduce((s, [, v]) => s + v, 0);
  const monthCategoryEntries = trends
    ? Object.entries(trends.monthByCategory).filter(([cat]) => cat !== PERSONAL_CATEGORY)
    : [];
  const monthBusinessTotal = monthCategoryEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div>
      <div className="mb-4 flex gap-3">
        <Card label="รายจ่ายวันนี้" value={`${businessTodayTotal.toLocaleString()} บาท`} onClick={() => setShowDetail(true)} />
        <Card label="สลิป/รายการวันนี้" value={`${businessTodayEntries.length}`} onClick={() => setShowDetail(true)} />
      </div>
      <p style={{ marginTop: -8, marginBottom: 16, fontSize: 11, color: "#3A2A18", opacity: 0.4 }}>
        แตะกล่องด้านบนเพื่อดูว่ารายจ่ายวันนี้มาจากรายการไหนบ้าง (ไม่รวมหมวดส่วนตัว)
      </p>

      {showDetail && <ExpenseDetailModal entries={businessTodayEntries} onClose={() => setShowDetail(false)} />}

      <Section icon="📉" title="รายจ่ายย้อนหลัง 7 วัน">
        {trendsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!trendsLoading && !trends && <p className="text-xs text-ink/40">โหลดข้อมูลไม่สำเร็จ</p>}
        {trends && <DailyBarChart days={trends.dailyExpenses} barColor="#8B3A2B" todayColor="#E8792F" />}

        {trends && (
          <div className="mt-3 flex gap-3">
            <CompareCard
              label="สัปดาห์นี้ (7 วันล่าสุด)"
              current={trends.thisWeekTotal}
              previous={trends.lastWeekTotal}
              pct={trends.weekChangePct}
              previousLabel="สัปดาห์ก่อน"
              goodDirection="down"
            />
            <CompareCard
              label={`เดือนนี้ (${trends.monthCompareDayCount} วันแรก)`}
              current={trends.thisMonthTotal}
              previous={trends.lastMonthSamePeriodTotal}
              pct={trends.monthChangePct}
              previousLabel={`เดือนก่อน (${trends.monthCompareDayCount} วันแรกเท่ากัน)`}
              goodDirection="down"
            />
          </div>
        )}
        <p style={{ marginTop: 8, fontSize: 11, color: "#3A2A18", opacity: 0.4 }}>
          ตัวเลขเทียบสัปดาห์/เดือนด้านบน นับรวมทุกหมวด (รวมหมวดส่วนตัวด้วย ถ้ามี)
        </p>
      </Section>

      <Section icon="🧾" title="รายจ่ายแยกตามหมวด" subtitle="ยอดสะสมทั้งหมด (ไม่รวมหมวดส่วนตัว)">
        {businessCategoryEntries.length === 0 && <Empty />}
        {businessCategoryEntries.map(([cat, amount]) => (
          <BarRow
            key={cat}
            label={cat}
            value={amount}
            max={businessAllTimeTotal || 1}
            display={`${amount.toLocaleString()} บาท`}
          />
        ))}
        {businessCategoryEntries.length > 0 && (
          <div className="mt-3">
            <DonutChart
              segments={businessCategoryEntries.map(([cat, amount]) => ({
                label: cat,
                value: amount,
                color: EXPENSE_CATEGORY_COLORS[cat] ?? EXPENSE_COLOR_FALLBACK,
              }))}
            />
          </div>
        )}
      </Section>

      <Section icon="🧾" title="รายจ่ายแยกตามหมวด สัปดาห์นี้">
        {trendsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!trendsLoading && weekCategoryEntries.length === 0 && <Empty />}
        {!trendsLoading &&
          weekCategoryEntries.map(([cat, amount]) => (
            <BarRow key={cat} label={cat} value={amount} max={weekBusinessTotal || 1} display={`${amount.toLocaleString()} บาท`} />
          ))}
      </Section>

      <Section icon="🧾" title="รายจ่ายแยกตามหมวด เดือนนี้">
        {trendsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!trendsLoading && monthCategoryEntries.length === 0 && <Empty />}
        {!trendsLoading &&
          monthCategoryEntries.map(([cat, amount]) => (
            <BarRow key={cat} label={cat} value={amount} max={monthBusinessTotal || 1} display={`${amount.toLocaleString()} บาท`} />
          ))}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// แท็บ "เทียบรายรับ-จ่าย" — ใหม่ รวมข้อมูลจากทั้ง dashboard (รายรับ) และ expense (รายจ่าย)
// ---------------------------------------------------------------------------
function CompareDashboard() {
  const [income, setIncome] = useState<Summary | null>(null);
  const [incomeTrends, setIncomeTrends] = useState<Trends | null>(null);
  const [expense, setExpense] = useState<ExpenseSummary | null>(null);
  const [expenseTrends, setExpenseTrends] = useState<ExpenseTrends | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      const [incomeRes, incomeTrendsRes, expenseRes, expenseTrendsRes] = await Promise.all([
        fetch("/api/dashboard-summary").then((r) => r.json()),
        fetch("/api/dashboard-trends").then((r) => r.json()),
        fetch("/api/expense-summary").then((r) => r.json()),
        fetch("/api/expense-trends").then((r) => r.json()),
      ]);
      setIncome(incomeRes);
      setIncomeTrends(incomeTrendsRes);
      setExpense(expenseRes);
      setExpenseTrends(expenseTrendsRes);
      setLoading(false);
    }
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="text-ink/50">กำลังโหลด...</p>;
  if (!income || !incomeTrends || !expense || !expenseTrends) {
    return <p className="text-ink/50">โหลดข้อมูลไม่สำเร็จ</p>;
  }

  const businessTodayExpense = expense.todayEntries
    .filter((e) => e.category !== PERSONAL_CATEGORY)
    .reduce((s, e) => s + Number(e.amount), 0);
  const todayProfit = income.totalSales - businessTodayExpense;

  const weekProfit = incomeTrends.thisWeekTotal - expenseTrends.thisWeekTotal;
  const lastWeekProfit = incomeTrends.lastWeekTotal - expenseTrends.lastWeekTotal;
  const weekProfitPct = lastWeekProfit !== 0 ? ((weekProfit - lastWeekProfit) / Math.abs(lastWeekProfit)) * 100 : null;

  const monthProfit = incomeTrends.thisMonthTotal - expenseTrends.thisMonthTotal;
  const lastMonthProfit = incomeTrends.lastMonthSamePeriodTotal - expenseTrends.lastMonthSamePeriodTotal;
  const monthProfitPct =
    lastMonthProfit !== 0 ? ((monthProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100 : null;

  const monthBusinessExpense = Object.entries(expenseTrends.monthByCategory)
    .filter(([cat]) => cat !== PERSONAL_CATEGORY)
    .reduce((s, [, v]) => s + v, 0);
  const monthIncomeForDonut = incomeTrends.thisMonthTotal || 1;
  const monthProfitForDonut = Math.max(0, monthIncomeForDonut - monthBusinessExpense);

  return (
    <div>
      <div
        className="mb-4 rounded-xl p-4"
        style={{ backgroundColor: todayProfit >= 0 ? "#16A34A1A" : "#D628281A" }}
      >
        <div style={{ fontSize: 11, color: todayProfit >= 0 ? "#0F6B3D" : "#D62828", marginBottom: 4 }}>
          กำไรวันนี้
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: todayProfit >= 0 ? "#0F6B3D" : "#D62828" }}>
          {todayProfit.toLocaleString()} บาท
        </div>
        <div style={{ fontSize: 11, color: "#3A2A1899", marginTop: 2 }}>
          รายรับ {income.totalSales.toLocaleString()} · รายจ่าย {businessTodayExpense.toLocaleString()}
        </div>
      </div>

      <Section icon="📊" title="รายรับ-รายจ่าย 7 วันล่าสุด">
        <CompareBarChart incomeDays={incomeTrends.dailySales} expenseDays={expenseTrends.dailyExpenses} />
        <div className="mt-3 flex gap-3">
          <CompareCard
            label="กำไรสัปดาห์นี้"
            current={weekProfit}
            previous={lastWeekProfit}
            pct={weekProfitPct}
            previousLabel="สัปดาห์ก่อน"
            goodDirection="up"
          />
          <CompareCard
            label="กำไรเดือนนี้"
            current={monthProfit}
            previous={lastMonthProfit}
            pct={monthProfitPct}
            previousLabel="เดือนก่อน (ช่วงเดียวกัน)"
            goodDirection="up"
          />
        </div>
      </Section>

      <Section icon="🥧" title="รายรับ 100% ไปไหนบ้าง (เดือนนี้)">
        <DonutChart
          segments={[
            { label: "กำไร", value: monthProfitForDonut, color: "#16A34A" },
            { label: "รายจ่าย", value: monthBusinessExpense, color: "#8B3A2B" },
          ]}
        />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ส่วนประกอบร่วม (ใช้ทั้ง 3 แท็บ)
// ---------------------------------------------------------------------------

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="mb-4 rounded-2xl border border-forest/15 bg-white"
      style={{ padding: 16 }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#3A2A18", margin: 0 }}>
        {icon ? `${icon} ` : ""}
        {title}
      </h3>
      {subtitle && (
        <p style={{ fontSize: 11, color: "#3A2A18", opacity: 0.45, marginTop: 2 }}>{subtitle}</p>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function Card({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex-1 rounded-xl bg-forest/10 p-4"
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className="mb-1 text-xs text-ink/60">{label}</div>
      <div className="text-lg font-bold text-ink">{value}</div>
    </div>
  );
}

function orderSourceLabel(o: Summary["orderDetails"][number]): string {
  if (o.channel === "grab") return `Grab${o.platformOrderNo ? " · " + o.platformOrderNo : ""}`;
  if (o.channel === "lineman") return `LINE MAN${o.platformOrderNo ? " · " + o.platformOrderNo : ""}`;
  if (o.orderType === "table") return `โต๊ะ ${o.tableNumber ?? "-"}`;
  if (o.orderType === "takeaway") return "กลับบ้าน (เมนูออนไลน์)";
  return "เมนูออนไลน์";
}

function formatTimeBangkok(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
}

function dayLabelBangkok(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00+07:00");
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short" }).format(d);
}

// ป๊อปอัพไล่ดูรายบิลของวันนี้ (ฝั่งรายรับ) เปิดจากการแตะกล่องยอดขาย/Order ด้านบนสุด
function OrderDetailModal({ data, onClose }: { data: Summary; onClose: () => void }) {
  const sumCheck = data.orderDetails.reduce((s, o) => s + o.totalAmount, 0);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(58,42,24,0.45)",
        display: "flex",
        alignItems: "flex-end"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#fff",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 20
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#3A2A18", margin: 0 }}>
            บิลวันนี้ทั้งหมด ({data.orderDetails.length} บิล)
          </h3>
          <button onClick={onClose} style={{ fontSize: 13, color: "#3A2A18", opacity: 0.5, border: "none", background: "none" }}>
            ปิด
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#3A2A18", opacity: 0.45, marginBottom: 14 }}>
          นับเฉพาะบิลที่กด &quot;รับเงินแล้ว&quot; เท่านั้น — เรียงจากล่าสุดไปเก่าสุด
        </p>

        {data.orderDetails.length === 0 && (
          <p style={{ fontSize: 13, color: "#3A2A18", opacity: 0.4 }}>ยังไม่มีบิลที่รับเงินแล้ววันนี้</p>
        )}

        {data.orderDetails.map((o) => (
          <div
            key={o.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid #EFE9DA"
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, color: "#3A2A18", margin: 0 }}>
                #{o.id} · {orderSourceLabel(o)}
              </p>
              <p style={{ fontSize: 11, color: "#3A2A18", opacity: 0.45, margin: 0 }}>
                {formatTimeBangkok(o.createdAt)} น.
              </p>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#8B3A2B", margin: 0, flexShrink: 0 }}>
              {o.totalAmount.toLocaleString()} บาท
            </p>
          </div>
        ))}

        {data.orderDetails.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: 12,
              marginTop: 4
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: "#3A2A18" }}>รวม</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#3A2A18" }}>
              {sumCheck.toLocaleString()} บาท
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ป๊อปอัพไล่ดูรายการรายจ่ายของวันนี้ (ฝั่งรายจ่าย) — เปิดจากการแตะกล่อง "รายจ่ายวันนี้ / สลิปวันนี้"
function ExpenseDetailModal({ entries, onClose }: { entries: ExpenseEntry[]; onClose: () => void }) {
  const sumCheck = entries.reduce((s, e) => s + Number(e.amount), 0);
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(58,42,24,0.45)", display: "flex", alignItems: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxHeight: "80vh", overflowY: "auto", background: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#3A2A18", margin: 0 }}>
            รายจ่ายวันนี้ทั้งหมด ({entries.length} รายการ)
          </h3>
          <button onClick={onClose} style={{ fontSize: 13, color: "#3A2A18", opacity: 0.5, border: "none", background: "none" }}>
            ปิด
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#3A2A18", opacity: 0.45, marginBottom: 14 }}>
          ไม่รวมรายการที่ติดหมวด &quot;ส่วนตัว&quot;
        </p>

        {entries.length === 0 && <p style={{ fontSize: 13, color: "#3A2A18", opacity: 0.4 }}>ยังไม่มีรายจ่ายวันนี้</p>}

        {entries.map((e) => (
          <div
            key={e.id}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #EFE9DA" }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, color: "#3A2A18", margin: 0 }}>
                {e.category}{e.source === "slip" ? " · 📷" : ""}
              </p>
              {e.note && (
                <p style={{ fontSize: 11, color: "#3A2A18", opacity: 0.45, margin: 0 }}>{e.note}</p>
              )}
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#8B3A2B", margin: 0, flexShrink: 0 }}>
              {Number(e.amount).toLocaleString()} บาท
            </p>
          </div>
        ))}

        {entries.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, marginTop: 4 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#3A2A18" }}>รวม</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#3A2A18" }}>{sumCheck.toLocaleString()} บาท</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DailyBarChart({
  days,
  barColor = "#8B3A2B",
  todayColor = "#E8792F",
}: {
  days: DailySale[];
  barColor?: string;
  todayColor?: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const BAR_AREA_PX = 120; // ความสูงพื้นที่แท่งกราฟ (ไม่รวมตัวเลขและป้ายวัน)
  const today = days[days.length - 1]?.date;
  return (
    <div>
      <div className="flex items-end gap-2" style={{ paddingTop: 4 }}>
        {days.map((day) => {
          // ใช้พิกเซลตรงๆ แทน % เพื่อกันไม่ให้ค่าน้อยๆ (หรือ 0) เตี้ยจนมองไม่เห็นเป็นแท่ง
          const heightPx = Math.max(6, Math.round((day.total / max) * BAR_AREA_PX));
          const isToday = day.date === today;
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center" style={{ gap: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#3A2A18",
                  opacity: 0.65,
                  whiteSpace: "nowrap",
                  fontVariantNumeric: "tabular-nums"
                }}
              >
                {Math.round(day.total).toLocaleString()}
              </span>
              <div className="flex w-full items-end justify-center" style={{ height: BAR_AREA_PX }}>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: heightPx,
                    backgroundColor: isToday ? todayColor : barColor
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? todayColor : "#3A2A18",
                  opacity: isToday ? 1 : 0.6
                }}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: 8, paddingLeft: 4, fontSize: 11, color: "#3A2A18", opacity: 0.4 }}>
        <span style={{ color: todayColor }}>■</span> แท่งสีส้ม = วันนี้ (หน่วย: บาท)
      </p>
    </div>
  );
}

// กราฟแท่งคู่ เทียบรายรับ (เขียว) กับรายจ่าย (แดง) รายวัน ใช้ในแท็บเทียบรายรับ-จ่าย
function CompareBarChart({ incomeDays, expenseDays }: { incomeDays: DailySale[]; expenseDays: DailySale[] }) {
  const max = Math.max(1, ...incomeDays.map((d) => d.total), ...expenseDays.map((d) => d.total));
  const BAR_AREA_PX = 100;
  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "#3A2A1899" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#0F6B3D", marginRight: 4 }} />
          รายรับ
        </span>
        <span style={{ fontSize: 11, color: "#3A2A1899" }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#8B3A2B", marginRight: 4 }} />
          รายจ่าย
        </span>
      </div>
      <div className="flex items-end gap-2">
        {incomeDays.map((day, i) => {
          const expenseDay = expenseDays[i];
          const incomeH = Math.max(4, Math.round((day.total / max) * BAR_AREA_PX));
          const expenseH = Math.max(4, Math.round(((expenseDay?.total ?? 0) / max) * BAR_AREA_PX));
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center" style={{ gap: 4 }}>
              <div className="flex items-end justify-center" style={{ height: BAR_AREA_PX, gap: 3 }}>
                <div style={{ width: 9, height: incomeH, borderRadius: "2px 2px 0 0", backgroundColor: "#0F6B3D" }} />
                <div style={{ width: 9, height: expenseH, borderRadius: "2px 2px 0 0", backgroundColor: "#8B3A2B" }} />
              </div>
              <span style={{ fontSize: 10, color: "#3A2A1899" }}>{day.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// กราฟวงกลมแบบทั่วไป: รับ segments (ป้าย, ค่า, สี) มาวาดเป็นวงแหวน + คำอธิบายสี พร้อม % ด้านข้าง
function DonutChart({
  segments,
  size = 108,
  strokeWidth = 20,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EFE9DA"
          strokeWidth={strokeWidth}
        />
        {segments.map((seg, i) => {
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const offset = -cumulativeFraction * circumference;
          cumulativeFraction += fraction;
          if (fraction <= 0) return null;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: seg.color,
                flexShrink: 0,
                display: "inline-block"
              }}
            />
            <span
              style={{ fontSize: 12, color: "#3A2A18", flex: 1, minWidth: 0 }}
              className="truncate"
            >
              {seg.label}
            </span>
            <span style={{ fontSize: 12, color: "#3A2A18", opacity: 0.6, flexShrink: 0 }}>
              {((seg.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// กราฟวงกลมเฉพาะสำหรับเมนูขายดี: top5 แต่ละอันเป็น 1 ชิ้นส่วน ที่เหลือนอก top5 มัดรวมเป็น "เมนูอื่นๆ"
function ItemPie({ items, totalQty }: { items: [string, number][]; totalQty: number }) {
  const top5Qty = items.reduce((sum, [, qty]) => sum + qty, 0);
  const othersQty = Math.max(0, totalQty - top5Qty);
  const segments = items.map(([name, qty], i) => ({
    label: name,
    value: qty,
    color: ITEM_PIE_COLORS[i % ITEM_PIE_COLORS.length]
  }));
  if (othersQty > 0) {
    segments.push({ label: "เมนูอื่นๆ", value: othersQty, color: OTHERS_COLOR });
  }
  const top5Pct = totalQty > 0 ? (top5Qty / totalQty) * 100 : 0;
  return (
    <div>
      <p style={{ fontSize: 12, color: "#3A2A18", opacity: 0.6, marginBottom: 8 }}>
        5 เมนูนี้รวมกันคิดเป็น <strong style={{ opacity: 1 }}>{top5Pct.toFixed(0)}%</strong> ของยอดขายชิ้นทั้งหมด
      </p>
      <DonutChart segments={segments} />
    </div>
  );
}

function CompareCard({
  label,
  current,
  previous,
  pct,
  previousLabel,
  goodDirection = "up",
}: {
  label: string;
  current: number;
  previous: number;
  pct: number | null;
  previousLabel: string;
  // "up" = ขึ้นดี (เช่น รายรับ/กำไร), "down" = ลงดี (เช่น รายจ่าย)
  goodDirection?: "up" | "down";
}) {
  const isUp = pct != null && pct > 0;
  const isDown = pct != null && pct < 0;
  const isGood = goodDirection === "up" ? isUp : isDown;
  const isBad = goodDirection === "up" ? isDown : isUp;
  return (
    <div className="flex-1 rounded-xl bg-forest/10 p-3">
      <div className="mb-1 text-xs text-ink/60">{label}</div>
      <div className="text-base font-bold text-ink">{current.toLocaleString()} บาท</div>
      <div className="mt-1 text-xs">
        {pct == null ? (
          <span className="text-ink/40">ยังไม่มี{previousLabel}ให้เทียบ</span>
        ) : (
          <span className={isGood ? "text-green-700" : isBad ? "text-red-600" : "text-ink/50"}>
            {isUp ? "▲" : isDown ? "▼" : "–"} {Math.abs(pct).toFixed(0)}% จาก{previousLabel} (
            {previous.toLocaleString()} บาท)
          </span>
        )}
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  display,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
}) {
  const pct = Math.max(4, Math.round((value / max) * 100));
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-ink">{label}</span>
        <span className="text-ink/60">{display}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-forest/10">
        <div className="h-full bg-forest" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TopItemsList({ items, unit }: { items: [string, number][]; unit: string }) {
  if (items.length === 0) return <Empty />;
  const max = Math.max(1, ...items.map(([, qty]) => qty));
  return (
    <div>
      {items.map(([name, qty]) => (
        <BarRow key={name} label={name} value={qty} max={max} display={`${qty} ${unit}`} />
      ))}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-ink/40">ยังไม่มีข้อมูล</p>;
}
