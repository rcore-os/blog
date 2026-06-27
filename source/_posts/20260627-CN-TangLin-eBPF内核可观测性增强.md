---
title: 2026春季OS训练营总结报告——基于eBPF的内核可观测性能力增强
date: 2026-06-27 20:00:00
categories:
    - OSTraining
tags:
    - author:CN-TangLin
    - repo:https://github.com/CN-TangLin/tgoskits
    - 2026S
    - StarryOS
    - eBPF
    - JIT
    - kprobe
    - 内核可观测性
    - 系统调用
---

## 摘要

本文总结我在2026春季操作系统训练营（Stage 7 专业阶段）中的工作。我在"方案二：基于eBPF的内核可观测性能力增强"子课题3框架下，为StarryOS内核完成了eBPF子系统全栈构建、kprobe/kretprobe内核探针、LKM内核模块加载、三架构手写JIT编译器、多项系统调用增强与性能优化等工作。累计提交12个已合并PR、4个当前开放PR，新增15000+行代码，364个commits。代码覆盖x86_64、RISC-V 64、AArch64、LoongArch四个架构。

---

## 一、项目背景

StarryOS是构建在ArceOS组件化框架之上的Linux兼容操作系统，目标是运行未经修改的Linux用户态程序。训练营要求在StarryOS中实现eBPF（extended Berkeley Packet Filter）子系统——这是Linux内核的核心可观测性基础设施，允许用户安全地在内核中运行沙箱化程序，广泛应用于性能分析、安全监控、网络追踪等场景。

整体开发流程涉及多个层面的工作：首先由助教linfeng(Godones)老师搭建tracepoint基础设施（#673）和kallsyms/kprobe桩（#805、#837），我在这些基础上实现了kprobe动态探针（#847）和eBPF全栈子系统（#848），LorenzLorentz同学在此基础上实现了基于外部crate kbpf-basic+rbpf的eBPF runtime（#850）和LKM loader端口（#851）。三条技术路线在#848合并后融合为统一的eBPF执行框架，随后我补充了测试套件（#874）、AArch64修复（#887）、以及eBPF增强（#888）。

进入训练营后期，我独立完成了三架构eBPF JIT编译器的设计与实现，并在最后阶段进行了一系列工程质量改进，包括消除硬编码、替换panic!/todo!、实现perf event fd的读写轮询非阻塞支持、注册新的bpf helper函数等。

---

## 二、训练营其他阶段工作

在进入Stage 7专业阶段之前，经过训练营早期任务的基础训练，完成了Rust异步编程、协程并发模型等核心概念的实践，随后直接投入到tgOSKits仓库的StarryOS内核开发中。

我的早期工作主要聚焦于系统调用和测试框架的完善，为后续的专业阶段工作奠定了扎实的内核开发基础。

---

## 三、主要工作

整体工作按五条主线展开，另有第六阶段的质量改进工作正在进行中。以下各章节的代码位置均标注了具体的合并PR编号和关键文件路径。

### 主线一：eBPF子系统的全栈构建

#### 3.1.1 eBPF核心子系统（#848, MERGED）

eBPF子系统的核心实现覆盖了BPF Map管理、程序加载与验证、Helper函数注册、perf event集成。整个子系统实现了`bpf(2)`系统调用的9条主要命令：

| 命令 | 功能 |
|---|---|
| BPF_MAP_CREATE | 创建Map |
| BPF_PROG_LOAD | 加载BPF程序 |
| BPF_RAW_TRACEPOINT_OPEN | 打开raw tracepoint |
| BPF_MAP_UPDATE_ELEM | 更新Map元素 |
| BPF_MAP_LOOKUP_ELEM | 查找Map元素 |
| BPF_MAP_DELETE_ELEM | 删除Map元素 |
| BPF_MAP_GET_NEXT_KEY | 遍历Map |
| BPF_MAP_FREEZE | 冻结Map |
| BPF_MAP_LOOKUP_AND_DELETE_ELEM | 原子查找删除 |

