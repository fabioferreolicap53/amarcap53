export interface SelectOption {
  label: string;
  value: string;
  aliases?: string[];
}

export const TIPO_BUSCA_OPTIONS: SelectOption[] = [
  {
    label: "BUSCA ATIVA - VISITA DOMICILIAR REGISTRADA EM PRONTUÁRIO",
    value: "BUSCA ATIVA - VISITA DOMICILIAR REGISTRADA EM PRONTUÁRIO",
    aliases: [
      "1 - BUSCA ATIVA- VISITA DOMICILIAR REGISTRADA EM PRONTUÁRIO",
      "1 - Busca ativa- Visita domiciliar registrada em prontuário"
    ]
  },
  {
    label: "BUSCA ATIVA - CONTATO TELEFÔNICO (LIGAÇÃO) REGISTRADA EM PRONTUÁRIO",
    value: "BUSCA ATIVA - CONTATO TELEFÔNICO (LIGAÇÃO) REGISTRADA EM PRONTUÁRIO",
    aliases: [
      "2 - BUSCA ATIVA - CONTATO TELEFÔNICO (LIGAÇÃO) REGISTRADA EM PRONTUÁRIO",
      "2 - Busca ativa - Contato Telefônico (ligação) registrada em prontuário"
    ]
  },
  {
    label: "BUSCA ATIVA - MENSAGEM REGISTRADA EM PRONTUÁRIO",
    value: "BUSCA ATIVA - MENSAGEM REGISTRADA EM PRONTUÁRIO",
    aliases: [
      "3 - BUSCA ATIVA - MENSAGEM REGISTRADA EM PRONTUÁRIO",
      "3 - Busca ativa - Mensagem registrada em prontuário"
    ]
  }
];

export const TIPO_CONTATO_OPTIONS: SelectOption[] = [
  {
    label: "CONTATO DIRETO (CONVERSA)",
    value: "CONTATO DIRETO (CONVERSA)",
    aliases: ["1 - CONTATO DIRETO (CONVERSA)"]
  },
  {
    label: "CONTATO INDIRETO (MENSAGEM)",
    value: "CONTATO INDIRETO (MENSAGEM)",
    aliases: ["2 - CONTATO INDIRETO (MENSAGEM)"]
  },
  {
    label: "NÃO HOUVE CONTATO (NÃO LOCALIZADA, LIGAÇÃO NÃO ATENDIDA...)",
    value: "NÃO HOUVE CONTATO (NÃO LOCALIZADA, LIGAÇÃO NÃO ATENDIDA...)",
    aliases: ["3 - NÃO HOUVE CONTATO ( NÃO LOCALIZADA, LIGAÇÃO NÃO ATENDIDA...)"]
  }
];

