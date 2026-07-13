import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type OrderDetail } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [carrier, setCarrier] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [shipping, setShipping] = useState(false)

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.get<OrderDetail>(`/admin/orders/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const handleShip = async () => {
    if (!carrier || !trackingNumber) return
    setShipping(true)
    try {
      await api.put(`/admin/orders/${id}/ship`, { carrier, trackingNumber })
      toast({ title: "发货成功", description: "物流信息已更新" })
      queryClient.invalidateQueries({ queryKey: ["order", id] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    } catch {
      toast({ title: "发货失败", variant: "destructive" })
    } finally {
      setShipping(false)
    }
  }

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-96 w-full" /></div>
  }

  if (!order) {
    return <div className="text-center py-12 text-muted-foreground">订单不存在</div>
  }

  const STATUS_PAYMENT: Record<string, string> = { pending: "待支付", paid: "已支付", refunded: "已退款" }
  const STATUS_SHIPPING: Record<string, string> = { pending: "待发货", shipped: "已发货", completed: "已完成" }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/orders")}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">订单详情</h1>
          <p className="text-sm text-muted-foreground mt-1">订单号：{order.orderNo}</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">订单信息</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">订单号：</span>{order.orderNo}</div>
                <div><span className="text-muted-foreground">用户：</span>{order.userName}</div>
                <div><span className="text-muted-foreground">支付方式：</span>{order.paymentMethod}</div>
                <div><span className="text-muted-foreground">支付状态：</span><Badge variant="secondary" className="ml-1">{STATUS_PAYMENT[order.paymentStatus] || order.paymentStatus}</Badge></div>
                <div><span className="text-muted-foreground">发货状态：</span><Badge variant="default" className="ml-1">{STATUS_SHIPPING[order.shippingStatus] || order.shippingStatus}</Badge></div>
                <div><span className="text-muted-foreground">下单时间：</span>{order.createdAt}</div>
              </div>
              <Separator />
              <div className="flex justify-between text-sm"><span>商品总额</span><span>¥{order.totalAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span>优惠金额</span><span className="text-destructive">-¥{order.discountAmount.toFixed(2)}</span></div>
              <Separator />
              <div className="flex justify-between font-semibold"><span>实付金额</span><span className="text-lg">¥{order.finalAmount.toFixed(2)}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">商品明细</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>商品名称</TableHead><TableHead className="text-right">数量</TableHead><TableHead className="text-right">单价</TableHead><TableHead className="text-right">小计</TableHead></TableRow></TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}><TableCell>{item.productName}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">¥{item.unitPrice.toFixed(2)}</TableCell><TableCell className="text-right">¥{item.totalPrice.toFixed(2)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">收货信息</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">收货人：</span>{order.receiverName}</p>
              <p><span className="text-muted-foreground">电话：</span>{order.receiverPhone}</p>
              <p><span className="text-muted-foreground">地址：</span>{order.receiverAddress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">物流信息</CardTitle></CardHeader>
            <CardContent>
              {order.shipment ? (
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">物流商：</span>{order.shipment.carrier}</p>
                  <p><span className="text-muted-foreground">运单号：</span>{order.shipment.trackingNumber}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2"><Label>物流商</Label><Input placeholder="如：顺丰速运" value={carrier} onChange={(e) => setCarrier(e.target.value)} /></div>
                  <div className="space-y-2"><Label>快递单号</Label><Input placeholder="请输入快递单号" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} /></div>
                  <Button className="w-full" onClick={handleShip} disabled={shipping}>{shipping ? "发货中..." : "确认发货"}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
