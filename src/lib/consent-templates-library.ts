/**
 * Biblioteca completa de modelos de termos por especialidade médica.
 * Todos usam variáveis {{...}} substituídas automaticamente.
 */

export type TemplateCategory = 
  | "geral"
  | "estetica"
  | "odontologia"
  | "dermatologia"
  | "cirurgia_plastica"
  | "oftalmologia"
  | "psicologia"
  | "fisioterapia"
  | "nutricao";

export interface ConsentTemplateModel {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: TemplateCategory;
  body_html: string;
  is_required_default: boolean;
}

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { label: string; icon: string; color: string }> = {
  geral: { label: "Geral", icon: "FileText", color: "bg-gray-100 text-gray-700" },
  estetica: { label: "Estética", icon: "Sparkles", color: "bg-pink-100 text-pink-700" },
  odontologia: { label: "Odontologia", icon: "Smile", color: "bg-blue-100 text-blue-700" },
  dermatologia: { label: "Dermatologia", icon: "Sun", color: "bg-orange-100 text-orange-700" },
  cirurgia_plastica: { label: "Cirurgia Plástica", icon: "Scissors", color: "bg-purple-100 text-purple-700" },
  oftalmologia: { label: "Oftalmologia", icon: "Eye", color: "bg-cyan-100 text-cyan-700" },
  psicologia: { label: "Psicologia", icon: "Brain", color: "bg-green-100 text-green-700" },
  fisioterapia: { label: "Fisioterapia", icon: "Activity", color: "bg-teal-100 text-teal-700" },
  nutricao: { label: "Nutrição", icon: "Apple", color: "bg-lime-100 text-lime-700" },
};

