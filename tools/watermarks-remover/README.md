# 自制资源处理

上游为 guillaumemeyer/watermarks-remover，安装的 `remove-ai-marks` 技能位于项目 `.agents/skills/`。
本项目只处理自制图片的容器元数据，不宣称移除所有隐形或像素水印，不处理第三方图片，也不改第三方许可证。

启动已审查的上游 HTTP 服务后运行：

```powershell
python tools/watermarks-remover/clean-assets.py assets/campus-interim.jpg miniapp/assets/campuspilot-icon.png
```

服务默认 `127.0.0.1:8765`，先调用 inspect 再 clean；仅允许项目资源目录。提示词、工具来源与生成方式继续保存在 `assets/manifest.json`。
上游原始下载目录不提交公开仓库，避免混入与本项目无关的工具和运行文件。首次安装参考 `docs/skills-usage.md`。
