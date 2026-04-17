CREATE OR REPLACE FUNCTION public.calcular_indicadores_ona(p_tenant_id uuid, p_inicio date, p_fim date, p_tipo_periodo text DEFAULT 'MENSAL'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$

DECLARE

  v_id UUID;

  v_espera RECORD;

  v_cancel RECORD;

  v_prontuario RECORD;

  v_salas RECORD;

  v_retorno RECORD;

  v_nps RECORD;

  v_eventos RECORD;

BEGIN

  -- Calcula cada indicador

  SELECT * INTO v_espera FROM calc_tempo_espera(p_tenant_id, p_inicio, p_fim);

  SELECT * INTO v_cancel FROM calc_taxa_cancelamento(p_tenant_id, p_inicio, p_fim);

  SELECT * INTO v_prontuario FROM calc_completude_prontuario(p_tenant_id, p_inicio, p_fim);

  SELECT * INTO v_salas FROM calc_ocupacao_salas(p_tenant_id, p_inicio, p_fim);

  SELECT * INTO v_retorno FROM calc_retorno_nao_programado(p_tenant_id, p_inicio, p_fim);

  SELECT * INTO v_nps FROM calc_nps(p_tenant_id, p_inicio, p_fim);

  

  -- Conta eventos adversos

  SELECT 

    COUNT(*) as total,

    jsonb_object_agg(severidade, cnt) FILTER (WHERE severidade IS NOT NULL) as por_severidade,

    jsonb_object_agg(tipo, cnt) FILTER (WHERE tipo IS NOT NULL) as por_tipo

  INTO v_eventos

  FROM (

    SELECT severidade::TEXT, COUNT(*) as cnt FROM adverse_events 

    WHERE tenant_id = p_tenant_id AND data_evento BETWEEN p_inicio AND p_fim

    GROUP BY severidade

  ) s, (

    SELECT tipo::TEXT, COUNT(*) as cnt FROM adverse_events 

    WHERE tenant_id = p_tenant_id AND data_evento BETWEEN p_inicio AND p_fim

    GROUP BY tipo

  ) t;

  

  -- Insere ou atualiza snapshot

  INSERT INTO ona_indicators (

    tenant_id, periodo_inicio, periodo_fim, tipo_periodo,

    tempo_espera_medio, tempo_espera_min, tempo_espera_max, tempo_espera_p90, total_atendimentos_espera,

    taxa_cancelamento, taxa_noshow, total_agendamentos, total_cancelados, total_noshow, total_realizados,

    completude_prontuario, total_prontuarios, prontuarios_completos, campos_obrigatorios_faltantes,

    taxa_ocupacao_salas, horas_disponiveis, horas_ocupadas, ocupacao_por_sala,

    taxa_retorno_nao_programado, total_retornos_7dias, total_atendimentos_periodo,

    nps_score, nps_promotores, nps_neutros, nps_detratores, total_respostas_nps,

    total_eventos_adversos, eventos_por_severidade, eventos_por_tipo

  ) VALUES (

    p_tenant_id, p_inicio, p_fim, p_tipo_periodo,

    v_espera.media, v_espera.minimo, v_espera.maximo, v_espera.p90, v_espera.total,

    v_cancel.taxa_cancel, v_cancel.taxa_ns, v_cancel.total_agend, v_cancel.total_cancel, v_cancel.total_ns, v_cancel.total_realiz,

    v_prontuario.completude, v_prontuario.total, v_prontuario.completos, v_prontuario.campos_faltantes,

    v_salas.taxa, v_salas.horas_disp, v_salas.horas_ocup, v_salas.por_sala,

    v_retorno.taxa, v_retorno.retornos_7dias, v_retorno.total_atend,

    v_nps.score, v_nps.promotores, v_nps.neutros, v_nps.detratores, v_nps.total,

    COALESCE(v_eventos.total, 0), v_eventos.por_severidade, v_eventos.por_tipo

  )

  ON CONFLICT (tenant_id, periodo_inicio, periodo_fim, tipo_periodo) 

  DO UPDATE SET

    tempo_espera_medio = EXCLUDED.tempo_espera_medio,

    tempo_espera_min = EXCLUDED.tempo_espera_min,

    tempo_espera_max = EXCLUDED.tempo_espera_max,

    tempo_espera_p90 = EXCLUDED.tempo_espera_p90,

    total_atendimentos_espera = EXCLUDED.total_atendimentos_espera,

    taxa_cancelamento = EXCLUDED.taxa_cancelamento,

    taxa_noshow = EXCLUDED.taxa_noshow,

    total_agendamentos = EXCLUDED.total_agendamentos,

    total_cancelados = EXCLUDED.total_cancelados,

    total_noshow = EXCLUDED.total_noshow,

    total_realizados = EXCLUDED.total_realizados,

    completude_prontuario = EXCLUDED.completude_prontuario,

    total_prontuarios = EXCLUDED.total_prontuarios,

    prontuarios_completos = EXCLUDED.prontuarios_completos,

    campos_obrigatorios_faltantes = EXCLUDED.campos_obrigatorios_faltantes,

    taxa_ocupacao_salas = EXCLUDED.taxa_ocupacao_salas,

    horas_disponiveis = EXCLUDED.horas_disponiveis,

    horas_ocupadas = EXCLUDED.horas_ocupadas,

    ocupacao_por_sala = EXCLUDED.ocupacao_por_sala,

    taxa_retorno_nao_programado = EXCLUDED.taxa_retorno_nao_programado,

    total_retornos_7dias = EXCLUDED.total_retornos_7dias,

    total_atendimentos_periodo = EXCLUDED.total_atendimentos_periodo,

    nps_score = EXCLUDED.nps_score,

    nps_promotores = EXCLUDED.nps_promotores,

    nps_neutros = EXCLUDED.nps_neutros,

    nps_detratores = EXCLUDED.nps_detratores,

    total_respostas_nps = EXCLUDED.total_respostas_nps,

    total_eventos_adversos = EXCLUDED.total_eventos_adversos,

    eventos_por_severidade = EXCLUDED.eventos_por_severidade,

    eventos_por_tipo = EXCLUDED.eventos_por_tipo,

    calculado_em = NOW()

  RETURNING id INTO v_id;

  

  RETURN v_id;

END;

$function$;