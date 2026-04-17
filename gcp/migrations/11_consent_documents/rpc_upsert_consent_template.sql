CREATE OR REPLACE FUNCTION public.upsert_consent_template(p_title text, p_slug text, p_body_html text, p_is_required boolean, p_is_active boolean, p_sort_order integer, p_template_id uuid DEFAULT NULL::uuid, p_template_type text DEFAULT 'html'::text, p_pdf_storage_path text DEFAULT NULL::text, p_pdf_original_filename text DEFAULT NULL::text, p_pdf_file_size integer DEFAULT NULL::integer)
 RETURNS consent_templates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_tenant_id UUID;

  v_template public.consent_templates%rowtype;

BEGIN

  -- Obter tenant do usu├írio

  SELECT get_user_tenant_id(current_setting('app.current_user_id')::uuid) INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN

    RAISE EXCEPTION 'Usu├írio n├úo pertence a nenhum tenant';

  END IF;



  -- Verificar se ├® admin

  IF NOT is_tenant_admin(current_setting('app.current_user_id')::uuid, v_tenant_id) THEN

    RAISE EXCEPTION 'Apenas administradores podem gerenciar termos';

  END IF;



  -- Validar tipo

  IF p_template_type NOT IN ('html', 'pdf') THEN

    RAISE EXCEPTION 'Tipo de template inv├ílido: %', p_template_type;

  END IF;



  -- Se for PDF, precisa ter o path

  IF p_template_type = 'pdf' AND p_pdf_storage_path IS NULL THEN

    RAISE EXCEPTION 'PDF storage path ├® obrigat├│rio para templates do tipo PDF';

  END IF;



  IF p_template_id IS NOT NULL THEN

    -- Update existente

    UPDATE public.consent_templates

    SET 

      title = p_title,

      slug = p_slug,

      body_html = p_body_html,

      is_required = p_is_required,

      is_active = p_is_active,

      sort_order = p_sort_order,

      template_type = p_template_type,

      pdf_storage_path = p_pdf_storage_path,

      pdf_original_filename = p_pdf_original_filename,

      pdf_file_size = p_pdf_file_size,

      updated_at = now()

    WHERE id = p_template_id AND tenant_id = v_tenant_id

    RETURNING * INTO v_template;

    

    IF v_template.id IS NULL THEN

      RAISE EXCEPTION 'Template n├úo encontrado ou sem permiss├úo';

    END IF;

  ELSE

    -- Insert novo

    INSERT INTO public.consent_templates (

      tenant_id, title, slug, body_html, is_required, is_active, sort_order,

      template_type, pdf_storage_path, pdf_original_filename, pdf_file_size

    )

    VALUES (

      v_tenant_id, p_title, p_slug, p_body_html, p_is_required, p_is_active, p_sort_order,

      p_template_type, p_pdf_storage_path, p_pdf_original_filename, p_pdf_file_size

    )

    RETURNING * INTO v_template;

  END IF;



  RETURN v_template;

END;

$function$;