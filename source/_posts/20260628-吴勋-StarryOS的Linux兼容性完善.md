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

| PR 编号 | 具体内容 |
|---------|---------|
| 671 | 为信号机制添加测例 |
| 784 | 为基础 IO 添加测例 |
| 906 | 在 Alpine 环境下，支持了 MariaDB，兼容实现 AIO 系统调用，并添加测例 |
| 1147 | 在 Debian 环境下，支持了 MySQL，实现 AIO 兼容子系统，并进一步完善测例 |
| 1165 | 完善 AIO 的调用边界并完善测例 |
| 1225 | 发现导致自举编译卡死的 bug |
| 1333 | 实现完整的 macOS self-build，为 xtask 增加 resize 功能，支持以非 snapshot 模式打开 App |

项目的核心目标是：**从 MariaDB/MySQL 真实负载到 StarryOS 自举编译的全链路分析**，验证 StarryOS 作为一个真正可用的操作系统的能力。

## 工作内容

### 方案一：为 syscall 添加测例

为了确保系统调用的正确性，我为 StarryOS 补充了系统调用测例，覆盖了关键的系统调用路径，为后续的应用适配打下基础。具体覆盖范围如下：

| syscall | 覆盖范围 |
|---------|---------|
| rt_sigaction | 验证实时信号 handler 安装与递送，覆盖 `SA_RESETHAND`、`SA_SIGINFO`、`SA_NODEFER/SA_NOMASK` 等 flag 语义，以及非法信号、非法指针、过小 sigsetsize 等错误路径 |
| rt_sigprocmask | 验证 `SIG_BLOCK`、`SIG_UNBLOCK`、`SIG_SETMASK`，覆盖 signal mask、pending signal 递送、old mask 查询和非法参数 |
| rt_sigpending | 验证阻塞信号进入 pending set、解除阻塞后递送，以及非法 pending set 指针返回 `EFAULT` |
| kill / tgkill | 验证进程级和线程级信号发送、signal 0 探测、`SA_SIGINFO` 下 `si_signo` / `si_pid` / `si_code` 字段，以及非法 pid/tid/signal 错误路径 |
| tkill | 验证旧版线程定向信号发送 syscall，包括 signal 0 探测、向当前线程发送信号、siginfo 校验和错误路径 |
| read | 覆盖普通文件读取、短文件读取、空文件读取、EOF、count = 0，以及非法 fd、未打开 fd、只写 fd 上读取等错误路径 |
| write | 覆盖普通文件写入、offset 推进、写后读回、多种写入长度、覆盖写入，以及非法 fd、未打开 fd、只读 fd 上写入等错误路径 |
| lseek | 覆盖 `SEEK_SET`、`SEEK_CUR`、`SEEK_END`，seek 到 EOF 后写入形成 sparse file，以及非法 offset、非法 whence、pipe 上 lseek 等错误路径 |
| close | 覆盖普通文件、pipe/socket fd 关闭，关闭后继续使用 fd 返回 `EBADF`，以及非法 fd、未打开 fd、重复 close 等错误路径 |

### 方案二：适配 MariaDB/MySQL

数据库应用是验证操作系统 Linux 兼容性的重要基准。我在两个环境下分别进行了适配：

#### 1. 在 Alpine 环境下适配 MariaDB

Alpine Linux 以轻量著称，我首先在该环境下完成了 MariaDB 的移植工作，验证了 StarryOS 对精简 Linux 环境的支持能力。适配过程中解决的主要问题如下：

| 问题 | 涉及的部分 | 修复内容 |
|------|-----------|---------|
| InnoDB 读取 ibdata1 短读 | axfs-ng/.../file.rs | 为 `FileBackend::Direct::read_at` 增加循环读取，避免底层一次短读直接暴露给用户态 |
| InnoDB 写入 ibtmp1 短写 I/O error | axfs-ng/.../file.rs | 为 `FileBackend::Direct::write_at` 增加循环写入，确保普通文件大块写入尽量写满 |
| Linux native AIO 缺失 | syscall/fs/aio.rs | 补齐最小可用封装出 `io_setup`、`io_destroy`、`io_submit`、`io_getevents`、`io_cancel`。实际上是在异步 IO 里面调用同步 IO |
| mmap flag 不兼容 | syscall/mm/mmap.rs | 支持识别 `MAP_SHARED_VALIDATE`，对 `MAP_SYNC` 返回 `EOPNOTSUPP`，允许用户态正常回退 |
| prctl(PR_SET_THP_DISABLE) 缺失 | syscall/task/ctl.rs | 实现 `PR_SET_THP_DISABLE` / `PR_GET_THP_DISABLE`，并在 clone 时继承状态 |

