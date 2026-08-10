# Instalação da Evolution API na VPS

**VPS:** Locaweb, 2 vCPU, 2 GB de RAM, 60 GB SSD, mensal, contratada em 10/08/2026.
**Serve a:** D-071, o WhatsApp publicando sozinho.

Este arquivo é o passo a passo do terminal. Cada bloco é para colar inteiro,
na ordem, conectado à VPS por SSH. Onde aparece `SEU_IP`, troque pelo IP do
servidor — e onde aparece uma senha, gere a sua, nunca use a do exemplo.

---

## 0. O que este servidor roda, e o que ele não roda

Roda **uma** coisa: a Evolution API, que é a camada REST sobre o Baileys, com
Postgres e Redis ao lado. É ela que mantém a sessão do WhatsApp aberta, como um
WhatsApp Web que nunca fecha.

**Não** roda o publicador (que vive no GitHub Actions), nem o painel (que vive
na Vercel), nem o banco do Radar (que vive no Supabase). Os dois primeiros
apenas *chamam* esta VPS por HTTPS.

Consequência prática: o gargalo aqui é RAM por chip, não tráfego. Um chip
servindo oito grupos consome o mesmo que servindo um.

---

## 1. Entrar e atualizar

```bash
ssh root@SEU_IP
apt update && apt upgrade -y
```

## 2. Swap, que é a rede de segurança dos 2 GB

Sem swap, um pico de memória faz o kernel matar o processo mais gordo — que
seria a Evolution. **Instância morta é sessão do WhatsApp caída**, e reconexão
em série é o padrão que marca o número. 2 GB de swap custam disco, que sobra.

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

O `free -h` no fim deve mostrar 2,0Gi na linha `Swap`.

## 3. Docker

```bash
curl -fsSL https://get.docker.com | sh
docker compose version
```

## 4. Firewall

Só três portas abertas. A Evolution **não** fica exposta: quem fala com o mundo
é o Caddy, na 443.

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

## 5. O subdomínio

O endereço é **`zap.4yu.com.br`**, um subdomínio do domínio que já existe.

**Isso não encosta no site que já está no ar.** O site responde em `4yu.com.br`
e `www.4yu.com.br`, que são outros registros. Subdomínio é entrada nova na zona
de DNS, não alteração das existentes.

No painel de DNS do `4yu.com.br`, crie **um** registro:

| Tipo | Nome | Valor | TTL |
|---|---|---|---|
| A | `zap` | o IP da VPS | 300 |

TTL de 300 segundos de propósito: se você errar o IP, o conserto propaga em
cinco minutos em vez de horas. Depois de funcionando, pode subir para 3600.

**Confira antes de seguir**, do seu computador:

```bash
nslookup zap.4yu.com.br
```

Só continue quando ele devolver o IP da VPS. O Caddy pede o certificado ao
Let's Encrypt na primeira subida, e pedido com DNS errado gasta tentativa: são
5 falhas por hora por domínio, e depois disso você espera.

> Nome neutro de propósito. `zap` não diz o que roda ali, e o endereço vai
> ficar registrado em log de terceiro toda vez que o painel ou o Actions
> chamarem.

## 6. Os arquivos

```bash
mkdir -p /opt/evolution && cd /opt/evolution
```

### 6.1 Gerar os dois segredos

**Rode isto e guarde a saída no seu gerenciador de senhas.** A apikey vai depois
para as variáveis de ambiente da Vercel e do GitHub Actions. Ela não entra em
arquivo nenhum do repositório, que é público.

```bash
echo "APIKEY=$(openssl rand -hex 32)"
echo "PGPASS=$(openssl rand -hex 16)"
```

### 6.2 `Caddyfile`

O endereço já é o final — só confirme que o DNS do passo 5 propagou.

```bash
cat > /opt/evolution/Caddyfile <<'FIM'
zap.4yu.com.br {
    reverse_proxy api:8080
}
FIM
```

### 6.3 `.env`

Troque `COLE_A_APIKEY` e `COLE_A_PGPASS` pelos valores gerados em 6.1.

