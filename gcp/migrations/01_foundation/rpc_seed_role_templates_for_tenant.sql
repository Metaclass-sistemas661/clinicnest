CREATE OR REPLACE FUNCTION public.seed_role_templates_for_tenant(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_templates JSONB := '[

    {

      "type": "admin",

      "name": "Administrador",

      "perms": {

        "dashboard":"vcud","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",

        "prontuarios":"v","receituarios":"v","laudos":"v","atestados":"v",

        "encaminhamentos":"v","triagem":"v","evolucao_enfermagem":"v","evolucao_clinica":"v",

        "odontograma":"v","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"vcud",

        "chat":"vcud","financeiro":"vcud","faturamento_tiss":"vcud","convenios":"vcud",

        "relatorios":"vcud","compras":"vcud","fornecedores":"vcud","produtos":"vcud",

        "campanhas":"vcud","automacoes":"vcud","equipe":"vcud","configuracoes":"vcud",

        "auditoria":"vcud","assinatura":"vcud","disponibilidade":"vcud",

        "especialidades":"vcud","modelos_prontuario":"vcud","termos_consentimento":"vcud",

        "contratos_termos":"vcud","integracoes":"vcud","api_docs":"vcud",

        "agendamento_online":"vcud","fidelidade_cashback":"vcud","vouchers":"vcud","cupons":"vcud"

      }

    },

    {

      "type": "medico",

      "name": "M├®dico(a)",

      "perms": {

        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"vcud",

        "prontuarios":"vcud","receituarios":"vcud","laudos":"vcud","atestados":"vcud",

        "encaminhamentos":"vcud","triagem":"v","evolucao_enfermagem":"v","evolucao_clinica":"vcud",

        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",

        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",

        "relatorios":"","compras":"","fornecedores":"","produtos":"v",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"vcud",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    },

    {

      "type": "dentista",

      "name": "Dentista",

      "perms": {

        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"vcud",

        "prontuarios":"vcud","receituarios":"vcud","laudos":"vcud","atestados":"vcud",

        "encaminhamentos":"vcud","triagem":"v","evolucao_enfermagem":"","evolucao_clinica":"vcud",

        "odontograma":"vcud","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",

        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",

        "relatorios":"","compras":"","fornecedores":"","produtos":"v",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"vcud",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    },

    {

      "type": "enfermeiro",

      "name": "Enfermeiro(a)",

      "perms": {

        "dashboard":"v","agenda":"vu","clientes":"vu","clientes_clinico":"v",

        "prontuarios":"v","receituarios":"","laudos":"","atestados":"",

        "encaminhamentos":"v","triagem":"vcud","evolucao_enfermagem":"vcud","evolucao_clinica":"v",

        "odontograma":"","teleconsulta":"","lista_espera":"v","gestao_salas":"v",

        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",

        "relatorios":"","compras":"","fornecedores":"","produtos":"v",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    },

    {

      "type": "tec_enfermagem",

      "name": "T├®cnico(a) de Enfermagem",

      "perms": {

        "dashboard":"v","agenda":"v","clientes":"v","clientes_clinico":"",

        "prontuarios":"","receituarios":"","laudos":"","atestados":"",

        "encaminhamentos":"","triagem":"vcud","evolucao_enfermagem":"","evolucao_clinica":"",

        "odontograma":"","teleconsulta":"","lista_espera":"v","gestao_salas":"v",

        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",

        "relatorios":"","compras":"","fornecedores":"","produtos":"v",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    },

    {

      "type": "fisioterapeuta",

      "name": "Fisioterapeuta",

      "perms": {

        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",

        "prontuarios":"v","receituarios":"","laudos":"vcud","atestados":"",

        "encaminhamentos":"vcud","triagem":"v","evolucao_enfermagem":"","evolucao_clinica":"vcud",

        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",

        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",

        "relatorios":"","compras":"","fornecedores":"","produtos":"v",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"vcud",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    },

    {

      "type": "nutricionista",

      "name": "Nutricionista",

      "perms": {

        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",

        "prontuarios":"v","receituarios":"","laudos":"","atestados":"",

        "encaminhamentos":"vcud","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"vcud",

        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",

        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",

        "relatorios":"","compras":"","fornecedores":"","produtos":"v",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"vcud",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    },

    {

      "type": "psicologo",

      "name": "Psic├│logo(a)",

      "perms": {

        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",

        "prontuarios":"v","receituarios":"","laudos":"vcud","atestados":"",

        "encaminhamentos":"vcud","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"vcud",

        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",

        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",

        "relatorios":"","compras":"","fornecedores":"","produtos":"v",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"vcud",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    },

    {

      "type": "fonoaudiologo",

      "name": "Fonoaudi├│logo(a)",

      "perms": {

        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"v",

        "prontuarios":"v","receituarios":"","laudos":"vcud","atestados":"",

        "encaminhamentos":"vcud","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"vcud",

        "odontograma":"","teleconsulta":"vcud","lista_espera":"vcud","gestao_salas":"v",

        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",

        "relatorios":"","compras":"","fornecedores":"","produtos":"v",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"vcud",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    },

    {

      "type": "secretaria",

      "name": "Secret├íria / Recepcionista",

      "perms": {

        "dashboard":"v","agenda":"vcud","clientes":"vcud","clientes_clinico":"",

        "prontuarios":"","receituarios":"","laudos":"","atestados":"",

        "encaminhamentos":"","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"",

        "odontograma":"","teleconsulta":"v","lista_espera":"vcud","gestao_salas":"v",

        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",

        "relatorios":"","compras":"","fornecedores":"","produtos":"vcud",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    },

    {

      "type": "faturista",

      "name": "Faturista",

      "perms": {

        "dashboard":"v","agenda":"v","clientes":"v","clientes_clinico":"",

        "prontuarios":"","receituarios":"","laudos":"","atestados":"",

        "encaminhamentos":"","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"",

        "odontograma":"","teleconsulta":"","lista_espera":"","gestao_salas":"",

        "chat":"vcud","financeiro":"v","faturamento_tiss":"vcud","convenios":"v",

        "relatorios":"v","compras":"","fornecedores":"","produtos":"",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    },

    {

      "type": "custom",

      "name": "Perfil Customizado",

      "perms": {

        "dashboard":"v","agenda":"v","clientes":"v","clientes_clinico":"",

        "prontuarios":"","receituarios":"","laudos":"","atestados":"",

        "encaminhamentos":"","triagem":"","evolucao_enfermagem":"","evolucao_clinica":"",

        "odontograma":"","teleconsulta":"","lista_espera":"","gestao_salas":"",

        "chat":"vcud","financeiro":"","faturamento_tiss":"","convenios":"",

        "relatorios":"","compras":"","fornecedores":"","produtos":"",

        "campanhas":"","automacoes":"","equipe":"","configuracoes":"",

        "auditoria":"","assinatura":"","disponibilidade":"",

        "especialidades":"","modelos_prontuario":"","termos_consentimento":"",

        "contratos_termos":"","integracoes":"","api_docs":"",

        "agendamento_online":"","fidelidade_cashback":"","vouchers":"","cupons":""

      }

    }

  ]'::jsonb;

  v_item JSONB;

  v_perms_expanded JSONB;

  v_resource TEXT;

  v_actions TEXT;

BEGIN

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_templates) LOOP

    v_perms_expanded := '{}'::jsonb;

    FOR v_resource, v_actions IN SELECT * FROM jsonb_each_text(v_item->'perms') LOOP

      v_perms_expanded := v_perms_expanded || jsonb_build_object(

        v_resource, jsonb_build_object(

          'view', v_actions LIKE '%v%',

          'create', v_actions LIKE '%c%',

          'edit', v_actions LIKE '%u%',

          'delete', v_actions LIKE '%d%'

        )

      );

    END LOOP;



    INSERT INTO public.role_templates (tenant_id, name, professional_type, permissions, is_system)

    VALUES (

      p_tenant_id,

      v_item->>'name',

      (v_item->>'type')::public.professional_type,

      v_perms_expanded,

      true

    )

    ON CONFLICT (tenant_id, professional_type) DO NOTHING;

  END LOOP;

END;

$function$;