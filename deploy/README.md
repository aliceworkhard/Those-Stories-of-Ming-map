# 独立云服务器 + 专属域名生产环境部署手册 (`deploy/`)

本目录提供开箱即用的 **Docker 多阶段极简镜像 + Caddy 2 自动 HTTPS 网关** 生产级部署套件。一台 **2 核 2G（或 2 核 4G）Linux 云服务器（Ubuntu 22.04 / 24.04 或 Debian 12）** 即可丝滑承载全站三维历史舆图。

---

## 一、服务器选购与域名准备建议

1. **云服务器配置**：
   - 推荐 **2 vCPU / 2 GB~4 GB 内存 / 40 GB SSD**，操作系统选择 **Ubuntu 24.04 LTS**。
   - **备案提示**：若选购中国大陆节点（阿里云/腾讯云/华为云国内地域），绑定域名开放 `80/443` 前需完成 ICP 备案（备案期间可先用 `DOMAIN=:80` 通过公网 IP 直接访问）；若选购中国香港/新加坡/东京等免备案节点，解析域名后 **3 分钟即可自动签发 HTTPS 上线**。
2. **安全组 / 防火墙放行端口**：
   - 在云厂商控制台安全组中放行入站：**`TCP 22`**（SSH）、**`TCP 80`**（HTTP 跳转与证书校验）、**`TCP 443`** 与 **`UDP 443`**（HTTPS / HTTP3 QUIC 加速）。
3. **域名 DNS 解析**：
   - 在域名服务商后台添加一条 **`A` 记录**，将主机记录（如 `@` 或 `ming`）指向云服务器的**公网 IPv4 地址**。

---

## 二、三分钟一键上线步骤

### 1. 安装 Docker 与 Git（全新 Ubuntu 服务器执行一次即可）

```bash
curl -fsSL https://get.docker.com | sh
sudo apt-get update && sudo apt-get install -y git
```

### 2. 克隆仓库并配置域名

```bash
git clone https://github.com/aliceworkhard/Those-Stories-of-Ming-map.git
cd Those-Stories-of-Ming-map/deploy
cp .env.example .env
```

编辑 `.env` 文件，填入你的域名（若暂时只用服务器 IP 测试，填 `DOMAIN=:80`）：

```ini
DOMAIN=ming.yourdomain.com
```

### 3. 一键构建并启动 HTTPS 生产服务

```bash
sh ./deploy.sh
```

（或直接运行 `docker compose up -d --build`）

- Docker 将在构建阶段自动运行 `npm run validate:data`（10 项数据与版权合规校验）并编译 Next.js Standalone 极简生产服务端（运行态内存占用仅约 `~95 MB`）。
- `ming-atlas-web` 通过 `/api/health` 健康检查后，`caddy` 自动向 Let's Encrypt 申请并配置免费 TLS/HTTPS 证书（后续到期自动静默续期，无需人工维护）！

---

## 三、日常更新与运维命令

```bash
# 拉取 GitHub 最新 main 分支代码并零停机重建更新
cd ~/Those-Stories-of-Ming-map/deploy && sh ./deploy.sh

# 查看实时运行日志
docker compose logs -f

# 本机验证健康状态
curl http://127.0.0.1/api/health
```
