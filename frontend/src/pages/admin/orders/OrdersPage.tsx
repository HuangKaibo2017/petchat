import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Search, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, type PaginatedData, type OrderListItem } from "@/lib/api"

const PAYMENT_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待支付", variant: "outline" },
  paid: { label: "已支付", variant: "secondary" },
}
const SHIPPING_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待发货", variant: "outline" },
  shipped: { label: "已发货", variant: "default" },
  completed: { label: "已完成", variant: "secondary" },
}

export default function OrdersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("all")
  const [page, setPage] = useState(1)

  const params: Record<string, string> = { page: String(page), pageSize: "20" }
  if (search) params.search = search
  if (tab !== "all") params.status = tab

  const { data, isLoading } = useQuery({
    queryKey: ["orders", params],
    queryFn: () => api.get<PaginatedData<OrderListItem>>("/admin/orders", params).then(r => r.data),
  })

  const orders = data?.list || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">订单管理</h1>
        <p className="text-sm text-muted-foreground mt-1">查看和管理所有订单</p>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索订单号或用户名..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
          </div>
          <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1) }}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="unpaid">待支付</TabsTrigger>
              <TabsTrigger value="pending">待发货</TabsTrigger>
              <TabsTrigger value="shipped">已发货</TabsTrigger>
              <TabsTrigger value="completed">已完成</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>用户</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>支付状态</TableHead>
                <TableHead>发货状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无订单数据</TableCell></TableRow>
              ) : orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.orderNo}</TableCell>
                  <TableCell>{order.userName}</TableCell>
                  <TableCell className="text-right">¥{order.finalAmount.toFixed(2)}</TableCell>
                  <TableCell><Badge variant={PAYMENT_STATUS[order.statusPayment]?.variant || "outline"}>{PAYMENT_STATUS[order.statusPayment]?.label || order.statusPayment}</Badge></TableCell>
                  <TableCell><Badge variant={SHIPPING_STATUS[order.statusShipping]?.variant || "outline"}>{SHIPPING_STATUS[order.statusShipping]?.label || order.statusShipping}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{order.createdAt}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/orders/${order.id}`)}><Eye className="mr-1 h-3 w-3" />详情</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">共 {total} 条</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
