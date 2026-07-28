# Ordenação de Tabelas — Guia de Implementação

> Referência para projetos futuros. Funcionalidade aplicada nas páginas **Pacientes**, **Favoritos** e **Acompanhamentos**.

---

## 1. Conceito

Permitir que o usuário clique no cabeçalho de uma coluna da tabela para ordenar os dados de forma **ascendente** ou **descendente**. Um clique alterna a direção; clicar em outra coluna reseta para ascendente.

---

## 2. Estrutura de Estado

```tsx
const [sortField, setSortField] = useState<string>("nome");
const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
```

| Estado     | Tipo                  | Descrição                          |
|------------|-----------------------|------------------------------------|
| `sortField`| `string`              | Campo pelo qual a tabela está ordenada |
| `sortDir`  | `"asc" \| "desc"`     | Direção da ordenação               |

Valor inicial: ordenar por `"nome"` de forma ascendente.

---

## 3. Handler de Ordenação

```tsx
const handleSort = (field: string) => {
  if (sortField === field) {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  } else {
    setSortField(field);
    setSortDir("asc");
  }
};
```

**Comportamento:**
- Clicar na mesma coluna → inverte a direção
- Clicar em outra coluna → ordena por ela em ascendente

---

## 4. Ordenação dos Dados (useMemo ou inline)

```tsx
const filtradosSorted = [...filtrados].sort((a, b) => {
  let va = "", vb = "";
  switch (sortField) {
    case "nome":              va = a.nome || "";              vb = b.nome || "";              break;
    case "unidade":           va = a.unidade || "";           vb = b.unidade || "";           break;
    case "unidade_escolar":   va = a.unidade_escolar || "";   vb = b.unidade_escolar || "";   break;
    case "estado_nutricional": va = a.estado_nutricional || ""; vb = b.estado_nutricional || ""; break;
    case "extra":             va = a.raca || "";              vb = b.raca || "";              break;
    default:                  va = a.nome || "";              vb = b.nome || "";              break;
  }
  const cmp = va.localeCompare(vb, "pt-BR", { sensitivity: "base" });
  return sortDir === "asc" ? cmp : -cmp;
});
```

**Pontos-chave:**
- Copia o array (`[...filtrados]`) para não mutar o original
- `localeCompare` com `"pt-BR"` para ordenação correta de acentos (Á, ã, ç)
- `sensitivity: "base"` ignora diferenças de maiúsculas
- Retorna `cmp` ou `-cmp` dependendo da direção

---

## 5. Renderização do Cabeçalho (Desktop)

```tsx
<th
  className="cursor-pointer select-none"
  onClick={() => handleSort("nome")}
>
  <div className="flex flex-col items-center gap-1.5">
    <span className="text-[11px] font-black uppercase tracking-widest">
      Paciente
    </span>

    {/* Seta indicadora — só aparece na coluna ativa */}
    {sortField === "nome" && (
      <svg
        className={`h-2.5 w-2.5 transition-all duration-300 ${
          sortDir === "desc" ? "rotate-180" : ""
        }`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 15.75l7.5-7.5 7.5 7.5"
        />
      </svg>
    )}
  </div>
</th>
```

**Estrutura visual do `<th>`:**

```
┌──────────────────────┐
│     [Ícone SVG]      │  ← ícone temático da coluna
│     NOME DA COLUNA   │  ← label em caixa alta
│         ▲            │  ← seta (só aparece se ativa)
└──────────────────────┘
```

- `cursor-pointer select-none` → feedback visual de clicável
- A seta usa `rotate-180` via Tailwind para inverter quando descendente
- `transition-all duration-300` → animação suave na troca

---

## 6. Renderização Mobile (cards)

No mobile, os dados são exibidos em cards. A ordenação é a mesma — o `filtradosSorted` já está ordenado antes do render.

```tsx
{filtradosSorted.map((p) => (
  <div key={p.id} className="rounded-xl border bg-white p-3">
    <p className="font-bold">{p.nome}</p>
    <p className="text-xs text-slate-500">{p.unidade}</p>
  </div>
))}
```

Não é necessário código adicional para ordenação no mobile — basta usar o array já ordenado.

---

## 7. Paginação

A paginação é aplicada **depois** da ordenação:

```tsx
const porPagina = 10;
const totalPaginas = Math.max(1, Math.ceil(filtradosSorted.length / porPagina));
const paginaAtual = filtradosSorted.slice(
  (pagina - 1) * porPagina,
  pagina * porPagina
);
```

---

## 8. Reset de Página

Ao alterar filtros ou busca, a página deve voltar para 1:

```tsx
useEffect(() => {
  setPagina(1);
}, [busca, filtro, filtroUnidade, filtroEquipe, /* ... */]);
```

---

## 9. Checklist de Implementação

Para adicionar ordenação em uma nova tabela:

- [ ] Criar states `sortField` e `sortDir`
- [ ] Criar handler `handleSort(field)`
- [ ] Implementar lógica de `.sort()` com `localeCompare`
- [ ] Adicionar `onClick={() => handleSort("campo")}` no `<th>`
- [ ] Adicionar ícone de seta condicional no `<th>`
- [ ] Adicionar classes `cursor-pointer select-none` no `<th>`
- [ ] Aplicar paginação sobre o array ordenado
- [ ] Garantir que filtros resetam a página para 1
- [ ] Testar com caracteres acentuados (Á, ã, ç, etc.)
- [ ] Testar mobile (cards usam o mesmo array ordenado)

---

## 10. Campos Ordenáveis (referência)

| Campo                  | Tipo de dado | Comparação     |
|------------------------|-------------|----------------|
| `nome`                 | string      | `localeCompare`|
| `unidade`              | string      | `localeCompare`|
| `unidade_escolar`      | string      | `localeCompare`|
| `estado_nutricional`   | string      | `localeCompare`|
| `raca` (via `extra`)   | string      | `localeCompare`|

Para adicionar ordenação numérica (ex: idade, dias), substituir `localeCompare` por comparação aritmética:

```tsx
case "idade":
  va = String(a.idade || 0);
  vb = String(b.idade || 0);
  cmp = Number(va) - Number(vb);
  break;
```

---

## 11. Notas de Implementação

- **`localeCompare("pt-BR")`** é essencial para ordenação correta em português
- Usar `|| ""` nos valores para evitar `undefined` na comparação
- O `switch` permite mapear campos internos para colunas visuais (ex: `extra` → `raca`)
- A animação da seta (`rotate-180` com `transition-all`) melhora a experiência do usuário
- Não usar `Array.sort()` diretamente no array original — sempre copiar primeiro