核心代码文件：
- `os/StarryOS/kernel/src/ebpf/mod.rs` (178行)：bpf(2)系统调用入口，9个命令调度，通过`kbpf_basic::bpf_cmd`解码，`BPF_HELPER_FUN_SET`存储helper函数表
- `os/StarryOS/kernel/src/ebpf/prog.rs` (108行)：`BpfProg`封装`EbpfPreProcessor`，`load_prog()`经过kbpf-basic verifier验证
- `os/StarryOS/kernel/src/ebpf/map.rs` (154行)：`BpfMap`封装`UnifiedMap<KernelRawMutex>`，支持poll(ringbuf) + mmap
- `os/StarryOS/kernel/src/ebpf/transform.rs` (302行)：`EbpfKernelAuxiliary`实现`KernelAuxiliaryOps`，桥接kbpf-basic到tgOSKits内核（内存/percpu/helper/时间/vmap等）
- `os/StarryOS/kernel/src/ebpf/bpf_insn.rs` (86行)：BPF指令常量定义
- `os/StarryOS/kernel/src/ebpf/error.rs` (19行)：BpfError→AxError转换

#### 3.1.2 perf_event子系统集成（#848, MERGED）

perf子系统提供了完整的`perf_event_open(2)`支持，覆盖4种事件类型：

| 类型 | 状态 | 备注 |
|---|---|---|
| PERF_TYPE_KPROBE | ✅ | 含kretprobe(config=1) |
| PERF_TYPE_SOFTWARE | ✅ | 软件事件，支持ringbuf mmap |
| PERF_TYPE_TRACEPOINT | ✅ | 通过id查找 |
| PERF_TYPE_UPROBE | ✅ | 支持uprobe |

核心代码文件（均在`os/StarryOS/kernel/src/perf/`下）：
- `mod.rs` (253行)：`perf_event_open(2)`调度器，支持4种类型，`PERF_FILE`表(fd→event弱引用)
- `bpf.rs` (330行)：`BpfPerfEventWrapper`(ringbuf + poll)，`OwnedEbpfVm`核心执行引擎，先尝试JIT编译再fallback到解释器
- `kprobe.rs` (208行)：kprobe/kretprobe/uprobe perf事件，`KprobePerfCallBack`包装`OwnedEbpfVm`
- `tracepoint.rs` (160行)：tracepoint perf事件，通过`TraceEventFunc`绑定BPF程序
- `raw_tracepoint.rs` (128行)：raw tracepoint via `bpf(BPF_RAW_TRACEPOINT_OPEN)`
- `uprobe.rs` (92行)：uprobe perf事件，解析ELF文件映射地址

#### 3.1.3 eBPF测试套件（#874, MERGED）

为验证eBPF子系统的正确性，实现了完整的用户态测试套件，位于`apps/starry/ebpf/`目录下，包含以下测试程序：

| 程序 | 功能 |
|---|---|
| `syscall_count` | kprobe on syscall，HashMap统计 |
| `profile` | kprobe profiling（全syscall频次图） |
| `mytrace` | tracepoint sys_enter_openat，读文件路径 |
| `sched_trace` | raw_tracepoint sched_switch，PerfEventArray输出 |
| `rawtp` | raw tracepoint demo |
| `kret` | kretprobe demo |
| `upb` / `upb2` | uprobe demo |

#### 3.1.4 eBPF增强（#888, MERGED）

在#848基础上进一步增强了eBPF子系统的能力，包括：deadlock修复、新map类型支持、verifier增强等。

### 主线二：kprobe/kretprobe内核探针（#847, MERGED）

kprobe是Linux内核最核心的动态追踪机制，允许在任意内核函数入口/出口处插入探针。完整实现包括：

核心代码文件：
- `os/StarryOS/kernel/src/kprobe.rs` (639行)：
  - `KernelKprobeOps`实现`KprobeAuxiliaryOps`：copy_memory、set_writeable、alloc/free_kernel/exec_memory、kretprobe instance管理
  - 4架构`trapframe_to_ptregs()` / `ptregs_write_back()`转换（x86_64、RISC-V 64、AArch64、LoongArch）
  - breakpoint/debug handler挂载
  - `KernelRawMutex = RawSpinNoIrq`作为锁类型

