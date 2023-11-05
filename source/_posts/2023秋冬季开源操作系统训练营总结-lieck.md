---
title: 2023秋冬季开源操作系统训练营总结-lieck
date: 2023-11-05 20:05:46
categories:
    - report
tags:
    - author: lieck
    - summerofcode2023
    - rcore-lab
---


# 023秋冬季开源操作系统训练营总结-lieck

在同学的推荐下，我报名参加了训练营。这次经历让我有了第一次通过代码来理解操作系统的感觉。在之前学校的课程中，我对操作系统的认识仅限于文字概念，如进程、页表和文件系统等。

在具体的实验过程中，因为是第一次编写这类 Lab，一开始感觉非常难，但是完成后巩固和掌握了很多 OS 的知识，并且在实践中得到了很大的收益。

## Lab1

Lab1 需要完善系统调用。

对于 `sys_task_info` 系统调用，我们在 TCP 添加相应字段处理即可。


可能存在精度问题，这里我使用了 `get_time_us` 计算时间。

```cpp
let us = get_time_us();
let sec = us / 1_000_000;
let usec = us % 1_000_000;
let t = (sec & 0xffff) * 1000 + usec / 1000;
```


## Lab2

这部分的内容中，为 Rcore 引入了虚拟内存。

因为 Rcore 中分为内核页表和用户态页表，因此对于`sys_task_info` 系统调用我们不能直接通过修改参数来完成传值。需要将其转换为物理地址，而内核页表中的虚拟地址和内核地址是对应的。


然后是实现 MMap，通过 VMA 实现。

> VMA 记录有关连续虚拟内存地址段信息。对每个 section ，都有一个 VMA 对象。
>
> 例如对于 memory mapped file，存在一个 VMA 与之对应，其中包含了文件信息等

mmap 收到范围和 `port` 后，判断是否冲突或参数错误，然后放入 VMA 数据结构中映射物理页。mummap 也是类似的操作。

在此实验中，测试数据稍弱，并没有要求实现 VMA 分裂的操作。


## Lab3

Lab3 需要实现优先级调度和 `spawn` 系统调用。

`spawn` 系统调用是 fork 和 exec 的结合。可以分为两部分：

1. 参考 fork 创建新的进程，但新进程执行的首个函数的调用 exec 的操作
2. fork 后的子进程执行的第一个操作，用于调用 `task.exec`


优先级调度较为简单，在 PCB 中维护 `stride` 和 `pass` 。

* 调用 `suspend_current_and_run_next` 时增加当前进程的 `stride`
* 调用 `fetch` 会选择下一个要运行的进程，找到当前 `stride` 最小的进程即可。

因为不要求性能，我们可以简单的遍历的选择当前 `stride` 的值。