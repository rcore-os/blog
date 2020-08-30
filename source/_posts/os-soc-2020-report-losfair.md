---
title: losfair 的 rCore OS SoC 第一阶段总结报告
date: 2020-07-26 01:23:00
categories:
    - report
tags:
    - author:losfair
    - summerofcode2020
---

我是 [losfair / 云海Linvy / 周鹤洋 / Heyang Zhou](https://github.com/losfair).

感谢 rCore 组提供参与本次 OS SoC 的机会，感谢张汉东老师的推荐和陈渝老师的指导。
<!-- more -->
## 学习路径

由于先前有 Rust 语言的开发经验，也对 RISC-V 用户模式指令集有一点了解，因此直接开始按照 lab tutorials 的路径手写代码实现其所描述的 OS .

在实现过程中有时会遇到一些不熟悉的概念，通过查 RISC-V 特权指令集手册解决。

完全重新实现的部分为 Lab 0 - Lab 4 ，最后两章由于时间不够，选择用做实验题的方式学习。

## 完成的内容

- 手写代码从头实现 Lab 0-4 的内容（各特性实现方式与教程不完全相同）
- 完成 Lab 6 的实验题
- 基础的 SMP 支持
- 基于等待队列的 futex-like 同步互斥机制

## 各 Lab 实验报告

我先前有开发 x86-64 微内核的经历，因此这一部分会包含这些方面的对比：

- x86-64 vs RISC-V
- 宏内核 vs 微内核

### Lab 0

Lab 0 的内容是环境配置和项目初始化。与 x86-64 架构相比，感觉 RISC-V 的内核编译和前期启动流程要简单许多：不需要实现处理器模式的切换 (real mode -> long mode) ，所有代码均为 64 位，使用标准的 ELF 工具即可得到可加载的内核镜像；也不需要处理与 BIOS / UEFI / multiboot 等不同 bootloader 环境之间复杂的接口问题。

SBI 接口有点类似于 x86 的 BIOS 中断和 UEFI services ，但是它也提供 IPI 这种 OS 需要一直使用的功能，调用方式对开发者来说也似乎更友好一点。

### Lab 1

Lab 1 的内容是中断机制和中断处理。作为现代指令集架构，感觉 RISC-V 的中断机制有它应有的优雅。

时钟和时钟中断方面，与 x86 架构 PIC / APIC / `rdtsc` 等历史遗留的混乱相比，RISC-V 的 time 寄存器和 SBI set_timer 显得十分简单。

### Lab 2

Lab 2 的内容是内核堆和物理内存的动态分配。

我对这一章功能的实现方法与教程文档有一些差异：

1. 教程选择分开内核堆和其他物理页的物理内存范围，而在我的实现中物理页面直接从内核堆中动态分配。具体实现见 `memory/pool.rs: PagePool` 。
2. 关于内核堆的分配器，教程选择 `buddy_system_allocator` ，我的实现选用 [dlmalloc 的 Rust 移植](https://github.com/alexcrichton/dlmalloc-rs) 。为适配内核环境，我对 dlmalloc-rs [做了一些修改](https://github.com/losfair/dlmalloc-rs/tree/rcore-soc) 。

动态分配机制是我在实现 rCore-Tutorial OS 中发现的这个宏内核 OS 与微内核的第一个主要区别。内存分配器作为一种“策略” (policy) 而非“机制” (mechanism) 在许多微内核如 [seL4](https://github.com/seL4/seL4) 和我的 [FlatMk](https://github.com/losfair/FlatMk-v0) 中并不存在。但在宏内核中，由于内核数据结构的复杂性，分配器是必要的。

注意到 Rust 中需要堆分配的容器如 `Box` / `Vec` 等并不支持指定分配器。对于内核中的特定情形（如中断上下文等），若要使用动态内存，则有必要指定分配器。Rust 社区有关于这个问题的提案：https://github.com/rust-lang/wg-allocators/issues/12 .

### Lab 3

Lab 3 的教程描述了虚拟内存机制。页表的结构与 x86-64 没有太多差异，不过默认支持 1GB / 2MB huge pages 的设计很现代了。

### Lab 4

Lab 4 是关于进程、线程及其调度。本章是我花费最多时间的一章，实现中遇到的主要关键点是：

1. 安全地区分线程上下文和中断上下文
2. 高效的锁机制，当锁被占用时让出 CPU 时间而非自旋等待
3. 各种死锁的调试
4. SMP 支持

对于第一点，我的做法是利用 Rust 类型系统保证尽可能多的安全性。当进入线程上下文或中断上下文时，在这个上下文的入口构造一个 `ThreadToken` / `InterruptToken` (均为 ZST)，对上下文有要求的特定函数在参数中接受这两个 Token 之一，确保当前上下文与预期一致。

对于第二点，我实现了等待队列和类似于 Linux futex 的“等待地址-唤醒地址”机制，然后在这上面实现了 Mutex ，并写了一个测试。

第三点死锁的调试，似乎没有发现什么特别的技巧。类似于 https://github.com/BurtonQin/rust-lock-bug-detector 的静态分析器可能有帮助，但是这次没有试用。

在第四点 SMP 支持上，我实现了多核的启动和每核心上的线程调度，但是需要 IPI 的功能（线程迁移、跨核 Mutex 解锁唤醒等）还没有实现。

在做 Lab 4 的过程中，我发现 Rust 类型系统用以描述并行的部分似乎不足以完全表达内核所需的所有语义。Rust 类型系统表达并行的标记有 `Send` 和 `Sync` 。在通常的用户程序环境中，它们的语义是很清晰的：

- 满足 `Send` 的类型可以被任一线程独占使用。
- 满足 `Sync` 的类型可以被多个线程同时使用。

然而在内核环境中会遇到一些问题：

- 一个类型可在 CPU 核心间 `Send`/`Sync` 和可在不同软件线程间 `Send`/`Sync` 的语义是不同的
- 没有 trait 标识一个类型是否可被重入访问（异步中断安全性，类似于 Linux 用户态中的 async signal safety）

### Lab 5

由于时间限制，没有来得及自己实现 Lab 5 ，似乎也没有对应的实验题。于是采用自行学习相关概念 + 阅读代码的方式学习这一部分。

第一次接触设备树，初步感觉它比我之前用过的 ACPI 在启动阶段简单许多，不过在动态系统中的扩展性和灵活性等还未知。

### Lab 6

由于时间限制，Lab 6 的学习我选择用做实验题的方式完成。实验题 3-6 的代码位于 https://github.com/losfair/rCore-Tutorial/tree/lab6 .

> 附我的实验题 2 答案：
> 
> > 如果要让用户线程能够使用 Vec 等，需要做哪些工作？
> 
> 若要让用户线程能够使用 `Vec` 等需要动态分配的类型，则需用与内核类似的方法实现全局分配器。至于全局分配器的内存来源，初期可用全局静态数组支持之，后期则可实现类似 Linux `brk` / `mmap` 的机制。
>
> > 如果要让用户线程能够使用大于其栈大小的动态分配空间，需要做哪些工作？
>
> 看起来和前面是同一个问题？

## 关于 OS 设计的一些新想法

这个项目是我第一次为 RISC 架构实现 OS 。在了解 RISC-V 特权指令集的同时，也对各不同 ISA 间的共性和差异有了更多的理解。

写这个项目的时候有一些关于 OS 设计的新想法，在这里分享一下。

### 任务调度异步化

目前所有的主流 OS 中，线程切换均由软件完成。这导致任何原因的线程切换均须陷入特权软件这个“中间层”，引入了不小的开销。

但若采取硬件 / 软件协同设计的方法，是否有可能有这样一种设计：

- 增加“调度协处理器” ("Scheduling Coprocessor / SC")，其实质是实现了某个 RV64 子集的小核心
- 时钟中断发送到 SC 而非 SMP 核心上，由 SC 异步地决定各核心是否切换线程和要切换到的目标线程 Thread Control Block (TCB) 地址
- SMP 核心的线程切换由硬件处理（引入 TCB 地址寄存器和上下文保存 / 恢复等硬件模块），当满足以下任意一项条件时执行：

1. SC 向当前核心发送切换信号
2. 正在执行的代码产生同步异常
3. 接收到外部中断
4. 特殊的 IPC 指令被执行

### JIT 生成关键路径内核代码

注意到许多系统调用的代码路径上存在很多分支。这导致：

- 关键路径上的指令总数增多
- 分支预测器的压力增大
- 在某种运行时决定的前提条件下，存在大量无法到达的指令，可能占用不必要的指令缓存

可以考虑采用 JIT 机制对特定内核对象上的系统调用进行运行时特化。

搜索发现这个 idea 似乎已经被提出过多次：

- [It’s Time for a Modern Synthesis Kernel](https://blog.regehr.org/archives/1676)
- [Synthesis: An Efficient Implementation of Fundamental Operating System Services](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.29.4871&rep=rep1&type=pdf)

但是主流操作系统中还没有看到实现。

## 总结

第一阶段的学习中，除了对 RISC-V 架构本身了解的增加，通过不同架构看到 OS 领域的 "a bigger picture" 也是我重要的收获。

教程学习体验良好，感谢 rCore 组提供教程。

若有机会进入第二阶段的实习，希望能为 zCore 项目作出贡献。
