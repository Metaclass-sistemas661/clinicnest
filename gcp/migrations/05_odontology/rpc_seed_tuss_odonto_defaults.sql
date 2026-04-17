CREATE OR REPLACE FUNCTION public.seed_tuss_odonto_defaults(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

BEGIN

  INSERT INTO public.tuss_odonto_prices (tenant_id, tuss_code, description, default_price, category)

  VALUES

    -- CONSULTA / URG├èNCIA

    (p_tenant_id, '81000065', 'Consulta odontol├│gica inicial', 150.00, 'Consulta'),

    (p_tenant_id, '81000073', 'Consulta odontol├│gica de retorno', 100.00, 'Consulta'),

    (p_tenant_id, '81000081', 'Consulta odontol├│gica para fins de per├¡cia', 200.00, 'Consulta'),

    (p_tenant_id, '81000090', 'Consulta odontol├│gica de urg├¬ncia', 200.00, 'Urg├¬ncia'),

    (p_tenant_id, '81000103', 'Consulta odontol├│gica para avalia├º├úo t├®cnica', 120.00, 'Consulta'),

    (p_tenant_id, '81000111', 'Consulta odontol├│gica de acompanhamento', 100.00, 'Consulta'),

    (p_tenant_id, '81000120', 'Consulta odontol├│gica domiciliar', 250.00, 'Consulta'),

    -- RADIOLOGIA

    (p_tenant_id, '81000200', 'Radiografia periapical completa (14 filmes)', 180.00, 'Radiologia'),

    (p_tenant_id, '81000219', 'Radiografia periapical (por filme)', 40.00, 'Radiologia'),

    (p_tenant_id, '81000227', 'Radiografia panor├ómica', 120.00, 'Radiologia'),

    (p_tenant_id, '81000235', 'Radiografia interproximal (bite-wing)', 40.00, 'Radiologia'),

    (p_tenant_id, '81000243', 'Radiografia oclusal', 50.00, 'Radiologia'),

    (p_tenant_id, '81000251', 'Telerradiografia lateral', 100.00, 'Radiologia'),

    (p_tenant_id, '81000260', 'Telerradiografia frontal (PA)', 100.00, 'Radiologia'),

    (p_tenant_id, '81000278', 'Tomografia cone beam - por arcada', 350.00, 'Radiologia'),

    (p_tenant_id, '81000286', 'Tomografia cone beam - face total', 500.00, 'Radiologia'),

    (p_tenant_id, '81000294', 'Radiografia da ATM bilateral', 150.00, 'Radiologia'),

    (p_tenant_id, '81000308', 'Documenta├º├úo ortod├┤ntica completa', 350.00, 'Radiologia'),

    (p_tenant_id, '81000340', 'Escaneamento intraoral digital', 200.00, 'Radiologia'),

    -- PREVEN├ç├âO

    (p_tenant_id, '81100013', 'Profilaxia / limpeza dental (por arcada)', 150.00, 'Preven├º├úo'),

    (p_tenant_id, '81100021', 'Aplica├º├úo t├│pica de fl├║or (por arcada)', 60.00, 'Preven├º├úo'),

    (p_tenant_id, '81100030', 'Aplica├º├úo de selante de fissura (por dente)', 80.00, 'Preven├º├úo'),

    (p_tenant_id, '81100048', 'Controle de placa bacteriana', 60.00, 'Preven├º├úo'),

    (p_tenant_id, '81100056', 'Orienta├º├úo de higiene bucal', 50.00, 'Preven├º├úo'),

    (p_tenant_id, '81100080', 'Polimento coron├írio', 100.00, 'Preven├º├úo'),

    (p_tenant_id, '81100099', 'Aplica├º├úo de cariost├ítico (por dente)', 30.00, 'Preven├º├úo'),

    -- DENT├ìSTICA

    (p_tenant_id, '82000018', 'Restaura├º├úo em ion├┤mero de vidro - 1 face', 100.00, 'Dent├¡stica'),

    (p_tenant_id, '82000026', 'Restaura├º├úo em ion├┤mero de vidro - 2+ faces', 150.00, 'Dent├¡stica'),

    (p_tenant_id, '82000034', 'Restaura├º├úo direta em resina composta - 1 face', 180.00, 'Dent├¡stica'),

    (p_tenant_id, '82000042', 'Restaura├º├úo direta em resina composta - 2 faces', 250.00, 'Dent├¡stica'),

    (p_tenant_id, '82000050', 'Restaura├º├úo direta em resina composta - 3 faces', 320.00, 'Dent├¡stica'),

    (p_tenant_id, '82000069', 'Restaura├º├úo direta em resina composta - 4+ faces', 380.00, 'Dent├¡stica'),

    (p_tenant_id, '82000077', 'Restaura├º├úo direta em am├ílgama - 1 face', 120.00, 'Dent├¡stica'),

    (p_tenant_id, '82000085', 'Restaura├º├úo direta em am├ílgama - 2 faces', 160.00, 'Dent├¡stica'),

    (p_tenant_id, '82000093', 'Restaura├º├úo direta em am├ílgama - 3+ faces', 200.00, 'Dent├¡stica'),

    (p_tenant_id, '82000115', 'Restaura├º├úo indireta inlay/onlay cer├ómica', 800.00, 'Dent├¡stica'),

    (p_tenant_id, '82000123', 'Restaura├º├úo indireta inlay/onlay resina', 600.00, 'Dent├¡stica'),

    (p_tenant_id, '82000174', 'Tratamento restaurador atraum├ítico (ART)', 120.00, 'Dent├¡stica'),

    (p_tenant_id, '82000182', 'N├║cleo de preenchimento em resina', 200.00, 'Dent├¡stica'),

    (p_tenant_id, '82000190', 'N├║cleo met├ílico fundido', 350.00, 'Dent├¡stica'),

    (p_tenant_id, '82000204', 'Pino intrarradicular pr├®-fabricado', 200.00, 'Dent├¡stica'),

    (p_tenant_id, '82000212', 'Pino de fibra de vidro', 300.00, 'Dent├¡stica'),

    (p_tenant_id, '82000220', 'Ajuste oclusal por desgaste seletivo', 100.00, 'Dent├¡stica'),

    (p_tenant_id, '82000239', 'Colagem de fragmento dental', 200.00, 'Dent├¡stica'),

    (p_tenant_id, '82000247', 'Restaura├º├úo provis├│ria / tempor├íria', 80.00, 'Dent├¡stica'),

    -- ENDODONTIA

    (p_tenant_id, '83000014', 'Tratamento de canal unirradicular', 600.00, 'Endodontia'),

    (p_tenant_id, '83000022', 'Tratamento de canal birradicular', 800.00, 'Endodontia'),

    (p_tenant_id, '83000030', 'Tratamento de canal multirradicular (3+ canais)', 1000.00, 'Endodontia'),

    (p_tenant_id, '83000049', 'Retratamento endod├┤ntico unirradicular', 700.00, 'Endodontia'),

    (p_tenant_id, '83000057', 'Retratamento endod├┤ntico birradicular', 900.00, 'Endodontia'),

    (p_tenant_id, '83000065', 'Retratamento endod├┤ntico multirradicular', 1200.00, 'Endodontia'),

    (p_tenant_id, '83000073', 'Pulpotomia', 200.00, 'Endodontia'),

    (p_tenant_id, '83000081', 'Pulpectomia (dente dec├¡duo)', 250.00, 'Endodontia'),

    (p_tenant_id, '83000090', 'Capeamento pulpar direto', 120.00, 'Endodontia'),

    (p_tenant_id, '83000103', 'Capeamento pulpar indireto', 100.00, 'Endodontia'),

    (p_tenant_id, '83000111', 'Remo├º├úo de corpo estranho do canal', 350.00, 'Endodontia'),

    (p_tenant_id, '83000120', 'Remo├º├úo de instrumento fraturado do canal', 500.00, 'Endodontia'),

    (p_tenant_id, '83000138', 'Apicectomia unirradicular', 500.00, 'Endodontia'),

    (p_tenant_id, '83000170', 'Curativo de demora (medica├º├úo intracanal)', 100.00, 'Endodontia'),

    (p_tenant_id, '83000189', 'Clareamento interno (dente desvitalizado)', 250.00, 'Endodontia'),

    (p_tenant_id, '83000197', 'Tratamento de perfura├º├úo radicular (MTA)', 400.00, 'Endodontia'),

    (p_tenant_id, '83000219', 'Remo├º├úo de pino intrarradicular', 300.00, 'Endodontia'),

    (p_tenant_id, '83000227', 'Drenagem de abscesso dentoalveolar', 180.00, 'Endodontia'),

    -- PERIODONTIA

    (p_tenant_id, '84000010', 'Raspagem supragengival (por hemiarcada)', 200.00, 'Periodontia'),

    (p_tenant_id, '84000028', 'Raspagem subgengival (por hemiarcada)', 250.00, 'Periodontia'),

    (p_tenant_id, '84000036', 'Raspagem supra e subgengival (boca toda)', 500.00, 'Periodontia'),

    (p_tenant_id, '84000044', 'Cirurgia periodontal a retalho (sextante)', 500.00, 'Periodontia'),

    (p_tenant_id, '84000052', 'Gengivectomia (por sextante)', 400.00, 'Periodontia'),

    (p_tenant_id, '84000060', 'Gengivoplastia (por sextante)', 400.00, 'Periodontia'),

    (p_tenant_id, '84000079', 'Aumento de coroa cl├¡nica (por dente)', 500.00, 'Periodontia'),

    (p_tenant_id, '84000087', 'Enxerto gengival livre', 800.00, 'Periodontia'),

    (p_tenant_id, '84000095', 'Enxerto de tecido conjuntivo', 1000.00, 'Periodontia'),

    (p_tenant_id, '84000109', 'Recobrimento radicular', 900.00, 'Periodontia'),

    (p_tenant_id, '84000117', 'Regenera├º├úo tecidual guiada (RTG)', 1200.00, 'Periodontia'),

    (p_tenant_id, '84000125', 'Enxerto ├│sseo periodontal', 800.00, 'Periodontia'),

    (p_tenant_id, '84000141', 'Conten├º├úo periodontal (arcada)', 300.00, 'Periodontia'),

    (p_tenant_id, '84000150', 'Frenectomia labial', 350.00, 'Periodontia'),

    (p_tenant_id, '84000168', 'Frenectomia lingual', 350.00, 'Periodontia'),

    (p_tenant_id, '84000184', 'Imobiliza├º├úo dental tempor├íria', 250.00, 'Periodontia'),

    (p_tenant_id, '84000192', 'Manuten├º├úo periodontal (sess├úo)', 200.00, 'Periodontia'),

    (p_tenant_id, '84000206', 'Sondagem periodontal (periograma)', 100.00, 'Periodontia'),

    -- CIRURGIA

    (p_tenant_id, '85000016', 'Exodontia simples (dente permanente)', 200.00, 'Cirurgia'),

    (p_tenant_id, '85000024', 'Exodontia simples de dente dec├¡duo', 120.00, 'Cirurgia'),

    (p_tenant_id, '85000032', 'Exodontia de dente incluso/impactado', 500.00, 'Cirurgia'),

    (p_tenant_id, '85000040', 'Exodontia de dente semi-incluso', 400.00, 'Cirurgia'),

    (p_tenant_id, '85000059', 'Exodontia com odontosec├º├úo', 400.00, 'Cirurgia'),

    (p_tenant_id, '85000067', 'Exodontia de raiz residual', 250.00, 'Cirurgia'),

    (p_tenant_id, '85000075', 'Exodontia m├║ltipla (por arcada)', 500.00, 'Cirurgia'),

    (p_tenant_id, '85000083', 'Alveoloplastia (por arcada)', 350.00, 'Cirurgia'),

    (p_tenant_id, '85000091', 'Remo├º├úo de dente supranumer├írio', 400.00, 'Cirurgia'),

    (p_tenant_id, '85000113', 'Frenectomia cir├║rgica', 350.00, 'Cirurgia'),

    (p_tenant_id, '85000121', 'Reimplante dental', 350.00, 'Cirurgia'),

    (p_tenant_id, '85000148', 'Sutura de ferida bucal', 150.00, 'Cirurgia'),

    (p_tenant_id, '85000156', 'Remo├º├úo de cisto periapical', 600.00, 'Cirurgia'),

    (p_tenant_id, '85000180', 'Incis├úo e drenagem de abscesso bucal', 200.00, 'Cirurgia'),

    (p_tenant_id, '85000261', 'Remo├º├úo de torus palatino', 600.00, 'Cirurgia'),

    (p_tenant_id, '85000270', 'Remo├º├úo de torus mandibular', 600.00, 'Cirurgia'),

    (p_tenant_id, '85000296', 'Bi├│psia de tecido mole da boca', 300.00, 'Cirurgia'),

    (p_tenant_id, '85000318', 'Regulariza├º├úo de rebordo alveolar', 400.00, 'Cirurgia'),

    (p_tenant_id, '85000326', 'Remo├º├úo de mucocele', 350.00, 'Cirurgia'),

    (p_tenant_id, '85000415', 'Enxerto ├│sseo aut├│geno intraoral', 1200.00, 'Cirurgia'),

    (p_tenant_id, '85000431', 'Enxerto ├│sseo com biomaterial', 800.00, 'Cirurgia'),

    (p_tenant_id, '85000440', 'Levantamento de seio maxilar lateral', 2000.00, 'Cirurgia'),

    (p_tenant_id, '85000458', 'Levantamento de seio maxilar crestal', 1500.00, 'Cirurgia'),

    (p_tenant_id, '85000504', 'Tracionamento de dente incluso (ortodontia)', 500.00, 'Cirurgia'),

    -- PR├ôTESE

    (p_tenant_id, '86000012', 'Coroa total metalocer├ómica', 1200.00, 'Pr├│tese'),

    (p_tenant_id, '86000020', 'Coroa total em cer├ómica pura (metal-free)', 1800.00, 'Pr├│tese'),

    (p_tenant_id, '86000039', 'Coroa total met├ílica', 800.00, 'Pr├│tese'),

    (p_tenant_id, '86000055', 'Coroa provis├│ria em acr├¡lico', 150.00, 'Pr├│tese'),

    (p_tenant_id, '86000063', 'Pr├│tese parcial fixa metalocer├ómica (elemento)', 1200.00, 'Pr├│tese'),

    (p_tenant_id, '86000071', 'Pr├│tese parcial fixa cer├ómica pura (elemento)', 1800.00, 'Pr├│tese'),

    (p_tenant_id, '86000080', 'PPR com estrutura met├ílica', 1500.00, 'Pr├│tese'),

    (p_tenant_id, '86000098', 'PPR provis├│ria (acr├¡lica)', 600.00, 'Pr├│tese'),

    (p_tenant_id, '86000101', 'Pr├│tese total superior (dentadura)', 2000.00, 'Pr├│tese'),

    (p_tenant_id, '86000110', 'Pr├│tese total inferior (dentadura)', 2000.00, 'Pr├│tese'),

    (p_tenant_id, '86000136', 'Reembasamento de pr├│tese', 350.00, 'Pr├│tese'),

    (p_tenant_id, '86000152', 'Conserto de pr├│tese remov├¡vel', 200.00, 'Pr├│tese'),

    (p_tenant_id, '86000160', 'Placa miorrelaxante (bruxismo)', 600.00, 'Pr├│tese'),

    (p_tenant_id, '86000233', 'Bloco/coroa CAD-CAM cer├ómica', 2000.00, 'Pr├│tese'),

    -- ORTODONTIA

    (p_tenant_id, '87000019', 'Aparelho ortod├┤ntico fixo met├ílico (arcada)', 1500.00, 'Ortodontia'),

    (p_tenant_id, '87000027', 'Aparelho ortod├┤ntico fixo est├®tico (arcada)', 2500.00, 'Ortodontia'),

    (p_tenant_id, '87000035', 'Aparelho ortod├┤ntico fixo autoligado (arcada)', 3000.00, 'Ortodontia'),

    (p_tenant_id, '87000043', 'Alinhador transparente (fase)', 5000.00, 'Ortodontia'),

    (p_tenant_id, '87000051', 'Aparelho ortod├┤ntico remov├¡vel (arcada)', 600.00, 'Ortodontia'),

    (p_tenant_id, '87000060', 'Aparelho ortop├®dico funcional', 1200.00, 'Ortodontia'),

    (p_tenant_id, '87000078', 'Manuten├º├úo ortod├┤ntica mensal', 250.00, 'Ortodontia'),

    (p_tenant_id, '87000086', 'Mini-implante ortod├┤ntico', 500.00, 'Ortodontia'),

    (p_tenant_id, '87000108', 'Colagem de bracket/tubo (unidade)', 80.00, 'Ortodontia'),

    (p_tenant_id, '87000124', 'Remo├º├úo de aparelho fixo (arcada)', 200.00, 'Ortodontia'),

    (p_tenant_id, '87000132', 'Conten├º├úo fixa (barra lingual - arcada)', 300.00, 'Ortodontia'),

    (p_tenant_id, '87000140', 'Conten├º├úo remov├¡vel Hawley (arcada)', 400.00, 'Ortodontia'),

    (p_tenant_id, '87000159', 'Disjuntor palatino', 1200.00, 'Ortodontia'),

    (p_tenant_id, '87000183', 'Mantenedor de espa├ºo fixo', 350.00, 'Ortodontia'),

    -- IMPLANTODONTIA

    (p_tenant_id, '88000015', 'Implante osseointegrado (corpo)', 3000.00, 'Implantodontia'),

    (p_tenant_id, '88000023', 'Implante carga imediata', 4000.00, 'Implantodontia'),

    (p_tenant_id, '88000031', 'Reabertura de implante', 500.00, 'Implantodontia'),

    (p_tenant_id, '88000058', 'Componente prot├®tico / abutment', 800.00, 'Implantodontia'),

    (p_tenant_id, '88000074', 'Coroa sobre implante metalocer├ómica', 2000.00, 'Implantodontia'),

    (p_tenant_id, '88000082', 'Coroa sobre implante cer├ómica pura', 2800.00, 'Implantodontia'),

    (p_tenant_id, '88000090', 'Protocolo fixo sobre implantes (arcada)', 15000.00, 'Implantodontia'),

    (p_tenant_id, '88000112', 'Overdenture sobre implantes barra (arcada)', 8000.00, 'Implantodontia'),

    (p_tenant_id, '88000163', 'Enxerto ├│sseo para implante (biomaterial)', 800.00, 'Implantodontia'),

    (p_tenant_id, '88000171', 'Membrana para regenera├º├úo ├│ssea', 500.00, 'Implantodontia'),

    (p_tenant_id, '88000180', 'Levantamento de seio para implante lateral', 2000.00, 'Implantodontia'),

    (p_tenant_id, '88000201', 'Guia cir├║rgico para implante', 800.00, 'Implantodontia'),

    (p_tenant_id, '88000244', 'Manuten├º├úo de pr├│tese sobre implante', 200.00, 'Implantodontia'),

    -- EST├ëTICA

    (p_tenant_id, '89000011', 'Clareamento de consult├│rio (sess├úo)', 800.00, 'Est├®tica'),

    (p_tenant_id, '89000020', 'Clareamento caseiro (kit)', 500.00, 'Est├®tica'),

    (p_tenant_id, '89000038', 'Faceta direta em resina (dente)', 400.00, 'Est├®tica'),

    (p_tenant_id, '89000054', 'Faceta indireta cer├ómica/porcelana (dente)', 1500.00, 'Est├®tica'),

    (p_tenant_id, '89000062', 'Lente de contato dental (laminado ultrafino)', 2000.00, 'Est├®tica'),

    (p_tenant_id, '89000070', 'Gengivoplastia est├®tica laser', 500.00, 'Est├®tica'),

    (p_tenant_id, '89000089', 'Ensaio restaurador (mock-up)', 300.00, 'Est├®tica'),

    (p_tenant_id, '89000097', 'Reanatomiza├º├úo dental em resina (dente)', 250.00, 'Est├®tica'),

    (p_tenant_id, '89000100', 'Toxina botul├¡nica perioral (HOF)', 1200.00, 'Est├®tica'),

    (p_tenant_id, '89000119', 'Preenchimento ├ícido hialur├┤nico perioral (HOF)', 1500.00, 'Est├®tica'),

    (p_tenant_id, '89000127', 'Bichectomia', 2000.00, 'Est├®tica'),

    -- ODONTOPEDIATRIA

    (p_tenant_id, '90000015', 'Pulpotomia em dente dec├¡duo', 200.00, 'Odontopediatria'),

    (p_tenant_id, '90000023', 'Pulpectomia em dente dec├¡duo', 250.00, 'Odontopediatria'),

    (p_tenant_id, '90000031', 'Exodontia de dente dec├¡duo', 120.00, 'Odontopediatria'),

    (p_tenant_id, '90000040', 'Mantenedor de espa├ºo fixo (banda-al├ºa)', 350.00, 'Odontopediatria'),

    (p_tenant_id, '90000066', 'Coroa de a├ºo em dente dec├¡duo', 250.00, 'Odontopediatria'),

    (p_tenant_id, '90000082', 'Restaura├º├úo dec├¡duo com resina', 120.00, 'Odontopediatria'),

    (p_tenant_id, '90000090', 'Restaura├º├úo dec├¡duo com ion├┤mero', 100.00, 'Odontopediatria'),

    (p_tenant_id, '90000155', 'Seda├º├úo consciente com ├│xido nitroso', 300.00, 'Odontopediatria'),

    -- DTM / OCLUS├âO

    (p_tenant_id, '91000011', 'Placa miorrelaxante (oclusal estabilizadora)', 600.00, 'DTM/Oclus├úo'),

    (p_tenant_id, '91000020', 'Placa reposicionadora para DTM', 700.00, 'DTM/Oclus├úo'),

    (p_tenant_id, '91000038', 'Ajuste oclusal por desgaste seletivo', 200.00, 'DTM/Oclus├úo'),

    (p_tenant_id, '91000054', 'Montagem em articulador semi-ajust├ível', 150.00, 'DTM/Oclus├úo'),

    (p_tenant_id, '91000070', 'Toxina botul├¡nica para bruxismo/DTM', 1200.00, 'DTM/Oclus├úo'),

    -- ESTOMATOLOGIA

    (p_tenant_id, '92000017', 'Bi├│psia incisional de les├úo oral', 300.00, 'Estomatologia'),

    (p_tenant_id, '92000025', 'Bi├│psia excisional de les├úo oral', 400.00, 'Estomatologia'),

    (p_tenant_id, '92000041', 'Rastreio de c├óncer bucal', 100.00, 'Estomatologia'),

    (p_tenant_id, '92000050', 'Remo├º├úo de les├úo de tecido mole', 350.00, 'Estomatologia'),

    (p_tenant_id, '92000076', 'Tratamento de les├úo aftosa/herpes (laser)', 150.00, 'Estomatologia'),

    -- LASERTERAPIA

    (p_tenant_id, '93000013', 'Laserterapia de baixa pot├¬ncia (sess├úo)', 100.00, 'Laserterapia'),

    (p_tenant_id, '93000048', 'Laserterapia para hipersensibilidade', 100.00, 'Laserterapia'),

    (p_tenant_id, '93000056', 'Terapia fotodin├ómica (PDT)', 200.00, 'Laserterapia'),

    (p_tenant_id, '93000064', 'Frenectomia a laser', 500.00, 'Laserterapia'),

    (p_tenant_id, '93000099', 'Clareamento assistido por laser', 1000.00, 'Laserterapia'),

    -- ANESTESIA / SEDA├ç├âO

    (p_tenant_id, '95000016', 'Anestesia local (por procedimento)', 30.00, 'Anestesia'),

    (p_tenant_id, '95000032', 'Seda├º├úo consciente com ├│xido nitroso', 300.00, 'Anestesia'),

    (p_tenant_id, '95000040', 'Seda├º├úo consciente oral', 400.00, 'Anestesia'),

    -- OUTROS

    (p_tenant_id, '99000012', 'Moldagem de estudo (alginato por arcada)', 50.00, 'Outros'),

    (p_tenant_id, '99000020', 'Moldagem com silicone (por arcada)', 120.00, 'Outros'),

    (p_tenant_id, '99000039', 'Planejamento digital do sorriso (DSD)', 500.00, 'Outros'),

    (p_tenant_id, '99000071', 'Dessensibiliza├º├úo dentin├íria (sess├úo)', 80.00, 'Outros'),

    (p_tenant_id, '99000128', 'Tratamento de alveolite', 100.00, 'Outros'),

    (p_tenant_id, '99000144', 'Jateamento com bicarbonato (profilaxia a jato)', 200.00, 'Outros')

  ON CONFLICT (tenant_id, tuss_code) DO NOTHING;

END;

$function$;