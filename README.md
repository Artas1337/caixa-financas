# Caixa — Controle financeiro pessoal

Aplicação full-stack para registrar receitas e despesas, definir orçamentos por categoria e acompanhar a evolução mês a mês num painel com gráficos.

![CI](https://github.com/Artas1337/caixa-financas/actions/workflows/ci.yml/badge.svg)

> Projeto de portfólio — TypeScript de ponta a ponta, API REST testada, gráficos em SVG feitos à mão (sem biblioteca) e paleta validada para daltonismo.

## Funcionalidades

- **Painel do mês:** saldo, receitas e despesas com variação em relação ao mês anterior
- **Gráfico de 6 meses** (receitas × despesas) com tooltip ao passar o mouse
- **Despesas por categoria** com marcador de orçamento e alerta quando estoura
- **Lançamentos:** filtros por tipo, categoria e texto, totais do filtro, edição e exclusão
- **Repetir no próximo mês** com um clique — ideal para contas fixas (ajusta 31/01 → 28/02)
- **Exportação CSV** pronta para Excel (separador `;`, vírgula decimal, BOM UTF-8)
- **Categorias** personalizáveis, com orçamento mensal opcional (só para despesas)
- Cadastro/login com **JWT** + **bcrypt**; dados isolados por usuário
- Layout responsivo e tema claro/escuro automático

## Decisões técnicas

- **Dinheiro em centavos (inteiro).** `0.1 + 0.2 !== 0.3` em ponto flutuante; guardar `amount_cents` evita erros de arredondamento. A formatação para `R$ 1.234,56` acontece só na interface (`Intl.NumberFormat`).
- **Tipo derivado da categoria.** Um lançamento não guarda se é receita ou despesa — herda da categoria, então não existe "despesa em categoria de receita".
- **Consultas por intervalo de datas** (`date >= '2026-10-01' AND date < '2026-11-01'`) para aproveitar o índice `(user_id, date)`, em vez de `strftime` na coluna.
- **Categoria em uso não pode ser excluída** (`ON DELETE RESTRICT` + resposta `409` com mensagem clara).
- **Gráficos em SVG puro:** escala com divisões "redondas", barras com topo arredondado, alvo de hover maior que a barra. Cores de receitas/despesas checadas para contraste e separação em daltonismo (protanopia, deuteranopia, tritanopia).
- **Seed determinístico** gera 6 meses de dados realistas para demonstração.

## Stack

| Camada   | Tecnologias |
|----------|-------------|
| Frontend | React 19, TypeScript, Vite, React Router, CSS com design tokens, gráficos SVG |
| Backend  | Node.js, Express 5, TypeScript, Zod, JWT, bcrypt |
| Banco    | SQLite nativo do Node (`node:sqlite`) |
| Testes   | Vitest + Supertest |
| CI       | GitHub Actions |

## API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` · `/api/auth/login` | Cadastro / login (cria categorias padrão) |
| GET | `/api/summary?month=AAAA-MM` | Totais do mês, mês anterior, por categoria e histórico de 6 meses |
| GET | `/api/transactions?month=&type=&categoryId=&q=` | Lista com filtros |
| POST · PATCH · DELETE | `/api/transactions[/:id]` | CRUD de lançamentos |
| POST | `/api/transactions/:id/repeat` | Copia o lançamento para o mês seguinte |
| GET | `/api/transactions/export.csv` | Exporta CSV com os mesmos filtros |
| GET · POST · PATCH · DELETE | `/api/categories[/:id]` | CRUD de categorias e orçamento |

## Como rodar

Requer **Node.js 22.13+**.

```bash
npm install
npm run seed   # opcional: cria demo@caixa.test / demo123 com 6 meses de dados
npm run dev
```

- Frontend: http://localhost:5174
- API: http://localhost:3334

```bash
npm test        # testes da API
npm run build   # compila API e frontend
```

Variáveis de ambiente (opcionais): `API_PORT`, `DB_FILE` (padrão `data/caixa.db`), `JWT_SECRET` (**defina em produção**).

## Próximos passos

- Lançamentos recorrentes (aluguel, assinaturas)
- Importar extrato bancário (OFX/CSV)
- Metas de economia
- Deploy

---

Feito por **Arthur Martins** · [LinkedIn](https://linkedin.com/in/arthur-martins-2547553b6) · [GitHub](https://github.com/Artas1337)
