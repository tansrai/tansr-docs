#!/usr/bin/env bash
# 资料站发布:rsync 到 releases/<sha>/ → 原子切换 current(相对符号链接)→ 只留最近 KEEP 份。
#
# 用法:scripts/deploy/publish.sh <dist 目录> <host> <sha>
#   host  = ssh 目标(user@host 或 ssh config 别名);sha = 提交号(7–40 位十六进制)
# 环境:DOCS_ROOT(缺省 /root/tansr/docs)· KEEP(缺省 5)· SSH_OPTS(附加 ssh 选项,如 "-o StrictHostKeyChecking=yes")
#
# 契约(与 nginx 静态位对齐):
#   rsync -az --delete --chmod=D755,F644 <dist>/ <host>:<ROOT>/releases/<sha>/
#   ssh <host> 'ln -sfn releases/<sha> <ROOT>/current.tmp && mv -Tf <ROOT>/current.tmp <ROOT>/current'   # 相对链接、原子替换、零 reload
#   rsync / ssh 任一失败 → 不切 current、退非 0;清理失败只警告(发布已生效)
# 外部命令只经 rsync / ssh 两件(其余为 bash 内建),可被 PATH 上的假件替换做 dry-run 卷。
#
# 子命令(供卷与运维):
#   publish.sh --print-prune-cmd <sha>   打印将在远端执行的清理命令(不联网)
set -euo pipefail

DOCS_ROOT="${DOCS_ROOT:-/root/tansr/docs}"
KEEP="${KEEP:-5}"
SSH_OPTS="${SSH_OPTS:-}"

log() { printf '[publish] %s\n' "$*" >&2; }
die() { printf '[publish] ✖ %s\n' "$*" >&2; exit "${2:-1}"; }

# 远端清理命令:按 mtime 新→旧列 releases/,跳过当前 sha,其余保留 KEEP-1 份(合计 KEEP 份),再旧的删
prune_cmd() {
  local sha="$1"
  printf "cd %s/releases && ls -1t | awk -v keep=%s -v cur=%s '\$0==cur{next} {n++} n>=keep{print}' | xargs -r rm -rf" \
    "$DOCS_ROOT" "$KEEP" "$sha"
}

switch_cmd() {
  local sha="$1"
  printf 'ln -sfn releases/%s %s/current.tmp && mv -Tf %s/current.tmp %s/current' "$sha" "$DOCS_ROOT" "$DOCS_ROOT" "$DOCS_ROOT"
}

validate_sha() {
  [[ "$1" =~ ^[0-9a-f]{7,40}$ ]] || die "sha 须为 7–40 位小写十六进制:$1" 2
}

if [[ "${1:-}" == "--print-prune-cmd" ]]; then
  [[ $# -eq 2 ]] || die "用法:publish.sh --print-prune-cmd <sha>" 2
  validate_sha "$2"
  prune_cmd "$2"
  exit 0
fi

[[ $# -eq 3 ]] || die "用法:publish.sh <dist 目录> <host> <sha>" 2
DIST="$1"
HOST="$2"
SHA="$3"

[[ -d "$DIST" ]] || die "dist 目录不存在:$DIST" 2
[[ -f "$DIST/index.html" ]] || die "dist 缺 index.html(未构建?):$DIST" 2
[[ -n "$HOST" ]] || die "host 为空" 2
validate_sha "$SHA"
[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || die "KEEP 须为正整数:$KEEP" 2

# shellcheck disable=SC2206  # SSH_OPTS 允许空格分隔的多个选项
SSH_ARGS=( $SSH_OPTS )
RELEASE_DIR="$DOCS_ROOT/releases/$SHA"

log "① 建远端目录 $HOST:$RELEASE_DIR"
ssh "${SSH_ARGS[@]}" "$HOST" "mkdir -p '$RELEASE_DIR'" || die "ssh mkdir 失败,未切换 current"

log "② rsync $DIST/ → $HOST:$RELEASE_DIR/"
rsync -az --delete --chmod=D755,F644 "${DIST%/}/" "$HOST:$RELEASE_DIR/" || die "rsync 失败,未切换 current"

log "③ 原子切换 current → releases/$SHA"
ssh "${SSH_ARGS[@]}" "$HOST" "$(switch_cmd "$SHA")" || die "切换 current 失败(releases/$SHA 已上传,可手动重试切换)"

log "④ 清理:只留最近 $KEEP 份"
if ! ssh "${SSH_ARGS[@]}" "$HOST" "$(prune_cmd "$SHA")"; then
  log "⚠ 清理旧版本失败(发布已生效,不影响线上);请手动检查 $DOCS_ROOT/releases"
fi

log "✔ 已发布 $SHA → $HOST:$DOCS_ROOT/current"
