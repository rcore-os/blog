---
title: 20260628-Promin3-StarryOS GDB支持项目汇报
date: 2026-06-28 06:32:31
tags:
    - author:Promin3
    - repo:https://github.com/rcore-os/tgoskits
    - 2026S
    - StarryOS
    - ptrace
    - IPC
    - GDB
---
<!-- more -->

# StarryOS 宏内核 GDB支持项目汇报


## 零、文档结构

**背景** 讲述本次项目做了什么内容，以及为什么做

**第一二阶段工作** 讲述 syscall 测例、语义修复、以及支持具体 linux 应用时做出的修复工作

**第三阶段工作报告** 细致讲述了 GDB 是如何通过 sys_ptrace 来支持的，讲解了 ptrace 里状态机迁移的细节过程，信号处理流程，以及多线程 ptrace是如何处理的，最后解读了我认为值得品味的代码

**测试与成果** 介绍了测试代码大致结构，展示了真实可用的 gdb demo 截图

**PR 记录与工作仓库** 记录了我的 issue 链接以及所有的 PR 链接

**总结与感想** 记录了我参加训练营的感悟



文档中相当多内容都是我手敲的，虽然内容较冗长。

## 一、背景

本阶段我的工作先完成文件权限相关 syscall 的语义对齐和测试补齐，再补充 BusyBox、Lua、Redis 等应用场景。随着应用支持逐渐深入，单纯依靠日志、panic 信息和测试输出已经不足以定位复杂用户态问题，因此后续目标转向支持 GDB。GDB 支持的意义不只是“能运行一个调试器”，更重要的是让 StarryOS 具备真实 Linux 应用调试链路：可以观察进程状态、设置断点、读取寄存器、查看调用栈、单步执行，并通过 gdbserver 与宿主机调试器交互。

```
                用户态
+---------------------------------------+
|               GDB                     |
|     或者 gdbserver                     |
+-------------------▲-------------------+
                    │ ptrace()
                    │ waitpid()
                    ▼
==================== 系统调用 ====================
                    │
                内核态
+---------------------------------------+
|        ptrace subsystem               |
|                                       |
| TASK_TRACED                           |
| signal delivery                       |
| wait queue                            |
| register access                       |
| memory access                         |
| scheduler                             |
+-------------------▲-------------------+
                    │
                    ▼
              被调试程序(tracee)
```

我的设计目标并不是一次性实现完整 Linux GDB/ptrace 兼容，而是先形成一个可用的调试子集。这个范围后来被收敛为“单进程 GDB 可用子集”：优先保证 riscv64 上 guest 内 native GDB、guest 内 gdbserver、host-to-guest remote GDB，以及简单 pthread 程序的可用调试语义。



## 二、宏内核项目第一、二阶段工作

### 第一阶段：Linux 基础 syscall 语义补齐

第一阶段主要围绕文件权限、所有权和基于 `dirfd` 的路径解析语义展开。目标让 StarryOS 对常见 POSIX 文件权限操作的行为更接近 Linux，并通过系统调用测例固化这些语义。

这一阶段覆盖的 syscall 包括：

- `chmod` / `fchmod` / `fchmodat`
- `chown` / `fchown` / `fchownat`
- `faccessat`
- `umask`

主要修复和设计点如下：

1. **统一绝对路径与 `dirfd` 的处理规则**

   Linux 的 `*at` 系列 syscall 有一个关键语义：当传入路径是绝对路径时，`dirfd` 应该被忽略；只有相对路径才需要以 `dirfd` 指向的目录作为起点。早期实现中，不同 syscall 分散处理 `dirfd`，容易出现某个 syscall 行为和 Linux 不一致的问题。

   因此我将绝对路径处理下沉到统一路径解析逻辑中，避免每个 syscall 单独写一份 `lookup_dirfd` 分支。这样 `fchmodat`、`fchownat`、`faccessat` 等接口可以共享同一套路径解析语义，减少重复逻辑和边界条件不一致。

2. **修复 `fchownat` flags 与错误码语义**

   `fchownat` 不只是 `chown` 的 dirfd 版本，它还涉及 flags 校验、符号链接处理、绝对路径忽略 dirfd、非法 fd 返回错误等语义。PR588 为 `fchownat` 增加了独立测例，覆盖 Linux 兼容行为，包括：

   - 绝对路径下忽略 `dirfd`
   - 相对路径下使用 `dirfd`
   - 非法 flags 返回错误
   - 符号链接相关行为
   - bad dirfd 与普通路径的组合情况

3. **修复 `umask` 只保留低 9 位**

   Linux 中 `umask` 只使用权限掩码的低 9 位，也就是 `0o777` 范围。PR605 中将 `sys_umask` 的输入进行低 9 位截断，避免高位影响后续文件权限计算。

4. **补齐跨架构 syscall 回归测试**

   第一阶段不仅增加单个 riscv64 测试，还将新增 syscall 测例注册到多架构 QEMU 配置中，包括 riscv64、aarch64、loongarch64、x86_64。这样后续修改 VFS 或 syscall 语义时，可以避免只在一个架构上通过、其他架构退化的问题。

通过这一阶段，StarryOS 的文件权限和 `*at` 系列接口从“能调用”推进到“具备更接近 Linux 的路径解析、flags 校验和错误码语义”，为后续真实应用测试打基础。



### 第二阶段：应用场景驱动的兼容性修复

第二阶段从单个 syscall 的语义补齐，推进到 BusyBox、Lua、Redis 等实际应用场景。相比第一阶段，这一阶段的特点是：测试不再只验证某个 syscall 的返回值，而是通过真实应用暴露内核缺失的 procfs、socket、文件系统和网络协议细节。

#### 1. BusyBox applet 测试与网络/procfs 兼容修复

BusyBox 是一组高度依赖 Linux 基础接口的命令行工具集合。为了让 StarryOS 能稳定运行 BusyBox applet，我补充了多个 applet 场景，并根据测试暴露的问题修复内核语义。

主要修复点包括：

1. **补充网络设备 ioctl 支持**

   BusyBox 的 `ifconfig`、`ifenslave` 等工具会查询网络设备信息，依赖 `SIOCGIFCONF`、`SIOCGIFFLAGS`、`SIOCGIFADDR`、`SIOCGIFHWADDR`、`SIOCGIFMTU` 等 socket ioctl。早期 StarryOS 对这些 ioctl 支持不足，导致工具无法正常识别 `eth0` 和 `lo`。

   我在网络文件路径中补充了这些 ioctl 的兼容返回，使 BusyBox 能获得接口列表、接口 flags、IP 地址、MAC 地址和 MTU 等基础信息。

