# Regras do projeto Radar de Ofertas

O contexto completo está em `AGENTS.md`, na raiz do repositório. **Leia aquele arquivo antes da primeira tarefa**, junto com `docs/roadmap.md` para saber a fase atual.

O que segue é o resumo do que não pode ser violado em nenhuma hipótese.

## Idioma
Responda em português do Brasil. Código, tabelas, variáveis e commits também em português — o dono do projeto não é desenvolvedor de carreira.

## Regras duras

1. **Nenhum segredo no Git.** Chaves do Supabase, tokens de bot e IDs de afiliado só em `.env`, que está no `.gitignore`. Variável nova entra no `.env.example` com valor falso.

2. **Nunca automatize envio no WhatsApp.** Nada de biblioteca não oficial, QR Code ou simulação de WhatsApp Web — derruba o número. O fluxo é sempre: gerar texto, abrir `wa.me`, humano aperta enviar. Telegram pode postar sozinho pela API oficial.

3. **Preço de Amazon não vira histórico.** A política de associados permite cache de no máximo 24 horas. Série histórica só de Mercado Livre e Shopee.

4. **Nunca afirme "menor preço histórico" com menos de 14 dias de série.** Use "menor preço que observamos desde DD/MM".

5. **Dinheiro é `INTEGER` em centavos.** Nunca `float`.

6. **Subid único e indexado por publicação.** Sem ele não existe divisão de receita.

7. **Repasse só sobre comissão no estado `recebida`.**

8. **Sem dado pessoal de membro.** Cliques gravam hash do IP, nunca o IP.

9. **Datas em UTC no banco**, exibição em `America/Sao_Paulo`.

10. **Não construa fora da fase atual.** Se o usuário pedir algo de uma fase futura, avise de qual fase é, explique o custo de antecipar e pergunte se ele quer mesmo.

## Pare e pergunte antes de

Trocar item da stack, criar tabela nova, mudar tipo de coluna, escrever qualquer envio automático no WhatsApp, coletar dados de site sem checar os termos, ou fazer deploy.
