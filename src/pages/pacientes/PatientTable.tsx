import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, Plus, Phone, Mail, Pencil, Package, KeyRound,
  ShieldCheck, FileSignature, AlertTriangle, MessageCircle,
} from "lucide-react";
import { ContractStatusBadge } from "@/components/consent/ContractStatusBadge";
import type { Patient } from "@/types/database";

interface Props {
  patients: Patient[];
  isLoading: boolean;
  isAdmin: boolean;
  tenantId: string | undefined;
  searchQuery: string;
  onEdit: (patient: Patient) => void;
  onNewPatient: () => void;
  onOpenPackage: (patientId: string) => void;
  onOpenContracts: (patient: Patient) => void;
  onSendLink: (patient: Patient) => void;
  onOpenDrawer: (patient: Patient) => void;
}

export function PatientTable({
  patients, isLoading, isAdmin, tenantId, searchQuery,
  onEdit, onNewPatient, onOpenPackage, onOpenContracts, onSendLink, onOpenDrawer,
}: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isLoading ? "Pacientes Cadastrados" : `Pacientes Cadastrados (${patients.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchQuery ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
            description={searchQuery ? "Tente ajustar os termos da busca." : "Cadastre seu primeiro paciente para começar."}
            action={
              !searchQuery && (
                <Button className="gradient-primary text-primary-foreground" onClick={onNewPatient} data-tour="patients-new-empty">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Paciente
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Mobile: Card Layout */}
            <div className="block md:hidden space-y-3">
              {patients.map((patient) => (
                <div key={patient.id} className="rounded-lg border p-4 space-y-2 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{patient.name}</p>
                      {patient.allergies && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] gap-1 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30">
                          <AlertTriangle className="h-3 w-3" />Alergia
                        </Badge>
                      )}
                      {tenantId && <ContractStatusBadge patientId={patient.id} tenantId={tenantId} />}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onOpenDrawer(patient)} title="Ver Termos e Contratos">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onSendLink(patient)} title="Enviar Link WhatsApp">
                        <MessageCircle className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onOpenContracts(patient)} data-tour="patients-item-contracts">
                        <FileSignature className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => onOpenPackage(patient.id)} data-tour="patients-item-package">
                          <Package className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => onEdit(patient)} data-tour="patients-item-edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {patient.access_code && (
                    <div className="flex items-center gap-2 text-sm">
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                      <Badge variant="outline" className="font-mono text-xs tracking-wider">{patient.access_code}</Badge>
                    </div>
                  )}
                  {patient.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />{patient.phone}
                    </div>
                  )}
                  {patient.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" /><span className="truncate">{patient.email}</span>
                    </div>
                  )}
                  <div className="pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => navigate(`/pacientes/${patient.id}`)}
                      data-tour="patients-item-details"
                    >
                      Ver Ficha
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {patient.name}
                          {patient.allergies && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] gap-1 shrink-0 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30" title={`Alergias: ${patient.allergies}`}>
                              <AlertTriangle className="h-3 w-3" />Alergia
                            </Badge>
                          )}
                          {tenantId && <ContractStatusBadge patientId={patient.id} tenantId={tenantId} />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {patient.access_code ? (
                          <Badge variant="outline" className="font-mono text-xs tracking-wider">{patient.access_code}</Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{patient.phone ? <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-4 w-4" />{patient.phone}</div> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{patient.email ? <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-4 w-4" />{patient.email}</div> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{patient.notes || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => onOpenDrawer(patient)} title="Ver Termos e Contratos">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onSendLink(patient)} title="Enviar Link WhatsApp">
                            <MessageCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onOpenContracts(patient)} data-tour="patients-item-contracts" title="Gerar Contrato e Termos">
                            <FileSignature className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => onOpenPackage(patient.id)} data-tour="patients-item-package">
                              <Package className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => onEdit(patient)} data-tour="patients-item-edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
