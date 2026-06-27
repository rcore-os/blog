---
title: 20260627-LetsWalkInLine-2026春季训练营总结报告：围绕 StarryOS Linux 兼容性的若干修复与探索
date: 2026-06-27 16:17:09
categories:
    - OSTraining
tags:
    - author:LetsWalkInLine
    - repo:https://github.com/LetsWalkInLine/tgoskits
    - 2026S
    - StarryOS
---

## 一、项目背景

2026 春季开源操作系统训练营的项目阶段提供了多个实践方向。我参加的是项目一：宏内核 StarryOS。这个方向的核心任务是在已有 StarryOS / tgoskits 代码基础上，围绕 Linux 兼容性、真实应用运行和系统调用语义完善做增量改进。

从项目页给出的任务组织方式来看，StarryOS 的改进可以从单个 syscall 或 bugfix 入手，也可以从真实 Linux app 的运行路径入手，再逐步扩展到更完整的系统能力。我的工作基本涉及到了这两类：

1. 从 syscall 测例出发修复 futex、robust-list 等基础 ABI 语义；
2. 从 nginx smoke 测试和后续 Docker 前置能力出发，修复 socket ioctl 和 cgroup2 的早期支持问题。

这些工作由若干个相对独立的小 PR 组成，它们都遵循同一个流程：先用用户态可观察行为暴露 StarryOS 与 Linux ABI 的差异，再通过较小范围的内核修改和测试用例把差异收敛下来。

<!-- more -->

## 二、训练营先导阶段的学习

在进入项目阶段之前，我主要完成了 rCore 和 ArceOS 相关学习和实验。专业阶段阅读 rCore 时，我重点记录了几个操作系统核心抽象和机制，包括进程、虚拟内存、文件、设备、系统调用接口，以及上下文切换、中断和页表等内容。

这一阶段的学习涉及到的细节内容此处就不展开赘述了。在学习的过程中，我遇到的最大的困难是理解rcore的文件系统这一章节内容，相比于其他章节，文件系统这一部分内容的抽象嵌套深度是最深的，课后实验做起来也最费时间。面对好几层的抽象设计，我一度感到迷茫，好在有ai的帮忙，我才逐渐理解了文件系统的设计思路和实现细节。

## 三、主要工作

### 3.1 工作方法

项目阶段里我一以贯之地采用了同一种工作方式：

1. 先找到一个用户态可观察的问题，例如某个 syscall 返回错误、某个 Linux app 在固定路径失败，或者某个 pseudo filesystem 文件行为不符合预期。
2. 尽量把问题缩小成一个 focused C 测例或 QEMU case，不依赖大型应用的整体启动结果。
3. 对照 Linux ABI 或已有代码设计，确认应当修复的是错误码、状态更新、生命周期，还是 VFS / task / socket 等模块之间的协作关系。
4. 尽量做最小范围的修改，并在 PR 中说明本次覆盖范围和未覆盖范围。在与AI协作的同时也明确告诉AI改动的边界，避免对未覆盖范围做出不必要的假设。
5. 在 x86_64、aarch64、riscv64、loongarch64 等 StarryOS 支持的架构上运行目标测试，避免只在单一架构上验证。

这个工作方式可以让每个 PR 的目标比较明确，也便于 review。但它的局限也很明显：如果问题本身牵涉很广，比如完整 Docker、完整 nginx 或完整 cgroup controller，那么单个 PR 只能推进其中一个小范围的垂直功能，不能把它包装成“已经完整支持”，而且过于谨慎的态度会导致开发进度偏慢，连累到其他相关模块的同学的工作。对此，我所遇到的cgroup v2的PR冲突就是一个教训。

### 3.2 主线一：信号测试、futex 与 robust-list 语义修复

这一部分的工作主要包括三个 PR：

