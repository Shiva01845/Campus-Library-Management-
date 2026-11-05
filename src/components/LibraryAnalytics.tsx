import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Library,
  RefreshCw,
  RotateCcw,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type DateRange = 'today' | 'last7' | 'last30' | 'month' | 'year' | 'all';
type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  department_id: string | null;
  role: string;
  is_active: boolean;
};
type BookRow = {
  id: string;
  title: string;
  category_id: string | null;
  total_copies: number | null;
  available_copies: number | null;
  is_active: boolean;
};
type CopyRow = { id: string; book_id: string; status: string };
type LoanRow = {
  id: string;
  copy_id: string;
  user_id: string;
  issue_date: string;
  due_date: string;
  returned_date: string | null;
  status: string;
};
type ReservationRow = { id: string; user_id: string; reserved_at: string; status: string };
type FineRow = { id: string; user_id: string; amount: number | string | null; status: string; issued_at: string };
type CategoryRow = { id: string; name: string };
type DepartmentRow = { id: string; name: string | null; code: string | null };
type AnalyticsData = {
  books: BookRow[];
  copies: CopyRow[];
  members: ProfileRow[];
  loans: LoanRow[];
  reservations: ReservationRow[];
  fines: FineRow[];
  categories: CategoryRow[];
  departments: DepartmentRow[];
};
type DateBounds = { start: string; end: string };
type TrendPoint = { label: string; issued: number; returned: number; fines: number };
type DepartmentUsage = { department: string; members: number; loans: number; reservations: number };
type RankedBook = { title: string; issues: number; available: number };
type MemberActivity = { name: string; department: string; loans: number; overdue: number };

const emptyData: AnalyticsData = {
  books: [],
  copies: [],
  members: [],
  loans: [],
  reservations: [],
  fines: [],
  categories: [],
  departments: [],
};

const palette = {
  purple: '#7047c8',
  violet: '#a78bfa',
  orange: '#f18b45',
  teal: '#22a693',
  blue: '#4d8de0',
  red: '#e16b75',
  green: '#43a879',
  yellow: '#dfad42',
  slate: '#8b94a7',
};

const statusColors: Record<string, string> = {
  Active: palette.blue,
  Returned: palette.teal,
  Overdue: palette.red,
  Other: palette.slate,
  Pending: palette.orange,
  Ready: palette.blue,
  Fulfilled: palette.green,
  Cancelled: palette.slate,
  Expired: palette.red,
  Paid: palette.green,
  Waived: palette.violet,
};