2. **补充 `/proc/net/dev`**

   BusyBox 和一些网络工具会读取 `/proc/net/dev` 来获取网络设备统计信息。StarryOS 原来缺少该 procfs 节点，因此我在 pseudofs/proc 中补充了 `/proc/net/dev`，为 `eth0` 和 `lo` 提供基本设备条目。即使统计值暂时是简化的，也能满足用户态工具对接口存在性的探测（后续可能已经更改）

3. **修复 raw socket 下 ICMP loopback echo reply**

   BusyBox `ping -c 1 127.0.0.1` 需要 raw socket 能收到 loopback ICMP echo reply。早期实现中 loopback reply 的生成位置不合适，可能绕过正常网络栈路径，影响其他 raw socket 测例。

   后续修复将 ICMP loopback reply 的生成移动到 smoltcp 发送路径的合适位置：既能让 BusyBox ping 收到回包，又保持 raw socket 数据仍通过正常网络路径投递，避免破坏 `MSG_PEEK` 等测试。

4. **清理非语义 BusyBox 测例**

   PR752 对 BusyBox 测试做了整理，删除不稳定或不具备明确内核语义价值的检查，使 applet 测试更聚焦于 StarryOS 应该保证的 Linux 兼容行为，而不是测试环境偶然输出。

这一阶段 BusyBox 测试从“能启动部分命令”推进到覆盖更多网络、procfs 和 shell 工具场景，也暴露了仅靠 syscall 单测难以发现的接口组合问题。

#### 2. Lua / LuaRocks 运行时测试与文件系统语义修复

Lua 场景的目标是验证解释器、脚本加载、模块 require、文件访问和 LuaRocks 安装使用链路

主要工作包括：

1. **新增 Lua 应用运行测试**

   我为 Lua 添加了 QEMU app 测试，覆盖 Lua 主脚本、辅助模块、`require`、文件加载等运行时行为。相比 syscall 单测，Lua 能更真实地覆盖动态解释器对文件系统、路径解析和运行时库的使用。

2. **新增 LuaRocks 测试**

   LuaRocks 会涉及包安装、模块路径、文件创建和 require 验证。我补充了 LuaRocks 相关测试，验证在 StarryOS 中安装并加载 Lua 包的基本流程。

3. **修复非空目录 rmdir 语义**

   Lua/LuaRocks 场景暴露出文件系统删除目录语义不完整的问题：对非空目录执行 `rmdir` 应该返回 `ENOTEMPTY`，而不是错误地允许删除或返回不符合 Linux 的错误。PR777 在 axfs-ng 的 high-level fs 路径中加入非空目录检查，并新增 `test-rmdir-nonempty` 回归测试，覆盖四个架构。

这一阶段的意义在于：Lua 作为解释型语言，能覆盖大量普通 C syscall 测例不容易组合出的路径，例如脚本查找、模块加载、目录删除、包管理器临时目录等。

#### 3. Redis 应用测试与网络/文件系统稳定性修复

Redis 是更复杂的真实服务端应用，涉及 TCP listen/accept、并发连接、非阻塞 connect、半关闭、recv、文件 rename 和压力场景

主要工作包括：

1. **设计 Redis normal 与 stress 测试**

   我将 Redis 场景整理为 Starry app，新增 normal 和 stress 两类测试：

   - normal 测试验证 Redis server 基础启动、客户端连接和基础命令交互。
   - stress 测试覆盖更高频连接和读写场景，用于暴露网络栈边界问题。

   同时为 riscv64、aarch64、loongarch64、x86_64 增加对应 build 和 QEMU 配置，使 Redis 测试可以跨架构运行。

2. **修复 TCP listen/accept 路径**

   Redis server 依赖稳定的监听和连接接受语义。PR802 修复了 ax-net-ng listen table 中和连接管理相关的问题，使 TCP server 能更可靠地处理客户端连接，避免并发连接或非阻塞 connect 场景下状态错误。

3. **修复 TCP half-close 与 recv 语义**

   Redis 和相关 socket 测例暴露出 `shutdown(SHUT_WR)` 后 `recv()` 行为不正确的问题。Linux TCP 半关闭语义要求：关闭写方向后，读方向仍然可以继续接收对端数据。原先实现把某些状态过早视为 closed，导致 recv 无法继续 drain 队列。

   修复后，`recv()` 不再简单以“不是 Connected”作为拒绝条件，而是区分真正关闭和半关闭状态；同时调整 recv 内部顺序，优先读取已排队数据，保证 RST/Closed 但仍有队列数据时也能按预期读出。

4. **补充并发 connect 和非阻塞 connect 回归测试**

   为防止网络状态机后续回退，我增加了：

   - `bug-tcp-concurrent-connect`
   - `bug-tcp-nonblocking-connect-so-error`

   并将它们加入多架构 bugfix 配置。这样不仅验证 Redis 场景，也沉淀成更小的网络栈回归测例。

5. **修复 rename 祖先目录检查**

   Redis 使用过程中还暴露出文件系统 rename 语义问题。PR802 增加 `bug-rename-file-into-child-dir`，修复 axfs-ng-vfs rename 祖先关系检查，使非法 rename 能按预期拒绝，避免破坏目录树结构。

通过第二阶段，StarryOS 的验证对象从“单个接口”扩展到“真实用户程序”。BusyBox 暴露了 procfs、socket ioctl 和 raw socket 问题；Lua 暴露了文件系统目录语义问题；Redis 暴露了 TCP 状态机、半关闭、并发连接和 rename 检查问题。这些工作也说明：越接近真实应用，调试复杂问题越依赖可观察性工具，第三阶段转向 GDB/ptrace 支持是自然延伸。



## 三、第三阶段工作、技术报告

### 1. 技术路线总览

本阶段在 StarryOS 内核中实现一个可用的 Linux ptrace 子集，使 GDB 能够通过标准接口控制用户态程序。GDB 的命令转化为 `ptrace()`、`waitpid()/waitid()`、`/proc` 文件读取等 Linux 兼容接口。


{% asset_img x1.png x1 %}



### 2. ptrace状态组织

这条链路的核心是 `PtraceState`。它保存了 GDB 需要观察和修改的执行现场，早期 PR #931 实现了ptrace的大致框架，使得starryOS能够跑通单线程 RISC-V GDB，但它的 stop 状态为进程级，无法表达多个 LWP 同时存在时“哪个线程停住、读写哪个线程寄存器、恢复哪个线程”。后续提交的PR重构将 stop、resume、syscall trace、FP 状态改为按 TID 保存，使得多线程 GDB可用。

{% asset_img x2.png x2 %}





### 3. GDB 命令到内核路径状态机

