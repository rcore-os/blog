---
title: StarryOS 的串口、有线网卡的异步化
date: 2026-10-04 16:30:00
categories:
    - 实习总结报告
tags:
    - author:daivy2333
    - repo:https://github.com/daivy2333/StarryOS
    - StarryOS
    - 驱动
    - 串口
    - 网卡
    - 多核
---

## 摘要

在 StarryOS 上进行的异步驱动开发工作，为内核构建异步串口与异步网卡两个驱动，覆盖从中断响应、环形缓冲与描述符队列，到 TTY 行规程与协议栈接入、多核绑核调度的完整链路。核心工作包括三项：异步串口驱动，采用"中断只唤醒、后台任务搬运"的结构，ISR 精简至约 25 行，配合双 SPSC 环形缓冲与非阻塞 I/O，在 Lichee RV Dock D1 真板上将 64B 短包写到 96.6% 物理线速；异步网卡驱动，从硬件到应用分五层，发送以代际号与序号记账，提交、完成、回收三处计数闭合后才复用缓冲区，恢复语义区分等待者取消、提交前撤销与设备持有三种情况，在 QEMU 十六核（SMP=16）下实现 TCP/UDP 双向收发、poll/select 就绪通知与故障注入后的恢复；以及统一处理流程与多核适配，两个驱动遵循"四段流程加四条规则"的同一套写法，后台角色固定绑核、跨核恰好一次 IPI 唤醒，两驱动在同一内核中长期共存工作。在此基础上，通过 D1 真板测试与 QEMU SMP=16 六组场景，验证驱动功能性能。

<!-- more -->

## 实习概况

