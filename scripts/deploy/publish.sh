#!/usr/bin/env bash
# 资料站发布(双受限键形,DS-26):rsync 到 releases/<sha>/ → 远端 `switch <sha>` 原子切换 current(并只留最近 5 份)。
#
# 用法:scripts/deploy/publish.sh <dist 目录> <upload-host> <switch-host> <sha>
#   upload-host = 只带「上传键」的 ssh 目标(user@host 或 ssh config 别名);远端强制命令 docs-rsync-only 只放行
#                 rsync 服务端形且目标恒为 $DOCS_ROOT/releases/<sha>/(部署仓 scripts/docs-rsync-only.sh)
#   switch-host = 只带「切换键」的 ssh 目标;远端强制命令 docs-switch 只认 `switch <sha>` / `list`(部署仓 scripts/docs-switch.sh):
#                 ln -sfn releases/<sha> current.tmp && mv -Tf current.tmp current(相对链接、原子、零 reload),再清理到 KEEP 份
#   sha         = 提交号(7–40 位小写十六进制)
# 环境:DOCS_ROOT(缺省 /srv/tansr-docs;须与远端 docs-rsync-only 的 DOCS_ROOT 一致)· SSH_OPTS(附加 ssh 选项)
#
# 契约(与远端强制命令逐字对齐):
#   rsync -az --delete --chmod=D755,F644 <dist>/ <upload-host>:<ROOT>/releases/<sha>/
#   ssh <switch-host> switch <sha>
#   rsync 失败 → 不切 current、退非 0;切换失败 → 退非 0(releases/<sha> 已上传,可重试切换)
# 外部命令只经 rsync / ssh 两件(其余为 bash 内建),可被 PATH 上的假件替换做 dry-run 卷。
# 远端 mkdir 与旧版本清理都在强制命令里做,本脚本不再单独调用(上传键不允许任意命令)。
set -euo pipefail

DOCS_ROOT="${DOCS_ROOT:-/srv/tansr-docs}"
SSH_OPTS="${SSH_OPTS:-}"

log() { printf '[publish] %s\n' "$*" >&2; }
die() { printf '[publish] ✖ %s\n' "$*" >&2; exit "${2:-1}"; }

validate_sha() {
  [[ "$1" =~ ^[0-9a-f]{7,40}$ ]] || die "sha 须为 7–40 位小写十六进制:$1" 2
}

[[ $# -eq 4 ]] || die "用法:publish.sh <dist 目录> <upload-host> <switch-host> <sha>" 2
DIST="$1"
UPLOAD_HOST="$2"
SWITCH_HOST="$3"
SHA="$4"

[[ -d "$DIST" ]] || die "dist 目录不存在:$DIST" 2
[[ -f "$DIST/index.html" ]] || die "dist 缺 index.html(未构建?):$DIST" 2
[[ -n "$UPLOAD_HOST" ]] || die "upload-host 为空" 2
[[ -n "$SWITCH_HOST" ]] || die "switch-host 为空" 2
validate_sha "$SHA"

# shellcheck disable=SC2206  # SSH_OPTS 允许空格分隔的多个选项
SSH_ARGS=( $SSH_OPTS )
RELEASE_DIR="$DOCS_ROOT/releases/$SHA"

log "① rsync $DIST/ → $UPLOAD_HOST:$RELEASE_DIR/(远端强制命令建目录并校验路径)"
rsync -az --delete --chmod=D755,F644 "${DIST%/}/" "$UPLOAD_HOST:$RELEASE_DIR/" || die "rsync 失败,未切换 current"

log "② 原子切换 current → releases/$SHA(远端 docs-switch,随后只留最近 5 份)"
ssh "${SSH_ARGS[@]}" "$SWITCH_HOST" "switch $SHA" || die "切换 current 失败(releases/$SHA 已上传,可手动重试:ssh $SWITCH_HOST switch $SHA)"

log "✔ 已发布 $SHA → $DOCS_ROOT/current"
