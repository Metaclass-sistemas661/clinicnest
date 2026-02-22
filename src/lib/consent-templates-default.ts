/**
 * Templates jurídicos padrão para clínicas.
 * Todos usam variáveis {{...}} que são substituídas pelos dados reais do paciente.
 */

export interface ConsentSuggestion {
  slug: string;
  title: string;
  description: string;
  body_html: string;
}

export const CONSENT_TEMPLATES: ConsentSuggestion[] = [
  {
    slug: "contrato",
    title: "Contrato de Prestação de Serviços",
    description: "Contrato formal entre a clínica e o paciente para prestação de serviços de saúde.",
    body_html: `<h2 style="text-align:center;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SAÚDE</h2>

<p>Pelo presente instrumento particular, as partes abaixo qualificadas:</p>

<h3>CONTRATADA (Clínica)</h3>
<p><strong>{{nome_clinica}}</strong>, inscrita no CNPJ sob o nº <strong>{{cnpj_clinica}}</strong>, com sede em <strong>{{endereco_clinica}}</strong>, neste ato representada por seu(sua) responsável técnico(a) <strong>{{responsavel_tecnico}}</strong>, registro profissional <strong>{{crm_responsavel}}</strong>, doravante denominada <strong>CONTRATADA</strong>.</p>

<h3>CONTRATANTE (Paciente)</h3>
<p><strong>{{nome_paciente}}</strong>, inscrito(a) no CPF sob o nº <strong>{{cpf}}</strong>, nascido(a) em <strong>{{data_nascimento}}</strong>, residente em <strong>{{endereco_completo}}</strong>, e-mail <strong>{{email}}</strong>, telefone <strong>{{telefone}}</strong>, doravante denominado(a) <strong>CONTRATANTE</strong>.</p>

<p>Têm entre si justo e contratado o seguinte:</p>

<h3>CLÁUSULA 1ª – DO OBJETO</h3>
<p>O presente contrato tem por objeto a prestação de serviços de saúde pela CONTRATADA ao CONTRATANTE, incluindo consultas, procedimentos, exames e demais serviços clínicos oferecidos, conforme indicação profissional e concordância do paciente.</p>

<h3>CLÁUSULA 2ª – DAS OBRIGAÇÕES DA CONTRATADA</h3>
<p>A CONTRATADA se compromete a:</p>
<ul>
  <li>Prestar os serviços com zelo, diligência e de acordo com as normas técnicas e éticas da profissão;</li>
  <li>Manter sigilo absoluto sobre todas as informações do CONTRATANTE, conforme o Código de Ética Médica e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018);</li>
  <li>Informar de forma clara e compreensível sobre diagnósticos, procedimentos, riscos, alternativas e prognósticos;</li>
  <li>Manter prontuário eletrônico atualizado e acessível ao paciente;</li>
  <li>Disponibilizar canais de comunicação adequados para agendamento, dúvidas e emergências.</li>
</ul>

<h3>CLÁUSULA 3ª – DAS OBRIGAÇÕES DO CONTRATANTE</h3>
<p>O CONTRATANTE se compromete a:</p>
<ul>
  <li>Fornecer informações verdadeiras e completas sobre seu estado de saúde, histórico médico, alergias e medicamentos em uso;</li>
  <li>Comparecer pontualmente aos agendamentos ou cancelar/reagendar com antecedência mínima de 24 (vinte e quatro) horas;</li>
  <li>Seguir as orientações médicas e terapêuticas prescritas;</li>
  <li>Efetuar os pagamentos nos prazos e valores acordados;</li>
  <li>Comunicar imediatamente qualquer reação adversa ou intercorrência.</li>
</ul>

<h3>CLÁUSULA 4ª – DOS VALORES E PAGAMENTO</h3>
<p>Os valores dos serviços seguirão a tabela vigente da CONTRATADA no momento da prestação do serviço, sendo informados previamente ao CONTRATANTE. O pagamento deverá ser efetuado conforme as condições acordadas entre as partes, podendo ser à vista, parcelado ou via convênio, quando aplicável.</p>

<h3>CLÁUSULA 5ª – DO CANCELAMENTO E FALTAS</h3>
<p>O cancelamento de consultas e procedimentos deve ser comunicado com antecedência mínima de 24 horas. A ausência sem aviso prévio (falta) poderá ser cobrada conforme política da clínica. Após 3 (três) faltas consecutivas sem justificativa, a CONTRATADA reserva-se o direito de suspender os agendamentos do CONTRATANTE.</p>

<h3>CLÁUSULA 6ª – DA RESCISÃO</h3>
<p>O presente contrato poderá ser rescindido por qualquer das partes, mediante comunicação por escrito com 30 (trinta) dias de antecedência, sem prejuízo das obrigações já assumidas. A rescisão não exime o CONTRATANTE do pagamento de valores pendentes relativos a serviços já prestados.</p>

<h3>CLÁUSULA 7ª – DA PROTEÇÃO DE DADOS (LGPD)</h3>
<p>A CONTRATADA realizará o tratamento dos dados pessoais e sensíveis do CONTRATANTE exclusivamente para fins de prestação dos serviços de saúde contratados, conforme a Lei nº 13.709/2018 (LGPD). O CONTRATANTE poderá exercer seus direitos de titular (acesso, correção, exclusão, portabilidade) mediante solicitação formal aos canais de atendimento da clínica.</p>

<h3>CLÁUSULA 8ª – DO FORO</h3>
<p>As partes elegem o foro da comarca de <strong>{{cidade}}</strong> — <strong>{{estado}}</strong>, para dirimir quaisquer controvérsias oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>

<p style="margin-top:30px;">E por estarem assim justas e contratadas, as partes assinam o presente instrumento digitalmente, com reconhecimento facial, para que produza seus efeitos legais.</p>

<p><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<br/>
<p>____________________________________<br/><strong>{{nome_clinica}}</strong><br/>CONTRATADA</p>
<br/>
<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}<br/>CONTRATANTE</p>`,
  },
  {
    slug: "uso_imagem",
    title: "Termo de Autorização de Uso de Imagem",
    description: "Autorização para uso de imagem do paciente em divulgação e marketing da clínica.",
    body_html: `<h2 style="text-align:center;">TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, inscrito(a) no CPF sob o nº <strong>{{cpf}}</strong>, residente em <strong>{{endereco_completo}}</strong>, por meio deste instrumento e na melhor forma de direito, <strong>AUTORIZO</strong> o uso da minha imagem nos termos abaixo descritos:</p>

<h3>1. AUTORIZAÇÃO</h3>
<p>Autorizo a <strong>{{nome_clinica}}</strong>, CNPJ <strong>{{cnpj_clinica}}</strong>, seus representantes e profissionais, a captar, armazenar e utilizar minha imagem — incluindo fotografias, vídeos e registros de procedimentos (antes, durante e depois) — para as seguintes finalidades:</p>
<ul>
  <li><strong>Fins científicos e educacionais:</strong> apresentações em congressos, cursos, workshops, publicações científicas e material didático;</li>
  <li><strong>Fins institucionais:</strong> divulgação em site da clínica, redes sociais (Instagram, Facebook, YouTube, TikTok e similares), materiais impressos, banners e apresentações;</li>
  <li><strong>Documentação clínica:</strong> registro no prontuário eletrônico para acompanhamento da evolução do tratamento.</li>
</ul>

<h3>2. CONDIÇÕES</h3>
<ul>
  <li>As imagens poderão ser editadas, recortadas ou tratadas graficamente, desde que não desvirtuem o contexto original;</li>
  <li>A utilização será feita de forma ética e respeitosa, sem exposição vexatória ou constrangedora;</li>
  <li>Meu nome completo <strong>não será divulgado</strong> junto às imagens, salvo autorização expressa adicional;</li>
  <li>Não haverá qualquer contraprestação financeira pela cessão das imagens;</li>
  <li>A presente autorização é concedida a título gratuito e por prazo indeterminado.</li>
</ul>

<h3>3. REVOGAÇÃO</h3>
<p>Esta autorização poderá ser revogada a qualquer tempo, mediante solicitação por escrito enviada à CONTRATADA, ressalvado que a revogação não terá efeito retroativo sobre os materiais já produzidos e divulgados até a data da solicitação, conforme artigo 20 do Código Civil.</p>

<h3>4. PROTEÇÃO DE DADOS</h3>
<p>As imagens são consideradas dados pessoais sensíveis nos termos da Lei nº 13.709/2018 (LGPD) e serão tratadas com as medidas de segurança adequadas. O titular pode exercer seus direitos de acesso, correção e eliminação junto à clínica.</p>

<p style="margin-top:30px;">Declaro que li e compreendi os termos acima e manifesto meu livre e expresso consentimento.</p>

<p><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<br/>
<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>`,
  },
  {
    slug: "desconfortos",
    title: "Termo de Ciência de Riscos e Desconfortos Pós-Procedimento",
    description: "Ciência do paciente sobre possíveis desconfortos, riscos e efeitos colaterais de procedimentos.",
    body_html: `<h2 style="text-align:center;">TERMO DE CIÊNCIA DE RISCOS E DESCONFORTOS PÓS-PROCEDIMENTO</h2>

<p>Eu, <strong>{{nome_paciente}}</strong>, inscrito(a) no CPF sob o nº <strong>{{cpf}}</strong>, nascido(a) em <strong>{{data_nascimento}}</strong>, declaro para os devidos fins que fui devidamente informado(a) pela equipe da <strong>{{nome_clinica}}</strong> a respeito do(s) procedimento(s) a ser(em) realizado(s), e que:</p>

<h3>1. CIÊNCIA DOS RISCOS</h3>
<p>Estou ciente de que qualquer procedimento clínico, estético ou cirúrgico pode apresentar riscos e efeitos colaterais, incluindo, mas não se limitando a:</p>
<ul>
  <li><strong>Dor e sensibilidade:</strong> desconforto localizado, dor leve a moderada, sensibilidade ao toque na região tratada;</li>
  <li><strong>Edema e inchaço:</strong> inchaço na área do procedimento, que pode durar de horas a semanas conforme o tipo de intervenção;</li>
  <li><strong>Hematomas e equimoses:</strong> manchas roxas ou avermelhadas na pele, decorrentes de sangramento subcutâneo;</li>
  <li><strong>Vermelhidão e irritação:</strong> eritema, descamação ou ressecamento da pele;</li>
  <li><strong>Reações alérgicas:</strong> possibilidade de reação alérgica a medicamentos, anestésicos, materiais ou substâncias utilizadas;</li>
  <li><strong>Infecção:</strong> risco inerente a qualquer procedimento invasivo, minimizado pelo seguimento das orientações de cuidados;</li>
  <li><strong>Resultados variáveis:</strong> os resultados podem variar de pessoa para pessoa, não sendo possível garantir resultado específico;</li>
  <li><strong>Necessidade de retoques ou sessões adicionais:</strong> em alguns casos, pode ser necessário complementar o tratamento;</li>
  <li><strong>Complicações raras:</strong> embora incomuns, podem ocorrer complicações mais graves que serão prontamente tratadas pela equipe.</li>
</ul>

<h3>2. DECLARAÇÕES DO PACIENTE</h3>
<p>Declaro que:</p>
<ul>
  <li>Informei ao profissional responsável sobre todas as minhas condições de saúde, doenças prévias, cirurgias anteriores, alergias conhecidas e medicamentos em uso;</li>
  <li>Fui informado(a) sobre as alternativas de tratamento disponíveis e optei pelo procedimento proposto de livre e espontânea vontade;</li>
  <li>Tive a oportunidade de esclarecer todas as minhas dúvidas antes de concordar com o procedimento;</li>
  <li>Compreendo que o não cumprimento das orientações pré e pós-procedimento pode comprometer os resultados e aumentar os riscos de complicações;</li>
  <li>Me comprometo a seguir rigorosamente as orientações fornecidas pela equipe clínica;</li>
  <li>Me comprometo a comunicar imediatamente qualquer reação adversa, sintoma incomum ou intercorrência.</li>
</ul>

<h3>3. ORIENTAÇÕES PÓS-PROCEDIMENTO</h3>
<p>Estou ciente de que deverei seguir todas as orientações fornecidas pela equipe clínica após o procedimento, incluindo repouso, uso de medicamentos prescritos, cuidados com a área tratada e comparecimento às consultas de acompanhamento agendadas.</p>

<h3>4. CONSENTIMENTO</h3>
<p>Declaro que todas as informações acima me foram prestadas de forma clara e compreensível, que li integralmente este termo e que, estando de acordo com seu conteúdo, manifesto meu livre, informado e expresso consentimento para a realização do(s) procedimento(s) indicado(s).</p>

<p style="margin-top:30px;"><strong>{{cidade}}</strong>, <strong>{{data_hoje}}</strong></p>

<br/>
<p>____________________________________<br/><strong>{{nome_paciente}}</strong><br/>CPF: {{cpf}}</p>
<br/>
<p>____________________________________<br/><strong>{{responsavel_tecnico}}</strong><br/>{{crm_responsavel}}<br/><strong>{{nome_clinica}}</strong></p>`,
  },
];
