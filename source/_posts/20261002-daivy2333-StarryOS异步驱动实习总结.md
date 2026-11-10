---
title: StarryOS 的串口、有线网卡的异步化
date: 2026-11-09 16:30:00
categories:
    - 实习总结报告
tags:
    - author:daivy2333
    - repo:https://github.com/daivy2333/StarryOS
    - repo:https://github.com/daivy2333/k3
    - StarryOS
    - 驱动
    - 串口
    - 网卡
    - 多核
    - AsyncOS
    - K3
    - GMAC
---

## 摘要

在 StarryOS 上把串口和网卡两个驱动改造成异步结构：中断只负责唤醒，数据搬运交给后台任务，队列有界，故障可恢复。两个驱动共用同一套"四段流程加四条规则"写法——串口按字节流组织，网卡按整包分五层，流程统一而数据结构各按设备设计。D1 真板上异步串口把 64B 短包写到 96.6% 物理线速；QEMU 十六核下异步网卡跑通 TCP/UDP 双向收发、poll/select 就绪通知与故障注入后的恢复；K3 CoM260 Kit 真板上同一套写法迁到 GMAC 控制器，16 hart 下网卡与串口测试通过，单连接 TCP 吞吐达到同板原厂 Linux 的 76.5%（板→PC）和 25.6%（PC→板）。

<!-- more -->

## 实习概况

