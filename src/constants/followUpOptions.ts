export interface SelectOption {
  label: string;
  value: string;
}

export const TIPO_BUSCA_OPTIONS: SelectOption[] = [
  {
    label: "1 - BUSCA ATIVA- VISITA DOMICILIAR REGISTRADA EM PRONTUÁRIO",
    value: "1 - Busca ativa- Visita domiciliar registrada em prontuário"
  },
  {
    label: "2 - BUSCA ATIVA - CONTATO TELEFÔNICO (LIGAÇÃO) REGISTRADA EM PRONTUÁRIO",
    value: "2 - Busca ativa - Contato Telefônico (ligação) registrada em prontuário"
  },
  {
    label: "3 - BUSCA ATIVA - MENSAGEM REGISTRADA EM PRONTUÁRIO",
    value: "3 - Busca ativa - Mensagem registrada em prontuário"
  }
];

export const TIPO_CONTATO_OPTIONS: SelectOption[] = [
  {
    label: "1 - CONTATO DIRETO (CONVERSA)",
    value: "CONTATO DIRETO (CONVERSA)"
  },
  {
    label: "2 - CONTATO INDIRETO (MENSAGEM)",
    value: "CONTATO INDIRETO (MENSAGEM)"
  },
  {
    label: "3 - NÃO HOUVE CONTATO ( NÃO LOCALIZADA, LIGAÇÃO NÃO ATENDIDA...)",
    value: "NÃO HOUVE CONTATO ( NÃO LOCALIZADA, LIGAÇÃO NÃO ATENDIDA...)"
  }
];

export const SITUACAO_POS_BUSCA_OPTIONS: SelectOption[] = [
  {
    label: "1 - AGENDAMENTO APÓS CONTATO DIRETO",
    value: "1- Agendamento após contato direto"
  },
  {
    label: "2 - CONVITE PARA DEMANDA LIVRE",
    value: "2 - Convite para demanda livre"
  },
  {
    label: "3 - CITOPATOLÓGICO REALIZADO NOS ÚLTIMOS 3 ANOS, EM OUTRA UNIDADE DO SUS COM FORNECIMENTO DO LAUDO E RESULTADO REGISTRADO NO PEP",
    value: "3 - Citopatológico realizado nos últimos 3 anos, em outra unidade do SUS com fornecimento do laudo e resultado registrado no PEP"
  },
  {
    label: "4 - CITOPATOLÓGICO REALIZADO NOS ÚLTIMOS 3 ANOS, EM OUTRA UNIDADE DA REDE PRIVADA COM FORNECIMENTO DO LAUDO E RESULTADO REGISTRADO NO PEP",
    value: "4 - Citopatológico realizado nos últimos 3 anos, em outra unidade da rede privada com fornecimento do laudo e resultado registrado no PEP"
  },
  {
    label: "5 - TESTE MOLECULAR/ DNA-HPV ONCOGÊNICO REALIZADO NOS ÚLTIMOS 5 ANOS, EM OUTRA UNIDADE DO SUS COM RESULTADO REGISTRADO NO PEP",
    value: "5 - Teste molecular/ DNA-HPV oncogênico realizado nos últimos 5 anos, em outra unidade do SUS com resultado registrado no PEP"
  },
  {
    label: "6 - TESTE MOLECULAR/ DNA-HPV ONCOGÊNICO REALIZADO NOS ÚLTIMOS 5 ANOS, EM OUTRA UNIDADE DA REDE PRIVADA COM RESULTADO REGISTRADO NO PEP",
    value: "6 - Teste molecular/ DNA-HPV oncogênico realizado nos últimos 5 anos, em outra unidade da rede privada com resultado registrado no PEP"
  },
  {
    label: "7 - MUDANÇA DE TERRITÓRIO (SITUAÇÃO ATUALIZADA NO PEP)",
    value: "7 - Mudança de território (situação atualizada no PEP)"
  },
  {
    label: "8 - ÓBITO (SITUAÇÃO ATUALIZADA NO PEP)",
    value: "8 - Óbito (situação atualizada no PEP)"
  },
  {
    label: "9 - NÃO LOCALIZADA",
    value: "9 - Não localizada"
  },
  {
    label: "10 - RECUSA",
    value: "10 - Recusa"
  }
];