#### 2. 在 Debian 环境下适配 MySQL

Debian 是更为完整的发行版，我进一步在该环境下适配了 MySQL，确保 StarryOS 能够支持更复杂的依赖关系和系统调用。适配过程中解决的主要问题如下：

| 问题 | 涉及的部分 | 修复内容 |
|------|-----------|---------|
| MySQL 初始化失败 | syscall/fs/aio.rs | 支持 AIO 请求排队、完成事件写回、等待队列唤醒、eventfd 通知和 poll 请求。真实具有异步语义 |
| epoll syscall 未实现 | syscall/fs/epoll.rs | 兼容旧 ABI 和 libc 探测路径，匹配 Linux 参数校验 |
| NUMA mempolicy syscall 未实现 | syscall/task/ctl.rs | 兼容 MySQL/glibc/numa 探测 |
| fallocate hole punch | syscall/mm/mmap.rs | 覆盖数据库文件空间管理路径 |
| MySQL 的 ioctl 探测失败 | syscall/fs/ioctl.rs | 避免 MySQL 初始化因探测 ioctl 失败 |

#### 3. 对 MariaDB 和 MySQL 的功能测试

完成适配后，我对两个数据库进行了全面的功能测试，共包含 15 项测试用例，验证了基本的增删改查操作、事务处理等核心功能，确保数据库能在 StarryOS 上正常运行：

| 序号 | 测试主题 | 覆盖内容 |
|:---:|---------|---------|
| 1 | 创建数据库 | 创建 `starry_mysql_test` 并检查字符集和 collation |
| 2 | 创建 users 表 | 创建带约束、唯一索引和 CHECK 的 InnoDB 表 |
| 3 | 插入 users | 多行插入并按状态聚合 |
| 4 | 条件查询 | 使用范围过滤、IN、排序、LIMIT 和 GROUP_CONCAT |
| 5 | 更新数据 | 更新 age、score、status 和 timestamp |
| 6 | 二级索引 | 创建复合索引并执行 EXPLAIN |
| 7 | 创建 orders 表 | 创建外键、二级索引和 InnoDB orders 表 |
| 8 | 插入 orders 与 JOIN | 插入订单并执行 INNER/LEFT JOIN |
| 9 | 聚合查询 | 按订单状态、日期、城市统计 |
| 10 | COMMIT 事务 | 插入用户和订单后提交并验证 |
| 11 | ROLLBACK 事务 | 插入、删除、更新后回滚并验证未生效 |
| 12 | 临时表 | 创建临时汇总表和数字表 |
| 13 | 视图和 schema | 创建视图并查询 information_schema |
| 14 | 一致性报告 | 写入 audit_log 并执行多维统计 |
| 15 | 重启持久化 | 重启 mysqld 后验证数据、视图和回滚结果 |

### 方案三：在 macOS 环境下支持 StarryOS 的自举编译

自举编译是操作系统成熟度的重要标志。我在 macOS 环境下完成了 StarryOS 的自举编译验证，**最终结果：正常启动进入 StarryOS 命令行界面，共编译 420 个 crates，耗时约 1200 秒**。

## 自举编译的完整修复链路

在前人的基础上，完成了  apps/macOS-self-build 的合入。但是我没有对内核有任何的修复，单纯完成一堆脚本的合入，似乎不太过瘾。我从头开始复现 macOS-self-build 会遇到的一系列问题，下面详细记录这些问题及其解决方案。

### 背景

为了追踪自举编译的完整修复路径，我采用了以下方法：

- **新建分支**，并切换到第 **198 号 PR** 合入的地方（杨同学的第一个 PR 是 200 号 PR，199 号 PR 没有合入，遂选择 198 号 PR。198 号 PR 距离包含自举编译 app 合入的 1333 号 PR，中间有 **833 个 PR**）
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

