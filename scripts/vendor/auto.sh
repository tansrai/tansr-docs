#!/usr/bin/env bash
# 上游变更自动 vendor(资料站 DS-31;.github/workflows/vendor.yml 调用,本地亦可 `pnpm vendor:auto <api 检出> <cli 检出>`)。
#
# 用法:scripts/vendor/auto.sh <tansr-api 检出> <tansr-cli 检出>
#   ① pnpm vendor --api A --cli C   拷入契约副本(在 cli 检出里就地构建 dist/tansr.mjs 与 packages/sdk/dist/index.d.ts,须已 pnpm install;
#                                    两检出的工作区须干净,source 才能指向真实提交——scripts/vendor/index.mjs 自校)
#   ② pnpm gen                      再生全部生成页
#   ③ git status --porcelain -- contract src/content 为空 → 打「无变化」退 0,不提交
#   ④ 非空 → pnpm gate              红即退 1、不提交。上游 CHANGELOG 出现新版本段而 contract/release-notes.json 还没有该版本的
#                                    用户口吻条,正是预期的红(release-notes 门):人工补条后重跑即可
#   ⑤ 绿 → 以 github-actions[bot] 身份提交 `chore(vendor): tansr-api@<sha12> · tansr-cli@<sha12> —— N 文件再生`,
#           推 AUTO_REMOTE/AUTO_BRANCH(缺省 origin / main);只 add contract 与 src/content 两目录
#   ⑥ gh workflow run deploy.yml --ref main
#      Actions 里用 GITHUB_TOKEN 做的 push 不会触发 on: push 工作流(GitHub 防递归),所以 deploy.yml 不会因本次推送自动跑;
#      但用 GITHUB_TOKEN 显式派发 workflow_dispatch 会真跑(deploy.yml 已声明 workflow_dispatch;工作流需 actions: write)。
#      gh 读环境变量 GH_TOKEN(工作流里设为 GITHUB_TOKEN)。
# 环境:AUTO_REMOTE(缺省 origin)· AUTO_BRANCH(缺省 main)· DEPLOY_WORKFLOW(缺省 deploy.yml)
# 外部命令只经 pnpm / git / gh 三件(node 由 pnpm 脚本间接调用;其余为 bash 内建),可被 PATH 上的假件替换做 dry-run 卷:
#   scripts/vendor/test/auto.test.mjs(无变化退 0 不提交 · 有变化门绿提交 + 推 + 派发 · 有变化门红退 1 不提交 · 参数校验)
set -euo pipefail

AUTO_REMOTE="${AUTO_REMOTE:-origin}"
AUTO_BRANCH="${AUTO_BRANCH:-main}"
DEPLOY_WORKFLOW="${DEPLOY_WORKFLOW:-deploy.yml}"
BOT_NAME='github-actions[bot]'
BOT_EMAIL='41898282+github-actions[bot]@users.noreply.github.com'

log() { printf '[vendor:auto] %s\n' "$*" >&2; }
die() { printf '[vendor:auto] ✖ %s\n' "$*" >&2; exit "${2:-1}"; }
usage() { die "用法:auto.sh <tansr-api 检出> <tansr-cli 检出>" 2; }
validate_dir() { [[ -d "$2" ]] || die "$1 检出目录不存在:$2" 2; }

[[ $# -eq 2 ]] || usage
API="$1"
CLI="$2"
validate_dir tansr-api "$API"
validate_dir tansr-cli "$CLI"

log "① pnpm vendor --api $API --cli $CLI"
pnpm vendor --api "$API" --cli "$CLI" || die "vendor 失败(上游检出不干净 / 构建物缺席 / 上游文件缺席,见上方输出)"

log "② pnpm gen"
pnpm gen || die "gen 失败"

changed="$(git status --porcelain=v1 -uall -- contract src/content)"
if [[ -z "$changed" ]]; then
  log "③ 无变化:contract/ 与 src/content/ 和在库一致,不提交,退 0"
  exit 0
fi
mapfile -t changed_files <<< "$changed"
count="${#changed_files[@]}"
log "③ 有变化:$count 文件"
printf '%s\n' "$changed" >&2

log "④ pnpm gate(红即停,不提交)"
if ! pnpm gate; then
  die "门红,不提交。若为上游新版本段:在 contract/release-notes.json 补该版本的用户口吻条(或 note「无用户可见变更」)后重跑" 1
fi

api_sha="$(git -C "$API" rev-parse --short=12 HEAD)"
cli_sha="$(git -C "$CLI" rev-parse --short=12 HEAD)"
message="chore(vendor): tansr-api@${api_sha} · tansr-cli@${cli_sha} —— ${count} 文件再生"

log "⑤ 提交「$message」并推 $AUTO_REMOTE $AUTO_BRANCH"
git add -A -- contract src/content
git -c "user.name=$BOT_NAME" -c "user.email=$BOT_EMAIL" commit -q -m "$message"
git push "$AUTO_REMOTE" "HEAD:$AUTO_BRANCH"

log "⑥ gh workflow run $DEPLOY_WORKFLOW --ref $AUTO_BRANCH(GITHUB_TOKEN 的 push 不触发 on: push;显式派发 workflow_dispatch 才会真跑)"
gh workflow run "$DEPLOY_WORKFLOW" --ref "$AUTO_BRANCH"

log "✔ 已提交并推送:$message;$DEPLOY_WORKFLOW 已派发"
