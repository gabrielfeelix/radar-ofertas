/**
 * Quem ganha as vagas da coleta do dia.
 *
 * POR QUE ISTO EXISTE. O feed da Shopee traz 110 mil itens e uns 20 mil
 * passam nas comportas de desconto e nota. Gravar todos custaria horas
 * de execução e centenas de milhares de chamadas ao banco, então existe
 * um teto (`SHOPEE_MAX_ITENS`, 4.000). **O critério de corte era o maior
 * desconto, e só.**
 *
 * O QUE ISSO CUSTAVA, medido no feed de 04/08:
 *
 * ```
 * 20.082 candidatos passaram nas comportas
 * os 4.000 de maior desconto:
 *   em nicho com canal ........ 1.541  (39%)
 *   com reputação de vendedor . 3.049  (76%)
 *   aproveitáveis de fato ..... 1.231  (31%)
 * ```
 *
 * Dois terços da cota diária iam para item que **não tem como virar
 * post**: ou é de um nicho onde não existe canal, ou chega sem
 * `shop_rating` e a comporta `vendedor_desconhecido` reprova sempre.
 *
 * Enquanto isso o canal de perfume recebia **9 itens por dia** tendo 121
 * disponíveis, e o de pet recebia 113 tendo 812.
 *
 * É O MESMO DEFEITO QUE O MERCADO LIVRE TEVE EM 01/08, e vale reler o
 * registro dele: *"a descoberta gastava as 600 vagas por ordem de lista.
 * As primeiras raízes enchiam o teto e Brinquedos, Bebês e Beleza não
 * recebiam nada"*. A saída lá foi rodízio, um balde por raiz. É a mesma
 * saída aqui.
 *
 * A REGRA, em três linhas:
 *
 * 1. Quem chega sem reputação de vendedor não entra, porque a comporta
 *    reprova depois de qualquer jeito. Isso respeita
 *    `reputacao_nula_reprova`: se o dono desligar a comporta, o filtro
 *    aqui se desliga junto.
 * 2. Nicho que tem canal é servido primeiro, em rodízio, um de cada vez,
 *    do maior desconto para o menor dentro de cada nicho.
 * 3. **Sobrando vaga, os outros nichos entram**, também em rodízio. Isso
 *    não é generosidade: o dono quer abrir canal de casa e de moda, e
 *    catálogo que parou de ser atualizado nasce morto.
 *
 * MORA EM `lib/` E NÃO NO SCRIPT porque `pnpm verifica` não olha
 * `scripts/` — nem tipo, nem lint. Mesma razão de `lib/falha-de-link.ts`
 * e `lib/revalida-preco.ts`.
 */

export type CandidatoDaColeta = {
  /** `{loja}.{item}`, que é como o SKU da Shopee é guardado. */
  sku: string;
  /** O slug do nicho. Candidato sem nicho não chega aqui. */
  nicho: string;
  /** Do maior para o menor dentro do nicho. */
  desconto: number;
  /** A loja informou `shop_rating`? */
  temReputacao: boolean;
};

export type RegrasDaCota = {
  teto: number;
  /** Os slugs de nicho que têm ao menos um canal recebendo. */
  nichosComCanal: Set<string>;
  /** `reputacao_nula_reprova = 1`. Desligado, o filtro de reputação some. */
  exigeReputacao: boolean;
};

export type ResultadoDaCota<T> = {
  escolhidos: T[];
  /** Quantos caíram por cada motivo, para o log dizer o que fez. */
  descartados: {
    sem_reputacao: number;
    duplicado_entre_feeds: number;
    sem_vaga_com_canal: number;
    sem_vaga_sem_canal: number;
  };
  /** Quantos escolhidos por nicho, na ordem de quem recebeu mais. */
  porNicho: Record<string, number>;
};

/**
 * Um de cada nicho por vez, até acabar a vaga ou acabar o candidato.
 *
 * A ordem dos nichos é alfabética e não por tamanho, de propósito:
 * ordenar por tamanho devolveria o comportamento que este arquivo
 * existe para corrigir, com o nicho grande servido primeiro.
 */
