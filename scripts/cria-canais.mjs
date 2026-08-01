/**
 * Cadastra os canais de Telegram, com nichos e filtros de atributo.
 *
 * POR QUE ISTO É SCRIPT E NÃO MIGRATION, e a distinção vale para o
 * próximo canal também: nicho, mapeamento de domínio e ramo secundário
 * são CONFIGURAÇÃO — valem para qualquer banco, e por isso vivem em
 * migration. Canal é DADO DE OPERAÇÃO: o `telegram_chat_id` aponta
 * para um grupo real, com gente dentro. Numa migration, todo
 * `supabase db reset` recriaria os seis canais no banco local, e o
 * publicador rodando na máquina do dono mandaria post de teste para os
 * grupos de verdade.
 *
 * Ele é idempotente: casa pelo NOME, atualiza o que mudou e não
 * duplica. Casa pelo nome, e não pelo chat, por um motivo aprendido no
 * mesmo dia — ver abaixo.
 *
 * USO
 *
 *   node --env-file=.env.producao scripts/cria-canais.mjs --seco
 *   node --env-file=.env.producao scripts/cria-canais.mjs
 *
 * O `chat` É O @NOME PÚBLICO, NÃO O ID NUMÉRICO, e isto custou uma
 * rodada para aprender. Os seis grupos nasceram privados, como `group`,
 * e foram cadastrados com o id numérico lido de `getUpdates`. Ao serem
 * abertos ao público, o Telegram os converteu em `supergroup` — e a
 * conversão **troca o id**:
 *
 *   Radar Tech   -5590063497  (group)  →  -1003978161593  (supergroup)
 *
 * O id velho não dá erro claro: o post simplesmente não chega. O @nome
 * público sobrevive à conversão, e é por isso que ele é o identificador
 * daqui em diante. O Radar Pet já usava `@radarpet` por acidente feliz.
 *
 * Se um dia um canal precisar ser privado, aí o id numérico volta a ser
 * o único caminho — e ele sai do evento `my_chat_member`:
 *
 *   curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates"
 *
 * A ETIQUETA PRECISA EXISTIR NA CENTRAL DE AFILIADOS. Inventar uma
 * devolve `Tag is not associated with this affiliate` (código 109) e o
 * canal fica mudo sem link. É ela que atribui a comissão ao canal
 * (D-035).
 */

import { createClient } from "@supabase/supabase-js";

const SECO = process.argv.includes("--seco");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, chave, { auth: { persistSession: false } });

/**
 * Os canais, declarados.
 *
 * `nichos` é o roteamento: a oferta chega ao canal que declara o nicho
 * dela. `filtros` é o recorte fino dentro do nicho, e só o par
 * Beauty/Perfumes precisa dele hoje.
 *
 * O TETO E OS HORÁRIOS ESPELHAM O RADAR PET de propósito. Ele é o
 * único canal com uma madrugada de operação medida, e chutar número
 * diferente para cinco canais novos seria inventar cinco experimentos
 * ao mesmo tempo. Ajuste depois, com dado.
 */
const CANAIS = [
  {
    nome: "Radar Fitness",
    chat: "@radarfitness1",
    etiqueta: "radarfitness",
    nichos: ["esporte", "suplemento"],
    /*
      Suplemento entra junto porque é o miolo do canal, e porque ele já
      é o maior nicho parado da base: 61 produtos com série de preço
      correndo desde 01/08, esperando canal. A raiz "Esportes e
      Fitness" traz o resto — com Windsurfe e Equitação segurados pela
      regra de ramo secundário da migration 37.
    */
  },
  {
    nome: "Radar Tech",
    chat: "@radartech1",
    etiqueta: "radartech",
    nichos: ["eletronico"],
  },
  {
    nome: "Radar Geek",
    chat: "@radargeek1",
    etiqueta: "radargeek",
    /*
      Dois nichos, e é o uso CERTO de "canal aceita vários": eles têm o
      mesmo público. Foi juntar pet, casa e eletrônico num canal só que
      pôs mangueira de jardim no Radar Pet — o defeito era a incoerência
      entre os nichos, não o número deles.
    */
    nichos: ["geek", "games"],
  },
  {
    nome: "Radar Kids",
    chat: "@radarkids",
    etiqueta: "radarkids",
    nichos: ["bebe", "brinquedo"],
  },
  {
    nome: "Radar Beauty",
    chat: "@radarbeauty",
    etiqueta: "radargeral",
    nichos: ["beleza", "perfume"],
    /*
      Perfume virou nicho próprio na migration 37 porque ganhou canal.
      O Beauty continua recebendo o que não for masculino: assim nenhum
      perfume fica sem canal, e nenhum sai repetido nos dois.
    */
    filtros: [{ atributo: "GENDER", valores: ["Masculino"], modo: "exclui" }],
  },
  {
    nome: "Radar Perfumes (masc)",
    chat: "@radarperfumes1",
    etiqueta: "radarperfumes",
    nichos: ["perfume"],
    /*
      "Masculino" não é prateleira do Mercado Livre — é o atributo
      `GENDER`, que ele devolve preenchido. Os outros valores
      observados em 01/08 são Feminino, Meninos, Meninas e Sem gênero.
    */
    filtros: [{ atributo: "GENDER", valores: ["Masculino"], modo: "inclui" }],
  },
];

