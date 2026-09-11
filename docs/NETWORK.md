# 联机实现（协议 2 / 规则 11）

已部署 https://fingerfight.run.ingarena.net/ 。客户端 src/online.js；服务端 server/index.js 与 server/hub.js；前后端共享 engine.js。

## 大厅与身份

昵称随时修改，最多 10 个可见字符（emoji 按完整字素计数，超长截短），可重名。游客凭证保存在当前标签页 sessionStorage，刷新恢复；关闭标签页后不保证恢复，不支持跨设备账号。禁止存储时只能维持当前连接身份。

快速匹配直接开始，私人房间通过六位房间码或邀请链接加入，双方准备后开始。进行中退出需确认并判负；双方同意才重赛。同身份新连接替换旧连接，服务器绑定席位。

## 消息

同源 /ws，HTTPS 使用 WSS。hello 携带 protocolVersion:2、rulesVersion:11、displayName 和可选 token；welcome 返回 token。snapshot 包含 profile、queued、serverNow 和 room。room 包含 code、matchId、seat、participants、ready、rematch、status、state、readyAt、deadlineAt。

请求格式：{type:'request', id:唯一请求ID, op:操作, ...参数}。操作包括 name、create、join、queue、cancel、leave、ready、rematch、sync、command。command 请求另带 matchId 和 command；command 含 type、revision、操作参数。服务器覆盖 actor，不接受客户端血量或数字结果。返回 ack/error 与权威快照。

成功游戏命令缓存最近 256 个请求 ID 去重。校验对局 ID、revision、回合操作许可、目标和配方。大厅操作不自动重放。公开快照不含随机数状态和身份凭证。

## 时间与恢复

每回合统一 30 秒，道具、计算和合成自由穿插，每回合最多计算一次。forge 保留双手配方数字，在 readyAt 自动攻击，攻击效果完成后重置为 [1] / [1]；end 主动结束回合。没有合法操作时客户端高亮结束回合；到 deadlineAt 服务器直接结束回合。start 仅用于自动补给与持续伤害，不接受玩家操作。

同回合命令只给 deadlineAt 补上 presentationDuration，不重置 30 秒。客户端按 max(serverNow, readyAt) 展示暂停中的剩余秒数；动画期间禁止其他操作。

客户端按 readyAt 解锁操作、deadlineAt 显示时间，按确认 revision 排队演出。遗漏快照或重连时取消旧动画并同步最新状态。未确认操作不自动重发。菜单和后台不会暂停线上时间。

自动重连退避至最多 8 秒。服务器确认断线后保留席位 60 秒，期间计时继续，超时判负。心跳每 15 秒检测，物理断网到确认断开可能另有约 30 秒。RECONNECT_GRACE_MS 调整宽限。

## 数据与限制

状态原子写入 data/rooms.json，包含房间、游戏状态与凭证哈希，无明文 token。重启恢复房间并重新提供断线宽限。部署保留 data/，不可公开。当前为单实例，不能直接多进程负载均衡。

WebSocket 校验来源，消息上限 16KB，每连接每 5 秒 40 请求，有认证超时和数量上限。HTTP 仅公开 dist/。没有账号、聊天、排行榜。

后续修改 catalog.js、engine.js 时同步 AI、指引、测试，前后端一起发布。规则结构改变须升级 rulesVersion 并决定旧状态迁移；协议结构改变须升级协议校验。现有物品公开，未来隐藏库存必须按席位过滤快照。

规则升级：加载存档时，不兼容的旧对局回到等待准备状态，保留房间码和身份。旧客户端需刷新页面。服务器与 dist、src 必须一起发布。

实战教学是独立本地会话，不进入匹配或联机存档。

2026-09-09：协议版本升级为 2，要求刷新旧页面，以同步新的演出时序。规则仍为 4，房间与对局数据不重置。

本轮技能规则升级为 6，协议仍为 2。旧规则客户端须刷新；旧房间中的对局回到等待准备，保留昵称与房间码。部署前后不能混用两个版本的引擎。

规则 6：服务器统一控制无可用道具的 1 秒自动推进；酒层数、肾上腺素时限随权威快照同步。计算演出改为 1 秒，服务器和客户端共用时长。

规则 11：技能准备态 deadlineAt=readyAt，由服务器 tick 自动 attack；客户端不再要求再次点击。坚韧、连续跳过次数和单手封印限制均由共享引擎校验。旧规则 6 对局迁移到等待准备，保留身份与房间码；旧客户端须刷新。

规则 11：calculated 限制每回合一次计算，declinedHands 记录已放弃数值；技能后重新检查配方和计算机会。每次自动攻击后重新开启完整操作计时。仅 PVE 保存最近一局回放；房间凭证按房间号存于同浏览器，新标签输入原码可恢复身份，服务端仍验证凭证与席位。
