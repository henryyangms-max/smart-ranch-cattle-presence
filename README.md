# 智能牧场 · V5.2 轻量牛脸检测

选择一张实拍照片，模型为每张检出的牛脸返回位置框与综合检测分，网页以蓝框显示。未检出牛脸时返回空列表。在线演示在浏览器里处理照片。

**[打开在线检测网页](https://henryyangms-max.github.io/smart-ranch-cattle-presence/)** · **[下载完整模型包](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/download/cow-face-mobile-v5.2/cow-face-mobile-v5.2.zip)** · [V5.2 发布页](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/tag/cow-face-mobile-v5.2)

## 给负责搭验证网页的 AI

把本仓库链接和下面这段话一并发给 AI，即可使用本次交付的模型。

> 请使用本仓库 V5.2 Release 的完整模型包搭建单张照片检测网页。复用包内的 detector.py 和 app.py，提供图片上传、原图蓝框、每框综合检测分，以及无牛脸时的零框结果。使用包内同名 JSON 的 0.35 出框门槛，坐标映射回 EXIF 转正的原图。先运行 static/example.jpg，验收应得到两个牛脸框。

模型为一个 **7.34 MB** 的 ONNX 文件。运行所需参数全部在文件内。可分别取得[模型权重](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/download/cow-face-mobile-v5.2/cow-face-416.onnx)、[配置](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/download/cow-face-mobile-v5.2/cow-face-416.json)和[校验清单](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/download/cow-face-mobile-v5.2/SHA256SUMS.txt)。完整包还含启动脚本、示例照片和逐图实测。

解压模型包，进入 `mobile_cow_face_v52`，安装依赖后运行以下命令。网页监听本机的 8782 端口。

```sh
python -m pip install -r requirements.txt
python app.py --port 8782
```

默认门槛在网页上显示为 35 分。分数未经概率校准。ONNX 文件的 SHA-256 为 `1afed908bd122f6a1c427945bd2a3a5f596bdf630d2c00ccadeb6ba578b7091d`。

也可以直接克隆本仓库，从仓库根目录运行 Python 参考入口，命令会打印原图像素坐标、综合分，并保存蓝框图片。

```sh
python -m pip install -r requirements.txt
python detector.py docs/example.jpg --output result.png
```

[Python 推理参考](detector.py) · [浏览器推理实现](docs/inference.js) · [V5.2 分组实测说明](V52-TESTING.md)

## V5.2 实测

| 整张照片的成功条件 | 已发布 V5 | V5.2 |
|---|---:|---:|
| 历史单牛正脸，框准且无多框 | 36/37 | 36/37 |
| 历史多牛，所有可见牛脸都框准且无多框 | 7/16 | 7/16 |
| 本轮新增单牛正脸，框准且无多框 | 21/22 | 21/22 |
| 本轮新增人像，零框 | 27/34 | 33/34 |
| 本轮新增鸡，零框 | 15/16 | 16/16 |
| 本轮新增绵羊和山羊，零框 | 9/14 | 12/14 |
| 本轮新增空景和物体，零框 | 9/9 | 9/9 |
| 本轮新增合计 | 81/95 | **91/95（95.8%）** |

新增组有 1 张正脸未判对，1 张人像和 2 张山羊误框。逐图标准为 IoU ≥ 0.50、一一匹配且无多余框。牧场实拍和目标手机性能有待现场验证。完整包的“实测”目录含逐图对照与错例。前一版轻量模型可在 [V5 历史发布](https://github.com/henryyangms-max/smart-ranch-cattle-presence/releases/tag/cow-face-mobile-v5)查看。

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