/** Espelha o Radar Pet, que é o único canal com operação medida. */
const TETO = 50;
const HORARIOS = [7, 12, 20];

async function main() {
  const { data: operacao } = await db.from("operacao").select("id").limit(1).single();
  const { data: nichos } = await db.from("nicho").select("id, slug");
  const idDoNicho = new Map((nichos ?? []).map((n) => [n.slug, n.id]));

  for (const canal of CANAIS) {
    // Nicho que não existe é erro de digitação, e ele precisa doer
    // agora: um canal sem nicho nasce mudo e ninguém descobre por quê.
    const faltando = canal.nichos.filter((s) => !idDoNicho.has(s));
    if (faltando.length > 0) {
      console.error(`✗ ${canal.nome}: nicho inexistente — ${faltando.join(", ")}`);
      console.error("  Aplique as migrations antes (`pnpm db:publica`).");
      process.exitCode = 1;
      continue;
    }

    // Casa pelo NOME. Casar pelo chat parece mais preciso e é pior: o
    // id muda quando o grupo vira supergrupo, e o script criaria um
    // segundo canal com o mesmo nome em vez de corrigir o primeiro.
    // Foi o que quase aconteceu em 01/08, ao abrir os grupos ao público.
    const { data: existente } = await db
      .from("canal")
      .select("id, nome, telegram_chat_id")
      .eq("nome", canal.nome)
      .maybeSingle();

    const campos = {
      operacao_id: operacao.id,
      nome: canal.nome,
      plataforma: "telegram",
      telegram_chat_id: canal.chat,
      etiqueta_afiliado: canal.etiqueta,
      posts_por_dia_max: TETO,
      horarios_permitidos: HORARIOS,
      ativo: true,
    };

    if (SECO) {
      const acao = existente ? "atualizaria" : "criaria";
      const f = (canal.filtros ?? []).map((x) => `${x.atributo} ${x.modo} ${x.valores}`);
      const mudouChat = existente && existente.telegram_chat_id !== canal.chat;
      console.log(
        `  ${acao.padEnd(10)} ${canal.nome.padEnd(24)} ${canal.chat.padEnd(16)} ${canal.etiqueta.padEnd(14)} ` +
          `${canal.nichos.join("+")}${f.length ? ` · ${f}` : ""}${mudouChat ? `  (chat era ${existente.telegram_chat_id})` : ""}`,
      );
      continue;
    }

    let canalId = existente?.id;

    if (canalId) {
      await db.from("canal").update(campos).eq("id", canalId);
    } else {
      const { data: criado, error } = await db.from("canal").insert(campos).select("id").single();
      if (error) {
        console.error(`✗ ${canal.nome}: ${error.message}`);
        process.exitCode = 1;
        continue;
      }
      canalId = criado.id;
    }

    // Nichos e filtros são reescritos por inteiro, e não conciliados:
    // a lista acima é a verdade, e conciliar deixaria resto de uma
    // execução anterior vivo sem que ninguém visse.
    await db.from("canal_nicho").delete().eq("canal_id", canalId);
    await db.from("canal_nicho").insert(
      canal.nichos.map((slug) => ({ canal_id: canalId, nicho_id: idDoNicho.get(slug) })),
    );

    await db.from("canal_atributo").delete().eq("canal_id", canalId);
    if (canal.filtros?.length) {
      await db.from("canal_atributo").insert(
        canal.filtros.map((f) => ({
          operacao_id: operacao.id,
          canal_id: canalId,
          atributo: f.atributo,
          valores: f.valores,
          modo: f.modo,
        })),
      );
    }

    const f = (canal.filtros ?? []).map((x) => `${x.atributo} ${x.modo} ${x.valores.join("/")}`);
    console.log(
      `  ${existente ? "atualizado" : "criado    "} ${canal.nome.padEnd(24)} ${canal.chat.padEnd(16)} ` +
        `${canal.etiqueta.padEnd(14)} ${canal.nichos.join("+")}${f.length ? ` · ${f.join(", ")}` : ""}`,
    );
  }

  console.log(SECO ? "\n(SECO, nada gravado)" : "\npronto");
}

await main();
