import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Download,
  Receipt,
  RefreshCw,
  Wallet,
  TrendingDown,
  QrCode,
  Copy,
  Loader2,
  FileText,
  Barcode,
  Printer,
  FileDown,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format, isPast, isToday, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FinancialSummary {
  total_pending: number;
  total_overdue: number;
  total_due: number;
  next_due_date: string | null;
  next_due_amount: number | null;
  last_payment_date: string | null;
  last_payment_amount: number | null;
}

interface Invoice {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  payment_url: string | null;
  appointment_id: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  invoice_id: string;
  invoice_description: string;
  amount: number;
  payment_method: string;
  status: string;
  paid_at: string;
  receipt_url: string | null;
}

interface PixData {
  qr_code: string;
  qr_code_base64: string;
  copy_paste: string;
  expiration: string;
}

interface BoletoData {
  barcode: string;
  barcode_formatted: string;
  pdf_url: string;
  due_date: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  paid: { label: "Pago", variant: "default", icon: CheckCircle2 },
  overdue: { label: "Vencido", variant: "destructive", icon: AlertCircle },
  cancelled: { label: "Cancelado", variant: "outline", icon: AlertCircle },
};

export default function PatientFinanceiro() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [activeTab, setActiveTab] = useState("invoices");
  const [invoiceFilter, setInvoiceFilter] = useState<string | null>(null);
  
  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [boletoData, setBoletoData] = useState<BoletoData | null>(null);
  const [isGeneratingBoleto, setIsGeneratingBoleto] = useState(false);
  const [isDownloadingExtract, setIsDownloadingExtract] = useState(false);

  useEffect(() => {
    void loadSummary();
    void loadInvoices();
    void loadPayments();
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [invoiceFilter]);

  const loadSummary = async () => {
    setIsLoadingSummary(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("get_patient_financial_summary");
      if (error) throw error;
      setSummary(data as FinancialSummary);
    } catch (err) {
      logger.error("Error loading financial summary:", err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const loadInvoices = async () => {
    setIsLoadingInvoices(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("get_patient_invoices", {
        p_status: invoiceFilter,
        p_from: null,
        p_to: null,
      });
      if (error) throw error;
      setInvoices((data as Invoice[]) || []);
    } catch (err) {
      logger.error("Error loading invoices:", err);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const loadPayments = async () => {
    setIsLoadingPayments(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("get_patient_payment_history", {
        p_limit: 50,
        p_offset: 0,
      });
      if (error) throw error;
      setPayments((data as Payment[]) || []);
    } catch (err) {
      logger.error("Error loading payments:", err);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handlePayInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPixData(null);
    setBoletoData(null);
    setPaymentModalOpen(true);
  };

  const handleGenerateBoleto = async (invoice: Invoice) => {
    setIsGeneratingBoleto(true);
    try {
      const { data, error } = await supabasePatient.functions.invoke("create-patient-payment", {
        body: { 
          invoice_id: invoice.id,
          payment_method: "boleto",
        },
      });

      if (error) throw error;

      if (data?.boleto) {
        setBoletoData(data.boleto);
        setSelectedInvoice(invoice);
        setPaymentModalOpen(true);
        toast.success("Boleto gerado com sucesso!");
      } else if (data?.payment_url) {
        window.open(data.payment_url, "_blank");
      } else {
        toast.error("Não foi possível gerar o boleto.");
      }
    } catch (err) {
      logger.error("Error generating boleto:", err);
      toast.error("Erro ao gerar boleto. Tente novamente.");
    } finally {
      setIsGeneratingBoleto(false);
    }
  };

  const copyBoletoCode = async () => {
    if (!boletoData?.barcode_formatted) return;
    
    try {
      await navigator.clipboard.writeText(boletoData.barcode_formatted);
      toast.success("Linha digitável copiada!");
    } catch {
      toast.error("Erro ao copiar. Selecione e copie manualmente.");
    }
  };

  const handleDownloadExtract = async () => {
    setIsDownloadingExtract(true);
    try {
      const { data, error } = await supabasePatient.functions.invoke("generate-patient-extract", {
        body: { format: "pdf" },
      });

      if (error) throw error;

      if (data?.html_base64) {
        // Decodificar HTML e abrir em nova janela para impressão
        const html = decodeURIComponent(escape(atob(data.html_base64)));
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          toast.success("Extrato aberto. Use Ctrl+P para salvar como PDF.");
        }
      } else if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
      } else {
        toast.info("Extrato não disponível no momento.");
      }
    } catch (err) {
      logger.error("Error downloading extract:", err);
      toast.error("Erro ao gerar extrato. Tente novamente.");
    } finally {
      setIsDownloadingExtract(false);
    }
  };

  const handlePayWithGateway = async () => {
    if (!selectedInvoice) return;
    
    setIsGeneratingPayment(true);
    try {
      const { data, error } = await supabasePatient.functions.invoke("create-patient-payment", {
        body: { 
          invoice_id: selectedInvoice.id,
          payment_method: "gateway",
        },
      });

      if (error) throw error;

      if (data?.payment_url) {
        window.open(data.payment_url, "_blank");
        setPaymentModalOpen(false);
      } else {
        toast.error("Não foi possível gerar o link de pagamento.");
      }
    } catch (err) {
      logger.error("Error generating payment link:", err);
      toast.error("Erro ao gerar link de pagamento. Tente novamente.");
    } finally {
      setIsGeneratingPayment(false);
    }
  };

  const handlePayWithPix = async () => {
    if (!selectedInvoice) return;
    
    setIsGeneratingPayment(true);
    try {
      const { data, error } = await supabasePatient.functions.invoke("create-patient-payment", {
        body: { 
          invoice_id: selectedInvoice.id,
          payment_method: "pix",
        },
      });

      if (error) throw error;

      if (data?.pix) {
        setPixData(data.pix);
        toast.success("PIX gerado com sucesso!");
      } else if (data?.payment_url) {
        // Fallback: se o gateway não suporta PIX direto, abre o link
        window.open(data.payment_url, "_blank");
        setPaymentModalOpen(false);
      } else {
        toast.error("Não foi possível gerar o PIX.");
      }
    } catch (err) {
      logger.error("Error generating PIX:", err);
      toast.error("Erro ao gerar PIX. Tente novamente.");
    } finally {
      setIsGeneratingPayment(false);
    }
  };

  const copyPixCode = async () => {
    if (!pixData?.copy_paste) return;
    
    try {
      await navigator.clipboard.writeText(pixData.copy_paste);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Erro ao copiar. Selecione e copie manualmente.");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <PatientLayout
      title="Financeiro"
      subtitle="Faturas e pagamentos"
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadExtract}
            disabled={isDownloadingExtract}
          >
            {isDownloadingExtract ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Extrato
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void loadSummary();
              void loadInvoices();
              void loadPayments();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoadingSummary ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card className={cn(summary?.total_due && summary.total_due > 0 ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30" : "")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Wallet className="h-4 w-4" />
                  Saldo Devedor
                </div>
                <p className={cn("text-2xl font-bold", summary?.total_due && summary.total_due > 0 ? "text-amber-600" : "text-green-600")}>
                  {formatCurrency(summary?.total_due || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className={cn(summary?.total_overdue && summary.total_overdue > 0 ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30" : "")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingDown className="h-4 w-4" />
                  Vencido
                </div>
                <p className={cn("text-2xl font-bold", summary?.total_overdue && summary.total_overdue > 0 ? "text-red-600" : "text-muted-foreground")}>
                  {formatCurrency(summary?.total_overdue || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  Próximo Vencimento
                </div>
                {summary?.next_due_date ? (
                  <>
                    <p className="text-lg font-semibold">
                      {format(new Date(summary.next_due_date), "dd/MM/yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(summary.next_due_amount || 0)}
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-semibold text-green-600">Nenhum</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Último Pagamento
                </div>
                {summary?.last_payment_date ? (
                  <>
                    <p className="text-lg font-semibold">
                      {formatCurrency(summary.last_payment_amount || 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(summary.last_payment_date), "dd/MM/yyyy")}
                    </p>
                  </>
                ) : (
                  <p className="text-lg text-muted-foreground">—</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            Faturas
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { value: null, label: "Todas" },
              { value: "pending", label: "Pendentes" },
              { value: "overdue", label: "Vencidas" },
              { value: "paid", label: "Pagas" },
            ].map((filter) => (
              <Button
                key={filter.value || "all"}
                variant={invoiceFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setInvoiceFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {isLoadingInvoices ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhuma fatura encontrada"
              description={
                invoiceFilter
                  ? "Não há faturas com este status."
                  : "Você não possui faturas registradas."
              }
            />
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => {
                const config = statusConfig[invoice.status] || statusConfig.pending;
                const StatusIcon = config.icon;
                const dueDate = new Date(invoice.due_date);
                const isOverdue = invoice.status === "overdue" || (invoice.status === "pending" && isPast(dueDate) && !isToday(dueDate));
                const isDueSoon = invoice.status === "pending" && !isPast(dueDate) && dueDate <= addDays(new Date(), 3);

                return (
                  <Card
                    key={invoice.id}
                    className={cn(
                      "transition-colors",
                      isOverdue && "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20",
                      isDueSoon && "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/20"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{invoice.description}</h3>
                            <Badge variant={config.variant} className="flex items-center gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Vence: {format(dueDate, "dd/MM/yyyy")}
                            </span>
                            {invoice.paid_at && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Pago: {format(new Date(invoice.paid_at), "dd/MM/yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn("text-lg font-bold", invoice.status === "paid" ? "text-green-600" : isOverdue ? "text-red-600" : "")}>
                            {formatCurrency(invoice.amount)}
                          </p>
                          {invoice.status === "pending" || invoice.status === "overdue" ? (
                            <div className="flex gap-2 mt-2 justify-end">
                              {isOverdue && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleGenerateBoleto(invoice)}
                                  disabled={isGeneratingBoleto}
                                  title="Gerar 2ª via do boleto"
                                >
                                  {isGeneratingBoleto ? (
                                    <Spinner size="sm" />
                                  ) : (
                                    <Barcode className="h-3.5 w-3.5" />
                                  )}
                                  <span className="ml-1 hidden sm:inline">2ª Via</span>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className="bg-teal-600 hover:bg-teal-700"
                                onClick={() => handlePayInvoice(invoice)}
                              >
                                <CreditCard className="h-3.5 w-3.5 mr-1" />
                                Pagar
                              </Button>
                            </div>
                          ) : invoice.status === "paid" && invoice.payment_url ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2"
                              onClick={() => window.open(invoice.payment_url!, "_blank")}
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              Comprovante
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          {isLoadingPayments ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Nenhum pagamento encontrado"
              description="Seu histórico de pagamentos aparecerá aqui."
            />
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <Card key={payment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{payment.invoice_description}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(payment.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3.5 w-3.5" />
                            {payment.payment_method}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(payment.amount)}
                        </p>
                        {payment.receipt_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => window.open(payment.receipt_url!, "_blank")}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            Recibo
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar Fatura</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.description} - {selectedInvoice && formatCurrency(selectedInvoice.amount)}
            </DialogDescription>
          </DialogHeader>

          {!pixData && !boletoData ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground text-center">
                Escolha a forma de pagamento:
              </p>
              
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-16 justify-start gap-4"
                  onClick={handlePayWithPix}
                  disabled={isGeneratingPayment}
                >
                  {isGeneratingPayment ? (
                    <Spinner />
                  ) : (
                    <QrCode className="h-6 w-6 text-teal-600" />
                  )}
                  <div className="text-left">
                    <p className="font-medium">PIX</p>
                    <p className="text-xs text-muted-foreground">Pagamento instantâneo</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-16 justify-start gap-4"
                  onClick={() => selectedInvoice && handleGenerateBoleto(selectedInvoice)}
                  disabled={isGeneratingPayment || isGeneratingBoleto}
                >
                  {isGeneratingBoleto ? (
                    <Spinner />
                  ) : (
                    <Barcode className="h-6 w-6 text-orange-600" />
                  )}
                  <div className="text-left">
                    <p className="font-medium">Boleto Bancário</p>
                    <p className="text-xs text-muted-foreground">Vencimento em até 3 dias úteis</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-16 justify-start gap-4"
                  onClick={handlePayWithGateway}
                  disabled={isGeneratingPayment}
                >
                  {isGeneratingPayment ? (
                    <Spinner />
                  ) : (
                    <CreditCard className="h-6 w-6 text-blue-600" />
                  )}
                  <div className="text-left">
                    <p className="font-medium">Cartão de Crédito/Débito</p>
                    <p className="text-xs text-muted-foreground">Aprovação imediata</p>
                  </div>
                </Button>
              </div>
            </div>
          ) : boletoData ? (
            <div className="space-y-4 py-4">
              {/* Boleto Info */}
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Barcode className="h-5 w-5 text-orange-600" />
                  <p className="font-medium text-orange-800 dark:text-orange-200">Boleto Gerado</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs text-orange-700 dark:text-orange-300">Linha Digitável:</p>
                  <div className="relative">
                    <input
                      readOnly
                      value={boletoData.barcode_formatted}
                      className="w-full p-3 pr-12 text-xs font-mono bg-white dark:bg-gray-900 rounded-lg border"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={copyBoletoCode}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-orange-700 dark:text-orange-300">Vencimento:</span>
                  <span className="font-medium text-orange-800 dark:text-orange-200">
                    {format(new Date(boletoData.due_date), "dd/MM/yyyy")}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-orange-700 dark:text-orange-300">Valor:</span>
                  <span className="font-bold text-orange-800 dark:text-orange-200">
                    {selectedInvoice && formatCurrency(selectedInvoice.amount)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={copyBoletoCode}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Código
                </Button>
                {boletoData.pdf_url && (
                  <Button
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={() => window.open(boletoData.pdf_url, "_blank")}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Baixar PDF
                  </Button>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Como pagar:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Copie a linha digitável ou baixe o PDF</li>
                  <li>Acesse o app do seu banco ou internet banking</li>
                  <li>Escolha "Pagar boleto" e cole o código</li>
                  <li>Confirme os dados e finalize o pagamento</li>
                </ol>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  ⚠️ O pagamento pode levar até 3 dias úteis para ser compensado.
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setBoletoData(null)}
              >
                Voltar
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* QR Code */}
              <div className="flex justify-center">
                {pixData.qr_code_base64 ? (
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 border rounded-lg"
                  />
                ) : pixData.qr_code ? (
                  <div className="w-48 h-48 border rounded-lg flex items-center justify-center bg-muted">
                    <QrCode className="h-24 w-24 text-muted-foreground" />
                  </div>
                ) : null}
              </div>

              {/* Copy-paste code */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">Código PIX Copia e Cola:</p>
                <div className="relative">
                  <textarea
                    readOnly
                    value={pixData.copy_paste}
                    className="w-full h-20 p-3 pr-12 text-xs font-mono bg-muted rounded-lg resize-none"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2"
                    onClick={copyPixCode}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Expiration */}
              {pixData.expiration && (
                <p className="text-xs text-center text-muted-foreground">
                  Válido até: {format(new Date(pixData.expiration), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              )}

              {/* Instructions */}
              <div className="bg-teal-50 dark:bg-teal-950/30 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-teal-800 dark:text-teal-200">Como pagar:</p>
                <ol className="text-xs text-teal-700 dark:text-teal-300 space-y-1 list-decimal list-inside">
                  <li>Abra o app do seu banco</li>
                  <li>Escolha pagar com PIX</li>
                  <li>Escaneie o QR Code ou cole o código</li>
                  <li>Confirme o pagamento</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPixData(null)}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  onClick={copyPixCode}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Código
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}
