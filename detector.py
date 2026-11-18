"""Run a single-class YOLO ONNX model and return EXIF-upright pixel boxes."""

import argparse
import hashlib
import io
import json
import math
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL = ROOT / "docs/cow-face-416.onnx"
MAX_PIXELS = 35_000_000


def decode_image(data):
    with Image.open(io.BytesIO(data)) as source:
        if source.width * source.height > MAX_PIXELS:
            raise ValueError("照片像素超过 3500 万，请缩小后重试。")
        return ImageOps.exif_transpose(source).convert("RGB")


def intersection_over_union(a, b):
    overlap = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(
        0, min(a[3], b[3]) - max(a[1], b[1])
    )
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - overlap
    return overlap / union if union else 0.0


class Detector:
    def __init__(self, weights=DEFAULT_MODEL, *, threshold=None, iou=None, threads=4):
        self.weights = Path(weights)
        config_path = self.weights.with_suffix(".json")
        config = json.loads(config_path.read_text()) if config_path.exists() else {}
        saved_threshold = config.get("confidence", config.get("threshold", 0.5))
        self.threshold = float(saved_threshold if threshold is None else threshold)
        self.iou = float(config.get("nms_iou", 0.45) if iou is None else iou)
        if not 0 < self.threshold <= 1 or not 0 < self.iou <= 1:
            raise ValueError("Invalid detection or NMS threshold")
        if config.get("onnx_sha256"):
            with self.weights.open("rb") as stream:
                if hashlib.file_digest(stream, "sha256").hexdigest() != config["onnx_sha256"]:
                    raise ValueError("ONNX does not match the frozen configuration")
        options = ort.SessionOptions()
        options.intra_op_num_threads = threads
        self.session = ort.InferenceSession(str(weights), options, providers=["CPUExecutionProvider"])
        (self.input,) = self.session.get_inputs()
        _, channels, self.height, self.width = self.input.shape
        if channels != 3 or not isinstance(self.height, int) or not isinstance(self.width, int):
            raise ValueError("Expected a fixed-size NCHW RGB model")
        self.version = config.get("version") or config.get("source_candidate") or self.weights.stem
        self.max_detections = int(config.get("max_detections", 300))

    def detect(self, image, *, threshold=None):
        start = time.perf_counter()
        cutoff = self.threshold if threshold is None else threshold
        ratio = min(self.width / image.width, self.height / image.height)
        w, h = max(1, round(image.width * ratio)), max(1, round(image.height * ratio))
        left, top = (self.width - w) // 2, (self.height - h) // 2
        padded = Image.new("RGB", (self.width, self.height), (114, 114, 114))
        padded.paste(image.resize((w, h), Image.Resampling.BILINEAR), (left, top))
        pixels = np.asarray(padded, dtype=np.float32).transpose(2, 0, 1)[None] / 255
        (logits,) = self.session.run(None, {self.input.name: np.ascontiguousarray(pixels)})
        if logits.ndim != 3 or logits.shape[0] != 1 or 5 not in logits.shape[1:]:
            raise ValueError(f"Unexpected single-class output shape: {logits.shape}")
        candidates = logits[0].T if logits.shape[1] == 5 else logits[0]
        candidates = candidates[(candidates[:, 4] >= cutoff) & np.isfinite(candidates).all(axis=1)]
        candidates = candidates[np.argsort(-candidates[:, 4], kind="stable")]
        sx, sy = image.width / w, image.height / h
        kept = []
        for x, y, bw, bh, score in candidates:
            if bw <= 0 or bh <= 0:
                continue
            box = [x-bw/2, y-bh/2, x+bw/2, y+bh/2]
            if any(intersection_over_union(box, other) > self.iou for other, _ in kept):
                continue
            kept.append((box, float(score)))
            if len(kept) >= self.max_detections:
                break
        matches = []
        for (x1, y1, x2, y2), score in kept:
            box = [max(0, math.floor((x1-left)*sx)), max(0, math.floor((y1-top)*sy)),
                   min(image.width, math.ceil((x2-left)*sx)), min(image.height, math.ceil((y2-top)*sy))]
            if box[2] > box[0] and box[3] > box[1]:
                matches.append({"bbox": box, "score": score})
        return {
            "model": self.version, "threshold": cutoff, "width": image.width, "height": image.height,
            "inference_ms": round(1000 * (time.perf_counter() - start), 2), "detections": matches,
        }


def annotate(image, detections):
    result = image.copy()
    draw = ImageDraw.Draw(result)
    width = max(2, round(max(image.size) / 425))
    for item in detections:
        x, y, r, b = item["bbox"]
        draw.rectangle((x, y, r-1, b-1), outline="#1269ec", width=width)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photo", type=Path)
    parser.add_argument("--weights", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--output", type=Path, help="Save a photo with blue detection boxes")
    opts = parser.parse_args()
    photo = decode_image(opts.photo.read_bytes())
    output = Detector(opts.weights).detect(photo)
    if opts.output:
        annotate(photo, output["detections"]).save(opts.output)
    print(json.dumps(output, ensure_ascii=False, indent=2))
