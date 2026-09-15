# 当前运行美术与音频

视觉采用暖纸白、深蓝墨色和蓝红阵营色的漫画风格。主菜单封面 public/assets/manga/menu-99.webp 来自用户于 2026-09-10 提供的替换封面。接触爆点来自用户提供的躲避球美术；来源清单见 public/assets/manga/sources.json，记录来源不构成外部路径依赖。

20 张技能、12 张道具、归一与坚韧各 1 张，共 34 张黑白透明图标位于 public/assets/ink-mono/。这些图标使用 imagegen 生成并转换为 WebP，保留透明通道；统一日漫墨线、灰阶、无文字边框及小尺寸可读轮廓。

Three.js 手部、灰色关节阴影、护盾碎片和 WebGL 阵营聚光由代码绘制。归一使用 SVG 太极，按玩家红蓝填充并在第二次直接衔接胜利页。常驻战场与结果页没有人物插画，旧人物图、纸纹和旧胜利背景均已移除。

兼容手势 10 张与点击、胜利音效共 12 个素材保留原游戏出处，见 public/assets/manifest.json。手势图片供 WebGL 不可用时回退，仍属于运行必需素材。

Teko 与 Noto Sans SC 本地字体随附 SIL OFL 许可证，必须保留。中文子集缺字时使用系统中文字体。开发者说原始截图位于 assets/story/inspiration-full.png，按用户要求完整呈现。

当前 BGM 为用户提供的 `Pixel Afternoon Streets (8-Bit Loop Mix).mp3`，运行资源为 `assets/music/pixel-afternoon-streets-seamless.mp3`。由原曲按约 140 BPM 修剪到第 81 小节边界，首尾一小节（1.714 秒）交叉淡化，成品循环 137.143 秒、44.1 kHz 立体声。Web Audio 缓冲循环避免逐次重新加载，默认音乐 30%，保留用户自设音量和静音。旧运行音轨已删除；处理脚本 `scripts/prepare-bgm.py` 接收用户原曲路径。


素材保留原有权利；本仓库未另行授予素材通用再分发许可。
