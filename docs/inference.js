"use strict";

window.cowFace = (() => {
  const modelHash = "d9d337fe0395953bf149c36c268888fd3755cab60e955d015231e3f3e542af7b";
  let ready;

  async function load() {
    if (ready) return ready;
    ready = (async () => {
      const [settings, weights] = await Promise.all(["cow-face-416.json", "cow-face-416.onnx"].map(async name => {
        const response = await fetch(new URL(name, document.baseURI));
        if (!response.ok) throw new Error("模型下载失败，请刷新页面后重试。");
        return name.endsWith(".json") ? response.json() : response.arrayBuffer();
      }));
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", weights)),
        value => value.toString(16).padStart(2, "0")).join("");
      if (hash !== modelHash || settings.onnx_sha256 !== hash) throw new Error("模型文件校验失败，请刷新重试。");
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = new URL("./", document.baseURI).href;
      const session = await ort.InferenceSession.create(weights, { executionProviders: ["wasm"] });
      return { session, settings, size: weights.byteLength };
    })().catch(error => { ready = undefined; throw error; });
    return ready;
  }

  // Pillow BILINEAR scales its triangular filter when reducing resolution.
  function taps(sourceSize, destinationSize) {
    const scale = sourceSize / destinationSize;
    const radius = Math.max(1, scale);
    return Array.from({length: destinationSize}, (_, i) => {
      const center = (i + 0.5) * scale;
      const first = Math.max(0, Math.floor(center - radius + 0.5));
      const end = Math.min(sourceSize, Math.floor(center + radius + 0.5));
      const weights = Array.from({length: end-first}, (_, k) =>
        Math.max(0, 1 - Math.abs((first + k + 0.5 - center) / radius)));
      const total = weights.reduce((sum, v) => sum + v, 0);
      return {first, weights: weights.map(v => Math.round(v / total * 4194304))};
    });
  }

  function nearestEven(value) {
    const n = Math.floor(value);
    return value - n === 0.5 ? n + n % 2 : Math.round(value);
  }

  function preprocess(img, side) {
    const width = img.naturalWidth, height = img.naturalHeight;
    if (!width || !height || width * height > 35000000) throw new Error("请选择像素不超过 3500 万的照片。");
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", {willReadFrequently: true});
    ctx.fillStyle = "black"; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    canvas.width = 1; canvas.height = 1;
    const scale = Math.min(side / width, side / height);
    const w = Math.max(1, nearestEven(width * scale)), h = Math.max(1, nearestEven(height * scale));
    const left = Math.floor((side-w)/2), top = Math.floor((side-h)/2);
    const xs = taps(width, w), ys = taps(height, h);
    const horizontal = new Uint8Array(height * w * 3);
    for (let y=0; y<height; y++) {
      for (let x=0; x<w; x++) {
        const {first, weights} = xs[x];
        for (let ch=0; ch<3; ch++) {
          let sum = 2097152;
          for (let k=0; k<weights.length; k++) sum += weights[k] * pixels[(y*width+first+k)*4+ch];
          horizontal[(y*w+x)*3+ch] = Math.min(255, Math.floor(sum / 4194304));
        }
      }
    }
    const plane = side*side, input = new Float32Array(plane*3).fill(114/255);
    for (let y=0; y<h; y++) {
      const {first, weights} = ys[y];
      for (let x=0; x<w; x++) {
        for (let ch=0; ch<3; ch++) {
          let sum = 2097152;
          for (let k=0; k<weights.length; k++) sum += weights[k] * horizontal[((first+k)*w+x)*3+ch];
          input[ch*plane+(top+y)*side+left+x] = Math.min(255, Math.floor(sum / 4194304))/255;
        }
      }
    }
    return {input, side, width, height, left, top, w, h};
  }

  function overlap(a, b) {
    const both = Math.max(0, Math.min(a[2],b[2])-Math.max(a[0],b[0])) *
      Math.max(0, Math.min(a[3],b[3])-Math.max(a[1],b[1]));
    return both / ((a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - both);
  }

  function decode(output, frame, settings) {
    const [batch, channels, n] = output.dims;
    if (batch !== 1 || channels !== 5) throw new Error("检测输出格式异常。");
    const a = output.data, proposals = [], kept = [];
    for (let i=0; i<n; i++) {
      const score=a[4*n+i], x=a[i], y=a[n+i], w=a[2*n+i], h=a[3*n+i];
      if (score >= settings.confidence && w>0 && h>0 && [score,x,y,w,h].every(Number.isFinite)) {
        proposals.push({bbox:[x-w/2,y-h/2,x+w/2,y+h/2], score});
      }
    }
    proposals.sort((p,q) => q.score-p.score);
    for (const p of proposals) {
      if (kept.some(q => overlap(p.bbox,q.bbox)>settings.nms_iou)) continue;
      kept.push(p);
      if (kept.length>=settings.max_detections) break;
    }
    const {width,height,w,h,left,top}=frame;
    return kept.map(({bbox:[x,y,r,b],score}) => ({
      bbox:[Math.max(0, Math.floor((x-left)*width/w)), Math.max(0, Math.floor((y-top)*height/h)),
            Math.min(width, Math.ceil((r-left)*width/w)), Math.min(height, Math.ceil((b-top)*height/h))],
      score
    })).filter(d=>d.bbox[2]>d.bbox[0] && d.bbox[3]>d.bbox[1]);
  }

  async function detect(file) {
    const {session,settings} = await load();
    const preview = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = preview; await img.decode();
      const start = performance.now(), frame = preprocess(img, settings.input_size);
      const tensor = new ort.Tensor("float32", frame.input, [1,3,frame.side,frame.side]);
      let outputs;
      try {
        outputs = await session.run({[session.inputNames[0]]:tensor});
        return {width:frame.width,height:frame.height,threshold:settings.confidence,model:settings.version,
          detections:decode(outputs[session.outputNames[0]],frame,settings),preview,
          inference_ms:Math.round((performance.now()-start)*10)/10};
      } finally {
        tensor.dispose();
        if (outputs) Object.values(outputs).forEach(t => t.dispose());
      }
    } catch (error) { URL.revokeObjectURL(preview); throw error; }
  }
  return {load,detect};
})();
