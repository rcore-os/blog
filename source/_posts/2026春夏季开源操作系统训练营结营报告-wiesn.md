---
title: 2026 春夏季开源操作系统训练营结营报告-wiesn
date: 2026-06-21 15:00:00
categories:
    - summary
tags:
    - author:wiesn2333
---

## 摘要

本报告总结了我在 2026 春夏季开源操作系统训练营项目阶段的工作，从 Rust 语言基础和操作系统原理出发，经 rCore-Tutorial 内核实现、ArceOS 组件化改造，最终进入项目阶段。项目阶段的成果包括：三种并发模型的性能对比分析（协程吞吐率 17 req/s，较线程模型提升约 10%）、mini-tokio 异步运行时的渐进实现、Embassy 执行器的源码级分析，以及一套基于 StarryOS 的异步系统调用方案。其中异步系统调用是核心贡献——通过 Handler 回调与 Completion Queue 机制在内核中实现非阻塞 I/O，在 QEMU RISC-V 64 环境下 64 并发连接测试中，异步模型（~0.7s）相比多线程模型（~1.2s）性能提升约 40%。

---

## 1. 背景

### 1.1 训练营概况

[2026 春夏季开源操作系统训练营](https://opencamp.cn/os2edu/camp/2026spring)由泉城实验室、清华大学操作系统实验室主办，采用五阶段成长路径：

| 阶段 | 时间 | 内容 |
|------|------|------|
| 导学阶段 | 自学 | Rustlings、操作系统理论、Linux 工具 |
| 基础阶段 | 3/2 – 3/22 | Rust 系统编程、并发、no_std、页表、自旋锁 |
| 专业阶段 | 3/23 – 4/12 | rCore-Tutorial：RISC-V 上实现 Unix 内核 |
| 组件化先导 | 4/13 – 5/10 | ArceOS 组件化改造 |
| 项目阶段 | 5/11 – 6/21 | 异步操作系统与驱动 |

我选择的是项目三——**基于协程异步机制的操作系统/驱动**，向操作系统异步化方向探索。

### 1.2 动机

传统操作系统内核采用同步阻塞系统调用模型，在高并发 I/O 场景下存在以下局限：

- **线程开销大**：每请求一线程，栈内存 MB 级，上下文切换开销大
- **CPU 利用率低**：大量时间浪费在等待 I/O
- **资源受限环境受限**：边缘/嵌入式设备无法承载大量线程

项目三的目标是探索 Rust 异步机制在操作系统内核中的应用，为上述问题提供可行的解决路径。

---

## 2. 前期基础：从 Rust 到操作系统内核

### 2.1 Rust 语言与 OS 入门

导学阶段和基础阶段为后续工作打下两项核心基础：一是 Rust 语言的**所有权、生命周期和 trait 系统**，这些特性使得编写系统级代码时能够保证内存安全而无需垃圾回收；二是 OS 内核的**基本构件**——页表、自旋锁、上下文切换等，这些在后续的 rCore-Tutorial 中得到了实战应用。

### 2.2 rCore-Tutorial：RISC-V 内核实现

专业阶段基于 rCore-Tutorial 在 RISC-V 平台上从零实现了一个类 Unix 内核，涵盖批处理系统、多道程序与协作式调度、地址空间与虚拟内存管理、文件系统与块设备驱动。这一阶段的关键收获是深入理解了**操作系统内核的系统调用路径**——从用户态 `ecall` 到内核态处理再到返回用户态的完整流程，这是后续设计异步系统调用时必须掌握的基础。

### 2.3 ArceOS 组件化改造

项目先导阶段以 ArceOS（Unikernel）为平台，学习组件化操作系统的设计思想。主要工作包括 ArceOS 启动流程分析、虚拟化组件 `simple-hv` 练习题的完成，以及多个练习题目的代码与笔记整理。同时开始接触 Rust 异步编程，学习 Tokio 教程，为项目阶段做准备。

---

## 3. 用户态异步机制研究

项目阶段围绕异步机制进行了三个层次的渐进式研究：**性能认知**（对比实验）、**运行时构建**（mini-tokio）、**源码级理解**（Embassy）。

### 3.1 并发模型性能对比

基于进程、线程、协程三种模型，构建爬取 34 所高校官网首页的爬虫程序：

| 维度 | 进程（串行） | 线程（并行） | 协程（异步） |
|------|:----------:|:----------:|:----------:|
| 总耗时 | ~23 s | ~2.2 s | **~2.0 s** |
| 吞吐率 | 1.5 req/s | 15 req/s | **17 req/s** |
| 最大 RSS | 7.8 MB | 13.4 MB | 13.7 MB |
| User CPU | 0.13 s | 0.07 s | **0.05 s** |
| 上下文切换 | 3831 | 2582 | **1982** |

**发现**：并发 vs 串行是最大差异来源。协程在 34 并发量下相比线程优势尚不显著，但上下文切换更少、User CPU 更低，其真正优势在更高并发量下才会充分展现。

> 对应学习笔记：[concurrency-models.md](https://github.com/wiesn2333/2026s-asyncos-report/blob/main/src/content/articles/concurrency-models.md)

### 3.2 mini-tokio：异步运行时实现

为深入理解异步运行时的运作机制，分步骤实现了一个 mini-tokio 运行时：

1. **单线程 FIFO** — poll 驱动的基本事件循环
2. **Waker 集成** — Future 通过 Waker 通知运行时重新调度
3. **多线程 work-stealing** — 跨线程负载均衡
4. **多级优先级 + 时间片轮转** — 公平调度

**核心理解**：Future 本质是状态机，`.await` 点即状态转换点。运行时通过 `poll()` 驱动状态迁移，而 Waker 提供了从事件源到运行时的唤醒回调通道。

> 对应学习笔记：[user-thread-coroutine-analysis.md](https://github.com/wiesn2333/2026s-asyncos-report/blob/main/src/content/articles/user-thread-coroutine-analysis.md)

### 3.3 Embassy 执行器源码分析

以 `tick.rs` 为例，完整追踪了 Embassy Executor 的执行流：

```
#[task] 宏展开 → TaskPool 分配槽位 → Spawner 注入 RunQueue
→ Executor::poll() → dequeue_all() → TaskStorage::poll()
→ future.poll(cx) → Ready: despawn 释放槽位; Pending: 等 Waker
```

厘清三个关键角色的分工：

| 角色 | 职责 | 关键数据结构 |
|------|------|------------|
| **TaskPool** | 静态分配 `TaskStorage` 槽位，写入 Future | `[TaskStorage<F>; N]` |
| **Spawner** | 将 `TaskRef` 注入 RunQueue，唤醒执行器 | `TaskRef`, `TransferStack` |
| **Executor** | 轮询 RunQueue，调用 `poll_fn` | `RunQueue`, `Signal` |

> 对应学习笔记：[embassy-executor-analysis.md](https://github.com/wiesn2333/2026s-asyncos-report/blob/main/src/content/articles/embassy-executor-analysis.md)

---

## 4. 异步系统调用设计

在理解了用户态异步机制后，进入核心工作：在 StarryOS 上设计并实现内核级的异步系统调用。

### 4.1 问题分析

传统阻塞系统调用的性能瓶颈在于：**线程被阻塞时，内核需要保存/恢复线程上下文，且线程在此期间无法执行任何其他工作**。异步系统调用的核心思路是：将阻塞操作放置到内核 I/O 线程，用户线程发起请求后立即返回，待 I/O 完成时通过回调机制通知。

### 4.2 架构设计

系统分为用户空间和内核空间两层。用户空间中运行着多个任务（Task A、Task B 等），每个任务维护一个由内核管理的 Completion Queue（CQ），以及一个用户定义的 Handler 回调函数。内核空间中运行着一个专用的 I/O 线程，负责维护 I/O 请求队列并执行真实的阻塞 I/O 操作。用户任务通过 ecall 陷入内核提交 I/O 请求，请求被加入 I/O 线程的队列后立即返回；I/O 完成时，结果通过 CQ 回传到用户空间，由 Handler 处理。

### 4.3 核心机制

**Handler 回调**。用户程序通过专用系统调用注册回调函数：

```c
sys_async_setup(void (*handler)(u64 userdata, i64 result));
```

Handler 在用户态执行，通过 `userdata` 区分不同请求，`result` 携带操作结果。

**Completion Queue**。每个用户线程维护一个内核管理的 CQ，生产者是内核 I/O 线程，消费者是用户 handler。CQ 解决了多个请求同时完成时的回调顺序与遗漏问题。

**请求路径**（无阻塞）：

```
用户线程 ecall → 内核校验参数
  → 合法 → 加入 I/O 线程队列，返回 0
  → 不合法 → 同步返回负错误码
```

**完成路径**（异步通知）：

```
I/O 线程执行 I/O → (userdata, result) 写入 CQ
  → 用户线程下次陷入内核
    → 返回用户态前检查 CQ
      → 非空：修改寄存器，优先执行 handler
      → 空：正常返回
```

Handler 执行时机选在**用户线程从内核态返回用户态之前**，避免额外的上下文切换。

### 4.4 接口设计

实现了四个异步系统调用，均遵循**二分语义**（参数合法即提交成功，不等待 I/O 完成）：

#### 异步系统调用接口

| 接口 | 功能 | 返回值语义 |
|------|------|-----------|
| `async_setup(handler)` | 注册 Handler 回调函数 | 0=成功 |
| `async_connect(fd, addr, addrlen, userdata)` | 非阻塞 connect | 0=提交成功，负数=参数错误 |
| `async_write(fd, buf, count, offset, userdata)` | 非阻塞 pwrite | 同左 |
| `async_read(fd, buf, count, offset, userdata)` | 非阻塞 pread | 同左 |

每个接口比传统版本多一个 `userdata: u64` 参数用于请求追踪。

> 对应学习笔记：[async-syscall-design.md](https://github.com/wiesn2333/2026s-asyncos-report/blob/main/src/content/articles/async-syscall-design.md)

---

## 5. 性能评估

### 5.1 测试配置

| 项目 | 配置 |
|------|------|
| 虚拟机 | QEMU RISC-V 64 |
| 操作系统 | StarryOS |
| 目标服务器 | 本地 Echo Server（Tokio 实现，0.5s 时延） |
| 测试任务 | 建立连接 → 发送数据 → 接收数据 |
| 并发数 | 64 |

### 5.2 结果

| 特性 | 多线程并发 | 单线程异步 |
|------|:--------:|:--------:|
| 工作方式 | 64 线程独立处理 | 64 状态机 + handler 驱动状态迁移 |
| 总耗时 | ~1.2 s | **~0.7 s** |
| 线程数 | 64+1 | 1 |

### 5.3 分析

异步模型性能提升，来自三个方面：

1. **消除线程切换开销**：64 线程间的内核级上下文切换被消除，改为用户态函数调用
2. **消除内核调度开销**：不需要调度器在 64 个线程间做时间片分配
3. **改善缓存局部性**：单线程的缓存命中率优于多线程交叉调度

---

## 6. 相关工作对比

### 6.1 与 Linux io_uring 对比

| 特性 | 本方案 | io_uring |
|------|--------|----------|
| 请求提交 | 系统调用参数 | 共享内存 SQ Ring |
| 完成通知 | 内核注入 handler | 共享内存 CQ Ring |
| 用户态轮询 | 不支持 | 支持（SQPOLL） |
| 平台 | RISC-V（StarryOS） | x86_64 / AArch64 |

本方案借鉴了 io_uring 的完成队列思想，但针对 StarryOS 的架构做了简化：用系统调用参数传递而非共享内存 Ring，以降低实现复杂度。

### 6.2 与用户态异步运行时对比

| 特性 | 本方案 | Tokio / Embassy |
|------|--------|----------------|
| 异步层 | 内核系统调用层 | 用户态运行时层 |
| 底层机制 | 内核 I/O 线程 | epoll / kqueue |
| 适用范围 | 所有进程 | 仅限应用层 |

两者互补：内核级异步机制可作为用户态运行时的底层支撑。

---

## 7. 结语

本次训练营经历了从 Rust 语言基础到操作系统内核实现，再到异步机制研究的完整过程。核心成果是一套基于 StarryOS 的异步系统调用方案，通过 Handler + CQ 架构在内核层面实现了非阻塞 I/O，性能数据验证了方案的可行性。

训练营虽然结束，但异步操作系统的探索还远未完成。异步 I/O 的完整解决方案需要从硬件中断处理、内核 I/O 栈、系统调用接口到用户态运行时的全链路协同设计，这仍是值得持续探索的方向。

---

**代码仓库**：
- [异步系统调用项目代码仓库](https://github.com/wiesn2333/tgoskits/tree/feat/async-read-write)