function rodizio<T extends CandidatoDaColeta>(
  grupos: Map<string, T[]>,
  vagas: number,
): { escolhidos: T[]; sobraram: number } {
  const nichos = [...grupos.keys()].sort();
  const escolhidos: T[] = [];
  let sobraram = 0;
  for (const lista of grupos.values()) sobraram += lista.length;

  let rodada = 0;
  let algumTinha = true;
  while (escolhidos.length < vagas && algumTinha) {
    algumTinha = false;
    for (const nicho of nichos) {
      if (escolhidos.length >= vagas) break;
      const lista = grupos.get(nicho);
      if (!lista || rodada >= lista.length) continue;
      escolhidos.push(lista[rodada]);
      sobraram--;
      algumTinha = true;
    }
    rodada++;
  }

  return { escolhidos, sobraram };
}

export function escolheCota<T extends CandidatoDaColeta>(
  candidatos: T[],
  regras: RegrasDaCota,
): ResultadoDaCota<T> {
  const descartados = {
    sem_reputacao: 0,
    duplicado_entre_feeds: 0,
    sem_vaga_com_canal: 0,
    sem_vaga_sem_canal: 0,
  };

  /*
    O MESMO ITEM PODE ESTAR NOS DOIS FEEDS, e só o grande tem
    `shop_rating`. Deduplicar preferindo quem tem reputação evita jogar
    fora um item bom porque a cópia sem nota apareceu primeiro.
  */
  const porSku = new Map<string, T>();
  for (const c of candidatos) {
    const jaTem = porSku.get(c.sku);
    if (!jaTem) {
      porSku.set(c.sku, c);
      continue;
    }
    descartados.duplicado_entre_feeds++;
    if (!jaTem.temReputacao && c.temReputacao) porSku.set(c.sku, c);
  }

  /*
    SEM REPUTAÇÃO NÃO ENTRA, porque `vendedor_desconhecido` reprova
    depois. Gravar assim mesmo é gastar vaga e escrita para produzir
    uma reprovação garantida.

    O feed pequeno da Shopee **não tem a coluna** `shop_rating`, então
    na prática isto o descarta quase inteiro. É o comportamento certo
    hoje: nenhum item dele chega a publicar. Se um dia ele voltar a
    valer, por causa de `global_item_attributes` (D-064, item 2.2), a
    saída é enriquecer a reputação pela API antes de gravar, e não
    afrouxar a comporta.
  */
  const vivos: T[] = [];
  for (const c of porSku.values()) {
    if (regras.exigeReputacao && !c.temReputacao) {
      descartados.sem_reputacao++;
      continue;
    }
    vivos.push(c);
  }

  const agrupa = (lista: T[]) => {
    const m = new Map<string, T[]>();
    for (const c of lista) {
      const atual = m.get(c.nicho);
      if (atual) atual.push(c);
      else m.set(c.nicho, [c]);
    }
    // Dentro do nicho, o maior desconto primeiro. É o critério antigo,
    // que continua certo — ele só não podia ser o critério global.
    for (const lista of m.values()) lista.sort((a, b) => b.desconto - a.desconto);
    return m;
  };

  const comCanal = agrupa(vivos.filter((c) => regras.nichosComCanal.has(c.nicho)));
  const semCanal = agrupa(vivos.filter((c) => !regras.nichosComCanal.has(c.nicho)));

  const primeiro = rodizio(comCanal, regras.teto);
  descartados.sem_vaga_com_canal = primeiro.sobraram;

  const vagasQueSobraram = regras.teto - primeiro.escolhidos.length;
  const segundo = rodizio(semCanal, Math.max(0, vagasQueSobraram));
  descartados.sem_vaga_sem_canal = segundo.sobraram;

  const escolhidos = [...primeiro.escolhidos, ...segundo.escolhidos];

  const porNicho: Record<string, number> = {};
  for (const c of escolhidos) porNicho[c.nicho] = (porNicho[c.nicho] ?? 0) + 1;

  return { escolhidos, descartados, porNicho };
}