为了验证修复的必要性，我进行了消融实验，以查看是否存在多余修复：

- **①不使用 CNTV 只打开 GICv3**：报错信息相同（`Assertion failed: (isv), function hvf_handle_exception`），暂时没有实际价值
- **②只使用 CNTV 不打开 GICv3**：报错信息出现了不同

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

**质疑点：** 同样是使用 `msr` 指令修改 CNTP 系列寄存器，为什么 `CNTP_CTL_EL0` 那一条没有报错呢？既然 HVF 的原理是将 guest vCPU 的指令直接转发到 Apple CPU 上原生执行，没有理由无法修改 `CNTP_CTL_EL0`。

通过查看 ESR（Exception Syndrome Register）：

```
ESR=0x2000000 (EC 0b000000, FAR: VA:0x0 ISS 0x0)
```

ESR 的字段含义：

- **ESR[31:26] = EC**：Exception Class（异常类别）
- **ESR[25] = IL**：Instruction Length（指令长度）
- **ESR[24:0] = ISS**：Instruction Specific Syndrome（指令相关异常细节）

- **EC = 0b000000** 指向 `Undefined instruction` 类别，而非 `EC = 0x18 (Trapped MSR/MRS/system instruction)`，ESR 并未给出有效信息

**编写小测例进一步验证：**

我编写了三个小测例来验证 HVF 对 CNTP/CNTHP 寄存器的实际行为：

1. **裸 HVF VM，不创建 HVF GIC**：CNTP_* 不能正常访问，会 trap
   ```
   mrs CNTP_CTL_EL0
   host-api get failed ret=0xfae9400f ((null))
   guest TRAP(test instruction) exit=EXCEPTION pc=0x40000000 x0=0
     esr=0x6232f805 ec=0x18(Trapped MSR/MRS/system instruction) far=0 ipa=0
   ```

2. **HVF VM + hv_gic_create()，EL1**：CNTP_* 可以正常访问
   ```
   mrs CNTP_CTL_EL0
   host-api get ok value=0x4
   guest OK(reached BRK; empty vector fault) exit=EXCEPTION pc=0x200 x0=0x4
     esr=0x82000006 ec=0x20(other) far=0x200 ipa=0x200
   ```

3. **HVF VM + hv_gic_create()，EL2**：CNTHP_* 也可以正常访问
   ```
   mrs CNTHP_CTL_EL2
   host-api get ok value=0x4
   guest OK(reached BRK; empty vector fault) exit=EXCEPTION pc=0x200 x0=0x4
     esr=0x82000006 ec=0x20(other) far=0x200 ipa=0x200
   ```

**对 HVF 原理理解的修正：**

结合测例结果，我对之前关于 HVF 的理解进行了修正：

- ❌ **之前的错误理解**：HVF 将 guest vCPU 的指令直接转发到 Apple CPU 上执行
- ✅ **正确理解**：HVF 利用 ARM 硬件虚拟化能力，使 guest vCPU 指令在 CPU 上**原生执行**，普通指令无需干预，而**特权指令会触发 trap 进入 HVF**，由 QEMU 或 hypervisor 处理

**进一步验证：**

为了进一步确认 CNTP 系列寄存器在"CNTV + GICv3"环境下的具体行为，我进行了寄存器级别的验证：

| 命令 | 寄存器组 | 命令的含义 | 使用 CNTV + 打开 GICv3 |
|------|---------|-----------|:---------------------:|
| mrs CNTP_TVAL_EL0 | CNTP | 读取 physical timer 相对 deadline | TRAP，EC=0x00 |
| mrs CNTP_CVAL_EL0 | CNTP | 读取 physical timer 绝对 deadline | TRAP，EC=0x00 |
| msr CNTP_CTL_EL0,0 | CNTP | 关闭 physical timer | OK |
| msr CNTP_CTL_EL0,1 | CNTP | 启用 physical timer | OK |

从表中可以看出，**读取** CNTP 寄存器时会触发 TRAP（EC=0x00，即 Undefined instruction），而**写入** CNTP_CTL_EL0 却可以正常执行。这说明 QEMU 的 HVF 加速路径对 CNTP 寄存器的 **read access decode 不完整**，而 write access 走的是另一条路径所以正常。