以断点为例，完整状态迁移如下：

{% asset_img x3.png x3 %}

下面是更具体的几个命令对应执行流的讲解

##### 3.1 启动目标程序：`run`

GDB 启动目标程序时，典型流程是 fork 出子进程，子进程执行 `PTRACE_TRACEME`，随后 `execve` 加载目标程序。StarryOS 内核处理流程为：

```
tracee: ptrace(PTRACE_TRACEME)
    -> sys_ptrace()
    -> ptrace_traceme()
    -> ProcessData::set_ptrace_traceme()
    -> 记录 tracer_pid 为父进程

tracee: execve(target)
    -> sys_execve()
    -> 装载 ELF，重建用户地址空间、栈和 auxv
    -> ProcessData::set_ptrace_exec_stop_pending()

tracee: 返回用户态前
    -> task/user.rs 用户态返回循环
    -> take_ptrace_exec_stop_pending()
    -> ptrace_notify_exec()
    -> ptrace_stop_current(SIGTRAP)

tracer: waitpid()
    -> sys_waitpid()
    -> 发现 tracee 的 ptrace stop
    -> 返回 SIGTRAP / PTRACE_EVENT_EXEC stop
```

这一步的意义是让 GDB 在新程序镜像刚装载完成、还没有真正运行用户代码时获得同步点。GDB 可以在这个时机读取 `/proc/<pid>/maps`、`/proc/<pid>/auxv`，加载符号并设置断点。

##### 3.2 设置断点：`break`

GDB 的软件断点不是一个单独的内核 syscall，而是通过 ptrace 写 tracee 内存实现：

```
GDB: break function
    -> 读取目标地址原始指令
       ptrace(PTRACE_PEEKDATA)
       -> ptrace_peekdata()
       -> 从 tracee AddrSpace 读取用户内存

    -> 写入断点指令
       ptrace(PTRACE_POKEDATA)
       -> ptrace_pokedata()
       -> 写 tracee AddrSpace
       -> 必要时 flush icache
```

当 tracee 执行到断点指令后，会从用户态陷入内核：

```
tracee executes breakpoint instruction
    -> UserContext::run() 返回 Exception(Breakpoint)
    -> task/user.rs 判断 tracee 正在被 ptrace
    -> ptrace_stop_current(SIGTRAP)
    -> 保存 UserContext / siginfo / stop record
    -> notify_ptrace_waiter()
    -> tracee 阻塞等待 tracer resume

GDB: waitpid()
    -> 收到 SIGTRAP stop
    -> 读取寄存器，显示当前源码行
```

##### 3.3 继续执行：`continue`

GDB 继续执行时调用 `PTRACE_CONT`：

```
GDB: continue
    -> ptrace(PTRACE_CONT, tid, 0, signo)
    -> sys_ptrace()
    -> ptrace_cont()
    -> ptrace_stopped_tracee_with_tid()
    -> 清除 single-step / syscall trace 状态
    -> resume_ptrace_stop_with_signal_for(tid, signo)
    -> 清除 stop record 中的 signo
    -> wake ptrace_stop_event

tracee:
    -> wait_ptrace_resume() 被唤醒
    -> take_ptrace_stop_user_context_for(tid)
    -> 应用 GDB 可能修改过的寄存器
    -> restore_current_fp_for_ptrace(tid)
    -> 返回用户态继续执行
```

这里的关键点是：tracee 在 `ptrace_stop_current()` 里睡眠，直到 GDB 通过 `PTRACE_CONT` 或其他 resume 请求清除对应 TID 的 stop 状态并唤醒它。

##### 3.4 单步执行：`stepi` / `nexti`

GDB 单步执行依赖 `PTRACE_SINGLESTEP`。StarryOS 在不同架构上采用不同实现方式：

```
GDB: stepi
    -> ptrace(PTRACE_SINGLESTEP, tid, 0, signo)
    -> ptrace_singlestep()
    -> set_ptrace_singlestep_for(tid, true)
    -> resume_ptrace_stop_with_signal_for(tid, signo)

tracee 返回用户态前
    -> task/user.rs 检查 is_ptrace_singlestep_for(tid)
    -> ptrace_setup_singlestep(...)
    -> 设置架构相关 single-step 机制

tracee 执行一条指令
    -> 陷入 breakpoint/debug exception
    -> ptrace_stop_current(SIGTRAP)
    -> GDB waitpid 收到单步完成 stop
```

在 RISC-V、AArch64、LoongArch64 上，single-step 主要通过计算下一条 PC 并在 next-PC 临时插入断点指令实现；命中后恢复原始指令。在 x86_64 上，后续实现可以使用 RFLAGS 的 TF 位触发 `#DB` debug exception。这个差异被封装在架构相关的 `ptrace_setup_singlestep()` 中，对上层 GDB 仍表现为统一的 `PTRACE_SINGLESTEP`。

##### 3.5 查看寄存器：`info registers`

GDB 查看寄存器时会调用 legacy regs 或 regset 接口：

```
GDB: info registers
    -> ptrace(PTRACE_GETREGS)
       或 ptrace(PTRACE_GETREGSET, NT_PRSTATUS)
    -> ptrace_getregs() / ptrace_getregset()
    -> ptrace_stop_user_context_for(tid)
    -> 将 UserContext 转换为目标架构 ABI 的用户寄存器结构
    -> vm_write 到 GDB 提供的用户缓冲区
```

GDB 修改寄存器时则反向执行：

```
GDB: set $pc = ...
    -> ptrace(PTRACE_SETREGS)
       或 ptrace(PTRACE_SETREGSET, NT_PRSTATUS)
    -> 从 GDB 用户缓冲区读取寄存器结构
    -> 转换回 UserContext
    -> set_ptrace_stop_user_context_for(tid, new_uctx)
```

真正写回 tracee 的时机不是 `PTRACE_SETREGS` 当场返回用户态，而是 tracee 被 resume 后在 `wait_ptrace_resume()` 中执行：

```
take_ptrace_stop_user_context_for(tid)
*uctx = resume_uctx
```

这样保证 GDB 对寄存器的修改会成为 tracee 下一次回到用户态时的真实执行现场。

##### 3.6 查看内存和调用栈：`x` / `bt`

GDB 的内存查看命令，例如：

```
x/4gx $sp
```

会通过 `PTRACE_PEEKDATA` 读取 tracee 地址空间。内核路径为：

```
ptrace(PTRACE_PEEKDATA, tid, addr, data)
    -> ptrace_peekdata()
    -> 找到 tracee ProcessData
    -> tracee.aspace().read(addr)
    -> 将读取结果写回 tracer data 指针
```

