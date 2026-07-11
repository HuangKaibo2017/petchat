import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import {
  ShoppingCart,
  DollarSign,
  Package,
  Clock,
  TrendingUp,
  ArrowRight,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { api, type DashboardData, type TrendItem, type OrderListItem } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待支付", variant: "outline" },
  paid: { label: "已支付", variant: "secondary" },
  shipped: { label: "已发货", variant: "default" },
  completed: { label: "已完成", variant: "secondary" },
}

export default function DashboardPage() {
  const navigate = useNavigate()

  const { data: dashboard, isLoading: loadingDash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/admin/dashboard").then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: trends, isLoading: loadingTrends } = useQuery({
    queryKey: ["dashboard-trends"],
    queryFn: () => api.get<TrendItem[]>("/admin/dashboard/trends").then(r => r.data),
  })

  const { data: ordersData } = useQuery({
    queryKey: ["orders-recent"],
    queryFn: () => api.get<{ list: OrderListItem[] }>("/admin/orders", { page: "1", pageSize: "5" }).then(r => r.data),
  })

  const stats = dashboard || { todayOrders: 0, todayRevenue: 0, totalProducts: 0, pendingOrders: 0 }
  const recentOrders = ordersData?.list || []

  const STAT_CARDS = [
    { title: "今日订单", value: stats.todayOrders, unit: "单", icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "今日销售额", value: `¥${stats.todayRevenue.toLocaleString()}`, unit: "", icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "商品总数", value: stats.totalProducts, unit: "个", icon: Package, color: "text-violet-600", bg: "bg-violet-50" },
    { title: "待处理订单", value: stats.pendingOrders, unit: "单", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据看板</h1>
        <p className="text-sm text-muted-foreground mt-1">商城的核心运营数据一览</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loadingDash
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))
          : STAT_CARDS.map((stat) => (
              <Card key={stat.title} className="transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold">{stat.value}
                        {stat.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{stat.unit}</span>}
                      </p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.bg}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">
              <TrendingUp className="inline-block h-4 w-4 mr-2 text-muted-foreground" />
              近 7 天销售趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTrends ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trends || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">最近订单</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/orders")}>
              查看全部 <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">订单号</TableHead>
                  <TableHead className="text-xs">状态</TableHead>
                  <TableHead className="text-xs text-right">金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/orders/${order.id}`)}>
                    <TableCell className="text-xs font-mono">{order.orderNo}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_MAP[order.statusShipping]?.variant || "outline"} className="text-[10px]">
                        {STATUS_MAP[order.statusShipping]?.label || order.statusShipping}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right">¥{order.finalAmount}</TableCell>
                  </TableRow>
                ))}
                {recentOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">暂无订单</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