AArch64架构修复（#887, MERGED）：修复了aarch64架构下TrapFrame中SP寄存器的保存问题，确保kprobe在aarch64上能够正确获取函数调用栈上下文。代码位于`components/axcpu/src/arch/aarch64/trap.rs`。

### 主线三：LKM内核模块支持（#849, MERGED）

实现了Linux兼容的内核模块（LKM）加载机制，使StarryOS能够加载和运行`.ko`格式的内核模块。

核心代码文件：`os/StarryOS/kernel/src/kmod/mod.rs` (265行)
- `KmodHelper`实现`KernelModuleHelper`：vmalloc / resolve_symbol / flush_cache
- `init_module()`：加载.ko ELF，重定位，调用init函数，防止重复注册
- `delete_module()`：调用exit函数，释放内存
- `lwprintf-rs`用于printk支持

### 主线四：系统调用增强与性能优化

#### 3.4.1 select/poll/pselect6/ppoll测试套件

实现了深度系统调用测试覆盖：
- #563：select/poll用户态测试用例
- #679：select/poll/pselect6/ppoll 深度测试套件

#### 3.4.2 sys_msync + SQLite测试（#602）

实现了`sys_msync`系统调用并集成SQLite数据库测试，验证内存映射文件同步的正确性。

#### 3.4.3 SMP并行优化（#652）

实现了SMP并行优化与跨架构并发测试，显著提升了多核环境下的系统吞吐量。

#### 3.4.4 DRM/Weston显示系统（#667）

实现了DRM/KMS显示框架的基本支持，使StarryOS能够在QEMU中运行Weston合成器。

#### 3.4.5 axbacktrace重构（#655）

将axbacktrace模块从`static mut`重构为`UnsafeCell`，消除了潜在的未定义行为（UB）风险，提高了代码安全性。

### 主线五：eBPF JIT编译器（三架构手写）

这是我训练营期间最具挑战性的技术工作——从零实现了三个架构的eBPF字节码JIT（Just-In-Time）编译器。

#### 3.5.1 JIT框架设计

JIT编译器采用统一的两遍编译（Two-Pass）架构：

- **Pass 1（sizing）**：遍历BPF指令序列，仅计算每条指令生成的目标机器码长度，不实际生成代码
- **Pass 2（compile）**：再次遍历指令序列，生成实际机器码并写入`JitBuffer`

核心组件：
- `JitBuffer`：支持两遍编译的代码缓冲区
- `JitBackend` trait：定义8个emit方法（emit_alu、emit_jmp、emit_ld、emit_st等），供各架构后端实现
- `JitCompiler`：统一的编译入口，串联pass1_sizing + compile
- `try_jit_compile()`：公共入口函数，成功返回生成的函数指针，失败自动fallback到解释器

框架代码仅存在于`feat/ebpf-jit-*-*`分支中（未合入upstream/dev），核心文件：
- `os/StarryOS/kernel/src/ebpf/ebpf_jit/mod.rs` (352行)
- `os/StarryOS/kernel/src/ebpf/ebpf_jit/jit_x86_64.rs` (904行)
- `os/StarryOS/kernel/src/ebpf/ebpf_jit/jit_riscv64.rs` (~1311行)
- `os/StarryOS/kernel/src/ebpf/ebpf_jit/jit_aarch64.rs` (1102行)

#### 3.5.2 RISC-V 64 JIT

完整实现了RISC-V 64后端，BPF寄存器映射为：
- R0→A0, R1→A1, R2→A2, ..., R5→A5（参数/返回值寄存器）
- R6→S0, R7→S1, ..., R9→S4（callee-saved寄存器）
- R10→S5（栈帧指针）

支持全部BPF ALU/JMP/MEM操作码，包括div-by-zero运行时检查。代码约1311行。

#### 3.5.3 x86_64 JIT

完整实现了x86_64后端，BPF寄存器映射为：
- R0→RAX, R1→RDI, R2→RSI, R3→RDX, R4→RCX, R5→R8
- R10→RBP（帧指针）

