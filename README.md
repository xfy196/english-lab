# WordLoop · 英语单词学习站

一个基于 **Next.js 16（React 19）+ TypeScript + Tailwind CSS v4** 的 Web 端英语学习网站。
四种使用方式：翻转卡片记词、听音选词、看义拼写、学习数据看板。无需登录和后端，数据全部存在浏览器本地。

词库本身**不随站点打包**：站点只内置 60 个手写词保证可用，其余 6,000+ 个考纲词按需下载到浏览器（IndexedDB），装完即可离线使用。

---

## 快速开始

```bash
cd english-lab
npm install
npm run dev
```

打开 <http://localhost:3200>。

> 如果 `npm run dev` 报 Turbopack 相关的文件权限错误，改用 webpack：`npm run dev:webpack`

生产构建：

```bash
npm run build && npm start
```

---

## 功能

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 今日概览 | `/` | 今日新词进度环、连续打卡、已掌握词数、三模式入口、本周柱状图、待复习列表 |
| 词汇卡片 | `/learn` | 3D 翻面卡片，正面单词 + 音标 + 发音，背面释义 + 例句；「认识 / 不认识」决定复习优先级 |
| 听写练习 | `/quiz` | 听音选词（4 选 1）、看义拼写（可要提示），每题即时反馈 |
| 学习数据 | `/stats` | 累计答题、正确率、掌握分布、近 14 天趋势曲线、可搜索筛选的词汇表、词库管理、清空数据 |

### 掌握规则

- 卡片点「认识」或答题正确 → `correct + 1`，否则 `wrong + 1` 并退回「学习中」
- 累计答对 2 次以上才标记为「已掌握」
- 一个词第一次出现时计入「新学」，再次出现计入「复习」

### 交互细节

- 卡片模式键盘操作：`空格` 翻面、`←` 不认识、`→` 认识（`1` / `2` 同效）
- 发音使用浏览器内置的 `SpeechSynthesis`（en-US），不依赖第三方 TTS 服务
- `/learn?mode=review` 进入只复习「学习中」单词的模式
- 每组 10 题 / 10 张卡，结束后有一轮结算页

---

## 词库：按需下载，不随站点打包

### 为什么这么做

词库是静态数据，打进 JS bundle 会让首屏白白多背几十 KB，而用户通常只需要其中一个考纲方向的词。所以拆成词包，用户勾选自己需要的下载。

### 首次访问的流程

```
打开站点
  ├─ 从 IndexedDB 读取已装词包 ── 有 ──→ 直接进入，合并内置词使用
  │                            └─ 无 ──→ 弹出「下载词库到你本机」
  │                                        ├─ 勾选考纲包 → 下载（带进度）→ 校验 sha256 → 存 IndexedDB
  │                                        └─ 「先用内置 60 词」→ 只用手写词，顶部保留升级入口
  └─ 无论哪条路径，站点都不会白屏
```

### 随时能再打开弹窗

弹窗关掉不代表找不到入口，四处常驻：

| 位置 | 说明 |
| --- | --- |
| 侧边栏「词库管理」 | 导航下方独立一条，右侧实时显示「未下载 / N 个包」 |
| 移动端底栏「词库」 | 第 5 个图标，装了包会亮一个绿点 |
| 顶部虚线提示条 | 只有在一个包都没装时出现 |
| 「学习数据」页词库区 | 装包、删包、看占用体积 |

三个关键设计：

1. **内置 60 词兜底**：`src/data/curated.ts` 始终打包，断网、拒绝授权、词包没下完都能正常学
2. **sha256 校验**：下载完先核对哈希，对不上就丢弃换下一条通道。这条在走公共 CDN 时尤其重要——镜像不可控，但内容可控
3. **IndexedDB 超时兜底**：部分浏览器（隐私模式、被扩展拦截、某些 WebView）`indexedDB.open` 既不成功也不失败，会永久挂起。代码里对打开和读写都设了超时，超时就当不可用、退回内存态，并在弹窗里提示「本次会话有效，刷新需重新下载」

### 词包清单

| 包 | 名称 | 词数 | 体积 |
| --- | --- | --- | --- |
| `zk` | 中考核心词 | 1,158 | 72 KB |
| `gk` | 高考核心词 | 2,851 | 183 KB |
| `cet4` | 四级核心词 | 3,202 | 211 KB |
| `cet6` | 六级核心词 | 4,566 | 306 KB |
| `ky` | 考研核心词 | 4,032 | 267 KB |

五个包合计 15,809 条，**跨包去重后 6,004 个单词**（六级本身包含四级的词，重叠很多），全量下载约 1 MB。

### 词包托管在开源平台，不占自己服务器流量

这 1 MB 不必由站点承担。词包发布到 GitHub 仓库，通过 jsDelivr / ghfast 这类公共 CDN 分发，浏览器直接从那边拿、存进用户 IndexedDB。**站点自己只需要托管一个 1.6KB 的 `index.json`**。