| 项 | 内容 |
|---|---|
| 时间 | 2026-06-21 ~ 2026-10-04（15 周） |
| 项目 | [StarryOS](https://github.com/daivy2333/StarryOS) `mul-hart-k3` 分支：Rust 宏内核，基于 ArceOS 组件化架构 |
| 方向 | 异步驱动开发：UART 串口 → VirtIO 网卡，QEMU 与真板两条线验证 |
| 代码 | 153 个提交，主线 `mul-hart-k3`，前期为 `uart-16550-lichee`、`net-k3` |
| 记录 | 14 篇周报、1 篇实习总结与 42 篇笔记汇总在 [OhMyOs](https://daivy2333.github.io/OhMyOs/)，实习总结见 [W15 周报](https://github.com/daivy2333/OhMyOs/blob/main/docs/weeks/weekly-2026-W15.md) |
| 幻灯片 | [实习总结汇报 · StarryOS 异步驱动开发](https://github.com/daivy2333/OhMyOs/blob/main/docs/fornow/%E5%AE%9E%E4%B9%A0%E6%80%BB%E7%BB%93%E6%B1%87%E6%8A%A5%20%C2%B7%20StarryOS%20%E5%BC%82%E6%AD%A5%E9%A9%B1%E5%8A%A8%E5%BC%80%E5%8F%91.pptx) |

实习之前的训练营记录在 [2026sOsReport](https://github.com/daivy2333/2026sOsReport)。

## 时间线

| 阶段 | 时间 | 工作内容 | 收口 |
|---|---|---|---|
| 异步串口 + D1 真板 | 6/21 ~ 7/25 | 新建 D1 平台组件，打通 `/dev/console`、TTY、`tcdrain`、非阻塞 I/O，userbench 真板跑通 | 7/25 串口主线文档归档 |
| 异步网卡（QEMU 单核） | 7/26 ~ 9/4 | 八步推进：同步接通 → 轮询回退 → 中断诊断 → 收包异步化 → 双向有界数据面 → 协议栈自主推进 → poll/select 就绪 → 故障恢复 | 9/2 恢复语义收口，故障注入无重复释放、永久挂起、静默丢包 |
| K3 板与多核适配 | 9/5 ~ 9/27 | K3 板接线与工具链配置，两驱动后台角色绑核，SMP=16 六组场景验证 | 9/26 验证通过；9/27 提交验证装置与复现手册（[`5df918cd`](https://github.com/daivy2333/StarryOS/commit/5df918cd)） |

每步只做一处主要改动，出问题时能直接定位到当次修改。

## 为什么做异步驱动

纯轮询让 CPU 在空闲时空转，纯中断在吞吐上升时退化成中断风暴。方案取两者中间：中断只负责唤醒，后台 copier 任务批量搬运数据，走 NAPI 的思路。空闲时全链路睡眠；数据密集时 copier 按预算切轮询连续抽干，把中断次数压到最低。队列有界，积压显式可见，故障可恢复。

## 统一流程与四条规则

"中断进来到应用拿到数据"拆成四段，串口与网卡写法相同：

1. ISR 收中断，读寄存器识别原因；
2. 清中断；
3. 唤醒 waker；
4. 调度异步任务继续搬运。

四段流程配四条规则：

1. ISR 不搬数据，只做原因确认、清中断、唤醒；
2. waker 注册后立即重查硬件状态，防丢唤醒；
3. 每轮工作量设上限，积压显式可见；
4. 返回等待前先释放锁再唤醒，防死锁。

流程层统一，数据结构层按设备设计，不做强行抽象：completion 语义、背压表达、故障分类在两个设备上完全不同，强抽 trait 会退化。这套"流程照规则写、数据层按设备设计"的做法是实习的主要产出。

四段流程在两个驱动里的对应实现：

| 流程段 | 串口 | 网卡 |
|---|---|---|
| 收中断、识别原因 | [`uart_16550/src/async_/isr.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/uart_16550/src/async_/isr.rs) 读 ISR 与 LSR 寄存器确定位型 | [`kernel/src/drivers/virtio_net_irq.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/virtio_net_irq.rs) 读 VirtIO 中断状态 |
| 唤醒 | 按位型唤醒 RX、TX、DRAIN 三个 `AtomicWaker` | 唤醒队列 owner 注册的 waker |
| 调度任务 | axtask 调度 RX/TX copier 任务 | axtask 调度队列 owner 任务 |

网卡开发与测试全程，异步串口一直承担控制台 I/O——SMP=16 那轮运行的记录本身就是经串口打印的。两个驱动在同一内核共存，说明这套流程规则能支撑更多同路径异步驱动。

## 串口：字节流加双环形缓冲

串口数据是字节流，模块都在 `uart_16550` crate 的 `async_` 目录与内核的 `drivers` 目录下：

| 模块 | 文件 | 作用 |
|---|---|---|
| ISR | [`async_/isr.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/uart_16550/src/async_/isr.rs) | 读 ISR 寄存器识别中断类型，关对应 IER 位，唤醒 RX/TX/DRAIN 三个 `embassy_sync::AtomicWaker` 之一；`IRQ_COUNT` 记录中断次数 |
| copier 任务 | [`async_/driver.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/uart_16550/src/async_/driver.rs) | RX/TX 两个后台任务在硬件 FIFO 与环形缓冲间搬数据，NAPI 中断合并 |
| 环形缓冲 | [`async_/ring_buffer.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/uart_16550/src/async_/ring_buffer.rs) | SPSC 无锁队列，静态分配，收发各 64 KiB |
| 字符设备 | [`async_/device_ops.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/uart_16550/src/async_/device_ops.rs) | `AsyncUartReader`/`AsyncUartWriter` 实现 `embedded_io_async`，`flush` 提供 `tcdrain` 语义 |
| TTY 绑定 | [`kernel/src/drivers/ntty_async.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/ntty_async.rs) | `ASYNC_TTY` 以 `ProcessMode::External` 把 tty-reader 的 waker 挂到 RX 环形缓冲的 PollSet |
| OS 抽象 | [`kernel/src/drivers/os_arceos.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/os_arceos.rs) | 62 行实现 `OsRuntime` 与 `OsWakerSet` 两个 trait，对接 axtask 与 axpoll |

关键机制三处。ISR 内不做数据搬运，只读寄存器、关中断、唤醒，处理函数约 25 行。RX copier 带 NAPI 中断合并：连续 16 次读到数据（`NAPI_THRESHOLD = 16`）后关中断进入轮询模式，每轮批量读 64 次（`NAPI_BATCH_SIZE = 64`），FIFO 抽空后重新开中断回到睡眠；TX 方向对称，另有一层 `flush()` 等 LSR 的 TEMT 位（发送移位寄存器空）实现 `tcdrain`，由 DRAIN_WAKER 唤醒。TTY 行规程通过 `ProcessMode::External` 改成被唤醒驱动，不再轮询缓冲。

D1 真板基准（2026-07-07 采集，115200 bps 物理线速 11.52 KB/s）：

| 场景 | 实测输出 |
|---|---|
| 64B 短包写 + 排空 ×100 | 11.13 KB/s，96.6% 线速，short_writes=0，排空错误 0 |
| 256B / 1024B 写 + 排空 ×100 | 97.3% / 98.8% 线速 |
| 1024B 批量排空（8 写 1 排） | 99.1% 线速 |
| 单字节发送延迟 ×100 | 平均 0.186 ms |
| 非阻塞读（O_NONBLOCK 与 FIONBIO 开启） | PASS，空读返回 EAGAIN |
| 内核态入队速度 | 64B 包 4.2 MB/s，约为物理线速的 368 倍，写入不阻塞 |
| RX 环形缓冲读微基准 | 8.4 GB/s，读取延迟 P99 246 ns |

完整输出留档于 StarryOS 仓库的 [D1 真板验收记录](https://github.com/daivy2333/StarryOS/tree/mul-hart-k3/.agents/analysis/_archive/2026-07-11-q19c-d1-async-uart-closeout/lichee)。

真板环境暴露并修掉三个问题。THRE 边沿丢失导致 `tcdrain` 不返回。64B 标准输出积压在缓冲里污染测量，修完后 D1 64B 场景从约 1 KB/s 提到 11.13 KB/s。TX copier 预算耗尽后卡死。

## 网卡：整包分五层

网卡以整包为粒度，从硬件到应用分五层，代码集中在 `axnet` crate：

| 层 | 职责 | 代码 |
|---|---|---|
| ISR | 读 VirtIO 中断状态、清中断、唤醒 | [`kernel/src/drivers/virtio_net_irq.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/virtio_net_irq.rs) |
| 队列 owner | 唯一后台任务，收（reap/refill）与发（submit/reclaim）按预算推进 | [`axnet/src/service.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/service.rs) 与 [`async_rx.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/async_rx.rs) |
| 栈 runner | 常驻任务，推进 smoltcp 收发、维护与定时器 | [`axnet/src/stack_runner.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/stack_runner.rs) |
| 就绪桥 | 把 smoltcp 单槽 waker 展开成多等待者，接 poll/select | [`axnet/src/readiness.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/readiness.rs) |
| socket | TCP/UDP 公共句柄 | [`axnet/src/socket.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/socket.rs) |

数据结构四组，各有账本。

定长槽位。`FixedFrameQueue`（[`device/fixed_queue.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/device/fixed_queue.rs)）用固定容量槽位存整包，内存占用有硬上界，队列压满时新包显式拒绝而不是无限缓存。

发送票号。每次发送向 `TicketTracker` 领一张递增票号，状态从 Queued 经 `mark_device_owned` 转到设备持有，回收时按票号销账；存活票上限 128 张（`MAX_LIVE_TICKETS`）。`QueueEpoch` 随队列重建推进，完成通知带的票号属于旧代际直接作废，缓冲区只有提交、完成、回收三处计数闭合后才复用。

每轮预算。owner 的收、回收、提交各 32（`RX_BUDGET`/`RECLAIM_BUDGET`/`SUBMIT_BUDGET`），栈 runner 每阶段 32（`STACK_STAGE_BUDGET`）。一轮做不完留到下一轮，由 waker 接力，不空转。

flush 语义。`FlushTicket`/`FlushWaiter`（[`flush.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/flush.rs)）记录当前 `last_accepted` 票号为目标，等所有小于等于目标的存活票回收后完成，目标之后提交的票不等——语义对应串口的 `tcdrain`。

就绪通知。每个公共 socket 句柄持有一个 `ReadinessBridge`，读、写、终态各挂一组 `PollSet`；smoltcp 的一次性单槽 waker 注册到桥上，桥把就绪事件扇出到 poll/select 注册的多个等待者。

恢复语义。取消按等待者取消、提交前撤销、设备持有三段区分；对外终态收敛为 6 种（连接复位、链路断开、超时、取消、所有权错误、设备 I/O），各带稳定错误码；复位必须确认设备状态清零后才重建队列。

SMP=16 六组场景（2026-09-26 运行；队列 owner 固定 hart 15、栈 runner 固定 hart 0、串口 RX/TX copier 分别在 hart 13/14）：

| 场景 | 实测输出 |
|---|---|
| 绑核检查 | 单例绑核、实际运行核与绑核一致、零拒绝，PASS |
| 关定时器跨核唤醒 | 唤醒完成 1 次、定时器恢复、无丢失；IPI 发送 = 接收 = 191 |
| TCP 双向 | 客内 socket 发 8 收 8，宿主机对端 ok；提交 11 = 完成 11 = 回收 11 |
| UDP 双向 | 客内 socket 发 8 收 8；提交 21 = 完成 21 = 回收 21 |
| 队列满载恢复 | 压满 64 槽再释放，恢复后发送 322 = 完成 322 = 回收 322、在途 0 |
| 空闲安静窗口 | poll 就绪与实际 I/O 一致，静默期收发路径无动作 |

六组全 PASS，探针退出码 0，宿主机抓包与客内 socket 计数逐项一致。串口多核冒烟测试同轮通过：远端唤醒字节送达、IPI 因果计数 4 = 4、TX 环形缓冲收敛。运行记录与抓包文件留档于 [SMP=16 资格验证目录](https://github.com/daivy2333/StarryOS/tree/mul-hart-k3/openspec/changes/archive/2026-09-26-ms08-qemu-multi-hart-correctness-baseline/evidence/005-per-driver-smp16-fixed-qualification/003-rework)。

## 多核适配：绑核与跨核唤醒

K3（进迭时空）AP 域有 8 个 X100 加 8 个 A100 共 16 核，两个驱动的后台角色固定绑核。绑核与唤醒走 `axtask` 新增的三处能力：`spawn_with_name_affinity` 在任务入队前完成绑定，调度器按 `AxCpuMask` 选运行队列；`send_reschedule_ipi` 向目标核发一次远端唤醒 IPI；`ipi_sent_count`/`ipi_received_count` 逐核计数，测试里 191 = 191 即靠这对计数对账。角色落点集中在 [`kernel/src/drivers/net_placement.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/net_placement.rs)：owner hart 15、runner hart 0、串口 RX/TX copier hart 13/14。观测两组：[`uart_smp_snapshot.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/uart_smp_snapshot.rs) 与 [`net_wake_witness.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/net_wake_witness.rs)，直接读出每个角色跑在哪个核、IPI 是否丢失。内核临界区从"只关本地中断"升级为"本地中断恢复 + 全局互斥 + 每核嵌套计数"。唤醒本地优先，必须跨核时恰好发一次 IPI，避免唤醒风暴。

多核过程中修掉两个问题。TX 方向丢唤醒，通过在 waker 注册后重查硬件状态加重试解决。release 构建越界读出"幽灵核"，`AxCpuMask` 的 [`try_one_shot`/`set`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axtask/src/cpumask.rs) 加容量检查后越界返回错误，不再读出幽灵核。

## 视频演示

[SMP=16 演示录屏（2026-10-06）](https://daivy2333.github.io/OhMyOs/notes/%E8%A7%86%E9%A2%91/screen-recording-2026-10-06/)：ping 百度与经宿主机服务器拉取文件，网卡收发与串口输出均正常（[mp4 直链](https://daivy2333.github.io/OhMyOs/video/screen-recording-2026-10-06.mp4)）。

## 不足与后续

异步串口和异步网卡的开发基本完成。受时间、精力和能力限制，性能优化与基准对比测试还没做；到本报告完成时，SMP=16 多核场景也只在 QEMU 上验证了串口与网卡的输入输出，K3 真板验证待做。后续我会在 K3 真板上继续做能落地的工作，并一直在日志仓库更新周报直至实习正式结束。
