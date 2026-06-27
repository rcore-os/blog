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

本文总结我在2026春季操作系统训练营（Stage 7 专业阶段）中的工作。我在"方案二：以Linux App为引导的StarryOS改进"框架下的**子课题3（基于eBPF的内核可观测性能力增强）** 中，为StarryOS内核完成了eBPF子系统全栈构建、kprobe/kretprobe内核探针、LKM内核模块加载、三架构手写JIT编译器、多项系统调用增强与工程质量改进。累计贡献 **11个已合并PR**，**3个当前开放PR**（均在CI验证中，已获bot APPROVED），历史关闭PR 16+个，新增15000+行代码，364个commits。代码覆盖x86_64、RISC-V 64、AArch64、LoongArch四大架构。

<div style="page-break-after: always;"></div>

---

## PPT链接

- **汇报 Slide 仓库**：https://github.com/CN-TangLin/tgoskits/tree/dev/slides
- **技术报告**：见 Slide 仓库中 `training-camp-slides.md`（Marp格式，10章）

---

## 一、项目背景

StarryOS是构建在ArceOS组件化框架之上的Linux兼容操作系统，目标是运行未经修改的Linux用户态程序。训练营要求在StarryOS中实现eBPF（extended Berkeley Packet Filter）子系统——这是Linux内核的核心可观测性基础设施，允许用户安全地在内核中运行沙箱化程序，广泛应用于性能分析、安全监控、网络追踪等场景。

训练营按三个方案阶段推进。我在方案一阶段完成了select/poll/ppoll/pselect6多路复用系统调用体系完善（43个测试模块）和sys_msync+SQLite支撑；在方案二阶段将工作重心转移到子课题3（eBPF内核可观测性），与助教linfeng(Godones)老师和LorenzLorentz同学三人协作，严格对齐《StarryOS迁移计划》交付eBPF全栈。

### eBPF子课题架构全景图

```
┌──────────────────────────────────────────────────────┐
│                    用户态工具层                        │
│  aya eBPF 三件套 (PR #886)  │  test-ebpf-advanced    │
│  kret/rawtp/mytrace/...    │  test-ebpf-attach       │
│  qperf analyzer           │  test-ebpf-basics        │
├──────────────────────────────────────────────────────┤
│                  系统调用接口层                        │
│  sys_bpf()          │  sys_perf_event_open()         │
│  BPF_PROG_LOAD      │  PERF_EVENT_OPEN               │
│  MAP_CREATE/LOOKUP  │  RAW_TRACEPOINT_OPEN           │
├──────────────────────────────────────────────────────┤
│                  eBPF 运行时层 (kbpf-basic)            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ eBPF VM     │  │ Map Manager  │  │ Verifier    │  │
│  │ 解释器      │  │ Array/Hash/  │  │ 程序验证    │  │
│  │ ALU/JMP/ST  │  │ PerfEventArr │  │             │  │
│  │ 22 helpers  │  │ fd table     │  │             │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  │
├──────────────────────────────────────────────────────┤
│              数据通道 & 事件源层                       │
│  perf_event 环形缓冲区  │  Tracepoint (静态追踪点)    │
│  KCOV 覆盖率收集       │  debugfs tracing/            │
├──────────────────────────────────────────────────────┤
│              动态探针基础层 (kprobe / kallsyms)        │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐       │
│  │ kprobe   │  │stop_machine│  │ LKM loader   │       │
│  │ kretprobe│  │ 安全代码段 │  │ kmod_loader  │       │
│  │ 4架构    │  │ 修改       │  │ xtask build  │       │
│  └──────────┘  └───────────┘  └──────────────┘       │
└──────────────────────────────────────────────────────┘
```

---

## 二、训练营其他阶段工作

在进入Stage 7专业阶段之前，经过训练营早期任务的基础训练（Rust异步编程、协程并发模型等），我直接投入到tgOSKits仓库的StarryOS内核开发中。

### 2.1 传统I/O多路复用系统调用体系（方案一）