export const SITUACAO_POS_BUSCA_OPTIONS: SelectOption[] = [
  {
    label: "AGENDAMENTO APÓS CONTATO DIRETO",
    value: "AGENDAMENTO APÓS CONTATO DIRETO",
    aliases: ["1 - AGENDAMENTO APÓS CONTATO DIRETO", "1- Agendamento após contato direto", "1 - Agendamento após contato direto"]
  },
  {
    label: "CONVITE PARA DEMANDA LIVRE",
    value: "CONVITE PARA DEMANDA LIVRE",
    aliases: ["2 - CONVITE PARA DEMANDA LIVRE", "2 - Convite para demanda livre"]
  },
  {
    label: "CITOPATOLÓGICO REALIZADO NOS ÚLTIMOS 3 ANOS, EM OUTRA UNIDADE DO SUS COM FORNECIMENTO DO LAUDO E RESULTADO REGISTRADO NO PEP",
    value: "CITOPATOLÓGICO REALIZADO NOS ÚLTIMOS 3 ANOS, EM OUTRA UNIDADE DO SUS COM FORNECIMENTO DO LAUDO E RESULTADO REGISTRADO NO PEP",
    aliases: ["3 - CITOPATOLÓGICO REALIZADO NOS ÚLTIMOS 3 ANOS, EM OUTRA UNIDADE DO SUS COM FORNECIMENTO DO LAUDO E RESULTADO REGISTRADO NO PEP", "3 - Citopatológico realizado nos últimos 3 anos, em outra unidade do SUS com fornecimento do laudo e resultado registrado no PEP"]
  },
  {
    label: "CITOPATOLÓGICO REALIZADO NOS ÚLTIMOS 3 ANOS, EM OUTRA UNIDADE DA REDE PRIVADA COM FORNECIMENTO DO LAUDO E RESULTADO REGISTRADO NO PEP",
    value: "CITOPATOLÓGICO REALIZADO NOS ÚLTIMOS 3 ANOS, EM OUTRA UNIDADE DA REDE PRIVADA COM FORNECIMENTO DO LAUDO E RESULTADO REGISTRADO NO PEP",
    aliases: ["4 - CITOPATOLÓGICO REALIZADO NOS ÚLTIMOS 3 ANOS, EM OUTRA UNIDADE DA REDE PRIVADA COM FORNECIMENTO DO LAUDO E RESULTADO REGISTRADO NO PEP", "4 - Citopatológico realizado nos últimos 3 anos, em outra unidade da rede privada com fornecimento do laudo e resultado registrado no PEP"]
  },
  {
    label: "TESTE MOLECULAR/DNA-HPV ONCOGÊNICO REALIZADO NOS ÚLTIMOS 5 ANOS, EM OUTRA UNIDADE DO SUS COM RESULTADO REGISTRADO NO PEP",
    value: "TESTE MOLECULAR/DNA-HPV ONCOGÊNICO REALIZADO NOS ÚLTIMOS 5 ANOS, EM OUTRA UNIDADE DO SUS COM RESULTADO REGISTRADO NO PEP",
    aliases: ["5 - TESTE MOLECULAR/ DNA-HPV ONCOGÊNICO REALIZADO NOS ÚLTIMOS 5 ANOS, EM OUTRA UNIDADE DO SUS COM RESULTADO REGISTRADO NO PEP", "5 - Teste molecular/ DNA-HPV oncogênico realizado nos últimos 5 anos, em outra unidade do SUS com resultado registrado no PEP"]
  },
  {
    label: "TESTE MOLECULAR/ DNA-HPV ONCOGÊNICO REALIZADO NOS ÚLTIMOS 5 ANOS, EM OUTRA UNIDADE DA REDE PRIVADA COM RESULTADO REGISTRADO NO PEP",
    value: "TESTE MOLECULAR/ DNA-HPV ONCOGÊNICO REALIZADO NOS ÚLTIMOS 5 ANOS, EM OUTRA UNIDADE DA REDE PRIVADA COM RESULTADO REGISTRADO NO PEP",
    aliases: ["6 - TESTE MOLECULAR/ DNA-HPV ONCOGÊNICO REALIZADO NOS ÚLTIMOS 5 ANOS, EM OUTRA UNIDADE DA REDE PRIVADA COM RESULTADO REGISTRADO NO PEP", "6 - Teste molecular/ DNA-HPV oncogênico realizado nos últimos 5 anos, em outra unidade da rede privada com resultado registrado no PEP"]
  },
  {
    label: "MUDANÇA DE TERRITÓRIO (SITUAÇÃO ATUALIZADA NO PEP)",
    value: "MUDANÇA DE TERRITÓRIO (SITUAÇÃO ATUALIZADA NO PEP)",
    aliases: ["7 - MUDANÇA DE TERRITÓRIO (SITUAÇÃO ATUALIZADA NO PEP)", "7 - Mudança de território (situação atualizada no PEP)"]
  },
  {
    label: "ÓBITO (SITUAÇÃO ATUALIZADA NO PEP)",
    value: "ÓBITO (SITUAÇÃO ATUALIZADA NO PEP)",
    aliases: ["8 - ÓBITO (SITUAÇÃO ATUALIZADA NO PEP)", "8 - Óbito (situação atualizada no PEP)"]
  },
  {
    label: "NÃO LOCALIZADA",
    value: "NÃO LOCALIZADA",
    aliases: ["9 - NÃO LOCALIZADA", "9 - Não localizada"]
  },
  {
    label: "RECUSA",
    value: "RECUSA",
    aliases: ["10 - RECUSA", "10 - Recusa"]
  }
];