`bt` 本身主要由 GDB 在用户态完成。内核需要提供以下基础信息：

- 当前 PC、SP、FP、RA 等寄存器。
- tracee 栈内存读取能力。
- `/proc/<pid>/maps` 用于判断地址属于哪个映射。
- `/proc/<pid>/auxv` 用于获取入口、页大小、硬件能力等辅助信息。
- ELF 符号和 DWARF 调试信息由 GDB 从目标文件中读取。

因此 StarryOS 内核并不直接实现完整 GDB backtrace 算法，而是提供 GDB unwind 所需的寄存器、内存和 procfs 信息。



### 4. 信号处理流程

GDB 支持里最重要的状态机之一是 signal-delivery-stop。tracee 收到普通信号时，内核不能马上执行默认动作或用户 handler，而是要先停给 tracer，让 GDB 决定这个信号是否真正交给程序。

{% asset_img x4.png x4 %}



这里的 `resume_signal_bypass` 用于避免死循环。（后续代码解读里也有）例如 tracee 收到 `SIGTERM` 后停给 GDB，GDB 决定继续传递 `SIGTERM`。如果内核只是把 `SIGTERM` 重新放回信号队列，下一轮又会再次 ptrace stop。因此内核为 tracer 明确注入的信号设置一次性 bypass，使下一轮信号处理直接递送，不再重复停给 GDB。



### 5. 多线程与 LWP 设计

StarryOS 的进程/线程关系可以简化为：

{% asset_img x5.png x5 %}



GDB 中的 LWP 基本对应 StarryOS 的 TID。因此 ptrace 不能只保存一份进程级 stop，而需要按 TID 记录：

{% asset_img x6.png x6 %}



ptrace 的设计采用“进程级容器 + TID-keyed 状态”：

- `tracer_pid`、`traceme`、`attached` 表示进程级调试关系。
- `stop[tid]` 保存每个 LWP 的停止现场。
- `resume_signo[tid]` 保存每个 LWP resume 时的信号选择。
- `syscall_trace[tid]` 保存每个 LWP 的 syscall entry/exit 状态。
- `stop_fp_data[tid]` 保存每个 LWP 的 FP/SIMD/FPU 快照。

这个设计支撑了以下命令：

`info threads`：通过 `/proc/<pid>/task` 发现线程。

`thread <n>`：后续 ptrace 操作绑定到具体 LWP/TID。

`info registers`：读取对应 TID 的 `UserContext`。

`continue` / `stepi`：只恢复或单步指定 TID 的 stop 状态。



**！注**：在第三或第四周会议时，陈老师表示当前 starryos 多线程还不完善，先保持单线程可用即可，之前 stop 状态为进程级虽然能达到要求，但难免有写了个 bug但能跑就不管了的意味，考虑到时间有限，做的多线程支持虽然仍是 all-stop 的，不追求完整 non-stop mode 和完整 Linux group-stop，但已经解决了早期“一个进程只有一份 stop 状态”无法表达 LWP 的问题。



### 6. 三架构支持方式

