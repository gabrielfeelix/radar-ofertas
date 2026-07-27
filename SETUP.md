# Setup — passo a passo

Guia para o Gabriel, não para o agente. Ordem importa: cada passo depende do anterior.

Tempo total: cerca de 40 minutos, sendo boa parte espera de download.

---

## 1. Instalar o que falta

Baixe e instale nesta ordem:

**Node.js** — versão LTS, em [nodejs.org](https://nodejs.org). É o que roda o Next.js. O instalador já traz o `npm` junto.

**Git** — em [git-scm.com](https://git-scm.com). No Windows, aceite todas as opções padrão. Ele é o motor; o GitHub Desktop é só a interface por cima.

**GitHub Desktop** — em [desktop.github.com](https://desktop.github.com). Abra e faça login com sua conta do GitHub. Se ainda não tem conta, crie em [github.com](https://github.com) antes.

Para conferir que deu certo, abra o terminal (no Windows, `cmd` ou PowerShell) e rode:

```
node --version
git --version
```

Se os dois responderem com um número de versão, está pronto. Se disser "comando não encontrado", feche e reabra o terminal — o instalador só aparece em janelas novas.

---

## 2. Criar o repositório

Faça isso pelo GitHub Desktop, não pelo site. Assim a pasta local e o repositório nascem já conectados e você pula a parte chata.

1. Abra o GitHub Desktop.
2. Menu **File → New repository**.
3. Preencha:
   - **Name:** `radar-ofertas` (ou o nome que preferir, sem espaços nem acentos)
   - **Local path:** onde a pasta vai ficar no seu PC. Anote esse caminho.
   - **Initialize with a README:** deixe **desmarcado** — o README já vem no starter.
   - **Git ignore:** deixe **None** — o `.gitignore` já vem pronto e é mais completo.
   - **License:** None.
4. Clique em **Create repository**.

O GitHub Desktop criou a pasta no seu PC, mas ela ainda **não existe no github.com**. Isso é o passo 5.

---

## 3. Colocar os arquivos do starter na pasta

Descompacte o zip que recebeu e mova **todo o conteúdo de dentro** da pasta `radar-ofertas` para a pasta que o GitHub Desktop criou. Não mova a pasta inteira para dentro dela — só o conteúdo.

No fim, a pasta do repositório deve ter, no primeiro nível: `AGENTS.md`, `CLAUDE.md`, `README.md`, `SETUP.md`, `.gitignore`, `.env.example`, e as pastas `docs/` e `.agents/`.

Atenção no Windows: arquivos que começam com ponto (`.gitignore`, `.env.example`, `.agents`) ficam ocultos por padrão. No Explorador de Arquivos, vá em **Exibir → Mostrar → Itens ocultos** antes de mover, senão você deixa os mais importantes para trás.

Volte ao GitHub Desktop. Ele deve listar todos os arquivos como alterações pendentes.

---

## 4. Primeiro commit

No GitHub Desktop, no canto inferior esquerdo:

1. Confira a lista de arquivos. **Se aparecer qualquer `.env` (sem o `.example`), pare** — significa que o `.gitignore` não foi copiado. Copie o `.gitignore` primeiro e confira de novo.
2. No campo **Summary**, escreva: `estrutura inicial e documentacao do projeto`
3. Clique em **Commit to main**.

---

## 5. Publicar no GitHub — **como privado**

Clique em **Publish repository**, no topo.

Vai abrir uma janela com uma caixa de seleção escrita **"Keep this code private"**.

**Deixe essa caixa marcada.** Ela vem marcada por padrão, mas confira com atenção.

O motivo é concreto: este repositório vai conter, ao longo do tempo, seus IDs de afiliado e a lógica de curadoria. Repositório público com chave vazada é varrido por bot em questão de minutos. E repositório público não impede ninguém de copiar seu sistema.

Clique em **Publish repository**. Pronto — o código está no github.com, privado.

---

## 6. Abrir no Antigravity

Abra o Antigravity e use **Open Folder**, apontando para a pasta do repositório.

Ele deve carregar o `AGENTS.md` da raiz automaticamente. Se por algum motivo não carregar, as mesmas regras estão em `.agents/rules/00-projeto.md`, que é o caminho documentado oficialmente — deixei os dois de propósito porque as fontes divergem sobre qual dos dois a versão atual lê.

**Primeira coisa a dizer para o agente:**

> Leia o AGENTS.md e o docs/roadmap.md. Me diga em que fase estamos, o que é o critério de conclusão dessa fase, e qual o próximo passo concreto. Não escreva código ainda.

Se ele responder "Fase 0, prova de rastreio, e o próximo passo é criar as contas de afiliado e testar o subid" — o contexto carregou certo. Se ele começar a escrever código de painel, o arquivo não foi lido; cole o conteúdo do `AGENTS.md` direto no chat e siga.

---

## 7. Criar o projeto no Supabase

Só na Fase 1. Não faça agora.

Quando chegar a hora: crie o projeto em [supabase.com](https://supabase.com), copie a URL e as chaves em **Project Settings → API**, e rode `cp .env.example .env` na pasta do projeto para preencher com os valores reais.

O `.env` fica só no seu PC. Ele nunca aparece no GitHub Desktop porque está no `.gitignore` — se um dia aparecer, alguma coisa quebrou e você precisa parar e conferir.

---

## Rotina do dia a dia

Trabalhou no projeto e quer salvar? No GitHub Desktop: escreva um resumo curto do que mudou, **Commit to main**, e depois **Push origin**. Sem push, o trabalho fica só no seu PC.

Faça isso ao fim de cada sessão. Commit é ponto de retorno — se o agente quebrar alguma coisa, você volta para o último commit e não perde o dia.

---

## Se algo der errado

**O agente ignora as regras do AGENTS.md.** Cole o conteúdo do arquivo direto no chat no começo da sessão. Funciona sempre, só é mais chato.

**Apareceu `.env` na lista de alterações.** Pare. Confirme que o `.gitignore` está na raiz da pasta e contém a linha `.env`. Se você já commitou o `.env` por acidente, avise — remover do histórico exige um procedimento específico e as chaves precisam ser trocadas de qualquer forma.

**Push recusado.** Normalmente é autenticação. No GitHub Desktop, **File → Options → Accounts** e faça login de novo.

**Não sei se está tudo certo.** Peça para o agente: "confira a estrutura do repositório contra o que o README descreve e me diga o que está faltando".
