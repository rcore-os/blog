---
layout: npm
title: 2024A-rcore-camp-stag2-moyigeek
date: 2024-11-11 15:18:24
mathjax: true
tags:
    - author:moyigeek
    - repo:https://github.com/LearningOS/2024a-rcore-moyihust
---

## moyigeek 的2024秋冬rcore训练营阶段二笔记
<!-- more -->

## lab1
在TCB中加入start_time和syscall_times字段，并在trap中更新syscall_times，在taskManager的run_first_task和run_next_task中维护start_time字段，最后在syscall中通过get_current_task_control_block实现返回task_info

## lab2
使用translated_byte_buffer来实现结构体完整性以完成sys_get_time 和 sys_task_info.然后完成申请内存的检查以及申请的释放。


## lab3
在本次实验中，我们将当前运行程序的处理从 `taskmanager` 中分离出来，交由 `processor` 处理，并使用修改后的接口完成 `ch3-4` 的系统调用。我们仿照 `exec` 和 `fork` 实现了 `spawn` 流程，并创建了一个新的地址空间。此外，我们在 PCB 中添加了 `priority` 和 `stride` 字段，并在选择时遍历选择 `stride` 最小的进程。

在这个实验中，认识了完整的PCB结构，了解了进程的创建和调度，了解了进程的调度算法，了解了进程的调度流程，了解了进程的调度接口。

{% asset_img PCB.png PCB %}

关于其中stride属性的溢出问题
可以看到由于溢出的出现，进程间stride的理论比较和实际比较结果出现了偏差。我们首先在理论上分析这个问题：令PASS_MAX为当前所有进程里最大的步进值。则我们可以证明如下结论：对每次Stride调度器的调度步骤中，有其最大的步进值STRIDE_MAX和最小的步进值STRIDE_MIN之差：

$STRIDE_{MAX} – STRIDE_{MIN} <= PASS_{MAX}$

在溢出情况下，P.pass_B 可能会变得很小，而 P.pass_A 仍然很大。
由于模运算的性质，(P.pass_B + MAX_VALUE) - P.pass_A 仍然是一个有效的差值。
因此，即使发生溢出，STRIDE_{MAX} - STRIDE_{MIN} <= PASS_{MAX} 仍然成立，因为 PASS_{MAX} 是所有进程中最大的步进值。


## lab4
在easy-fs中添加硬链接的功能，在inode中添加全局的nlink bitmap来保存链接的个数，由此实现sys_stat.通过在easy_fs的功能，在os中实现创建链接和删除链接的系统调用。

这章实验的复杂度较高，额外挂载了一个文件系统easy-file-system以及新增了虚拟文件系统的接口。实现这一章的重点在于理解磁盘管理的操作以及文件系统的架构，同时也要理解Rust如何实现以极低的耦合实现虚拟文件系统。
其中文件系统的结构如图：

{% asset_img file.jpg file_system %}

1. 磁盘块设备接口层：以块为单位对磁盘块设备进行读写的 trait 接口
`BlockDevice`
2. 块缓存层：在内存中缓存磁盘块的数据，避免频繁读写磁盘
`BlockCache`
3. 磁盘数据结构层：磁盘上的超级块、位图、索引节点、数据块、目录项等核心数据结构和相关处理
磁盘数据结构层的代码在 layout.rs 和 bitmap.rs 中。
4. 磁盘块管理器层：合并了上述核心数据结构和磁盘布局所形成的磁盘文件系统数据结构
5. 索引节点层：管理索引节点，实现了文件创建/文件打开/文件读写等成员函数


## lab5
实现了死锁检测，创建了 `DeadlockDetect` 结构体，并实现了银行家算法。在系统调用中初始化系统资源和进程资源，实现了资源的申请和释放，并实现了死锁的检测。在是实现中使用渐近的银行家算法在创建资源的时候初始化资源的数量，并在申请的时候检查是否会造成死锁。


## 总结
在这次的训练营中，我学到了很多关于操作系统的知识，包括进程管理，文件系统，内存管理，死锁检测等等。在这个过程中，我也学到了很多关于Rust的知识，包括Rust的内存管理，Rust的并发模型等等。这次训练营让我对操作系统有了更深的理解，也让我对Rust有了更深的理解。