export const CONSENT_TEMPLATES_LIBRARY: ConsentTemplateModel[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // GERAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "geral-contrato",
    slug: "contrato_servicos",
    title: "Contrato de Prestação de Serviços",
    description: "Contrato formal entre clínica e paciente",
    category: "geral",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SAÚDE</h2>

<p>Pelo presente instrumento particular, as partes abaixo qualificadas:</p>

<h3>CONTRATADA (Clínica)</h3>
<p><strong>{{nome_clinica}}</strong>, inscrita no CNPJ sob o nº <strong>{{cnpj_clinica}}</strong>, com sede em <strong>{{endereco_clinica}}</strong>, representada por <strong>{{responsavel_tecnico}}</strong>, registro <strong>{{crm_responsavel}}</strong>, doravante denominada <strong>CONTRATADA</strong>.</p>

<h3>CONTRATANTE (Paciente)</h3>
<p><strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, nascido(a) em <strong>{{data_nascimento}}</strong>, residente em <strong>{{endereco_completo}}</strong>, e-mail <strong>{{email}}</strong>, telefone <strong>{{telefone}}</strong>, doravante denominado(a) <strong>CONTRATANTE</strong>.</p>

<h3>CLÁUSULA 1ª – DO OBJETO</h3>
<p>Prestação de serviços de saúde pela CONTRATADA ao CONTRATANTE, incluindo consultas, procedimentos e exames conforme indicação profissional.</p>

<h3>CLÁUSULA 2ª – DAS OBRIGAÇÕES DA CONTRATADA</h3>
<ul>
  <li>Prestar serviços com zelo e de acordo com normas técnicas e éticas;</li>
  <li>Manter sigilo conforme Código de Ética e LGPD;</li>
  <li>Informar sobre diagnósticos, procedimentos, riscos e alternativas;</li>
  <li>Manter prontuário eletrônico atualizado.</li>
</ul>

<h3>CLÁUSULA 3ª – DAS OBRIGAÇÕES DO CONTRATANTE</h3>
<ul>
  <li>Fornecer informações verdadeiras sobre saúde e histórico;</li>
  <li>Comparecer pontualmente ou cancelar com 24h de antecedência;</li>
  <li>Seguir orientações médicas prescritas;</li>
  <li>Efetuar pagamentos nos prazos acordados.</li>
</ul>

<h3>CLÁUSULA 4ª – DA PROTEÇÃO DE DADOS (LGPD)</h3>
<p>A CONTRATADA tratará dados pessoais exclusivamente para prestação dos serviços, conforme Lei nº 13.709/2018.</p>

<h3>CLÁUSULA 5ª – DO FORO</h3>
<p>Foro da comarca de <strong>{{cidade}}</strong> — <strong>{{estado}}</strong>.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "geral-uso-imagem",
    slug: "uso_imagem",
    title: "Termo de Uso de Imagem",
    description: "Autorização para uso de fotos e vídeos",
    category: "geral",
    is_required_default: false,
    body_html: `<h2 style="text-align:center;">TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, <strong>AUTORIZO</strong> a <strong>{{nome_clinica}}</strong> a utilizar minha imagem para:</p>

<ul>
  <li><strong>Fins científicos:</strong> congressos, cursos, publicações;</li>
  <li><strong>Fins institucionais:</strong> site, redes sociais, materiais impressos;</li>
  <li><strong>Documentação clínica:</strong> prontuário eletrônico.</li>
</ul>

<h3>CONDIÇÕES</h3>
<ul>
  <li>Imagens podem ser editadas sem desvirtuar contexto;</li>
  <li>Meu nome <strong>não será divulgado</strong> sem autorização adicional;</li>
  <li>Autorização gratuita e por prazo indeterminado;</li>
  <li>Pode ser revogada a qualquer tempo por escrito.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "geral-lgpd",
    slug: "lgpd_consentimento",
    title: "Termo de Consentimento LGPD",
    description: "Consentimento para tratamento de dados pessoais",
    category: "geral",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS</h2>

<p>Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, declaro que:</p>

<h3>1. DADOS COLETADOS</h3>
<p>Autorizo a coleta e tratamento dos seguintes dados:</p>
<ul>
  <li>Dados pessoais: nome, CPF, data de nascimento, endereço, telefone, e-mail;</li>
  <li>Dados sensíveis de saúde: histórico médico, exames, diagnósticos, tratamentos;</li>
  <li>Dados biométricos: foto facial para assinatura de termos.</li>
</ul>

<h3>2. FINALIDADES</h3>
<ul>
  <li>Prestação de serviços de saúde;</li>
  <li>Agendamento e comunicação sobre consultas;</li>
  <li>Emissão de documentos fiscais;</li>
  <li>Cumprimento de obrigações legais.</li>
</ul>

<h3>3. DIREITOS DO TITULAR</h3>
<p>Posso exercer meus direitos de acesso, correção, exclusão e portabilidade mediante solicitação à clínica.</p>

<h3>4. COMPARTILHAMENTO</h3>
<p>Meus dados poderão ser compartilhados com laboratórios, convênios e órgãos reguladores quando necessário.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTÉTICA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "estetica-toxina",
    slug: "toxina_botulinica",
    title: "Termo de Consentimento - Toxina Botulínica",
    description: "Consentimento para aplicação de botox",
    category: "estetica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO INFORMADO - TOXINA BOTULÍNICA</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, declaro que fui informado(a) sobre o procedimento de aplicação de Toxina Botulínica:</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>A toxina botulínica é uma proteína que age bloqueando temporariamente a contração muscular, sendo utilizada para tratamento de rugas dinâmicas e outras indicações estéticas.</p>

<h3>2. RESULTADOS ESPERADOS</h3>
<ul>
  <li>Início do efeito: 3 a 7 dias após aplicação;</li>
  <li>Efeito máximo: 15 a 30 dias;</li>
  <li>Duração média: 4 a 6 meses;</li>
  <li>Resultados variam conforme metabolismo individual.</li>
</ul>

<h3>3. POSSÍVEIS EFEITOS COLATERAIS</h3>
<ul>
  <li>Dor, vermelhidão ou hematoma no local;</li>
  <li>Cefaleia temporária;</li>
  <li>Ptose palpebral (queda da pálpebra) - rara e temporária;</li>
  <li>Assimetria facial temporária;</li>
  <li>Reações alérgicas (raras).</li>
</ul>

<h3>4. CONTRAINDICAÇÕES</h3>
<p>Informei ao profissional se possuo: gravidez, amamentação, doenças neuromusculares, alergia à albumina, uso de aminoglicosídeos.</p>

<h3>5. CUIDADOS PÓS-PROCEDIMENTO</h3>
<ul>
  <li>Não massagear a região por 4 horas;</li>
  <li>Não deitar por 4 horas;</li>
  <li>Evitar atividade física intensa por 24 horas;</li>
  <li>Evitar exposição solar intensa por 48 horas.</li>
</ul>

<p>Declaro que li, compreendi e concordo com os termos acima.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "estetica-preenchimento",
    slug: "preenchimento_facial",
    title: "Termo de Consentimento - Preenchimento Facial",
    description: "Consentimento para ácido hialurônico",
    category: "estetica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO INFORMADO - PREENCHIMENTO FACIAL</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, declaro que fui informado(a) sobre o procedimento de Preenchimento Facial com Ácido Hialurônico:</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>O ácido hialurônico é um gel biocompatível injetado para restaurar volume, suavizar rugas e melhorar contornos faciais.</p>

<h3>2. POSSÍVEIS EFEITOS COLATERAIS</h3>
<ul>
  <li>Edema (inchaço) por 3 a 7 dias;</li>
  <li>Hematomas no local da aplicação;</li>
  <li>Vermelhidão e sensibilidade;</li>
  <li>Nódulos ou irregularidades (tratáveis);</li>
  <li>Necrose vascular (rara, mas grave);</li>
  <li>Reações alérgicas.</li>
</ul>

<h3>3. CUIDADOS PÓS-PROCEDIMENTO</h3>
<ul>
  <li>Aplicar gelo nas primeiras 24 horas;</li>
  <li>Evitar maquiagem por 12 horas;</li>
  <li>Não massagear a região;</li>
  <li>Evitar exercícios intensos por 48 horas;</li>
  <li>Evitar exposição solar e calor excessivo.</li>
</ul>

<p>Declaro que li, compreendi e concordo com os termos acima.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ── Bioestimulador de Colágeno ──
  {
    id: "estetica-bioestimulador",
    slug: "bioestimulador_colageno",
    title: "Termo de Consentimento - Bioestimulador de Colágeno",
    description: "Consentimento para procedimento com bioestimuladores (ex: Sculptra, Radiesse)",
    category: "estetica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO INFORMADO - BIOESTIMULADOR DE COLÁGENO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, declaro que fui informado(a) sobre o procedimento de aplicação de <strong>Bioestimulador de Colágeno</strong>:</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>O bioestimulador é uma substância injetável que estimula a produção natural de colágeno, promovendo melhora progressiva da qualidade e firmeza da pele. Os resultados aparecem gradualmente ao longo de semanas/meses.</p>

<h3>2. RISCOS E POSSÍVEIS COMPLICAÇÕES</h3>
<ul>
  <li>Edema, dor e equimoses no local da aplicação;</li>
  <li>Formação de nódulos ou granulomas;</li>
  <li>Assimetria de resultado;</li>
  <li>Reação inflamatória local;</li>
  <li>Necessidade de sessões adicionais;</li>
  <li>Resultados abaixo da expectativa.</li>
</ul>

<h3>3. CUIDADOS PÓS-PROCEDIMENTO</h3>
<ul>
  <li>Realizar massagem conforme orientação profissional;</li>
  <li>Evitar exercícios intensos por 48-72 horas;</li>
  <li>Evitar exposição solar direta por 15 dias;</li>
  <li>Retornar conforme agendamento para avaliação.</li>
</ul>

<p>Declaro que li, compreendi e concordo com os termos acima.</p>
<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>
<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ── Fios de PDO ──
  {
    id: "estetica-fios-pdo",
    slug: "fios_pdo",
    title: "Termo de Consentimento - Fios de PDO",
    description: "Consentimento para procedimento com fios de polidioxanona",
    category: "estetica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO INFORMADO - FIOS DE PDO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, declaro que fui informado(a) sobre o procedimento de implante de <strong>Fios de Polidioxanona (PDO)</strong>:</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>Fios de PDO são fios absorvíveis implantados na pele com objetivo de sustentação, estímulo de colágeno e rejuvenescimento. São reabsorvidos pelo organismo em 6-8 meses.</p>

<h3>2. RISCOS E POSSÍVEIS COMPLICAÇÕES</h3>
<ul>
  <li>Dor, edema e hematomas;</li>
  <li>Sensação de repuxamento;</li>
  <li>Assimetria facial;</li>
  <li>Visibilidade ou palpabilidade dos fios;</li>
  <li>Migração ou extrusão do fio;</li>
  <li>Infecção local (rara);</li>
  <li>Parestesia temporária.</li>
</ul>

<h3>3. CUIDADOS PÓS-PROCEDIMENTO</h3>
<ul>
  <li>Não deitar sobre o rosto por 3-5 dias;</li>
  <li>Evitar abrir muito a boca (bocejo amplo) por 2 semanas;</li>
  <li>Não massagear a região;</li>
  <li>Manter cabeça elevada ao dormir;</li>
  <li>Evitar exercícios intensos por 1 semana.</li>
</ul>

<p>Declaro que li, compreendi e concordo com os termos acima.</p>
<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>
<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ── Laser Estético ──
  {
    id: "estetica-laser",
    slug: "laser_estetico",
    title: "Termo de Consentimento - Procedimento a Laser",
    description: "Consentimento para procedimentos com laser estético (ablativo e não-ablativo)",
    category: "estetica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO INFORMADO - PROCEDIMENTO A LASER</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, declaro que fui informado(a) sobre o procedimento a <strong>Laser Estético</strong>:</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>O laser emite energia luminosa controlada sobre a pele para tratamento de lesões pigmentares, vasculares, cicatrizes, rejuvenescimento ou remoção de pelos, conforme indicação clínica.</p>

<h3>2. RISCOS E POSSÍVEIS COMPLICAÇÕES</h3>
<ul>
  <li>Eritema (vermelhidão) e edema;</li>
  <li>Hiperpigmentação ou hipopigmentação;</li>
  <li>Queimaduras;</li>
  <li>Formação de bolhas ou crostas;</li>
  <li>Cicatrizes (raro);</li>
  <li>Necessidade de múltiplas sessões;</li>
  <li>Resultados variáveis conforme fototipo.</li>
</ul>

<h3>3. CUIDADOS PÓS-PROCEDIMENTO</h3>
<ul>
  <li>Proteção solar rigorosa (FPS 50+) por mínimo 30 dias;</li>
  <li>Hidratação constante da região;</li>
  <li>Não remover crostas manualmente;</li>
  <li>Evitar produtos ácidos por 7-14 dias;</li>
  <li>Evitar água quente e sauna por 48 horas.</li>
</ul>

<p>Declaro que li, compreendi e concordo com os termos acima.</p>
<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>
<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ── Microagulhamento ──
  {
    id: "estetica-microagulhamento",
    slug: "microagulhamento",
    title: "Termo de Consentimento - Microagulhamento",
    description: "Consentimento para procedimento de microagulhamento (indução percutânea de colágeno)",
    category: "estetica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO INFORMADO - MICROAGULHAMENTO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, declaro que fui informado(a) sobre o procedimento de <strong>Microagulhamento (IPCA)</strong>:</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>O microagulhamento consiste na criação de microcanais na pele através de microagulhas, estimulando a produção de colágeno e elastina. Pode ser associado a drug delivery (aplicação de ativos).</p>

<h3>2. RISCOS E POSSÍVEIS COMPLICAÇÕES</h3>
<ul>
  <li>Eritema e edema por 24-72 horas;</li>
  <li>Descamação fina;</li>
  <li>Sangramento puntiforme durante o procedimento;</li>
  <li>Hiperpigmentação pós-inflamatória;</li>
  <li>Infecção local (rara com cuidados adequados);</li>
  <li>Cicatrizes (raro, em peles predispostas).</li>
</ul>

<h3>3. CUIDADOS PÓS-PROCEDIMENTO</h3>
<ul>
  <li>Não aplicar maquiagem por 24 horas;</li>
  <li>Proteção solar rigorosa por 30 dias;</li>
  <li>Hidratar com produtos indicados pelo profissional;</li>
  <li>Evitar ácidos por 5-7 dias;</li>
  <li>Evitar piscina, sauna e exercícios intensos por 48 horas.</li>
</ul>

<p>Declaro que li, compreendi e concordo com os termos acima.</p>
<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>
<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ODONTOLOGIA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "odonto-geral",
    slug: "tratamento_odontologico",
    title: "Termo de Consentimento Odontológico Geral",
    description: "Consentimento para tratamentos odontológicos",
    category: "odontologia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO PARA TRATAMENTO ODONTOLÓGICO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de tratamento odontológico na <strong>{{nome_clinica}}</strong>.</p>

<h3>1. DECLARAÇÕES DO PACIENTE</h3>
<ul>
  <li>Informei meu histórico de saúde completo, incluindo alergias, medicamentos em uso, doenças sistêmicas;</li>
  <li>Informei se estou grávida ou amamentando;</li>
  <li>Compreendo que o sucesso do tratamento depende também da minha colaboração.</li>
</ul>

<h3>2. RISCOS GERAIS</h3>
<ul>
  <li>Dor e desconforto pós-procedimento;</li>
  <li>Inchaço e hematomas;</li>
  <li>Sensibilidade dentária temporária;</li>
  <li>Reações à anestesia local;</li>
  <li>Necessidade de tratamentos complementares.</li>
</ul>

<h3>3. COMPROMISSOS</h3>
<ul>
  <li>Seguir as orientações pós-operatórias;</li>
  <li>Comparecer às consultas de retorno;</li>
  <li>Manter higiene bucal adequada;</li>
  <li>Comunicar qualquer intercorrência.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "odonto-implante",
    slug: "implante_dentario",
    title: "Termo de Consentimento - Implante Dentário",
    description: "Consentimento para cirurgia de implante",
    category: "odontologia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - IMPLANTE DENTÁRIO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de cirurgia para instalação de implante dentário.</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>O implante dentário é um pino de titânio instalado cirurgicamente no osso maxilar ou mandibular para substituir a raiz de um dente perdido.</p>

<h3>2. RISCOS E COMPLICAÇÕES POSSÍVEIS</h3>
<ul>
  <li>Dor, inchaço e hematomas pós-operatórios;</li>
  <li>Infecção no local;</li>
  <li>Lesão de nervos (parestesia temporária ou permanente);</li>
  <li>Perfuração do seio maxilar;</li>
  <li>Falha na osseointegração;</li>
  <li>Necessidade de enxerto ósseo adicional.</li>
</ul>

<h3>3. CUIDADOS PÓS-OPERATÓRIOS</h3>
<ul>
  <li>Repouso nas primeiras 48 horas;</li>
  <li>Dieta líquida/pastosa por 7 dias;</li>
  <li>Não fumar durante a cicatrização;</li>
  <li>Tomar medicação prescrita corretamente;</li>
  <li>Comparecer aos retornos agendados.</li>
</ul>

<p>Declaro que fui informado(a) e concordo com o procedimento.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DERMATOLOGIA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "dermato-peeling",
    slug: "peeling_quimico",
    title: "Termo de Consentimento - Peeling Químico",
    description: "Consentimento para procedimento de peeling",
    category: "dermatologia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - PEELING QUÍMICO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de Peeling Químico.</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>O peeling químico consiste na aplicação de substâncias ácidas para promover renovação celular e melhora da textura da pele.</p>

<h3>2. INDICAÇÕES</h3>
<ul>
  <li>Manchas e melasma;</li>
  <li>Cicatrizes de acne;</li>
  <li>Rugas finas;</li>
  <li>Fotoenvelhecimento.</li>
</ul>

<h3>3. EFEITOS ESPERADOS</h3>
<ul>
  <li>Vermelhidão imediata;</li>
  <li>Descamação em 3 a 7 dias;</li>
  <li>Sensibilidade aumentada;</li>
  <li>Resultados progressivos com múltiplas sessões.</li>
</ul>

<h3>4. CUIDADOS OBRIGATÓRIOS</h3>
<ul>
  <li><strong>Protetor solar FPS 50+</strong> diariamente;</li>
  <li>Evitar exposição solar direta;</li>
  <li>Não arrancar a pele descamada;</li>
  <li>Hidratação constante.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PSICOLOGIA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "psico-atendimento",
    slug: "atendimento_psicologico",
    title: "Termo de Consentimento - Atendimento Psicológico",
    description: "Consentimento para psicoterapia",
    category: "psicologia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO PARA ATENDIMENTO PSICOLÓGICO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, declaro que:</p>

<h3>1. SOBRE O ATENDIMENTO</h3>
<ul>
  <li>Fui informado(a) sobre a abordagem terapêutica utilizada;</li>
  <li>Compreendo que a psicoterapia é um processo que requer tempo e comprometimento;</li>
  <li>Os resultados dependem da minha participação ativa.</li>
</ul>

<h3>2. SIGILO PROFISSIONAL</h3>
<p>Estou ciente de que todas as informações compartilhadas são protegidas pelo sigilo profissional, conforme Código de Ética do Psicólogo, exceto em situações previstas em lei (risco de vida, determinação judicial).</p>

<h3>3. COMPROMISSOS</h3>
<ul>
  <li>Comparecer às sessões agendadas;</li>
  <li>Comunicar ausências com antecedência;</li>
  <li>Ser honesto(a) durante o processo terapêutico;</li>
  <li>Informar sobre uso de medicamentos psiquiátricos.</li>
</ul>

<h3>4. CANCELAMENTOS</h3>
<p>Sessões canceladas com menos de 24 horas de antecedência poderão ser cobradas.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FISIOTERAPIA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "fisio-geral",
    slug: "fisioterapia_geral",
    title: "Termo de Consentimento - Fisioterapia Geral",
    description: "Consentimento para tratamento fisioterapêutico",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO PARA TRATAMENTO FISIOTERAPÊUTICO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de tratamento fisioterapêutico na <strong>{{nome_clinica}}</strong>.</p>

<h3>1. DECLARAÇÕES DO PACIENTE</h3>
<ul>
  <li>Informei meu histórico de saúde completo;</li>
  <li>Relatei todas as dores, limitações e cirurgias anteriores;</li>
  <li>Informei sobre medicamentos em uso;</li>
  <li>Compreendo que o sucesso depende da minha colaboração.</li>
</ul>

<h3>2. SOBRE O TRATAMENTO</h3>
<p>O tratamento pode incluir: exercícios terapêuticos, terapia manual, eletroterapia, termoterapia, crioterapia e outras técnicas conforme avaliação profissional.</p>

<h3>3. RISCOS POSSÍVEIS</h3>
<ul>
  <li>Dor muscular temporária após exercícios;</li>
  <li>Fadiga;</li>
  <li>Vermelhidão ou irritação na pele (eletroterapia);</li>
  <li>Desconforto durante manipulações.</li>
</ul>

<h3>4. COMPROMISSOS</h3>
<ul>
  <li>Comparecer às sessões agendadas;</li>
  <li>Realizar exercícios domiciliares prescritos;</li>
  <li>Comunicar qualquer desconforto durante o tratamento;</li>
  <li>Seguir orientações posturais e ergonômicas.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "fisio-rpg",
    slug: "rpg_reeducacao_postural",
    title: "Termo de Consentimento - RPG",
    description: "Reeducação Postural Global",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - RPG (REEDUCAÇÃO POSTURAL GLOBAL)</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de tratamento de RPG.</p>

<h3>1. SOBRE O MÉTODO</h3>
<p>A RPG é um método de fisioterapia que trabalha as cadeias musculares através de posturas específicas mantidas por tempo prolongado, visando correção postural e alívio de dores.</p>

<h3>2. INDICAÇÕES</h3>
<ul>
  <li>Desvios posturais (escoliose, cifose, lordose);</li>
  <li>Hérnias de disco;</li>
  <li>Dores crônicas na coluna;</li>
  <li>Tensões musculares;</li>
  <li>Reabilitação pós-cirúrgica.</li>
</ul>

<h3>3. DURANTE O TRATAMENTO</h3>
<ul>
  <li>As sessões duram aproximadamente 1 hora;</li>
  <li>Pode haver desconforto durante as posturas;</li>
  <li>É normal sentir alongamento intenso;</li>
  <li>Devo comunicar dor excessiva imediatamente.</li>
</ul>

<h3>4. RESULTADOS</h3>
<p>Os resultados são progressivos e dependem da frequência do tratamento e realização dos exercícios domiciliares.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "fisio-pilates",
    slug: "pilates_clinico",
    title: "Termo de Consentimento - Pilates Clínico",
    description: "Pilates para reabilitação",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - PILATES CLÍNICO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de Pilates Clínico.</p>

<h3>1. SOBRE O MÉTODO</h3>
<p>O Pilates Clínico é um método de exercícios supervisionado por fisioterapeuta, utilizando aparelhos específicos (Reformer, Cadillac, Chair, Barrel) para reabilitação e fortalecimento.</p>

<h3>2. BENEFÍCIOS ESPERADOS</h3>
<ul>
  <li>Fortalecimento do core (centro de força);</li>
  <li>Melhora da flexibilidade;</li>
  <li>Correção postural;</li>
  <li>Alívio de dores;</li>
  <li>Prevenção de lesões.</li>
</ul>

<h3>3. CONTRAINDICAÇÕES RELATIVAS</h3>
<ul>
  <li>Hipertensão não controlada;</li>
  <li>Cardiopatias graves;</li>
  <li>Gestação de risco;</li>
  <li>Lesões agudas não estabilizadas.</li>
</ul>

<h3>4. ORIENTAÇÕES</h3>
<ul>
  <li>Usar roupas confortáveis;</li>
  <li>Não realizar exercícios em jejum;</li>
  <li>Informar qualquer desconforto durante a sessão;</li>
  <li>Manter regularidade nas sessões.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "fisio-acupuntura",
    slug: "acupuntura_fisio",
    title: "Termo de Consentimento - Acupuntura/Dry Needling",
    description: "Agulhamento seco e acupuntura",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - ACUPUNTURA / DRY NEEDLING</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de técnicas de agulhamento.</p>

<h3>1. SOBRE AS TÉCNICAS</h3>
<p><strong>Dry Needling:</strong> inserção de agulhas em pontos-gatilho musculares para alívio de dor e tensão.</p>
<p><strong>Acupuntura:</strong> inserção de agulhas em pontos específicos para tratamento de diversas condições.</p>

<h3>2. EFEITOS POSSÍVEIS</h3>
<ul>
  <li>Dor leve no momento da inserção;</li>
  <li>Hematomas pequenos;</li>
  <li>Sensação de peso ou formigamento;</li>
  <li>Relaxamento muscular;</li>
  <li>Sonolência após a sessão.</li>
</ul>

<h3>3. CONTRAINDICAÇÕES</h3>
<ul>
  <li>Uso de anticoagulantes (informar ao profissional);</li>
  <li>Fobia de agulhas;</li>
  <li>Infecções de pele no local;</li>
  <li>Gestação (alguns pontos).</li>
</ul>

<h3>4. CUIDADOS</h3>
<ul>
  <li>Não realizar em jejum prolongado;</li>
  <li>Evitar atividade física intensa após;</li>
  <li>Hidratar-se bem.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "fisio-terapia-manual",
    slug: "terapia_manual",
    title: "Termo de Consentimento - Terapia Manual",
    description: "Manipulação e mobilização articular",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - TERAPIA MANUAL</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de técnicas de Terapia Manual.</p>

<h3>1. SOBRE O TRATAMENTO</h3>
<p>A Terapia Manual inclui técnicas de mobilização e manipulação articular, liberação miofascial, massagem terapêutica e outras técnicas manuais.</p>

<h3>2. TÉCNICAS UTILIZADAS</h3>
<ul>
  <li>Mobilização articular;</li>
  <li>Manipulação vertebral (thrust);</li>
  <li>Liberação miofascial;</li>
  <li>Pompagem;</li>
  <li>Massagem de tecidos profundos.</li>
</ul>

<h3>3. RISCOS POSSÍVEIS</h3>
<ul>
  <li>Dor temporária após manipulação;</li>
  <li>Hematomas em casos raros;</li>
  <li>Tontura momentânea (manipulação cervical);</li>
  <li>Desconforto durante o procedimento.</li>
</ul>

<h3>4. CONTRAINDICAÇÕES</h3>
<ul>
  <li>Fraturas recentes;</li>
  <li>Osteoporose severa;</li>
  <li>Tumores ósseos;</li>
  <li>Infecções articulares;</li>
  <li>Instabilidade ligamentar grave.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "fisio-eletroterapia",
    slug: "eletroterapia",
    title: "Termo de Consentimento - Eletroterapia",
    description: "TENS, FES, correntes e ultrassom",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - ELETROTERAPIA</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a utilização de recursos eletroterapêuticos.</p>

<h3>1. RECURSOS UTILIZADOS</h3>
<ul>
  <li><strong>TENS:</strong> estimulação elétrica para alívio da dor;</li>
  <li><strong>FES:</strong> estimulação elétrica funcional para fortalecimento;</li>
  <li><strong>Corrente Russa:</strong> fortalecimento muscular;</li>
  <li><strong>Ultrassom:</strong> ondas sonoras para cicatrização;</li>
  <li><strong>Laser:</strong> fotobiomodulação para regeneração tecidual.</li>
</ul>

<h3>2. CONTRAINDICAÇÕES GERAIS</h3>
<ul>
  <li>Marca-passo cardíaco;</li>
  <li>Gestação (região abdominal);</li>
  <li>Neoplasias;</li>
  <li>Trombose venosa profunda;</li>
  <li>Alterações de sensibilidade.</li>
</ul>

<h3>3. EFEITOS POSSÍVEIS</h3>
<ul>
  <li>Formigamento durante aplicação;</li>
  <li>Vermelhidão temporária;</li>
  <li>Contrações musculares (FES/Russa);</li>
  <li>Sensação de calor (ultrassom).</li>
</ul>

<p>Declaro que informei sobre qualquer condição que possa contraindicar o uso destes recursos.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "fisio-hidroterapia",
    slug: "hidroterapia",
    title: "Termo de Consentimento - Hidroterapia",
    description: "Fisioterapia aquática",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - HIDROTERAPIA</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de Hidroterapia/Fisioterapia Aquática.</p>

<h3>1. SOBRE O TRATAMENTO</h3>
<p>A hidroterapia utiliza as propriedades físicas da água (flutuação, pressão hidrostática, resistência) para reabilitação com menor impacto articular.</p>

<h3>2. INDICAÇÕES</h3>
<ul>
  <li>Dores articulares e musculares;</li>
  <li>Pós-operatório ortopédico;</li>
  <li>Doenças reumáticas;</li>
  <li>Fibromialgia;</li>
  <li>Reabilitação neurológica;</li>
  <li>Gestantes (com liberação médica).</li>
</ul>

<h3>3. CONTRAINDICAÇÕES</h3>
<ul>
  <li>Feridas abertas ou infecções de pele;</li>
  <li>Incontinência urinária/fecal não controlada;</li>
  <li>Cardiopatias descompensadas;</li>
  <li>Epilepsia não controlada;</li>
  <li>Febre.</li>
</ul>

<h3>4. ORIENTAÇÕES</h3>
<ul>
  <li>Trazer roupa de banho adequada;</li>
  <li>Tomar banho antes de entrar na piscina;</li>
  <li>Informar se não souber nadar;</li>
  <li>Não realizar em jejum.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "fisio-respiratoria",
    slug: "fisioterapia_respiratoria",
    title: "Termo de Consentimento - Fisioterapia Respiratória",
    description: "Reabilitação pulmonar",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - FISIOTERAPIA RESPIRATÓRIA</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de Fisioterapia Respiratória.</p>

<h3>1. SOBRE O TRATAMENTO</h3>
<p>A fisioterapia respiratória visa melhorar a função pulmonar através de técnicas de higiene brônquica, exercícios respiratórios e reexpansão pulmonar.</p>

<h3>2. TÉCNICAS UTILIZADAS</h3>
<ul>
  <li>Exercícios de respiração diafragmática;</li>
  <li>Técnicas de higiene brônquica;</li>
  <li>Manobras de reexpansão pulmonar;</li>
  <li>Uso de incentivadores respiratórios;</li>
  <li>Ventilação não invasiva (quando indicado).</li>
</ul>

<h3>3. INDICAÇÕES</h3>
<ul>
  <li>DPOC;</li>
  <li>Asma;</li>
  <li>Pré e pós-operatório;</li>
  <li>Pneumonias;</li>
  <li>Fibrose pulmonar;</li>
  <li>COVID-19 e sequelas.</li>
</ul>

<h3>4. EFEITOS POSSÍVEIS</h3>
<ul>
  <li>Tosse produtiva (esperado);</li>
  <li>Cansaço temporário;</li>
  <li>Tontura leve (hiperventilação).</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "fisio-neurologica",
    slug: "fisioterapia_neurologica",
    title: "Termo de Consentimento - Fisioterapia Neurológica",
    description: "Reabilitação neurológica",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - FISIOTERAPIA NEUROLÓGICA</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo tratamento de Fisioterapia Neurológica.</p>

<h3>1. INDICAÇÕES</h3>
<ul>
  <li>AVC (Acidente Vascular Cerebral);</li>
  <li>Parkinson;</li>
  <li>Esclerose Múltipla;</li>
  <li>Paralisia Cerebral;</li>
  <li>Lesões medulares;</li>
  <li>Traumatismo cranioencefálico.</li>
</ul>

<h3>2. MÉTODOS UTILIZADOS</h3>
<ul>
  <li>Conceito Bobath;</li>
  <li>Facilitação Neuromuscular Proprioceptiva (FNP);</li>
  <li>Treino de marcha e equilíbrio;</li>
  <li>Estimulação sensorial.</li>
</ul>

<h3>3. OBJETIVOS</h3>
<ul>
  <li>Recuperar ou manter função motora;</li>
  <li>Melhorar equilíbrio e coordenação;</li>
  <li>Prevenir complicações secundárias;</li>
  <li>Promover independência funcional.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "fisio-ortopedica",
    slug: "fisioterapia_ortopedica",
    title: "Termo de Consentimento - Fisioterapia Ortopédica",
    description: "Reabilitação musculoesquelética",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - FISIOTERAPIA ORTOPÉDICA</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo tratamento de Fisioterapia Ortopédica.</p>

<h3>1. INDICAÇÕES</h3>
<ul>
  <li>Fraturas e pós-operatórios;</li>
  <li>Lesões ligamentares e meniscais;</li>
  <li>Tendinites e bursites;</li>
  <li>Artrose;</li>
  <li>Hérnias de disco;</li>
  <li>Lesões musculares.</li>
</ul>

<h3>2. TRATAMENTO INCLUI</h3>
<ul>
  <li>Cinesioterapia (exercícios terapêuticos);</li>
  <li>Fortalecimento muscular progressivo;</li>
  <li>Alongamentos;</li>
  <li>Mobilização articular;</li>
  <li>Recursos eletrotermofototerapêuticos.</li>
</ul>

<h3>3. COMPROMISSOS</h3>
<ul>
  <li>Seguir protocolo de exercícios domiciliares;</li>
  <li>Respeitar limitações durante recuperação;</li>
  <li>Comunicar aumento de dor ou inchaço.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "fisio-pelvica",
    slug: "fisioterapia_pelvica",
    title: "Termo de Consentimento - Fisioterapia Pélvica",
    description: "Reabilitação do assoalho pélvico",
    category: "fisioterapia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - FISIOTERAPIA PÉLVICA</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo tratamento de Fisioterapia Pélvica.</p>

<h3>1. SOBRE O TRATAMENTO</h3>
<p>A fisioterapia pélvica trata disfunções do assoalho pélvico através de exercícios, biofeedback e técnicas manuais.</p>

<h3>2. INDICAÇÕES</h3>
<ul>
  <li>Incontinência urinária;</li>
  <li>Incontinência fecal;</li>
  <li>Prolapsos de órgãos pélvicos;</li>
  <li>Disfunções sexuais;</li>
  <li>Preparação para o parto;</li>
  <li>Recuperação pós-parto;</li>
  <li>Dor pélvica crônica.</li>
</ul>

<h3>3. PROCEDIMENTOS</h3>
<ul>
  <li>Avaliação funcional do assoalho pélvico;</li>
  <li>Exercícios de Kegel;</li>
  <li>Biofeedback;</li>
  <li>Eletroestimulação (quando indicado);</li>
  <li>Técnicas de liberação miofascial.</li>
</ul>

<h3>4. CONSENTIMENTO ESPECÍFICO</h3>
<p>Estou ciente de que a avaliação pode incluir exame intracavitário (vaginal ou retal) para avaliação da musculatura, realizado com meu consentimento e de forma ética.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NUTRIÇÃO
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "nutri-acompanhamento",
    slug: "acompanhamento_nutricional",
    title: "Termo de Consentimento - Acompanhamento Nutricional",
    description: "Consulta e plano alimentar",
    category: "nutricao",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - ACOMPANHAMENTO NUTRICIONAL</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo acompanhamento nutricional.</p>

<h3>1. SOBRE O ATENDIMENTO</h3>
<ul>
  <li>Avaliação do estado nutricional;</li>
  <li>Elaboração de plano alimentar individualizado;</li>
  <li>Orientações nutricionais;</li>
  <li>Acompanhamento periódico.</li>
</ul>

<h3>2. COMPROMISSOS DO PACIENTE</h3>
<ul>
  <li>Fornecer informações verdadeiras sobre hábitos alimentares;</li>
  <li>Informar sobre doenças, alergias e intolerâncias;</li>
  <li>Seguir as orientações do plano alimentar;</li>
  <li>Comparecer aos retornos agendados.</li>
</ul>

<h3>3. RESULTADOS</h3>
<p>Os resultados dependem da adesão ao plano alimentar e podem variar conforme metabolismo individual.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CIRURGIA PLÁSTICA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "plastica-lipoaspiracao",
    slug: "lipoaspiracao",
    title: "Termo de Consentimento - Lipoaspiração",
    description: "Cirurgia de lipoaspiração",
    category: "cirurgia_plastica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - LIPOASPIRAÇÃO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de Lipoaspiração.</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>A lipoaspiração é uma cirurgia para remoção de gordura localizada através de cânulas, não sendo tratamento para obesidade.</p>

<h3>2. RISCOS E COMPLICAÇÕES</h3>
<ul>
  <li>Hematomas e equimoses;</li>
  <li>Edema prolongado;</li>
  <li>Irregularidades no contorno;</li>
  <li>Infecção;</li>
  <li>Trombose venosa profunda;</li>
  <li>Embolia gordurosa (rara);</li>
  <li>Assimetrias.</li>
</ul>

<h3>3. PÓS-OPERATÓRIO</h3>
<ul>
  <li>Uso de cinta compressiva por 30-60 dias;</li>
  <li>Drenagem linfática recomendada;</li>
  <li>Repouso relativo por 15 dias;</li>
  <li>Resultado final em 3-6 meses.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "plastica-mamoplastia",
    slug: "mamoplastia",
    title: "Termo de Consentimento - Mamoplastia",
    description: "Cirurgia de mama (aumento/redução)",
    category: "cirurgia_plastica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - MAMOPLASTIA</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo a realização de Mamoplastia.</p>

<h3>1. TIPO DE PROCEDIMENTO</h3>
<p>( ) Mamoplastia de Aumento com Prótese<br/>
( ) Mamoplastia Redutora<br/>
( ) Mastopexia (Lifting de Mama)</p>

<h3>2. RISCOS E COMPLICAÇÕES</h3>
<ul>
  <li>Hematoma e seroma;</li>
  <li>Infecção;</li>
  <li>Alteração de sensibilidade;</li>
  <li>Cicatrizes hipertróficas;</li>
  <li>Contratura capsular (prótese);</li>
  <li>Assimetria;</li>
  <li>Necessidade de revisão cirúrgica.</li>
</ul>

<h3>3. ORIENTAÇÕES</h3>
<ul>
  <li>Uso de sutiã cirúrgico por 30-60 dias;</li>
  <li>Evitar esforços com membros superiores;</li>
  <li>Acompanhamento mamográfico regular.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OFTALMOLOGIA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "oftalmo-cirurgia-refrativa",
    slug: "cirurgia_refrativa",
    title: "Termo de Consentimento - Cirurgia Refrativa",
    description: "Correção de miopia, astigmatismo, hipermetropia",
    category: "oftalmologia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - CIRURGIA REFRATIVA</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo Cirurgia Refrativa a Laser.</p>

<h3>1. OBJETIVO</h3>
<p>Correção de erros refrativos (miopia, hipermetropia, astigmatismo) para reduzir ou eliminar dependência de óculos/lentes.</p>

<h3>2. RISCOS</h3>
<ul>
  <li>Olho seco temporário ou permanente;</li>
  <li>Halos e glare noturnos;</li>
  <li>Sub ou hipercorreção;</li>
  <li>Necessidade de retoque;</li>
  <li>Infecção (rara);</li>
  <li>Ectasia corneana (rara).</li>
</ul>

<h3>3. PÓS-OPERATÓRIO</h3>
<ul>
  <li>Uso de colírios conforme prescrição;</li>
  <li>Evitar coçar os olhos;</li>
  <li>Proteção solar;</li>
  <li>Retornos obrigatórios.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DERMATOLOGIA (MAIS)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "dermato-laser",
    slug: "tratamento_laser",
    title: "Termo de Consentimento - Tratamento a Laser",
    description: "Laser para manchas, pelos, rejuvenescimento",
    category: "dermatologia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - TRATAMENTO A LASER</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo tratamento a Laser.</p>

<h3>1. INDICAÇÃO</h3>
<p>( ) Depilação a laser<br/>
( ) Remoção de manchas<br/>
( ) Rejuvenescimento<br/>
( ) Remoção de tatuagem<br/>
( ) Tratamento vascular</p>

<h3>2. EFEITOS ESPERADOS</h3>
<ul>
  <li>Vermelhidão imediata;</li>
  <li>Edema leve;</li>
  <li>Formação de crostas (alguns casos);</li>
  <li>Múltiplas sessões necessárias.</li>
</ul>

<h3>3. RISCOS</h3>
<ul>
  <li>Queimaduras;</li>
  <li>Hipo ou hiperpigmentação;</li>
  <li>Cicatrizes (raro);</li>
  <li>Bolhas.</li>
</ul>

<h3>4. CUIDADOS</h3>
<ul>
  <li>Protetor solar FPS 50+ obrigatório;</li>
  <li>Evitar sol por 30 dias;</li>
  <li>Não depilar com cera entre sessões.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "dermato-microagulhamento",
    slug: "microagulhamento",
    title: "Termo de Consentimento - Microagulhamento",
    description: "Indução de colágeno por agulhas",
    category: "dermatologia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - MICROAGULHAMENTO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo Microagulhamento.</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>Técnica que utiliza microagulhas para criar microlesões controladas, estimulando produção de colágeno.</p>

<h3>2. INDICAÇÕES</h3>
<ul>
  <li>Cicatrizes de acne;</li>
  <li>Estrias;</li>
  <li>Rugas finas;</li>
  <li>Flacidez;</li>
  <li>Melasma (com cautela).</li>
</ul>

<h3>3. EFEITOS</h3>
<ul>
  <li>Vermelhidão intensa por 24-72h;</li>
  <li>Edema;</li>
  <li>Descamação;</li>
  <li>Sensibilidade.</li>
</ul>

<h3>4. CONTRAINDICAÇÕES</h3>
<ul>
  <li>Acne ativa;</li>
  <li>Herpes ativa;</li>
  <li>Uso de isotretinoína;</li>
  <li>Queloides.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTÉTICA (MAIS)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "estetica-bioestimuladores",
    slug: "bioestimuladores_colageno",
    title: "Termo de Consentimento - Bioestimuladores",
    description: "Sculptra, Radiesse e similares",
    category: "estetica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - BIOESTIMULADORES DE COLÁGENO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo aplicação de Bioestimuladores.</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>Bioestimuladores são substâncias injetáveis que estimulam a produção natural de colágeno (ex: ácido poli-L-láctico, hidroxiapatita de cálcio).</p>

<h3>2. RESULTADOS</h3>
<ul>
  <li>Resultados progressivos (2-3 meses);</li>
  <li>Duração de 18-24 meses;</li>
  <li>Múltiplas sessões podem ser necessárias.</li>
</ul>

<h3>3. EFEITOS COLATERAIS</h3>
<ul>
  <li>Edema e hematomas;</li>
  <li>Nódulos palpáveis;</li>
  <li>Assimetria temporária;</li>
  <li>Granulomas (raros).</li>
</ul>

<h3>4. CUIDADOS</h3>
<ul>
  <li>Massagear conforme orientação;</li>
  <li>Evitar exercícios por 48h;</li>
  <li>Não aplicar calor local.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "estetica-fios-pdo",
    slug: "fios_pdo",
    title: "Termo de Consentimento - Fios de PDO",
    description: "Lifting com fios de sustentação",
    category: "estetica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - FIOS DE PDO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo procedimento com Fios de PDO.</p>

<h3>1. SOBRE O PROCEDIMENTO</h3>
<p>Fios de polidioxanona (PDO) são inseridos na pele para promover sustentação e estímulo de colágeno.</p>

<h3>2. TIPOS DE FIOS</h3>
<ul>
  <li>Fios lisos (estímulo de colágeno);</li>
  <li>Fios espiculados (sustentação);</li>
  <li>Fios em mola (volumização).</li>
</ul>

<h3>3. RISCOS</h3>
<ul>
  <li>Hematomas;</li>
  <li>Assimetria;</li>
  <li>Infecção;</li>
  <li>Extrusão do fio;</li>
  <li>Irregularidades.</li>
</ul>

<h3>4. RECUPERAÇÃO</h3>
<ul>
  <li>Edema por 3-7 dias;</li>
  <li>Evitar movimentos amplos da face;</li>
  <li>Não dormir de lado por 7 dias;</li>
  <li>Resultado final em 30-60 dias.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "estetica-laser",
    slug: "laser_estetico",
    title: "Termo de Consentimento - Laser / Luz Intensa Pulsada",
    description: "Procedimentos com laser, IPL e radiofrequência estéticos",
    category: "estetica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO INFORMADO — LASER / LUZ INTENSA PULSADA (IPL)</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, portador(a) do CPF <strong>{{cpf}}</strong>, declaro que fui devidamente informado(a) sobre o procedimento a que serei submetido(a).</p>

<h3>1. PROCEDIMENTO</h3>
<p>Aplicação de energia luminosa (laser ou luz intensa pulsada) com finalidade estética para tratamento de:</p>
<ul>
  <li>Rejuvenescimento e fotorejuvenescimento;</li>
  <li>Manchas e hiperpigmentação;</li>
  <li>Lesões vasculares (telangiectasias, rosácea);</li>
  <li>Depilação a laser;</li>
  <li>Cicatrizes de acne;</li>
  <li>Melhora da textura e poros.</li>
</ul>

<h3>2. TIPO E PARÂMETROS</h3>
<p>( ) Laser Nd:YAG<br/>
( ) Laser CO2 Fracionado<br/>
( ) Laser Alexandrite<br/>
( ) Laser Diodo<br/>
( ) Luz Intensa Pulsada (IPL)<br/>
( ) Radiofrequência<br/>
( ) Outro: _______________</p>
<p>Parâmetros serão definidos pelo profissional conforme avaliação individual.</p>

<h3>3. RESULTADOS ESPERADOS</h3>
<ul>
  <li>Resultados progressivos ao longo das sessões;</li>
  <li>Número estimado de sessões: ___;</li>
  <li>Intervalo entre sessões: ___ semanas;</li>
  <li>Resultados definitivos não são garantidos.</li>
</ul>

<h3>4. RISCOS E EFEITOS COLATERAIS</h3>
<ul>
  <li>Eritema (vermelhidão) e edema local;</li>
  <li>Dor ou desconforto durante o procedimento;</li>
  <li>Queimaduras superficiais ou profundas;</li>
  <li>Hipo ou hiperpigmentação;</li>
  <li>Bolhas e crostas;</li>
  <li>Cicatrizes (raro);</li>
  <li>Infecção secundária;</li>
  <li>Reativação de herpes labial;</li>
  <li>Fotossensibilidade aumentada.</li>
</ul>

<h3>5. CONTRAINDICAÇÕES</h3>
<ul>
  <li>Uso de isotretinoína nos últimos 6 meses;</li>
  <li>Gravidez e amamentação;</li>
  <li>Bronzeamento recente ou pele bronzeada;</li>
  <li>Doenças autoimunes ou fotossensibilizantes;</li>
  <li>Uso de medicamentos fotossensibilizantes.</li>
</ul>

<h3>6. CUIDADOS PÓS-PROCEDIMENTO</h3>
<ul>
  <li>Protetor solar FPS 50+ de amplo espectro, reaplicar a cada 2h;</li>
  <li>Evitar exposição solar por no mínimo 30 dias;</li>
  <li>Não utilizar produtos ácidos por 7-14 dias;</li>
  <li>Manter hidratação da pele;</li>
  <li>Não remover crostas ou descamação;</li>
  <li>Em caso de bolhas ou dor intensa, contatar a clínica imediatamente.</li>
</ul>

<p>Declaro que li, compreendi e tive oportunidade de esclarecer todas as dúvidas sobre este procedimento.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>

<p>____________________________________<br/>Profissional Responsável<br/>CRM/CRBM: ___________</p>`,
  },

  {
    id: "estetica-microagulhamento",
    slug: "microagulhamento_estetico",
    title: "Termo de Consentimento - Microagulhamento / Drug Delivery",
    description: "IPCA (Indução Percutânea de Colágeno por Agulhas) e drug delivery",
    category: "estetica",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO INFORMADO — MICROAGULHAMENTO / DRUG DELIVERY</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, portador(a) do CPF <strong>{{cpf}}</strong>, declaro que fui devidamente informado(a) sobre o procedimento descrito abaixo.</p>

<h3>1. PROCEDIMENTO</h3>
<p>O microagulhamento (IPCA — Indução Percutânea de Colágeno por Agulhas) consiste na utilização de dispositivo com microagulhas que criam microperfurações controladas na pele, estimulando a produção natural de colágeno e elastina.</p>
<p>( ) Microagulhamento isolado<br/>
( ) Microagulhamento com drug delivery (associação de ativos)<br/>
Ativo utilizado: _______________</p>

<h3>2. INDICAÇÕES</h3>
<ul>
  <li>Cicatrizes de acne;</li>
  <li>Rejuvenescimento facial;</li>
  <li>Estrias;</li>
  <li>Melasma e hiperpigmentações;</li>
  <li>Alopecia (couro cabeludo);</li>
  <li>Melhora da textura da pele.</li>
</ul>

<h3>3. PARÂMETROS DO PROCEDIMENTO</h3>
<ul>
  <li>Profundidade das agulhas: ___ mm;</li>
  <li>Dispositivo: ( ) Roller ( ) Pen elétrico ( ) Stamp;</li>
  <li>Número estimado de sessões: ___;</li>
  <li>Intervalo entre sessões: ___ semanas.</li>
</ul>

<h3>4. RISCOS E EFEITOS COLATERAIS</h3>
<ul>
  <li>Eritema (vermelhidão) por 24-72 horas;</li>
  <li>Edema local;</li>
  <li>Sangramento puntiforme durante o procedimento;</li>
  <li>Descamação leve;</li>
  <li>Hiperpigmentação pós-inflamatória;</li>
  <li>Infecção secundária (raro);</li>
  <li>Cicatrizes (raro, com técnica inadequada);</li>
  <li>Reação alérgica ao ativo do drug delivery;</li>
  <li>Reativação de herpes.</li>
</ul>

<h3>5. CONTRAINDICAÇÕES</h3>
<ul>
  <li>Infecção ativa na área (herpes, impetigo);</li>
  <li>Uso de anticoagulantes;</li>
  <li>Doenças de pele ativas (psoríase, eczema no local);</li>
  <li>Queloide ou tendência queloidiana;</li>
  <li>Gravidez e amamentação;</li>
  <li>Uso de isotretinoína nos últimos 6 meses.</li>
</ul>

<h3>6. CUIDADOS PÓS-PROCEDIMENTO</h3>
<ul>
  <li>Não lavar o rosto nas primeiras 6 horas;</li>
  <li>Usar apenas produtos indicados pelo profissional;</li>
  <li>Protetor solar FPS 50+ obrigatório;</li>
  <li>Evitar maquiagem por 24 horas;</li>
  <li>Não se expor ao sol por no mínimo 15 dias;</li>
  <li>Evitar exercícios físicos intensos por 48h;</li>
  <li>Não frequentar piscina ou sauna por 72h.</li>
</ul>

<p>Declaro que li, compreendi e tive oportunidade de esclarecer todas as dúvidas. Autorizo a realização do procedimento.</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>

<p>____________________________________<br/>Profissional Responsável<br/>CRM/CRBM: ___________</p>`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ODONTOLOGIA (MAIS)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "odonto-clareamento",
    slug: "clareamento_dental",
    title: "Termo de Consentimento - Clareamento Dental",
    description: "Clareamento em consultório ou caseiro",
    category: "odontologia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - CLAREAMENTO DENTAL</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo Clareamento Dental.</p>

<h3>1. TIPO</h3>
<p>( ) Clareamento em consultório<br/>
( ) Clareamento caseiro supervisionado<br/>
( ) Combinado</p>

<h3>2. EFEITOS ESPERADOS</h3>
<ul>
  <li>Sensibilidade dentária temporária;</li>
  <li>Irritação gengival leve;</li>
  <li>Resultados variam conforme estrutura dental.</li>
</ul>

<h3>3. LIMITAÇÕES</h3>
<ul>
  <li>Restaurações e próteses não clareiam;</li>
  <li>Manchas intrínsecas podem não responder;</li>
  <li>Manutenção periódica necessária.</li>
</ul>

<h3>4. CUIDADOS</h3>
<ul>
  <li>Evitar alimentos pigmentados por 48h;</li>
  <li>Não fumar durante tratamento;</li>
  <li>Usar produto conforme orientação.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "odonto-extracao",
    slug: "extracao_dental",
    title: "Termo de Consentimento - Extração Dental",
    description: "Extração simples ou de siso",
    category: "odontologia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - EXTRAÇÃO DENTAL</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo Extração Dental.</p>

<h3>1. DENTE(S) A SER(EM) EXTRAÍDO(S)</h3>
<p>_________________________________</p>

<h3>2. RISCOS</h3>
<ul>
  <li>Dor e edema pós-operatório;</li>
  <li>Sangramento;</li>
  <li>Alveolite (infecção do alvéolo);</li>
  <li>Lesão de nervos (parestesia);</li>
  <li>Fratura de raiz;</li>
  <li>Comunicação buco-sinusal (superiores).</li>
</ul>

<h3>3. CUIDADOS PÓS-OPERATÓRIOS</h3>
<ul>
  <li>Morder gaze por 30 minutos;</li>
  <li>Não bochechar por 24 horas;</li>
  <li>Alimentação fria/morna;</li>
  <li>Não fumar por 72 horas;</li>
  <li>Tomar medicação prescrita.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },

  {
    id: "odonto-ortodontia",
    slug: "tratamento_ortodontico",
    title: "Termo de Consentimento - Ortodontia",
    description: "Aparelho ortodôntico fixo ou alinhadores",
    category: "odontologia",
    is_required_default: true,
    body_html: `<h2 style="text-align:center;">TERMO DE CONSENTIMENTO - TRATAMENTO ORTODÔNTICO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, CPF <strong>{{cpf}}</strong>, autorizo Tratamento Ortodôntico.</p>

<h3>1. TIPO DE APARELHO</h3>
<p>( ) Aparelho fixo metálico<br/>
( ) Aparelho fixo estético<br/>
( ) Alinhadores transparentes<br/>
( ) Aparelho móvel</p>

<h3>2. DURAÇÃO ESTIMADA</h3>
<p>O tratamento pode durar de 12 a 36 meses, dependendo da complexidade do caso.</p>

<h3>3. RISCOS E EFEITOS</h3>
<ul>
  <li>Desconforto e dor inicial;</li>
  <li>Lesões em mucosa;</li>
  <li>Reabsorção radicular;</li>
  <li>Descalcificação (má higiene);</li>
  <li>Recidiva após tratamento.</li>
</ul>

<h3>4. COMPROMISSOS</h3>
<ul>
  <li>Comparecer às manutenções mensais;</li>
  <li>Manter higiene bucal rigorosa;</li>
  <li>Evitar alimentos duros e pegajosos;</li>
  <li>Usar contenção após tratamento.</li>
</ul>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },
];