export const ENTRAVES_IDENTIFICADOS_OPTIONS: SelectOption[] = [
  {
    label: "HORÁRIOS INCOMPATÍVEIS COM A ROTINA DE TRABALHO",
    value: "HORÁRIOS INCOMPATÍVEIS COM A ROTINA DE TRABALHO",
    aliases: ["1 - HORÁRIOS INCOMPATÍVEIS COM A ROTINA DE TRABALHO", "1 - Horários incompatíveis com a rotina de trabalho"]
  },
  {
    label: "VERGONHA OU CONSTRANGIMENTO DURANTE O EXAME",
    value: "VERGONHA OU CONSTRANGIMENTO DURANTE O EXAME",
    aliases: ["2 - VERGONHA OU CONSTRANGIMENTO DURANTE O EXAME", "2 - Vergonha ou constrangimento durante o exame"]
  },
  {
    label: "IDEIA EQUIVOCADA SOBRE A NECESSIDADE DE FAZER EXAME",
    value: "IDEIA EQUIVOCADA SOBRE A NECESSIDADE DE FAZER EXAME",
    aliases: ["3 - IDEIA EQUIVOCADA SOBRE A NECESSIDADE DE FAZER EXAME", "3 - Ideia equivocada sobre a necessidade de fazer exame"]
  },
  {
    label: "FAZ O RASTREAMENTO PELA REDE PRIVADA",
    value: "FAZ O RASTREAMENTO PELA REDE PRIVADA",
    aliases: ["4 - FAZ O RASTREAMENTO PELA REDE PRIVADA", "4 - Faz o rastreamento pela rede privada"]
  },
  {
    label: "DIFICULDADE DE LOCOMOÇÃO (EX:ACAMADA)",
    value: "DIFICULDADE DE LOCOMOÇÃO (EX:ACAMADA)",
    aliases: ["5 - DIFICULDADE DE LOCOMOÇÃO ( EX: ACAMADA)", "5 - Dificuldade de locomoção ( ex: acamada)"]
  },
  {
    label: "DISTÂNCIA DA UNIDADE",
    value: "DISTÂNCIA DA UNIDADE",
    aliases: ["6 - DISTÂNCIA DA UNIDADE", "6 - Distância da Unidade"]
  },
  {
    label: "SE RECUSA A FAZER O EXAME COM O PROFISSIONAL DA EQUIPE",
    value: "SE RECUSA A FAZER O EXAME COM O PROFISSIONAL DA EQUIPE",
    aliases: ["7 - SE RECUSA A FAZER O EXAME COM O PROFISSIONAL DA EQUIPE", "7 - Se recusa a fazer o exame com o profissional da equipe"]
  },
  {
    label: "ESQUECE A DATA DO AGENDAMENTO",
    value: "ESQUECE A DATA DO AGENDAMENTO",
    aliases: ["8 - ESQUECE A DATA DO AGENDAMENTO", "8 - Esquece a data do agendamento"]
  },
  {
    label: "INDISPONIBILIDADE DE TEMPO",
    value: "INDISPONIBILIDADE DE TEMPO",
    aliases: ["9 - INDISPONIBILIDADE DE TEMPO", "9 - Indisponibilidade de tempo"]
  },
  {
    label: "NÃO IDENTIFICADO ENTRAVE",
    value: "NÃO IDENTIFICADO ENTRAVE",
    aliases: ["10 - NÃO IDENTIFICADO ENTRAVE", "10 - Não identificado entrave"]
  }
];