const dateRangeOptions: Array<{ value: DateRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function rangeBounds(range: DateRange): DateBounds {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  let start = new Date(0);

  if (range === 'today') start = today;
  if (range === 'last7') {
    start = new Date(today);
    start.setDate(start.getDate() - 6);
  }
  if (range === 'last30') {
    start = new Date(today);
    start.setDate(start.getDate() - 29);
  }
  if (range === 'month') start = new Date(today.getFullYear(), today.getMonth(), 1);
  if (range === 'year') start = new Date(today.getFullYear(), 0, 1);
  return { start: localDateKey(start), end: localDateKey(tomorrow) };
}

export function inRange(value: string | null | undefined, bounds: DateBounds) {
  if (!value) return false;
  const date = value.slice(0, 10);
  return date >= bounds.start && date < bounds.end;
}

export function safeNumber(value: number | string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function safeDateDifference(start: string, end: string | null) {
  if (!end) return null;
  const from = parseLocalDate(start);
  const to = parseLocalDate(end);
  const difference = to.getTime() - from.getTime();
  return Number.isFinite(difference) && difference >= 0 ? Math.floor(difference / 86400000) : null;
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-IN') : '0';
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  const date = parseLocalDate(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function dateLabel(date: Date, format: 'day' | 'month') {
  return format === 'month'
    ? date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function rangeLabel(range: DateRange, bounds: DateBounds) {
  if (range === 'all') return 'All available history';
  const end = parseLocalDate(bounds.end);
  end.setDate(end.getDate() - 1);
  return `${formatDate(bounds.start)} – ${formatDate(localDateKey(end))}`;
}

function getLoanStatus(loan: LoanRow, today: string) {
  if (loan.returned_date || loan.status === 'returned') return 'Returned';
  if (loan.status === 'overdue' || loan.due_date < today) return 'Overdue';
  if (loan.status === 'active') return 'Active';
  return 'Other';
}

function countUpValue(target: number, duration = 650) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const safeTarget = Number.isFinite(target) ? target : 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(safeTarget);
      return;
    }
    let frame = 0;
    let startTime: number | null = null;
    const animate = (time: number) => {
      if (startTime === null) startTime = time;
      const progress = Math.min(1, (time - startTime) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(safeTarget * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function CountUp({ value, money = false }: { value: number; money?: boolean }) {
  const animatedValue = countUpValue(value);
  return <>{money ? formatMoney(animatedValue) : formatNumber(animatedValue)}</>;
}

function csvCell(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function downloadReport(rows: Array<Array<string | number>>, range: DateRange) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `library-analytics-${range}-${localDateKey(new Date())}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getBuckets(range: DateRange, bounds: DateBounds): Array<{ start: string; end: string; label: string }> {
  const start = parseLocalDate(bounds.start);
  const endExclusive = parseLocalDate(bounds.end);
  const buckets: Array<{ start: string; end: string; label: string }> = [];
  const useMonths = range === 'year' || range === 'all';
  const step = range === 'last30' || range === 'month' ? 7 : 1;

  if (useMonths) {
    const firstMonth = range === 'all'
      ? new Date(endExclusive.getFullYear(), endExclusive.getMonth() - 11, 1)
      : new Date(start.getFullYear(), start.getMonth(), 1);
    const monthCount = range === 'all' ? 12 : Math.max(
      1,
      (endExclusive.getFullYear() - firstMonth.getFullYear()) * 12 + endExclusive.getMonth() - firstMonth.getMonth(),
    );
    for (let index = 0; index < monthCount; index += 1) {
      const monthStart = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      buckets.push({
        start: localDateKey(monthStart),
        end: localDateKey(monthEnd),
        label: dateLabel(monthStart, 'month'),
      });
    }
    return buckets;
  }

  const totalDays = Math.max(1, Math.ceil((endExclusive.getTime() - start.getTime()) / 86400000));
  for (let offset = 0; offset < totalDays; offset += step) {
    const bucketStart = new Date(start);
    bucketStart.setDate(bucketStart.getDate() + offset);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setDate(bucketEnd.getDate() + step);
    const finalEnd = bucketEnd < endExclusive ? bucketEnd : endExclusive;
    buckets.push({
      start: localDateKey(bucketStart),
      end: localDateKey(finalEnd),
      label: step === 1
        ? dateLabel(bucketStart, 'day')
        : `${dateLabel(bucketStart, 'day')}–${dateLabel(new Date(finalEnd.getTime() - 86400000), 'day')}`,
    });
  }
  return buckets;
}

function Panel({
  title,
  subtitle,
  children,
  className = '',
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`analytics-panel ${className}`}>
      <header className="analytics-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="analytics-empty">
      <Activity size={21} />
      <strong>No data for this period</strong>
      <span>{label}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      {label && <strong>{label}</strong>}
      {payload.map((item) => (
        <span key={item.dataKey || item.name} style={{ color: item.color }}>
          <i /> {item.name}: {item.dataKey === 'fines' ? formatMoney(safeNumber(item.value)) : formatNumber(safeNumber(item.value))}
        </span>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: { color?: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const total = payload[0].payload;
  return (
    <div className="analytics-tooltip">
      <strong>{item.name}</strong>
      <span style={{ color: total?.color }}>{formatNumber(safeNumber(item.value))} records</span>
    </div>
  );
}

function KPI({
  title,
  value,
  icon,
  tone,
  trend,
  money = false,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  tone: string;
  trend?: number | null;
  money?: boolean;
}) {
  return (
    <article className={`analytics-kpi ${tone}`}>
      <div className="analytics-kpi-top">
        <span className="analytics-kpi-icon">{icon}</span>
        {trend !== undefined && trend !== null && (
          <span className={`analytics-trend ${trend >= 0 ? 'up' : 'down'}`}>
            {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <span className="analytics-kpi-label">{title}</span>
      <strong><CountUp value={value} money={money} /></strong>
    </article>
  );
}

function DonutChart({
  data,
  total,
  money = false,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  total: number;
  money?: boolean;
}) {
  if (!data.some((item) => item.value > 0)) return <EmptyChart label="There are no records to chart." />;
  return (
    <>
      <div className="analytics-donut-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="66%"
              outerRadius="88%"
              paddingAngle={3}
              stroke="none"
              animationDuration={700}
            >
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="analytics-donut-center">
          <strong>{money ? formatMoney(total) : formatNumber(total)}</strong>
          <span>{money ? 'total' : 'records'}</span>
        </div>
      </div>
      <div className="analytics-legend">
        {data.map((item) => {
          const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div className="analytics-legend-item" key={item.name}>
              <i style={{ background: item.color }} />
              <span>{item.name}</span>
              <strong>{money ? formatMoney(item.value) : formatNumber(item.value)}</strong>
              <small>{percentage}%</small>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function LibraryAnalytics({ supabaseClient }: { supabaseClient: SupabaseClient }) {
  const [data, setData] = useState<AnalyticsData>(emptyData);
  const [range, setRange] = useState<DateRange>('last30');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError('');
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      try {
        const { error: accrualError } = await supabaseClient.rpc('accrue_overdue_fines');
        if (accrualError) setError(`Overdue data could not refresh: ${accrualError.message}`);
        const { error: notificationsError } = await supabaseClient.rpc('sync_loan_due_notifications');
        if (notificationsError) setError(`Due-date reminders could not refresh: ${notificationsError.message}`);
      } catch {
        setError('Overdue fines or due-date reminders could not refresh.');
      }

      const results = await Promise.all([
        supabaseClient.from('books').select('id,title,category_id,total_copies,available_copies,is_active'),
        supabaseClient.from('book_copies').select('id,book_id,status'),
        supabaseClient.from('profiles').select('id,full_name,email,department_id,role,is_active'),
        supabaseClient.from('loans').select('id,copy_id,user_id,issue_date,due_date,returned_date,status').order('issue_date', { ascending: false }),
        supabaseClient.from('reservations').select('id,user_id,reserved_at,status'),
        supabaseClient.from('fines').select('id,user_id,amount,status,issued_at'),
        supabaseClient.from('categories').select('id,name'),
        supabaseClient.from('departments').select('id,name,code'),
      ]);
      const queryError = results.find((result) => result.error)?.error;
      if (queryError) throw new Error(queryError.message);

      setData({
        books: (results[0].data || []) as BookRow[],
        copies: (results[1].data || []) as CopyRow[],
        members: (results[2].data || []) as ProfileRow[],
        loans: (results[3].data || []) as LoanRow[],
        reservations: (results[4].data || []) as ReservationRow[],
        fines: (results[5].data || []) as FineRow[],
        categories: (results[6].data || []) as CategoryRow[],
        departments: (results[7].data || []) as DepartmentRow[],
      });
      setLastUpdated(new Date());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load analytics data.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabaseClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const bounds = useMemo(() => rangeBounds(range), [range]);
  const today = localDateKey(new Date());
  const copyMap = useMemo(() => new Map(data.copies.map((copy) => [copy.id, copy])), [data.copies]);
  const bookMap = useMemo(() => new Map(data.books.map((book) => [book.id, book])), [data.books]);
  const memberMap = useMemo(() => new Map(data.members.map((member) => [member.id, member])), [data.members]);
  const departmentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const department of data.departments) {
      const readable = department.name || department.code || 'Unassigned';
      map.set(department.id, readable);
      if (department.code) map.set(department.code.toLowerCase(), readable);
      if (department.name) map.set(department.name.toLowerCase(), readable);
    }
    return map;
  }, [data.departments]);
  const departmentName = useCallback((departmentId: string | null) => {
    if (!departmentId) return 'Unassigned';
    return departmentMap.get(departmentId) || departmentMap.get(departmentId.toLowerCase()) || 'Other / unlisted';
  }, [departmentMap]);

  const activeBooks = useMemo(() => data.books.filter((book) => book.is_active), [data.books]);
  const memberRows = useMemo(() => data.members.filter((member) => (
    member.is_active && (member.role === 'student' || member.role === 'faculty')
  )), [data.members]);
  const loansInRange = useMemo(() => data.loans.filter((loan) => inRange(loan.issue_date, bounds)), [data.loans, bounds]);
  const returnedInRange = useMemo(() => data.loans.filter((loan) => inRange(loan.returned_date, bounds)), [data.loans, bounds]);
  const finesInRange = useMemo(() => data.fines.filter((fine) => inRange(fine.issued_at, bounds)), [data.fines, bounds]);
  const reservationsInRange = useMemo(() => data.reservations.filter((reservation) => inRange(reservation.reserved_at, bounds)), [data.reservations, bounds]);

  const loanCounts = useMemo(() => {
    const counts = { Active: 0, Returned: 0, Overdue: 0, Other: 0 };
    for (const loan of loansInRange) counts[getLoanStatus(loan, today)] += 1;
    return counts;
  }, [loansInRange, today]);
  const overdueLoans = useMemo(
    () => data.loans.filter((loan) => getLoanStatus(loan, today) === 'Overdue'),
    [data.loans, today],
  );
  const returnedDurations = useMemo(
    () => data.loans
      .filter((loan) => Boolean(loan.returned_date))
      .map((loan) => safeDateDifference(loan.issue_date, loan.returned_date))
      .filter((days): days is number => days !== null),
    [data.loans],
  );
  const durationAverage = returnedDurations.length
    ? returnedDurations.reduce((sum, days) => sum + days, 0) / returnedDurations.length
    : 0;
  const pendingFineAmount = finesInRange
    .filter((fine) => fine.status === 'pending')
    .reduce((sum, fine) => sum + safeNumber(fine.amount), 0);

  const previousPeriodTrend = useMemo(() => {
    if (range === 'all') return null;
    const start = parseLocalDate(bounds.start);
    const end = parseLocalDate(bounds.end);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - days);
    const previousBounds = { start: localDateKey(previousStart), end: bounds.start };
    const previousCount = data.loans.filter((loan) => inRange(loan.issue_date, previousBounds)).length;
    if (previousCount === 0) return null;
    return Math.round(((loansInRange.length - previousCount) / previousCount) * 100);
  }, [bounds, data.loans, loansInRange.length, range]);

  const trendData = useMemo<TrendPoint[]>(() => getBuckets(range, bounds).map((bucket) => ({
    label: bucket.label,
    issued: data.loans.filter((loan) => inRange(loan.issue_date, bounds)
      && loan.issue_date.slice(0, 10) >= bucket.start && loan.issue_date.slice(0, 10) < bucket.end).length,
    returned: data.loans.filter((loan) => inRange(loan.returned_date, bounds)
      && loan.returned_date!.slice(0, 10) >= bucket.start && loan.returned_date!.slice(0, 10) < bucket.end).length,
    fines: data.fines
      .filter((fine) => inRange(fine.issued_at, bounds)
        && fine.issued_at.slice(0, 10) >= bucket.start && fine.issued_at.slice(0, 10) < bucket.end)
      .reduce((sum, fine) => sum + safeNumber(fine.amount), 0),
  })), [bounds, data.fines, data.loans, range]);

  const popularBooks = useMemo<RankedBook[]>(() => {
    const counts = new Map<string, number>();
    for (const loan of loansInRange) {
      const copy = copyMap.get(loan.copy_id);
      if (copy) counts.set(copy.book_id, (counts.get(copy.book_id) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([bookId, issues]) => {
        const book = bookMap.get(bookId);
        return book ? {
          title: book.title,
          issues,
          available: safeNumber(book.available_copies),
        } : null;
      })
      .filter((book): book is RankedBook => book !== null)
      .sort((left, right) => right.issues - left.issues)
      .slice(0, 10);
  }, [bookMap, copyMap, loansInRange]);

  const leastBorrowedBooks = useMemo<RankedBook[]>(() => {
    const counts = new Map<string, number>();
    for (const loan of loansInRange) {
      const copy = copyMap.get(loan.copy_id);
      if (copy) counts.set(copy.book_id, (counts.get(copy.book_id) || 0) + 1);
    }
    return activeBooks.map((book) => ({
      title: book.title,
      issues: counts.get(book.id) || 0,
      available: safeNumber(book.available_copies),
    })).sort((left, right) => left.issues - right.issues).slice(0, 5);
  }, [activeBooks, copyMap, loansInRange]);

  const categoryStats = useMemo(() => data.categories.map((category) => {
    const books = activeBooks.filter((book) => book.category_id === category.id);
    const ids = new Set(books.map((book) => book.id));
    const loans = loansInRange.filter((loan) => {
      const copy = copyMap.get(loan.copy_id);
      return Boolean(copy && ids.has(copy.book_id));
    }).length;
    return { name: category.name, books: books.length, loans };
  }).sort((left, right) => right.loans - left.loans || right.books - left.books), [
    activeBooks,
    copyMap,
    data.categories,
    loansInRange,
  ]);

  const memberActivity = useMemo(() => {
    const activity = new Map<string, MemberActivity>();
    for (const loan of loansInRange) {
      const member = memberMap.get(loan.user_id);
      if (!member) continue;
      const existing = activity.get(member.id) || {
        name: member.full_name || member.email || 'Library member',
        department: departmentName(member.department_id),
        loans: 0,
        overdue: 0,
      };
      existing.loans += 1;
      if (getLoanStatus(loan, today) === 'Overdue') existing.overdue += 1;
      activity.set(member.id, existing);
    }
    return [...activity.values()].sort((left, right) => right.loans - left.loans);
  }, [departmentName, loansInRange, memberMap, today]);

  const overdueMembers = useMemo(() => {
    const activity = new Map<string, MemberActivity>();
    for (const loan of overdueLoans) {
      const member = memberMap.get(loan.user_id);
      if (!member) continue;
      const existing = activity.get(member.id) || {
        name: member.full_name || member.email || 'Library member',
        department: departmentName(member.department_id),
        loans: 0,
        overdue: 0,
      };
      existing.overdue += 1;
      activity.set(member.id, existing);
    }
    return [...activity.values()].sort((left, right) => right.overdue - left.overdue);
  }, [departmentName, memberMap, overdueLoans]);

  const departmentUsage = useMemo<DepartmentUsage[]>(() => {
    const usage = new Map<string, DepartmentUsage>();
    for (const member of memberRows) {
      const department = departmentName(member.department_id);
      if (department === 'Unassigned' || department === 'Other / unlisted') continue;
      const row = usage.get(department) || { department, members: 0, loans: 0, reservations: 0 };
      row.members += 1;
      usage.set(department, row);
    }
    for (const loan of loansInRange) {
      const department = departmentName(memberMap.get(loan.user_id)?.department_id || null);
      const row = usage.get(department);
      if (row) row.loans += 1;
    }
    for (const reservation of reservationsInRange) {
      const department = departmentName(memberMap.get(reservation.user_id)?.department_id || null);
      const row = usage.get(department);
      if (row) row.reservations += 1;
    }
    return [...usage.values()].sort((left, right) => right.loans - left.loans || right.members - left.members);
  }, [departmentName, loansInRange, memberMap, memberRows, reservationsInRange]);

  const loanStatusData = [
    { name: 'Active', value: loanCounts.Active, color: statusColors.Active },
    { name: 'Returned', value: loanCounts.Returned, color: statusColors.Returned },
    { name: 'Overdue', value: loanCounts.Overdue, color: statusColors.Overdue },
    { name: 'Other', value: loanCounts.Other, color: statusColors.Other },
  ].filter((item) => item.value > 0);

  const reservationCounts = reservationsInRange.reduce<Record<string, number>>((counts, row) => {
    const name = ['pending', 'ready', 'fulfilled', 'cancelled', 'expired'].includes(row.status)
      ? `${row.status[0].toUpperCase()}${row.status.slice(1)}`
      : 'Other';
    counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {});
  const reservationStatusData = Object.entries(reservationCounts).map(([name, value]) => ({
    name,
    value,
    color: statusColors[name] || statusColors.Other,
  }));
  const fineStatusData = ['pending', 'paid', 'waived'].map((status) => ({
    name: `${status[0].toUpperCase()}${status.slice(1)}`,
    value: finesInRange
      .filter((fine) => fine.status === status)
      .reduce((sum, fine) => sum + safeNumber(fine.amount), 0),
    color: statusColors[`${status[0].toUpperCase()}${status.slice(1)}`] || statusColors.Other,
  })).filter((item) => item.value > 0);
  const fineTotals = {
    generated: finesInRange.reduce((sum, fine) => sum + safeNumber(fine.amount), 0),
    pending: pendingFineAmount,
    paid: finesInRange.filter((fine) => fine.status === 'paid').reduce((sum, fine) => sum + safeNumber(fine.amount), 0),
    waived: finesInRange.filter((fine) => fine.status === 'waived').reduce((sum, fine) => sum + safeNumber(fine.amount), 0),
  };
  const weeklyActivity = useMemo(() => {
    const now = new Date();
    const currentWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    currentWeek.setDate(currentWeek.getDate() - ((currentWeek.getDay() + 6) % 7));
    return Array.from({ length: 8 }, (_, index) => {
      const start = new Date(currentWeek);
      start.setDate(start.getDate() - (7 - index) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const startKey = localDateKey(start);
      const endKey = localDateKey(end);
      return {
        start: startKey,
        label: `${formatDate(startKey)}–${formatDate(localDateKey(new Date(end.getTime() - 86400000)))}`,
        issued: loansInRange.filter((loan) => loan.issue_date >= startKey && loan.issue_date < endKey).length,
        returned: returnedInRange.filter((loan) => (loan.returned_date || '').slice(0, 10) >= startKey
          && (loan.returned_date || '').slice(0, 10) < endKey).length,
      };
    });
  }, [loansInRange, returnedInRange]);

  const exportRows = useMemo<Array<Array<string | number>>>(() => [
    ['Library Analytics Report', dateRangeOptions.find((option) => option.value === range)?.label || range],
    ['Generated', lastUpdated?.toLocaleString('en-IN') || ''],
    [],
    ['Metric', 'Value'],
    ['Total Books', activeBooks.length],
    ['Total Copies', data.copies.length],
    ['Total Members', memberRows.length],
    ['Total Loans', loansInRange.length],
    ['Active Loans', loanCounts.Active],
    ['Returned Loans', loanCounts.Returned],
    ['Overdue Loans', loanCounts.Overdue],
    ['Generated Fines', fineTotals.generated],
    ['Pending Fines', fineTotals.pending],
    ['Paid Fines', fineTotals.paid],
    ['Waived Fines', fineTotals.waived],
    [],
    ['Popular Books', 'Issues', 'Available Copies'],
    ...popularBooks.map((book) => [book.title, book.issues, book.available]),
    [],
    ['Category', 'Books', 'Loans'],
    ...categoryStats.map((row) => [row.name, row.books, row.loans]),
    [],
    ['Department', 'Members', 'Loans', 'Reservations'],
    ...departmentUsage.map((row) => [row.department, row.members, row.loans, row.reservations]),
  ], [
    activeBooks.length,
    categoryStats,
    data.copies.length,
    departmentUsage,
    fineTotals.generated,
    fineTotals.paid,
    fineTotals.pending,
    fineTotals.waived,
    lastUpdated,
    loansInRange.length,
    loanCounts.Active,
    loanCounts.Overdue,
    loanCounts.Returned,
    memberRows.length,
    popularBooks,
    range,
  ]);

  const handleExport = () => downloadReport(exportRows, range);
  const onRangeChange = (event: ChangeEvent<HTMLSelectElement>) => setRange(event.target.value as DateRange);

  return (
    <div className="library-analytics">
      <header className="analytics-hero">
        <div className="analytics-hero-orb analytics-orb-one" />
        <div className="analytics-hero-orb analytics-orb-two" />
        <div className="analytics-hero-content">
          <span className="analytics-eyebrow"><Library size={13} /> KG REDDY CAMPUS LIBRARY</span>
          <h1>Library Analytics</h1>
          <p>Insights into library performance, borrowing trends and collection usage.</p>
        </div>
        <div className="analytics-controls">
          <label className="analytics-date-select">
            <CalendarDays size={16} />
            <select value={range} onChange={onRangeChange} aria-label="Analytics date range">
              {dateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="analytics-button secondary" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'analytics-refreshing' : ''} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
          <button type="button" className="analytics-button primary" onClick={handleExport} disabled={loading}>
            <Download size={15} /> Export Report
          </button>
        </div>
        <div className="analytics-date-caption">
          <span>{rangeLabel(range, bounds)}</span>
          {lastUpdated && <small>Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>}
        </div>
      </header>

      {error && <div className="analytics-alert" role="alert"><AlertCircle size={17} />{error}</div>}
      {loading ? (
        <div className="analytics-kpi-grid">
          {Array.from({ length: 8 }, (_, index) => <div className="analytics-kpi-skeleton" key={index}><i /><b /><span /></div>)}
        </div>
      ) : (
        <>
          <section className="analytics-kpi-grid" aria-label="Library key performance indicators">
            <KPI title="Total Books" value={activeBooks.length} icon={<BookOpen />} tone="purple" />
            <KPI title="Total Copies" value={data.copies.length} icon={<Library />} tone="blue" />
            <KPI title="Total Members" value={memberRows.length} icon={<Users />} tone="teal" />
            <KPI title="Total Loans" value={loansInRange.length} icon={<Activity />} tone="orange" trend={previousPeriodTrend} />
            <KPI title="Active Loans" value={loanCounts.Active} icon={<Clock3 />} tone="blue" />
            <KPI title="Returned Loans" value={loanCounts.Returned} icon={<RotateCcw />} tone="green" />
            <KPI title="Overdue Loans" value={loanCounts.Overdue} icon={<AlertCircle />} tone="red" />
            <KPI title="Pending Fines" value={pendingFineAmount} icon={<CreditCard />} tone="gold" money />
          </section>

          <div className="analytics-chart-grid primary-charts">
            <Panel title="Borrowing Trends" subtitle={`Issued and returned items · ${dateRangeOptions.find((option) => option.value === range)?.label}`}>
              {trendData.some((point) => point.issued || point.returned) ? (
                <div className="analytics-chart analytics-chart-tall">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="issuedFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={palette.purple} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={palette.purple} stopOpacity={0.015} />
                        </linearGradient>
                        <linearGradient id="returnedFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={palette.teal} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={palette.teal} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#eeeaf4" strokeDasharray="4 5" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#858a99', fontSize: 11 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#858a99', fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 11, paddingBottom: 14 }} />
                      <Area name="Issued" dataKey="issued" type="monotone" stroke={palette.purple} strokeWidth={2.5} fill="url(#issuedFill)" activeDot={{ r: 5 }} animationDuration={800} />
                      <Area name="Returned" dataKey="returned" type="monotone" stroke={palette.teal} strokeWidth={2.5} fill="url(#returnedFill)" activeDot={{ r: 5 }} animationDuration={800} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart label="Loan activity will appear here when recorded." />}
            </Panel>

            <Panel title="Loan Status" subtitle="Current status of loans issued during this period">
              <DonutChart
                data={loanStatusData}
                total={Object.values(loanCounts).reduce((sum, value) => sum + value, 0)}
              />
            </Panel>
          </div>

          <div className="analytics-chart-grid">
            <Panel title="Most Borrowed Books" subtitle="Top titles by issue frequency">
              {popularBooks.length ? (
                <div className="analytics-chart analytics-chart-bars">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={popularBooks.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 14, left: 8, bottom: 2 }}>
                      <CartesianGrid stroke="#eeeaf4" strokeDasharray="4 5" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#858a99', fontSize: 10 }} />
                      <YAxis type="category" dataKey="title" width={145} axisLine={false} tickLine={false} tick={{ fill: '#565c6a', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="issues" name="Issues" fill={palette.purple} radius={[0, 6, 6, 0]} barSize={16} animationDuration={700} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart label="Book popularity needs loan history." />}
            </Panel>

            <Panel title="Collection by Category" subtitle="Titles in each category, with borrowing activity">
              {categoryStats.length ? (
                <div className="analytics-chart analytics-chart-bars">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryStats.slice(0, 8)} margin={{ top: 10, right: 8, left: -18, bottom: 28 }}>
                      <CartesianGrid stroke="#eeeaf4" strokeDasharray="4 5" vertical={false} />
                      <XAxis dataKey="name" interval={0} angle={-22} textAnchor="end" axisLine={false} tickLine={false} tick={{ fill: '#858a99', fontSize: 9 }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#858a99', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="books" name="Books" fill={palette.blue} radius={[5, 5, 0, 0]} barSize={19} />
                      <Bar dataKey="loans" name="Loans" fill={palette.orange} radius={[5, 5, 0, 0]} barSize={19} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart label="Add categories to see collection distribution." />}
            </Panel>
          </div>

          <div className="analytics-chart-grid">
            <Panel title="Weekly Borrowing Activity" subtitle="Issued and returned items by week">
              {weeklyActivity.some((week) => week.issued || week.returned) ? (
                <div className="analytics-chart analytics-chart-compact">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyActivity} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#eeeaf4" strokeDasharray="4 5" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#858a99', fontSize: 9 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#858a99', fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="issued" name="Issued" fill={palette.purple} radius={[5, 5, 0, 0]} />
                      <Bar dataKey="returned" name="Returned" fill={palette.teal} radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EmptyChart label="No weekly activity for the selected range." />}
            </Panel>

            <Panel title="Reservation Activity" subtitle="Reservation outcomes in the selected period">
              <DonutChart data={reservationStatusData} total={reservationsInRange.length} />
            </Panel>
          </div>

          <div className="analytics-chart-grid">
            <Panel title="Fine Analytics" subtitle="Recorded charges by status · INR">
              <div className="analytics-fine-summary">
                <div><span>Generated</span><strong>{formatMoney(fineTotals.generated)}</strong></div>
                <div><span>Pending</span><strong>{formatMoney(fineTotals.pending)}</strong></div>
                <div><span>Paid</span><strong>{formatMoney(fineTotals.paid)}</strong></div>
                <div><span>Waived</span><strong>{formatMoney(fineTotals.waived)}</strong></div>
              </div>
              {fineStatusData.length ? (
                <div className="analytics-fine-charts">
                  <div className="analytics-chart analytics-chart-compact">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#eeeaf4" strokeDasharray="4 5" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#858a99', fontSize: 10 }} />
                        <YAxis tickFormatter={(value: number) => `₹${formatNumber(value)}`} tickLine={false} axisLine={false} tick={{ fill: '#858a99', fontSize: 10 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="fines" name="Generated fines" fill={palette.orange} radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="analytics-fine-donut">
                    <DonutChart data={fineStatusData} total={fineTotals.generated} money />
                  </div>
                </div>
              ) : <EmptyChart label="No fines were generated during this period." />}
              {fineStatusData.length > 0 && (
                <div className="analytics-fine-status">
                  {fineStatusData.map((item) => (
                    <span key={item.name}><i style={{ background: item.color }} />{item.name}: {formatMoney(item.value)}</span>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Department Usage" subtitle="Member and circulation activity by department">
              {departmentUsage.length ? (
                <div className="analytics-table-scroll">
                  <table className="analytics-table">
                    <thead><tr><th>Department</th><th>Members</th><th>Loans</th><th>Reservations</th></tr></thead>
                    <tbody>{departmentUsage.map((row) => (
                      <tr key={row.department}>
                        <td><span className="analytics-department">{row.department.slice(0, 2).toUpperCase()}</span>{row.department}</td>
                        <td>{formatNumber(row.members)}</td><td>{formatNumber(row.loans)}</td><td>{formatNumber(row.reservations)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <EmptyChart label="Department-linked activity will appear here." />}
            </Panel>
          </div>

          <div className="analytics-chart-grid">
            <Panel title="Least Borrowed Books" subtitle="Active titles with the fewest issues in this period">
              <AnalyticsTable
                headers={['Book title', 'Issues', 'Available']}
                empty="No active books found."
                rows={leastBorrowedBooks.map((book) => [book.title, formatNumber(book.issues), formatNumber(book.available)])}
              />
            </Panel>
            <Panel title="Most Active Members" subtitle="Members with the most loans in the selected period">
              <AnalyticsTable
                headers={['Member', 'Department', 'Loans']}
                empty="No member activity in this period."
                rows={memberActivity.slice(0, 5).map((member) => [member.name, member.department, formatNumber(member.loans)])}
              />
            </Panel>
          </div>

          <div className="analytics-chart-grid">
            <Panel title="Overdue Members" subtitle="Members with loans past their due date">
              <AnalyticsTable
                headers={['Member', 'Department', 'Overdue']}
                empty="No current overdue members."
                rows={overdueMembers.slice(0, 8).map((member) => [member.name, member.department, formatNumber(member.overdue)])}
              />
            </Panel>
            <Panel title="Collection & Usage Insights" subtitle="Borrowing duration and catalogue activity">
              <div className="analytics-insights">
                <div><span>Average borrowing days</span><strong>{Number.isFinite(durationAverage) ? durationAverage.toFixed(1) : '0.0'}</strong></div>
                <div><span>Minimum borrowing days</span><strong>{returnedDurations.length ? Math.min(...returnedDurations) : 0}</strong></div>
                <div><span>Maximum borrowing days</span><strong>{returnedDurations.length ? Math.max(...returnedDurations) : 0}</strong></div>
                <div><span>Overdue members</span><strong>{overdueMembers.length}</strong></div>
                <div><span>Active titles</span><strong>{activeBooks.length}</strong></div>
                <div><span>Copies available</span><strong>{activeBooks.reduce((sum, book) => sum + safeNumber(book.available_copies), 0)}</strong></div>
              </div>
              {categoryStats.length > 0 && (
                <div className="analytics-insight-note">
                  <CheckCircle2 size={16} />
                  <span>{categoryStats[0].name} leads category borrowing with {categoryStats[0].loans} loans in this period.</span>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function AnalyticsTable({ headers, rows, empty }: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  if (!rows.length) return <EmptyChart label={empty} />;
  return (
    <div className="analytics-table-scroll">
      <table className="analytics-table">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => (
          <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
