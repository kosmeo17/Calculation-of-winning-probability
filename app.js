let uploadedDatasets = [];
let metricMap = new Map();
let allSchemaRows = [];
let dimensionKey = "";
let dimensionContexts = [];
let activeMetricMap = null;
let activeSchemaRows = null;

const fileInput = document.getElementById("fileInput");
const filePickBtn = document.getElementById("filePickBtn");
const fileNameText = document.getElementById("fileNameText");
const runBtn = document.getElementById("runBtn");
const statusEl = document.getElementById("status");
const resultContainer = document.getElementById("resultContainer");
const sampleCountInput = document.getElementById("sampleCount");
const metricColWidthRange = document.getElementById("metricColWidthRange");
const metricColWidthValue = document.getElementById("metricColWidthValue");

fileInput.addEventListener("change", handleFileUpload);
filePickBtn.addEventListener("click", () => fileInput.click());
runBtn.addEventListener("click", runCalculation);
metricColWidthRange.addEventListener("input", handleMetricColWidthChange);

function handleMetricColWidthChange() {
  const px = `${metricColWidthRange.value}px`;
  document.documentElement.style.setProperty("--metric-col-width", px);
  metricColWidthValue.textContent = px;
}

function setStatus(msg, mode = "info", allowHtml = false) {
  if (allowHtml) statusEl.innerHTML = msg;
  else statusEl.textContent = msg;
  statusEl.className = `status status-${mode}`;
}

function createResultBlock(title) {
  const block = document.createElement("div");
  block.className = "result-block";

  const header = document.createElement("div");
  header.className = "result-block-header";

  const heading = document.createElement("h3");
  heading.className = "result-title";
  heading.textContent = title;

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "copy-table-btn";
  copyBtn.textContent = "复制表格";

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  table.appendChild(thead);
  table.appendChild(tbody);
  wrap.appendChild(table);

  copyBtn.addEventListener("click", async () => {
    try {
      const matrix = tableToMatrix(table);
      const text = matrixToTSV(matrix);
      const html = tableToStyledHTML(table);
      await copyTablePayload(text, html);
      const original = copyBtn.textContent;
      copyBtn.textContent = "已复制";
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1200);
    } catch (err) {
      setStatus(`复制失败：${err.message}`, "error");
    }
  });

  header.appendChild(heading);
  header.appendChild(copyBtn);
  block.appendChild(header);
  block.appendChild(wrap);
  resultContainer.appendChild(block);

  return { table, thead, tbody };
}

function tableToMatrix(table) {
  const rows = [...table.querySelectorAll("tr")];
  const matrix = [];

  rows.forEach((tr, rowIndex) => {
    if (!matrix[rowIndex]) matrix[rowIndex] = [];
    let colIndex = 0;

    [...tr.querySelectorAll("th,td")].forEach((cell) => {
      while (matrix[rowIndex][colIndex] !== undefined) colIndex += 1;

      const text = String(cell.innerText || "").replace(/\t/g, " ").replace(/\n+/g, " ").trim();
      const rowSpan = Number(cell.getAttribute("rowspan") || 1);
      const colSpan = Number(cell.getAttribute("colspan") || 1);

      for (let r = 0; r < rowSpan; r += 1) {
        const targetRow = rowIndex + r;
        if (!matrix[targetRow]) matrix[targetRow] = [];
        for (let c = 0; c < colSpan; c += 1) {
          matrix[targetRow][colIndex + c] = text;
        }
      }
      colIndex += colSpan;
    });
  });

  const maxCols = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  matrix.forEach((row) => {
    while (row.length < maxCols) row.push("");
  });
  return matrix;
}

function matrixToTSV(matrix) {
  return matrix.map((row) => row.join("\t")).join("\n");
}

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function matrixToHTMLTable(matrix) {
  const rows = matrix
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHTML(cell)}</td>`).join("")}</tr>`
    )
    .join("");
  return `<table>${rows}</table>`;
}

function tableToStyledHTML(table) {
  const rows = [...table.querySelectorAll("tr")];
  const htmlRows = rows
    .map((tr) => {
      const cells = [...tr.querySelectorAll("th,td")];
      const htmlCells = cells
        .map((cell) => {
          const text = escapeHTML(String(cell.innerText || "").replace(/\n+/g, " ").trim());
          const cs = window.getComputedStyle(cell);
          const styles = [
            `color:${cs.color}`,
            `background-color:${cs.backgroundColor}`,
            `font-weight:${cs.fontWeight}`,
            `font-size:${cs.fontSize}`,
            `text-align:${cs.textAlign}`,
            `vertical-align:${cs.verticalAlign}`,
            `border-top:${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
            `border-right:${cs.borderRightWidth} ${cs.borderRightStyle} ${cs.borderRightColor}`,
            `border-bottom:${cs.borderBottomWidth} ${cs.borderBottomStyle} ${cs.borderBottomColor}`,
            `border-left:${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}`,
            `padding:${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
            `white-space:normal`,
          ].join(";");

          const rowSpan = cell.getAttribute("rowspan");
          const colSpan = cell.getAttribute("colspan");
          const spanAttrs = `${rowSpan ? ` rowspan="${rowSpan}"` : ""}${colSpan ? ` colspan="${colSpan}"` : ""}`;
          return `<td${spanAttrs} style="${styles}">${text}</td>`;
        })
        .join("");
      return `<tr>${htmlCells}</tr>`;
    })
    .join("");

  return `<table style="border-collapse:collapse;border-spacing:0;">${htmlRows}</table>`;
}

async function copyTablePayload(text, html) {
  if (window.ClipboardItem && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      "text/plain": new Blob([text], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    });
    await navigator.clipboard.write([item]);
    return;
  }
  await navigator.clipboard.writeText(text);
}