**结论：**

结合测试结果分析，该异常并非 HVF 下 CNTP_* 系列寄存器不可修改导致，而是 **QEMU 在 HVF 加速路径下对 system register access 的 decode 不完整**，导致部分 CNTP 系列寄存器（特别是读取操作）未被正确识别为 system register trap，从而错误归类为 Undefined Instruction Exception（EC=0）。

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

日志分析：
```
esr=0x2000000
ec=0x0
```
和问题一相同的报错（EC=0x0），说明发生了从 **EL0 到 EL1 特权级的切换**，即 trap 直接被归类为 `Unknown`，没有识别到具体的语义。

**修复方向：**

- 把 `ESR_EL1::EC::Unknown` 映射成 `IllegalInstruction`
- 恢复 AArch64 用户上下文初始化和切换所需的 EL0 状态
- 修复 FP/SIMD 相关状态，使 rustc/cargo 这类实际用户程序能完成最小启动
- 让用户态异常按预期进入 StarryOS 的 signal/exception 路径，而不是直接把 cargo/rustc 打死

**结果：** Exception kind = `IllegalInstruction`，异常被正确识别和处理。

### 问题三：page fault 慢路径和 user-copy 可睡眠路径

**问题描述：**

rustc/cargo 继续运行后，会频繁访问按需映射的用户栈、堆、mmap 文件页。PR199 的 page fault 路径仍偏向"不可恢复异常"，没有把用户态缺页完整接到可睡眠、可恢复的慢路径上，所以普通用户态写缺页被当成 kernel panic。

报错信息：
```
panicked at components/axcpu/src/aarch64/trap.rs:82:5:
Unhandled Page Fault @ 0xffff000040354b9c, fault_vaddr=VA:0x8974b96, ESR=0x9600004f (WRITE):
```

日志分析：

- **`0xffff` 前缀**说明这是内核态正在进行操作
- **ESR=0x9600004f (WRITE)** 表明这是写文件时存在问题
- 内核不知道这个缺页是 **user-copy 过程中可以修复的缺页**，直接当成内核访问坏地址 → panic

**修复方向：**

- AArch64 trap 层把可恢复用户缺页交给上层 fault handler，允许补页
- StarryOS user memory access 路径允许 faultable user-copy 触发补页
- axtask 暴露必要的 sleep/preempt 检查，避免在错误上下文里盲目处理缺页
- 在 Trap 层不再 panic，将缺页正确地交给上层处理

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

- QEMU 配置里保留明确的真实 panic/segfault/assertion 规则，例如 `panicked at`、`kernel panic`、`signal: 11` 等，而不是单纯识别 "panic" 这个单词
- reuse-rootfs app 在宿主机本地复制 Cargo.lock 中锁定的 `ostool` registry source
- 将旧 `ostool` 的 `DEFAULT_FAIL_PATTERNS` patch 为空

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

**日志分析：** rust-lld 加载时出现缺页错误：

```
ip=0x49724
addr=VA:0x49724
flags=EXECUTE | USER
next=Some((VA:0x400000, VA:0x7f2a000, READ | EXECUTE | USER, Size4K))
```

**分析：** `0x49724` 这不是一个可执行的位置，看起来像是没有加上 base_offset `0x400_0000`，需要的位置更像是 `0x449724`。因此向 ELF 加载的部分进一步排查，最终定位到 ELF loader 对 LOAD segment 的映射处理存在问题。

### 问题七：membarrier 语义错误

**问题描述：**

StarryOS 当前的 membarrier 命令号实现使用了连续整数 0..5，并在 QUERY 返回值中使用 `1 << cmd` 生成支持掩码。这和 Linux UAPI 不一致。

StarryOS 原先返回的 QUERY 掩码是 62，而符合 Linux UAPI 的支持掩码应为 31。这会导致依赖 membarrier 查询结果的用户态程序判断错误，进而走到不符合预期的同步路径，从而导致死锁，使得编译无法继续进行。

**注意：** 该问题是 1225 号 PR membarrier 提交前的一个 commit 出现的，以 198 号 PR 为基础的分支未出现这个问题。直觉是因为 198 号 PR 未使用多核编译，不需要使用 membarrier 进行同步，因此未触发此 Bug。

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

