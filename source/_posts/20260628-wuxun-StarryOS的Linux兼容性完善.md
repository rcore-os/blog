---
title: 2026操作系统训练营结营报告-吴勋-StarryOS的Linux兼容性完善
date: 2026-06-28 18:00:00
categories:
    - OSTraining
tags:
    - author:wuxun
    - repo:StarryOS
    - 2026S
    - 数据库
    - 自举编译
    - Linux兼容性
---

# StarryOS 的 Linux 兼容性完善：数据库应用适配与自举编译验证

<!-- more -->

## 项目概述

本次训练营期间，我围绕 **StarryOS 的 Linux 兼容性提升** 展开了一系列工作，从系统调用测例编写、真实数据库应用适配，到自举编译全链路分析与修复。整个项目共提交了 **7 个 PR**，均已合入 dev 分支。

项目的核心目标是：**从 MariaDB/MySQL 真实负载到 StarryOS 自举编译的全链路分析**，验证 StarryOS 作为一个真正可用的操作系统的能力。

## 工作内容

### 方案一：为 syscall 添加测例

为了确保系统调用的正确性，我为 StarryOS 补充了系统调用测例，覆盖了关键的系统调用路径，为后续的应用适配打下基础。

### 方案二：适配 MariaDB/MySQL

数据库应用是验证操作系统 Linux 兼容性的重要基准。我在两个环境下分别进行了适配：

#### 1. 在 Alpine 环境下适配 MariaDB

Alpine Linux 以轻量著称，我首先在该环境下完成了 MariaDB 的移植工作，验证了 StarryOS 对精简 Linux 环境的支持能力。

#### 2. 在 Debian 环境下适配 MySQL

Debian 是更为完整的发行版，我进一步在该环境下适配了 MySQL，确保 StarryOS 能够支持更复杂的依赖关系和系统调用。

#### 3. 对 MariaDB 和 MySQL 的功能测试

完成适配后，我对两个数据库进行了功能测试，验证了基本的增删改查操作、事务处理等核心功能，确保数据库能在 StarryOS 上正常运行。

### 方案三：在 macOS 环境下支持 StarryOS 的自举编译

自举编译是操作系统成熟度的重要标志。我在 macOS 环境下完成了 StarryOS 的自举编译验证，**最终结果：正常启动进入 StarryOS 命令行界面，共编译 420 个 crates，耗时约 1200 秒**。

## 自举编译的完整修复链路

在前人的基础上，完成了  apps/macOS-self-build 的合入。但是我没有对内核有任何的修复，单纯完成一堆脚本的合入，似乎不太过瘾。我从头开始复现 macOS-self-build 会遇到的一系列问题，下面详细记录这些问题及其解决方案。

### 背景

为了追踪自举编译的完整修复路径，我采用了以下方法：

- **新建分支**，并切换到第 198 号 PR 合入的地方（距离包含自举编译 app 的 1333 号 PR 中间有 833 个 PR）
- **沿用 `apps/macos-self-build` 思想**，编写了另一套脚本，可以复用根文件系统（无需重复注入 3.6GB 的编译工具链和源码包）
- 在没有 `xtask apps` 支持的情况下，使用 QEMU 命令在 guest OS 内直接运行编译脚本

### 问题一：HVF timer / GIC 路径

**问题描述：**

在 HVF（Hypervisor.framework）环境下，QEMU 无法正确启动。根据 ARM 文档描述，guest OS 必须使用 **CNTV**（虚拟计时器），而之前默认使用的是 **CNTHP 系列寄存器**（ARM EL2 特权级 Hypervisor 使用的物理计时器）。

报错信息：
```
Assertion failed: (isv), function hvf_handle_exception, file hvf.c, line 2275.
```

**思考：**

上述报错仅指明 `hvf_handle_exception` 即 GIC 中断分发器存在问题，并未明确指出之前使用 CNTHP 存在问题。Apple HVF 的文档也没有说必须使用 CNTV。只是在 ARM 规范里，guest OS 在 Hypervisor 里面应该使用 CNTV，从而具有"独属于自己的时钟"，防止因为上下文切换之后，guest OS 内部的时间出现莫名增加这种被污染的情况。

**修复方案：**

1. 以 Hypervisor 启动时使用 EL2 文件中的 **CNTHP 系列寄存器**，以非 Hypervisor 启动时使用 **CNTV 系列寄存器**
2. 将 GICv2 的 MMIO 路径读写中断状态，切换为 **GICv3 使用 ICC_*_EL1 系列系统寄存器**读写中断状态

**结果：** 当前报错信息消失，开始出现下一个问题。

**消融实验：**

为了验证修复的必要性，我进行了消融实验：

- **①不使用 CNTV 只打开 GICv3**：报错信息相同
- **②只使用 CNTV 不打开 GICv3**：报错信息出现了不同
- 
```assembly
Unhandled synchronous exception Some(Unknown) @ 0xffff00004025e830:
ESR=0x2000000 (EC 0b000000, FAR: VA:0x0 ISS 0x0)
```

**深挖报错信息：**

我进一步分析了报错的汇编代码：

