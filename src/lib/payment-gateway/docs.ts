/**
 * Documentação de Configuração de Gateways de Pagamento
 * Guias para clínicas configurarem seus gateways
 */

export const GATEWAY_DOCS = {
  asaas: {
    name: "Asaas",
    description: "Plataforma completa de cobranças e pagamentos, muito popular em clínicas brasileiras.",
    features: ["PIX", "Boleto", "Cartão de Crédito", "Split de Pagamento", "Subcontas"],
    steps: [
      {
        title: "Criar conta no Asaas",
        description: "Acesse asaas.com e crie uma conta empresarial. Você precisará de CNPJ e documentos da empresa.",
        link: "https://www.asaas.com/cadastro",
      },
      {
        title: "Obter chave de API",
        description: "No painel do Asaas, vá em Configurações → Integrações → API. Copie o 'access_token'.",
        tip: "Use a chave de Sandbox para testes antes de ir para produção.",
      },
      {
        title: "Configurar Webhook",
        description: "Em Configurações → Integrações → Webhooks, adicione a URL do webhook do ClinicNest.",
        webhookUrl: "/api/webhooks/payments",
        events: ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED"],
      },
      {
        title: "Configurar Split (opcional)",
        description: "Para split automático, cada profissional precisa ter uma conta Asaas própria e fornecer o Wallet ID.",
        tip: "O Wallet ID está em: Asaas → Configurações → Dados da Conta",
      },
    ],
    sandbox: {
      url: "https://sandbox.asaas.com",
      testCards: [
        { number: "5162306219378829", cvv: "123", expiry: "05/2025", result: "Aprovado" },
        { number: "5184019740373151", cvv: "123", expiry: "05/2025", result: "Recusado" },
      ],
    },
    fees: {
      pix: "0,99% (mín. R$ 0,50)",
      boleto: "R$ 1,99 por boleto",
      creditCard: "2,99% + R$ 0,49",
      split: "Sem taxa adicional",
    },
  },

  pagseguro: {
    name: "PagSeguro / PagBank",
    description: "Gateway de pagamentos do UOL, amplamente conhecido no Brasil.",
    features: ["PIX", "Boleto", "Cartão de Crédito", "Split de Pagamento"],
    steps: [
      {
        title: "Criar conta no PagSeguro",
        description: "Acesse pagseguro.uol.com.br e crie uma conta empresarial.",
        link: "https://pagseguro.uol.com.br/registration/",
      },
      {
        title: "Obter Token de API",
        description: "No painel, vá em Vendas → Integrações → Gerar Token. Copie o token gerado.",
        tip: "O token é único e não pode ser recuperado depois. Guarde em local seguro.",
      },
      {
        title: "Configurar Notificações",
        description: "Em Vendas → Integrações → Notificações, configure a URL de callback.",
        webhookUrl: "/api/webhooks/payments",
      },
      {
        title: "Configurar Split (opcional)",
        description: "Para split, use o PagSeguro Connect. Cada profissional precisa autorizar a conexão.",
        tip: "O Account ID é gerado após a autorização no Connect.",
      },
    ],
    sandbox: {
      url: "https://sandbox.pagseguro.uol.com.br",
      testCards: [
        { number: "4111111111111111", cvv: "123", expiry: "12/2030", result: "Aprovado" },
        { number: "4000000000000002", cvv: "123", expiry: "12/2030", result: "Recusado" },
      ],
    },
    fees: {
      pix: "0,99%",
      boleto: "R$ 2,99 por boleto",
      creditCard: "3,99% (à vista)",
      split: "0,50% adicional",
    },
  },

  stone: {
    name: "Stone",
    description: "Soluções de pagamento para negócios, com foco em TEF e conta digital.",
    features: ["PIX", "Boleto", "TEF", "Split de Pagamento", "Conta Digital"],
    steps: [
      {
        title: "Criar conta na Stone",
        description: "Entre em contato com a Stone para abrir uma conta empresarial.",
        link: "https://www.stone.com.br/",
      },
      {
        title: "Obter credenciais de API",
        description: "Após aprovação, você receberá as credenciais de acesso à API.",
        tip: "A Stone tem processo de homologação. Planeje com antecedência.",
      },
      {
        title: "Configurar Webhook",
        description: "Configure o webhook no painel da Stone para receber notificações.",
        webhookUrl: "/api/webhooks/payments",
      },
      {
        title: "Configurar Split (opcional)",
        description: "Cadastre os profissionais como recebedores na Stone.",
        tip: "O Recipient ID é gerado após o cadastro do recebedor.",
      },
    ],
    sandbox: {
      url: "https://sandbox-api.openbank.stone.com.br",
      testCards: [],
    },
    fees: {
      pix: "Consultar",
      boleto: "Consultar",
      creditCard: "Consultar",
      split: "Consultar",
    },
  },
};

export const SPLIT_FAQ = [
  {
    question: "O que é split de pagamento?",
    answer: "Split é a divisão automática do pagamento entre a clínica e o profissional no momento da transação. O profissional recebe sua parte diretamente na conta dele, sem precisar de repasse manual.",
  },
  {
    question: "Quais as vantagens do split?",
    answer: "1) Elimina processo manual de repasse; 2) Profissional recebe mais rápido; 3) Reduz erros de cálculo; 4) Cada um emite sua própria nota fiscal (evita bitributação); 5) Transparência total.",
  },
  {
    question: "O profissional precisa ter conta no gateway?",
    answer: "Sim. Para receber via split, o profissional precisa ter uma conta própria no mesmo gateway que a clínica usa. Ele fornece o ID da conta (Wallet ID, Recipient ID, etc.) para configurar o recebimento.",
  },
  {
    question: "E se o profissional não tiver conta no gateway?",
    answer: "O sistema faz fallback para comissão manual. O pagamento vai todo para a clínica e a comissão fica registrada como 'pendente' para repasse posterior.",
  },
  {
    question: "Quem paga a taxa do gateway?",
    answer: "Você pode configurar: 1) Clínica paga toda a taxa; 2) Profissional paga toda a taxa; 3) Taxa dividida proporcionalmente. Configure em Integrações → Pagamentos.",
  },
  {
    question: "Como funciona a nota fiscal com split?",
    answer: "Com split, cada parte recebe diretamente. A clínica emite NF apenas sobre sua parte (taxa administrativa). O profissional emite NF sobre o valor que recebeu. Isso evita bitributação.",
  },
];

export const TROUBLESHOOTING = [
  {
    problem: "Erro 'Credenciais inválidas' ao testar conexão",
    solutions: [
      "Verifique se copiou a chave de API corretamente (sem espaços extras)",
      "Confirme se está usando a chave do ambiente correto (sandbox vs produção)",
      "No Asaas, use o 'access_token', não o 'API Key'",
    ],
  },
  {
    problem: "Webhook não está sendo recebido",
    solutions: [
      "Verifique se a URL do webhook está correta no painel do gateway",
      "Confirme se os eventos corretos estão selecionados",
      "Teste com uma ferramenta como webhook.site primeiro",
    ],
  },
  {
    problem: "Split não está funcionando",
    solutions: [
      "Verifique se o split está habilitado em Integrações → Pagamentos",
      "Confirme se o profissional tem conta configurada e verificada",
      "Verifique se existe uma regra de comissão ativa para o profissional",
    ],
  },
  {
    problem: "Pagamento PIX não gera QR Code",
    solutions: [
      "Alguns gateways demoram alguns segundos para gerar o QR Code",
      "Verifique se PIX está habilitado na sua conta do gateway",
      "Em sandbox, o PIX pode ter limitações",
    ],
  },
];
