---
title: 2023开源操作系统训练营第二阶段总结报告-ybbybbybbybb
date: 2023-11-03 15:56:40
categories:
    - report
tags:
    - author:<ybbybbybbybbybb>
    - repo:<https://github.com/LearningOS/2023a-rcore-ybbybbybbybbybb>
---

# 2023秋冬季rCore训练营报告

# ch0 & ch1 & ch2

- 跟这 ch0 进行了一些环境配置，然后边看 ch1 边找着文档一起移除标准库依赖，构建用户态执行环境，构建裸机执行环境，并用 qemu 和 gdb 模拟和监测程序运行的状态，让我对什么是操作系统，操作系统内核运行的环境的有了一个较为深刻的理解。而阅读 ch2，令我理解了早期的操作系统是如何来处理程序的。



# ch3

- ch3 中我学习了多道程序的放置与加载，任务切换，如何管理多道程序。然后在练习中为了实现 sys_task_info 我在原本 TaskControlBlock 的基础上添加了 task_syscall_times 数组和 first_start_time 字段来记录获取 taskinfo 所需信息。在 syscall 中调用自己封装的 add_cuurent_task_syscall_times 来实现对 task_syscall_times 记录更新。而对于 first_start_time，我在程序第一次运行时更新来记录，使得在调用 sys_task_info 时能够准确获得程序的运行时长。

# ch4

- ch4 中我详细学习了虚拟内存与 SV39 多级页表机制。在练习中我重写了 sys_get_time，我利用 get_mut 封装了一个将当前任务指定地址usize大小的数据修改的函数，然后将Timeval分为两个指向值的指针传入函数进行修改，以修正ti指向的地址为虚拟地址的问题，并避免了两个值在两个不同虚拟地址的情况，而对与 sys_task_info 我借鉴了前面 sys_get_time 的写法，利用已有的 translated_byte_buffer 将结构体分片为 u8 数组进行取址修改。而对于要求实现 mmap 与 munmap，我先检查函数参数是否出错和指定虚拟页是否有映射，然后调用 insert_framed_area / shrink_to 来实现要求的功能（虽然我认为单纯使用 shrink_to 有点小问题）。
  
# ch5

- ch5 我学习了进程管理机制的实现。在练习中我将前面的功能全部移植了过来（虽然后来发现有些好像不用），对于 spawn 我参考了 fork(exec())，只是新建 TCB 时改为直接 TaskControlBlock::new(elf_data)，然后修改其中的 parent。对于 stride 调度算法，我在 TaskControlBlockInner 中添加 stride 与 pass 字段，set_prio 时 pass改为 BIG_STRIDE / prio。

# 总结

- 我跟着 rCore-Tutorial-Book-v3 3.6.0-alpha.1 文档进行了第二阶段的实验，感觉收获还是比较大的，就是环境配置等前置我感觉还是有些混乱，没有一个比较好的教程，希望可以添加一个。最后，感谢老师能供提供一个这么好的平台。 