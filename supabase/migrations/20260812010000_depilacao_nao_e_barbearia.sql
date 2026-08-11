-- =============================================================
-- 72 · Depilação não é barbearia
--
-- Conserta a migration 71, medida minutos depois de aplicá-la. Dos 96
-- produtos que ela marcou, SEIS eram de mulher:
--
--   Caneta Depiladora Elétrica Feminina Sobrancelha Facial ... Aparador
--   De Pelos Rosto Buço                                    (três cores)
--   Depiladora 3 em 1 Recarregável, Aparador de Pelos, Design Íntimo
--   KIT 36 Lâminas Sobrancelha e Rosto Navalha Depilação
--   KIT 2 NAVALHA + 1 TESOURA PENTE, Kit para aparar sobrancelhas
--
-- "APARADOR DE PELOS" E "NAVALHA" SÃO AS DUAS PALAVRAS QUE A BARBEARIA
-- MASCULINA E A DEPILAÇÃO FEMININA USAM IGUAL. É a mesma armadilha do
-- "celular" da migration 67 e do "litro" da 56: a palavra não é o
-- sinal, a palavra dentro de um contexto é.
--
-- A regra viva passou a ter dois níveis (`lib/eletronico-em-beleza.ts`):
-- `barbear` e `cortar cabelo` decidem sozinhos e nada os desarma;
-- `aparador de pelos` e `navalha` sozinhos perdem para depilação.
--
-- O caso que prova que os dois níveis são necessários e está nos testes:
-- *"Maquina De Cortar Cabelo Barbear ... Depilador Intimo Masculino"*
-- tem `depilador` no título e continua sendo barbearia.
-- =============================================================

update public.produto p
   set atributos = p.atributos - 'TIPO',
       atualizado_em = now()
 where (p.atributos ->> 'TIPO') = 'barbearia'
   -- É de depilação, de sobrancelha ou de buço...
   and lower(p.titulo_canonico) ~ '(depilad|depilar|depilac|depilaç|depilat|sobrancelha|epilador|buco|buço|design [íi]ntimo|venus)'
   -- ...e não tem sinal forte de barbearia, que ganha de tudo.
   and lower(p.titulo_canonico) !~ '(barbear|barbeador|maquina de cortar cabelo|máquina de cortar cabelo|cortador de cabelo|maquina de acabamento|máquina de acabamento|gilete|multigroomer|barba e cabelo|aparador de barba)';