function currentMetricMap() {
  return activeMetricMap || metricMap;
}

function currentSchemaRows() {
  return activeSchemaRows || allSchemaRows;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value).trim();
  if (!text) return NaN;
  const normalized = text.replace(/[,%￥¥]/g, "").replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: (results) => resolve(results.data),
      error: (err) => reject(err),
    });
  });
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("读取 Excel 文件失败"));
    reader.readAsArrayBuffer(file);
  });
}

function normalizeMetricName(name) {
  return String(name || "")
    .trim()
    .replace(/^[0-9]+[\-_.、\s]*/, "")
    .replace(/\s+/g, " ");
}

function normalizeGroupName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-（）()【】\[\]]+/g, "");
}

function detectGroupRole(name) {
  const raw = String(name ?? "").trim();
  const normalized = normalizeGroupName(raw);

  const holdbackPatterns = [/^holdback$/, /^holdout$/, /^reserve$/];
  const controlPatterns = [
    /^control$/,
    /^对照组?$/,
    /^false$/,
    /^baseline$/,
    /^ctrl$/,
    /^对照$/,
  ];
  const experimentPatterns = [
    /^test$/,
    /^true$/,
    /^实验组?\d*$/,
    /^实验\d+$/,
    /^test\d+$/,
    /^variant[a-z0-9]*$/,
    /^treatment$/,
    /^实验$/,
  ];

  if (holdbackPatterns.some((p) => p.test(normalized))) return "holdback";
  if (controlPatterns.some((p) => p.test(normalized))) return "control";
  if (experimentPatterns.some((p) => p.test(normalized))) return "experiment";
  return "other";
}

function sortGroups(groups) {
  return [...groups].sort((a, b) => {
    const rolePriority = { holdback: 0, control: 1, experiment: 2, other: 3 };
    const aRole = detectGroupRole(a);
    const bRole = detectGroupRole(b);
    const aPriority = rolePriority[aRole] ?? 99;
    const bPriority = rolePriority[bRole] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return String(a).localeCompare(String(b), "zh-CN");
  });
}

/** 基准组 + 与其对比的若干组：有 holdback → 基准为 holdback，其余（含 control、各实验组）均与其对比；无 holdback → 基准为 control，全部实验组各自与 control 对比；再否则为第一组 vs 其余。 */
function buildComparisonPlan(groups) {
  const uniq = [...new Set(groups.map((g) => String(g ?? "").trim()))].filter(Boolean);
  if (!uniq.length) return { baseline: "", variants: [] };

  const sorted = sortGroups(uniq);
  const holdbackName = sorted.find((g) => detectGroupRole(g) === "holdback");
  if (holdbackName) {
    const variants = sortGroups(uniq.filter((g) => g !== holdbackName));
    return { baseline: holdbackName, variants };
  }

  const controlName = sorted.find((g) => detectGroupRole(g) === "control");
  const experimentNames = sorted.filter((g) => detectGroupRole(g) === "experiment");
  if (controlName && experimentNames.length) {
    return { baseline: controlName, variants: sortGroups(experimentNames) };
  }

  if (sorted.length >= 2) {
    return { baseline: sorted[0], variants: sorted.slice(1) };
  }
  return { baseline: sorted[0], variants: [] };
}

function formatMetricValue(metricName, value, isSampleRow = false) {
  if (!Number.isFinite(value)) return "-";
  if (isSampleRow) return Math.round(value).toLocaleString("en-US");

  if (/人均主动ABA数|人均发起聊天数/.test(metricName)) {
    return value.toFixed(2);
  }

  const rateLike = /率/.test(metricName) || /^D[17]留存率$/.test(metricName);
  if (rateLike) return `${(value * 100).toFixed(2)}%`;

  const countLike = /人数|样本/.test(metricName);
  if (countLike) return Math.round(value).toLocaleString("en-US");

  const amountLike = /收入|金额/.test(metricName);
  if (amountLike) return `¥${Math.round(value).toLocaleString("en-US")}`;

  return value.toFixed(2);
}

