import { useParams, useNavigate } from "react-router-dom"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api, type CategoryItem } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useEffect, useState } from "react"

const productSchema = z.object({
  nameZh: z.string().min(1, "请输入中文名称"),
  nameEn: z.string().min(1, "请输入英文名称"),
  descZh: z.string().optional(),
  descEn: z.string().optional(),
  categoryId: z.string().min(1, "请选择分类"),
  brand: z.string().optional(),
  imageUrl: z.string().optional(),
  skus: z.array(z.object({ id: z.number().optional(), skuCode: z.string().min(1), price: z.string().min(1), costPrice: z.string().optional(), weight: z.string().optional() })).min(1),
})

type ProductForm = z.infer<typeof productSchema>

export default function ProductEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryItem[]>("/admin/categories").then(r => r.data),
  })

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<{ id: number; nameZh: string; nameEn: string; descZh: string; descEn: string; categoryId: number; brand: string; imageUrl: string; skus: { id: number; skuCode: string; price: number; costPrice?: number; weight?: number }[] }>(`/admin/products/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const { register, control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { nameZh: "", nameEn: "", descZh: "", descEn: "", categoryId: "", brand: "", imageUrl: "", skus: [{ skuCode: "", price: "" }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: "skus" })

  useEffect(() => {
    if (product) {
      reset({
        nameZh: product.nameZh, nameEn: product.nameEn, descZh: product.descZh || "", descEn: product.descEn || "",
        categoryId: String(product.categoryId), brand: product.brand || "", imageUrl: product.imageUrl || "",
        skus: product.skus.map(s => ({ id: s.id, skuCode: s.skuCode, price: String(s.price), costPrice: s.costPrice !== undefined ? String(s.costPrice) : "", weight: s.weight !== undefined ? String(s.weight) : "" })),
      })
    }
  }, [product, reset])

  const onSubmit = async (data: ProductForm) => {
    setSaving(true)
    try {
      const payload = {
        nameZh: data.nameZh, nameEn: data.nameEn, descZh: data.descZh || "", descEn: data.descEn || "",
        categoryId: Number(data.categoryId), brand: data.brand || "", imageUrl: data.imageUrl || "",
        skus: data.skus.map(s => ({ id: s.id, skuCode: s.skuCode, price: Number(s.price), costPrice: s.costPrice ? Number(s.costPrice) : undefined, weight: s.weight ? Number(s.weight) : undefined })),
      }
      await api.put(`/admin/products/${id}`, payload)
      toast({ title: "保存成功" })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["product", id] })
      navigate("/admin/products")
    } catch {
      toast({ title: "保存失败", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <div className="space-y-6 max-w-4xl"><Skeleton className="h-96 w-full" /></div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/products")}><ArrowLeft className="h-5 w-5" /></Button>
        <div><h1 className="text-2xl font-bold tracking-tight">编辑商品</h1><p className="text-sm text-muted-foreground mt-1">修改商品 SPU #{id} 的信息</p></div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">基本信息</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>中文名称 *</Label><Input {...register("nameZh")} />{errors.nameZh && <p className="text-sm text-destructive">{errors.nameZh.message}</p>}</div>
              <div className="space-y-2"><Label>英文名称 *</Label><Input {...register("nameEn")} />{errors.nameEn && <p className="text-sm text-destructive">{errors.nameEn.message}</p>}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>商品分类 *</Label>
                <Select onValueChange={(v) => setValue("categoryId", v)} value={watch("categoryId")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(categories || []).filter(c => c.parentId !== -1).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nameZh}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>品牌</Label><Input {...register("brand")} /></div>
            </div>
            <div><Label>商品图片 URL</Label><Input {...register("imageUrl")} className="mt-2" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">多语言描述</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>中文描述</Label><textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("descZh")} /></div>
            <div className="space-y-2"><Label>英文描述</Label><textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("descEn")} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">SKU 管理</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ skuCode: "", price: "" })}><Plus className="mr-1 h-3 w-3" />添加 SKU</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="grid flex-1 gap-3 md:grid-cols-4">
                    <div className="space-y-1"><Label>SKU 编码 *</Label><Input {...register(`skus.${index}.skuCode`)} /></div>
                    <div className="space-y-1"><Label>售价 *</Label><Input type="number" step="0.01" {...register(`skus.${index}.price`)} /></div>
                    <div className="space-y-1"><Label>成本价</Label><Input type="number" step="0.01" {...register(`skus.${index}.costPrice`)} /></div>
                    <div className="space-y-1"><Label>重量 (kg)</Label><Input type="number" step="0.01" {...register(`skus.${index}.weight`)} /></div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="mt-6 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate("/admin/products")}>取消</Button>
          <Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "保存中..." : "保存更改"}</Button>
        </div>
      </form>
    </div>
  )
}
