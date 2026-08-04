// Leitura, só leitura: o que cada canal publicou de verdade.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(url, chave, { auth: { persistSession: false } });

const { data: canais } = await db
  .from("canal")
  .select("id, nome, plataforma, ativo, posts_por_dia_max, membros_estimados");

const { data: nichos } = await db.from("nicho").select("id, slug, nome");
const nichoPorId = new Map(nichos.map((n) => [n.id, n.slug]));

const { data: canalNicho } = await db.from("canal_nicho").select("canal_id, nicho_id");
const { data: canalAtributo } = await db
  .from("canal_atributo")
  .select("canal_id, atributo, valores, modo");

const { data: pubs } = await db
  .from("publicacao")
  .select("id, canal_id, estado, enviada_em, preco_na_fila_centavos, mensagem, oferta_id")
  .eq("estado", "enviada")
  .order("enviada_em", { ascending: false })
  .limit(1200);

const ofertaIds = [...new Set(pubs.map((p) => p.oferta_id))];
const ofertas = [];
for (let i = 0; i < ofertaIds.length; i += 200) {
  const { data } = await db
    .from("oferta")
    .select("id, anuncio_id, nota, desconto_pct, preco_atual_centavos, dias_de_serie, pode_afirmar_minimo")
    .in("id", ofertaIds.slice(i, i + 200));
  ofertas.push(...data);
}
const ofertaPorId = new Map(ofertas.map((o) => [o.id, o]));

const anuncioIds = [...new Set(ofertas.map((o) => o.anuncio_id))];
const anuncios = [];
for (let i = 0; i < anuncioIds.length; i += 200) {
  const { data } = await db
    .from("anuncio")
    .select("id, produto_id, marketplace_id, vendedor, avaliacao, avaliacao_qtd, reputacao_vendedor")
    .in("id", anuncioIds.slice(i, i + 200));
  anuncios.push(...data);
}
const anuncioPorId = new Map(anuncios.map((a) => [a.id, a]));

const produtoIds = [...new Set(anuncios.map((a) => a.produto_id))];
const produtos = [];
for (let i = 0; i < produtoIds.length; i += 200) {
  const { data } = await db
    .from("produto")
    .select("id, titulo_canonico, categoria, nicho_id, atributos, nota_curador")
    .in("id", produtoIds.slice(i, i + 200));
  produtos.push(...data);
}
const produtoPorId = new Map(produtos.map((p) => [p.id, p]));

const saida = {};
for (const c of canais) {
  saida[c.nome] = {
    canal: c,
    nichos: canalNicho.filter((x) => x.canal_id === c.id).map((x) => nichoPorId.get(x.nicho_id)),
    filtros: canalAtributo.filter((x) => x.canal_id === c.id),
    publicacoes: [],
  };
}
for (const p of pubs) {
  const o = ofertaPorId.get(p.oferta_id);
  const a = o ? anuncioPorId.get(o.anuncio_id) : null;
  const pr = a ? produtoPorId.get(a.produto_id) : null;
  const canal = canais.find((c) => c.id === p.canal_id);
  if (!canal) continue;
  saida[canal.nome].publicacoes.push({
    quando: p.enviada_em,
    titulo: pr?.titulo_canonico ?? "?",
    preco: (p.preco_na_fila_centavos / 100).toFixed(2),
    desconto: o?.desconto_pct,
    nicho: pr ? nichoPorId.get(pr.nicho_id) : null,
    genero: pr?.atributos?.GENDER ?? null,
    vendedor: a?.vendedor ?? null, avaliacao: a?.avaliacao ?? null, avaliacao_qtd: a?.avaliacao_qtd ?? null, categoria: pr?.categoria ?? null,
    nota_curador: pr?.nota_curador ?? null,
    mensagem: p.mensagem,
  });
}

console.log(JSON.stringify(saida, null, 1));