```assembly
ffff00004025e82c: d51be229      msr CNTP_CTL_EL0, x9
ffff00004025e830: d51be208      msr CNTP_TVAL_EL0, x8
ffff00004025e844: 528003c0      mov w0, #0x1e
```

**质疑点：** 同样是使用 `msr` 指令修改 CNTP 系列寄存器，为什么上面那一条没有报错呢？既然 HVF 的原理是将指令直接转发到 Apple CPU，没有理由无法修改 `CNTP_CTL_EL0`。

通过查看 ESR（Exception Syndrome Register）：

```
ESR=0x2000000 (EC 0b000000, FAR: VA:0x0 ISS 0x0)
```

- **EC = 0b000000** 指向 `Undefined instruction` 类别，而非 `EC = 0x18 (sysreg trap)`

**进一步编写小测例：**

我编写了三个小测例来验证假设：

1. **裸 HVF VM，不创建 HVF GIC**：CNTP_* 不能正常访问，会 trap
2. **HVF VM + hv_gic_create()，EL1**：CNTP_* 可以正常访问
3. **HVF VM + hv_gic_create()，EL2**：CNTHP_* 也可以正常访问

**结论：**

结合测试结果分析，该异常并非 HVF 下 CNTP_* 系列寄存器不可修改导致，而是 **QEMU 在 HVF 加速路径下对 system register access 的 decode 不完整**，导致部分 CNTP 系列寄存器未被正确识别为 system register trap，从而错误归类为 Undefined Instruction Exception（EC=0）。

**总结：** 之前使用 CNTV 寄存器组得以正常编译，是因为恰好规避了 HVF 环境下 CNTP 寄存器组无法使用的问题。

### 问题二：AArch64 EL0 / FP / SIMD / trap 兼容性

**问题描述：**

HVF/GIC 阻塞解除后，guest OS 可以正常执行编译脚本 `run.sh`，但 cargo/rustc 启动阶段会执行 AArch64 用户态探测路径，包括 EL0 trap、FP/SIMD 状态和用户上下文恢复。PR199 的 AArch64 用户上下文兼容性不足，导致用户态程序刚启动就以 segfault / trace trap 形式退出。

报错信息：
```
Segmentation fault (core dumped)
Trace/breakpoint trap (core dumped)
===STARRY-MACOS-SELFBUILD-END jobs=8 rc=133 elapsed=0===
```

**修复方向：**

- 恢复 AArch64 用户上下文初始化和切换所需的 EL0 状态
- 修复 FP/SIMD 相关状态，使 rustc/cargo 这类实际用户程序能完成最小启动
- 让用户态异常按预期进入 StarryOS 的 signal/exception 路径，而不是直接把 cargo/rustc 打死

### 问题三：page fault 慢路径和 user-copy 可睡眠路径

**问题描述：**

rustc/cargo 继续运行后，会频繁访问按需映射的用户栈、堆、mmap 文件页。PR199 的 page fault 路径仍偏向"不可恢复异常"，没有把用户态缺页完整接到可睡眠、可恢复的慢路径上，所以普通用户态写缺页被当成 kernel panic。

报错信息：
```
panicked at components/axcpu/src/aarch64/trap.rs:82:5:
Unhandled Page Fault @ 0xffff000040354b9c, fault_vaddr=VA:0x8974b96, ESR=0x9600004f (WRITE):
```

**修复方向：**

- AArch64 trap 层把可恢复用户缺页交给上层 fault handler
- StarryOS user memory access 路径允许 faultable user-copy 触发补页
- axtask 暴露必要的 sleep/preempt 检查，避免在错误上下文里盲目处理缺页

### 问题四：用户内存访问锁顺序

**问题描述：**

page fault 可恢复后，问题不再是"不能处理缺页"，而是"在持锁或不可睡眠上下文中触发了可能睡眠的用户内存访问"。典型路径包括：

- `poll` / `ppoll` 从用户态复制 fd 集合或 timespec
- fs IO 处理 iovec
- tty ioctl 读写用户态 termios / winsize
- signal delivery / sigreturn 写用户栈或读取用户上下文

这些路径如果在内核锁内直接解引用用户指针，就会把普通缺页变成 atomic context panic。

报错信息：
```
panicked at os/StarryOS/kernel/src/mm/access.rs:267:5:
sleeping or rescheduling is not allowed in atomic context: irq_enabled=false, preempt_count=1
```

**修复方向：**

- 把用户内存读取/写入移动到不持有内部锁的阶段
- 对需要睡眠的 user-copy 使用 faultable 路径
- 避免 signal、tty、poll、fs IO 在锁内触发 page fault

### 问题五：ostool 'axpanic' 误判

**问题描述：**

旧版 ostool 识别到 panic 即报错终止整个 guest OS，但是编译的时候需要编译 axpanic 库，会造成误报。

报错信息：
```
Compiling axpanic v0.1.0 (/opt/tgoskits/components/axpanic)
=== FAIL PATTERN MATCHED: (?i)\bpanic(?:ked)?\b
Error: Fail pattern matched '(?i)\bpanic(?:ked)?\b': panic v0.1.0 (/opt/tgoskits/components/axpanic)
```

