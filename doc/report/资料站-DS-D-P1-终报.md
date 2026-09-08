# 资料站 P1 · DS-D 终报(ECS 静态位与 nginx)

仓:`tansr-deploy`(`J:\tansr\deploy` 的 worktree `J:\tansr\worktrees\ds-D`,分支 `lane/ds/D`,基线 main `5e99759`)。落位说明:本仓无 `doc/`,终报落仓根;主线收编时移入 cli 仓 `doc/report/资料站-DS-D-P1-终报.md`。

## 〇 结论一页

- 卡:1 / 1 完成(**DS-14 ECS 静态位与 nginx**);提交 3 + 终报 1 = 4;未 push、未部署、未碰 ECS、未读 `.env`。
- 产出:`nginx/conf.d/docs.conf`(新)· `docker-compose.yml` nginx 只读卷 · `deploy.env` `DOCS_DOMAIN` · `scripts/render-nginx.sh` / `scripts/nginx-cert.sh` / `nginx/Dockerfile` 认 docs · `scripts/docs-init.sh`(新,幂等)· README 四处。
- 门:`nginx -t`(nginx:1.27-alpine,渲染后三站配置 + 三对自签证书)**syntax is ok / test is successful**;运行态 443 → 200、缺页 → 404 且体为 `404.html`、80 → 301、缓存分档与安全头 / CSP 齐、`ln -sfn` 切 `current` 零 reload(nginx 进程 pid 不变);`docs-init.sh` 四场景幂等;`render-nginx.sh` 渲染后占位残留 0、只对缺失证书名自签;`docker compose config` 解析通过。
- 先红:① 无 `docs.conf` 时 Host `docs.tansr.com` 打 443 落 api 默认块 → 502;② `docs.conf` 在而 docs 证书缺 → `nginx -t` 红(钉死 ECS 落地序);③ `docs-init.sh` 前目录不存在。
- 对下游交付:卷形 `/root/tansr/docs:/srv/docs:ro` + `current` **相对**符号链接契约(给 DS-A `scripts/deploy/publish.sh` / `.github/workflows/deploy.yml`);`nginx-cert.sh issue docs` 单站签发形(给主线落 ECS)。
- 代拍 2 项(§六):挂父目录而非挂 `current`;CSP `script-src` 含 `'unsafe-inline'`。
- 未闭合:落 ECS 由主线在 DNS 就位后执行(§四 4.3 逐步命令);渲染后 `docs.conf` 在 ECS 上会变成字面域名形(与 `portal.conf` 同一历史),是否回提交由主线按「生产现实为准」定。

## 一 提交清单

| 卡 | 提交 | 一句话 |
|---|---|---|
| DS-14 | `c21d7e7` | `nginx/conf.d/docs.conf`:80 ACME + 301;443 静态 root `/srv/docs/current` / gzip / map 分档缓存 / 安全头 + CSP;不代理上游;正文含红→绿与运行态探针 |
| DS-14 | `633e560` | compose nginx 卷 `${DOCS_ROOT:-/root/tansr/docs}:/srv/docs:ro` · `deploy.env` `DOCS_DOMAIN` · `render-nginx.sh` / `nginx-cert.sh` / `nginx/Dockerfile` 认 docs · `scripts/docs-init.sh` · README |
| DS-14 | `8d894da` | 本地校验记录(证据提交,`--allow-empty`,无文件变更;收编可 squash) |
| 终报 | (本提交) | `docs-site-DS-D-report.md` |

## 二 逐卡 DoD 对表(DS-14)

doc/134 §二 DS-14 验收:「`nginx -t` 绿;443 回 200;80 → 301;`current` 切换零 reload」。

### 2.1 `nginx -t`(Docker Desktop 29.7.2 · `nginx:1.27-alpine` = nginx/1.27.5)

输入:`nginx/nginx.conf` + `conf.d/{api,portal,docs}.conf`(`${API_DOMAIN}` / `${PORTAL_DOMAIN}` / `${DOCS_DOMAIN}` 按 `render-nginx.sh` 同法替成 `api.tansr.com` / `www.tansr.com` / `docs.tansr.com`)+ 临时自签三对(`openssl req -x509 -nodes -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -days 2 … -subj /CN=<域> -addext subjectAltName=DNS:<域>`)只读挂载;`--add-host api:127.0.0.1 --add-host server:127.0.0.1`(nginx 在配置期解析 upstream 主机名,缺解析 `-t` 即红)。

