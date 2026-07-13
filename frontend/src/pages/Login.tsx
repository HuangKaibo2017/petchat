import { useState } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, PawPrint } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"

const loginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    const success = await login(data.username, data.password)
    setLoading(false)
    if (success) {
      toast({ title: "登录成功", description: "正在跳转到管理后台" })
      navigate("/admin/dashboard", { replace: true })
    } else {
      toast({ title: "登录失败", description: "用户名或密码错误", variant: "destructive" })
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-sidebar-bg lg:flex flex-col items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="mb-8 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-sidebar-accent">
              <PawPrint className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-sidebar-fg">更懂它</h1>
          <p className="text-lg text-sidebar-fg/70 leading-relaxed">
            宠物社区 · 商城后台管理系统
          </p>
          <p className="mt-6 text-sm text-sidebar-fg/50">
            管理商品上架、订单处理、库存追踪
          </p>
        </div>
      </div>

      <div className="flex w-full lg:w-1/2 items-center justify-center bg-muted/30 p-8">
        <Card className="w-full max-w-md border-0 shadow-none bg-transparent">
          <CardContent>
            <div className="mb-8 text-center lg:hidden">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-sidebar-bg">
                  <PawPrint className="h-8 w-8 text-sidebar-accent" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">更懂它 后台</h2>
            </div>

            <h2 className="mb-2 text-2xl font-bold text-center lg:text-left">管理员登录</h2>
            <p className="mb-8 text-sm text-muted-foreground text-center lg:text-left">
              请输入管理员账号和密码
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  placeholder="请输入用户名"
                  {...register("username")}
                  className={errors.username ? "border-destructive" : ""}
                />
                {errors.username && (
                  <p className="text-sm text-destructive">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="请输入密码"
                    {...register("password")}
                    className={errors.password ? "border-destructive pr-10" : "pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full bg-sidebar-bg hover:bg-sidebar-bg/90" disabled={loading}>
                {loading ? "登录中..." : "登 录"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
