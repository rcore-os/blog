---
title: 2025春夏季开源操作系统训练营第三阶段总结报告-hxingjie
date: 2025-4-21 19:20:32
categories:
    - summary report
tags:
    - author:hxingjie
    - repo:https://github.com/LearningOS/2025s-arceos-hxingjie

---


## 一、前言

在过去两周，我学习了Unikernel, Monolithic Kernel, Hypervisor三种内核架构。经过学习，我对组件化操作系统有了初步的认识和掌握。以下是我对这两周学习过程的总结。




## 二、学习内容

1. Unikernel

学习了Unikernel的基础与框架，包括如何从汇编代码进入到rust代码再进入到内核，并通过axhal -> axruntime -> arceos_api -> axstd 实现控制台的打印输出。

接下来引入了动态内存分配组件，以支持Rust Collections类型。通过引入axalloc模块，实现对内存的管理，并学习了动态内存分配的相关算法。通过这部分的学习，让我理解了rCore中为什么到后面的章节就可以使用Vec等集合类型。

之后引入任务数据结构并构建了通用调度框架，实现了抢占式调度。并实现了文件系统的初始化和文件操作。

实践作业：

实现带颜色的打印输出，理清控制台的打印输出的调用链即可， 可以在不同层次的组件上修改。

手写HashMap，我使用拉链法实现哈希表，并通过引入axhal提供的随机数增强鲁棒性。

实现bump分配算法，根据代码框架，实现EarlyAllocator的初始化和分配函数。

实现rename，首先是需要追踪是如何使用axfs_ramfa的，通过调试，可以发现底层实现是在DirNode，并且源数据结构其实就是btreemap，具体操作并不复杂。



2.Monolithic Kernel

在unikernel的基础上，引入用户态、系统调用等即可完成到宏内核的跨越，这一部分的学习让我更深刻的理解了组件化的优势，扩展task属性实现宏内核的进程管理以及分离调度属性和资源属性的策略更是让我眼前一亮。

实践作业：

实现sys_mmap系统调用，先使用fd读取源文件的内容，分配所需的内存空间，再查找用户态的页表得到相应的物理地址，将源文件内容写入即可。



3.Hypervisor

引入RISC-V H扩展，使原来的S态增强为HS态，并加入了VS态和VU态，通过对特权寄存器的修改，即可跨越到Hypervisor。

主要学习了VM-EXIT，由于Guest不存在M态，所以超出当前特权态的处理能力时会经历 VU -> VS -> (H)S -> M 的过程，本部分的作业也是和 VM-EXIT相关的，通过修改 vmexit_handler 函数以完成作业的要求。
