---
title: 2023开源操作系统训练营第二阶段总结报告-ChenDe
date: 2023-11-05 10:25:00
tags:
---



# 总体总结

​	参与本次开源操作系统训练营，我开始学习了rust语言,rust语言的官方文档做得很好，rust语言圣经也很方便学习。不得不说，rust语言的学习十分陡峭，虽然在一阶段写了rustlings，在第二阶段完成了前三个lab，但是我感觉我对rust的语言理解还在比较浅的层次，生命周期和所有权的概念还有待加强，有时候我感觉我写的rust代码并不够rust,还是停留以前其他的编程语言观念，实际写代码的过程都是编译器在教导我如何写代码，通过报错和查看文档来解决问题。然后rcore的文档十分完整，既有操作系统概念上的阐述与总结，又有实践层面上的代码解释。在学习的过程中，我又加深了对操作系统的理解。



# 二阶段实验总结

​	能够完成各个LAB的关键，是在于理解本章实现的操作系统的各个模块负责的功能，在通过阅读文档的解释，以及阅读代码进行理解后，才能知道要应该在哪个模块添加代码以实现功能。

## LAB 1

​	本章的操作系统是多道程序与分时操作系统，主要是需要理清多道程序是如何调度的。实验要求我们实验一个sys_taskinfo系统调用，来获取当前任务的任务信息。所以根据以前的操作系统知识，很自然的就能想到应该在进程控制块中加入我们需要收集的信息。我在实现的时候存在数据冗余问题，我先在TaskManagerInner中加入了一个任务信息Taskinfo字段，又加入了一个任务创建时间create_time字段，实际上Taskinfo.status和Taskinfo.time是多存的不必要的信息，因此我在后面的章节之后进行了重构，只加入了create_time和syscall_times两个字段。

## LAB 2

​	在本章节中，内核加入了虚拟空间机制，让进程的实现更加完整。实验要求我们移植get_time和taskinfo系统调用，并增加sys_mmap和sys_munmap系统调用。由于rcore的实现是双页表，内核页表和进程页表是分开的，进行系统调用的时候会切换页表，移植操作就需要进行地址转换拿到进程空间的地址来进行写入。内存映射的系统调用实现根据提示能做出来比较简单的实现便能通过测试，但是实际在取消内存映射的时候，可能需要对内存区域进行分割和合并的操作，例如可能会涉及内存管理算法什么的，似乎题目没做要求，我还没有实现，做完后续实验填坑吧。

## LAB 3

​	在本章节中，内核实现了进程机制，使得能够进程能够创建子进程(fork)、用新的程序覆盖已有程序内容(exec)。实验要求我们移植向前的代码并实现Spawn系统调用(fork+exec)，再实现stride调度算法。

- 在移植的过程中遇到的问题便是前两章记录进程创建时间是用get_time_ms函数，而在本章节中会因为精度不够而无法通过测试，改用get_time_us进行记录，返回任务存活时间时/1000便能得到结果。
- 实现spwan系统调用，主要就是参考fork和exec的实现，将两者有机的结合起来，不需要复制父进程的内存空间，转而从elf文件中获取。
- 实现stride调度算法：由于本章将TaskManager进行了拆分，调度实际是再manager中进行，根据提示，将原先的双端队列替换成小顶堆，在任务调出时对stride进行+pass，调度任务的时候每次从小顶堆中弹出stride值最小的进程便能实现。主要难点是BinaryHeap的使用。



## Lab 4&5 to be continue.