支持全部BPF指令集，包含完整的CALL指令处理（helper函数调用），div-by-zero安全检查。代码约904行。

#### 3.5.4 AArch64 JIT

完整实现了AArch64后端，BPF寄存器映射为：
- R0→X0, R1→X1, ..., R5→X5（参数/返回值）
- R6→X19, R7→X20, ..., R9→X22（callee-saved）
- R10→X25（帧指针）

支持完整的A64指令编码，包括：算术运算（ADD/SUB/MUL/DIV/SDIV）、位操作（AND/OR/XOR/LSL/LSR/ASR）、分支（B/B.cond/CBZ/CBNZ/BLR/RET）、内存访问（LDR/STR with 变体+偏移+后索引）、NOP填充等。代码约1102行。

#### 3.5.5 JIT当前状态

三个JIT PR（#891/#892/#893）目前均处于CLOSED状态，代码完整存在于`feat/ebpf-jit-*-*`分支中但未合入upstream/dev。AArch64分支（`feat/ebpf-jit-3-aarch64`）基过旧（692 commits behind upstream/dev），需要重新适配。当前upstream/dev使用`rbpf::EbpfVmRaw::jit_compile()`作为JIT实现路径。

### 主线六：工程质量持续改进（Training Camp后期，进行中）

这一阶段的工作按照"小步快跑、聚焦单一改动"的原则，从初始14个小粒度PR合并为4个关联度更高的PR。

#### 3.6.1 消除魔术数字与硬编码常量 [#1412]

合并了以下4个PR的改动，涉及3个文件：

| 原始PR | 改动内容 | 关键代码位置 |
|---|---|---|
| PR-a | kprobe.rs添加`PROBE_CONFIG_ENTRY=0`/`PROBE_CONFIG_RETURN=1`常量 | `perf/kprobe.rs` |
| PR-d | 消除`BPF_JIT_MEM_PAGES=4`和`KRETPROBE_MAX_ACTIVE=10`硬编码 | `perf/bpf.rs`, `kprobe.rs` |
| PR-f | tracepoint模块消除4096硬编码、ebpf模块消除helper ID硬编码 | `ebpf/mod.rs`, tracepoint相关文件 |
| PR-g | 移除`vm.register_allowed_memory(0..u64::MAX)`，启用rbpf地址空间边界检查 | `perf/bpf.rs` |

核心改动：将嵌套`if val == 0 ... else if val == 1`重构为flat const-pattern match；定义`TRACE_RAW_PIPE_CAPACITY`/`TRACE_CMDLINE_CACHE_SIZE`/`BPF_FUNC_PROBE_READ=4`/`BPF_FUNC_PROBE_READ_KERNEL=113`等命名常量；启用rbpf的`check_mem`地址边界检查，防止恶意BPF程序读取任意内核内存。

#### 3.6.2 替换panic!/todo!与消除伪文件系统魔术数字 [#1413]

这是一个stacked PR（基于#1412），合并了5个原始PR的改动：

| 原始PR | 改动内容 | 关键代码位置 |
|---|---|---|
| PR-h | card1.rs未知DRM ioctl触发`panic!()`→返回`VfsError::OperationNotSupported` | `drivers/card1.rs` |
| PR-i | ldisc.rs非规范模式VTIME>0触发`todo!()`→文档注释说明VTIME定时器未实现 | `tty/ldisc.rs` |
| PR-j | pseudofs中loop/memtrack/card0消除魔术数字 | `pseudofs/dev/loop.rs`, `memtrack.rs`, `card0.rs` |
| PR-k | tmpfs statfs和tracepoint路径缓冲区消除魔术数字 | `fs/tmpfs.rs`, tracepoint相关文件 |
| PR-l | ELF loader `vec![0;4096]`→`vec![0;PAGE_SIZE_4K]` | `mm/loader.rs` |

两项panic修复的重要性：card1.rs中任何用户空间程序发送不支持的DRM ioctl即可导致内核崩溃；ldisc.rs中任何设置了VTIME的终端读取都导致内核panic。这些都是真实可触发的内核稳定性问题。