**修复方向：**

- reuse-rootfs app 在宿主机本地复制 Cargo.lock 中锁定的 `ostool` registry source
- 将旧 `ostool` 的 `DEFAULT_FAIL_PATTERNS` patch 为空
- QEMU 配置里仍保留明确的真实 panic/segfault/assertion 规则，例如 `panicked at`、`kernel panic`、`signal: 11` 等

### 问题六：ELF loader / rust-lld 映射

**问题描述：**

这已经不是 early boot、trap、page fault 或锁顺序问题，而是 rust-lld 作为真实用户态 workload 在最终链接阶段崩溃。rust-lld 对 ELF loader 的要求比小程序高很多。

报错信息：
```
Building [=======================> ] 419/420: starryos(bin)
error: linking with `rust-lld` failed: signal: 11
=== FAIL PATTERN MATCHED: (?i)signal:\s*11
===STARRY-MACOS-SELFBUILD-END jobs=8 rc=101 elapsed=633===
```

**修复方向：**

- StarryOS loader 自己构造更完整的 initial stack / auxv
- 补齐 `AT_NULL`、`AT_RANDOM`、`AT_EXECFN` 等关键 auxv 行为
- 对 writable LOAD segment 同时授予 READ
- 处理 TLS 与最后一个 LOAD segment 的文件范围关系
- 更新用户空间 layout 配置
- 修复 axfs-ng 高层文件读取/mapping 行为，使 ELF COW backend 能支撑 rust-lld 的访问模式

### 问题七：membarrier 语义错误

**问题描述：**

StarryOS 当前的 membarrier 命令号实现使用了连续整数 0..5，并在 QUERY 返回值中使用 `1 << cmd` 生成支持掩码。这和 Linux UAPI 不一致。

StarryOS 原先返回的 QUERY 掩码是 62，而符合 Linux UAPI 的支持掩码应为 31。这会导致依赖 membarrier 查询结果的用户态程序判断错误，进而走到不符合预期的同步路径，从而导致死锁，使得编译无法继续进行。

**注意：** 该问题是 1225 号 PR membarrier 提交前的一个 commit 出现的，以 198 号 PR 为基础的分支未出现这个问题。

**修复方向：**

1. 修正 StarryOS membarrier 命令号和查询掩码
2. 补齐 GLOBAL_EXPEDITED 注册语义

**修复结果：** 在 1211 号 PR 时，内核相当完善，只修复这两个地方就自举编译成功了。

### 问题八：最新分支 1core/8jobs 编译无法通过

**问题描述：**

想要在相同的 1core/8jobs 的情况下比较编译速度，发现最新分支在 1core/8jobs 情况下编译无法通过，只有在 4core/4jobs 情况下才能够通过。

**修复方向：**

1. 补齐文件系统同步机制，脏页写回机制
2. 移除一堆多次访问磁盘的元数据的操作

**分析：** 当前问题正处在文件系统，8jobs 放大了同步的问题：

- 文件关闭时未在 Drop 函数内写回脏数据
- 优先更新元数据，导致数据库修改还没落盘，就已经被别的线程拿到
- 竞态导致最终编译卡死在文件系统

**编译结果：** 1core 8jobs 跑完全流程，编译长度也可以正常启动进入交互式界面。

## 不同版本的对比与分析

以不同时间点的 dev 分支为基准点进行修复并且可以编译成功之后，我对性能进行了对比分析：

### 主要发现

- **最快的配置是 1core 8jobs**。在支持多核的情况下，多核和单核性能几乎没差距
- **单核运行可以减少上下文切换、同步互斥锁的开销、I/O 读写的开销等**
- 不同版本之间存在 **约 300 秒**的性能差异，主要原因是文件 I/O 的优化，减少了访问磁盘的次数

### 性能提升的关键

通过对比不同版本的编译时间，我发现：

1. **文件系统优化**是性能提升的关键瓶颈
2. **减少磁盘访问次数**可以显著降低编译时间
3. **单核高并发**在 I/O 密集型任务中表现更优

## 收获与总结

### 技术收获

1. **深入理解了 ARM 虚拟化机制**，特别是 HVF 在 macOS 上的实现细节
2. **掌握了操作系统内核调试技巧**，从汇编级别分析问题
3. **学会了如何系统性地追踪和修复复杂的系统级问题**

### 项目意义

通过这次工作，我验证了 StarryOS 作为一个真正可用的操作系统的能力：

- **能够运行真实的数据库应用**（MariaDB/MySQL）
- **能够完成自举编译**，这是操作系统成熟度的重要标志
- **具备了良好的 Linux 兼容性**，可以支持复杂的用户态程序

### 未来展望

StarryOS 在 Linux 兼容性方面还有很大的提升空间：

- 进一步优化文件系统性能
- 完善多核调度策略
- 支持更多的系统调用和 POSIX 接口

非常感谢训练营提供的学习机会，让我能够深入到操作系统内核的开发工作中，这段经历将对我未来的技术道路产生深远影响。

## 相关链接

- StarryOS 仓库：https://github.com/Azure-stars/StarryOS
- 相关 PR：7 个 PR 均已合入 dev 分支