```bash
cat > /opt/evolution/.env <<'FIM'
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=https://zap.4yu.com.br

AUTHENTICATION_API_KEY=COLE_A_APIKEY
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=false

DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:COLE_A_PGPASS@postgres:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=evolution

# A sessão precisa persistir, senão o QR Code é pedido a cada reinício.
DATABASE_SAVE_DATA_INSTANCE=true

# TUDO O MAIS FICA DESLIGADO, e por dois motivos que se somam:
#
#   1. RAM e disco. Guardar histórico de conversa e agenda de contatos é o
#      que faz uma instância da Evolution engordar sem limite. Desligado,
#      dois chips cabem nos 2 GB.
#   2. Regra 3.8, LGPD. O projeto não guarda dado pessoal de membro de
#      grupo. Ligar isto encheria o banco de nome e telefone de gente que
#      nunca consentiu com nada.
#
# Nada disso é usado pelo Radar: a gente publica e lê o id da mensagem.
DATABASE_SAVE_DATA_NEW_MESSAGE=false
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_CHATS=false
DATABASE_SAVE_DATA_LABELS=false
DATABASE_SAVE_DATA_HISTORIC=false
DATABASE_SAVE_IS_ON_WHATSAPP=false

CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379/6
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false

LOG_LEVEL=ERROR,WARN,INFO
LOG_BAILEYS=error

POSTGRES_PASSWORD=COLE_A_PGPASS
FIM

chmod 600 /opt/evolution/.env
```

### 6.4 `docker-compose.yml`

```bash
cat > /opt/evolution/docker-compose.yml <<'FIM'
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [evolution-net]

  api:
    image: evoapicloud/evolution-api:latest
    restart: unless-stopped
    depends_on: [postgres, redis]
    env_file: .env
    volumes:
      - evolution_instances:/evolution/instances
    expose:
      - "8080"
    networks: [evolution-net]

  # O Manager é a tela onde se lê o QR Code. Ele NÃO é exposto à internet —
  # só escuta em 127.0.0.1, e se alcança por túnel SSH (passo 8). Painel de
  # administração aberto é convite, e este aqui controla o WhatsApp.
  manager:
    image: evoapicloud/evolution-manager:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:80"
    networks: [evolution-net]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - evolution_redis:/data
    networks: [evolution-net]

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: evolution
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [evolution-net]

volumes:
  evolution_instances:
  evolution_redis:
  postgres_data:
  caddy_data:
  caddy_config:

networks:
  evolution-net:
    driver: bridge
FIM
```

## 7. Subir

```bash
cd /opt/evolution
docker compose up -d
docker compose ps
```

Espere um minuto e teste de fora, do seu computador:

```bash
curl -s https://zap.4yu.com.br | head
```

Se responder algo em JSON, está de pé e o HTTPS funcionou.

## 8. Ler o QR Code

O Manager não está exposto, então o túnel abre a porta só para você. **No seu
computador**, não na VPS:

```bash
ssh -L 3000:localhost:3000 root@SEU_IP
```

Com o túnel aberto, acesse `http://localhost:3000` no navegador. Ele pede o
endereço da API (`https://zap.4yu.com.br`) e a apikey.

Crie a instância com um nome que não muda: **`radar01`**. É ele que vai para
`bot.instancia` no banco. Leia o QR Code com o celular do chip.

Fechar o terminal do `ssh -L` fecha o túnel. A Evolution continua rodando.

## 9. O que me mandar depois

1. A confirmação de que `https://zap.4yu.com.br` respondeu
2. O nome da instância, se não for `radar01`
3. O JID do grupo Beauty, que sai de `GET /group/fetchAllGroups/radar01`

**Não me mande a apikey.** Ela vai direto por você para as variáveis de
ambiente da Vercel e para os secrets do GitHub Actions, com o nome
`WHATSAPP_API_KEY`.

---

## Manutenção

**Ver o consumo:** `docker stats --no-stream`
**Ver os logs:** `docker compose logs -f api`
**Reiniciar:** `docker compose restart api`
**Atualizar:** `docker compose pull && docker compose up -d`

**Quando um chip cair**, a instância aparece desconectada e não volta pelo QR.
O caminho é criar uma instância nova (`radar02`) para o chip novo e apontar o
canal para o bot novo — não reaproveitar o registro, senão o histórico de qual
chip publicou o quê se perde.
