import { useState } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { AdminSidebar } from "./admin-sidebar"
import { AdminHeader } from "./admin-header"
import { useAuthStore } from "@/stores/auth-store"

export function AdminShell() {
  const [collapsed, setCollapsed] = useState(false)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <AdminHeader collapsed={collapsed} />
      <main
        className="min-h-[calc(100vh-4rem)] transition-all duration-300"
        style={{ paddingLeft: collapsed ? "72px" : "240px" }}
      >
        <div className="p-6 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
