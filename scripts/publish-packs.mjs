/**
 * 把词包发布到开源平台（GitHub 仓库 + 公共 CDN），或者把站点切回/切走 CDN。
 *
 * 用法：
 *   node scripts/publish-packs.mjs check
 *       校验 public/packs/index.json 里的 sha256 / bytes / count 与真实文件是否一致，
 *       发布前必跑，防止把上一版清单和这一版文件混着发出去
 *
 *   node scripts/publish-packs.mjs urls --repo your-name/english-lab-packs --tag packs-20261027
 *       打印每个包在 jsDelivr / ghfast 上的地址，以及该填进 index.json 的 cdn 数组
 *
 *   node scripts/publish-packs.mjs cdn --repo your-name/english-lab-packs --tag packs-20261027
 *       直接把 cdn 写进 public/packs/index.json（改完不用重新构建，静态文件即可生效）
 *
 *   node scripts/publish-packs.mjs cdn --clear
 *       清空 cdn，退回同源下载
 *
 * 词包目录约定：仓库根下有个 packs/ 目录，里面是 index.json 和 5 个 <id>.<版本>.json，
 * 打 tag 后 jsDelivr 的地址就是 https://cdn.jsdelivr.net/gh/<repo>@<tag>/packs/...
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const INDEX = root + "public/packs/index.json";

const argv = process.argv.slice(2);
const mode = argv[0] ?? "check";
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name) => argv.includes(`--${name}`);

/** 镜像顺序＝下载时的尝试顺序，国内挂在前面的会自动往后兜 */
const MIRRORS = [
  { label: "jsDelivr (Cloudflare)", base: (repo, tag) => `https://cdn.jsdelivr.net/gh/${repo}@${tag}/packs` },
  { label: "jsDelivr (Gcore)", base: (repo, tag) => `https://gcore.jsdelivr.net/gh/${repo}@${tag}/packs` },
  {
    label: "ghfast 加速（GitHub raw）",
    base: (repo, tag) => `https://ghfast.top/https://raw.githubusercontent.com/${repo}/${tag}/packs`,
  },
];

function readIndex() {
  if (!existsSync(INDEX)) {
    console.error(`找不到清单：${INDEX}\n先跑 npm run packs 生成词包`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(INDEX, "utf8"));
}

function fileNameOf(pack) {
  return pack.file ?? pack.url.replace(/^\/?packs\//, "");
}

// ---------- check ----------
function check() {
  const manifest = readIndex();
  let bad = 0;
  console.log(`清单版本 ${manifest.version}，${manifest.packs.length} 个包\n`);

  for (const pack of manifest.packs) {
    const file = fileNameOf(pack);
    const path = root + "public/packs/" + file;
    if (!existsSync(path)) {
      console.log(`✗ ${pack.id.padEnd(5)} 文件缺失 ${file}`);
      bad++;
      continue;
    }
    const buf = readFileSync(path);
    const sha = createHash("sha256").update(buf).digest("hex");
    const parsed = JSON.parse(buf.toString("utf8"));
    const count = parsed.words?.length ?? 0;

    const problems = [];
    if (sha !== pack.sha256) problems.push(`sha256 不一致（清单 ${pack.sha256.slice(0, 8)}… 实际 ${sha.slice(0, 8)}…）`);
    if (buf.byteLength !== pack.bytes) problems.push(`体积不一致（清单 ${pack.bytes} 实际 ${buf.byteLength}）`);
    if (count !== pack.count) problems.push(`词数不一致（清单 ${pack.count} 实际 ${count}）`);
    if (parsed.id !== pack.id) problems.push(`包 id 不一致（清单 ${pack.id} 实际 ${parsed.id}）`);

    if (problems.length) {
      console.log(`✗ ${pack.id.padEnd(5)} ${problems.join("；")}`);
      bad++;
    } else {
      console.log(`✓ ${pack.id.padEnd(5)} ${count} 词 ${(buf.byteLength / 1024).toFixed(0)}KB ${sha.slice(0, 12)}…`);
    }
  }

  // 清单里没引用到的残留文件，提示一下（旧版本词包可以留着，不影响）
  const used = new Set(manifest.packs.map(fileNameOf));
  for (const name of readdirSync(root + "public/packs")) {
    if (name === "index.json" || used.has(name)) continue;
    console.log(`· ${name} 未被清单引用（旧版本，可保留）`);
  }

  console.log(bad ? `\n${bad} 个包不一致，先重新跑 npm run packs` : "\n全部一致，可以发布");
  process.exit(bad ? 1 : 0);
}

// ---------- urls / cdn ----------
function targets() {
  const repo = flag("repo");
  const tag = flag("tag");
  if (!repo || !tag) {
    console.error(
      "缺少参数。示例：\n  node scripts/publish-packs.mjs cdn --repo your-name/english-lab-packs --tag packs-20261027",
    );
    process.exit(1);
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    console.error(`--repo 要写成 owner/name，收到：${repo}`);
    process.exit(1);
  }
  return { repo, tag, bases: MIRRORS.map((m) => ({ label: m.label, base: m.base(repo, tag) })) };
}

function urls() {
  const { repo, tag, bases } = targets();
  const manifest = readIndex();

  console.log(`仓库 ${repo} · tag ${tag}\n`);
  console.log("要写进 public/packs/index.json 的 cdn 字段：\n");
  console.log(
    JSON.stringify(
      {
        cdn: bases.map((b) => b.base),
      },
      null,
      2,
    ),
  );

  console.log("\n各镜像地址（可逐条 curl 验证）：");
  for (const b of bases) {
    console.log(`\n[${b.label}]`);
    console.log(`  ${b.base}/index.json`);
    for (const pack of manifest.packs) {
      console.log(`  ${b.base}/${fileNameOf(pack)}`);
    }
  }

  console.log("\n发布步骤：");
  console.log(`  1. mkdir -p packs && cp public/packs/*.json packs/`);
  console.log(`  2. git add packs && git commit -m "packs ${tag}"`);
  console.log(`  3. git tag ${tag} && git push origin main --tags`);
  console.log(`  4. node scripts/publish-packs.mjs cdn --repo ${repo} --tag ${tag}`);
}

function writeCdn() {
  const manifest = readIndex();

  if (has("clear")) {
    delete manifest.cdn;
    writeFileSync(INDEX, JSON.stringify(manifest, null, 2) + "\n");
    console.log("已清空 cdn，词包回到同源下载（public/packs）");
    return;
  }

  const { bases } = targets();
  manifest.cdn = bases.map((b) => b.base);
  writeFileSync(INDEX, JSON.stringify(manifest, null, 2) + "\n");

  console.log("已写入 public/packs/index.json：\n");
  for (const b of bases) console.log(`  ${b.label.padEnd(22)} ${b.base}`);
  console.log("\n下次打开页面就会从这些开源镜像拉包，本站不承担下载流量。");
  console.log("验证：npm run packs:check 之后在浏览器打开站点，看弹窗里的「来源」。");
}

if (mode === "check") check();
else if (mode === "urls") urls();
else if (mode === "cdn") writeCdn();
else {
  console.error(`未知子命令：${mode}\n可用：check / urls / cdn`);
  process.exit(1);
}
