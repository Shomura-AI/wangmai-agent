# 网脉智能体 OEM 报告

上游：NanmiCoder/cc-haha（分支 main，HEAD 3a6ba4698，v0.7.9）。本仓：G:\zhongkongtai\cc-haha，分支 oem/wangmai，改动尚未提交。

## 1. 三层改写策略

| 层 | 内容 | 处理 |
| --- | --- | --- |
| A 硬身份 | appId、productName、包名、可执行名、环境变量前缀、数据目录、URL scheme、域名、发布仓库 | 全部替换为网脉智能体/WangMai/wangmai |
| B 展示文案 | 窗口标题、README 首屏、About、站点标题、文档正文 | 中文用「网脉智能体」，英文用 WangMai Agent |
| C 保留 | LICENSE、NOTICE、THIRD_PARTY_LICENSES、CLI 兼容标识 (Claude Code)、上游署名 git 历史 | 不动 |

## 2. 品牌映射表

| 旧 | 新 |
| --- | --- |
| com.claude-code-haha.desktop | com.wangmai.agent |
| com.yunce.cchaha.mobile | com.wangmai.agent.mobile |
| app.cchaha.mobile | app.wangmai.mobile |
| cchaha.ai | wangmai.example.com |
| Claude-Code-Haha | WangMai-Agent |
| claude-code-haha | wangmai-agent |
| claude_code_haha | wangmai_agent |
| claude-code-desktop | wangmai-desktop |
| claude_code_desktop | wangmai_desktop |
| claude-code-local | wangmai-agent |
| claude-sidecar | wangmai-sidecar |
| cc-haha-computer-use | wangmai-computer-use |
| claude-haha | wangmai |
| cc-haha / cchaha / CC_HAHA / CC-HAHA | wangmai / WANGMAI |
| ccHaha / CcHaha / CC-Haha | wangmai / WangMai |
| ClaudeCodeHaha | WangMaiAgent |
| Claude Code Haha / cc-haha 站点名 | 网脉智能体 |
| NanmiCoder | wangmai-ai |
| relakkes@gmail.com | dev@wangmai.example.com |
| haha / Haha / HAHA | wangmai / WangMai / WANGMAI |

## 3. 关键文件现状

- desktop/package.json：name wangmai-desktop，build.appId com.wangmai.agent，build.productName 网脉智能体，build.executableName wangmai-desktop，build.nsis.shortcutName 网脉智能体，artifactName WangMai-Agent-版本-平台.扩展名，publish 指向 Shomura-AI/wangmai-agent。
- desktop/electron/services/appIdentity.ts：WINDOWS_APP_USER_MODEL_ID = com.wangmai.agent，单测断言与 build.appId 一致。
- desktop/src-tauri/tauri.conf.json：productName/窗口标题 网脉智能体，identifier com.wangmai.agent，updater 指向 github.com/Shomura-AI/wangmai-agent/releases/latest/download/latest.json，externalBin binaries/wangmai-sidecar。
- mobile/app.json：expo.name 网脉智能体，slug/scheme wangmai，iOS com.wangmai.agent.mobile，Android app.wangmai.mobile，owner wangmai-ai。
- 改名：bin/claude-haha 到 bin/wangmai；desktop/sidecars/claude-sidecar.ts 到 wangmai-sidecar.ts；desktop/src/api 与 stores 下 8 个 haha* 文件到 wangmai*；src/server 下 4 个 haha-*-oauth.ts 到 wangmai-*-oauth.ts；services 下 4 个 haha*OAuthService.ts；mobile/modules 下 cchaha-duty / cchaha-network 到 wangmai-duty / wangmai-network；docs/ui-clone 下 stitch_claudecode_haha_frontend_design 到 stitch_claudecode_wangmai_frontend_design。
- 图标：oem/make-icons.mjs 生成 60 个文件，写满 desktop/src-tauri/icons（含 ico/icns/ios/android mipmap）、desktop/public、src-tauri、docs/images、mobile/assets。

## 4. 工具

- oem/brand.config.json：品牌事实单一来源（名称、slug、appId、域名、仓库、slogan）。
- oem/rebrand.mjs：全仓内容替换 + JSON 语义补丁 + 文件改名，支持 --dry-run 与 --verify；输出 oem/rebrand-report.json。
- oem/make-icons.mjs：纯 Node 生成 PNG/ICO/ICNS，无外部依赖。

## 5. 验证结果（本机 Windows，bun 1.4.5）

| 检查 | 结果 |
| --- | --- |
| 旧品牌残留扫描 oem/rebrand.mjs --verify | 0 命中 |
| desktop tsc -b | 退出码 0 |
| desktop vite build | 成功 5.71s |
| desktop appIdentity.test.ts | 8 pass |
| desktop tray/menu 测试 | 23 pass |
| 根 OAuth 测试 8 文件 | 98 pass |
| 根 settings fallback 测试 | 5 pass |
| site npm run check:docs | 通过 102 页 / 383 链接 / 21 组双语截图 |
| site npm run build | 成功 3.21s |

## 6. 已知环境性失败（与改品牌无关）

bun run check:policy 结果 497 pass / 1 skip / 94 fail，全部落在这三类 Windows 平台限制：

1. scripts/issue-router：test-helpers.ts:37 用 mkdir 创建含空格与中文「空间」的目录，Windows 返回 EINVAL: invalid argument。
2. scripts/quality-gate/computer-use-live-smoke.test.ts：断言路径必须直接位于 /tmp 之下，Windows 无 /tmp 挂载。
3. scripts/pr/change-policy.test.ts：CODEOWNER 用例需要 git 可执行文件，本机 PATH 无 git，5s 超时。把 GitHubDesktop 的 git 目录加进 PATH 可单独跑通。

上述文件均未被改品牌脚本改动（git diff 可核对），属上游测试对 POSIX 台的假设。

## 7. 上线前要做的事

1. 仓库改名或新建 Shomura-AI/wangmai-agent，否则 autoUpdater 与 releases 链接 404。
2. 换掉占位域名 wangmai.example.com（site/scripts/prepare-static-output.mjs 的 expectedCustomDomain 与 CNAME、docs 中的域名）。
3. 重新签发签名与公证：macOS 换 developer id，Windows 换代码签名证书，并更新 desktop/package.json 的 mac.identity 与 signIgnore 之外的证书配置。
4. 移动端 rebuild：mobile/app.json 的 EAS projectId 仍是上游账户下的项目，需要 eas init 重新绑定。
5. 若要长期与上游同步，oem/rebrand.mjs 每次 merge 后重跑，再跑 --verify 与上述检查。