```
        ┌─ 站点静态资源 ──────────────┐
用户 ──→│  index.json（1.6KB，只含清单）│
        └───────────┬─────────────────┘
                    │ 清单里写着 cdn 基址
                    ▼
        ┌─ 开源平台（GitHub + 公共 CDN）─┐
        │  cdn.jsdelivr.net   ← 首选     │
        │  gcore.jsdelivr.net ← 备用     │
        │  ghfast.top (raw)   ← 国内备用 │
        └───────────┬────────────────────┘
                    │ 流式下载 + sha256 校验
                    ▼
             用户浏览器 IndexedDB
                    │
                    └─ 全挂了才回退到本站 /packs
```

**下载通道按优先级逐个尝试，任一条成功即止**：`index.json` 的 `cdn` → 环境变量 → 本站兜底。单条通道 30 秒超时，失败不报错、静默切下一条，全部失败才在弹窗里列出每条通道的原因。

**发布词包（四步）**

```bash
# 1. 发布前先校验清单和文件对得上，防止把上一版清单配这一版文件发出去
npm run packs:check

# 2. 把词包目录推到公开仓库（仓库根下建个 packs/）
mkdir -p packs && cp public/packs/*.json packs/
git add packs && git commit -m "packs 20261027"
git tag packs-20261027 && git push origin main --tags

# 3. 看看会生成哪些地址（顺带打印要填的 cdn 数组）
npm run packs:publish -- --repo 你的用户名/english-lab-packs --tag packs-20261027

# 4. 直接写进清单，静态文件生效，不用重新构建前端
npm run packs:cdn -- --repo 你的用户名/english-lab-packs --tag packs-20261027
```

回退到本站只要 `npm run packs:cdn -- --clear`。

几点说明：

- **用 tag 而不是 `@main`**：jsDelivr 对 tag 的结果永久缓存，不会出现「改了半天还是旧文件」；文件本身也带版本号（`zk.20261027.json`），双保险
- **镜像被污染也拦得住**：无论从哪个通道下载，落地前都过一遍 sha256，对不上就整包丢弃并换下一条通道。实测把两条通道都返回伪造内容时，IndexedDB 里一个字节都没写进去
- **完全不用自建服务器**：把 `NEXT_PUBLIC_PACK_BASE` 设为 CDN 基址（逗号分隔可写多个），清单也会去那边找。此时 `public/packs` 可以整个删掉，站点只剩 HTML/JS
- 各通道实测（南京，2026-10）：`gcore.jsdelivr.net` 227ms、`cdn.jsdelivr.net` 882ms、`ghfast.top` 939ms，均返回 `access-control-allow-origin: *`，浏览器可直连；`raw.githubusercontent.com` 直连不通，只作为 ghfast 的被代理源


### 词包文件格式

`public/packs/index.json` 是清单（含每包的词数、字节数、sha256、文件名，以及可选的 `cdn` 基址数组）；词包文件名带版本号，可永久缓存：

```json
{ "v": 1, "id": "cet4", "version": "20261027",
  "words": [["abandon", "/əˈbændən/", "v.", "放弃；抛弃", "A2"]] }
```

刻意用数组而不是对象，一列一个字段，比对象省约 40% 体积。

### 重新生成 / 调整词包

只需要两个原始数据文件（**国内必须走 `ghfast.top` 加速，GitHub 直连会超时**）：

```bash
mkdir -p .ecdict
curl -L -o .ecdict/ecdict.csv    "https://ghfast.top/https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
curl -L -o .ecdict/ipa-en_UK.txt "https://ghfast.top/https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_UK.txt"

npm run packs:dry   # 只打印统计，不写文件
npm run packs       # 写入 public/packs/
```

改 `scripts/build-packs.mjs` 顶部的 `PACKS` 可增删考纲包，改 `MAX_PER_PACK` 控制单包上限。版本号取构建当天日期，换日期就会让浏览器重新拉取。

### 数据源与已知限制

| 用途 | 数据源 | 说明 |
| --- | --- | --- |
| 释义 / 考纲标签 / 词频 | ECDICT（77 万条） | `translation`、`tag`、`bnc`/`frq`、`oxford` 直接可用 |
| 音标 | ipa-dict（6.5 万条） | 标准英式 IPA |

ECDICT 有三列**不可用**，实测结论：

- `phonetic`：仅 28% 有值，其中 70% 是旧式编码（`ә'bændәn`、`'kєәful`，混入西里尔字母），故改用 ipa-dict
- `pos`：整列为空（0 条），词性从中文释义前缀反推，反推不到再从英文 `definition` 前缀补
- `detail` / `audio`：全空，**所以自动生成的词条没有例句**，卡片背面会退化成一句引导语