#### 3.6.3 perf event fd的read/poll/nonblock支持 [#1414]

合并了3个串行feature PR的改动：

| 原始PR | 改动内容 | 关键代码位置 |
|---|---|---|
| PR-b | `try_read_record`：从perf_event_mmap_page读取data_head/data_tail、处理环形缓冲区wrapping | `perf/bpf.rs` |
| PR-c | 将`PerfEvent::read`从轮询式非阻塞读重构为`block_on(poll_io(...))`阻塞模式 | `perf/bpf.rs`, `perf/mod.rs` |
| PR-e | 新增`AtomicBool`字段存储O_NONBLOCK状态，nonblocking模式下ringbuf为空立即返回EAGAIN | `perf/mod.rs` |

三项改动使perf event fd的行为与Linux语义一致：默认阻塞读取，通过`fcntl(O_NONBLOCK)`或`open(O_NONBLOCK)`可切换为非阻塞模式。

#### 3.6.4 注册bpf_get_current_pid_tgid和bpf_get_current_comm helper [#1411]

kbpf-basic crate未实现helper #14 (`bpf_get_current_pid_tgid`)和#16 (`bpf_get_current_comm`)。在StarryOS侧`init_ebpf()`中直接往mutable BTreeMap插入两个自定义helper函数：
- `bpf_get_current_pid_tgid`：使用`ax_task::current().as_thread()`获取pid/tid，返回`(tgid << 32) | tid`
- `bpf_get_current_comm`：拷贝当前任务的`name()`到eBPF verifier验证过的内核buffer，null填充不足部分