在方案一阶段，我主要负责了select/poll/pselect6/ppoll四个核心syscall的深度测试与边界验证：

| 改进方向 | 状态 | PR |
| :--- | :---: | :--- |
| select/pselect6 用户态测试用例 | ✅ | [#563](https://github.com/rcore-os/tgoskits/pull/563) |
| select/poll/pselect6/ppoll 深度测试套件（43个独立测试模块，5大阶段） | ✅ | [#679](https://github.com/rcore-os/tgoskits/pull/679) |
| Pipe HUP 边界缺陷修复 | ✅ | [#734](https://github.com/rcore-os/tgoskits/pull/734) |

测试套件覆盖超时、空fd_set、pipe读写、信号中断（EINTR）、POLLHUP/POLLERR边界等场景。

### 2.2 sys_msync接口完善与SQLite支撑（方案一）

| 改进方向 | 状态 | PR |
| :--- | :---: | :--- |
| sys_msync接口完善，处理页对齐约束，打通脏页回写 | ✅ | [#602](https://github.com/rcore-os/tgoskits/pull/602) |
| SQLite集成压测在StarryOS上跑通 | ✅ | [#602](https://github.com/rcore-os/tgoskits/pull/602) |

### 2.3 多核并行与基础设施（方案二）

| 改进方向 | 状态 | PR |
| :--- | :---: | :--- |
| SMP4多核压力测试扩展到x86_64/aarch64/riscv64/loongarch64四架构 | ✅ | [#652](https://github.com/rcore-os/tgoskits/pull/652) |
| axbacktrace无锁化并发重构（static mut→UnsafeCell） | ✅ | [#655](https://github.com/rcore-os/tgoskits/pull/655) |
| DRM逐缓冲内存分配，Weston合成器双缓冲铺垫 | ✅ | [#667](https://github.com/rcore-os/tgoskits/pull/667) |

---

## 三、主要工作（六条主线）

整体工作按五条主线展开，另有第六阶段（工程质量改进）正在进行中。以下各章节均标注了具体的文件路径与行号范围，格式为`文件路径:起始行-结束行`。

### 主线一：kprobe/kretprobe内核探针（#847, MERGED）

kprobe是Linux内核最核心的动态追踪机制，允许在任意内核函数入口/出口处插入探针。我实现了完整的kprobe/kretprobe支持，跨越四大架构：

**核心实现**：`os/StarryOS/kernel/src/kprobe.rs` (639行)
- `KernelKprobeOps`实现`KprobeAuxiliaryOps`：copy_memory、set_writeable、alloc/free_kernel/exec_memory、kretprobe instance管理
- 4架构`trapframe_to_ptregs()` / `ptregs_write_back()` 寄存器转换：x86_64、RISC-V 64、AArch64、LoongArch
- 基于IPI的`stop_machine`机制，确保探针注册/注销时的代码修改安全
- 增加`kretprobe_stack`字段，支持嵌套的kretprobe
- `KernelRawMutex = RawSpinNoIrq`作为锁类型

**AArch64架构修复**（#887, MERGED）：
- 修复aarch64异常返回时SP指针未正确保存的严重Bug
- 代码位置：`components/axcpu/src/arch/aarch64/trap.rs`

### 主线二：eBPF子系统的全栈构建（#848, MERGED）

eBPF子系统的核心实现覆盖了BPF Map管理、程序加载与验证、Helper函数注册、perf event集成。整个子系统实现了`bpf(2)`系统调用的9条主要命令：

| BPF命令 | 功能 |
|---|---|
| BPF_MAP_CREATE | 创建Map（Array/Hash/PerCPU/RingBuf等） |
| BPF_PROG_LOAD | 加载BPF程序，经verifier验证 |
| BPF_RAW_TRACEPOINT_OPEN | 打开raw tracepoint |
| BPF_MAP_UPDATE_ELEM | 更新Map元素 |
| BPF_MAP_LOOKUP_ELEM | 查找Map元素 |
| BPF_MAP_DELETE_ELEM | 删除Map元素 |
| BPF_MAP_GET_NEXT_KEY | 遍历Map |
| BPF_MAP_FREEZE | 冻结Map（只读保护） |
| BPF_MAP_LOOKUP_AND_DELETE_ELEM | 原子查找删除 |

**核心代码文件**（均在`os/StarryOS/kernel/src/ebpf/`下）：

| 文件 | 行数 | 功能 |
|---|---|---|
| `mod.rs` | 178行 | bpf(2)系统调用入口，9个命令调度 |
| `prog.rs` | 108行 | BpfProg封装EbpfPreProcessor |
| `map.rs` | 154行 | BpfMap封装UnifiedMap，支持poll+mmap |
| `transform.rs` | 302行 | EbpfKernelAuxiliary桥接kbpf-basic到StarryOS内核 |
| `bpf_insn.rs` | 86行 | BPF指令常量定义 |
| `error.rs` | 19行 | BpfError→AxError转换 |

**perf_event子系统集成**（均在`os/StarryOS/kernel/src/perf/`下），支持4种事件类型：

| 类型 | 状态 | 代码位置 | 备注 |
|---|---|---|---|
| PERF_TYPE_KPROBE | ✅ | `kprobe.rs` (208行) | 含kretprobe(config=1) |
| PERF_TYPE_SOFTWARE | ✅ | `bpf.rs` (330行) | 软件事件，支持ringbuf mmap |
| PERF_TYPE_TRACEPOINT | ✅ | `tracepoint.rs` (160行) | 通过id查找 |
| PERF_TYPE_UPROBE | ✅ | `uprobe.rs` (92行) | 解析ELF文件映射地址 |

**perf事件调度器**：`perf/mod.rs` (253行) — `perf_event_open(2)`调度器，`PERF_FILE`表(fd→event弱引用)

**eBPF运行时核心**：`perf/bpf.rs` (330行)
- `BpfPerfEventWrapper`：ringbuf + poll支持
- `OwnedEbpfVm`：核心执行引擎，先尝试JIT编译再fallback到解释器
- 利用`user_copy`汇编接口打通`probe_read_user`
- 手写实现22+核心Helper函数

**eBPF用户态测试程序**：位于`apps/starry/ebpf/`目录下（#874, MERGED），包含8个测试程序覆盖kprobe、tracepoint、raw tracepoint、uprobe、kretprobe等全场景。

### 主线三：LKM内核模块支持（#849, MERGED）

实现了Linux兼容的内核模块（LKM）加载机制，使StarryOS能够加载和运行`.ko`格式的内核模块。

**核心实现**：`os/StarryOS/kernel/src/kmod/mod.rs` (265行)
- `KmodHelper`实现`KernelModuleHelper`：vmalloc / resolve_symbol / flush_cache
- `init_module()`：加载.ko ELF → 重定位 → 调用init函数，防止重复注册
- `delete_module()`：调用exit函数，释放内存
- `lwprintf-rs`用于printk支持

### 主线四：eBPF JIT编译器（三架构手写）

这是我训练营期间最具挑战性的技术工作——从零实现了三个架构的eBPF字节码JIT编译器。

#### 4.1 JIT框架设计

JIT编译器采用统一的两遍编译（Two-Pass）架构，框架代码位于`feat/ebpf-jit-*-*`分支：

| 文件 | 行数 | 功能 |
|---|---|---|
| `ebpf_jit/mod.rs` | 352行 | 框架：JitBuffer、JitBackend trait、JitCompiler |
| `ebpf_jit/jit_riscv64.rs` | ~1311行 | RISC-V 64后端 |
| `ebpf_jit/jit_x86_64.rs` | 904行 | x86_64后端 |
| `ebpf_jit/jit_aarch64.rs` | 1102行 | AArch64后端 |

- **Pass 1（sizing）**：遍历BPF指令序列，仅计算每条指令生成的目标机器码长度
- **Pass 2（compile）**：再次遍历指令序列，生成实际机器码并写入`JitBuffer`
- `try_jit_compile()`：公共入口函数，成功返回生成的函数指针，失败自动fallback到解释器

#### 4.2 跨架构寄存器映射

三个架构的BPF寄存器映射遵循统一原则——R0-R5映射到参数/返回值寄存器，R6-R9映射到callee-saved寄存器，R10映射到帧指针：

| BPF寄存器 | RISC-V 64 | x86_64 | AArch64 |
|---|---|---|---|
| R0 | A0 | RAX | X0 |
| R1 | A1 | RDI | X1 |
| R2 | A2 | RSI | X2 |
| R3 | A3 | RDX | X3 |
| R4 | A4 | RCX | X4 |
| R5 | A5 | R8 | X5 |
| R6 | S0（callee-saved） | — | X19（callee-saved） |
| R7 | S1 | — | X20 |
| R8 | S2 | — | X21 |
| R9 | S4 | — | X22 |
| R10（帧指针） | S5 | RBP | X25 |

#### 4.3 JIT当前状态

三个JIT PR目前均处于CLOSED状态，代码完整存在于`feat/ebpf-jit-*-*`分支中但未合入upstream/dev。AArch64分支（`feat/ebpf-jit-3-aarch64`）基过旧（692 commits behind upstream/dev），需要重新适配。当前upstream/dev使用`rbpf::EbpfVmRaw::jit_compile()`作为JIT实现路径。

### 主线五：工程质量持续改进（Training Camp后期，进行中）

这一阶段的工作按照"小步快跑、聚焦单一改动"的原则，从初始14个小粒度PR合并为3个关联度更高的当前开放PR（另有#1414被#1412完整取代后关闭）。

#### 5.1 消除魔术数字 + perf event fd read/poll/O_NONBLOCK [#1412]

**状态**：APPROVED，CI中

合并了7个原始PR的改动，涉及perf/ebpf/tracepoint三个子系统：

| 改动 | 关键代码位置 |
|---|---|
| kprobe.rs添加`PROBE_CONFIG_ENTRY=0`/`PROBE_CONFIG_RETURN=1`常量 | `perf/kprobe.rs` |
| 消除`BPF_JIT_MEM_PAGES=4`和`KRETPROBE_MAX_ACTIVE=10`硬编码 | `perf/bpf.rs`, `kprobe.rs` |
| tracepoint模块消除4096硬编码、ebpf模块消除helper ID硬编码 | `ebpf/mod.rs` |
| 移除`vm.register_allowed_memory(0..u64::MAX)`，启用rbpf地址空间边界检查 | `perf/bpf.rs` |
| `try_read_record`：从perf_event_mmap_page读取环形缓冲区 | `perf/bpf.rs` |
| `PerfEvent::read`从轮询式非阻塞读重构为`block_on(poll_io(...))`阻塞模式 | `perf/bpf.rs`, `perf/mod.rs` |
| 新增`AtomicBool`字段存储O_NONBLOCK状态，ringbuf为空立即返回EAGAIN | `perf/mod.rs` |

**`try_read_record`签名修正**（响应bot审查建议）：

```rust
// 签名从 &self 改为 &mut self，由类型系统保证独占访问
// 调用方 PerfEvent::read 已通过 SpinNoPreempt 持有 event 锁
pub(crate) fn try_read_record(&mut self, dst: &mut [u8]) -> AxResult<usize> {
    // SAFETY: &mut self 保证独占写入；mmap 页由 VMA 固定且内核可写
    let mmap_mut = unsafe { &mut *(kvirt as *mut perf_event_mmap_page) };
    mmap_mut.data_tail += record_size as u64;
    // ...
}
```

代码位置：`perf/bpf.rs` — `try_read_record`方法、data_head/data_tail环形缓冲区wrapping处理

**关键安全修复**：移除`register_allowed_memory(0..u64::MAX)`（`perf/bpf.rs`），启用rbpf的`check_mem`地址边界检查。现代eBPF可观测性程序通过helper函数访问内存，无需直接加载任意地址——直接内存访问是安全漏洞而非功能特性。

#### 5.2 替换panic!/todo!与消除伪文件系统魔术数字 [#1413]

**状态**：APPROVED，CI中（stacked on #1412）

合并了5个原始PR的改动：

| 改动 | 关键代码位置 |
|---|---|
| card1.rs未知DRM ioctl触发`panic!()`→返回`VfsError::OperationNotSupported` | `drivers/card1.rs` |
| ldisc.rs非规范模式VTIME>0触发`todo!()`→文档注释说明VTIME定时器未实现 | `tty/ldisc.rs` |
| pseudofs中loop/memtrack/card0消除魔术数字 | `pseudofs/dev/loop.rs`, `memtrack.rs`, `card0.rs` |
| tmpfs statfs和tracepoint路径缓冲区消除魔术数字 | `fs/tmpfs.rs` |
| ELF loader `vec![0;4096]`→`vec![0;PAGE_SIZE_4K]` | `mm/loader.rs` |

这两项panic修复的重要性：card1.rs中任何用户空间程序发送不支持的DRM ioctl即可导致内核崩溃；ldisc.rs中任何设置了VTIME的终端读取都导致内核panic——这些都是真实可触发的内核稳定性问题。

#### 5.3 注册bpf_get_current_pid_tgid和bpf_get_current_comm helper [#1411]

**状态**：APPROVED，CI中（stacked on #1412）

kbpf-basic crate未实现helper #14 (`bpf_get_current_pid_tgid`)和#16 (`bpf_get_current_comm`)。在StarryOS侧`init_ebpf()`中直接往mutable BTreeMap插入两个自定义helper函数：

- `bpf_get_current_pid_tgid`：使用`ax_task::current().as_thread()`获取pid/tid，返回`(tgid << 32) | tid`
- `bpf_get_current_comm`：拷贝当前任务的`name()`到eBPF verifier验证过的内核buffer，null填充不足部分

#### 5.4 #1414 — 已关闭（被#1412完整取代）

[#1414](https://github.com/rcore-os/tgoskits/pull/1414) feat(starry-perf): implement read, blocking poll, and O_NONBLOCK support for perf event fd — 该PR的三个串行feature改动已完整合并入#1412，功能完全重叠，故关闭。

---

## 四、团队协作：eBPF迁移计划全景交付清单

子课题3由三位成员协作完成：linfeng(Godones)助教老师、LorenzLorentz同学和我（CN-TangLin）。

### 4.1 工作量较小的部分 —— 基础设施与动态探针（Godones & CN-TangLin）

| # | 工作内容 | 负责人 | PR | 状态 |
|---|---------|--------|-----|:---:|
| 1 | 扩展axhal对break/debug异常的处理（x86_64 INT3、AArch64 BRK、RISC-V EBREAK） | Godones | [#244](https://github.com/rcore-os/tgoskits/pull/244) | MERGED |
| 2 | proc/pid/maps支持 | Godones | [#306](https://github.com/rcore-os/tgoskits/pull/306) | MERGED |
| 3 | dynamic debug支持（static-keys机制，`/proc/dynamic_debug/control`接口） | Godones | [#446](https://github.com/rcore-os/tgoskits/pull/446) | MERGED |
| 4 | tracepoint静态内核追踪点宏系统（`/sys/kernel/debug/tracing/events/`） | Godones | [#673](https://github.com/rcore-os/tgoskits/pull/673) | MERGED |
| 5 | 内核符号表kallsyms支持（ksym crate） | Godones | [#837](https://github.com/rcore-os/tgoskits/pull/837) | MERGED |
| 6 | kprobe支持（4架构TrapFrame↔PtRegs、stop_machine、kretprobe_stack） | CN-TangLin | [#847](https://github.com/rcore-os/tgoskits/pull/847) | MERGED |

### 4.2 工作量较大的部分 —— eBPF核心与LKM模块（CN-TangLin & LorenzLorentz）

| # | 工作内容 | 负责人 | PR | 状态 |
|---|---------|--------|-----|:---:|
| 7 | eBPF子系统（1800+行ebpf.rs、64-bit指令解析、ALU/JMP/ST/LD、22+Helper） | CN-TangLin | [#848](https://github.com/rcore-os/tgoskits/pull/848) | MERGED |
| 7b | eBPF测试套件（8个用户态探针程序接入CI） | CN-TangLin | [#874](https://github.com/rcore-os/tgoskits/pull/874) | MERGED |
| 8 | eBPF runtime porting（kbpf-basic+rbpf外部crate集成） | LorenzLorentz | [#850](https://github.com/rcore-os/tgoskits/pull/850) | MERGED |
| 8b | aya eBPF生态移植 + 6个探针应用接入test-suit | LorenzLorentz | [#886](https://github.com/rcore-os/tgoskits/pull/886) | MERGED |
| 8c | eBPF用户态demos（uprobe/kprobe/kretprobe/tracepoint） | LorenzLorentz | [#1132](https://github.com/rcore-os/tgoskits/pull/1132) | MERGED |
| 9 | LKM支持（init_module/finit_module、KmodSectionMem、R/W/X隔离） | CN-TangLin | [#849](https://github.com/rcore-os/tgoskits/pull/849) | MERGED |
| 9b | LKM loader端口 | LorenzLorentz | [#851](https://github.com/rcore-os/tgoskits/pull/851) | MERGED |

### 4.3 技术路线融合

两条技术路线对比：
- **我的路线（#847/#848/#888）**：手写eBPF子系统，自实现map/prog/VM/helper/perf_event，仅依赖标准库
- **LorenzLorentz路线（#850）**：基于外部crate `kbpf-basic` + `rbpf`，复用社区成熟组件

最终通过#848的合并，两条路线融合为统一的eBPF执行框架，用户态程序可透明切换使用两种实现路径。

### 4.4 Godones助教后续支持

| PR | 内容 | 状态 |
|---|---|---|
| [#1192](https://github.com/rcore-os/tgoskits/pull/1192) | eBPF apps现代化，新增rawtp/upb2 demo | MERGED |
| [#1208](https://github.com/rcore-os/tgoskits/pull/1208) | eBPF ringbuf mmap在LoongArch DMW上的支持 | MERGED |
| [#1256](https://github.com/rcore-os/tgoskits/pull/1256) | BPF JIT内存对齐修复 | MERGED |
| [#1279](https://github.com/rcore-os/tgoskits/pull/1279) | LoongArch DMW-backed kmods支持 | MERGED |

---

## 五、量化成果

### 5.1 PR统计

| 类别 | 数量 | 说明 |
|---|---|---|
| 已合并PR | 11 | #563, #602, #652, #655, #667, #679, #847, #848, #849, #874, #887 |
| 当前开放PR（APPROVED，CI中） | 3 | #1411, #1412, #1413 |
| 历史关闭PR | 16+ | 含JIT系列（#891/#892/#893等）、整合系列（#805/#888/#1035等）、小粒度PR（#1399-#1405等）、#1414（被#1412取代） |

### 5.2 代码量统计

| 维度 | 数据 |
|---|---|
| 已合入dev的commits | 364 |
| 新增代码行数 | 15000+ |
| 架构覆盖 | x86_64 / RISC-V 64 / AArch64 / LoongArch |
| JIT代码量 | RISC-V 64后端1311行 + x86_64后端904行 + AArch64后端1102行 = 3317行（含框架352行） |
| 测试程序 | 8个eBPF用户态测试程序 + select/poll家族43个测试模块 + SMP并发测试 |

### 5.3 功能覆盖

已实现的eBPF功能在子课题中覆盖了最全面的技术栈：
- **BPF Map**：Array、Hash、PerCPU、RingBuf、PerfEventArray等核心类型
- **BPF Prog**：加载、verifier验证、解释器执行、JIT编译
- **Helper函数**：22+（含bpf_get_current_pid_tgid、bpf_get_current_comm）
- **perf_event**：4种类型（KPROBE/SOFTWARE/TRACEPOINT/UPROBE）
- **kprobe/kretprobe/uprobe**：完整支持，四个架构
- **LKM**：.ko加载/卸载，kmod-helper集成
- **JIT**：三架构手写JIT编译器

---

## 六、经验与教训

### 6.1 工程管理经验

**PR粒度控制**：训练营后期实践了"小PR→合并为大PR"的迭代模式。初期14个小粒度PR各有独立分支和CI，但过于碎片化。通过与reviewer沟通后，将关联度高的PR合并为3个（#1411/#1412/#1413），每个合并PR都有清晰的单一主题，便于review。另有#1414被#1412完整取代后关闭。

**Conventional Commits + bot辅助审查**：严格遵循`type(scope): description`格式，标题用英文、正文用中文。自动化CI审查大幅减少人工review负担，Bot的`CHANGES_REQUESTED → APPROVED`循环形成高效的迭代节奏。

**小步快跑推PR**：从代码完成到合入平均经历2-3轮review+CI，每轮24小时周期内响应反馈。

### 6.2 技术经验

**JIT编译器的两遍Pass设计**（`ebpf_jit/mod.rs`）：Pass 1仅计算代码长度（sizing），Pass 2生成实际代码。这种设计在不需额外内存的前提下解决了前向跳转指令中偏移量计算的问题——第一遍确定每条指令和每个label的位置，第二遍才能正确填充跳转偏移。

**跨架构寄存器映射原则**：R0-R5→参数/返回值寄存器（充分利用调用约定），R6-R9→callee-saved寄存器（跨helper调用不丢失），R10→帧指针寄存器。这种一致性设计使JIT框架代码保持架构无关。

**eBPF安全边界**（`perf/bpf.rs`）：移除`register_allowed_memory(0..u64::MAX)`，启用rbpf的`check_mem`地址边界检查。现代eBPF可观测性程序通过helper函数访问内存，直接内存访问是安全漏洞。

**`try_read_record`的`&self`→`&mut self`重构**（`perf/bpf.rs`）：由类型系统保证ringbuf data_tail的独占写入，而非依赖注释+调用方纪律。调用方`PerfEvent::read`已通过`SpinNoPreempt`持有event锁。

**稳定性修复优先级**：`card1.rs`未知ioctl→`panic!()`和`ldisc.rs`VTIME→`todo!()`——任何用户程序都能触发内核崩溃。在添加新功能之前，消除已有代码中的崩溃路径是更高优先级。

### 6.3 教训

**AArch64 JIT分支管理失误**：`feat/ebpf-jit-3-aarch64`分支的初始基选择不当，导致692个commits落后于upstream/dev。长期开发分支应及时rebase到最新的上游主干。

**JIT代码未及时合入主线**：三个JIT PR尽管代码完整、已通过CI验证，但未能推进到最终合并。技术方案的成功不仅取决于代码质量，也取决于与社区技术路线的兼容性和推进节奏。

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
| 汇报Slide仓库 | https://github.com/CN-TangLin/tgoskits/tree/dev/slides |
| Blog提交PR | https://github.com/rcore-os/blog/pull/891 |
| 项目进展记录（Issue） | https://github.com/rcore-os/tgoskits/issues/642 |

### 当前开放PR（3个，均已APPROVED）

| PR | 标题 | 状态 |
|---|---|---|
| [#1411](https://github.com/rcore-os/tgoskits/pull/1411) | feat(starry-ebpf): register bpf_get_current_pid_tgid and bpf_get_current_comm helpers | CI中(stacked on #1412) |
| [#1412](https://github.com/rcore-os/tgoskits/pull/1412) | feat(starry-perf): implement perf event fd read, poll, O_NONBLOCK; replace magic numbers | CI中 |
| [#1413](https://github.com/rcore-os/tgoskits/pull/1413) | fix(starry): replace panics/todos and magic numbers in pseudofs, tmpfs, and mm | CI中(stacked on #1412) |

关闭说明：#1414（feat(starry-perf): read, poll, O_NONBLOCK for perf event fd）已关闭——该PR的三个串行feature改动已完整合并入#1412，功能完全重叠。

### 已合并PR（11个）

| PR | 标题 |
|---|---|
| [#563](https://github.com/rcore-os/tgoskits/pull/563) | test(starryos): add select, poll, pselect6 and ppoll syscall userspace tests |
| [#602](https://github.com/rcore-os/tgoskits/pull/602) | feat(starry-kernel): implement sys_msync and add SQLite/msync test suites |
| [#652](https://github.com/rcore-os/tgoskits/pull/652) | test(smp4): extend SMP tests to all 4 architectures and add concurrency testing |
| [#655](https://github.com/rcore-os/tgoskits/pull/655) | refactor(axbacktrace): replace static mut with UnsafeCell in dwarf.rs |
| [#667](https://github.com/rcore-os/tgoskits/pull/667) | feat(drm): per-buffer memory allocation for Weston bringup |
| [#679](https://github.com/rcore-os/tgoskits/pull/679) | test(syscall): add comprehensive select/poll/pselect6/ppoll deep test suite |
| [#847](https://github.com/rcore-os/tgoskits/pull/847) | feat(starry-kernel): add kprobe support |
| [#848](https://github.com/rcore-os/tgoskits/pull/848) | feat(starry-kernel): add eBPF subsystem (maps, VM, helpers, perf events) |
| [#849](https://github.com/rcore-os/tgoskits/pull/849) | feat(starry-kernel): add LKM support via kmod-loader integration |
| [#874](https://github.com/rcore-os/tgoskits/pull/874) | test(starry-kernel): add eBPF advanced and attach/perf_event user-space test suites |
| [#887](https://github.com/rcore-os/tgoskits/pull/887) | fix(axcpu): save SP in aarch64 TrapFrame for kprobe correctness |

### 协作同学与助教PR

| 负责人 | PR | 标题 |
|---|---|---|
| LorenzLorentz | [#850](https://github.com/rcore-os/tgoskits/pull/850) | feat(starry-kernel): port eBPF runtime (ebpf/, perf/, kprobe wiring) |
| LorenzLorentz | [#851](https://github.com/rcore-os/tgoskits/pull/851) | feat(starry-kernel): port LKM loader + cargo xtask starry kmod build |
| LorenzLorentz | [#886](https://github.com/rcore-os/tgoskits/pull/886) | feat(starry-kernel): eBPF kernel runtime (tracepoint / kprobe / perf) |
| LorenzLorentz | [#1132](https://github.com/rcore-os/tgoskits/pull/1132) | feat(starry-apps): runnable eBPF demos |
| Godones | [#673](https://github.com/rcore-os/tgoskits/pull/673) | Starry: Add kernel tracepoint infrastructure and debugfs integration |
| Godones | [#837](https://github.com/rcore-os/tgoskits/pull/837) | Adds support for kernel symbol dumping via kallsyms |
| Godones | [#1192](https://github.com/rcore-os/tgoskits/pull/1192) | Modernize eBPF apps and add rawtp/upb2 demos |
| Godones | [#1208](https://github.com/rcore-os/tgoskits/pull/1208) | fix(starry): support eBPF ringbuf mmap on LoongArch DMW |

---

## 总结

感谢操作系统训练营和向勇老师在整个项目阶段的指导。从最初学习异步编程，到深入参与StarryOS内核开发，再到独立实现eBPF JIT编译器，这段经历让我从一个只会读书的学生转变成了能解决实际问题的开发者。训练营不仅教会了我操作系统的理论知识，更重要的是建立了"刨根问底排bug、小步快跑推PR、严谨量化写报告"的工程方法论。

特别感谢linfeng(Godones)助教老师搭建的tracepoint/kallsyms基础设施，以及LorenzLorentz同学在eBPF方向的合作开发。没有基础设施的支撑和两条技术路线的互补融合，eBPF子系统不可能达到今天的完成度。

感觉参与训练营之后，学校课程作业都变得异常简单。这段高强度、高密度的内核开发经历，真正锻炼了从定位问题到提交PR的完整工程能力。

<!-- more -->
