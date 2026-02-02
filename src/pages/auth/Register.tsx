import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [salonName, setSalonName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(email, password, fullName, salonName);

    if (error) {
      toast.error("Erro ao criar conta", {
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    toast.success("Conta criada com sucesso!");
    navigate("/login");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-accent/20 blur-3xl animate-pulse" />
        <div className="absolute -right-40 -bottom-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-5 relative">
            <div className="flex h-18 w-18 items-center justify-center rounded-3xl gradient-vibrant shadow-glow animate-glow">
              <Sparkles className="h-9 w-9 text-white" />
            </div>
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-accent/20 to-primary/20 blur-xl -z-10" />
          </div>
          <h1 className="font-display text-3xl font-bold text-gradient">VynloBella</h1>
          <p className="mt-1 text-muted-foreground text-sm">Gestão inteligente para seu salão</p>
        </div>

        <Card className="glass border-white/20 shadow-2xl">
          <CardHeader className="space-y-1 text-center pb-2">
            <CardTitle className="text-2xl font-display">Crie sua conta</CardTitle>
            <CardDescription>
              Comece a gerenciar seu salão gratuitamente
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">Seu nome</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Maria Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-11 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salonName" className="text-sm font-medium">Nome do salão</Label>
                <Input
                  id="salonName"
                  type="text"
                  placeholder="Salão Beleza & Estilo"
                  value={salonName}
                  onChange={(e) => setSalonName(e.target.value)}
                  required
                  className="h-11 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-11 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button
                type="submit"
                className="h-12 w-full rounded-xl gradient-accent text-white font-semibold shadow-glow-accent hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  <>
                    Criar conta
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-primary hover:text-accent transition-colors"
                >
                  Faça login
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
