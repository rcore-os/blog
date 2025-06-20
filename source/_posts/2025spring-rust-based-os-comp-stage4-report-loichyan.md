---
title: 2025春夏季开源操作系统训练营第四阶段总结报告
date: 2025-06-19 11:12:13
categories: [开源操作系统训练营]
tags:
  - author: loichyan
  - repo: https://github.com/loichyan/openoscamp-2025s
---

## 前三阶段总结

- [前两阶段总结](./2025spring-rust-based-os-comp-stage2-report-loichyan.md)
- [第三阶段总结](./2025spring-rust-based-os-comp-stage3-report-loichyan.md)

## 主要收获

在第四阶段中，更多的时间留给了自由探索．虽然起初缺少具体的目标有些令人摸不着头脑，不过跟随老师的引导，也一步步确立了整个阶段的目标：基于 uring[^1] 机制实现异步系统调用．尽管最后只实现了基于 uring 的异步 IPC 机制，一路上走来也有许多收获．

### Rust 的异步机制

虽然有一些 Rust 异步编程经验，但尚未从更底层的角度了解过 Rust 的异步模型．在第一周中，通过动手实现一个简易的异步运行时 [local-executor](https://github.com/loichyan/openoscamp-2025s/tree/cffb2c29bc7eb522de66337093caf4255c9f7bca/local-executor)，认识到 Rust 的异步原语 `Future` 是如何与运行时交互的．以及深入到内存安全层面上，了解了 Rust 中如何通过 [`pin`](https://doc.rust-lang.org/core/pin/index.html) 语义来巧妙的保证自引用结构体的安全性．尽管这并不是一个完美的模型——几乎所有涉及到 `pin` 语义的数据结构和函数都需要 `unsafe` 代码，而这些 `unsafe` 代码所需的诸多安全性保证又着实有些令人头大．因为，Rust 提供了静态安全性，而编译器会基于这些安全保证进行比较“激进”的优化．所以，Rust 中的 `unsafe` 要比其他生来便“不安全”的语言更加不安全，对开发者的要求也更高．

在第三周的探索中，又了解到一个之前从未考虑过的问题——`Future` 的终止安全性[^2]．而这对于实现基于共享内存的异步通信机制来说尤其关键，稍有不慎就会引发难以察觉的漏洞．在后来着手实现异步通信机制的时候，又对这个问题进行了更深入的思考，并在现有方案的基础上提出了[另外几个可行的思路](https://github.com/loichyan/openoscamp-2025s/blob/cffb2c29bc7eb522de66337093caf4255c9f7bca/evering/src/resource.md)．

### 原子类型和内存排序

尽管曾了解过原子类型和内存排序相关的知识，但从未真正彻底搞懂过，直到在第二周的探索中发现了一本优秀的电子书 *Rust Atomics and Locks*[^3]．这本书从抽象的并发模型深入到具体的硬件细节，比较全面的介绍了几种原子操作和内存排序的设计初衷以及对应的汇编层面实现．结合这本书和自己的思考，又经过悉心整理最终形成了一篇比较详实的[学习笔记](https://github.com/loichyan/openoscamp-2025s/discussions/7)．尽管在实践时还不能完全掌握各种内存排序的选择，通过翻看笔记以及参考相似场景下现有项目的做法，也都能找到一个安全正确的选项．

### 基于 uring 的异步通信

经过两周的调查和学习，最终在第三周完成了基于 uring 的异步通信框架 [evering](https://github.com/loichyan/openoscamp-2025s/blob/cffb2c29bc7eb522de66337093caf4255c9f7bca/evering/src/lib.md)，同时利用 GitHub Pages 部署了它详细的[设计文档](https://loichyan.github.io/openoscamp-2025s/evering)．

evering 最重要的两个数据结构是用来管理消息队列的 `Uring` 和用来管理操作生命周期的 `Driver`．`Uring` 的实现借鉴了 io_uring 的做法[^4]，但结合 Rust 的特性做了一些简化．比如，io_uring 支持 `IOSQE_IO_LINK` 来要求响应侧顺序处理请求．而在 Rust 中，每个异步请求都被封装为 `Future`，故可以利用 `.await` 来在请求侧实现顺序请求．`Driver` 的实现则借鉴了 [tokio-uring](https://github.com/tokio-rs/tokio-uring) 和 [ringbahn](https://github.com/ringbahn/ringbahn)．但相比后两者，evering 提供了更灵活、通用的异步操作管理机制．

不过，目前 evering 相对简陋，仅支持 SPSC，因此请求侧或响应侧只能在单线程上使用．也许未来可以实现 MPSC 的队列，以便于更好的与现有的异步生态（比如 `tokio`）兼容．

### 基于 evering 的异步 IPC

经过三周的铺垫，第四周正式开始实践跨进程的异步通信．在第三周中，基于 evering 实现了简易的跨线程异步通信 [evering-threaded](https://github.com/loichyan/openoscamp-2025s/tree/cffb2c29bc7eb522de66337093caf4255c9f7bca/examples/evering-threaded)，而对跨进程来说，主要的难点就是内存的共享．好在 Linux 提供了易于使用的共享内存接口，基于 [shm_open(3)](https://man7.org/linux/man-pages/man3/shm_open.3.html)，[memfd_create(2)](https://man7.org/linux/man-pages/man2/memfd_create.2.html) 和 [mmap(2)](https://man7.org/linux/man-pages/man2/mmap.2.html) 可以轻松在不同进程之间建立共享内存区．而 [ftruncate(3p)](https://man7.org/linux/man-pages/man3/ftruncate.3p.html) 配合缺页延迟加载机制，使得程序启动后仅需一次初始化就能配置好可用的共享内存区间．不过，目前 evering 只能做到基础的“对拍式”的通信方式．而近期字节跳动开源的 [shmipc](https://github.com/cloudwego/shmipc-rs) 则是一个相对成熟、全面的异步通信框架，这对未来 evering 的改进提供了方向．

### 基于 evering 的异步系统调用

由于时间相对仓促，加之备研要占用大量的时间，遗憾的是，在第四阶段并没有完成最初的目标——实现基于 uring 的异步系统调用．与 `用户线程 <-> 用户线程` 的通信相比，`用户线程 <-> 内核线程` 的通信要额外处理内核任务的调度和用户进程的生命周期管理．即如何处理多个不同用户进程的请求，以及用户进程意外退出后对应内核任务的清理．而就共享内存而言，由于用户对内核单向透明，这看起来似乎比 IPC 的共享内存更容易解决．

### 用户态线程与协程的调度

去年的夏令营中，[embassy-preempt](https://github.com/KMSorSMS/embassy_preempt) 实现了内核中线程和协程的混合调度．那么用户态的协程能否被内核混合调度呢？在实现异步系统调用的前提下，当用户态线程由于内核尚未完成调用处理而让权（通过 [sched_yield(2)](https://man7.org/linux/man-pages/man2/sched_yield.2.html) 等系统调用）时，实际上，内核可以获知该线程应何时被唤醒．这就与 Rust 协程中的 `Waker` 机制非常相似，而用户态的让权又与 `.await` 很类似．基于这些，那么可以将一个实现异步系统调用的用户线程转换为一个用户协程．此后，内核就充当了这个协程的运行时和调度器的角色．

而相比用户态的线程，使用协程的一个显著优点是，对用户任务的唤醒实际上相当于执行一次 `Future::poll`．这意味着，当用户主动让权时，它不需要保存任何上下文——用户任务的唤醒本质上变成了函数调用，而主动让权表示该函数的返回．如此便能够进一步减少用户和内核切换的开销，以及系统中所需执行栈的数量．当然，当用户协程被抢占时，它便回退成了类似线程的有独立执行栈和上下文的存在．

### 总结

经过近两个月的学习，对操作系统和异步编程的许多方面都有了一些相对清晰的认知．非常感谢夏令营中各位老师的付出和历届同学的努力，学习的过程中让我切身的感受到操作系统发展到现在那段波澜壮阔的历史，以及在不断推陈出新的技术潮流中一点微不足道的参与感．尽管最后没能完成目标有些遗憾，不过，这也为将来再次参加夏令营留下了充足的理由 :P

<!-- dprint-ignore-start -->
[^1]: <https://en.wikipedia.org/wiki/Io_uring>
[^2]: <https://github.com/loichyan/openoscamp-2025s/discussions/6>
[^3]: <https://marabos.nl/atomics/>
[^4]: <https://kernel.dk/io_uring.pdf>