| 项 | 内容 |
|---|---|
| 时间 | 2026-06-21 ~ 2026-10-22（17.6 周） |
| 项目 | [StarryOS](https://github.com/daivy2333/StarryOS) `mul-hart-k3` 分支：Rust 宏内核，基于 ArceOS 组件化架构；报告完成后转入 `k3` 分支做 K3 CoM260 Kit 真板验证 |
| 方向 | 异步驱动开发：UART 串口 → VirtIO 网卡 → GMAC 网卡，QEMU、D1 真板、K3 真板三条线验证 |
| 代码 | 176 个提交，`mul-hart-k3` 153 个 + `k3` 分支自 2026-09-27 分叉后 23 个，前期为 `uart-16550-lichee`、`net-k3` |
| 记录 | 14 篇周报、1 篇实习总结与 42 篇笔记汇总在 [OhMyOs](https://daivy2333.github.io/OhMyOs/)，实习总结见 [W15 周报](https://github.com/daivy2333/OhMyOs/blob/main/docs/weeks/weekly-2026-W15.md)；K3 硬件见 [k3](https://github.com/daivy2333/k3) 仓库 |
| 幻灯片 | [实习总结汇报 · StarryOS 异步驱动开发](https://github.com/daivy2333/OhMyOs/blob/main/docs/fornow/%E5%AE%9E%E4%B9%A0%E6%80%BB%E7%BB%93%E6%B1%87%E6%8A%A5%20%C2%B7%20StarryOS%20%E5%BC%82%E6%AD%A5%E9%A9%B1%E5%8A%A8%E5%BC%80%E5%8F%91.pptx) |
实习之前的训练营记录在 [2026sOsReport](https://github.com/daivy2333/2026sOsReport)。

## 时间线

| 阶段 | 时间 | 工作内容 | 结束状态 |
|---|---|---|---|
| 异步串口 + D1 真板 | 6/21 ~ 7/25 | 新建 D1 平台组件，实现 `/dev/console`、TTY、`tcdrain` 与非阻塞 I/O，userbench 真板跑通 | 7/25 串口主线文档归档 |
| 异步网卡（QEMU 单核） | 7/26 ~ 9/4 | 八步推进：同步接通 → 轮询回退 → 中断诊断 → 收包异步化 → 双向有界数据面 → 协议栈自主推进 → poll/select 就绪 → 故障恢复 | 9/2 恢复语义定稿，故障注入无重复释放、无永久挂起、无静默丢包 |
| K3 板与多核适配 | 9/5 ~ 9/27 | K3 板接线与工具链配置，两驱动后台角色绑核，SMP=16 六组场景验证 | 9/26 验证通过；9/27 提交验证装置与复现手册（[`5df918cd`](https://github.com/daivy2333/StarryOS/commit/5df918cd)） |
| K3 真板异步化 | 10/1 ~ 10/22 | 板级事实核对 → AIA 中断框架 → GMAC 轮询双向网络 → 单 hart 异步数据面 → 单 hart 恢复语义 → 异步串口交互 shell → RAM rootfs 普通 shell → 16 hart 多 hart 异步 I/O 验收 | 10/16 全部阶段定稿；10/22 补齐端到端复现手册与板端 TCP 聊天载荷 |

每步只做一处主要改动，出问题时能直接定位到当次修改。

## 为什么做异步驱动

纯轮询让 CPU 在空闲时空转，纯中断在吞吐上升时退化成中断风暴。方案取两者中间：中断只负责唤醒，后台 copier 任务批量搬运数据，参照 NAPI 的做法。空闲时全链路睡眠；数据密集时 copier 按预算切到轮询模式连续读取，把中断次数压到最低。队列有界，积压显式可见，故障可恢复。

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

四段流程在两个驱动里的对应实现：

| 流程段 | 串口 | 网卡 |
|---|---|---|
| 收中断、识别原因 | [`uart_16550/src/async_/isr.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/uart_16550/src/async_/isr.rs) 读 ISR 与 LSR 寄存器确定位型 | [`kernel/src/drivers/virtio_net_irq.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/virtio_net_irq.rs) 读 VirtIO 中断状态 |
| 唤醒 | 按位型唤醒 RX、TX、DRAIN 三个 `AtomicWaker` | 唤醒队列 owner 注册的 waker |
| 调度任务 | axtask 调度 RX/TX copier 任务 | axtask 调度队列 owner 任务 |

网卡开发与测试全程，异步串口一直承担控制台 I/O——SMP=16 那轮运行的记录本身就是经串口打印的。两个驱动在同一内核共存，说明这套流程规则能支撑结构相同的更多异步驱动。K3 真板上的 GMAC 后端沿用同一套四段流程与四条规则：ISR 读 GMAC 中断状态、按 source 分派，清中断后唤醒队列 owner，owner 按预算收包发包，细节见后文"K3 真板"一节。

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

串口的异步行为由三处机制决定。ISR 内不做数据搬运，只读寄存器、关中断、唤醒，处理函数约 25 行。RX copier 带 NAPI 中断合并：连续 16 次读到数据（`NAPI_THRESHOLD = 16`）后关中断进入轮询模式，每轮批量读 64 次（`NAPI_BATCH_SIZE = 64`），FIFO 抽空后重新开中断回到睡眠；TX 方向对称，另有一层 `flush()` 等 LSR 的 TEMT 位（发送移位寄存器空）实现 `tcdrain`，由 DRAIN_WAKER 唤醒。TTY 行规程通过 `ProcessMode::External` 改成被唤醒驱动，不再轮询缓冲。

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

真板环境暴露并修掉三个问题：

- THRE 边沿丢失导致 `tcdrain` 不返回。
- 64B 标准输出积压在缓冲里污染测量，修完后 D1 64B 场景从约 1 KB/s 提到 11.13 KB/s。
- TX copier 预算耗尽后卡死。

## 网卡：整包分五层

网卡以整包为粒度，从硬件到应用分五层，代码集中在 `axnet` crate：

| 层 | 职责 | 代码 |
|---|---|---|
| ISR | 读 VirtIO 中断状态、清中断、唤醒 | [`kernel/src/drivers/virtio_net_irq.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/virtio_net_irq.rs) |
| 队列 owner | 唯一后台任务，收（reap/refill）与发（submit/reclaim）按预算推进 | [`axnet/src/service.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/service.rs) 与 [`async_rx.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/async_rx.rs) |
| 栈 runner | 常驻任务，推进 smoltcp 收发、维护与定时器 | [`axnet/src/stack_runner.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/stack_runner.rs) |
| 就绪桥 | 把 smoltcp 单槽 waker 展开成多等待者，接 poll/select | [`axnet/src/readiness.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/readiness.rs) |
| socket | TCP/UDP 公共句柄 | [`axnet/src/socket.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/socket.rs) |

定长槽位。`FixedFrameQueue`（[`device/fixed_queue.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/device/fixed_queue.rs)）用固定容量槽位存整包，内存占用有硬上界，队列压满时新包显式拒绝而不是无限缓存。

发送票号。每次发送向 `TicketTracker` 领一张递增票号，状态从 Queued 经 `mark_device_owned` 转到设备持有，回收时按票号注销；存活票上限 128 张（`MAX_LIVE_TICKETS`）。`QueueEpoch` 随队列重建推进，完成通知带的票号属于旧代际直接作废，缓冲区只有提交、完成、回收三处计数闭合后才复用。

每轮预算。owner 的收、回收与提交各 32（`RX_BUDGET`/`RECLAIM_BUDGET`/`SUBMIT_BUDGET`），栈 runner 每阶段 32（`STACK_STAGE_BUDGET`）。一轮做不完留到下一轮，由 waker 接力，不空转。

flush 语义。`FlushTicket`/`FlushWaiter`（[`flush.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axnet/src/flush.rs)）记录当前 `last_accepted` 票号为目标，等所有小于等于目标的存活票回收后完成，目标之后提交的票不计入本次等待，语义对应串口的 `tcdrain`。

就绪通知。每个公共 socket 句柄持有一个 `ReadinessBridge`，读、写、终态各挂一组 `PollSet`；smoltcp 的一次性单槽 waker 注册到桥上，桥把就绪事件扇出到 poll/select 注册的多个等待者。

恢复语义。取消按等待者取消、提交前撤销与设备持有三段区分；对外终态收敛为 6 种（连接复位、链路断开、超时、取消、所有权错误、设备 I/O），各带稳定错误码；复位必须确认设备状态清零后才重建队列。

SMP=16 六组场景（2026-09-26 运行；队列 owner 固定 hart 15、栈 runner 固定 hart 0、串口 RX/TX copier 分别在 hart 13/14）：

| 场景 | 实测输出 |
|---|---|
| 绑核检查 | 单例绑核、实际运行核与绑核一致、零拒绝，PASS |
| 关定时器跨核唤醒 | 唤醒完成 1 次、定时器恢复且无丢失；IPI 发送 = 接收 = 191 |
| TCP 双向 | 客内 socket 发 8 收 8，宿主机对端 ok；提交 11 = 完成 11 = 回收 11 |
| UDP 双向 | 客内 socket 发 8 收 8；提交 21 = 完成 21 = 回收 21 |
| 队列满载恢复 | 压满 64 槽再释放，恢复后发送 322 = 完成 322 = 回收 322、在途 0 |
| 空闲安静窗口 | poll 就绪与实际 I/O 一致，静默期收发路径无动作 |

六组全 PASS，探针退出码 0，宿主机抓包与客内 socket 计数逐项一致。串口多核冒烟测试同轮通过：远端唤醒字节送达、IPI 因果计数 4 = 4、TX 环形缓冲收敛。运行记录与抓包文件留档于 [SMP=16 资格验证目录](https://github.com/daivy2333/StarryOS/tree/mul-hart-k3/openspec/changes/archive/2026-09-26-ms08-qemu-multi-hart-correctness-baseline/evidence/005-per-driver-smp16-fixed-qualification/003-rework)。

## 多核适配：绑核与跨核唤醒

K3（进迭时空）AP 域有 8 个 X100 加 8 个 A100 共 16 核，两个驱动的后台角色固定绑核。绑核与唤醒走 `axtask` 新增的三处能力：`spawn_with_name_affinity` 在任务入队前完成绑定，调度器按 `AxCpuMask` 选运行队列；`send_reschedule_ipi` 向目标核发一次远端唤醒 IPI；`ipi_sent_count`/`ipi_received_count` 逐核计数，测试里 191 = 191 就是靠这对计数比对。角色与核的绑定写在 [`kernel/src/drivers/net_placement.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/net_placement.rs)：owner hart 15、runner hart 0、串口 RX/TX copier hart 13/14。观测两组：[`uart_smp_snapshot.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/uart_smp_snapshot.rs) 与 [`net_wake_witness.rs`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/kernel/src/drivers/net_wake_witness.rs)，直接读出每个角色跑在哪个核、IPI 是否丢失。内核临界区从"只关本地中断"升级为"本地中断恢复 + 全局互斥 + 每核嵌套计数"。唤醒本地优先，必须跨核时恰好发一次 IPI，避免唤醒风暴。

多核过程中修掉两个问题。TX 方向丢唤醒，通过在 waker 注册后重查硬件状态加重试解决。release 构建越界读出"幽灵核"，`AxCpuMask` 的 [`try_one_shot`/`set`](https://github.com/daivy2333/StarryOS/blob/mul-hart-k3/crates/axtask/src/cpumask.rs) 加容量检查后越界返回错误，不再读出幽灵核。

## K3 真板：从板级事实到 16 hart 异步化

W15 实习总结交付后，工作转到 SpacemiT K3 CoM260 Kit 真板。目标板是进迭时空 K3，AP 域 16 核。这条线沿用前面在 QEMU 和 D1 上验证过的异步结构，把它们搬到实物硬件后端：中断从 QEMU 的 PLIC 换成 K3 的 AIA（APLIC + IMSIC），网卡从 VirtIO 换成 Synopsys DWMAC5，PHY 从虚拟模型换成实物 RTL8211F，用户态从内核态载荷换成带 rootfs 的普通 shell。

工作分八个阶段推进：

| 阶段 | 时间 | 交付内容 |
|---|---|---|
| 板级事实核对 | 10/2 | 临时 RAM 启动可重复、MAC 寄存器可读、PHY 身份与链路插拔基线 |
| AIA 中断框架 | 10/3 | 中断投递通路 + PHY 设备 IRQ/status 基线 |
| GMAC 轮询双向网络 | 10/6 | DMA 与 cache 的一致性约定 + 16 slot 轮询收发 + 四协议会话 |
| 异步串口与交互 shell | 10/8 | runtime timer、PXA UART port、tty 行规程 |
| RAM rootfs 普通 shell | 10/8 | ext4 内存镜像挂载 + 动态 BusyBox |
| 单 hart 异步双向数据面 | 10/13 | `K3NetAdapter` 接入既有 NetDriverOps/queue/stack 接口 |
| 单 hart 恢复语义 | 10/14 | 受控 reset 矩阵、物理拔插、epoch 隔离 |
| 16 hart 多 hart 异步 I/O 验收 | 10/16 | 网卡与串口在 16 hart 上的联合验收 |

平台常量、AIA、DMA 与内存布局在 [`crates/axplat-riscv64-k3/`](https://github.com/daivy2333/StarryOS/tree/k3/crates/axplat-riscv64-k3)，GMAC 控制器与描述符在 [`kernel/src/platform/k3_gmac/`](https://github.com/daivy2333/StarryOS/tree/k3/kernel/src/platform/k3_gmac)，[`kernel/src/platform/k3_async_net.rs`](https://github.com/daivy2333/StarryOS/blob/k3/kernel/src/platform/k3_async_net.rs) 承接 AIA 中断通路与异步 owner，PXA UART 硬件层在 [`kernel/src/drivers/k3_uart_core.rs`](https://github.com/daivy2333/StarryOS/blob/k3/kernel/src/drivers/k3_uart_core.rs)。多 hart 入口按形态分三个文件：网卡 [`kernel/src/platform/k3_smp_net.rs`](https://github.com/daivy2333/StarryOS/blob/k3/kernel/src/platform/k3_smp_net.rs)、串口 [`k3_smp_uart.rs`](https://github.com/daivy2333/StarryOS/blob/k3/kernel/src/platform/k3_smp_uart.rs)，以及组合形态的 [`k3_smp_combined.rs`](https://github.com/daivy2333/StarryOS/blob/k3/kernel/src/platform/k3_smp_combined.rs)。

### 启动链与板级事实

板载 Bianbu 原厂 U-Boot handoff 后由 StarryOS 裸机内核接管（RISC-V S-mode），全程不写持久介质：上电长按 `s` 进 U-Boot，`usb start` 后 `fatload` 把 FIT 装载到 `0x2e0000000`，`setenv fdt_high 0xffffffffffffffff` 后 `bootm` 启动。任意时刻 `reset` 或断电都回到原厂 Bianbu，10/1 与 10/6 多轮验证一致。FIT 的 kernel load/entry 在 `0x180000000`，FDT 在 `0x181000000`。

逐项核对得到的板级事实：MAC MMIO 在 `0xcac82000`，APMU 两步使能后读到 `version=0x1054`；PHY 经 MDIO Clause 22 读回 `phyid=0x001cc916`，实物是 RTL8211F，reset 脚是 GPIO1_5；120 s 窗口内 ≥5 个完整的 link up→down→up 循环可重复。这些事实同时写进 [k3 仓库](https://github.com/daivy2333/k3)的 `docs/`，作为该板后续开发的基线。

### 中断框架与本板实测结论

K3 的中断走 AIA。APLIC base `0xe0804000`，IMSIC base `0xe0400000`。S-mode 下 `stopei` 做原子 claim+EOI 且先于 handler 执行，SETIPNUM 与 GENMSI 两个入口都能投递，双 mask，retrap 与 unknown cause 分流处理，另有中断风暴预算限制。代码在 [`crates/axplat-riscv64-k3/src/aia.rs`](https://github.com/daivy2333/StarryOS/blob/k3/crates/axplat-riscv64-k3/src/aia.rs)。真板 wired source 编号逐个测出来：PHY 是 60，GMAC MAC 是 133（异步使用）与 277（只读观察），UART 是 42。

板上实测出一批官方资料没有记载的行为，代码与注释按此修改：

| 现象 | 处置 |
|---|---|
| EIE 掩码窗口内 MSI 丢弃 | 掩码不在触发前置位，触发后才置 |
| MFPR EDGE CLEAR 复位默认置位（hold-in-clear） | 武装前必须显式释放，并读回校验 |
| 每个物理事件产生一条 INSR=0 回声 claim | 分类器排除回声 |
| APLIC SETIPNUM 对已 deassert 的 LevelHigh 源不生效 | 改走 source-60 事件路径 |
| UART FCR 触发阈值 00 不推进 RX 中断 | 必须写 PXAR8（`0x41`） |
| PXA Errata-20 在本板适用 | RTOIE 先清 → RBR 批量读 → 恢复 |
| IIR 对 IER 已掩码 cause 照报 | ISR 以 8-cause 预算收尾 |
| GMAC TX tail 是排他 fetch 上界 | doorbell 写 next slot |
| GMAC RX tail 写为唤醒 doorbell | fetch 由 OWN 驱动 |
| PHY INTN 是电平型 | 插回上升沿可达，arm 时清 INSR pending |

### 网卡：轮询基线到异步数据面

先做轮询，是为了先定下 DMA 与 cache 的一致性要求。独占 18 页 arena（73728 B），16 个 slot，descriptor 64 B，buffer 2048 B；地址走线性 PA，cache 用显式 Zicbom 路径维护（`.insn i 15,2` 做 clean/flush/inval，cache line 64 B，CBO 用 VA、设备用 PA，门铃前 `fence iorw`），这套要求写在 [`crates/axplat-riscv64-k3/src/dma.rs`](https://github.com/daivy2333/StarryOS/blob/k3/crates/axplat-riscv64-k3/src/dma.rs)。轮询网络阶段的真板验收在 60 s 会话窗内跑通，串口打印的结果为 `result icmp-replies=10 udp-echo=8 udp-over-limit=0 tcp-echo=8 tcp-close=Closed rx-frames=23 rx-drops=0 tx-terminals=16 tx-errors=0 tx-timeouts=0`，即零 drop、16 个发出帧全部进入 terminal。

轮询跑通后换异步。GMAC source-133 的 IOC 中断通路按注册/重臂/重查协议工作，deferred owner 与 fatal latch 已就绪；[`kernel/src/platform/k3_gmac/adapter.rs`](https://github.com/daivy2333/StarryOS/blob/k3/kernel/src/platform/k3_gmac/adapter.rs) 的 `K3NetAdapter` 接入前面积累的 NetDriverOps/queue/stack 接口，保持唯一 owner、slot 与 descriptor 计数一致，以及两级 Full→恢复，C4 flush 走 Pending→release→C4 路径。真板四协议复测两轮 ping 10/10、UDP 与 TCP 全字节回显，quiet 窗口在吸收 TCP 关闭尾流的沉降阶段结束后，2 s 内计数逐字节冻结。

恢复语义按三段区分取消：等待者取消、提交前撤销与设备持有。单 hart 恢复阶段的受控矩阵在真板上跑了 18 页 arena 原地 stop/SWR/重建、QueueEpoch 与 cookie 的旧新隔离，resident owner 与旧 socket 连接复位终态，以及 flush abort，容量第 1 轮 81 帧的两级边界也测到了。物理拔插用 source-60，插回后上升沿可达——`phy60-event observed events=3→5`——插回后的新会话逐字节 UDP/TCP 交换成立。插回后 link 不稳定的三种候选机制没有定位，按当时的评审决定记录留档，不再追查。

### 串口与用户态

K3 的 UART 是 PXA 兼容实现，MMIO `0xd4017000`，64 B FIFO，固定 115200 8N1，硬件层在 [`kernel/src/drivers/k3_uart_core.rs`](https://github.com/daivy2333/StarryOS/blob/k3/kernel/src/drivers/k3_uart_core.rs)。异步 port 接入既有 copier/ring/tty/用户态接口：64 KiB 收发环、check-register-arm-recheck 协议与三步 FCR 激活加陈旧 RBR 排空，以及四条件物理 drain——末字节的 TEMT 位由 native 1 ms timer hook 推进。tty 保持 canonical 语义：空格与 tab、ERASE 与 KILL 两类编辑键，1024 B 行界整行 discard，以及 EOF 0-read。

用户态走两条路。先是内存根内嵌静态 ELF 的最小交互 shell（help/echo/sleep/exit），板测两轮全场景通过，含 SIGINT 对照与复位回归；再是 RAM rootfs 的普通 shell，从临时加载的 ext4 内存镜像挂载根文件系统，经普通 loader 启动动态 BusyBox `/bin/sh`（musl 解释器）并执行挂载进来的文件系统中的外部命令。RAM rootfs 阶段的 OOM 根因在 axruntime 的页分配器：主区取 `.bss` 之后第一个 FREE 区，预留的 rootfs 承载窗不能落进这段区间。

### 16 hart 验收

最终形态是 `k3-smp-combined`，16 个 AP hart 全部实际调度，per-hart timer 与 `S_SOFT` 均真板验证。各角色绑定的核与 QEMU 那轮不同：NIC owner hart 2、runner hart 3 与 app hart 9，串口 RX/TX copier 在 hart 0/1，shell 用户任务在 hart 8，boot hart 为 0。板测输出 `placement owner=2 runner=3 app=9 harts=16 anchor=0`、`owner-active hart=2`、`stack-active hart=3`、`app begin hart_actual=9 expect=9`，角色绑定与实际执行一致。

16 个 AP hart 分成两个异构簇：0-7 是 X100，8-15 是 A100。上面的分配让后台角色跨簇分布：shell 任务在 hart 8（A100 簇），UART copier 在 hart 0/1（X100 簇），跨簇唤醒经 remote-ready IPI 完成；板测里关闭 hart 8 的 STIE 后由 source-1 注入链唤醒，`timer_restored=1` 且随后的 sleep 成立，说明目标 hart 自己的定时器停摆不影响跨核投递。

网卡专项两轮覆盖四协议、两级容量、C4 与 quiet，容量输出 `accepted=80 tx-slot-full=1 desc-inflight=16 slot-backlog=64` → `restored tx-slot=0 desc-inflight=0 buf-available=16` → `flush pending` → `release-2 ok` → `flush c4 ok` → `auto-release=0`。串口专项两轮覆盖 raw 与 shell 双形态，raw 侧的输出 `txfull drained requested=73728 accepted=73728 short_writes=89` 与 `drain done (TxCompletion four conditions)`，错误计数 `rx_dropped_bytes=0`、各类错误计数全零；shell 侧 help/echo/sleep/行编辑/异常输入恢复/exit 全部成立，退出后在 30 s 上限内 drain 完成。

组合形态是 BusyBox RAM rootfs 加 16 hart：`wget` 下载 10 字节并逐字节读回 `k3-http-ok`，`nc` 的 TCP 与 UDP 同内容回显，shell 全程存活。这一轮暴露并修掉两个产品问题，都先在真板上复现，修复后回板验证：

- K3 跨簇 instruction page fault 间歇性污染 `stval`（`sepc` 始终正确），[`kernel/src/mm/loader.rs`](https://github.com/daivy2333/StarryOS/blob/k3/kernel/src/mm/loader.rs) 的 `map_elf` 改为 eager populate 规避。
- 用户态网络 syscall 家族此前被 cfg 全门，`wget` 报 `Function not implemented`，门收窄为仅 `k3-smp-combined` 开启。

之后补了一个板端 TCP 聊天载荷 [`tests/k3_chat_client.c`](https://github.com/daivy2333/StarryOS/blob/k3/tests/k3_chat_client.c)，配合 PC 侧的 [`k3_chat_server.py`](https://github.com/daivy2333/StarryOS/blob/k3/tests/k3_chat_server.py)：父进程把串口输入转进 socket，子进程把 socket 收到的内容打回串口。串口异步 I/O 与网卡异步收发在同一进程里同时跑，两条链路互不干扰。

### 与原厂 Linux 的吞吐对比

同一块板、同一根网线、同一个 Windows PC 网卡，单连接 TCP、32 MiB 载荷、接收端计时：

| 方向 | StarryOS | 原厂 Linux | 比值 |
|---|---|---|---|
| 板→PC | 714.3 Mbps | 934.0 Mbps | 76.5% |
| PC→板 | 218.8 Mbps | 854.3 Mbps | 25.6% |


K3 这条线的完整阶段状态、每轮真板输出与复现步骤，都留档在 [StarryOS 仓库的 K3 归档目录](https://github.com/daivy2333/StarryOS/tree/k3/openspec/changes/archive) 与 [k3 仓库的真板运行验证分析](https://github.com/daivy2333/k3/blob/main/.agents/analysis/k3-starryos-real-board-verification.md)。

## 视频演示

[SMP=16 演示录屏（2026-10-06）](https://daivy2333.github.io/OhMyOs/notes/%E8%A7%86%E9%A2%91/screen-recording-2026-10-06/)：ping 百度与经宿主机服务器拉取文件，网卡收发与串口输出均正常（[mp4 直链](https://daivy2333.github.io/OhMyOs/video/screen-recording-2026-10-06.mp4)）。

[异步驱动开发成果演示（2026-10-18，4 分 45 秒）](https://www.bilibili.com/video/BV1WenG6cE9N/)：K3 真板上的驱动成果演示，含串口交互与网卡收发的实际运行过程。

## 不足

K3 上的 TCP 吞吐为原厂 Linux 的 76.5%（板→PC）与 25.6%（PC→板），差异没有定位；整体架构没有做优化，异步改造的收益也没有量化测试。