export const ENTRAVES_IDENTIFICADOS_OPTIONS: SelectOption[] = [
  {
    label: "1 - HORÁRIOS INCOMPATÍVEIS COM A ROTINA DE TRABALHO",
    value: "1 - Horários incompatíveis com a rotina de trabalho"
  },
  {
    label: "2 - VERGONHA OU CONSTRANGIMENTO DURANTE O EXAME",
    value: "2 - Vergonha ou constrangimento durante o exame"
  },
  {
    label: "3 - IDEIA EQUIVOCADA SOBRE A NECESSIDADE DE FAZER EXAME",
    value: "3 - Ideia equivocada sobre a necessidade de fazer exame"
  },
  {
    label: "4 - FAZ O RASTREAMENTO PELA REDE PRIVADA",
    value: "4 - Faz o rastreamento pela rede privada"
  },
  {
    label: "5 - DIFICULDADE DE LOCOMOÇÃO ( EX: ACAMADA)",
    value: "5 - Dificuldade de locomoção ( ex: acamada)"
  },
  {
    label: "6 - DISTÂNCIA DA UNIDADE",
    value: "6 - Distância da Unidade"
  },
  {
    label: "7 - SE RECUSA A FAZER O EXAME COM O PROFISSIONAL DA EQUIPE",
    value: "7 - Se recusa a fazer o exame com o profissional da equipe"
  },
  {
    label: "8 - ESQUECE A DATA DO AGENDAMENTO",
    value: "8 - Esquece a data do agendamento"
  },
  {
    label: "9 - INDISPONIBILIDADE DE TEMPO",
    value: "9 - Indisponibilidade de tempo"
  },
  {
    label: "10 - NÃO IDENTIFICADO ENTRAVE",
    value: "10 - Não identificado entrave"
  }
];

export const ENTRAVES_INFORMADO_POR_OPTIONS: SelectOption[] = [
  {
    label: "1 - INFORMADO POR PACIENTE",
    value: "1 - Informado por paciente"
  },
  {
    label: "2 - IDENTIFICADO POR PROFISSIONAL",
    value: "2 - Identificado por profissional"
  }
];

const normalizeOptionText = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const escapeFilterValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const getCanonicalSelectValue = (value: string | undefined, options: SelectOption[]) => {
  if (!value) return '';

  const normalizedValue = normalizeOptionText(value);
  const matchedOption = options.find(option =>
    normalizeOptionText(option.value) === normalizedValue ||
    normalizeOptionText(option.label) === normalizedValue
  );

  return matchedOption?.value || value;
};

export const getSelectAliases = (value: string | undefined, options: SelectOption[]) => {
  if (!value) return [];

  const normalizedValue = normalizeOptionText(value);
  const matchedOption = options.find(option =>
    normalizeOptionText(option.value) === normalizedValue ||
    normalizeOptionText(option.label) === normalizedValue
  );

  if (!matchedOption) return [value];

  return Array.from(new Set([matchedOption.value, matchedOption.label]));
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

export const getCanonicalValue = (fieldName: string, value: string | undefined): string => {
  if (!value) return '';
  switch (fieldName) {
    case 'tipo_busca': return getCanonicalSelectValue(value, TIPO_BUSCA_OPTIONS);
    case 'tipo_contato': return getCanonicalSelectValue(value, TIPO_CONTATO_OPTIONS);
    case 'situacao_pos_busca': return getCanonicalSelectValue(value, SITUACAO_POS_BUSCA_OPTIONS);
    case 'entraves_informado_por': return getCanonicalSelectValue(value, ENTRAVES_INFORMADO_POR_OPTIONS);
    case 'entraves_identificados': return getCanonicalSelectValue(value, ENTRAVES_IDENTIFICADOS_OPTIONS);
    default: return value;
  }
};