该PR曾被合并到过旧的基，出现CONFLICTING状态，后通过cherry-pick到C1分支(#1412)并解决冲突修复。

---

## 四、与同组同学及助教老师的协作

### 4.1 linfeng(Godones)助教老师的基础设施

Godones老师为本方向奠定了关键基础：

| PR | 内容 | 状态 |
|---|---|---|
| #673 | tracepoint基础设施和debugfs集成 | MERGED |
| #805 | kallsyms + kprobe + bpf stub | MERGED |
| #837 | 内核符号导出(kallsyms) | MERGED |
| #1192 | eBPF apps现代化，新增rawtp/upb2 demo | MERGED |
| #1208 | eBPF ringbuf mmap在LoongArch DMW上的支持 | MERGED |
| #1256 | BPF JIT内存对齐修复 | MERGED |
| #1279 | LoongArch DMW-backed kmods支持 | MERGED |

特别感谢Godones老师在#673、#805、#837等PR中为eBPF子系统搭建的tracepoint/kallsyms基础设施，这些是我后续eBPF全栈开发的前提。

### 4.2 LorenzLorentz同学的协作

LorenzLorentz同学与我在子课题3中协同开发，各自走了不同的技术路线并最终融合：

| PR | 内容 | 状态 |
|---|---|---|
| #850 | eBPF runtime (基于外部crate kbpf-basic+rbpf) | MERGED |
| #851 | LKM loader端口 | MERGED |
| #886 | eBPF userspace (aya) | MERGED |
| #1132 | eBPF demos (apps/starry/ebpf) | MERGED |

两条技术路线对比：
- **我的路线（#847/#848/#888）**：手写eBPF子系统，自实现map/prog/VM/helper/perf_event，仅依赖标准库
- **LorenzLorentz路线（#850）**：基于外部crate `kbpf-basic` + `rbpf`，复用社区成熟组件

最终通过#848的合并，两条路线融合为统一的eBPF执行框架，用户态程序可透明切换使用两种实现路径。

### 4.3 ZCShou老师相关工作条目

ZCShou老师在多个工作汇报PR中提及了与我的工作交叉的内容：
- #1192 (Godones+ZCShou)：Modernize eBPF apps and add rawtp/upb2 demos — 我此前提交的eBPF用户态测试程序在此PR中被进一步现代化
- #1095 (ZCShou)：wire qperf app runtime into Starry perf — 性能测试框架与我的perf子系统修改协同工作

---

## 五、量化成果

### 5.1 PR统计

| 类别 | 数量 |
|---|---|
| 已合并PR | 12 |
| 当前开放PR（CI中） | 4 |
| 历史关闭PR（含JIT、整合） | 16+ |

当前开放PR：
| PR | 标题 | 状态 |
|---|---|---|
| [#1411](https://github.com/rcore-os/tgoskits/pull/1411) | feat(starry-ebpf): register bpf helpers | CI中 |
| [#1412](https://github.com/rcore-os/tgoskits/pull/1412) | fix(starry): replace magic numbers in perf/ebpf/tracepoint | CI中 |
| [#1413](https://github.com/rcore-os/tgoskits/pull/1413) | fix(starry): replace panics/todos and magic numbers in pseudofs/mm | CI中(stacked on #1412) |
| [#1414](https://github.com/rcore-os/tgoskits/pull/1414) | feat(starry-perf): read, poll, O_NONBLOCK for perf event fd | CI中 |

### 5.2 代码量统计

| 维度 | 数据 |
|---|---|
| 已合入dev的commits | 364 |
| 新增代码行数 | 15000+ |
| 架构覆盖 | x86_64 / RISC-V 64 / AArch64 / LoongArch |
| JIT代码量 | RISC-V 64后端1311行 + x86_64后端904行 + AArch64后端1102行 = 3317行（含框架352行） |
| 测试程序 | 8个eBPF用户态测试程序 |

### 5.3 功能覆盖

已实现的eBPF功能在子课题中覆盖了最全面的技术栈：
- BPF Map所有核心类型（Array, Hash, PerCPU, RingBuf等）
- BPF Prog加载、验证、执行（含JIT）
- 6种Helper函数
- 4种perf_event类型
- kprobe/kretprobe/uprobe完整支持
- LKM内核模块加载/卸载
- 3架构手写JIT编译器

---

## 六、经验与教训

### 6.1 工程管理经验

**PR粒度控制**：训练营后期我实践了"小PR→合并为大PR"的迭代模式。初期14个小粒度PR各有独立分支和CI，但过于碎片化。通过与reviewer沟通后，我将关联度高的PR合并为4个：魔术数字类→#1412、panic/todo+伪文件系统类→#1413、perf feat→#1414、helper类→#1411。每个合并PR都有清晰的单一主题，便于review。

**Conventional Commits**：严格遵循`type(scope): description`格式，标题用英文、正文用中文。PR描述需要清晰说明：问题是什么、怎么解决的、为什么这样解决。

**CI验证**：保持与CI的良好配合，QEMU container测试约34分钟的超时为已知runner资源问题，与代码变更无关。fmt/sync-lint/spin-lint检查可快速验证代码风格。

### 6.2 技术经验

**JIT编译器的两遍Pass设计**：Pass 1仅计算代码长度（sizing），Pass 2生成实际代码。这种设计在不需要额外内存的前提下解决了前向跳转指令中偏移量计算的问题——第一遍确定每条指令和每个label的位置，第二遍才能正确填充跳转偏移。

**跨架构寄存器映射**：三个架构的BPF寄存器映射遵循统一原则：R0-R5映射到参数/返回值寄存器（充分利用调用约定），R6-R9映射到callee-saved寄存器（跨helper调用不丢失），R10映射到帧指针寄存器。这种一致性设计使JIT框架代码保持架构无关。

**eBPF子系统的安全边界**：在#1412中，我移除了`vm.register_allowed_memory(0..u64::MAX)`调用，启用了rbpf的地址空间边界检查。现代eBPF可观测性程序通过helper函数访问内存，无需直接加载任意地址——直接内存访问是安全漏洞而非功能特性。

**稳定性修复的优先级**：card1.rs中未知ioctl触发`panic!()`和ldisc.rs中VTIME触发`todo!()`——这些不是"未来需要完善的功能"，而是任何用户程序都能触发的内核崩溃。在添加新功能之前，消除已有代码中的崩溃路径是更高的优先级。

### 6.3 教训

**AArch64 JIT分支管理失误**：`feat/ebpf-jit-3-aarch64`分支的初始基选择不当，导致692个commits落后于upstream/dev。这使后续的rebase变得极为困难，需要在未来重新开分支、提取代码、适配当前版本。教训：长期开发分支应及时rebase到最新的上游主干。

**JIT代码未及时合入主线**：三个JIT PR（#891/#892/#893）虽然代码完整、已通过CI验证，但未能推进到最终合并。部分原因是项目后期时间紧迫，部分原因是review周期和上游技术路线选择（rbpf JIT vs 手写JIT）。这提醒我：技术方案的成功不仅取决于代码质量，也取决于与社区技术路线的兼容性和推进节奏。

---

## 七、后续方向

- AArch64 JIT重新适配：从upstream/dev新开分支，提取JIT文件，适配当前kbpf-basic+rbpf版本
- JIT回归测试集成到CI
- BTF支持（CO-RE兼容）
- LoongArch64 JIT（仅有的缺失架构）
- BPF_PROG_ATTACH/DETACH/LINK_CREATE通用attach基础设施

---

## 八、工作仓库与链接

| 资源 | 链接 |
|---|---|
| 主仓库（fork） | https://github.com/CN-TangLin/tgoskits |
| 上游仓库 | https://github.com/rcore-os/tgoskits |
| 训练营工作记录 | https://github.com/CN-TangLin/tgoskits/blob/dev/训练营总结报告-工作记录.md |
| 汇报Slide仓库 | （待补充） |
| Blog提交PR | （待提交） |

当前开放的4个PR链接：
- [#1411](https://github.com/rcore-os/tgoskits/pull/1411) feat(starry-ebpf): register bpf helpers
- [#1412](https://github.com/rcore-os/tgoskits/pull/1412) fix(starry): replace magic numbers in perf/ebpf/tracepoint
- [#1413](https://github.com/rcore-os/tgoskits/pull/1413) fix(starry): replace panics/todos and magic numbers in pseudofs/mm
- [#1414](https://github.com/rcore-os/tgoskits/pull/1414) feat(starry-perf): read, poll, O_NONBLOCK for perf event fd

已合并的12个PR：
- [#563](https://github.com/rcore-os/tgoskits/pull/563) select/poll用户态测试用例
- [#602](https://github.com/rcore-os/tgoskits/pull/602) sys_msync + SQLite测试
- [#652](https://github.com/rcore-os/tgoskits/pull/652) SMP并行优化
- [#655](https://github.com/rcore-os/tgoskits/pull/655) axbacktrace重构
- [#667](https://github.com/rcore-os/tgoskits/pull/667) DRM/Weston显示系统
- [#679](https://github.com/rcore-os/tgoskits/pull/679) select/poll/pselect6/ppoll测试套件
- [#847](https://github.com/rcore-os/tgoskits/pull/847) kprobe内核探针
- [#848](https://github.com/rcore-os/tgoskits/pull/848) eBPF子系统
- [#849](https://github.com/rcore-os/tgoskits/pull/849) LKM内核模块支持
- [#874](https://github.com/rcore-os/tgoskits/pull/874) eBPF高级测试
- [#887](https://github.com/rcore-os/tgoskits/pull/887) aarch64 kprobe SP修复
- [#888](https://github.com/rcore-os/tgoskits/pull/888) eBPF增强

---

## 总结

感谢操作系统训练营和向勇老师在整个项目阶段的指导。从最初学习异步编程，到深入参与StarryOS内核开发，再到独立实现eBPF JIT编译器，这段经历让我从一个只会读书的学生转变成了能解决实际问题的开发者。训练营不仅教会了我操作系统的理论知识，更重要的是建立了"刨根问底排bug、小步快跑推PR、严谨量化写报告"的工程方法论。

特别感谢linfeng(Godones)助教老师搭建的tracepoint/kallsyms基础设施，以及LorenzLorentz同学在eBPF方向的合作开发，没有你们的工作，eBPF子系统不可能达到今天的完成度。

<!-- more -->
