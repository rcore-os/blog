---
title: 2024秋冬开源操作系统训练营第一二阶段总结-Artoria
date: 2024-11-09 18:30:37
tags:
    - author:Artoria
    - repo:https://github.com/LearningOS/2024a-rcore-Artoria302-1
---

## 第一阶段

工作中已经写了一年多的Rust代码，体验确实不错，特别是完善的包管理工具，大大减少了编译时的心智消耗，所有权和借用系统并没有很复杂，写一阵代码自然就熟悉了

第一阶段算是再巩固下基础，数据结构题比较有意思，不过深入学习还是要抽空看看[链表](https://rust-unofficial.github.io/too-many-lists/)

## 第二阶段

对操作系统很感兴趣，尤其是第三阶段的虚拟化方向。由于平时工作比较忙，也就晚上和周末抽时间抓紧写写代码，下边主要总结下各个章节产生的疑问和实验遇到的问题吧

### lab1(ch2,ch3)

主要熟悉了应用加载，中断，用户栈/内核栈切换，任务切换的机制，再是学习了下`risc-v`寄存器以及汇编方面的知识，受益匪浅

实验比较简单，主要熟悉下`syscall`的开发流程

### lab2(ch4)

本章新增了地址空间，内核和应用通过页表机制把虚拟内存映射到实际的物理内存，虚拟内存使得不同应用都可以使用连续独立的地址空间，并做到了不同应用之间的隔离

`strampoline`段用于保存陷入内核和返回用户态的代码，并通过把内核和应用的`strampoline`设置成相同地址的虚拟页（最高页），使得切换地址空间之后，这段代码地址可以无缝衔接

`TrapContext`紧贴着`strampoline`位于应用的次高页（看起来没必要一定要在次高页）。`TrapContext`用于保存上下文切换时的寄存器以及`kernel satp`和`kernel sp`等。`TrapContext`位于用于应用地址空间是因为，切换上下文时只有一个`sscratch`寄存器可以用于周转，而如果`TrapContext`位于内核栈（内核栈不是恒等映射），那就只需要先通过`sscratch`得到`kernel satp`切换到内核地址空间之后才能访问`TrapContext`，这时就没有额外寄存器获得`kernel sp`也就拿不到`TrapContext`地址。如果位于应用地址空间，就可以通过`sscratch`寄存器保存`TrapContext`地址，在陷入内核后，先在应用地址空间保存好上下文之后，再切换到内核地址空间

实验需要注意的点：

- mmap页面要4k对齐，空间左闭右开

- syscall复制结构体时，需要通过`translated_byte_buffer`拿到用户态结构体对应的物理地址（这部分内存在内核是恒等映射的，可以正确写入），再复制

### lab3(ch5,ch7)

这两章主要讲了进程和进程通信，是概念相对简单的章节，难点主要在于调度算法

实验是实现spawn，总体来说是new+fork，不复制地址空间，但继承父子关系

### lab4(ch6)

本章学习了文件系统，代码中数据结构依赖关系相对复杂，画图梳理下比较方便理解

实验中`nlink`需要要保存在`DiskInode`中，同时减少`INODE_DIRECT_COUNT`保证`DiskInode`只占用`128bytes`

这里我把`file_count`也存下了，方便`unlink`时候，直接把最后一个`DirEntry`替换到被删除的`Entry`位置。其次可以用`union`保存`nlink`和`file_count`来节省空间，毕竟文件没有`file_count`，目录不允许有`link`，这里偷懒了

```rust
const INODE_DIRECT_COUNT: usize = 26;

#[repr(C)]
pub struct DiskInode {
    pub size: u32,
    pub nlink: u32,
    pub file_count: u32,
    pub direct: [u32; INODE_DIRECT_COUNT],
    pub indirect1: u32,
    pub indirect2: u32,
    type_: DiskInodeType,
}
```

一定要注意锁不能重入，在开发`unlinkat`时，因为调用其他也加文件锁的函数导致了死锁，被卡了有一阵

### lab5(ch8)

本章主要讲了内核中线程和锁的实现机制

下面有几个注意点

- 调用`schedule`切换线程前一定要手动`drop`资源，否则会造成资源泄露或`panic`

- `exit_current_and_run_next`在调用`schedule`之前分配了`TaskContext::zero_init()`作为dummy TaskContext，开始还想着这个线程不会再恢复了，那这个栈空间在后边是如何保证地址合法并最终回收的，而这就是`sys_waittid`存在价值之一

- 代码中的`PROCESSOR`并不是`thread_local`的，但有很多`exclusive_access`的调用，可能教学用的rCore并不存在多个cpu，这里暂时不需要考虑这个问题

```rust
lazy_static! {
    pub static ref PROCESSOR: UPSafeCell<Processor> = unsafe { UPSafeCell::new(Processor::new()) };
}

pub fn current_task() -> Option<Arc<TaskControlBlock>> {
    PROCESSOR.exclusive_access().current()
}
```

实验是死算检测，并不复杂，按着文档来就好