function formatUplift(ratio) {
  if (!Number.isFinite(ratio)) return "-";
  return `${(ratio * 100).toFixed(2)}%`;
}

function formatProb(p, reason = "") {
  if (!Number.isFinite(p)) return reason ? `无法准确算（${reason}）` : "无法准确算（缺原始分布）";
  return `${(p * 100).toFixed(2)}%`;
}

function getProbCellClass(p) {
  if (!Number.isFinite(p)) return "";
  if (p >= 0.95) return "prob-high";
  if (p <= 0.05) return "prob-low";
  return "";
}

function randomNormal() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleGamma(shape, scale = 1) {
  if (shape <= 0 || scale <= 0) return NaN;
  if (shape < 1) {
    const u = Math.random();
    return sampleGamma(shape + 1, scale) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    const x = randomNormal();
    let v = 1 + c * x;
    if (v <= 0) continue;
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return scale * d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return scale * d * v;
  }
}

function sampleBeta(alpha, beta) {
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x + y <= 0) return NaN;
  return x / (x + y);
}

function bayesArpu(alphaA, betaA, kA, thetaA, alphaB, betaB, kB, thetaB, mSamples) {
  if (
    alphaA <= 0 ||
    betaA <= 0 ||
    alphaB <= 0 ||
    betaB <= 0 ||
    kA <= 0 ||
    thetaA <= 0 ||
    kB <= 0 ||
    thetaB <= 0
  ) {
    return { convProbBbeatsA: NaN, revProbBbeatsA: NaN, arpuProbBbeatsA: NaN };
  }
  let convWins = 0;
  let revWins = 0;
  let arpuWins = 0;
  for (let i = 0; i < mSamples; i += 1) {
    const lambdaA = sampleBeta(alphaA, betaA);
    const lambdaB = sampleBeta(alphaB, betaB);
    const omegaA = sampleGamma(kA, thetaA);
    const omegaB = sampleGamma(kB, thetaB);
    if (lambdaB > lambdaA) convWins += 1;
    if (1 / omegaB > 1 / omegaA) revWins += 1;
    if (lambdaB / omegaB > lambdaA / omegaA) arpuWins += 1;
  }
  return {
    convProbBbeatsA: convWins / mSamples,
    revProbBbeatsA: revWins / mSamples,
    arpuProbBbeatsA: arpuWins / mSamples,
  };
}

function bayesConversionProb(totalA, successA, totalB, successB, mSamples) {
  if (
    !Number.isFinite(totalA) ||
    !Number.isFinite(successA) ||
    !Number.isFinite(totalB) ||
    !Number.isFinite(successB) ||
    totalA <= 0 ||
    totalB <= 0 ||
    successA < 0 ||
    successB < 0 ||
    successA > totalA ||
    successB > totalB
  ) {
    return NaN;
  }
  const alphaA = successA + 1;
  const betaA = totalA - successA + 1;
  const alphaB = successB + 1;
  const betaB = totalB - successB + 1;
  let wins = 0;
  for (let i = 0; i < mSamples; i += 1) {
    if (sampleBeta(alphaB, betaB) > sampleBeta(alphaA, betaA)) wins += 1;
  }
  return wins / mSamples;
}

function bayesMeanProb(meanA, sampleA, meanB, sampleB, mSamples) {
  if (
    !Number.isFinite(meanA) ||
    !Number.isFinite(meanB) ||
    !Number.isFinite(sampleA) ||
    !Number.isFinite(sampleB) ||
    sampleA <= 0 ||
    sampleB <= 0 ||
    meanA < 0 ||
    meanB < 0
  ) {
    return NaN;
  }
  const totalA = meanA * sampleA;
  const totalB = meanB * sampleB;
  const shapeA = totalA + 1;
  const shapeB = totalB + 1;
  const scaleA = 1 / (sampleA + 1);
  const scaleB = 1 / (sampleB + 1);
  let wins = 0;
  for (let i = 0; i < mSamples; i += 1) {
    if (sampleGamma(shapeB, scaleB) > sampleGamma(shapeA, scaleA)) wins += 1;
  }
  return wins / mSamples;
}

function getProbabilityRepeatRuns(mSamples) {
  if (!Number.isFinite(mSamples)) return 2;
  if (mSamples >= 100000) return 3;
  return 2;
}

