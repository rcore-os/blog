---
title: 2025春夏季开源操作系统训练营第三阶段总结报告
date: 2025-05-19 17:31:32
categories: [开源操作系统训练营]
tags:
  - author: loichyan
  - repo: https://github.com/LearningOS/2025s-arceos-loichyan
---

## 第二阶段总结

见 [2025spring-rust-based-os-comp-stage2-report-loichyan](./2025spring-rust-based-os-comp-stage2-report-loichyan.md)．

## 主要收获

### 抢占式内核任务

在[前文](./2025spring-rust-based-os-comp-stage2-report-loichyan.md)中，构思了一种单内核栈的思路．但如果需要实现抢占式内核任务，仅凭单个内核栈是无法做到的——当某个内核任务被打断，需要保存完整的上下文，包括整个执行栈．因此，需要在单内核栈的基础上，增加动态分配的内核栈[^1]．具体而言，

1. 每个任务启动时从内核栈池中领取一个内核栈；
2. 如果该任务正常结束，归还内核栈；
3. 否则，该内核任务被打断（通常是时间片耗尽），将内核栈与上下文一并保存．

这样便能按需使用多内核栈，以最大化利用单核栈带来的优势．

### Rust 无栈协程模型

在 Rust 的异步模型中，编译器将每个异步函数转换为一个状态机[^2]，从而避免了任务挂起时对执行栈的保存（虽然加重了编译器的负担）．因此，Rust 无栈协程模型天然地适用于单内核栈的系统：

- 多内核栈系统中，通过 IRQ[^3] (Interrupt ReQuest) 机制等待 I/O 操作时，可以主动放弃执行权从而挂起当前任务，此时需要保存整个执行栈；
- 而在单内核栈系统中，通过 IRQ 机制实现异步 I/O，`await` I/O 操作时，只需将当前任务加入 Executor 的等待队列即可．

### Thread-per-core 模型

在多核环境中，为了保证数据一致性，原子数据结构（如 `Arc`、`Atomic*` 等）和同步锁（如 `Mutex`、`RwLock` 等）是必不可少的．但除了文件系统读写等任务必须加锁以外，大部分任务都是在单核上处理的，此时对原子计数和同步原语的频繁读写就成了额外的负担．并且，主流异步运行时（如 Tokio、async-std 等）默认要求 `Future` 多线程安全，这使得编写异步函数没那么“愉快”，也是 Rust 异步体验被广为诟病的一点[^4]．Thread-per-core 模型[^5]便因此有了不少拥趸，例如 Glommio[^6] 是一个适用于 Linux 的 Thread-per-core 框架，它是以 io_uring[^7] 为基础构建的．

之所以 Tokio 等运行时要求 `Future` 多线程安全，是因为它们使用了工作窃取的调度算法[^8]，即在线程 A 创建的任务可能被线程 B “偷走”来减少线程空闲．Linux 的任务调度算法也使用了工作窃取[^9]．Thread-per-core 和工作窃取模型各有优劣[^5]：

- Thread-per-core 中，绝大部分数据结构都不必是线程安全的，避免了多线程同步带来的开销，同时也使得编写异步函数更为简便；
- Thread-per-core 中，任务基本上都是在单个 CPU 核心是执行的，减少了执行环境变更导致的高速缓存丢失；
- 工作窃取中，空闲线程从忙碌线程中窃取任务，从而使得各核心之间负载均衡，能最大化利用多核资源；
- 在实际应用场景中，通常不容易彻底区分 CPU 密集型和 I/O 密集型任务，因此工作窃取适用面更广泛．

此外，从 Glommio 的介绍[^6]中不难看出，它很大程度上依赖于各任务之间的相互协作，即理想情况下，任务需要周期地归还执行权，来使得权重更高的任务优先执行．并且，在 Thread-per-core 模型中，为了充分利用各核心的执行资源，需要将 CPU 密集型和 I/O 密集型任务细致地划分给不同的核心，这无疑给开发维护带来了额外的心智负担．从这个角度来看，Thread-per-core 和工作窃取又分别类似于内核的协作式任务调度[^10]和抢占式任务调度[^11]．前两者和后两者的不同之处在于：

- 内核的任务调度算法主要面向于用户任务，它们所需要的资源通常是未知的，并且都希望能独占资源；
- 而同一个应用程序中（内核本身也可以视为一个复杂的应用程序），各任务所需的资源通常有一个预期，因此，在理论上，通过最细致地划分可以让整个应用达到极致的性能．

不过，综合考量各方面因素，还是工作窃取更适用，也更容易实现 :)

### 总结

以上便是第三阶段的主要收获，接下来需要进一步研究 IRQ 机制与 Rust 异步的集成，以及 io_uring 模型的实现和应用，最终达成对 ArceOS 内核的异步化改造．

<!-- dprint-ignore-start -->
[^1]: <https://osdev.wiki/wiki/Thread>
[^2]: <https://rust-lang.github.io/async-book/04_pinning/01_chapter.html>
[^3]: <https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter9/2device-driver-3.html>
[^4]: <https://maciej.codes/2022-06-09-local-async.html>
[^5]: <https://without.boats/blog/thread-per-core/>
[^6]: <https://www.datadoghq.com/blog/engineering/introducing-glommio/>
[^7]: <https://en.wikipedia.org/wiki/Io_uring>
[^8]: <https://tokio.rs/blog/2019-10-scheduler>
[^9]: <https://www.kernel.org/doc/html/v6.1/scheduler/sched-domains.html>
[^10]: <https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/3multiprogramming.html>
[^11]: <https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/4time-sharing-system.html>
