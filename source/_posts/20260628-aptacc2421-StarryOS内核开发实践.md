---

title: StarryOS 内核开发实践：系统调用、/proc 内存计账与多场景应用支持——2026 春季训练营总结报告
date: 2026-06-28 16:40:28
categories:
    - OSTraining
tags:
    - author:aptacc2421
    - repo:tgoskits
    - 2026S
    - StarryOS
    - 系统调用
    - 内存管理

---

<!-- more -->

**作者**: 胡鑫鸿 (aptacc2421)
**仓库**: [rcore-os/tgoskits](https://github.com/rcore-os/tgoskits) | 个人 fork: [aptacc2421/tgoskits](https://github.com/aptacc2421/tgoskits)
**跟踪 Issue**: [#580](https://github.com/rcore-os/tgoskits/issues/580)
**训练营时间**: 2026-05-11 — 2026-06-26

---

## 摘要

七周内，在 StarryOS（基于 ArceOS 的 Linux 兼容内核）上完成 8 个 upstream merged PR，覆盖 syscall 语义对齐、`/proc` 进程内存统计、Redis 应用支持、RK3588 板级 SMP、ACT 模型推理五个方向。

本次训练营最核心的技术故事是 `/proc` RSS 计账模块的开发与调试：初版设计在社区 review 中被推翻重构（从全局物理页框计数改为 per-VA BTreeMap），测试过程中又遭遇了"测量工具自身污染测量值"的问题——musl libc 的 `fopen` 在读取 `/proc/self/status` 时分配的匿名 mmap 被计入了进程自身的内存统计，导致断言恰好偏差 1 页（4KB）。定位这个根因的过程历时 12 小时、遍历了 6 条被逐一证伪的假说，最终通过内核 tracepoint 和 strace 对照实验找到了真相。

**核心发现**：在 OS 内核调试中，先验证观测手段、再怀疑内核；人懂底层约束（如 smp=1、fork 地址空间隔离、±1 页优先查 libc）是 AI 不可替代的环节。

| 方案   | 内容                                                        | 状态                                           |
| ------ | ----------------------------------------------------------- | ---------------------------------------------- |
| 方案一 | syscall 语义（memfd/pidfd/mmap/waitpid）与 `/proc` 内存统计 | 8 个 upstream merged PR                        |
| 方案二 | Redis 应用与 VFS/ext4                                       | #807 merged；#808 closed（被 Kevin #802 覆盖） |
| 方案三 | RK3588 SMP / ACT 推理                                       | #1196 merged；ACT QEMU 推理管线打通            |

---

## 一、背景：StarryOS 训练营选题

StarryOS 是构建在 ArceOS 模块化内核之上的 Linux 兼容内核。它与传统宏内核不同——内核模块以 Rust crate 组织，通过 `#![no_std]` 在裸机上运行，目标是让未经修改的 Linux 用户程序（如 Redis、psutil、Python 推理引擎）在嵌入式设备上直接运行。

训练营选题在 [#580](https://github.com/rcore-os/tgoskits/issues/580) 中拆为三条线：

1. **Syscall 测例与语义完善** — 补齐 StarryOS 缺少的 Linux 系统调用（memfd、pidfd、mmap、waitpid），使其通过现有的 Linux 测试套件
2. **拟支持 Redis** — 让 `redis-server` 在 StarryOS rootfs 上运行，排查文件系统层的阻塞点
3. **RK3588 板级 SMP 与 ACT 推理** — 板级 SMP bring-up（GIC v3 驱动、IPI readiness、TLB shootdown）；ACT（Action Chunking with Transformers）模型在 StarryOS 上的推理部署探索

以下按技术主题组织，而非时间线复述。每个主题包含"问题 → 过程 → 结果 → 收获"的完整叙事。

---

## 二、中心故事：`/proc` RSS 计账与 12 小时调试马拉松

这是训练营中技术深度最高、社区协作最密集、个人收获最大的模块。它包含了两个独立但接连发生的故事——一个是架构被 review 推倒重来的设计故事，另一个是测量工具自毁测量的调试故事。

### 2.1 问题：StarryOS 需要 per-process RSS

Linux 通过 `/proc/[pid]/status` 和 `/proc/[pid]/statm` 向用户态暴露每个进程的 RSS（Resident Set Size，常驻内存页数），按页类型分为 Anon（匿名页，如堆/栈/COW 产物）、File（文件映射页）和 Shmem（共享内存页）。`top`、`psutil`、`htop` 等工具依赖这些字段。

StarryOS 原有代码仅有几个 coarse-grained 原子计数器，无法区分页类型、无法处理 fork/COW 场景中的计账转移。目标是在两个 PR 中补齐 `/proc` 字段（Plan1）和 per-process RSS 计账（Plan2）。

### 2.2 初版的架构缺陷与 review 驱动的重构

**Plan1**（PR #1171, 6 月 8 日 merge）：暴露 `/proc/[pid]/status` 的 VmRSS、VmSize 等字段，搭建 C 语言测试框架。

**Plan2**（PR #1173, 6 月 8 日开 PR，6 月 25 日 merge，持续 17 天）的核心挑战是 COW（Copy-on-Write）场景的计账：

- `fork()` 后父子进程共享已映射页面。两个进程都可以读取，但一旦有一方写入，内核触发 COW——复制物理页并修改页表。
- COW break 将页面从 File 重分类为 Anon。这个变化需要同时反映在父进程和子进程各自的 RSS 中，且不能互相污染。

我的初版设计在物理页框层面维护了一个全局的 `FrameRefCnt.kind` 字段，追踪每个物理页是 File 还是 Anon。提交 PR 后，社区 Maintainer **ZR233** 在第一轮 review 中就指出了根本性的架构问题：

> 物理页框层面的全局类型标记无法区分不同进程对同一物理页的映射语义。一个进程以只读方式映射（记为 File），另一个进程写入后触发 COW（变为 Anon），但 `FrameRefCnt` 只存了一个 kind 值——必然有一个进程的统计是错误的。**追踪状态的数据结构必须对齐隔离边界：如果隔离单位是进程，计账结构就应该是 per-process 的。**

这句话成为了整个 redesign 的指导原则。最终架构改为每个 AddrSpace 持有一份独立的计账结构：

```
struct MemoryAccounting {
    rss_anon: AtomicU64,                             // Anon 页原子计数
    rss_file: AtomicU64,                             // File 页原子计数
    rss_shmem: AtomicU64,                            // Shmem 页原子计数
    generation: AtomicU64,         // 每次 BTreeMap 修改后单调递增
    charges: BTreeMap<VirtAddr, RssKind>,  // 虚拟地址 → 页类型
}
```

每个进程拥有独立的 BTreeMap，VA → RssKind 映射。populate（首次映射）、unmap（解除映射）、fork（clone_map 复制 charge map）、COW break（remove File + record Anon）四条路径各自通过 `record_charge`/`remove_charge` 调用更新计账。fork 时 `try_clone()` 创建全新的 AddrSpace，逐 VMA 调用 `clone_map` 将父进程的 charge 复制到子进程——父子进程的 MemoryAccounting 从 fork 完成那一刻起就是两块独立的物理内存。

**这个架构不是 AI 设计的，也不是我独立设计的。它是在 ZR233 指出"从 global 到 per-process"的方向后，我在 review 讨论中逐步调整出来的。这是训练营最有价值的经历——不是"写对了代码"，而是"被指出了为什么原来的设计是错的"。**

### 2.3 现象：恰好差 1 页

测试由 Cursor autocomplete 参照 Linux kselftest 风格生成骨架，后经人工迭代重构。覆盖了以下场景：

- fork 后父子进程的 RSS 值是否一致（继承正确性）
- 子进程对 COW 共享页写入后，Anon 是否 +1（COW break 计账）
- 父进程的 RSS 在子进程写入后是否保持不变（计账隔离）

就在验证 `test_fork_reclassify_writer_sibling_unmap` 这个用例时，遇到了训练营期间最诡异的问题：

测试断言 fork 后子进程 RssAnon 应为 24 页（父进程 23 页 + COW 新增 1 页），但实际读到 23 页。进一步定位发现——父进程在读取 `/proc/self/status`（时刻 T1）时得到 anon=23，在调用 `fork()` 内部做计账快照（时刻 T2）时变成 anon=22。而 T1 和 T2 之间的用户代码只有两行 `pipe()` 系统调用。

内核在没有 `munmap`/`mprotect`/`mmap` 的情况下，anon 自动少了 1 页。我开始追查"内核 charge 泄漏"。

### 2.4 6 条被逐一证伪的假说

在接下来的 12 小时内（跨越 6 月 13 日下午至 6 月 14 日凌晨，共 59 轮 CLI 对话），我通过 ChatGPT Web（对话策略规划）和 Claude CLI（内核代码搜索与日志分析）协同，在内核中添加了一系列 tracepoint（内核日志插桩），逐一提出并排除了以下假说：

| #   | 假说                                                                                                                 | 证伪过程和关键证据                                                                                                                                                       | 如果早知道的话…                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | clone_map 路径发生 AB-BA 死锁，导致测试超时后数值错乱                                                                | 在 fork 路径插入 `CLONE-PROGRESS` 日志，发现只是串口 115200 波特率下的日志输出瓶颈——串口打日志太慢导致 QEMU 超时                                                         | —                                                                                                                                                            |
| 2   | BTreeMap 中的 charge 条目消失（"138→95 泄漏"）                                                                       | 早期分析混淆了全局 `RECORD_OK` 计数器（所有进程共享）和 per-process RSS。加了 pid 过滤的 `CHARGE-MUTATION` 日志后证明每个进程的 BTreeMap 条目数稳定                      | —                                                                                                                                                            |
| 3   | `sync_rss_atomics_from_charges()` 的 load-compare-store 被另一 CPU 并发修改，导致原子计数被错误覆写                  | 插入 `SYNC-OVERWRITE` 计数器，值永远为 0——sync 在任何调用中都是 no-op（atomics 在 sync 前后始终相等）                                                                    | **系统配置是 smp=1，只有一个 CPU 核心。不存在"另一 CPU 并发"。** 这个信息写在配置文件里，不需要任何日志就能确认                                              |
| 4   | fork 继承（clone_map）遗漏了某个 VMA，导致子进程少了一个 charge                                                      | 在 fork 路径插入 `FORK-INHERIT` 日志——每个 fork 边界上 parent_anon == child_anon 完全一致，继承完全正确                                                                  | —                                                                                                                                                            |
| 5   | 子进程退出时的地址空间清理（`aspace_clear`）意外修改了父进程的 charge map                                            | 给所有 unmap 路径添加 `caller=` tracepoint，发现 23→22 的 remove_charge 来源是 `sys_munmap`，不是 `aspace_clear`。不同 acct_ptr，不同地址空间                            | **fork 创建独立的地址空间，子进程的页表和 BTreeMap 与父进程完全隔离。子进程退出时 unmap 的是自己的 VA，不可能碰到父进程的数据结构。** 这是虚拟内存的基本语义 |
| 6   | MemoryAccounting 对象被释放后，同一块内存被 allocator 复用给了新对象（"指针地址复用"），导致看起来像同一个对象在变异 | 给 MemoryAccounting 加入单调递增的 `generation_id`：T1 时 gen=1168，T2 时 gen=1169，同一个 acct_ptr 上 generation 只增了 1——同一对象的连续 mutation，不是 allocator 复用 | —                                                                                                                                                            |

假说 #3 和 #5 特别值得反思：smp=1 在 QEMU 配置文件里写着，fork 地址空间隔离在任何 OS 教材的第一章就讲了。这些不需要猜——是已知事实。但在密集的日志插桩和假说枚举中，这些"明显的事实"被绕过了。

### 2.5 突破：从 tracepoint 到 fopen

转折点来自于新增的 `SYSCALL-MMAP`/`SYSCALL-MUNMAP` tracepoint（记录每个 mmap/munmap 系统调用的 VA、长度、是否为文件映射）。在 qemu9.log 中捕获到：

```
[SYSCALL-MMAP]  ts=2697269616 pid=23 va=0x16000 len=0x1000 file=false
[SYSCALL-MUNMAP] ts=2699002320 pid=23 va=0x16000 len=0x1000
```

三个关键线索：

1. `file=false` — 这是一个**匿名**映射，不是测试代码中创建的 MAP_PRIVATE 文件映射（后者的 VA 是 0x15000，`file=true`）
2. 映射长度恰好 4096 字节（1 页） — 不像数据区，像缓冲区
3. mmap 时间在 T1（/proc 读取）之前，munmap 在 T2（fork）之前 — 它在测量窗口内存在，在测量窗口后消失

回溯测试源码找到调用者：测试在读取 RSS 基线值时调用了 `fopen("/proc/self/status", "r")`。问题的最后一块拼图来自 libc 实现差异的知识：

**musl libc（StarryOS 使用的 C 标准库）的 `fopen` 为 `FILE` 结构体的缓冲区分配一个 4096 字节的匿名 mmap（`MAP_PRIVATE | MAP_ANONYMOUS`）。而 glibc 的 `fopen` 用 `brk` 分配堆内存——因此同样的测试代码在 glibc 环境下不会触发此问题。**

完整的污染链：

```
测试调用 fopen("/proc/self/status")
  → musl: mmap(4096, MAP_ANONYMOUS) → 内核 record_charge → anon: 22→23
测试调用 fgets 读取 "RssAnon: 92 kB" → 读到 23 页（多了一页 fopen 的缓冲区）
测试调用 fclose → musl: munmap(4096) → 内核 remove_charge → anon: 23→22
测试调用 fork() → 子进程继承 anon=22（此时 fopen 缓冲区已不存在）
断言期望: anon=23 + 1(COW) = 24 → 实际 anon=22 + 1 = 23 → FAIL
```

**根因不是内核 bug，不是测试逻辑 bug，是测试工具本身改变了被测量的状态——这是"观察者效应"在内核调试中的实际案例。**

### 2.6 修复与验证

修复本身仅 62 行：将五个 `/proc` 读取函数从 `fopen`/`fgets`/`fclose` 改为 POSIX 原语 `open`/`read`/`close`——栈缓冲区不产生额外的 mmap，RSS 测量不再受测量工具污染。

独立验证步骤：

1. 在 WSL（宿主机）上用 strace 对比 musl 和 glibc 的 `fopen` 行为——musl 确实多了一条 `mmap(NULL, 4096, ...)`，glibc 走 `brk`
2. StarryOS QEMU 上跑修改后的测试——所有断言通过
3. 在 StarryOS QEMU 上跑修改前的测试 + 手动 strace——确认 mmap 存在且 RSS 多一页

---

## 三、syscall 语义对齐：memfd、pidfd、mmap、waitpid

memfd 和 pidfd 是 Linux 较新的文件描述符类型。它们有一个共同的动机：传统的文件描述符依赖于文件路径或 PID 整数，前者需要管理命名空间，后者存在 PID 复用风险（进程退出后 PID 可能被分配给新进程）。memfd 创建匿名的内存文件（无磁盘路径），pidfd 以稳定的"进程引用"替代 PID 整数。

StarryOS 需要支持这些 syscall 以通过现有的 Linux 测试套件。以下是对齐工作的四个 PR。

### 3.1 memfd_create 与 seals

`memfd_create("name", flags)` 创建一个只存在于内存中的匿名文件，返回 fd。访问方式与普通文件完全相同（read/write/mmap），但无磁盘后盾。

在 StarryOS 中的实现：利用 tmpfs 创建匿名 inode，挂载到内部 tmpfs 实例。支持四种 seal（`F_SEAL_SHRINK`/`F_SEAL_GROW`/`F_SEAL_WRITE`/`F_SEAL_SEAL`）——一旦设置了某种 seal，对应操作被内核拒绝。测试使用 kselftest 风格，每个 seals 组合独立验证。

**已知差距**：`F_SEAL_FUTURE_WRITE`（阻止后续写映射）在当前实现中不支持；不支持 `MEMFD_NOEXEC_SEAL` 或大页（`MFD_HUGETLB`）。这些都是向后兼容的——不对现有功能造成回退。

### 3.2 pidfd：三个 syscall

| syscall                                      | 行为                                   | 实现要点                                                   |
| -------------------------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| `pidfd_open(pid, flags)`                     | 打开目标进程的 fd（不受 PID 复用影响） | StarryOS 对 flags 严格检查，仅支持 `PIDFD_NONBLOCK`        |
| `pidfd_getfd(pidfd, targetfd, flags)`        | 从目标进程复制一个 fd 到当前进程       | flags 必须为 0；在内核中持有目标进程的 fd_table 锁进行复制 |
| `pidfd_send_signal(pidfd, sig, info, flags)` | 通过 pidfd 向目标进程发送信号          | siginfo 为 NULL 时使用默认值                               |

测试覆盖了跨进程 fd 传递、进程回收后的 pidfd 行为、无效参数的 errno 检查。StarryOS 与 Linux 在语义上的主要差异是：StarryOS 对 flags 参数的检查比 Linux 更严格（未知 flag 返回 `EINVAL` 而非忽略）。

### 3.3 MAP_FIXED 与 waitpid：两个小语义修正

**MAP_FIXED**（PR #691，7 行核心改动）：Linux 的 `mmap(MAP_FIXED)` 语义要求**先做权限检查，再 unmap 旧映射**——如果新映射的权限不足，必须保留旧映射不变（"原子"语义）。StarryOS 原实现先 unmap 再检查，导致权限不足时旧映射已丢失。修复为：先对重叠区域做权限预检，仅在通过后才执行 unmap+mmap。

**waitpid**（PR #686，4 行核心改动）：退出码写入（`vm_write`）必须在子进程从进程表中被移除（reap）之前完成——否则父进程可能读到未初始化的 `siginfo`。这是一个典型的多线程同步问题——"写完整才能读"的约束需要用正确的调用顺序保障，而非锁。

### 3.4 测试方法

syscall 测试以 C 语言编写，组织在 StarryOS 的 grouped qemu-smp1 system test 框架下。测试模式参照 Linux kselftest：每个 syscall 先用正常参数验证功能，再用非法参数验证 errno（如给 `memfd_create` 传非法 flags、给 `pidfd_open` 传不存在的 PID）。

测试骨架初期由 Cursor autocomplete 快速生成，后期人工补全——AI 擅长生成"一个正常参数的测试用例"骨架，但边角 case（seal 组合爆炸、标志位互斥）和 errno 对照表需要人逐条校对 Linux man page 确认。

---

## 四、应用与板级

### 4.1 Redis：ext4 文件系统阻塞点

Redis 在 StarryOS 上启动后，AOF（Append-Only File）持久化流程的 rewrite 操作阻塞在 `rename("temp-rewriteaof-xxx", "appendonlydir/")`，返回 `EINVAL`。AOF rewrite 是 Redis 保证数据持久性的关键流程——阻塞在此意味着 Redis 能启动但不能持久化。

排查从症状收敛到两层缺陷：

1. **VFS 层祖先检查过严**：`axfs-ng-vfs` 的 rename 实现中，跨目录 rename 的合法性检查逻辑错误地将 `temp-rewriteaof` → `appendonlydir/` 判为非法——它误认为目标父目录和源文件不能在同一文件系统层级
2. **ext4 层 hash-tree dentry delete**：删除目标位置的旧目录项时，ext4 hash-tree 索引未正确更新，导致后续在目标路径上的查找操作失败

PR #807 修复了这两个问题。整个过程是从症状逐步缩小到具体代码行的——初始假设（ext4 有通用 rename 问题）过于宽泛，最后发现是两个独立但需要同时修复的缺陷。

**教训**：开应用层 Redis test-suit PR（#808）前，未先检查社区是否有同类 PR——等我提交后发现 Kevin [#802](https://github.com/rcore-os/tgoskits/pull/802) 已经覆盖了相同的范围。#808 关闭。开源协作中，**开 PR 前先搜索 upstream open PR 是基本流程**。

### 4.2 真机 SMP：Orange Pi 5 Plus IPI readiness

在 Orange Pi 5 Plus（RK3588, 8 核 Cortex-A76 + Cortex-A55）真机上测试 StarryOS SMP 时，开启 `max_cpu_num>1` 后立即触发 panic。

**根因**：TLB shootdown（多核间同步页表变更的操作）需要向所有 CPU 核心发送核间中断（IPI），但 IPI 子系统（GIC v3 中断控制器驱动 + 核心间通信队列）在启动早期尚未完成初始化。第一个 TLB shootdown 请求到达时，IPI 发送函数访问了未初始化的 GIC 寄存器，触发 panic。

**修复**（PR #1196）：在 `axruntime` 启动流程中插入 IPI 就绪同步屏障，确保 IPI 子系统在应用代码执行前完成初始化。关键改动在 GIC v3 驱动和 `axtask` 的 SMP online 流程中，保证 secondary CPU bring-up 与 IPI 初始化的顺序依赖。

修复前曾使用 `max_cpu_num=1` workaround 临时绕过（仅启动单核），但最终交付的是根因 fix。workaround 是临时工具，upstream patch 需要解决根因——**区分临时绕过与最终修复是参与开源项目的基本素养**。

### 4.3 ACT 模型推理：认识 Transformer

Pro57 比赛要求将 ACT（Action Chunking with Transformers）模型部署到嵌入式平台。ACT 是一个 Encoder-only 的 Transformer 变体，用于机器人动作预测。我的工作打通了从 PyTorch 模型到 StarryOS QEMU 的推理管线：从 PyTorch checkpoint 导出 ONNX 格式（194MB），用 Rust `tract` 推理引擎交叉编译为 riscv64 musl 静态二进制，在 StarryOS QEMU RISC-V 虚拟机上加载并成功推理。还做了 structured pruning 实验（按比例保留权重后逐层测量内存占用）和 RISC-V Vector 扩展 microbenchmark。

在这个过程中，我对 Transformer 有了从"纸上公式"到实际计算图的认识：Multi-Head Self-Attention 的 Q/K/V 投影、Feed-Forward Network、Layer Normalization 这些组件在 ONNX 计算图中是什么形态，推理时内存主要消耗在哪（中间激活张量通常比权重矩阵更大），以及 tract 这类推理引擎在编译期做的图优化（常量折叠、算子融合）。这些认识来源于逐算子梳理计算图、测量每层内存占用的过程——不是读论文能得到的。

StarryOS 侧的改动是 app 层 QEMU smoke，推理栈工作在独立工作区——将"内核能跑"和"推理栈优化"分开，互不阻塞。

## 五、量化成果

### 5.1 Upstream merged PR

| PR                                                      | 合并日 | 标题                                               | +/-        |
| ------------------------------------------------------- | ------ | -------------------------------------------------- | ---------- |
| [#565](https://github.com/rcore-os/tgoskits/pull/565)   | 05-19  | feat: anonymous memfd, seals, and pidfd tests      | +2064/-144 |
| [#686](https://github.com/rcore-os/tgoskits/pull/686)   | 05-19  | fix: waitpid reap order (exit code before reaping) | +7/-3      |
| [#691](https://github.com/rcore-os/tgoskits/pull/691)   | 05-19  | fix: MAP_FIXED failure preserves prior mapping     | +106/-22   |
| [#707](https://github.com/rcore-os/tgoskits/pull/707)   | 05-24  | fix: pidfd open/getfd/send_signal conformance      | +1406/-30  |
| [#807](https://github.com/rcore-os/tgoskits/pull/807)   | 05-21  | fix: ext4 rename & VFS ancestor check              | +477/-225  |
| [#1171](https://github.com/rcore-os/tgoskits/pull/1171) | 06-08  | feat: /proc memory stats exposure                  | +869/-34   |
| [#1173](https://github.com/rcore-os/tgoskits/pull/1173) | 06-25  | fix: Cow RSS per-VA charge tracking                | +2270/-365 |
| [#1196](https://github.com/rcore-os/tgoskits/pull/1196) | 06-12  | fix: aarch64 SMP IPI readiness                     | +159/-22   |

### 5.2 Issue #580 完成度

| 子项                  | 状态      | 关键 PR                   |
| --------------------- | --------- | ------------------------- |
| memfd + seals + pidfd | ✅ merged | #565, #707                |
| waitpid / MAP_FIXED   | ✅ merged | #686, #691                |
| Redis VFS blocker     | ✅ merged | #807                      |
| `/proc` RSS           | ✅ merged | #1171, #1173              |
| Orange Pi SMP         | ✅ merged | #1196                     |
| Redis app test-suit   | ⏸ 被覆盖  | #808 closed（Kevin #802） |

### 5.3 其他统计

- Closed unmerged PR：5 个早期 fix 分支（内容并入 #565/#707）+ #808（被 Kevin 覆盖）
- 对已有功能无 regression（所有 merged PR 通过了 QEMU CI 和板级测试）

---

## 六、经验与教训

### 6.1 约束前置：设计函数时把所有不合法的路径判死

做 OS 不能假设调用者（用户程序）按预期行为，也不能假设内核自己的状态总是合法的。以 RSS 为例——如果 `snapshot_resident_charges()` 返回时断言 `BTreeMap 条目统计值 == 原子计数器值`，fopen 贡献的额外 1 页 Anon 会在第一次运行时就触发断言失败，直接定位到"有人多计了一页"，不需要追 12 小时。

测例设计同理——AI 生成的测例倾向于假设"前面的步骤都正确"，断言只检查最终输出。但在后期遇到的一个动态链接缺页 bug 中，第一步就错了（共享库映射缺少一个页），后续所有断言都在错误的基础上推演。**每个测试步骤都应独立自证前置条件。**

### 6.2 人依然需要懂底层：AI 不会主动排除不可能

RSS 调查最值得反思的不是"AI 花了 12 小时才找到根因"，而是**其中 4 条假说不应该被提出**——它们违反了已知的约束条件：

- smp=1（单核）→ 不存在跨 CPU 并发修改 → sync 覆写假说自动作废
- fork 不共享地址空间 → 子进程退出清理不可能碰到父进程的 BTreeMap → aspace_clear 假说自动作废
- 偏差恰好 1 页（4KB）→ 最可能的解释是 libc/动态链接产生的临时映射 → 应该先查 libc，再查内核
- 已知 musl 用 mmap 做 FILE 缓冲区而 glibc 用 brk → 用 strace 在两种 libc 上对照测试，可以快速排除内核嫌疑

这些不是需要"猜"的知识，是操作系统教材的第一章、man page、libc 源码。AI 在长上下文推理时会丢失这些"明显的事实"——smp=1 在 300 轮对话之前提过一次，之后不再是 active context。人会记住"我们只有一个核"因为这是物理直觉，AI 不会——除非被反复提醒。

**人作为审计员的核心价值：当 AI 提出假说时，先问"这个假说违反了哪些已知约束"，而不是"这个假说有没有证据"。AI 擅长枚举可能性——从 100 种可能的原因中找出最像的 10 个。人擅长排除不可能性——从 10 个最像的原因中去掉违反物理/语义约束的 8 个。**

### 6.3 从 review 中学架构

#1173 初版 global FrameRefCnt 被完全推翻，然后重新设计为 per-VA BTreeMap。ZR233 的那句"追踪状态的数据结构必须对齐隔离边界"不仅是代码修改建议——它是一条 OS 设计原理的具体应用：**状态追踪的粒度不应小于隔离的粒度。** 如果隔离单位是进程（每个进程有独立的地址空间），那么计账数据的归属就应该是 per-process 的。

这种架构直觉不是 AI 能教的——它不仅需要读懂代码，还需要理解设计者的意图、识别意图与实现之间的偏差、并提出"向哪个方向改"的指导。这是 review 文化最宝贵的价值。

### 6.4 每个阶段写 blog，不要拖

训练营第一周我完成了 memfd/pidfd 的 syscall 实现，当时的细节还很清晰——seal 的组合语义、pidfd 的 flags 检查与 Linux 的差异点、MAP_FIXED 的原子性保证。如果能在那时趁热写一篇 blog，不仅是给社区留下参考资料，更是对自己理解的一次强制检验——写清楚一件事情比做清楚一件事情更难。

但我没有。我把 blog 拖到了训练营最后。结果是：6 月中下旬期末考试和各种实验同时压上来，memfd 的设计细节已经模糊了，只能靠着 git log 和 PR 描述来反推当时的决策。最终只来得及写 RSS 调查这一篇 blog，而 syscall、Redis ext4、Orange Pi SMP 的故事都没有被记录下来。

**每个阶段结束时写 blog，把 blog 当成阶段交付物的一部分，而不是事后补的作业。** 即时写 blog 的成本是半天，事后靠回忆重建的成本是同样的半天——但事后写的质量差得多，而且大概率根本没时间写。

### 6.5 先查规范，再读代码；先验证测量工具，再怀疑被测对象

三条具体教训：

1. **先查社区 open PR**：避免重复工作（#808）
2. **先查 man page / 标准文档**：确认"应该是怎样"——AI 擅长 grep 代码查"实际是怎样"，但规范回答得更快
3. **先验证测量工具**：`/proc` 的读取行为（fopen mmap）本身就是 RSS 测量的一部分——在 OS 调试中，观测手段往往是 bug 的一部分，而非独立于 bug 之外

---

## 七、AI 协作：放大器，不是替代品

本次训练营的主要生产工具是 AI（Cursor + Claude CLI + ChatGPT Web）。真实情况是三者在不同阶段犯错、也在不同阶段起到了不可替代的作用：

- **Cursor autocomplete**：在 C 测试用例编写时提供了大量骨架代码，但也随手写了 `fopen`——它不知道 musl 的 fopen 会 mmap
- **Claude CLI（通过 DeepSeek API）**：在内核代码搜索、tracepoint 插桩、日志 pattern 识别上远超人工速度——但它会在第 59 轮对话中忘记第 1 轮就确认过的 smp=1
- **ChatGPT Web**：擅长规划结构化调查框架（如 "Audit Mode：Q1-Q5，只允许已证实事实，禁止猜测"），但不擅长从具体日志中推断因果关系

人的不可替代部分：

- **物理世界验证**：在 QEMU/真机上跑测试、读串口输出、用 strace 做对照实验——AI 只能生成命令，不能确认结果
- **读懂 review 并调整架构方向**：从 "global FrameRefCnt 有缺陷" 到 "per-VA BTreeMap" 的跳跃不是 AI 独立完成的
- **判断什么是不可能的**：知道 smp=1、fork 语义、libc 差异——这些是领域知识，不是 prompt 技巧

AI 在此次训练营中的本质角色是**认知放大器**——放大生产力（快速生成代码骨架、批量搜索日志 pattern），也放大认知偏差（在错误前提下快速递推几十轮）。与 AI 协作最核心的技能不是"写好 prompt"，而是**能在 AI 的输出中识别哪些结论违反了已知约束——然后删掉，不追**。

训练营让我意识到：AI 的好处和危险是同一个——它能让你以更快的速度到达任何地方，无论那个方向是对的还是错的。所以驾驭它需要驾驶者自己知道方向。

---

## 致谢

感谢周睿老师（ZR233）在 RSS 模块开发过程中给予的耐心指导。感谢陈渝老师在训练营期间的组织和指导，感谢 Mr Graveyard、Ajax 老师以及所有参与训练营的老师们提供的帮助。

感谢一起参与训练营的同学们。许多问题的思路并不是在敲代码时产生的，而是在讨论、争论和交流中逐渐清晰的。感谢刘柯、王夯以及交流群中的伙伴们，大家分享的经验、踩过的坑和提出的问题，都让我受益匪浅。

更要感谢开源社区。无论是 StarryOS、ArceOS，还是 Linux、RTEMS，这些项目背后无数开发者长期积累的工作，让后来者能够站在巨人的肩膀上学习。对于一个学生而言，能够参与真实项目、阅读真实代码、接受真实 review，本身就是一种幸运。

从三月到六月，训练营持续了四个月。回头看，收获最大的并不是完成了多少 PR，也不是解决了多少 Bug，而是第一次真正接触到了系统软件开发的过程：阅读代码、理解设计、提出假设、验证实验、接受 review、推翻错误的方案，再重新构建更合理的实现。

训练营期间最深刻的体会来自 RSS 调试。一个看似简单的"一页误差"，最终追查到了 libc 的实现细节；一个最初看起来合理的设计，在 review 中被指出了根本性的架构缺陷。相比于"找到答案"，这些经历让我学会了如何接近答案。

参加训练营之前，我对操作系统的理解更多来自课本和课程实验。训练营结束后，我依然只是一个刚刚入门的学习者，但已经能够透过现象去观察系统背后的机制。那些曾经看起来理所当然的事情——进程、文件、内存、fork、COW、系统调用——不再是抽象概念，而是具体的数据结构、代码路径和硬件约束。

计算机的世界里没有魔法。

所谓操作系统，不过是把这些"魔法"拆开来看；而所谓成长，大概就是逐渐学会理解它们为何如此运作。

感谢这段经历，也感谢一路上帮助过我的每一个人。

---

# 附录 A：技术地图

下图展示了本次训练营涉及的各模块及它们之间的关系。

```
Application Layer
├── Redis ──→ VFS rename ──→ ext4 dentry hash-tree
├── psutil/top ──→ /proc pseudo-fs ──→ MemoryAccounting (BTreeMap<VA,Kind>)
└── ACT infer ──→ StarryOS QEMU RISC-V

Kernel Layer
├── Syscall: memfd_create / pidfd_open / pidfd_getfd / pidfd_send_signal
├── MM: COW break → remove_charge(File) + record_charge(Anon)
├── fork: try_clone() → clone_map → reconcile_fork_charges_from_parent()
└── aspace_clear: AddrSpace::clear() on process exit

Hardware Layer
└── RK3588 (Orange Pi 5 Plus) ──→ GIC v3 IPI ──→ SMP secondary CPU bring-up
```

# 附录 B：工作时间线

| 时间段        | 模块      | 关键事件                                                                   |
| ------------- | --------- | -------------------------------------------------------------------------- |
| 05-11 → 05-19 | Syscall   | memfd/pidfd 内核实现 + 测试；#565/#686/#691 merge                          |
| 05-16 → 05-22 | Redis     | 诊断 rename EINVAL；#807 merge；#808 发现与 Kevin #802 重复后关闭          |
| 05-20 → 05-24 | Syscall   | pidfd 完善 + #707 merge；MAP_FIXED 测试补全                                |
| 05-23 → 06-06 | ACT       | ONNX 计算图分析、tract 推理引擎集成、QEMU 推理验证、内存 profile           |
| 06-07 → 06-08 | /proc RSS | #1171（Plan1）merge：暴露 /proc 字段                                       |
| 06-08 → 06-25 | /proc RSS | #1173（Plan2）开发：global FrameRefCnt → per-VA BTreeMap；6 轮 review 迭代 |
| 06-09 → 06-12 | Orange Pi | #1179 真机 panic 诊断 → #1196 IPI readiness merge                          |
| 06-13 → 06-14 | /proc RSS | RSS 12 小时调试马拉松：6 条假说证伪 → fopen 观察者效应根因 → 修复验证      |
| 06-15 → 06-26 | /proc RSS | COW PTE 修正、fork-rw 测试重构、musl 缺页文档、CI 重跑 → #1173 merge       |

---

*报告日期：2026-06-27*
