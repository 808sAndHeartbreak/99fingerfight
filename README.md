# 99 FINGER FIGHT

独立网页回合对战游戏，支持教学、本地人机 / 双人、在线匹配、房间、重连与再战。无需 Unity 或其他素材目录。

本项目根目录为 `D:\code\99 fingerfight`，GitHub 为 https://github.com/808sAndHeartbreak/99fingerfight 。请保留整个项目；`public/` 仅含静态素材，不能单独构建或运行联机游戏。当前规则版本 8、协议版本 2，前后端必须配套发布。

## 启动

需要 Node.js 22.12+（或 24 LTS）和 npm。在项目根目录执行：

```sh
npm ci
npm test
npm run build
npm start
```

打开 http://localhost:3000 。Windows 也可双击 `启动游戏.cmd`。开发使用 `npm run dev`；完整联机测试使用构建后的 Node 服务。

## 目录

- `src/`：界面、Three.js 表现、共享规则和联网客户端。
- `server/`：HTTP / WebSocket 服务与权威房间管理。
- `public/assets/`：运行素材、字体与来源说明。
- `tests/`：规则、状态、联机和交互回归测试。
- `docs/`：当前规则、网络协议、试玩与部署说明。
- `scripts/`：发布打包与回放校验。

`dist/`、`node_modules/`、`release/` 是生成内容，`data/` 是本地对局数据，均不入库。凭据和服务器配置不入库。

运行 `python scripts/package-release.py` 生成部署包。见 [部署说明](docs/RUN.md)、[当前规则](docs/CURRENT-DESIGN.md)、[美术来源](docs/ART.md)。本仓库不包含 Unity 工程、旧提取脚本、原始大图或历史发布包。
