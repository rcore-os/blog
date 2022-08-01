---
title: rcore第一阶段报告-Shl1015
date: 2022-08-01 12:28:07
categories:
    - report
tags:
    - author:Shl1015CS
    - summerofcode2022
    - rcore-lab
---

# 第一阶段报告

首先感谢活动主办方给了我们学习的机会和学习的资源，感谢助教一个月来的解答疑惑和帮助建立学习环境

<!-- more -->

## Rust的学习

rust语言学习起来十分困难，难度比较高，自学是通过《Rust语言圣经》这本书和Rustlings符合学的边学边看，遇到不会的看书再者看Rust沙龙的视频边看边学，(实际上写OS的时候也在翻书看学和练习)。Rust虽然难度高但是从性能上和从安全性上来讲都是很好，优势也很突出！

## RISC-V学习

《RISC-V手册一本开源指令集的指南》里面的第一、二、三、九章节，两天就可以看完，基本了解 RISC-V 的相关概念。而且RISC-V十分简洁化和模块化

## OS实验学习

### lab0

这两节课主要搭建了环境，熟悉了如何使用和了解了批处理操作系统

### lab1 多道程序与分时多任务

- 增加 start_time 和 syscall_times,并对其进行初始化,不然会报错
- 修改run_first_task 和 run_next_task
- 在sys_task_info 函数中将当前进程的 TaskInfo 赋给 ti.这样就可以完成和实现功能

### lab2 地址空间

- sys_get_time 和 sys_task_info 需要向用户程序传递指针，我们引入虚拟地址对应用户的地址空间，因为处于内核空间所以不能直接修改指针所指内容。
- 将程序对应的页表，将虚拟地址转化为物理地址，改变物理地址的内容
- mmap与munmap 实现，这两个都要判断传入参数是否合法。在判断已经被映射的页和无效的表项
-  PageTable.unmap() 函数销毁地址的映射.

### lab3 进程及进程管理

- 将之前写的sys_get_time、sys_task_info、sys_mmap、sys_munmap copy进来，在实现spawn 函数时需要用到fork()函数，这时候我们还要注意spawn 函数中进程基地址的问题
- 实现 stride 算法，需要对TaskControlBlockInner进行添加stride、pass、priority。在对sys_set_priority函数进行设置

### lab4 文件系统

- sys_linkat: 遍历寻找旧路径 inode number，再通过新路径，创建Direntry，写入到根
- sys unlinkat: 在root inode中设置 Direntry: empty，这样就完成了删除操作
- sys stat:需要进行地址交换，分析disk_node.type对stat中变量赋值

### lab5 并发

- 使用银行家算法实现检测死锁的功能。

## 感想

- rust语言博大精深，我一直抱着一个初学者的心态去学习，去探索其未知的知识
- 实验文档很完善(rcore-tutorial-2022S)需要学习的地方的写的地方很多
- 一步一步实现功能，在实验中改写之前的，不断添加功能的一步步学习的感觉很棒
- 希望一年多设置几次训练营，让更多的朋友加入进来
- 因为本身不是学习计算机的，在这一次机会中也尝试了写OS，尝试了做自己喜欢的事情，虽然过程很漫长！但是第一阶段完美结束我已经十分开心了
- 希望在结束考研时候也能加入到rCore和zCore社区中来，为社区尽一份力，在rust大家庭中相互学习相互进步！

