import { useState } from "react";
import {
  QuickDocumentActions,
  type DocumentContext,
  type GeneratedDocument,
} from "./QuickDocumentActions";
import { ReceitaDrawer, type ReceitaData } from "./ReceitaDrawer";
import { AtestadoDrawer, type AtestadoData } from "./AtestadoDrawer";
import { LaudoDrawer, type LaudoData } from "./LaudoDrawer";
import { EncaminhamentoDrawer, type EncaminhamentoData } from "./EncaminhamentoDrawer";
import { toast } from "sonner";

interface ProntuarioDocumentsProps {
  context: DocumentContext;
  generatedDocuments?: GeneratedDocument[];
  onReceitaSave?: (data: ReceitaData) => void;
  onAtestadoSave?: (data: AtestadoData) => void;
  onLaudoSave?: (data: LaudoData) => void;
  onEncaminhamentoSave?: (data: EncaminhamentoData) => void;
}

export function ProntuarioDocuments({
  context,
  generatedDocuments = [],
  onReceitaSave,
  onAtestadoSave,
  onLaudoSave,
  onEncaminhamentoSave,
}: ProntuarioDocumentsProps) {
  const [receitaOpen, setReceitaOpen] = useState(false);
  const [atestadoOpen, setAtestadoOpen] = useState(false);
  const [laudoOpen, setLaudoOpen] = useState(false);
  const [encaminhamentoOpen, setEncaminhamentoOpen] = useState(false);

  const handlePrintReceita = (data: ReceitaData) => {
    toast.info("Preparando impressão da receita...");
    // Lógica de impressão
  };

  const handlePrintAtestado = (data: AtestadoData) => {
    toast.info("Preparando impressão do atestado...");
  };

  const handlePrintLaudo = (data: LaudoData) => {
    toast.info("Preparando impressão do laudo...");
  };

  const handlePrintEncaminhamento = (data: EncaminhamentoData) => {
    toast.info("Preparando impressão do encaminhamento...");
  };

  const handleViewDocument = (doc: GeneratedDocument) => {
    toast.info(`Abrindo ${doc.title}...`);
  };

  const handlePrintDocument = (doc: GeneratedDocument) => {
    toast.info(`Imprimindo ${doc.title}...`);
  };

  return (
    <>
      <QuickDocumentActions
        context={context}
        generatedDocuments={generatedDocuments}
        onGenerateReceita={() => setReceitaOpen(true)}
        onGenerateAtestado={() => setAtestadoOpen(true)}
        onGenerateLaudo={() => setLaudoOpen(true)}
        onGenerateEncaminhamento={() => setEncaminhamentoOpen(true)}
        onViewDocument={handleViewDocument}
        onPrintDocument={handlePrintDocument}
      />

      <ReceitaDrawer
        open={receitaOpen}
        onOpenChange={setReceitaOpen}
        context={context}
        onSave={onReceitaSave}
        onPrint={handlePrintReceita}
      />

      <AtestadoDrawer
        open={atestadoOpen}
        onOpenChange={setAtestadoOpen}
        context={context}
        onSave={onAtestadoSave}
        onPrint={handlePrintAtestado}
      />

      <LaudoDrawer
        open={laudoOpen}
        onOpenChange={setLaudoOpen}
        context={context}
        onSave={onLaudoSave}
        onPrint={handlePrintLaudo}
      />

      <EncaminhamentoDrawer
        open={encaminhamentoOpen}
        onOpenChange={setEncaminhamentoOpen}
        context={context}
        onSave={onEncaminhamentoSave}
        onPrint={handlePrintEncaminhamento}
      />
    </>
  );
}

export { QuickDocumentActions } from "./QuickDocumentActions";
export { ReceitaDrawer, type ReceitaData } from "./ReceitaDrawer";
export { AtestadoDrawer, type AtestadoData } from "./AtestadoDrawer";
export { LaudoDrawer, type LaudoData } from "./LaudoDrawer";
export { EncaminhamentoDrawer, type EncaminhamentoData } from "./EncaminhamentoDrawer";
export type { DocumentContext, GeneratedDocument } from "./QuickDocumentActions";