尝试将之前补齐 IO 操作语义的修改，直接应用到最新分支，1core/8jobs 编译就不再卡死了。

**分析：** 当前卡死的位置正处在文件系统，具有非常多的代码需要进行编译，里面具有非常多的依赖，8jobs 放大了同步的问题：

- 文件关闭时未在 Drop 函数内写回脏数据
- 优先更新元数据，导致数据块修改还没落盘，就已经被别的线程拿到
- 竞态导致最终编译卡死在文件系统

**编译结果：** 1core 8jobs 跑完全流程，编译完成后也可以正常启动编译产物进入交互式界面。

## 不同版本的对比与分析

以不同时间点的 dev 分支为基准点进行修复并且可以编译成功之后，我对性能进行了对比分析。共记录了 9 组实验数据：

| 序号 | 实验分支/基线 | 运行配置 | 完整编译耗时 |
|:---:|:-------------:|:--------:|:-----------:|
| 1 | PR1224 | 4 vCPU / 4 jobs | 867s |
| 2 | PR1224 | 1 vCPU / 1 job | 1162s |
| 3 | PR1224 | 1 vCPU / 4 jobs | 871s |
| 4 | PR1224 | 2 vCPU / 4 jobs | 875s |
| 5 | PR1224 | 1 vCPU / 8 jobs | 809s |
| 6 | **PR199** | **1 vCPU / 8 jobs** | **635s** |
| 7 | newest | 4 vCPU / 4 jobs | 1303s |
| 8 | newest | 4 vCPU / 4 jobs | 1041s |
| 9 | newest | 1 vCPU / 8 jobs | 948s |

### 主要发现

- **6 号结果（PR199，1vCPU/8jobs，635s）是最快的**，其次是 1 号结果（PR1224，4vCPU/4jobs，867s），9 号结果（newest，1vCPU/8jobs，948s）次之，7 号分支（newest，4vCPU/4jobs，1303s）是最慢的
- **最快的配置是 1core 8jobs**。表明即使是在支持多核的情况下，多核和单核性能几乎没差距
- **单核运行可以减少上下文切换、同步互斥锁的开销、I/O 读写阻塞的开销等**
- **7 号结果和 8 号结果对比相差约 300s**，是因为 8 号结果在 7 号结果的基础下，修改了文件 I/O，减少了元数据修改每次都会访问磁盘的次数

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

### AI 引发的思考

在 LLM 和 Agent 快速发展的今天，AI 已经成为学习与开发过程中不可或缺的工具。我们需要学会使用 AI，也要善于借助 AI 提高效率，但同时不能把思考完全交给 AI。

在项目开发中，Agent 确实可以帮助我们完成大量编码、调试和重构工作，但如果只是无条件接受它给出的方案，而不理解代码背后的设计思路，项目很容易逐渐变成一个黑盒：代码越写越多，功能看似越来越完整，但人对整体结构、核心数据结构和关键算法的理解却越来越弱。一旦遇到 Agent 无法直接解决的问题，就可能陷入反复试错和盲目猜测，而开发者自己也不知道应该从哪里切入。

因此，我认为 AI 更适合作为辅助工具，而不是替代人的思考。使用 AI 写代码时，不能只是等待结果，而应该主动理解它为什么这样实现、修改了哪些模块、引入了什么抽象、可能带来哪些影响。只有真正看懂代码是如何构建起来的，理解系统的结构和关键路径，项目才是可维护的，个人在这个过程中也才能真正获得成长。

### 致谢

感谢陈渝老师和向勇老师发起的 OpenCamp 训练营社区，为我们提供了非常宝贵的操作系统学习资源和实践机会。训练营不仅让我系统接触了 OS 相关知识，也让我有机会在真实项目中参与开发、调试和问题分析。

同时，感谢各位老师在训练营和项目阶段的指导与帮助。老师们亲自点评、耐心答疑，并在开发过程中给予了许多具体的技术建议，让我受益匪浅。特别感谢陈渝老师、罗德斌老师和周睿老师在项目推进过程中提供的帮助与指导。

也感谢训练营中的同学们在学习和开发过程中的交流与支持。大家的讨论、分享和互相帮助，让我在训练营中感受到了非常温暖、积极的社区氛围。