ptrace 的公共流程是统一的，但寄存器布局、FP/SIMD/FPU 状态和 single-step 机制都依赖架构。因此实现拆成“公共 ptrace 状态机 + 架构适配层”。（x86 架构适配层由杨铮同学 GitHub [54dK3n](https://github.com/rcore-os/tgoskits/commits?author=54dK3n&since=2026-05-31&until=2026-06-27) 完成）

| 架构        | 通用寄存器                                                   | FP/SIMD/FPU                                                  | single-step                                                  |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| riscv64     | `pc/ra/sp/gp/tp/a0-a7/s0-s11/t0-t6` 与 `UserContext` 互转，支持 `NT_PRSTATUS` 读写通用寄存器。 | 支持 `NT_FPREGSET` 和 legacy FP 接口读写浮点寄存器与 `fcsr`。 | 使用临时 `ebreak` 实现 `PTRACE_SINGLESTEP`：计算下一条 PC，保存原始指令，写入断点指令，命中后恢复。 |
| aarch64     | 将 `UserContext` 中的 `x0-x30`、`sp`、`pc`、`pstate` 映射为 AArch64 GDB 期望的通用寄存器结构。支持 `NT_PRSTATUS` 读写通用寄存器。 | 支持 `NT_FPREGSET` 读写 `v0-v31`、`fpcr`、`fpsr`。进入 ptrace stop 时保存当前 FP/SIMD 状态，resume 时恢复，保证 GDB 修改 FP/SIMD 寄存器后能写回 tracee 执行态。 | single-step 同样通过架构相关 next-PC / 临时断点路径接入公共 `PTRACE_SINGLESTEP` 流程。 |
| loongarch64 | 将 `UserContext` 中的 `r0-r31`、`era`、`badv` 等状态映射为 LoongArch GDB 期望的寄存器布局。支持 `NT_PRSTATUS` 读写通用寄存器。支持 `NT_FPREGSET`，并补充 legacy `PTRACE_GETFPREGS` / `PTRACE_SETFPREGS` 与 regset 路径复用。 | 保存和恢复 FPU 扩展状态，包括普通 FP、`fcc`、`fcsr` 以及后续扩展状态。 | 补充 LoongArch 分支/跳转等指令的 next-PC 处理接入`PTRACE_SINGLESTEP` |

在写入用户 text 指令后刷新 icache，保证 tracee 执行到新写入的断点指令。

**！注：**本科学过riscv 和一部分x86 指令集，但由于软件工程专业背景所限，硬件指令集这块了解不深，靠codex和 asm test 测试驱动开发完成的任务。（埋个伏笔，看我一年后能不能完成一生一芯...）



### 7. procfs 辅助信息

除了 ptrace syscall，GDB 还依赖 procfs 获取进程信息。为此本阶段补充和修复了以下路径：

- `/proc/<pid>/maps`：提供用户地址空间映射，支持 GDB 判断 text/data/heap/stack 等区域。
- `/proc/<pid>/auxv`：提供 auxiliary vector，例如 `AT_ENTRY`、`AT_PHDR`、`AT_PAGESZ`、`AT_HWCAP`。
- `/proc/<pid>/status`：提供 `TracerPid`、线程数量、UID/GID 等状态信息。
- `/proc/<pid>/task`：提供线程列表，使 GDB 能发现 LWP。

这些接口不直接执行调试控制，但决定了 GDB 是否能正确加载符号、识别动态链接器、展示线程和解释目标进程内存布局。



### 8. 当前能力边界

当前实现已经能够支撑基础 GDB 使用：

- native GDB 调试用户程序。
- guest 内 gdbserver 调试。
- host-to-guest remote GDB。
- 断点、继续、单步、寄存器查看/修改、内存查看、基础 backtrace。
- 简单多线程程序的 LWP 发现和线程级寄存器/stop 操作。
- riscv64、aarch64、loongarch64 （x86）的基础寄存器和 FP/SIMD/FPU regset。

但它仍然是可用子集，不是完整 Linux ptrace/GDB 语义。当前**没有完成**的有完整 non-stop mode、完整 group-stop / job-control 与 ptrace-stop 的 Linux 级细节、硬件断点和 watchpoint、core dump、所有复杂线程事件的完全 Linux 兼容、所有架构指令的完整 single-step next-PC 语义



### 9. 代码解读

本着学习的目的以及尽量不往 tgoskits 里塞屎山的态度，提交 PR 前我都会弄懂 codex 写了什么，也学习到一些我认为比较优质的代码设计。

解读的代码版本为 dev 分支的Commit afad791

```rust
pub fn new_user_task(name: &str, mut uctx: UserContext, set_child_tid: usize) -> TaskInner {
  ...
  match reason {
                    ReturnReason::Syscall => {
                        let tid = thr.tid();
                        let trace_state = thr.proc_data.take_ptrace_syscall_trace_for(tid);
                        if matches!(trace_state, SyscallTraceState::Entry)
                            && ptrace_syscall_stop_current(thr, Signo::SIGTRAP, &mut uctx).is_some()
                        {
                            match thr.proc_data.take_ptrace_syscall_trace_for(tid) {         
                                SyscallTraceState::Entry | SyscallTraceState::Exit => {
                                    thr.proc_data.set_ptrace_syscall_trace_state_for(
                                        tid,
                                        SyscallTraceState::Exit,
                                    )
                                }
                                SyscallTraceState::None => {}
                            }
                        }

                        if let Some(exit_code) = ptrace_exit_event_code(saved_sysno, saved_a0)
                            && crate::syscall::ptrace_notify_exit(
                                thr.proc_data.proc.pid(),
                                exit_code,
                            )
                        {
                            let _ = ptrace_stop_current(thr, Signo::SIGTRAP, &mut uctx);
                        }

                        handle_syscall(&mut uctx);
                        if thr.proc_data.has_ptrace_pending_event_for(tid)
                            && let Some(_resume_sig) =
                                ptrace_stop_current(thr, Signo::SIGTRAP, &mut uctx)
                        {
                            continue;
                        }
                        if matches!(
                            thr.proc_data.take_ptrace_syscall_trace_for(tid),
                            SyscallTraceState::Exit
                        ) {
                            let _ = ptrace_syscall_stop_current(thr, Signo::SIGTRAP, &mut uctx);
                        }
                        if thr.proc_data.take_ptrace_exec_stop_pending() {
                            let _is_event =
                                crate::syscall::ptrace_notify_exec(thr.proc_data.proc.pid());
                            if let Some(_resume_sig) =
                                ptrace_stop_current(thr, Signo::SIGTRAP, &mut uctx)
                            {
                                continue;
                            }
                        }
                    }
  ...
}
```

**解读：**User task 从用户态返回内核态时，内核会分析返回原因。当原因是 syscall时，会分析当前线程的 trace_state，如果是 SyscallTraceState::Entry，说明在实际 syscall 代码执行前，我们需要挂起当前tracee 线程，去唤醒 tracer 线程。

然后 tracer 即 GDB 会做什么？

可能 continue（PTRACE_CONT），把 None 写入 tracee 状态，`match thr.proc_data.take_ptrace_syscall_trace_for(tid)`会返回 None，后续不再追踪 syscall。 可能 stepi（PTRACE_SYSCALL），把Entry 写入状态，`set_ptrace_syscall_trace_state_for` 将 tracee 设为 Exit，syscall出口会再挂起 去唤醒 tracer。可能detach（PTRACE_DETA），后续脱离追踪。

然后到PTRACE_EVENT_EXIT 通知，这段代码在 handle_syscall 之前执行，用于在进程调用 exit/exit_group 即将退出时，给调试器最后一次查看的机会。如果先 handle_syscall 再通知，do_exit 已经执行完了，进程没了，调试器看不到退出码。

接着是handle_syscall 之后的三重 ptrace 事件处理

第一重：pending event stop，handle_syscall 内部可能发生了：fork、vfork、clone、 seccomp 规则触发，这些事件往往伴随进程状态变化（fork 产生子进程、seccomp 修改了寄存器），调试器恢复后应该重新进入主循环检查新的状态，而不是继续跑完当前系统调用的后续处理。

第二重：系统调用出口 stop，然后 wake tracer。

第三重：take_ptrace_exec_stop_pending() 是 execve 在 handle_syscall 时设置的布尔标记，此时ptrace_notify_exec 将标记转为正式事件，如果 tracer 开了 PTRACE_O_TRACEEXEC  则 tracee.set_ptrace_pending_event(tid, PTRACE_EVENT_EXEC, 0);  execve 会完全替换进程地址空间——旧的可执行文件、栈、堆全没了，新程序加载完毕。调试器恢复后应该重新从主循环开始 所以 continue



```rust
fn ptrace_stop_current_impl(
    thr: &Thread,
    signo: Signo,
    uctx: &mut UserContext,
    is_syscall_stop: bool,
) -> Option<Option<Signo>> {
	 ...
    while !thr.proc_data.claim_ptrace_stop(tid) {
        block_on(poll_fn(|cx| {
            if !thr.proc_data.has_ptrace_stop(tid) {
                Poll::Ready(())
            } else {
                thr.proc_data.register_ptrace_stop_waker(cx.waker());
                if !thr.proc_data.has_ptrace_stop(tid) {
                    Poll::Ready(())
                } else {
                    Poll::Pending
                }
            }
        }));
    }
		···
    {
        thr.proc_data.save_current_fp_for_ptrace(tid);
    }
    if is_syscall_stop {
        thr.proc_data.set_ptrace_syscall_stop(tid, signo, uctx);
    } else {
        thr.proc_data.set_ptrace_stop(tid, signo, uctx);
    }
    notify_ptrace_waiter(thr, signo);

    wait_ptrace_resume(thr, tid, uctx);
    Some(thr.proc_data.take_ptrace_resume_signo_for(tid))
}

```

**解读**：claim_ptrace_stop 检查该线程是否有未消费的 stop 记录

为什么注册 waker 后又检查一次？这是防止竞态情况发生：has_ptrace_stop == true，tracee 准备进pending 分支，tracer 恰好清掉 stop 并唤醒
当前线程还没注册 waker，可能错过唤醒

thr.proc_data.save_current_fp_for_ptrace(tid);保存当前线程的 FP/SIMD 寄存器状态，原因是普通整数寄存器在 `uctx` 里，但浮点/SIMD 寄存器不完整保存在 `UserContext` 里，可能在 CPU lazy state 或架构专门的上下文里

set_ptrace_stop 代码就很简单，略过。然后去通知tracer，给 tracer 发送 SIGCHLD / CLD_TRAPPED，唤醒 tracer 的 wait/waitpid。



```rust
fn wait_ptrace_resume(thr: &Thread, tid: u32, uctx: &mut UserContext) {
    current().clear_interrupt();
    let wait_result = block_on(interruptible(poll_fn(|cx| {
        if thr.proc_data.ptrace_stop_signo_for(tid).is_none() {
            Poll::Ready(())
        } else {
            thr.proc_data.register_ptrace_stop_waker(cx.waker());
            if thr.proc_data.ptrace_stop_signo_for(tid).is_none() {
                Poll::Ready(())
            } else {
                Poll::Pending
            }
        }
    })));

    if wait_result.is_err() {
        thr.proc_data.clear_ptrace_stop();
    } else if let Some(resume_uctx) = thr.proc_data.take_ptrace_stop_user_context_for(tid) {
        *uctx = resume_uctx;
        thr.proc_data.restore_current_fp_for_ptrace(tid, uctx);
    }
}

```

**解读：**这个函数是tracer 已被通知、tracee 在 stop 状态中挂起，等待tracer 说"继续跑"

第一行代码是因为当前线程上可能挂着未处理的中断标记（比如定时器中断正好在进入 stop 前触发）。不清掉的话 interruptible 会立即返回 Err，导致虚假唤醒。

接下来异步轮询等待，如果 stop signo 被清理了，说明tracer执行了 resume_ptrace_stop → 清除 signo。 tracee 已经可以恢复执行了。否则注册唤醒器， 注册期间被清除了，立即恢复，否则继续 pending。 这里也有经典的双重检查模式和上面一样防止 TOCTOU 竞态

wait result 为Err 表示 interruptible 被信号打断（比如 SIGKILL 来了）。直接清除 stop 状态，后续 check_signals 循环会出队 SIGKILL 并执行 do_exit。

take_ptrace_stop_user_context_for 取出tracer可能修改过的 uctx，然后覆盖当前uctx。tracer 也可能通过 PTRACE_SETFPREGS 修改了浮点寄存器，恢复执行时必须把这些修改写回硬件。



```rust
check_signals 中有如下代码片段

	if signo != Signo::SIGKILL
        && !thr
            .proc_data
            .take_ptrace_resume_signal_bypass_for(thr.tid(), signo)
        && let Some(resume_signo) = ptrace_stop_current(thr, signo, uctx)
    {
        match resume_signo {
            None => return true,
            Some(new_signo) if new_signo != signo => {
                thr.proc_data
                    .set_ptrace_resume_signal_bypass_for(thr.tid(), new_signo);
                let _ = thr.signal.send_signal(SignalInfo::new_kernel(new_signo));
                return true;
            }
            Some(_) => {}
        }
    }
```

**解读** SIGKILL 不可拦截易理解，下面解释一下 bypass。

假设调试器通过 PTRACE_CONT 注入信号 SIGSTOP：

没有 bypass:

信号 SIGSTOP 入队 → check_signals 出队 → ptrace_stop_current→ 调试器说"传 SIGSTOP" → 信号重新入队 → check_signals 再出队→ 又 ptrace_stop_current → 调试器又说"传 SIGSTOP" → 入队...→ 永远循环

有 bypass:

调试器注入 SIGSTOP 时 set_bypass(SIGSTOP) → 信号入队 → check_signals 出队 → take_bypass 返回 true → 跳过 ptrace stop → 直接往下处理

后续 resume_signo 对应三种回复

{% asset_img x7.png x7 %}





我在 ProcessData 里添加了很多 ptrace 实现所需的字段，下面会简单解释一下

> 感觉这里应该把这些字段抽离出来成为一个结构体比如 ptraceInfo {···}，这样会让 ProcessData 更清晰，不过直接添加到ProcessData 里能跑，先不管了，后续可能有同学看不惯简单重构一下就行

**身份与追踪关系**

| 字段                | 类型         | 作用                                                  |
| ------------------- | ------------ | ----------------------------------------------------- |
| `ptrace_tracer_pid` | `AtomicU32`  | 调试器的 PID。知道该给谁发 `SIGCHLD` 通知             |
| `ptrace_traceme`    | `AtomicBool` | 进程自己调用 `PTRACE_TRACEME`，声明"让父进程来追踪我" |
| `ptrace_attached`   | `AtomicBool` | 调试器通过 `PTRACE_ATTACH` 强行附加到本进程           |

**stop 状态**

| 字段                | 类型                              | 作用                                                         |
| ------------------- | --------------------------------- | ------------------------------------------------------------ |
| `ptrace_stop`       | `BTreeMap<tid, PtraceStopRecord>` | per-thread 的 stop 快照：`signo`（停因）、`uctx`（寄存器）、`is_syscall`、`siginfo`、是否已报告给调试器 |
| `ptrace_stop_tid`   | `AtomicU32`                       | 当前正 stop 的线程 TID，供 `waitpid` 快速定位                |
| `ptrace_stop_event` | `Arc<PollSet>`                    | 异步事件，stop 状态变化时唤醒 `waitpid` 的挂起线程           |

**恢复控制**

| 字段                          | 类型                   | 作用                                                         |
| ----------------------------- | ---------------------- | ------------------------------------------------------------ |
| `ptrace_resume_signo`         | `BTreeMap<tid, signo>` | 调试器通过 `PTRACE_CONT` 注入的信号号                        |
| `ptrace_resume_signal_bypass` | `BTreeMap<tid, signo>` | 已获调试器批准的信号，下次出队时跳过 ptrace stop，防止死循环 |

**功能模式**

| 字段                    | 类型                             | 作用                                                         |
| ----------------------- | -------------------------------- | ------------------------------------------------------------ |
| `ptrace_singlestep_tid` | `AtomicU32`                      | 处于单步模式的线程 TID                                       |
| `ptrace_syscall_trace`  | `BTreeMap<tid, Entry/Exit/None>` | 系统调用追踪状态：`Entry`（入口停）、`Exit`（出口停）、`None`（不追踪） |
| `ptrace_options`        | `AtomicUsize`                    | `PTRACE_O_TRACEFORK/EXEC/EXIT` 等选项位掩码                  |

**事件系统**

| 字段                       | 类型                                | 作用                                                         |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `ptrace_pending_event`     | `BTreeMap<tid, PtracePendingEvent>` | `handle_syscall` 触发的延时事件（`PTRACE_EVENT_FORK/CLONE/VFORK/SECCOMP`），在 syscall 返回后补一次 stop |
| `ptrace_exec_stop_pending` | `AtomicBool`                        | `execve` 执行后置位，提示 syscall 出口处需要 `PTRACE_EVENT_EXEC` 通知 |

**硬件状态保存**

| 字段                   | 类型                              | 作用                                                         |
| ---------------------- | --------------------------------- | ------------------------------------------------------------ |
| `ptrace_ss_saved_insn` | `BTreeMap<tid, (地址, 原始指令)>` | 非 x86 架构单步时，用断点替代下一条指令，保存被替换的原始指令以便恢复 |
| `ptrace_stop_fp_data`  | `BTreeMap<tid, PtraceStopFpData>` | stop 时的 FP/SSE 寄存器快照，调试器通过 `PTRACE_GETFPREGS/SETFPREGS` 读写此数据 |

ptrace.rs 是 sys ptrace 的具体实现，限于篇幅这里不详细讲了



## 四、测试与成果

### 1. 测试代码结构

GDB 支持相关测试分为三层：内核 ptrace 语义回归测试、guest 内 GDB/gdbserver smoke 测试、压力测试。

#### 1.1 ptrace 语义回归测试

核心测试位于：

```text
test-suit/starryos/qemu-smp1/system/test-ptrace-gdb/src/main.c
```

该测试不依赖真实 GDB，而是直接调用 Linux `ptrace` ABI，验证 GDB/gdbserver 所依赖的底层语义是否正确，覆盖内容包括：

该测试的作用是把 GDB 的复杂行为拆成更稳定的 syscall 级语义检查。例如：

- `PTRACE_GETREGSET / SETREGSET`：验证 GDB 能读取和修改 tracee 的 PC、SP、通用寄存器。
- `PTRACE_PEEKDATA / POKEDATA`：验证 GDB 能读写 tracee 用户地址空间，用于软件断点。
- `PTRACE_SINGLESTEP`：验证 `stepi` 能单步执行一条用户指令。
- `PTRACE_SYSCALL`：验证 syscall entry/exit stop，可支撑 strace 类功能。
- `PTRACE_O_TRACECLONE`：验证线程创建事件能够被 tracer 观察。
- `PTRACE_GETSIGINFO / SETSIGINFO`：验证信号 stop 的 `siginfo` 能被 tracer 查询和修改。
- `NT_FPREGSET`：验证浮点/SIMD regset 的读写路径。

辅助测试包括：

```text
test-suit/starryos/qemu-smp1/system/test-ptrace-traceme-stop/
test-suit/starryos/qemu-smp1/system/test-ptrace-wait-wall/
test-suit/starryos/qemu-smp1/system/test-ptrace-thread-traceclone-wall/
test-suit/starryos/qemu-smp1/system/test-proc-status-tracerpid/
test-suit/starryos/qemu-smp1/system/test-gdb-native-batch/
```

这些测试分别覆盖：

- `PTRACE_TRACEME + execve` 后的 exec-stop。
- `waitpid/__WALL` 对 traced LWP 的 stop 消费。
- `TRACECLONE` 下新线程事件与新 TID 获取。
- `/proc/<pid>/status` 中 `TracerPid` 展示。
- 模拟 GDB 的动态链接程序调试流程。

其中 `test-gdb-native-batch` 是 raw-ptrace 版本的 GDB 流程模拟，主要步骤为：

```text
fork + PTRACE_TRACEME + execve
读取 /proc/<pid>/auxv 中的 AT_ENTRY
在 AT_ENTRY 写入断点指令
PTRACE_CONT 运行到断点
恢复原指令并调整 PC
PTRACE_SINGLESTEP 执行原指令
PTRACE_CONT 继续运行到正常退出
```

它验证的是“不启动真实 GDB，也能通过 ptrace 完成一次简化调试会话”。

#### 1.2 guest 内 GDB smoke 测试

GDB 应用测试位于：

```text
apps/starry/gdb-smoke/
```

主要结构如下：

```text
apps/starry/gdb-smoke/native/src/main.c
apps/starry/gdb-smoke/native/gdb-native-smoke.gdb
apps/starry/gdb-smoke/native-thread/src/main.c
apps/starry/gdb-smoke/native-thread/gdb-native-threads.gdb
apps/starry/gdb-smoke/gdbserver/src/main.c
apps/starry/gdb-smoke/gdbserver/gdbserver-smoke.sh
apps/starry/gdb-smoke/gdbserver/gdbserver-smoke.gdb
apps/starry/gdb-smoke/gdbserver/host-manual.gdb
apps/starry/gdb-smoke/gdbserver/host-remote.gdb
```

其中 `native/src/main.c` 构造了一个清晰的调用链：

```text
main -> demo_entry -> demo_worker -> native_marker
```

用于验证 GDB 的断点、运行、回溯、寄存器读取、内存查看和单步执行。

`native-thread/src/main.c` 创建两个 pthread 子线程，用于验证：

```text
info threads
thread <id>
bt
/proc/<pid>/task
```

`gdbserver/src/main.c` 是远程调试目标程序，不是 gdbserver 本体。真实的 `gdbserver` 来自 rootfs 中的 `/usr/bin/gdbserver`。StarryOS 的工作是补齐其依赖的 ptrace/procfs 语义，使用户态 `gdbserver` 可以运行。

### 2. Demo 截图

四架构均可正常使用，我选取 aarch64 架构下进行截图演示



注：在 6.28 日我尝试在最新 dev 分支下验证 riscv 架构 gdb，出现了bfd requires flen 8, but target has flen 4 的问题。目标 ELF 为 double-float ABI，需要 flen=8，但 gdbserver 上报给 host GDB 的 target description 被识别为 flen=4。目标程序直接运行正常，说明 ELF 加载和执行路径可用，问题集中在 GDB/gdbserver 的 RISC-V target feature 描述或 FP regset 探测路径。

但 aarch 没有问题，两周前四架构均能正常演示



#### **Demo1  gdb server**

在终端 1 启动 aarch64 guest：

```
docker exec -it tgoskits-dev cargo xtask starry app qemu -t gdb-smoke --arch aarch64 \
  --qemu-config qemu-aarch64-gdbserver-manual.toml
```

进入 StarryOS shell 后运行：

```
gdbserver 0.0.0.0:1234 /usr/bin/gdbserver-smoke-target
```

终端 2：host 侧连接

```
docker exec -it tgoskits-dev gdb-multiarch -q \
  -x /workspace/apps/starry/gdb-smoke/gdbserver/host-manual-aarch64.gdb \
  /workspace/target/gdb-smoke-host/aarch64/gdbserver-smoke-target
```

break compute_value
continue
bt
info registers
detach

{% asset_img x8.png x8 %}

验证了StarryOS guest 内 `gdbserver` 可以启动并监听端口。

Docker host 侧 `gdb-multiarch` 可以通过 QEMU `hostfwd` 连接 guest。

GDB 可以对 guest 用户程序设置断点、继续执行、命中断点、读取 backtrace 和寄存器。

这条链路覆盖：`gdbserver -> ptrace -> wait/stop -> regset -> host GDB remote protocol`



#### **Demo2 native gdb**

```
docker exec -it tgoskits-dev cargo xtask starry app qemu -t gdb-smoke --arch aarch64 \
  --qemu-config qemu-aarch64-gdbserver-manual.toml

gdb /usr/bin/gdb-native-smoke-target

gdb内输入
set pagination off
break native_marker
run
bt
info registers
x/4gx $sp
info proc mappings
info files
info auxv
shell pid="$(pidof gdb-native-smoke-target)" && cat "/proc/$pid/status"
continue
```

{% asset_img x9.png x9 %}

{% asset_img x10.png x10 %}验证了aarch64 guest 内 native GDB 手工调试能力：断点、运行、回溯、寄存器、栈内存、procfs 信息读取。



#### **Demo3  TUI**

```
docker exec -it tgoskits-dev cargo xtask starry app qemu -t gdb-smoke --arch aarch64 \
  --qemu-config qemu-aarch64-gdbserver-manual.toml
  
gdb -q -tui /usr/bin/gdb-native-smoke-target

break native_marker
run
layout asm
layout regs
refresh
bt
info registers
tui disable
continue
```



{% asset_img x11.png x11 %}



{% asset_img x12.png x12 %}



{% asset_img x13.png x13 %}



{% asset_img x14.png x14 %}



#### Demo4 LWP/pthread task 

```
gdb /usr/bin/gdb-native-thread-target

set pagination off
set print thread-events on
set schedule-multiple on
break thread_marker
run
info threads
shell pid="$(pidof gdb-native-thread-target)" && ls "/proc/$pid/task"
bt
delete breakpoints
continue
```

{% asset_img x15.png x15 %}

{% asset_img x16.png x16 %}



## 五、工作 PR 记录、工作仓库

**issue 记录：**https://github.com/rcore-os/tgoskits/issues/586

### 第一阶段

Linux syscall 添加测例与修复 [PR 588](https://github.com/rcore-os/tgoskits/pull/588)  [PR605](https://github.com/rcore-os/tgoskits/pull/605)

包含：chmod、fchmod、chown、 fchown、faccessat、umask、fchmodat、fchownat  



### 第二阶段

1. busybox 十余个 applet 测例，修复内核语义 [PR668](https://github.com/rcore-os/tgoskits/pull/668) [PR752](https://github.com/rcore-os/tgoskits/pull/752)

2. 补齐 Lua 应用运行时的测试，修复阻碍 Lua 应用稳定运行的文件系统缺陷 [PR777](https://github.com/rcore-os/tgoskits/pull/777) 
3. 新增 Redis normal、stress测试，修复 ax-net-ng TCP listen/accept 路径、修复 TCP recv 路径、修复 axfs-ng-vfs rename 检查[PR802](https://github.com/rcore-os/tgoskits/pull/802)



### 第三阶段

1. ptrace 初步框架完成，初期设计问题在后续 PR 解决了，这是一个接近 5000行代码的提交，包括2000 余行测试相关代码与 2000 余行内核 feature 添加与语义修复。[PR931](https://github.com/rcore-os/tgoskits/pull/931)
2. 修复上一 PR 设计问题，重构 ptrace stop 状态，调整 wait / waitid 语义，调整 clone/fork/vfork ptrace event，补充 procfs / GDB 可用性支持，增加测试，并在开会时准备了 demo 并演示 [PR1167](https://github.com/rcore-os/tgoskits/pull/1167)
3. 前两个 PR 完成了 riscv64 的 gdb 可用，该 PR 完成了 aarch64、loongarch 的支持 [PR1247](https://github.com/rcore-os/tgoskits/pull/1247) 
4. 修复和补充了上一 PR 的缺口 [PR1292](https://github.com/rcore-os/tgoskits/pull/1292)
5. review 了杨铮同学的 PR，发现了一些设计上的分歧，把x86 的实现与测例对齐到我前面的设计 [PR1314](https://github.com/rcore-os/tgoskits/pull/1314)



**上述 11 个 PR 即是我本次训练营的所有工作**



## 六、总结与感想

2024 秋冬第一次听说 os 训练营，参加第一阶段 rust 语言学习就十分折磨，深夜在武大宿舍里调 rustling 程序，最终完成了 100 多道题的练习，踩了很多坑 走了很多弯路（比如死磕 rust 语言圣经、rust 程序设计教材，然而里面的很多语法比如“无畏并发”等高级内容根本就没用上，看了一遍又一遍都无法理解，最后发现只有在项目里用上才能真正理解...）

2025 春夏花了一整个月学 rCore，那时候本着学习的态度，古法编程，每行代码得去看去理解，犹记得文件系统章节看完了 easy fs 的所有代码，结果发现 lab 只需要写几行代码就能解决的无奈，不过学到知识就是胜利✌️后续有事没继续做最终阶段

2026 春夏花了两个月，从啃 arceos 代码发现很多地方看不懂，到使用 codex 辅助编程完成了 starryos 里计划好的工作，我不仅学到了 os 的知识，也更加熟练地使用ai 辅助编程。感谢 oscamp 和 infiniTensor 训练营，让我学到了这么多！终于是都通关了，明年我要继续 compiler camp！

关于第三阶段的项目，GDB 支持不是单个 syscall 的实现，而是一条完整链路。一个断点能否命中，背后涉及 ELF 加载、用户地址空间、信号投递、ptrace stop 状态、wait 语义、寄存器 ABI、跨进程内存访问、procfs、rootfs、gdbserver、QEMU 网络转发和测试组织。任何一环不稳定，最终都可能导致 GDB 卡住或超时，在实现过程中我对 os 的进程、信号 IPC、ELF、内存访问等等诸多方面都有了更深的了解，不过内核代码十分复杂，参加完训练营也仅对 os 了有了一些粗浅的理解，后续会继续读陈海波老师的《操作系统 原理与实现》，加深理解，继续努力提高工程能力

最后感谢陈渝老师、向勇老师、朱懿学长以及训练营的各位助教老师们。受益于开源，也要回馈开源，未来有空了希望我也能参与贡献各种开源训练营