- [rcore-os/tgoskits#468](https://github.com/rcore-os/tgoskits/pull/468)：修复 `starry-signal` restore 测试中的跨架构栈假设。
- [rcore-os/tgoskits#545](https://github.com/rcore-os/tgoskits/pull/545)：修复 futex wait / requeue / robust-list owner death 的基础语义。
- [rcore-os/tgoskits#657](https://github.com/rcore-os/tgoskits/pull/657)：进一步完善 futex / robust-list 的 Linux ABI 基础语义。

下文将做详细介绍。

#### 3.2.1 `starry-signal` 跨架构 restore 测试修复

> 这份工作是我在正式开始项目阶段前选取的个issue中报告的小bug练练手，体验一下社区协作的感觉

[#468](https://github.com/rcore-os/tgoskits/pull/468) 是一个规模较小但比较典型的修复。原测试在调用 `restore()` 前无条件调整栈指针，这个行为符合 x86_64 handler 通过栈上 restorer 和 `ret` 返回时会消耗 8 字节的情况，但并不适用于 aarch64、riscv64、loongarch64 等架构。

这个问题本质上是测试把 x86_64 的特殊返回路径当成了所有架构的通用行为。修复方式也比较克制：提取 helper，并且只在 `target_arch = "x86_64"` 时调整 `sp`，其他架构保持 `sp` 指向真实 `SignalFrame` 起点。

这个 PR 的价值在于消除了一个跨架构测试假设，避免后续开发者在 aarch64 等架构上被错误测试误导。

#### 3.2.2 futex / robust-list 第一阶段修复

[#545](https://github.com/rcore-os/tgoskits/pull/545) 处理的是 StarryOS futex 和 robust-list 相关的一组基础兼容性问题。futex 这类接口表面上只是一个 syscall，但它背后影响 pthread condition variable、robust mutex、语言运行时和更复杂用户态程序的同步行为，是一个较为核心和复杂的系统调用。

这一阶段主要修复了：

- `FUTEX_WAIT` 超时或中断后的 waiter 清理问题。
- `FUTEX_REQUEUE` 后 waiter 身份在目标队列中的冲突问题。
- `FUTEX_WAIT_BITSET` / `FUTEX_WAKE_BITSET` 对 `val3 == 0` 的参数校验。
- robust-list owner death 对用户态 futex word 的 Linux ABI 更新方式。

为了验证这些行为，我新增了 `test-futex-robust-list` 测例，直接使用 C 语言 raw `syscall()` 调用，尽量避免 glibc 或 pthread 封装掩盖内核行为。该 PR 后 focused case 在多个架构上通过，测试达到 `64 pass, 0 fail`。

#### 3.2.3 futex / robust-list 继续完善

[#657](https://github.com/rcore-os/tgoskits/pull/657) 是 [#545](https://github.com/rcore-os/tgoskits/pull/545) 的后续，重点从“修复明显错误”推进到“整理基础语义”。这个 PR 增加了 futex command / option bits 的集中解析，补充了 `FUTEX_PRIVATE_FLAG`、`FUTEX_CLOCK_REALTIME` 合法性、private/shared key、requeue cleanup 元数据、robust-list pending entry 和坏链/环链等边界处理。

对应的 `test-futex-robust-list` 也扩展到 `146 pass, 0 fail`,使得基础 wait/wake、bitset、requeue、robust-list owner death 和一批错误码行为具备了可回归的测试覆盖。

在 PR 中我也明确保留了未完成范围，例如 PI futex、`FUTEX_WAKE_OP`、futex2、完整 signal interruption / restart、shared futex key 的完整生命周期审计等。这些内容复杂度明显更高，不适合在这个 PR 中承诺。对于和Linux行为完全一样的futex全家桶的实现，我也没有继续往下推进，因为可以预见这是一个较为复杂和具有较大破坏性的工作，可能会影响到其他模块的稳定性。

### 3.3 主线二：nginx smoke 暴露出的 socket 兼容性问题

这一部分的工作主要包括：

- [rcore-os/tgoskits#796](https://github.com/rcore-os/tgoskits/pull/796)：支持 nginx worker channel 初始化依赖的 socket `FIOASYNC` / owner 状态。
- [rcore-os/tgoskits#869](https://github.com/rcore-os/tgoskits/pull/869)：支持 TCP socket `FIONREAD`，并补充 nginx smoke 测试入口。

针对nginx的适配工作，下文是详细介绍。

#### 3.3.1 `FIOASYNC` 与 socket owner 状态

在排查 nginx 运行路径时，我发现 nginx worker 启动过程中会通过 `socketpair(AF_UNIX, SOCK_STREAM)` 创建 worker channel，并对 channel fd 设置非阻塞、异步通知和 owner 相关状态。StarryOS 当时缺少 `ioctl(FIOASYNC)` 支持，导致 nginx 初始化路径在用户态直接失败。

因此，[#796](https://github.com/rcore-os/tgoskits/pull/796) 的目标是补齐 nginx 当前路径需要的最小状态语义：

- `ioctl(FIOASYNC)` 能从用户态读取开关并更新 socket async 状态。
- `F_GETFL` 能反映 `FASYNC` / `O_ASYNC` 状态。
- `F_SETFL` 能同步处理 async 位，同时保留 `O_NONBLOCK` 等已有状态。
- socket 支持 `F_SETOWN` / `F_GETOWN` owner 状态。
- 对空指针、非法 fd 等错误路径返回明确 errno。

这个 PR 新增了 `bug-nginx-fioasync` 测例，用一个较小的用户态程序覆盖 nginx worker channel 所需的行为，避免每次都只通过完整 nginx 启动结果判断修复是否有效。

#### 3.3.2 TCP socket `FIONREAD`

[#869](https://github.com/rcore-os/tgoskits/pull/869) 继续来自 nginx smoke 的排查。基础 nginx 链路已经能完成安装、配置检查、单进程启动、master/worker、reload/quit、静态 GET/HEAD、sendfile 大文件、Range、小 POST 和多次短连接。后续异常集中在 sendfile 配置下的超限 POST：客户端发送超过 `client_max_body_size` 的 body 时，nginx 没有返回预期 413，而是出现 empty reply。

日志中能看到 nginx 在 request body 路径上调用了 `ioctl(FIONREAD)`，而 StarryOS 对 TCP socket 返回了类似 `ENOTTY` 的错误。这个错误会让 nginx 的对应路径失败。

[#869](https://github.com/rcore-os/tgoskits/pull/869) 因此实现了 TCP stream socket 的 `FIONREAD`：

- accepted TCP socket 初始返回 0。
- client 写入数据后，server 端返回 receive queue 中完整未读字节数。
- server 部分读取后，返回剩余未读字节数。
- 读空后返回 0。
- listening socket 上的 `FIONREAD` 返回 `EINVAL`。
- 空指针返回 `EFAULT`。

这个 PR 同时新增了 `bug-nginx-fionread-socket` 和 `nginx-smoke` 相关测试入口。修复后，原先由 `FIONREAD` 阻塞的超限 POST 路径能够推进到预期 413。

这里同样需要明确边界：PR 没有实现 UDP、RAW、AF_UNIX datagram 的 `FIONREAD`，没有实现 Linux AIO syscall family，也没有解决 nginx keep-alive 两连请求等后续 smoke 暴露的问题。它只是解决了一个具体、可复现、可验证的阻塞点。

### 3.4 主线三：cgroup2 初始支持与后续探索

cgroup 方向主要包括：

- [rcore-os/tgoskits#989](https://github.com/rcore-os/tgoskits/pull/989)：添加 cgroup2 初始 root 文件支持。
- [rcore-os/tgoskits#1015](https://github.com/rcore-os/tgoskits/pull/1015)：支持 cgroup2 hierarchy 的 `mkdir` / `rmdir`。
- [rcore-os/tgoskits#1045](https://github.com/rcore-os/tgoskits/pull/1045)：提交过 cgroup2 process migration 和 `/proc/[pid]/cgroup` 支持，但最终关闭，未合并。

#### 3.4.1 为什么转向 cgroup

因为平时看了一些unikernel和container相关的论文，在 nginx 方向推进一段时间后，我开始调研 cgroup 支持情况。cgroup 是 Docker、systemd 和更完整 Linux 发行版兼容路径中的关键基础设施之一。cgroup 提供了进程分组、资源限制、监控和隔离的能力。在我的工作正式开展之前，StarryOS 对 cgroup 的支持几乎等于一片空白，仅有一些其他模块的 stub 或者 fake 接口。

因此我在 [#582](https://github.com/rcore-os/tgoskits/issues/582) 中采用了 slice 化的计划：避免直接提交一个上千行的大PR，而是按 `mount cgroup2 -> root interface files -> hierarchy -> cgroup.procs membership -> /proc/[pid]/cgroup -> fork/exit -> pids controller` 的路径逐步推进，每个PR控制在一千行以内，一个PR实现一个小范围的垂直功能。

在这个方向的工作过程中，无论是在与AI协作还是在撰写PR body，涉及到新增 cgroup 文件时，要说明它是真实语义、只读兼容，还是未支持并返回错误。尽量避免“写入成功但没有实际效果”的 fake success。

#### 3.4.2 cgroup2 root 文件支持

[#989](https://github.com/rcore-os/tgoskits/pull/989) 是 cgroup 支持的第一阶段。它的目标是让 StarryOS 能显式挂载最小 cgroup2，并暴露 root cgroup 下的基础 interface files：

- 支持 `mount("none", target, "cgroup2", 0, NULL)`。
- 暴露 `cgroup.procs`、`cgroup.controllers`、`cgroup.subtree_control`。
- root `cgroup.procs` 能读到当前活跃进程 PID 列表。
- 在没有真实 controller 前，`cgroup.controllers` 和 `cgroup.subtree_control` 保持为空。
- 未实现写操作返回明确错误。
- cgroup v1 `mount -t cgroup` 继续返回 `ENODEV`。

这个 PR 新增了 `cgroup-basic` 测例，在四个平台 QEMU 上达到 `11 pass, 0 fail`。它不实现 cgroup 层级、controller、进程迁移、`/proc/[pid]/cgroup`、pids/cpu/memory controller 或 cgroup namespace。

#### 3.4.3 cgroup2 hierarchy 的 `mkdir` / `rmdir`

[#1015](https://github.com/rcore-os/tgoskits/pull/1015) 在 [#989](https://github.com/rcore-os/tgoskits/pull/989) 基础上继续推进，目标是支持 child cgroup 的创建、查找和删除。这个 PR 引入了全局 cgroup tree，维护 cgroup id、父子关系、child 名称映射和基础路径查询，并让 cgroup2fs 的目录操作真实修改这棵 tree。

实现中还遇到 VFS 动态目录和缓存之间的关系问题。cgroup2fs 目录不是静态目录，它的 child 会随着 `mkdir` / `rmdir` 变化。如果直接复用 per-instance dentry cache，容易出现删除后仍能从旧句柄看到 stale child 的问题。因此该 PR 将 `CgroupDir::is_cacheable()` 设为 `false`，并补充了 `has_children()` hook，让空目录删除只统计真实 child cgroup，而不是被 interface files 阻塞。

对应的 `cgroup-basic` 扩展到 `43 pass, 0 fail`，覆盖 child / nested 创建、重复创建、非空 parent 删除失败、空目录删除成功、删除后 lookup/stat 失败、普通文件创建 / hard link / symlink / rename 的失败行为等。

这个 PR 仍不实现 per-process membership、`cgroup.procs` 迁移、fork/exit 继承与清理、`/proc/[pid]/cgroup` 或 controller。它的定位是 hierarchy 基础。

#### 3.4.4 #1045 的状态

[#1045](https://github.com/rcore-os/tgoskits/pull/1045) 是我基于 [#1015](https://github.com/rcore-os/tgoskits/pull/1015) 继续提交的后续 PR，目标是实现 `cgroup.procs` 进程迁移、fork 继承、退出清理和 `/proc/[pid]/cgroup` 视图。这个 PR 曾经过 review，并处理过一些同步和锁序问题；后续因为存在增量功能更多、更完整的 PR，以及与其他维护者工作重叠与冲突，在与其他维护者进行沟通后，于 2026-06-05 被我关闭，没有合入上游。

PR [#1045](https://github.com/rcore-os/tgoskits/pull/1045) 经过了我一个星期的学习和打磨，但最终因为和其他同学的冲突而没能真正合并，让我不可避免地感到有些沮丧。不过更重要的是它让我意识到：在一个快速变化的社区仓库里，技术实现只是开源协作的一部分。及时同步上游进展、确认任务边界、避免和其他人的 PR 产生长期冲突，是非常重要的，这既可以避免不必要的重复劳动，也可以在交流的过程中打磨方案。

## 四、量化成果与达到的效果

截至 2026-05-31 比赛提交时，我在 `rcore-os/tgoskits` 主仓库共有 7 个已合并 PR：

| PR | 主题 | 状态 |
| --- | --- | --- |
| [#468](https://github.com/rcore-os/tgoskits/pull/468) | 修复 `starry-signal` restore 测试中的跨架构栈假设 | Merged |
| [#545](https://github.com/rcore-os/tgoskits/pull/545) | 修复 futex wait / requeue / robust-list owner death 基础语义 | Merged |
| [#657](https://github.com/rcore-os/tgoskits/pull/657) | 进一步完善 futex / robust-list Linux ABI 基础语义 | Merged |
| [#796](https://github.com/rcore-os/tgoskits/pull/796) | 支持 nginx 初始化依赖的 socket `FIOASYNC` / owner 状态 | Merged |
| [#869](https://github.com/rcore-os/tgoskits/pull/869) | 支持 TCP socket `FIONREAD`，修复 nginx 超限 POST 阻塞点 | Merged |
| [#989](https://github.com/rcore-os/tgoskits/pull/989) | 添加 cgroup2 初始 root 文件支持和 `cgroup-basic` 测试 | Merged |
| [#1015](https://github.com/rcore-os/tgoskits/pull/1015) | 支持 cgroup2 hierarchy 的 `mkdir` / `rmdir` 基础能力 | Merged |

按 GitHub PR 统计口径，这 7 个已合并 PR 共涉及 17 个提交、50 个变更文件，合计 `+4007/-224` 行。这个统计包含测试代码、QEMU 配置、支撑代码和必要的文档式 PR 描述。

另有 [#1045](https://github.com/rcore-os/tgoskits/pull/1045) 曾提交 cgroup2 process migration 和 `/proc/[pid]/cgroup` 支持。该 PR 尚未合入；截至本文撰写时，它已关闭且未合并。

除 tgoskits 主仓库外，我还在 `arceos-org/axcpu` 提交过两个相关 PR：

- [arceos-org/axcpu#28](https://github.com/arceos-org/axcpu/pull/28)
- [arceos-org/axcpu#30](https://github.com/arceos-org/axcpu/pull/30)

这两个 PR 是同一 RISC-V FP/SIMD 上下文切换修复分别合入 `dev` 和 `main` 的记录，问题来源与下游 StarryOS 在 riscv64 + RustSBI 下的启动问题有关。它们不是 tgoskits 主仓库成果，因此这里只作为社区相关贡献补充说明。

## 五、一些感想和收获

本次训练营毫无疑问是关于OS的，也的确让我对OS拥有了更加深入的理解。但在工作的过程中，我认为我收获最大的反而是如何与AI Agent协作进行大规模工程的局部理解和开发以及如何参与社区协作。

在整篇文章涉及的scope里，我在相关工作中所花费的token总数为5.45亿，从GitHub copilot学生订阅，到中转站，到最后偷渡订阅ChatGPT Plus，为了获取强大的AI而无所不用其极。也是在这个过程中让我慢慢固定了spec驱动的TDD开发工作流，然而毫无疑问，在训练营之外面对其他的工作时，需要不断的更新和锻炼使用AI的能力，让AI更好的服务于我，而不是取代我。

但很显然，AI无法实现我们向它许下的所有愿望。涉及内核状态、锁顺序、生命周期和错误码时，最终仍然需要自己确认。比如 cgroup membership 的 live count、process table 与 cgroup tree 的锁顺序、`ProcessData::Drop` 和 wait reap 的关系等问题，在前几次的协作中AI都没有发现，只有在多次review下才暴露出来。因此，AI 更像一个高效的辅助 reviewer，而不是可以替代工程判断的实现者。如果在使用AI的过程中放弃思考，那么产出的代码会变成技术债务，而非技术资产，由技术债堆积起来的繁荣泡沫，总有要破灭的一天。

当然，最重要的收获当然是对OS的认识和项目协作了。在交流中老师强调“小步快跑”，我的体验也基本如此。小 PR 更容易 review，也更容易在 CI 和 QEMU 测试中定位问题。然而小步推进并不意味着没有协作成本。上文提到的 [#1045](https://github.com/rcore-os/tgoskits/pull/1045) 就是一个例子，给讨厌与陌生人打交道的我上了一课。

## 六、未完成边界

这里单独列出我的工作后续可以/应该完成但我尚未完成的内容（可能最新状态已经被其他人实现或完成了）。

### 6.1 futex / robust-list

我的已合并工作覆盖了基础 wait/wake、bitset、requeue、普通 robust-list owner death 等语义，但尚未实现或完整审计：

- PI futex，例如 `FUTEX_LOCK_PI`、`FUTEX_UNLOCK_PI`、`FUTEX_WAIT_REQUEUE_PI`。
- `FUTEX_WAKE_OP`。
- futex2 / `futex_waitv`。
- 更完整的 signal restart / interruption 细节。
- shared futex key 在文件映射、COW、unmap/remap、inode 生命周期下的完整性。

### 6.2 nginx

我的工作修复的是 nginx smoke 暴露出的两个具体 socket ioctl 阻塞点：

- `FIOASYNC` / socket owner 状态。
- TCP socket `FIONREAD`。

尚未完成：

- 完整 `SIGIO` 投递。
- UDP / RAW / AF_UNIX datagram 的 `FIONREAD`。
- Linux AIO syscall family。
- nginx keep-alive 两连请求等后续 smoke 暴露的问题。
- 完整 nginx 生产级兼容性。

### 6.3 cgroup

我的已合并工作只能描述为 cgroup2 初始支持和 hierarchy 基础能力。尚未完成：

- per-process cgroup membership 的合入。
- 写 `cgroup.procs` 迁移进程的上游合入。
- fork/clone 继承、exit 清理的上游合入。
- `/proc/[pid]/cgroup` 的上游合入。
- pids/cpu/memory/io/cpuset controller。
- cgroup namespace、`clone3.cgroup`、`CLONE_INTO_CGROUP`。
- systemd / Docker 完整兼容。

## 七、工作仓库

本次成果公开整理在：[rcore-os/tgoskits#582](https://github.com/rcore-os/tgoskits/issues/582)
本地工作仓库：[LetsWalkInLine/tgoskits](https://github.com/LetsWalkInLine/tgoskits/tree/local/dev)

## 八、总结

总的来说，这次训练营项目阶段，我的贡献比较分散，计划聚焦的cgroup方向没能完全走下去，但在信号、futex、socket ioctl 和 cgroup2 mount / hierarchy 等方面都做了力所能及的贡献，也算是收获与遗憾并存吧。

- 修正了一个跨架构 signal restore 测试假设。
- 推进了 futex / robust-list 的基础 Linux ABI 语义。
- 修复了 nginx smoke 暴露出的两个 socket ioctl 阻塞点。
- 为 cgroup2 mount、root interface files 和 hierarchy 建立了初始实现与测试。

这些工作虽然都只是 StarryOS 持续演进中的一小部分，但它们对应真实问题、公开 PR、review 过程和可复核测试。对我个人来说，更重要的收获是：开始从“完成实验”转向“在真实社区仓库里围绕问题、测试、边界和协作节奏做增量开发”。

这次经历也让我更清楚地意识到，对于操作系统这种复杂工程来说，能把一个小语义讲清楚、测清楚、合进去，对我来说是一个很大的进步了。即使后续不再继续沿同一方向投入，这些测试、PR 和问题边界仍然是可以被复查和继续利用的工作记录。

