import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error("Erro ao fazer login", {
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    toast.success("Login realizado com sucesso!");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <div className="absolute -right-40 -bottom-40 h-80 w-80 rounded-full bg-accent/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-6 relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-vibrant shadow-glow animate-glow">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-primary/20 to-accent/20 blur-xl -z-10" />
          </div>
          <h1 className="font-display text-4xl font-bold text-gradient">VynloBella</h1>
          <p className="mt-2 text-muted-foreground">Gestão profissional para seu salão</p>
        </div>

        <Card className="glass border-white/20 shadow-2xl">
          <CardHeader className="space-y-2 text-center pb-2">
            <CardTitle className="text-2xl font-display">Bem-vindo de volta</CardTitle>
            <CardDescription>
              Entre com suas credenciais para acessar
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm focus:border-primary focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm focus:border-primary focus:ring-primary"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-5 pt-2">
              <Button
                type="submit"
                className="h-12 w-full rounded-xl gradient-primary text-white font-semibold shadow-glow hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
              <div className="space-y-2 text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary hover:text-accent transition-colors"
                >
                  Esqueci minha senha
                </Link>
                <p className="text-sm text-muted-foreground">
                  Não tem uma conta?{" "}
                  <Link
                    to="/cadastro"
                    className="font-semibold text-primary hover:text-accent transition-colors"
                  >
                    Cadastre-se gratuitamente
                  </Link>
                </p>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
