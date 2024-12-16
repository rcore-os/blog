---
title: 2024-秋冬季开源操作系统训练营第一二阶段总结-wang.md
date: 2024-11-10 11:14:20
tags:
---


## 第一阶段总结

因为之前已经在学校里学习过Rust的内容，第一阶段更像是起到一个查缺补漏和复习的作用。通过完成Rustlings的100道练习题，对Rust生命周期、所有权机制、智能指针、移动语义等内容有了更深入的理解。


## 第二阶段总结
- lab3: 实现syscall: sys_get_time(), sys_task_info()
- lab4: 引入虚拟内存/分页机制，重新实现sys_get_time()和sys_task_info(), 实现mmap和munmap
- lab5: 将task抽象为process进程，实现sys_spawn()和stride调度算法
- lab6: 新增文件系统，可以将原来在内存中的数据持久化到硬盘上。 实现sys_linkat(), sys_unlinkat(), sys_stat()
- lab8: 引入thread。实现死锁检测，实现sys_enable_deadlock_detect()
通过完成5个操作系统的实验，对操作系统的基本原理有了更深入的理解。在实验过程中，我遇到了很多问题，比如在实验四中，我在实现文件系统时，由于对文件系统Inode/OSInode/DiskInode/File之间的关系和概念理解不够透彻，一开始写lab的时候确实是完全不知道该怎么做，也导致了一些错误。于是我认真阅读了实验手册，通过画图和总结，最终完成了lab。
lab1-3个人认为是相对简单的，几乎每一个的pattern都是先去某个struct添加一个新的field，然后在impl中对这个新的field进行一些需要的操作。这其中还可能涉及用户态与内核态之间的数据传递，比如在lab1中的sys_task_info()函数就涉及到内核态数据到用户态数据之间的传递。
总之，通过这次训练营，我对操作系统的原理有了更深入的理解，也对Rust的应用有了更多的实践经验。
