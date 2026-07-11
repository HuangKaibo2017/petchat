import { NavLink, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Tags,
  ChevronLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "数据看板" },
  { to: "/admin/products", icon: Package, label: "商品管理" },
  { to: "/admin/orders", icon: ShoppingCart, label: "订单管理" },
  { to: "/admin/categories", icon: Tags, label: "分类管理" },
]

interface AdminSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex h-screen flex-col bg-sidebar-bg text-sidebar-fg transition-all duration-300",
        collapsed ? "w-[72px]" : "w-60"
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-white/10 px-4", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight">更懂它 后台</span>
        )}
        {collapsed && <span className="text-lg font-bold">🐾</span>}
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-fg hover:bg-white/10 hover:text-sidebar-fg h-8 w-8"
          onClick={onToggle}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      <Separator className="bg-white/10" />

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/")
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-fg/70 hover:bg-white/10 hover:text-sidebar-fg",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className={cn("border-t border-white/10 p-3", collapsed && "flex justify-center")}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-white">
              A
            </div>
            <div className="text-sm">
              <p className="font-medium">管理员</p>
              <p className="text-sidebar-fg/50 text-xs">admin</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-white">
            A
          </div>
        )}
      </div>
    </aside>
  )
}
