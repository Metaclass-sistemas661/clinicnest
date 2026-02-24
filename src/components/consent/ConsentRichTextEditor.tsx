import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Highlighter,
  Variable,
  Minus,
  Pilcrow,
  Type,
  ChevronDown,
} from "lucide-react";

interface ConsentVariable {
  key: string;
  label: string;
  example: string;
  category: "paciente" | "clinica" | "contexto";
}

const CONSENT_VARIABLES: ConsentVariable[] = [
  { key: "nome_paciente", label: "Nome do Paciente", example: "Maria da Silva", category: "paciente" },
  { key: "cpf", label: "CPF", example: "123.456.789-00", category: "paciente" },
  { key: "data_nascimento", label: "Data de Nascimento", example: "01/01/1990", category: "paciente" },
  { key: "email", label: "E-mail", example: "maria@email.com", category: "paciente" },
  { key: "telefone", label: "Telefone", example: "(11) 99999-0000", category: "paciente" },
  { key: "endereco_completo", label: "Endereço Completo", example: "Rua A, 123 - São Paulo/SP", category: "paciente" },
  { key: "nome_clinica", label: "Nome da Clínica", example: "Clínica Saúde Plena", category: "clinica" },
  { key: "cnpj_clinica", label: "CNPJ da Clínica", example: "12.345.678/0001-00", category: "clinica" },
  { key: "endereco_clinica", label: "Endereço da Clínica", example: "Av. Brasil, 500 - Centro", category: "clinica" },
  { key: "responsavel_tecnico", label: "Responsável Técnico", example: "Dr. João da Silva", category: "clinica" },
  { key: "crm_responsavel", label: "CRM do Responsável", example: "CRM/SP 123456", category: "clinica" },
  { key: "data_hoje", label: "Data Atual", example: "24/02/2026", category: "contexto" },
  { key: "cidade", label: "Cidade", example: "São Paulo", category: "contexto" },
  { key: "estado", label: "Estado (UF)", example: "SP", category: "contexto" },
];

const CATEGORY_LABELS = {
  paciente: { label: "Dados do Paciente", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  clinica: { label: "Dados da Clínica", color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" },
  contexto: { label: "Contexto", color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400" },
};

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function ConsentRichTextEditor({
  value,
  onChange,
  placeholder = "Comece a escrever seu documento...",
  className,
  minHeight = "300px",
}: Props) {
  const [variablesOpen, setVariablesOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Highlight.configure({
        multicolor: false,
        HTMLAttributes: {
          class: "bg-yellow-200 dark:bg-yellow-800 px-1 rounded",
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          "prose-headings:font-semibold prose-headings:text-foreground",
          "prose-p:text-foreground prose-p:leading-relaxed",
          "prose-ul:text-foreground prose-ol:text-foreground",
          "prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground",
          "prose-strong:text-foreground prose-em:text-foreground"
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  const insertVariable = useCallback(
    (variable: ConsentVariable) => {
      if (!editor) return;
      editor.chain().focus().insertContent(`{{${variable.key}}}`).run();
      setVariablesOpen(false);
    },
    [editor]
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL do link:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    disabled,
    children,
    tooltip,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    tooltip: string;
  }) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "h-8 w-8 p-0",
              isActive && "bg-muted text-foreground"
            )}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className={cn("border rounded-lg overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-1.5 flex flex-wrap items-center gap-0.5">
        {/* Text Style Dropdown */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs">
              <Type className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Estilo</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-full justify-start text-xs h-8", editor.isActive("paragraph") && "bg-muted")}
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              <Pilcrow className="h-3.5 w-3.5 mr-2" />
              Parágrafo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-full justify-start text-lg font-bold h-9", editor.isActive("heading", { level: 1 }) && "bg-muted")}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 className="h-4 w-4 mr-2" />
              Título 1
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-full justify-start text-base font-semibold h-8", editor.isActive("heading", { level: 2 }) && "bg-muted")}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="h-3.5 w-3.5 mr-2" />
              Título 2
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("w-full justify-start text-sm font-medium h-8", editor.isActive("heading", { level: 3 }) && "bg-muted")}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 className="h-3.5 w-3.5 mr-2" />
              Título 3
            </Button>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Basic Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          tooltip="Negrito (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          tooltip="Itálico (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          tooltip="Sublinhado (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          tooltip="Tachado"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive("highlight")}
          tooltip="Destacar"
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          tooltip="Alinhar à esquerda"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          tooltip="Centralizar"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          tooltip="Alinhar à direita"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          isActive={editor.isActive({ textAlign: "justify" })}
          tooltip="Justificar"
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          tooltip="Lista com marcadores"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          tooltip="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Block Elements */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          tooltip="Citação"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          tooltip="Linha horizontal"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive("link")}
          tooltip="Inserir link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Variables - Main Feature */}
        <Popover open={variablesOpen} onOpenChange={setVariablesOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 gap-1.5 text-xs bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary"
            >
              <Variable className="h-3.5 w-3.5" />
              <span>Inserir Variável</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b bg-muted/30">
              <h4 className="font-medium text-sm">Variáveis Dinâmicas</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clique para inserir. Serão substituídas pelos dados reais do paciente.
              </p>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="p-2 space-y-3">
                {(["paciente", "clinica", "contexto"] as const).map((category) => (
                  <div key={category}>
                    <div className="px-2 py-1">
                      <Badge variant="secondary" className={cn("text-[10px]", CATEGORY_LABELS[category].color)}>
                        {CATEGORY_LABELS[category].label}
                      </Badge>
                    </div>
                    <div className="space-y-0.5">
                      {CONSENT_VARIABLES.filter((v) => v.category === category).map((variable) => (
                        <Button
                          key={variable.key}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-auto py-2 px-2 text-left"
                          onClick={() => insertVariable(variable)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                                {`{{${variable.key}}}`}
                              </code>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {variable.label} • <span className="italic">ex: {variable.example}</span>
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          tooltip="Desfazer (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          tooltip="Refazer (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Bubble Menu for quick formatting */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100 }}
        className="bg-background border rounded-lg shadow-lg p-1 flex items-center gap-0.5"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("bold") && "bg-muted")}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("italic") && "bg-muted")}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("underline") && "bg-muted")}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={cn("h-7 w-7 p-0", editor.isActive("highlight") && "bg-muted")}
        >
          <Highlighter className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-0.5" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={setLink}
          className={cn("h-7 w-7 p-0", editor.isActive("link") && "bg-muted")}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
      </BubbleMenu>

      {/* Editor Content */}
      <div
        className="p-4 cursor-text"
        style={{ minHeight }}
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Footer with tips */}
      <div className="border-t bg-muted/20 px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Dica: Selecione texto para formatação rápida • Use <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+B</kbd> para negrito
        </span>
        <span>
          {editor.storage.characterCount?.characters?.() ?? 0} caracteres
        </span>
      </div>
    </div>
  );
}
