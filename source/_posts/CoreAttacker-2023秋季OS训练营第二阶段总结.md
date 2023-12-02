---
title: CoreAttacker-2023秋季OS训练营第二阶段总结
date: 2023-11-12 21:12:08
categories:
    - report
tags:
    - author:CoreAttacker
    - repo:https://github.com/LearningOS/2023a-rcore-CoreAttacker
---

<!-- more -->
# 实验1
在实验1中，我们需要实现一个sys_task_info的系统调用，用于获取进程的信息。首先，我们要能够返回task运行的总时间，即第一次执行时间到当前时间的时间差，单位为ms，要实现这个功能，我在TaskControlBlock结构体中添加了我需要的开始时间戳，然后在第一次run该task的时候，记录开始时间戳，然后在sys_task_info中，通过current_task，找到对应的TaskControlBlock，然后计算时间差，返回即可。第二步，能够统计task的sys_call的调用次数，同上，我在TaskControlBlock结构体中添加了我需要的sys_call调用次数，然后在每次调用sys_call的时候，增加该系统调用的调用次数即trap_handler中抓取到系统调用的中断处理时处理即可，然后在sys_task_info中，通过current_task，找到对应的TaskControlBlock，然后返回即可。
# 实验2
实验2使用 Rust 的全局的动态内存分配器的实现 buddy_system_allocator 完成在内核中使用堆空间。 基于 RISC-V 硬件支持的 SV39 多级页表实现地址空间、物理页的分配与回收。开始划分内核地址空间及应用地址空间，实现应用程序不在需要关注应用起始地址及存放位置。相比上一章节的中断和系统调用处理过程添加了跳板页面，来避免在用户模式进入内核模式或内核模式退回用户模式时导致的地址不一致。
lab2 实验中 lab1 实验的相关内容需要重新实现，因为内存分页后在用户态传递进来的参数地址是虚拟地址，内核的访问地址映射和物理地址一致，无法通过虚拟地址对传递进来的参数赋值，所以需要将虚拟地址转换为物理地址，才能完成赋值。 sys_mmap 的实现参考系统中 insert_framed_area 的实现，添加逻辑校验给定的地址中是否包含已经映射的地址即可。sys_munmap 根据 sys_mmap 的实现反推即可实现。
# 实验3
在实验3中，ch3 中我学习了多道程序的放置与加载，任务切换，如何管理多道程序。然后在练习中为了实现 sys_task_info 我在原本 TaskControlBlock 的基础上添加了 task_syscall_times 数组和 first_start_time 字段来记录获取 taskinfo 所需信息。在 syscall 中调用自己封装的 add_cuurent_task_syscall_times 来实现对 task_syscall_times 记录更新。而对于 first_start_time，我在程序第一次运行时更新来记录，使得在调用 sys_task_info 时能够准确获得程序的运行时长。


# 感想
第一次接触结构如此清晰的OS课设，从历史演变的角度一步步搭建操作系统，每章的讲解图文并茂，将内核的功能与结构十分直观地剖析了出来。在遇到问题时老师们的讲解也帮助了我很多。