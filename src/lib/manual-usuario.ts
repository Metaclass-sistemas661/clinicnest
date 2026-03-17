/**
 * Manual do Usuário — ClinicNest
 * Documentação completa para certificação SBIS NGS1/NGS2
 * 
 * Este arquivo contém todo o conteúdo do manual em formato estruturado
 */

import { APP_VERSION } from "@/lib/version";

export interface ManualSection {
  id: string;
  title: string;
  content: string;
  subsections?: ManualSubsection[];
}

export interface ManualSubsection {
  id: string;
  title: string;
  content: string;
}

export const MANUAL_USUARIO: ManualSection[] = [
  {
    id: "introducao",
    title: "1. Introdução",
    content: `O ClinicNest é um sistema de gestão clínica completo, desenvolvido para atender às necessidades de clínicas médicas, odontológicas e de saúde em geral. O sistema foi projetado seguindo as normas da SBIS (Sociedade Brasileira de Informática em Saúde) e está em conformidade com a LGPD (Lei Geral de Proteção de Dados).`,
    subsections: [
      {
        id: "objetivo",
        title: "1.1 Objetivo do Sistema",
        content: `O ClinicNest tem como objetivo centralizar e automatizar os processos administrativos e clínicos, incluindo:
• Agendamento de consultas e procedimentos
• Prontuário Eletrônico do Paciente (PEP)
• Prescrição eletrônica de medicamentos
• Faturamento TISS para convênios
• Gestão financeira completa
• Controle de estoque
• Relatórios gerenciais`,
      },
      {
        id: "requisitos",
        title: "1.2 Requisitos Mínimos",
        content: `Para utilizar o ClinicNest, você precisa de:
• Navegador web atualizado (Chrome, Firefox, Edge ou Safari)
• Conexão com a internet
• Resolução mínima de tela: 1280x720 pixels
• Para assinatura digital: certificado ICP-Brasil A1 ou A3`,
      },
    ],
  },
  {
    id: "acesso",
    title: "2. Acesso ao Sistema",
    content: `O acesso ao ClinicNest é feito através de autenticação segura com e-mail e senha.`,
    subsections: [
      {
        id: "login",
        title: "2.1 Login",
        content: `Para acessar o sistema:
1. Acesse o endereço fornecido pela sua clínica
2. Digite seu e-mail cadastrado
3. Digite sua senha
4. Clique em "Entrar"

Em caso de esquecimento da senha, utilize a opção "Esqueci minha senha" para receber um link de recuperação por e-mail.`,
      },
      {
        id: "perfis",
        title: "2.2 Perfis de Acesso",
        content: `O sistema possui diferentes perfis com permissões específicas:

• **Administrador**: Acesso total ao sistema, incluindo configurações, financeiro completo e gestão de equipe.
• **Médico/Profissional de Saúde**: Acesso a prontuários, prescrições, agenda própria e laudos.
• **Enfermeiro**: Acesso a triagem, evoluções de enfermagem e sinais vitais.
• **Secretária**: Acesso a agenda, cadastro de pacientes e recepção.
• **Faturista**: Acesso ao módulo TISS e faturamento de convênios.`,
      },
      {
        id: "seguranca",
        title: "2.3 Segurança",
        content: `O ClinicNest implementa diversas medidas de segurança:
• Autenticação com JWT (JSON Web Token)
• Criptografia de dados em trânsito (HTTPS/TLS)
• Senhas armazenadas com hash seguro
• Timeout de sessão por inatividade
• Registro de auditoria de todas as ações
• Controle de acesso por perfil (RBAC)`,
      },
    ],
  },
  {
    id: "agenda",
    title: "3. Módulo de Agenda",
    content: `O módulo de Agenda é o coração operacional da clínica, permitindo o gerenciamento completo de consultas e procedimentos.`,
    subsections: [
      {
        id: "criar-agendamento",
        title: "3.1 Criar Agendamento",
        content: `Para criar um novo agendamento:
1. Acesse o menu "Agenda"
2. Clique no botão "Novo Agendamento"
3. Selecione o paciente (ou cadastre um novo)
4. Escolha o procedimento
5. Selecione o profissional responsável
6. Escolha a data e horário disponível
7. Adicione observações se necessário
8. Clique em "Salvar"

O sistema validará automaticamente conflitos de horário e disponibilidade.`,
      },
      {
        id: "status-agendamento",
        title: "3.2 Status do Agendamento",
        content: `Os agendamentos podem ter os seguintes status:
• **Agendado**: Consulta marcada, aguardando confirmação
• **Confirmado**: Paciente confirmou presença
• **Em Atendimento**: Paciente está sendo atendido
• **Finalizado**: Atendimento concluído
• **Cancelado**: Agendamento cancelado
• **Não Compareceu**: Paciente faltou

A mudança de status para "Finalizado" gera automaticamente o registro financeiro.`,
      },
      {
        id: "visualizacoes",
        title: "3.3 Visualizações",
        content: `A agenda oferece diferentes visualizações:
• **Dia**: Visão detalhada de um único dia
• **Semana**: Visão semanal com todos os profissionais
• **Mês**: Calendário mensal com indicadores

Use os filtros para visualizar por profissional, procedimento ou status.`,
      },
    ],
  },
  {
    id: "prontuario",
    title: "4. Prontuário Eletrônico",
    content: `O Prontuário Eletrônico do Paciente (PEP) segue as normas da SBIS e permite o registro completo do histórico clínico.`,
    subsections: [
      {
        id: "estrutura-soap",
        title: "4.1 Estrutura SOAP",
        content: `O prontuário utiliza a metodologia SOAP:
• **S (Subjetivo)**: Queixas e relatos do paciente
• **O (Objetivo)**: Exame físico e sinais vitais
• **A (Avaliação)**: Diagnóstico e hipóteses (CID-10)
• **P (Plano)**: Conduta e tratamento proposto

Esta estrutura padronizada facilita a comunicação entre profissionais e garante a completude do registro.`,
      },
      {
        id: "sinais-vitais",
        title: "4.2 Sinais Vitais",
        content: `O sistema permite o registro de:
• Pressão arterial (sistólica/diastólica)
• Frequência cardíaca
• Temperatura corporal
• Saturação de oxigênio
• Frequência respiratória
• Peso e altura (cálculo automático de IMC)

Os sinais vitais são exibidos em gráficos de tendência para acompanhamento longitudinal.`,
      },
      {
        id: "assinatura-digital",
        title: "4.3 Assinatura Digital",
        content: `O prontuário pode ser assinado digitalmente para garantir:
• Autenticidade do autor
• Integridade do conteúdo
• Não-repúdio

A assinatura utiliza certificado ICP-Brasil e gera um hash SHA-256 do conteúdo. Prontuários assinados não podem ser alterados, apenas complementados com novas evoluções.`,
      },
      {
        id: "versionamento",
        title: "4.4 Versionamento",
        content: `O sistema mantém histórico completo de alterações:
• Cada edição gera uma nova versão
• Motivo da alteração é obrigatório
• Versões anteriores ficam disponíveis para consulta
• Após 24 horas, o prontuário é bloqueado para edição

Este mecanismo atende aos requisitos de auditoria e rastreabilidade da SBIS.`,
      },
    ],
  },
  {
    id: "prescricao",
    title: "5. Prescrição Eletrônica",
    content: `O módulo de prescrição permite a emissão de receitas médicas com validação e impressão formatada.`,
    subsections: [
      {
        id: "criar-receita",
        title: "5.1 Criar Receita",
        content: `Para criar uma prescrição:
1. Acesse "Receituários" no menu
2. Clique em "Nova Receita"
3. Selecione o paciente
4. Adicione os medicamentos com:
   - Nome do medicamento
   - Dosagem
   - Posologia (frequência e duração)
   - Via de administração
5. Adicione orientações gerais se necessário
6. Clique em "Salvar" ou "Imprimir"`,
      },
      {
        id: "receita-controlada",
        title: "5.2 Receitas Controladas",
        content: `Para medicamentos controlados (Portaria 344/98):
• O sistema identifica automaticamente substâncias controladas
• Campos adicionais são exigidos (endereço do paciente, etc.)
• A impressão segue o formato legal exigido
• Integração com SNGPC para notificação à ANVISA`,
      },
      {
        id: "impressao",
        title: "5.3 Impressão",
        content: `A impressão da receita inclui:
• Timbre da clínica (logo e dados)
• Dados do paciente
• Lista de medicamentos com posologia
• Data e assinatura do prescritor
• CRM e especialidade do médico

O formato atende às exigências legais e pode ser personalizado nas configurações.`,
      },
    ],
  },
  {
    id: "financeiro",
    title: "6. Módulo Financeiro",
    content: `O módulo financeiro oferece controle completo de receitas, despesas e fluxo de caixa.`,
    subsections: [
      {
        id: "transacoes",
        title: "6.1 Transações",
        content: `Tipos de transações:
• **Receitas**: Entradas de dinheiro (atendimentos, vendas)
• **Despesas**: Saídas de dinheiro (fornecedores, salários)

Transações podem ser:
• Manuais: Cadastradas diretamente
• Automáticas: Geradas por atendimentos finalizados`,
      },
      {
        id: "categorias",
        title: "6.2 Categorias",
        content: `O sistema possui categorias pré-definidas:
• Consultas e procedimentos
• Exames
• Produtos/Medicamentos
• Aluguel e infraestrutura
• Salários e comissões
• Impostos
• Marketing

Categorias personalizadas podem ser criadas pelo administrador.`,
      },
      {
        id: "relatorios",
        title: "6.3 Relatórios",
        content: `Relatórios disponíveis:
• Fluxo de caixa diário/mensal
• DRE (Demonstrativo de Resultados)
• Receitas por profissional
• Despesas por categoria
• Comissões a pagar
• Inadimplência

Todos os relatórios podem ser exportados em PDF.`,
      },
    ],
  },
  {
    id: "tiss",
    title: "7. Faturamento TISS",
    content: `O módulo TISS permite a geração de guias no padrão ANS para faturamento de convênios.`,
    subsections: [
      {
        id: "tipos-guia",
        title: "7.1 Tipos de Guia",
        content: `O sistema gera os seguintes tipos de guia:
• **Consulta**: Para consultas médicas
• **SP/SADT**: Para exames e procedimentos
• **Honorários**: Para honorários médicos

Cada tipo segue o schema XML da ANS versão 3.05.`,
      },
      {
        id: "gerar-guias",
        title: "7.2 Gerar Guias",
        content: `Para gerar guias TISS:
1. Acesse "Faturamento TISS"
2. Selecione os atendimentos a faturar
3. Escolha o tipo de guia
4. Clique em "Gerar Guias"
5. O sistema gerará o XML e salvará o registro
6. Envie o arquivo à operadora`,
      },
      {
        id: "glosas",
        title: "7.3 Gestão de Glosas",
        content: `O sistema permite:
• Upload do XML de retorno da operadora
• Identificação automática de glosas
• Registro de recursos com justificativa
• Acompanhamento do status do recurso
• Relatório de taxa de glosa por convênio`,
      },
    ],
  },
  {
    id: "configuracoes",
    title: "8. Configurações",
    content: `As configurações permitem personalizar o sistema para as necessidades da clínica.`,
    subsections: [
      {
        id: "dados-clinica",
        title: "8.1 Dados da Clínica",
        content: `Configure os dados básicos:
• Nome fantasia e razão social
• CNPJ/CPF
• Endereço completo
• Telefones de contato
• E-mail
• Logo para impressões
• CNES (Cadastro Nacional de Estabelecimentos de Saúde)`,
      },
      {
        id: "horarios",
        title: "8.2 Horários de Funcionamento",
        content: `Defina os horários:
• Dias de funcionamento
• Horário de abertura e fechamento
• Intervalos (almoço, etc.)
• Feriados e exceções`,
      },
      {
        id: "integrações",
        title: "8.3 Integrações",
        content: `O sistema oferece integrações com:
• WhatsApp (confirmação de consultas)
• E-mail (notificações)
• Memed (prescrição eletrônica)
• Laboratórios (resultados via HL7)
• ERPs (Omie, Bling, Conta Azul)
• CRMs (RD Station, HubSpot)`,
      },
    ],
  },
  {
    id: "suporte",
    title: "9. Suporte",
    content: `O ClinicNest oferece suporte técnico para auxiliar no uso do sistema.`,
    subsections: [
      {
        id: "canais",
        title: "9.1 Canais de Atendimento",
        content: `Canais disponíveis por plano:
• **Básico**: E-mail (resposta em até 48h)
• **Pro**: E-mail + Chat (resposta em até 24h)
• **Premium**: E-mail + Chat + WhatsApp (resposta em até 4h)

Acesse o menu "Suporte" para abrir tickets e acompanhar atendimentos.`,
      },
      {
        id: "base-conhecimento",
        title: "9.2 Base de Conhecimento",
        content: `A Central de Ajuda oferece:
• Artigos explicativos por módulo
• Vídeos tutoriais
• Perguntas frequentes (FAQ)
• Tour guiado interativo

Acesse pelo menu "Ajuda" ou pelo ícone de interrogação em cada tela.`,
      },
    ],
  },
];

export const MANUAL_INFO = {
  titulo: "Manual do Usuário — ClinicNest",
  versao: APP_VERSION,
  dataAtualizacao: "2026-02-23",
  empresa: "ClinicNest Sistemas de Saúde",
  certificacao: "Em conformidade com SBIS NGS1/NGS2",
};
