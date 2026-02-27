import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Code2, Download, ExternalLink, Copy, Check } from "lucide-react";
import { generateOpenAPISpec, downloadOpenAPISpec } from "@/lib/public-api-spec";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-green-100 text-green-800 border-green-200",
    POST: "bg-blue-100 text-blue-800 border-blue-200",
    PUT: "bg-yellow-100 text-yellow-800 border-yellow-200",
    DELETE: "bg-red-100 text-red-800 border-red-200",
  };
  return <Badge variant="outline" className={`font-mono text-xs ${colors[method] ?? ""}`}>{method}</Badge>;
}

export default function ApiDocumentation() {
  const [copied, setCopied] = useState<string | null>(null);
  const spec = generateOpenAPISpec(SUPABASE_URL);

  const endpoints = Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods as Record<string, any>).map(([method, info]) => ({
      method: method.toUpperCase(),
      path,
      summary: info.summary ?? "",
      description: info.description ?? "",
      tags: info.tags ?? [],
    }))
  );

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const baseUrl = `${SUPABASE_URL}/rest/v1`;

  const curlExample = `curl -X GET "${baseUrl}/clients?select=id,name,cpf&limit=10" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json"`;

  const jsExample = `import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  '${SUPABASE_URL}',
  'YOUR_ANON_KEY'
)

// Autenticar
const { data: { session } } = await supabase.auth.signInWithPassword({
  email: 'user@clinic.com',
  password: 'password'
})

// Listar pacientes
const { data: patients } = await supabase
  .from("patients")
  .select('id, name, cpf, phone')
  .limit(10)

// Criar agendamento
const { data } = await supabase.rpc('create_appointment_v2', {
  p_client_id: 'uuid-do-paciente',
  p_service_id: 'uuid-do-servico',
  p_professional_id: 'uuid-do-profissional',
  p_scheduled_at: '2026-03-01T10:00:00Z',
  p_duration: 30,
  p_price: 150.00,
})`;

  return (
    <MainLayout
      title="API Pública"
      subtitle="Documentação REST para integrações de terceiros"
      actions={
        <Button variant="outline" className="gap-2" onClick={() => downloadOpenAPISpec(spec)}>
          <Download className="h-4 w-4" /> Baixar OpenAPI JSON
        </Button>
      }
    >
      {/* Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            ClinicNest API v{spec.info.version}
          </CardTitle>
          <CardDescription>{spec.info.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-semibold">Base URL (REST)</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{baseUrl}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(baseUrl, "base")}>
                  {copied === "base" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-semibold">Autenticação</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Header <code className="bg-muted px-1 rounded">apikey</code> com chave anon do projeto</p>
                <p>Header <code className="bg-muted px-1 rounded">Authorization: Bearer JWT</code></p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Endpoints Disponíveis</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Método</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((ep, i) => (
                  <TableRow key={i}>
                    <TableCell><MethodBadge method={ep.method} /></TableCell>
                    <TableCell className="font-mono text-xs">{ep.path}</TableCell>
                    <TableCell className="text-sm">{ep.summary}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {ep.tags.map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Code examples */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">cURL</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { handleCopy(curlExample, "curl"); toast.success("Copiado!"); }}>
                {copied === "curl" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">{curlExample}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">JavaScript / TypeScript</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { handleCopy(jsExample, "js"); toast.success("Copiado!"); }}>
                {copied === "js" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">{jsExample}</pre>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