function stableProbabilityEstimate(estimator, repeatRuns) {
  const values = [];
  for (let i = 0; i < repeatRuns; i += 1) {
    const val = estimator();
    if (Number.isFinite(val)) values.push(val);
  }
  if (!values.length) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const DIMENSION_KEYWORDS = [
  "vip来源",
  "国籍",
  "性别",
  "年龄",
  "操作系统",
  "注册天数",
  "vip付费价值",
];

function normalizeDimensionKeyName(key) {
  return String(key ?? "")
    .trim()
    .toLowerCase()
    .replace(/【分组维度】/g, "")
    .replace(/\s+/g, "");
}

function formatDimensionLabel(key) {
  return String(key ?? "").replace(/【分组维度】/g, "").trim() || String(key ?? "").trim();
}

function detectDimensionCandidates(rows) {
  if (!rows.length) return [];
  const reserved = new Set([
    "指标类型",
    "样本人数",
    "D0",
    "D1",
    "D3",
    "D7",
    "周期均值",
  ]);
  const keys = Object.keys(rows[0]).filter((k) => !reserved.has(k) && !String(k).trim().startsWith("@"));
  const candidates = [];

  keys.forEach((key, idx) => {
    const normalizedKey = normalizeDimensionKeyName(key);
    const uniqueValues = new Set(
      rows
        .map((r) => String(r[key] ?? "").trim())
        .filter((v) => v && !/^null$/i.test(v) && v !== "不参与分组")
    );
    if (uniqueValues.size < 2) return;

    let score = 0;
    if (/分组维度/.test(key)) score += 100;
    if (DIMENSION_KEYWORDS.some((kw) => normalizedKey.includes(kw))) score += 80;
    if (/任务|名称|编号|id|日期|时间/i.test(key)) score -= 80;
    if (uniqueValues.size <= 50) score += 10;

    candidates.push({ key, idx, score });
  });

  if (!candidates.length) return [];
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });
  return candidates.map((c) => ({
    key: c.key,
    normalized: normalizeDimensionKeyName(c.key),
    label: formatDimensionLabel(c.key),
  }));
}

function detectDimensionKey(rows) {
  const candidates = detectDimensionCandidates(rows);
  return candidates[0]?.key || "";
}

function mapDimensionValue(dimKey, rawValue) {
  const raw = String(rawValue ?? "").trim();
  if (!dimKey) return { keep: true, label: "全部", order: 0 };
  if (!raw || /^null$/i.test(raw)) return { keep: false, label: "", order: 9999 };

  if (/VIP付费价值类型/.test(dimKey)) {
    const normalized = raw.replace(/\.0+$/, "");
    const valueMap = {
      "1": { label: "超高价值", order: 1 },
      "2": { label: "高价值", order: 2 },
      "3": { label: "中价值", order: 3 },
      "4": { label: "低价值", order: 4 },
    };
    if (normalized === "0") return { keep: false, label: "", order: 9999 };
    if (valueMap[normalized]) return { keep: true, ...valueMap[normalized] };
    // 兜底：未知编码放最后，但仍可展示
    return { keep: true, label: normalized, order: 9998 };
  }

  return { keep: true, label: raw, order: 5000 };
}

function extractSchemaRows(rows, dimKey = "") {
  return rows
    .map((row) => {
      const dimInfo = mapDimensionValue(dimKey, row[dimKey]);
      return {
        group: String(row["@实验分组"] ?? "").trim(),
        metricRaw: String(row["指标类型"] ?? "").trim(),
        metric: normalizeMetricName(row["指标类型"]),
        dimension: dimInfo.label,
        dimensionOrder: dimInfo.order,
        keepDimension: dimInfo.keep,
        sample: toNumber(row["样本人数"]),
        d0: toNumber(row["D0"]),
        d1: toNumber(row["D1"]),
        d3: toNumber(row["D3"]),
        d7: toNumber(row["D7"]),
        period: toNumber(row["周期均值"]),
      };
    })
    .filter((r) => {
      if (!r.group || !r.metricRaw) return false;
      if (!dimKey) return true;
      return r.keepDimension;
    });
}

function buildMetricMap(schemaRows) {
  const map = new Map();
  schemaRows.forEach((row) => {
    if (!map.has(row.metric)) map.set(row.metric, new Map());
    map.get(row.metric).set(row.group, row);
  });
  return map;
}

function buildDimensionContexts(schemaRows, dimKey) {
  if (dimKey) {
    const dimMeta = new Map();
    schemaRows.forEach((r) => {
      const existing = dimMeta.get(r.dimension);
      if (!existing || r.dimensionOrder < existing.order) {
        dimMeta.set(r.dimension, { label: r.dimension, order: r.dimensionOrder });
      }
    });
    const dimValues = [...dimMeta.values()].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return String(a.label).localeCompare(String(b.label), "zh-CN");
    });
    return dimValues.map((dimInfo) => {
      const dim = dimInfo.label;
      const dimRows = schemaRows.filter((r) => r.dimension === dim);
      const groups = sortGroups([...new Set(dimRows.map((r) => r.group))]);
      return { label: dim, rows: dimRows, metricMap: buildMetricMap(dimRows), groups };
    });
  }

  const groups = sortGroups([...new Set(schemaRows.map((r) => r.group))]);
  return [{ label: "整体", rows: schemaRows, metricMap: buildMetricMap(schemaRows), groups }];
}