export const ENTRAVES_INFORMADO_POR_OPTIONS: SelectOption[] = [
  {
    label: "INFORMADO POR PACIENTE",
    value: "INFORMADO POR PACIENTE",
    aliases: ["1 - INFORMADO POR PACIENTE", "1 - Informado por paciente"]
  },
  {
    label: "IDENTIFICADO POR PROFISSIONAL",
    value: "IDENTIFICADO POR PROFISSIONAL",
    aliases: ["2 - IDENTIFICADO POR PROFISSIONAL", "2 - Identificado por profissional"]
  }
];

const normalizeOptionText = (value: string) => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
};

const escapeFilterValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const getCanonicalSelectValue = (value: string | string[] | undefined, options: SelectOption[]) => {
  if (!value || (Array.isArray(value) && value.length === 0)) return '';
  if (Array.isArray(value)) return value.map(v => getCanonicalSelectValue(v, options)).filter(Boolean).join('; ');

  const normalizedValue = normalizeOptionText(value);
  const matchedOption = options.find(option =>
    normalizeOptionText(option.value) === normalizedValue ||
    normalizeOptionText(option.label) === normalizedValue ||
    (option.aliases || []).some(alias => normalizeOptionText(alias) === normalizedValue)
  );

  return matchedOption?.value || value;
};

export const getSelectLabel = (value: string | string[] | undefined, options: SelectOption[]) => {
  if (!value || (Array.isArray(value) && value.length === 0)) return '';
  if (Array.isArray(value)) return value.map(v => getSelectLabel(v, options)).filter(Boolean).join('; ');

  const normalizedValue = normalizeOptionText(value);
  const matchedOption = options.find(option =>
    normalizeOptionText(option.value) === normalizedValue ||
    normalizeOptionText(option.label) === normalizedValue ||
    (option.aliases || []).some(alias => normalizeOptionText(alias) === normalizedValue)
  );

  return matchedOption?.label || value;
};

export const getSelectAliases = (value: string | undefined, options: SelectOption[]) => {
  if (!value) return [];

  const normalizedValue = normalizeOptionText(value);
  const matchedOption = options.find(option =>
    normalizeOptionText(option.value) === normalizedValue ||
    normalizeOptionText(option.label) === normalizedValue ||
    (option.aliases || []).some(alias => normalizeOptionText(alias) === normalizedValue)
  );

  if (!matchedOption) return [value];

  return Array.from(new Set([matchedOption.value, matchedOption.label, ...(matchedOption.aliases || [])]));
};

export const matchesSelectFilter = (
  rawValue: string | undefined,
  selectedValues: string[],
  options: SelectOption[]
) => {
  if (selectedValues.length === 0) return true;
  if (!rawValue) return false;

  const canonicalRawValue = getCanonicalSelectValue(rawValue, options);
  return selectedValues
    .map(value => getCanonicalSelectValue(value, options))
    .includes(canonicalRawValue);
};

export const buildSelectFilter = (
  fieldName: string,
  selectedValues: string[],
  options: SelectOption[],
  operator: '=' | '~' = '='
) => {
  const clauses = selectedValues.flatMap(value =>
    getSelectAliases(value, options).map(alias => `${fieldName} ${operator} "${escapeFilterValue(alias)}"`)
  );

  return clauses.length > 0 ? `(${Array.from(new Set(clauses)).join(' || ')})` : '';
};

export const getCanonicalValue = (fieldName: string, value: string | string[] | undefined): string => {
  if (!value) return '';
  switch (fieldName) {
    case 'tipo_busca': return getCanonicalSelectValue(value, TIPO_BUSCA_OPTIONS);
    case 'tipo_contato': return getCanonicalSelectValue(value, TIPO_CONTATO_OPTIONS);
    case 'situacao_pos_busca': return getCanonicalSelectValue(value, SITUACAO_POS_BUSCA_OPTIONS);
    case 'entraves_informado_por': return getCanonicalSelectValue(value, ENTRAVES_INFORMADO_POR_OPTIONS);
    case 'entraves_identificados': return getCanonicalSelectValue(value, ENTRAVES_IDENTIFICADOS_OPTIONS);
    default: return Array.isArray(value) ? value.join('; ') : value;
  }
};
