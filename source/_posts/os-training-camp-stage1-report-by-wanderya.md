---
title: os-training-camp-stage1-report-by-wanderya
date: 2022-08-05 14:12:29
categories:
    - report
tags:
    - author:wanderya
    - summerofcode2022
    - rcore-lab
---

 # 2022 年开源操作系统训练营 -- wanderya

 本次总结为训练营第一阶段总结报告。我主要分为以下两个部分进行总结：

 + rust语言学习
 + rCore实验

 <!-- more -->

 ## Rust语言学习

我在rust语言学习的过程中主要通过阅读[**rust语言圣经**](https://course.rs/about-book.html)和[**Rust By Example**](https://doc.rust-lang.org/rust-by-example/)两本书进行基础知识和相关概念的学习。然后通过[rustlings](**https://github.com/rust-lang/rustlings**)和[rust on exercism](https://exercism.org/tracks/rust/concepts)进行实践练习。

更多相关参考:

+ Rust编程之道
+ [Rust宏小册](https://zjp-cn.github.io/tlborm/)
+ [The Rustonomicon](https://doc.rust-lang.org/nomicon/)
+ Rust系统编程
+ [Rust异步编程](https://rust-lang.github.io/async-book/)
+ ...

### Rust设计哲学

1. 内存安全
    
    + 类型安全
    + 所有权
    + 借用和生命周期

2. 零成本抽象
    
    + C++的实现遵循零开销原则：你不使用的，你不负担成本。更进一步：你使用的，你也没法更优化。
3. 实用性

### Rust语言架构

1. 混合编程方式：面向对象 + 函数式
2. 语义： 所有权 + MOVE + COPY + 借用 + 生命周期 + DROP
3. 类型系统：泛型 + trait + 类型推断 + 一切皆类型 + 多态
4. 栈 + 堆 + RAII + 安全内存管理

### Rust基础知识拾遗

这里的内容放在每日记录里面：[**rust基础知识拾遗**](https://github.com/wanderya/Weekly/blob/master/assets/record/rust_basic.md)

## rCore实验

开发环境如下：

+ 系统： archlinux
+ 工具：Vscode + rust-layzer

### Lab0

安装和配置实验环境。一开始打算在windows的WSL2进行实验，但是在一切环境就绪之后，编译运行实验之后遇到一些问题，总是会卡在命令行。因此，为了避免给后续实验增加不必要的麻烦，我将实验环境迁移到了自己使用的archlinux系统上来，好在后续一切顺利。


### Lab1

实验目的在于了解系统调用的过程。要求实现一个系统调用 `sys_task_info`。

要求返回一个`TaskInfo`的数据结构，这个结构包含三个字段信息，第一个是任务状态，第二是任务的系统调用次数，第三就是任务执行时间。

主要思路: 在任务控制模块中加入必要的记录字段，以及增加一些相关信息返回的函数。


### Lab2

实验目的在于了解为什么要引入虚拟内存机制。实现引入虚拟内存过后的lab1中的系统调用。以及深入了解进程的地址空间和页表。主要实现`sys_mmap` 和 `sys_unmap`两个系统调用。

因为lab1直接在物理地址上进行实现，所以在程序传过来的指针就是他原本的物理地址。但是在引入虚拟内存后，程序传入参数的是一个虚拟地址，故我们应实现虚拟地址到物理地址之间的转换。后面的过程就和lab1相同了。

`sys_mmap`的实现思路，首先在调用函数中对传入参数进行合法检测，然后处理权限信息。然后我们在每个task中提供mmap的接口，因为task的控制快管理着地址空间的信息，因此，我们在`memory_set`模块中实现我们最终的`mmap`的功能，首先检测地址区域的合法性，然后调用`insert_framed_area`函数把我们的区域分配出来。`sys_unmmap`与`mmap`类似。


### Lab3

这个实验把进程的概念引入进来，对任务进行抽象。引入进程的一个重要原因也是实现隔离。本节主要实现`sys_spawn`系统调用和简单实现stride调度。

本节的实验难度在代码实现上比lab2还要简单一点，因为`spawn`的实现可以参考`fork`等已有的代码。`spawn`的语义是从父进程中生成一个新的子进程。根据函数签名，我们的实现思路是先把参数中的文件路径中的文件内容解析出来，这里使用已有的`get_app_data_by_name`。然后把数据传入进程的`spawn`函数中，实现`spawn`与`new`的实现类似，与它不同的是我们还要把当前的进程控制快加到孩子进程队列中。

stride调度实现也比较简单，没有用额外的数据结构，而是在已有的结构中修改，当我们对任务进行调度的时候会调用TaskManager中的`fetch`，因此对原有的`pop`方式进行修改，依照提示，遍历整个就绪队列，然后找到最小stride的那个任务，把该任务移出队列并返回。以及每次调度的时候也要对stride进行更新。

### Lab4

本实验目的在于了解和熟悉文件系统，实现硬链接的`link`和`unlink`，以及获取文件状态的`sys_stat`系统调用函数。

本节的代码修改主要集中在easy-fs的文件系统上，所以了解该系统的构造是必须的。首先可以忽略掉文件系统的底层，因为链接的修改在文件的inode上，所有我们需要关注Inode的修改。由于我们只实现了单层的目录，所以只在root下实现link和unlink即可，故`link`的实现思路是参考`create`函数，对目录进行扩容，找到old_name的那个inode, 然后根据这个inode创建一个新的entry，写入磁盘。 `unlink`的实现思路也是在root目录下遍历找到目标文件名，写入一个空的entry即可。

在实现`sys_stat`的时候，有三个信息需要返回，（inode id, mode, nlink). inode id的获取参考`get_disk_inode_pos`, 将其反过来便是我们要求的inode id。 nlink的获取在本实验很简单，因为我们是在单层的root目录中，那么我们只要遍历root目录的所有entry，然后对满足inode的entry计数即可。另外一种思路就是在DiskInode中新增一个nlink字段，记录inode的引用信息，不过要注意保持整个结构的大小不变。


### Lab5

引入多线程概念，将调度单位抽象成线程。实验要求实现死锁检测。

按照提示实现银行家算法，资源可以是互斥量，信号量。