function findPrimaryPurchaseMetric() {
  const keys = [...currentMetricMap().keys()];
  return keys.find((k) => /购买人数/.test(k)) || null;
}

function findPrimaryPurchaseRateMetric() {
  const keys = [...currentMetricMap().keys()];
  return keys.find((k) => /购买率/.test(k)) || null;
}

function getPurchaseCountForGroup(group) {
  const count = getCountWithFallback(group, /购买人数/, /购买率/);
  if (Number.isFinite(count)) return count;

  // 二级兜底：购买人数 = 总收入 / ARPPU
  const totalRevenue = getMetricPeriodByMatcher(/总收入|收入|金额/, group);
  const arppu = getMetricPeriodByMatcher(/ARPPU/i, group);
  if (Number.isFinite(totalRevenue) && Number.isFinite(arppu) && arppu > 0) return totalRevenue / arppu;
  return NaN;
}

/** 从指标名去掉尾部 ARPPU/ARPU，用于匹配同系列的「人数/率/收入」列（忽略空格差异）。 */
function getArpuStemInfo(label) {
  const s = String(label ?? "").trim();
  let m = s.match(/^(.+?)\s*ARPPU\s*$/i);
  if (m) return { stem: m[1].trim(), kind: "arppu" };
  m = s.match(/^(.+?)\s*ARPU\s*$/i);
  if (m) return { stem: m[1].trim(), kind: "arpu" };
  return null;
}

function isTerminalArpuFamilyKey(k) {
  const t = String(k ?? "")
    .trim()
    .replace(/\s/g, "");
  return /ARPPU$/i.test(t) || /ARPU$/i.test(t);
}

function stemMatchingKeys(stem) {
  const compactStem = stem.replace(/\s/g, "");
  return [...currentMetricMap().keys()]
    .filter((k) => {
      if (isTerminalArpuFamilyKey(k)) return false;
      const compactK = k.replace(/\s/g, "");
      return k.startsWith(stem) || compactK.startsWith(compactStem);
    })
    .sort((a, b) => b.length - a.length);
}

function getMetricPeriodForKey(key, group) {
  if (!key) return NaN;
  return currentMetricMap().get(key)?.get(group)?.period;
}

/** 与某 ARPU/ARPPU 前缀同系列的转化人数：优先「人数」列，否则 样本人数×同系列「率」，再否则 收入/ARPPU。 */
function getPurchaseCountForStem(group, stem) {
  const keys = stemMatchingKeys(stem);
  const countKey = keys.find((k) => /人数/.test(k) && !/率/.test(k));
  if (countKey) {
    const v = getMetricPeriodForKey(countKey, group);
    if (Number.isFinite(v)) return v;
  }
  const rateKey = keys.find((k) => /率/.test(k));
  const sample = getGroupBaseSample(group);
  const rate = rateKey ? getMetricPeriodForKey(rateKey, group) : NaN;
  if (Number.isFinite(rate) && Number.isFinite(sample)) return rate * sample;
  const revKey = keys.find((k) => /收入|金额/.test(k));
  const arppuKey = keys.find((k) => /ARPPU/i.test(k));
  const rev = revKey ? getMetricPeriodForKey(revKey, group) : NaN;
  const arppu = arppuKey ? getMetricPeriodForKey(arppuKey, group) : NaN;
  if (Number.isFinite(rev) && Number.isFinite(arppu) && arppu > 0) return rev / arppu;
  return NaN;
}

function findMetricKeyByMatcher(matcher) {
  const keys = [...currentMetricMap().keys()];
  return keys.find((k) => matcher.test(k)) || null;
}

function getMetricPeriodByMatcher(matcher, group) {
  const key = findMetricKeyByMatcher(matcher);
  if (!key) return NaN;
  return currentMetricMap().get(key)?.get(group)?.period;
}

function getCountWithFallback(group, countMatcher, rateMatcher) {
  const sample = getGroupBaseSample(group);
  const directCount = getMetricPeriodByMatcher(countMatcher, group);
  if (Number.isFinite(directCount)) return directCount;
  const rate = getMetricPeriodByMatcher(rateMatcher, group);
  if (Number.isFinite(rate) && Number.isFinite(sample)) return rate * sample;
  return NaN;
}

function getRateWithFallback(group, rateMatcher, countMatcher) {
  const sample = getGroupBaseSample(group);
  const directRate = getMetricPeriodByMatcher(rateMatcher, group);
  if (Number.isFinite(directRate)) return directRate;
  const count = getMetricPeriodByMatcher(countMatcher, group);
  if (Number.isFinite(count) && Number.isFinite(sample) && sample > 0) return count / sample;
  return NaN;
}

