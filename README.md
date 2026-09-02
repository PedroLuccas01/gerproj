# PDEF Soft

Gestão de projetos para empresas de automação industrial — do planejamento à entrega.

## Rodar local

1. Copie `.env.example` para `.env.local` e preencha:
   - `DATABASE_URL` — connection string do Neon (preferir a **Direct / unpooled** para `prisma db push`)
   - `AUTH_SECRET` — segredo longo para o cookie de sessão
2. Instale as dependências e crie as tabelas no banco:

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

O primeiro acesso é pela tela **Cadastrar**. Projetos, tarefas, colaboradores e clientes passam a ser gravados no PostgreSQL (Neon).
