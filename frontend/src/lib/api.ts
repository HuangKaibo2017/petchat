const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8001/api"

let authToken: string | null = null

export function setToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem("admin_token", token)
  } else {
    localStorage.removeItem("admin_token")
  }
}

export function getToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem("admin_token")
  }
  return authToken
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ code: number; data: T; message?: string }> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    setToken(null)
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || "Request failed")
  }
  return data
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string>) => {
    const searchParams = params ? "?" + new URLSearchParams(params).toString() : ""
    return request<T>(`${endpoint}${searchParams}`)
  },
  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: "DELETE" }),
}

export interface PaginatedData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface DashboardData {
  todayOrders: number
  todayRevenue: number
  totalProducts: number
  pendingOrders: number
}

export interface TrendItem {
  date: string
  orders: number
  revenue: number
}

export interface ProductListItem {
  id: number
  nameZh: string
  nameEn: string
  categoryName: string
  categoryId: number
  price: number
  status: string
  imageUrl: string
  createdAt: string
}

export interface ProductFormData {
  id?: number
  categoryId: number
  brand: string
  nameZh: string
  nameEn: string
  descZh: string
  descEn: string
  imageUrl: string
  skus: SkuFormData[]
}

export interface SkuFormData {
  id?: number
  skuCode: string
  price: number
  costPrice?: number
  weight?: number
}

export interface CategoryItem {
  id: number
  parentId: number
  code: string
  nameZh: string
  nameEn: string
  iconUrl: string
  order: number
  children?: CategoryItem[]
}

export interface OrderListItem {
  id: number
  orderNo: string
  userName: string
  totalAmount: number
  finalAmount: number
  statusPayment: string
  statusShipping: string
  createdAt: string
}

export interface OrderDetail {
  id: number
  orderNo: string
  userName: string
  totalAmount: number
  discountAmount: number
  finalAmount: number
  paymentMethod: string
  paymentStatus: string
  shippingStatus: string
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  items: OrderItemDTO[]
  shipment?: { carrier: string; trackingNumber: string }
  createdAt: string
  updatedAt: string
}

export interface OrderItemDTO {
  id: number
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}