function getGroupBaseSample(group) {
  const counts = new Map();
  currentSchemaRows().forEach((r) => {
    if (String(r.group ?? "").trim() !== group) return;
    const sample = toNumber(r.sample);
    if (!Number.isFinite(sample)) return;
    const key = String(sample);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  let best = NaN;
  let bestCount = -1;
  counts.forEach((count, key) => {
    if (count > bestCount) {
      best = Number(key);
      bestCount = count;
    }
  });
  return best;
}

function buildOutputRows() {
  const rows = [{ type: "sample", label: "样本人数", metricBase: null, day: null }];
  const orderedMetrics = [];
  const seen = new Set();
  allSchemaRows.forEach((r) => {
    const m = r.metric;
    if (!m || seen.has(m)) return;
    seen.add(m);
    orderedMetrics.push(m);
  });
  orderedMetrics.forEach((metric) => {
    if (metric === "留存率") {
      rows.push({ type: "metric", label: "D1留存率", metricBase: metric, day: "d1" });
      rows.push({ type: "metric", label: "D7留存率", metricBase: metric, day: "d7" });
    } else {
      rows.push({ type: "metric", label: metric, metricBase: metric, day: "period" });
    }
  });
  return rows;
}

function getMetricValueByGroup(outputRow, group) {
  if (outputRow.type === "sample") return getGroupBaseSample(group);
  const row = currentMetricMap().get(outputRow.metricBase)?.get(group);
  if (!row) return NaN;
  if (outputRow.day === "d1") return row.d1;
  if (outputRow.day === "d3") return row.d3;
  if (outputRow.day === "d7") return row.d7;
  return row.period;
}

function shouldComputeStats(outputRow) {
  if (outputRow.type === "sample") return false;
  const label = outputRow.label;
  // 名称含「率」的率值类（含点击率、续费率等）；ARPPU/ARPU 行本身不含独立「率」字则走均值类
  const rateLike = /率/.test(label) || /^D[17]留存率$/.test(label);
  const meanLike = /ARPU|ARPPU|人均|均值/i.test(label);
  return rateLike || meanLike;
}

function calcWinProbDetail(outputRow, controlGroup, expGroup, mSamples) {
  const rowA = currentMetricMap().get(outputRow.metricBase)?.get(controlGroup);
  const rowB = currentMetricMap().get(outputRow.metricBase)?.get(expGroup);
  if (!rowA || !rowB) return { prob: NaN, reason: "缺少分组原始数据" };

  const label = outputRow.label;
  const valA = getMetricValueByGroup(outputRow, controlGroup);
  const valB = getMetricValueByGroup(outputRow, expGroup);
  if (!Number.isFinite(valA) || !Number.isFinite(valB)) return { prob: NaN, reason: "指标值缺失" };

  const rateLike = /率/.test(label) || /^D[17]留存率$/.test(label);
  const arppuLike = /ARPPU/i.test(label);
  const arpuLike = /ARPU/i.test(label) && !arppuLike;
  const repeatRuns = getProbabilityRepeatRuns(mSamples);

  // 率值类：分子≈成功次数，分母=样本人数；新增名称带「率」的指标会自动走此分支
  if (rateLike) {
    const successA = valA * rowA.sample;
    const successB = valB * rowB.sample;
    return {
      prob: stableProbabilityEstimate(() =>
        bayesConversionProb(rowA.sample, successA, rowB.sample, successB, mSamples)
      , repeatRuns),
      reason: "",
    };
  }

  // 人均主动ABA数：分母=样本人数，转化人数=达成主动ABA人数，转化收益=人均*样本人数
  if (/人均主动ABA数/.test(label)) {
    const reachA = getCountWithFallback(controlGroup, /达成主动ABA人数/, /达成主动ABA转化率/);
    const reachB = getCountWithFallback(expGroup, /达成主动ABA人数/, /达成主动ABA转化率/);
    if (
      !Number.isFinite(reachA) ||
      !Number.isFinite(reachB) ||
      reachA > rowA.sample ||
      reachB > rowB.sample
    ) {
      return { prob: NaN, reason: "缺少依赖指标: 达成主动ABA人数或达成主动ABA转化率" };
    }
    const revA = valA * rowA.sample;
    const revB = valB * rowB.sample;
    return {
      prob: stableProbabilityEstimate(() => {
        const res = bayesArpu(
          reachA + 1,
          rowA.sample - reachA + 1,
          reachA + 1,
          1 / (1 + revA),
          reachB + 1,
          rowB.sample - reachB + 1,
          reachB + 1,
          1 / (1 + revB),
          mSamples
        );
        return res.arpuProbBbeatsA;
      }, repeatRuns),
      reason: "",
    };
  }

  // 人均发起聊天数：分母=样本人数，转化人数=发起新聊天率*样本人数，转化收益=人均*样本人数
  if (/人均发起聊天/.test(label)) {
    const rateA = getRateWithFallback(controlGroup, /发起新聊天率/, /发起新聊天人数/);
    const rateB = getRateWithFallback(expGroup, /发起新聊天率/, /发起新聊天人数/);
    if (!Number.isFinite(rateA) || !Number.isFinite(rateB)) {
      return { prob: NaN, reason: "缺少依赖指标: 发起新聊天率(样本)或发起新聊天人数" };
    }
    const successA = rateA * rowA.sample;
    const successB = rateB * rowB.sample;
    if (successA > rowA.sample || successB > rowB.sample) {
      return { prob: NaN, reason: "发起新聊天率(样本)异常" };
    }
    const revA = valA * rowA.sample;
    const revB = valB * rowB.sample;
    return {
      prob: stableProbabilityEstimate(() => {
        const res = bayesArpu(
          successA + 1,
          rowA.sample - successA + 1,
          successA + 1,
          1 / (1 + revA),
          successB + 1,
          rowB.sample - successB + 1,
          successB + 1,
          1 / (1 + revB),
          mSamples
        );
        return res.arpuProbBbeatsA;
      }, repeatRuns),
      reason: "",
    };
  }

  if (arppuLike || arpuLike) {
    const totalA = getGroupBaseSample(controlGroup);
    const totalB = getGroupBaseSample(expGroup);
    const stemInfo = getArpuStemInfo(label);
    const successA = stemInfo
      ? getPurchaseCountForStem(controlGroup, stemInfo.stem)
      : getPurchaseCountForGroup(controlGroup);
    const successB = stemInfo
      ? getPurchaseCountForStem(expGroup, stemInfo.stem)
      : getPurchaseCountForGroup(expGroup);
    if (!Number.isFinite(successA) || !Number.isFinite(successB)) {
      return {
        prob: NaN,
        reason: stemInfo
          ? `缺少依赖指标: 与「${stemInfo.stem}」同系列的购买/订阅人数、率或收入`
          : "缺少依赖指标: VIP新购购买人数/购买率/总收入/ARPPU",
      };
    }
    if (
      !Number.isFinite(totalA) ||
      !Number.isFinite(totalB) ||
      successA > totalA ||
      successB > totalB
    ) {
      return { prob: NaN, reason: "购买人数或样本人数异常" };
    }
    const revA = arppuLike ? valA * successA : valA * totalA;
    const revB = arppuLike ? valB * successB : valB * totalB;
    return {
      prob: stableProbabilityEstimate(() => {
        const res = bayesArpu(
          successA + 1,
          totalA - successA + 1,
          successA + 1,
          1 / (1 + revA),
          successB + 1,
          totalB - successB + 1,
          successB + 1,
          1 / (1 + revB),
          mSamples
        );
        return arppuLike ? res.revProbBbeatsA : res.arpuProbBbeatsA;
      }, repeatRuns),
      reason: "",
    };
  }

  return {
    prob: stableProbabilityEstimate(
      () => bayesMeanProb(valA, rowA.sample, valB, rowB.sample, mSamples),
      repeatRuns
    ),
    reason: "",
  };
}

function renderTable(target, outputRows, mSamples) {
  target.thead.innerHTML = "";
  target.tbody.innerHTML = "";

  const plans = dimensionContexts.map((c) => buildComparisonPlan(c.groups));

  const headerTop = document.createElement("tr");
  let headerTopHtml = `<th class="metric-col" rowspan="2">指标类型</th>`;
  dimensionContexts.forEach((c, i) => {
    const span = 1 + 3 * plans[i].variants.length;
    headerTopHtml += `<th colspan="${span}">${c.label}</th>`;
  });
  headerTop.innerHTML = headerTopHtml;

  const headerSub = document.createElement("tr");
  let headerSubHtml = "";
  plans.forEach((plan) => {
    headerSubHtml += `<th class="data-col-head">${plan.baseline || "-"}</th>`;
    plan.variants.forEach((v) => {
      headerSubHtml += `<th class="data-col-head">${v}</th><th class="data-col-head">uplift</th><th class="data-col-head">胜出概率</th>`;
    });
  });
  headerSub.innerHTML = headerSubHtml;
  target.thead.appendChild(headerTop);
  target.thead.appendChild(headerSub);

  outputRows.forEach((row) => {
    const tr = document.createElement("tr");
    let tds = `<td class="left">${row.label}</td>`;

    dimensionContexts.forEach((ctx, i) => {
      activeMetricMap = ctx.metricMap;
      activeSchemaRows = ctx.rows;
      const plan = plans[i];
      const baseline = plan.baseline;
      const vBase = baseline ? getMetricValueByGroup(row, baseline) : NaN;

      tds += `<td class="data-col">${formatMetricValue(row.label, vBase, row.type === "sample")}</td>`;

      plan.variants.forEach((variant) => {
        const vv = getMetricValueByGroup(row, variant);
        let upliftText = "-";
        let probText = "-";
        let probClass = "";
        if (baseline && variant && shouldComputeStats(row)) {
          const uplift =
            Number.isFinite(vBase) && Number.isFinite(vv) && vBase !== 0 ? vv / vBase - 1 : NaN;
          const probDetail = calcWinProbDetail(row, baseline, variant, mSamples);
          upliftText = formatUplift(uplift);
          probText = formatProb(probDetail.prob, probDetail.reason);
          probClass = getProbCellClass(probDetail.prob);
          if (!Number.isFinite(probDetail.prob)) probClass = `${probClass} prob-error`.trim();
        }

        tds += `
        <td class="data-col">${formatMetricValue(row.label, vv, row.type === "sample")}</td>
        <td class="data-col">${upliftText}</td>
        <td class="data-col prob-cell ${probClass}">${probText}</td>`;
      });
    });

    tr.innerHTML = tds;
    target.tbody.appendChild(tr);
  });
  activeMetricMap = null;
  activeSchemaRows = null;
}

function validateSchema(rows) {
  if (!rows.length) return "文件为空";
  const required = ["@实验分组", "指标类型", "样本人数", "周期均值"];
  const first = rows[0];
  const missing = required.filter((k) => !(k in first));
  if (missing.length) return `缺少列：${missing.join(", ")}`;
  return "";
}

async function handleFileUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  fileNameText.textContent =
    files.length === 1 ? files[0].name : `已选择 ${files.length} 个文件`;

  uploadedDatasets = [];
  resultContainer.innerHTML = "";

  let successCount = 0;
  const failed = [];
  for (const file of files) {
    try {
      setStatus(`正在读取文件：${file.name}`);
      let rows = [];
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".csv")) rows = await parseCsv(file);
      else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) rows = await parseExcel(file);
      else throw new Error("只支持 CSV / XLSX / XLS");

      const schemaErr = validateSchema(rows);
      if (schemaErr) throw new Error(schemaErr);

      const dimCandidates = detectDimensionCandidates(rows);
      const autoDimensionKey = detectDimensionKey(rows);
      const autoDimensionLabel = autoDimensionKey ? formatDimensionLabel(autoDimensionKey) : "整体";

      uploadedDatasets.push({
        fileName: file.name,
        rawRows: rows,
        dimensionCandidates: dimCandidates,
        autoDimensionKey,
        autoDimensionLabel,
      });
      successCount += 1;
    } catch (err) {
      failed.push(`${file.name}: ${err.message}`);
    }
  }

  if (!successCount) {
    setStatus(`读取失败：${failed.join("；")}`, "error");
    return;
  }

  if (failed.length) {
    setStatus(`已读取 ${successCount}/${files.length} 个文件；失败：${failed.join("；")}`, "error");
  } else {
    const dimTips = uploadedDatasets
      .map((d) => `${escapeHTML(d.fileName)}: <span class="status-dim">${escapeHTML(d.autoDimensionLabel)}</span>`)
      .join("；");
    setStatus(`读取完成，共 ${successCount} 个文件。自动识别分组维度：${dimTips}`, "success", true);
  }
}