音标由 `scripts/ipa.mjs` 做两件事：统一字符集（`ɹ`→`r`、`ɛ`→`e`、`ɐ`→`ə`）、把重音符号从「元音前」挪到「重读音节首」（`pˈɜːsən` → `ˈpɜːsən`）。以手写 60 词为基准回归校验，`npm run words:check` 可看一致率（当前约 73%，差异多为 `(r)` 写法、`i/ɪ` 等风格问题，不影响拼读）。

---

## 目录结构

```
english-lab/
├── public/packs/             # 词包与清单（构建产物，需随站点发布）
├── src/
│   ├── app/
│   │   ├── layout.tsx        # 全局布局：WordProvider + ProgressProvider + 词库弹窗
│   │   ├── page.tsx          # 今日概览
│   │   ├── globals.css       # 设计变量（配色/字体）、翻面卡片、动效
│   │   ├── learn/page.tsx    # 词汇卡片（Suspense 包裹，支持 ?mode=review）
│   │   ├── quiz/page.tsx     # 听写练习
│   │   └── stats/page.tsx    # 学习数据 + 词库管理
│   ├── components/
│   │   ├── nav.tsx           # 侧边栏 / 移动端导航 / Logo（含常驻「词库管理」入口）
│   │   ├── ui.tsx            # ProgressRing、StatTile、PageHeader、EmptyHint
│   │   ├── charts.tsx        # 趋势面积图、本周柱状图（纯 SVG，无图表库）
│   │   ├── learn-view.tsx    # 卡片模式的完整交互
│   │   ├── pack-dialog.tsx   # 词库授权弹窗 + 顶部提示条
│   │   └── speak-button.tsx  # 朗读按钮
│   ├── data/
│   │   ├── words.ts          # 只导出内置保底词 SEED_WORDS
│   │   └── curated.ts        # 手写词条 60 个，带例句，直接编辑这里
│   └── lib/
│       ├── types.ts          # 类型定义
│       ├── store.tsx         # 进度 Context + localStorage 持久化 + 派生统计
│       ├── words-context.tsx # 词库 Context：内置词 + 已装词包合并、下载编排
│       ├── pack-source.ts     # 下载通道链：CDN 基址解析、优先级排序、URL 拼接
│       ├── wordpack.ts       # IndexedDB 存取、多通道流式下载、sha256 校验
│       ├── speech.ts         # 语音合成 hook
│       └── utils.ts          # 日期、随机、样式工具
├── scripts/
│   ├── build-packs.mjs       # 从 ECDICT + ipa-dict 生成 public/packs/
│   ├── publish-packs.mjs     # 发布前校验、生成 CDN 地址、切换 index.json 的 cdn
│   ├── ecdict-lib.mjs        # ECDICT 字段清洗的公共逻辑
│   ├── csv.mjs               # 流式 CSV 解析（处理字段内换行）
│   ├── ipa.mjs               # 音标规范化（字符统一 + 重音位置校正）
│   └── check-phonetic.mjs    # 用手写词做音标回归校验
├── postcss.config.mjs
└── next.config.ts
```

---

## 数据存储

| 内容 | 位置 | key / 库名 |
| --- | --- | --- |
| 学习进度 | localStorage | `wordloop:progress:v1` |
| 已装词包 | IndexedDB | `wordloop-packs` / 表 `packs` |
| 是否已看过词库弹窗 | localStorage | `wordloop:packs:onboarded:v1` |

进度结构：

```ts
{
  version: 1,
  words: { [wordId]: { seen, correct, wrong, lastSeen, status } },
  daily: { "2026-10-27": { learned, reviewed, correct, wrong } }
}
```

换浏览器 / 清缓存后进度与词包都会重置；「学习数据」页底部可手动清空进度，词库区可单独删除某个词包。

## 换成自己的词库

编辑 `src/data/curated.ts`（内置词，始终打包，适合放你手写的带例句的精品词条），按 `Word` 类型追加即可：

```ts
{
  id: "resilient",
  word: "resilient",
  phonetic: "/rɪˈzɪliənt/",
  pos: "adj.",
  meaning: "有韧性的；能恢复的",
  example: "Children are remarkably resilient.",
  exampleCn: "孩子的恢复力惊人。",
  level: "B2",
}
```

`example` 和 `exampleCn` 可选，不写就不渲染例句块。要加**大批量**词，走 `scripts/build-packs.mjs` 生成词包，不要把数据塞回源码。

## 后续可扩展

- 给自动生成的词条补例句（接词典 API 或 LLM 批量生成后回写词包）
- 自定义词包：用户上传 CSV 生成自己的词包
- 词包版本比对：清单升级时提示「有新版词包可更新」
- 接入云端账号，实现多端同步
- 间隔重复算法（SM-2 / FSRS）替代当前的「答对 2 次即掌握」
- 增加拼写错因分析、每日提醒（PWA）
