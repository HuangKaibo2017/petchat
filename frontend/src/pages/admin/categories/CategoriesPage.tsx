import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type CategoryItem } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface CategoryNode {
  id: number
  parentId: number
  code: string
  nameZh: string
  nameEn: string
  iconUrl: string
  order: number
  children: CategoryNode[]
}

function buildTree(list: CategoryItem[]): CategoryNode[] {
  const map = new Map<number, CategoryNode>()
  list.forEach((c) => {
    map.set(c.id, {
      id: c.id, parentId: c.parentId, code: c.code,
      nameZh: c.nameZh, nameEn: c.nameEn,
      iconUrl: c.iconUrl, order: c.order, children: [],
    })
  })
  const roots: CategoryNode[] = []
  map.forEach((c) => {
    if (c.parentId === -1 || !map.has(c.parentId)) { roots.push(c) }
    else { map.get(c.parentId)!.children.push(c) }
  })
  return roots
}

function CategoryRow({ category, depth, onNew, onEdit, onDelete }: { category: CategoryNode; depth: number; onNew: (id: number) => void; onEdit: (c: CategoryNode) => void; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <>
      <div className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/50 transition-colors" style={{ paddingLeft: `${16 + depth * 24}px` }}>
        {category.children.length > 0 && <button onClick={() => setExpanded(!expanded)} className="p-0.5"><ChevronRight className={`h-4 w-4 transition-transform text-muted-foreground ${expanded ? "rotate-90" : ""}`} /></button>}
        {category.children.length === 0 && <span className="w-5" />}
        <div className="flex-1"><p className="text-sm font-medium">{category.nameZh}</p><p className="text-xs text-muted-foreground">{category.nameEn}</p></div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNew(category.id)}><Plus className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(category)}><Pencil className="h-3.5 w-3.5" /></Button>
          {category.parentId !== -1 && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(category.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      </div>
      {expanded && category.children.map((child) => <CategoryRow key={child.id} category={child} depth={depth + 1} onNew={onNew} onEdit={onEdit} onDelete={onDelete} />)}
    </>
  )
}

export default function CategoriesPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [showDialog, setShowDialog] = useState(false)
  const [parentId, setParentId] = useState(-1)
  const [formNameZh, setFormNameZh] = useState("")
  const [formNameEn, setFormNameEn] = useState("")
  const [formCode, setFormCode] = useState("")
  const [saving, setSaving] = useState(false)

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryItem[]>("/admin/categories").then(r => r.data),
  })

  const tree = categories ? buildTree(categories) : []

  const handleNew = (pid: number) => {
    setParentId(pid)
    setFormNameZh("")
    setFormNameEn("")
    setFormCode("")
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formNameZh || !formCode) return
    setSaving(true)
    try {
      await api.post("/admin/categories", { parentId, code: formCode, nameZh: formNameZh, nameEn: formNameEn })
      toast({ title: "创建成功" })
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      setShowDialog(false)
    } catch {
      toast({ title: "创建失败", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">分类管理</h1><p className="text-sm text-muted-foreground mt-1">管理商品分类层级结构</p></div>
        <Button onClick={() => handleNew(-1)}><Plus className="mr-2 h-4 w-4" />新增分类</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">分类结构</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : tree.map((root) => <CategoryRow key={root.id} category={root} depth={0} onNew={handleNew} onEdit={() => {}} onDelete={() => {}} />)}
        </CardContent>
      </Card>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增分类</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>中文名称</Label><Input value={formNameZh} onChange={(e) => setFormNameZh(e.target.value)} placeholder="请输入中文分类名" /></div>
            <div className="space-y-2"><Label>英文名称</Label><Input value={formNameEn} onChange={(e) => setFormNameEn(e.target.value)} placeholder="Enter category name in English" /></div>
            <div className="space-y-2"><Label>分类编码</Label><Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="如：necklace" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