```text
docker run --rm --add-host api:127.0.0.1 --add-host server:127.0.0.1 \
  -v $T/nginx.conf:/etc/nginx/nginx.conf:ro -v $T/conf.d:/etc/nginx/conf.d:ro \
  -v $T/certs:/etc/nginx/certs:ro -v $T/docs:/srv/docs/current:ro nginx:1.27-alpine nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
exit=0
```

先红:

```text
A) conf.d 无 docs.conf(基线形):-t 绿;curl -k --resolve docs.tansr.com:<p>:127.0.0.1 https://docs.tansr.com:<p>/
   → [code=502] HTTP/1.1 502 Bad Gateway          (落 api.conf 默认块)
B) docs.conf 在、certs 缺 docs 对:
   nginx: [emerg] cannot load certificate "/etc/nginx/certs/docs.fullchain.pem": BIO_new_file() failed (SSL: error:80000002:system library::No such file or directory:calling fopen(/etc/nginx/certs/docs.fullchain.pem, r) error:10000080:BIO routines::no such file)
   nginx: configuration file /etc/nginx/nginx.conf test failed
   exit=1
```

### 2.2 运行态探针(容器只绑 `127.0.0.1` 随机口:80→59912,443→59913;容器内 `/srv/docs/releases/{v1,v2}`,`current → releases/v1`)

| 请求 | 结果 |
|---|---|
| `GET http://docs.tansr.com/` | 301 `Location: https://docs.tansr.com/` |
| `GET http://docs.tansr.com/guide?x=1` | 301 `Location: https://docs.tansr.com/guide?x=1` |
| `GET https://docs.tansr.com/` | 200 text/html(index v1);`Cache-Control: no-cache`;HSTS `max-age=15552000; includeSubDomains` · `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · CSP(见 §三 docs.conf) |
| `GET /guide`(无尾斜杠) | 301 `Location: https://docs.tansr.com/guide/`(nginx 目录规范化;Starlight 链接自带尾斜杠) |
| `GET /nope/deep` | 404,体 = `404.html`(`<h1>DOCS-404-PAGE</h1>`) |
| `GET /_astro/missing.css` | 404,体 = `404.html` |
| `GET /_astro/app.abc123.css` | 200 `Cache-Control: public, max-age=31536000, immutable`;`Accept-Encoding: gzip` → `Content-Encoding: gzip` |
| `GET /pagefind/pagefind-entry.json` | 200 `Cache-Control: no-cache` |
| `GET /pagefind/index/a1b2.pf_index` | 200 `Cache-Control: public, max-age=31536000, immutable` |
| `GET /index.html` | 200 `Cache-Control: no-cache` |
| `docker exec ln -sfn releases/v2 /srv/docs/current` → `GET /` | 体 = index v2;`ln` 回 v1 → index v1;`ps` 各 nginx 进程 pid(1,12–24)与 elapsed 连续不变 → **零 reload** |

完毕 `docker rm -f ds-d-nginx`;临时目录 `%TEMP%\ds-D-nginx` 不入库。

### 2.3 脚本与 compose

- `bash -n scripts/{docs-init,nginx-cert,render-nginx}.sh`(容器内 LF 化副本)→ 三者 syntax ok。
- `render-nginx.sh`(nginx 镜像自带 envsubst):`docs.conf` L6 / L29 / L47 `${DOCS_DOMAIN}` → `docs.tansr.com`;conf.d 三文件残留占位 0;nginx 运行时变量完好(`$uri` ×8、`$host` ×1、`$docs_cache_control` ×2);渲染产物 `nginx -t` 绿。
- `docs-init.sh`(alpine):先红 `ls /tmp/docs: No such file or directory` → RUN1 建目录 + 占位 + `current`;RUN2「current 已存在 → releases/placeholder,不改」;模拟发布 `ln -sfn releases/abc123 current` 后 RUN3「current 已存在 → releases/abc123,不改」;悬空链接后 RUN4 重建 → placeholder;目录 `drwxr-xr-x` / 文件 `-rw-r--r--`。
- `nginx-cert.sh`(alpine + openssl):`self-signed docs` 只产 `docs.{fullchain,privkey}.pem`(CN / SAN = docs.tansr.com,私钥 600);伪造 api / portal「正式」证书 + 删 docs 后 `render-nginx.sh` →「证书缺失: docs」只自签 docs,api / portal 内容不变;三对齐备再跑 → 无自签;`self-signed bogus` →「未知证书名:bogus(支持 api|portal|docs)」。
- `docker compose --env-file <临时假 env> -f docker-compose.yml config` → exit 0,nginx 卷含 `target: /srv/docs`;`--services` = api / server / nginx。

