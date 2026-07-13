import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AdminShell } from "@/components/layout/admin-shell"
import LoginPage from "@/pages/Login"
import DashboardPage from "@/pages/admin/dashboard/DashboardPage"
import ProductsPage from "@/pages/admin/products/ProductsPage"
import ProductNewPage from "@/pages/admin/products/ProductNewPage"
import ProductEditPage from "@/pages/admin/products/ProductEditPage"
import OrdersPage from "@/pages/admin/orders/OrdersPage"
import OrderDetailPage from "@/pages/admin/orders/OrderDetailPage"
import CategoriesPage from "@/pages/admin/categories/CategoriesPage"
import { ToastProvider, ToastViewport } from "@/components/ui/toast"
import { Toaster } from "@/components/ui/toaster"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<AdminShell />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/new" element={<ProductNewPage />} />
              <Route path="products/:id" element={<ProductEditPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
              <Route path="categories" element={<CategoriesPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
        <ToastViewport />
      </ToastProvider>
    </QueryClientProvider>
  )
}