function runCalculation() {
  if (!uploadedDatasets.length) {
    setStatus("请先上传文件。", "error");
    return;
  }
  const mSamples = Number(sampleCountInput.value);
  if (!Number.isInteger(mSamples) || mSamples < 1000) {
    setStatus("模拟次数需为不小于 1000 的整数。", "error");
    return;
  }

  try {
    setStatus("正在计算，请稍候...");
    resultContainer.innerHTML = "";
    const warnings = [];

    uploadedDatasets.forEach((dataset) => {
      const effectiveDimensionKey = dataset.autoDimensionKey || "";

      const schemaRows = extractSchemaRows(dataset.rawRows, effectiveDimensionKey);
      const contexts = buildDimensionContexts(schemaRows, effectiveDimensionKey);

      allSchemaRows = schemaRows;
      dimensionKey = effectiveDimensionKey;
      dimensionContexts = contexts;
      metricMap = dimensionContexts[0]?.metricMap || new Map();

      if (!dimensionContexts.length) {
        warnings.push(`${dataset.fileName} 无可展示维度数据（空值/NULL 已过滤）`);
        return;
      }
      const invalidContexts = dimensionContexts.filter((c) => c.groups.length < 2).map((c) => c.label);
      if (invalidContexts.length) {
        warnings.push(`${dataset.fileName} 以下维度分组不足2组：${invalidContexts.join("、")}`);
      }
      const outputRows = buildOutputRows();
      const target = createResultBlock(dataset.fileName);
      renderTable(target, outputRows, mSamples);
    });

    if (warnings.length) {
      setStatus(`计算完成（部分文件有提示）：${warnings.join("；")}`, "error");
    } else {
      const repeatRuns = getProbabilityRepeatRuns(mSamples);
      setStatus(
        `计算完成。胜出概率已自动重复模拟 ${repeatRuns} 次取均值；仅“率值/均值”指标计算 uplift 与胜出概率；维度空值/NULL 已自动过滤。`,
        "success"
      );
    }
  } catch (err) {
    setStatus(`计算失败：${err.message}`, "error");
  }
}