文档 ☑:README 拓扑 / 目录结构 / 证书运维;`docs.conf` 与 compose 卷头注写明「挂父目录」理由;`docs-init.sh` 头注写明相对链接契约。

## 三 改动摘要逐文件

| 路径 | 改了什么 | 为何 |
|---|---|---|
| `nginx/conf.d/docs.conf`(新,100 行) | 80:ACME webroot `/var/www/certbot` + 301;443:`server_name ${DOCS_DOMAIN}`,证书 `/etc/nginx/certs/docs.{fullchain,privkey}.pem`,`root /srv/docs/current`,`index index.html`,`try_files $uri $uri/ $uri/index.html =404`,`error_page 404 /404.html`;server 级 gzip_types 写全(html 恒压 + css/js/json/xml/svg/wasm);`map $uri $docs_cache_control`(`/_astro/*` 与 `/pagefind/*.pf_*` 一年 immutable;`pagefind-entry.json` 与 html / 目录页 no-cache;图片字体 1 天)+ 一处 `add_header Cache-Control`;安全头与 portal 同款 + CSP `default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;`/_astro/` `/pagefind/` 两 location 只 `try_files $uri =404` + `access_log off` | 缓存用 map 而非 location 内 `add_header`:nginx 的 `add_header` 在任一 location 出现即整组覆盖、server 级安全头会丢;server 级 `gzip_types` 同理整组覆盖 http 级,故写全 |
| `docker-compose.yml` | nginx 卷加 `${DOCS_ROOT:-/root/tansr/docs}:/srv/docs:ro`(带理由注释) | 见 §六 1 |
| `deploy.env` | `: "${DOCS_DOMAIN:=docs.tansr.com}"` + export | 脚本 source 用 |
| `scripts/render-nginx.sh` | envsubst 列表(两分支)加 `${DOCS_DOMAIN}`;占位证书检查改「只对缺失名自签」 | 旧形任一缺失即整组重签,生产加 docs 站时会把 api / portal 的 Let's Encrypt 正式证书覆盖成自签 |
| `scripts/nginx-cert.sh` | `self-signed [name…]` / `issue [name…]`,name ∈ api\|portal\|docs,缺省三对(无参 = 原行为 + docs);`.example.com` 占位域名拒签;头注补 docs | 主线只需 `issue docs`;acme.sh 对未到期证书 `--issue` 以 rc=2 跳过,`set -e` 下会中断整脚本,故必须能按名单签 |
| `nginx/Dockerfile` | envsubst 列表与必填检查加 `DOCS_DOMAIN` | 本地模板验证镜像与 render-nginx.sh 同步(§五 2) |
| `scripts/docs-init.sh`(新) | `mkdir -p releases` + 占位 `releases/placeholder/{index,404}.html` + `ln -sfn releases/placeholder current`;`current` 已存在且可解析不改;悬空重建;755 / 644 | 幂等,可反复执行;不会把已发布站点切回占位 |
| `README.md` | 拓扑加资料站一行;目录结构加 `docs.conf` / `docs-init.sh`;证书运维路径含 docs + `issue docs` 用法;render 说明加 `DOCS_DOMAIN` | 派单要求 |

## 四 跨泳道接口

### 4.1 交付

- **静态位契约**(给 DS-A `scripts/deploy/publish.sh` / `.github/workflows/deploy.yml`;提交 `633e560`):
  - 宿主机 `/root/tansr/docs/releases/<sha>/`(rsync 目标)与 `/root/tansr/docs/current`(符号链接);容器内 `/srv/docs`,nginx `root /srv/docs/current`。
  - `current` 的链接目标**必须是相对路径**:`ln -sfn releases/<sha> /root/tansr/docs/current`(容器内挂载点是 `/srv/docs`,绝对路径 `/root/tansr/…` 在容器内解析不到)。回滚 = 同命令指回上一 `<sha>`。
  - 文件权限须 o+r(建议 `rsync -az --delete --chmod=D755,F644`);容器内 nginx worker 非 root。
  - 站点须产 `/404.html`(Starlight 默认产);链接用尾斜杠形(`/guide/`),无尾斜杠会被 nginx 301 一次。
  - 缓存分档依赖路径形:`/_astro/*`、`/pagefind/*.pf_*` 视为指纹不变;`pagefind-entry.json` 与 html 每次校验。
- **证书单站签发形**(给主线):`scripts/nginx-cert.sh issue docs`(见 4.3)。

### 4.2 消费

- 操作者:`docs.tansr.com` A 记录 → ECS 公网 IP(doc/133 §六;DNS 未就位则 acme 挑战不可达,证书签不出)。
- DS-A 的发布件写 `releases/<sha>` 并切 `current`;本泳道不依赖其在途分支。

### 4.3 主线落 ECS 逐步命令(DNS 就位后;`/root/tansr/deploy` 为 git 检出)

```bash
cd /root/tansr/deploy
# 0. 现状留底
git status --short && git log --oneline -1 && docker compose ps nginx
# 1. 静态位(幂等;可在 pull 之前用 worktree 里的脚本,或 pull 后再跑)
bash scripts/docs-init.sh                      # /root/tansr/docs/{releases/placeholder,current}
# 2. 取代码(main 收编 lane/ds/D 后)
git pull --ff-only
#    此刻 conf.d/docs.conf 已被 bind mount 进在跑 nginx 但尚未加载;docs 证书未在 → 此刻若 reload 会红(§二 2.1 B)。不要 reload。
# 3. 签 docs 证书(80 挑战由 api.conf 的 80 默认块兜底,无需先加载 docs.conf)
bash scripts/nginx-cert.sh issue docs          # 产 /etc/nginx/certs/docs.{fullchain,privkey}.pem;不触碰 api/portal
ls -l /etc/nginx/certs/docs.*
# 4. 渲染模板(把 ${DOCS_DOMAIN} 换成 docs.tansr.com;api/portal 已是字面形,无变化)
bash scripts/render-nginx.sh                   # 末尾用在跑容器 nginx -t 自检,应打「nginx -t 通过」
docker compose exec -T nginx nginx -t
# 5. 让 compose 挂上新卷(卷变更需重建 nginx 容器:秒级中断;只重建 nginx)
docker compose up -d --no-deps nginx
docker compose ps nginx && docker compose exec -T nginx ls -l /srv/docs/
# 6. 核
curl -sI http://docs.tansr.com/ | head -1                 # HTTP/1.1 301
curl -sI https://docs.tansr.com/ | head -1                # HTTP/1.1 200
curl -s  https://docs.tansr.com/nope -o /dev/null -w '%{http_code}\n'   # 404
curl -sI https://api.tansr.com/healthz | head -1          # 旧站不受影响
# 7. 渲染后 git status 会显示 docs.conf 变为字面域名形(与 portal.conf 历史同);是否回提交按「生产现实为准」定
git status --short
```

回滚:`git checkout -- nginx/conf.d/docs.conf docker-compose.yml`(或 `git revert`)→ `docker compose up -d --no-deps nginx`;docs 证书文件留着无害。

## 五 与 doc/133 / doc/134 / 派单不符之处

1. **卷路径**:doc/133 §六与 doc/134 写 `/root/tansr/docs/current:/usr/share/nginx/docs:ro`,派单给了二选一并推荐挂父目录;本卡取父目录 `/root/tansr/docs:/srv/docs:ro`、`root /srv/docs/current`(理由 §六 1)。README / docs.conf / compose 三处口径一致。
2. **`nginx/Dockerfile` 动了一行**(派单文件域未列;禁令是 `Dockerfile.*` / `deploy.sh` / `deploy-to.sh`,`nginx/Dockerfile` 不在其内):它与 `render-nginx.sh` 是同一模板子系统,不同步则该验证镜像对 `docs.conf` 渲染残留 `${DOCS_DOMAIN}`。
3. **`nginx-cert.sh` 形态改动大于「照抄 api / portal」**:原形 `issue` 三域顺序硬写;生产已有 api / portal 正式证书时重跑会被 acme.sh rc=2 中断,`self-signed` 又会整组覆盖正式证书——按名单签是能安全落 ECS 的最小改法;无参行为保持原意(全做)。
4. **提交 3 为空提交**:本地校验不产生跟踪文件,派单要求「命令与输出贴进提交正文」,故用 `--allow-empty` 承载;收编可 squash 进 `633e560`。
5. **`/guide` 无尾斜杠 → 301**:派单验收只写 443 回 200;`try_files $uri $uri/ …` 中 `$uri/` 命中目录时 nginx 规范化到 `/guide/` 再 200。保留(避免 `/guide` 与 `/guide/` 双 URL);改 `$uri $uri/index.html $uri/` 可直出 200 但产生重复 URL。
6. **`portal.conf` 的「模板占位同形」**:仓内 `portal.conf` / `api.conf` 现为字面域名(`f92f1bf` 按生产现实收编),首版才是 `${PORTAL_DOMAIN}`;`docs.conf` 按首版形写占位,render 后与它们同形。

## 六 代拍登记

1. **挂父目录而非挂 `current`**(设计空白:派单二选一)→ 原则「零停机切换要真成立」→ bind mount 在容器创建时解析符号链接并钉住目标目录,之后宿主机 `ln -sfn` 切 `current` 容器内看不到,要 `up -d` 重建才生效,零 reload 承诺落空;挂父目录则 `current` 在容器内按请求实时解析(本地实证 §二 2.2)→ 影响面:`current` 目标必须相对路径(§四 4.1);容器内路径 `/srv/docs/current`。
2. **CSP `script-src` 含 `'unsafe-inline'`**(派单 CSP 基线只写 self + inline style + img data:)→ 原则「首发不能白屏」→ Starlight 主题预设用 `<script is:inline>`(首屏防闪),Pagefind 用 WebAssembly(需 `'wasm-unsafe-eval'`);严格 `script-src 'self'` 会拦主题脚本 → 影响面:CSP 弱于理想;收紧路径 = DS-A 侧启用 Astro CSP 产内联脚本哈希后,把 `'unsafe-inline'` 从 `script-src` 去掉(`docs.conf` 注释已标)。
3. **图片 / 字体 1 天缓存**(派单未提)→ 原则「public/ 未指纹资源不该每次回源也不该一年」→ `max-age=86400`。
4. **`.example.com` 拒签**(`nginx-cert.sh issue`)→ 原则 fail-closed → 域名未配时不去 Let's Encrypt 撞失败配额。

## 七 未完成 / 敞口 / ⏸

- ⏸ 落 ECS(主线;§四 4.3)。前置:操作者 DNS A 记录。
- 敞口:`nginx-cert.sh issue`(无参)对已签发未到期域仍会被 acme.sh rc=2 中断(原有行为,未改);要「全量可重跑」需容忍 rc=2,候主线定。
- 敞口:ECS 上 `render-nginx.sh` 会把 `docs.conf` 渲染成字面形并留 `conf.d.bak/`(已 gitignore);工作区出现 diff,处理口径见 §四 4.3 第 7 步。
- 敞口:`docs-init.sh` 的 `chmod 755 $DOCS_ROOT` 只管 `/root/tansr/docs` 自身;bind mount 不受 `/root` 700 影响(挂载点绕过父目录遍历),本地容器已实证可读,ECS 首次核时若 403 看 `releases/<sha>` 权限(rsync `--chmod`)。
- 本机跑不了的门:无(全部在 Docker 容器内完成;不依赖 WSL)。

## 八 回主线摘要

- `DS-14 | c21d7e7 | 红:无 docs.conf 时 Host docs 打 443 → 502;docs 证书缺 → nginx -t [emerg] cannot load certificate → 绿:syntax is ok / test is successful;443→200 / 缺页→404(404.html) / 80→301 / _astro immutable / pagefind-entry no-cache / gzip / ln 切 current 零 reload | nginx/conf.d/docs.conf | doc/134 DS-14 验收四项 | README(633e560)`
- `DS-14 | 633e560 | 红:docs-init 前目录不存在;render 旧形会整组重签覆盖正式证书 → 绿:docs-init 四场景幂等;render 只自签缺失名、api/portal 不变;envsubst 残留占位 0;compose config exit 0 卷 target /srv/docs | compose · deploy.env · render-nginx.sh · nginx-cert.sh · nginx/Dockerfile · scripts/docs-init.sh | — | README 拓扑/目录/证书运维`
- `DS-14 | 8d894da | 证据提交(空):nginx -t 原文 + 探针表 | — | — | —`
- 落 ECS 命令清单 §四 4.3(7 步 + 回滚);关键序:`docs-init` → `pull` → `issue docs` → `render-nginx` → `up -d --no-deps nginx` → curl 核;pull 与签证书之间**不要 reload**。
- 给 DS-A:`current` 相对链接 `ln -sfn releases/<sha>`;rsync `--chmod=D755,F644`;站点产 `/404.html`;链接带尾斜杠。
- 代拍 2:挂父目录(`/srv/docs/current`)· CSP script `'unsafe-inline'`+`'wasm-unsafe-eval'`(收紧条件:Astro CSP 哈希)。
- 动了派单未列的 `nginx/Dockerfile` 一行(同步 envsubst 列表);`nginx-cert.sh` 改按名单签(无参行为不变)。
- 未 push / 未部署 / 未碰 ECS / 未读 `.env`;测试容器已删。
