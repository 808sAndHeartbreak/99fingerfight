# RUN 部署

服务：https://fingerfight.run.ingarena.net/ · RUN 项目 2112。

1. 在项目根目录执行 `npm ci`、`npm test`、`npm run build`。
2. 通过 RUN 官方 API 获取当前 SSH 信息，凭据禁止入库。
3. 备份当前程序。同步构建、源码、服务端和 package 文件到项目家目录，保留服务器的对局数据、依赖和进程配置。
4. 前端更新先上传新资源，最后原子替换 `dist/index.html`。暂留旧哈希资源，供已打开的客户端继续加载。仅静态更新无需重启进程。
5. 后端更新须安装锁定依赖并重启托管服务。规则不兼容时另行安排旧房间迁移，不可直接覆写对局数据。
6. 验证 `/health`、首页、新资源 HTTP 和实际 WebSocket 双人交互。

服务端口 3000；生产 `ALLOWED_ORIGIN` 为上述域名，重连宽限 60000ms。持久化默认为 `data/rooms.json`，可用 `STATE_FILE` 调整。服务器使用 Supervisor 托管，配置位于 `server/supervisord.conf`，服务名 `finger-fight`。数据与进程配置仅在服务器保存。

程序回滚只还原程序和入口，不覆盖发布后生成的新对局数据。发布包由 `python scripts/package-release.py` 生成。平台访问范围以 RUN 当前政策为准。
