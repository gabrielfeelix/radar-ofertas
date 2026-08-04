import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await db.from("canal").select("nome, horarios_permitidos, posts_por_dia_max, membros_estimados");
console.log(JSON.stringify(data, null, 1));
const { data: m } = await db.from("modelo_mensagem").select("nome, canal_id, corpo, lastro_com, lastro_sem, nota_prefixo");
console.log(JSON.stringify(m, null, 1));
