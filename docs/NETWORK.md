# 联机实现（协议 1 / 规则 4）

已部署 https://fingerfight.run.ingarena.net/ 。客户端 src/online.js；服务端 server/index.js 与 server/hub.js；前后端共享 engine.js。

## 大厅与身份

昵称随时修改，Unicode 最多 24 码点，可重名。游客凭证保存在当前标签页 sessionStorage，刷新恢复；关闭标签页后不保证恢复，不支持跨设备账号。禁止存储时只能维持当前连接身份。

快速匹配直接开始，私人房间通过六位房间码或邀请链接加入，双方准备后开始。进行中退出需确认并判负；双方同意才重赛。同身份新连接替换旧连接，服务器绑定席位。

## 消息

同源 /ws，HTTPS 使用 WSS。hello 携带 protocolVersion:2、rulesVersion:4、displayName 和可选 token；welcome 返回 token。snapshot 包含 profile、queued、serverNow 和 room。room 包含 code、matchId、seat、participants、ready、rematch、status、state、readyAt、deadlineAt。

请求格式：{type:'request', id:唯一请求ID, op:操作, ...参数}。操作包括 name、create、join、queue、cancel、leave、ready、rematch、sync、command。command 请求另带 matchId 和 command；command 含 type、revision、操作参数。服务器覆盖 actor，不接受客户端血量或数字结果。返回 ack/error 与权威快照。

成功游戏命令缓存最近 256 个请求 ID 去重。校验对局 ID、revision、阶段、目标和配方。大厅操作不自动重放。公开快照不含随机数状态和身份凭证。

## 时间与恢复

规划、合成、计算 30 秒，攻击 10 秒。开始、超时由服务器推进，统一保留短演出缓冲。仅合成阶段确认 forge 形成武器，允许 decline 后计算；无合法计算自动结束，没有 pass。

客户端按 readyAt 解锁操作、deadlineAt 显示时间，按确认 revision 排队演出。遗漏快照或重连时取消旧动画并同步最新状态。未确认操作不自动重发。菜单和后台不会暂停线上时间。

自动重连退避至最多 8 秒。服务器确认断线后保留席位 60 秒，期间计时继续，超时判负。心跳每 15 秒检测，物理断网到确认断开可能另有约 30 秒。RECONNECT_GRACE_MS 调整宽限。

## 数据与限制

状态原子写入 data/rooms.json，包含房间、游戏状态与凭证哈希，无明文 token。重启恢复房间并重新提供断线宽限。部署保留 data/，不可公开。当前为单实例，不能直接多进程负载均衡。

WebSocket 校验来源，消息上限 16KB，每连接每 5 秒 40 请求，有认证超时和数量上限。HTTP 仅公开 dist/。没有账号、聊天、排行榜。

后续修改 catalog.js、engine.js 时同步 AI、指引、测试，前后端一起发布。规则结构改变须升级 rulesVersion 并决定旧状态迁移；协议结构改变须升级协议校验。现有物品公开，未来隐藏库存必须按席位过滤快照。

规则升级：加载存档时，不兼容的旧对局回到等待准备状态，保留房间码和身份。旧客户端需刷新页面。服务器与 dist、src 必须一起发布。

实战教学是独立本地会话，不进入匹配或联机存档。

2026-09-09：协议版本升级为 2，要求刷新旧页面，以同步新的演出时序。规则仍为 4，房间与对局数据不重置。
