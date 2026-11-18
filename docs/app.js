"use strict";
const get = id => document.getElementById(id);
const overlay = get("overlay");
const svgNS = "http://www.w3.org/2000/svg";
let active = 0;
let pending = Promise.resolve();
let activePreview;
let result;
let currentName;

function message(text, error = false) {
  get("summary").textContent = text;
  get("summary").classList.toggle("error", error);
}

function svgNode(name, attributes, text) {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text) element.textContent = text;
  return element;
}

function paint(data) {
  const {width, height, detections} = data;
  overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
  overlay.replaceChildren();
  const list = get("results");
  list.replaceChildren();
  const font = Math.max(12, width * 0.025);
  detections.forEach(({bbox: [x, y, r, b], score}, index) => {
    const label = `${index + 1}  ${(100 * score).toFixed(1)}%`;
    const tabY = Math.max(0, y - 1.24 * font);
    overlay.append(
      svgNode("rect", {x, y, width: r-x, height: b-y, fill: "none", stroke: "#2095ff",
                       "stroke-width": 3, "vector-effect": "non-scaling-stroke"}),
      svgNode("rect", {x, y: tabY, width: font * 4.45, height: font * 1.24, fill: "#125bd6"}),
      svgNode("text", {x: x + .2 * font, y: tabY + .91 * font, fill: "white",
                       "font-size": font, "font-weight": 700}, label),
    );
    const item = document.createElement("li");
    const title = document.createElement("span");
    const value = document.createElement("b");
    title.textContent = `牛脸 ${index + 1}`;
    value.textContent = (100 * score).toFixed(1) + "%";
    item.append(title, value);
    list.append(item);
  });
  get("photo").src = data.preview;
  get("blank").hidden = true;
  get("photo-view").hidden = false;
  get("dimensions").textContent = `${width} × ${height} 像素`;
  get("dimensions").hidden = false;
  get("latency").textContent = `${data.inference_ms} ms`;
  get("threshold").textContent = `${(100 * data.threshold).toFixed(0)}%`;
  get("metrics").hidden = false;
  get("output-actions").hidden = false;
  get("toggle").disabled = detections.length === 0;
  get("toggle").textContent = "隐藏蓝框";
  get("toggle").setAttribute("aria-pressed", "true");
  overlay.hidden = false;
  message(detections.length ? `找到 ${detections.length} 张牛脸` : "未检测到牛脸");
}

async function detect(file, name) {

  const request = ++active;
  currentName = name;
  result = null;
  get("file-description").textContent = name;
  get("results").replaceChildren();
  for (const id of ["dimensions", "metrics", "output-actions", "photo-view"]) get(id).hidden = true;
  get("blank").hidden = false;
  message("正在检测牛脸");
  try {
    if (file.size > 12 * 1024 * 1024) throw new Error("照片超过 12 MiB，请缩小后重试。");
    const job = pending.then(() => request === active ? cowFace.detect(file) : null);
    pending = job.catch(() => {});
    const data = await job;
    if (!data) return;
    if (request !== active) { URL.revokeObjectURL(data.preview); return; }
    if (activePreview) URL.revokeObjectURL(activePreview);
    activePreview = data.preview;
    result = data;
    paint(data);
  } catch (error) {
    if (request === active && error.name !== "AbortError") message(error.message || "检测失败，请重试。", true);
  }
}

get("file").addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) detect(file, file.name);
  event.target.value = "";
});
get("sample").addEventListener("click", async () => {
  const generation = active;
  try {
    const response = await fetch("./example.jpg");
    if (!response.ok) throw new Error("样图暂时无法读取。");
    const file = await response.blob();
    if (generation === active) detect(file, "双牛样图 · 000001000175.jpg");
  } catch (error) {
    if (generation === active) message(error.message, true);
  }
});

const workspace = document.querySelector(".workspace");
workspace.addEventListener("dragover", event => {event.preventDefault(); workspace.classList.add("dragging");});
workspace.addEventListener("dragleave", event => {
  if (!workspace.contains(event.relatedTarget)) workspace.classList.remove("dragging");
});
workspace.addEventListener("drop", event => {
  event.preventDefault();
  workspace.classList.remove("dragging");
  const file = event.dataTransfer.files[0];
  if (file) detect(file, file.name);
});
get("toggle").addEventListener("click", () => {
  const hidden = overlay.hasAttribute("hidden");
  overlay.toggleAttribute("hidden", !hidden);
  get("toggle").textContent = hidden ? "隐藏蓝框" : "显示蓝框";
  get("toggle").setAttribute("aria-pressed", String(hidden));
});
get("download").addEventListener("click", () => {
  if (!result) return;
  const {preview, ...coordinates} = result;
  const file = new Blob([JSON.stringify(coordinates, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = currentName.replace(/\.[^.]+$/, "") + "-牛脸坐标.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
cowFace.load().then(({size}) => {
  get("health").textContent = `轻量正脸版 V5 · ${(size/1000000).toFixed(2)} MB`;
}).catch(() => { get("health").textContent = "模型加载失败，请刷新或换浏览器重试"; });
