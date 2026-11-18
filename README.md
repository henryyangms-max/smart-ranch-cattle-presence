# 智能牧场 · 轻量牛脸检测

工作人员可在手机或电脑浏览器里选择一张实拍照片，查看每张牛脸的位置和分数。照片在当前设备处理。[打开在线测试网页](https://henryyangms-max.github.io/smart-ranch-cattle-presence/)

V5 的模型权重为 **5.38 MB**。完整包附有 ONNX 权重、同名配置、离线运行示例和逐图测试结果。开发者可在发布页单独下载权重与配置。[下载轻量模型包](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/download/cow-face-mobile-v5/cow-face-mobile-v5.zip) · [V5 发布页](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/tag/cow-face-mobile-v5)

| 冻结模型的独立测试 | 成功照片 |
|---|---:|
| 单牛正脸，恰好一个框且位置正确 | **36/37（97.3%）** |
| 两至三张牛脸，全部框准且无多框 | 7/16 |
| 无牛脸，画面保持零框 | 9/17 |

这批正脸照片来自吉林公开资料。不同牧场的实拍效果还需现场复验。

## 历史版本 · 牛与非牛判断模型

第一阶段接收工作人员拍摄的一张整图，判断画面里有没有牛。确认有牛时交接原图，多目标时提示选择目标或重拍。个体牛号由项目第二阶段识别。

**[下载可离线推理的试用模型（303 MiB）](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/download/stage1-r8-trial/cattle-presence-r8.zip)** · [下载测试记录](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/download/stage1-r8-trial/evaluation-evidence-r8.zip) · [发布页与校验文件](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/tag/stage1-r8-trial)

## 工作人员怎样试一张

下载模型 ZIP 并解压。在解压后的顶层目录运行以下命令。首次安装 Python 依赖需要网络，之后推理可离线执行。下面使用 Python 3.12 和 macOS 或 Linux 终端。

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r stage1_cattle/round8/requirements.txt
.venv/bin/python -m stage1_cattle.round8.check_photo "/完整路径/照片.jpg"
```

输出 `cattle` 表示确认有牛，`image_ref` 指向输入原图。`select_or_retake` 表示需选择目标或重拍。输出 `non_cattle` 表示明确无牛，流程结束。`uncertain` 表示需重拍。程序也返回模型版本。模型包内附有中文复测说明及上游模型许可。

## 实测到什么程度

2026 年 11 月 16 日冻结的试用版，在 32 个新国内场址的公开报道照片上答对 **28/32（87.5%）**。每场一张。云端和 Mac 分别运行，先保存预测再揭晓答案。

| 同批盲测 | 上一版 | 本次试用版 |
|---|---:|---:|
| 真牛放行 | 13/13 | 13/13 |
| 非牛明确拒绝 | 14/19 | 15/19 |
| 非牛误放 | 5/19 | 4/19 |
| 未确认或异常 | 0/32 | 0/32 |
| 总正确 | 27/32 | 28/32 |

多拒对了一张青海的驴群照。仍误放两张山羊和两张驴。在 13 张确认有牛的照片中，12 张提示选目标或重拍，1 张直接交接。Apple M5 Pro 上，模型已加载时单张中位耗时 0.48 秒，P95 为 1.06 秒。

项目的正式验收目标为在事先封存的 2,000 张常见牧场照片上至少答对 1,990 张。本轮 32 张来自公开报道，工作人员日常随手拍的独立准确率仍待现场复验。[测试过程和分组结果](TESTING.md) · [32 张逐图对照及来源](blind32.csv) · [全部四张错例](errors.csv)

模型 ZIP 的 SHA-256 为 `77ecf5a92df073cfcfb934fab9aff2ef3b703a541f4b1cfcbfe5305b5fd9f1d7`。发布名为 `stage1-r8-trial`。
