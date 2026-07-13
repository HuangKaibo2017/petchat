import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type CategoryItem } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

const productSchema = z.object({
  nameZh: z.string().min(1, "请输入中文名称"),
  nameEn: z.string().min(1, "请输入英文名称"),
  descZh: z.string().optional(),
  descEn: z.string().optional(),
  categoryId: z.string().min(1, "请选择分类"),
  brand: z.string().optional(),
  imageUrl: z.string().optional(),
  skus: z.array(z.object({
    skuCode: z.string().min(1, "请输入 SKU 编码"),
    price: z.string().min(1, "请输入价格"),
    costPrice: z.string().optional(),
    weight: z.string().optional(),
  })).min(1, "至少添加一个 SKU"),
})

type ProductForm = z.infer<typeof productSchema>

export default function ProductNewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryItem[]>("/admin/categories").then(r => r.data),
  })

  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      nameZh: "", nameEn: "", descZh: "", descEn: "", categoryId: "", brand: "", imageUrl: "",
      skus: [{ skuCode: "", price: "", costPrice: "", weight: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "skus" })

  const onSubmit = async (data: ProductForm) => {
    setSaving(true)
    try {
      const payload = {
        nameZh: data.nameZh, nameEn: data.nameEn, descZh: data.descZh || "", descEn: data.descEn || "",
        categoryId: Number(data.categoryId), brand: data.brand || "", imageUrl: data.imageUrl || "",
        skus: data.skus.map(s => ({ skuCode: s.skuCode, price: Number(s.price), costPrice: s.costPrice ? Number(s.costPrice) : undefined, weight: s.weight ? Number(s.weight) : undefined })),
      }
      await api.post("/admin/products", payload)
      toast({ title: "创建成功" })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      navigate("/admin/products")
    } catch {
      toast({ title: "创建失败", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/products")}><ArrowLeft className="h-5 w-5" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">新增商品</h1><p className="text-sm text-muted-foreground mt-1">创建新的商品 SPU 和 SKU</p></div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">基本信息</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="nameZh">中文名称 *</Label><Input id="nameZh" {...register("nameZh")} placeholder="请输入中文商品名称" />{errors.nameZh && <p className="text-sm text-destructive">{errors.nameZh.message}</p>}</div>
              <div className="space-y-2"><Label htmlFor="nameEn">英文名称 *</Label><Input id="nameEn" {...register("nameEn")} placeholder="Enter product name in English" />{errors.nameEn && <p className="text-sm text-destructive">{errors.nameEn.message}</p>}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>商品分类 *</Label>
                <Select onValueChange={(v) => setValue("categoryId", v)} value={watch("categoryId")}>
                  <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                  <SelectContent>
                    {(categories || []).filter(c => c.parentId !== -1).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nameZh}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
              </div>
              <div className="space-y-2"><Label htmlFor="brand">品牌</Label><Input id="brand" {...register("brand")} placeholder="请输入品牌名" /></div>
            </div>
            <div><Label htmlFor="imageUrl">商品图片 URL</Label><Input id="imageUrl" {...register("imageUrl")} placeholder="请输入图片链接" className="mt-2" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">多语言描述</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="descZh">中文描述</Label><textarea id="descZh" rows={3} placeholder="请输入中文商品描述" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...register("descZh")} /></div>
            <div className="space-y-2"><Label htmlFor="descEn">英文描述</Label><textarea id="descEn" rows={3} placeholder="Enter product description in English" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...register("descEn")} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">SKU 管理</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ skuCode: "", price: "", costPrice: "", weight: "" })}><Plus className="mr-1 h-3 w-3" />添加 SKU</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="grid flex-1 gap-3 md:grid-cols-4">
                    <div className="space-y-1"><Label>SKU 编码 *</Label><Input {...register(`skus.${index}.skuCode`)} placeholder="SKU-001" /></div>
                    <div className="space-y-1"><Label>售价 *</Label><Input type="number" step="0.01" {...register(`skus.${index}.price`)} placeholder="0.00" /></div>
                    <div className="space-y-1"><Label>成本价</Label><Input type="number" step="0.01" {...register(`skus.${index}.costPrice`)} placeholder="0.00" /></div>
                    <div className="space-y-1"><Label>重量 (kg)</Label><Input type="number" step="0.01" {...register(`skus.${index}.weight`)} placeholder="0.00" /></div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="mt-6 text-destructive hover:text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate("/admin/products")}>取消</Button>
          <Button type="submit" disabled={saving}>{saving ? "保存中..." : "保存商品"}</Button>
        </div>
      </form>
    </div>
  )
}
