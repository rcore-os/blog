---
title: 2024年秋冬季开源操作系统训练营三阶段总结报告-guoraymon
date: 2024-12-03 23:39:18
categories:
    - 2024秋冬季开源操作系统训练营
tags:
    - author:guoraymon
    - repo:https://github.com/guoraymon/oscamp
---

### Unikernel 模式内核特点
应用与内核处于同一特权级，共享同一内存空间，编译形成一个 image 即是应用又是内核。
无隔离无切换，简单高效但安全性低。

## U.1.0 Hello
输出信息到屏幕。

### 引导过程：axhal
- 暂存来自 openSBI 的两个参数
  - a0: hartid，当前 CPU 的 ID
  - a1: DTB 指针，设备树地址
- 设置栈
  - `la sp, {boot_stack}`
    - 将预设的栈地址加载到sp。
  - `li t0, {boot_stack_size}`
    - 将预设的栈大小加载到t0。
  - `add sp, sp, t0`
    - 将 `sp` 和 `t0` 的值相加并存回 `sp`，相当于栈指针下移 `t0`，为栈留出 `t0` 内存空间，完成栈的设置。
- 设置页表并开启 MMU
- 修正虚拟高地址
  - 由于开启 MMU 导致地址空间切换，需要将 `sp` 加上虚拟高地址的偏移量。
- 调用 rust_entry
  - `mv a0, s0, mv a1, s1`
    - 将 `hartid` 和 `DTB指针` 复制到寄存器 `a0` 和 `a1`。
  - `la a2, {entry}`
    - 将入口地址加载到a2寄存器。
  - `add a2, a2, s2`
    - 将 `a2` 寄存器加上虚拟高地址的偏移。
  - `jalr a2`
    - 跳转到 `a2` 地址，即执行 `rust_entry` 函数
  - `j .`
    - 无条件跳转到当前地址

### 引导过程：axruntime
- 打印 LOGO 和基本信息
- 初始化日志功能
- 日志打印物理内存地址信息
- #[cfg(feature = "xxx")]
  - 按需执行各组件初始化，例如 `alloc` 组件需要初始化内存分配器。
- 打印 CPU 信息，原子操作使已初始化 CPU 数量加一，等待所有 CPU 初始化
- 进入 `main` 函数

### 运行过程：app:hello_world
- 没有 std 支持，不提供 main 入口
- axstd::println -> axstd::io::__print_impl -> axstd::io::Stdout::Write -> arceos_api::stdio::ax_console_write_bytes -> axhal::console::write_bytes -> riscv64_qemu_virt::putchar

## U.2.0 Collections
组件：axalloc
目标：
1. 动态内存分配，支持 Vec 集合类型。
2. 动态内存分配框架和算法。

需要实现两类分配：
- Bytes Alloc
  - 支持：Rust Vec, String...
  - 接口：#[global_allocator] Trait
  - 框架：axalloc::byteAllocator
  - 算法：allocator::TlsfByteAllocator, BuddyByteAllocator, SlabByteAllocator
- Pages Alloc
  - 支持：驱动，页表自身
  - 接口：global_allocator() 全局函数
  - 框架：axalloc::pageAllocator
  - 算法：allocator::BitmapAllocator

### GlobalAllocator 数据结构
使用 `TlsfByteAllocator` 作为字节分配器，`BitmapPageAllocator` 作为页分配器。

### GlobalAllocator 接口
实现 #[global_allocator] Trait 和 global_allocator() 全局函数。

### GlobalAllocator 框架
将字节分配器和页分配器组成一个简单的两级分配器。首先将全部内存区域分配给页分配器，然后分配一块小区域（32 KB）给字节分配器。当字节分配器分配时无可用内存时，会向页分配器请求追加内存。

## U.3.0 ReadPFlash
组件：pagetable
目标：
1. 引入页表组件，通过地址空间重映射，支持设备 MMIO。
2. 地址空间概念，重映射意义，页表机制。

ArceOS 包括两阶段地址空间映射，Boot 阶段默认开启 1G 空间的恒等映射。如果需要支持 MMIO，需要指定 paging feature 实现重映射更大的空间。

### PFlash
Qemu 的 PFlash 模拟闪存磁盘，启动时自动加载到固定的 MMIO 区域，读操作不需要驱动。Qemu 保留了 0 号 pflash 作为扩展固件使用， 1 号 pflash 提供给用户使用，地址是 0x2200_0000。

### 物理地址空间
  - 0x8020_0000：kernel Image
    - .bss
    - .data
    - .rodata
    - .text
  - 0x8000_0000：SBI
  - 0x0C00_0000: MMIO

### 分页阶段 1 - 早期启用
开启分页，恒等映射 0x8000_0000 到 0xC000_0000 的 1GB 地址空间。切换前后地址范围不变，但从物理空间切换到虚拟空间。

### 分页阶段2 - 重建映射
新建一个空的内核地址空间，并通过页表申请一个新的页，随后通过axhal 体系无关操作将根页表地址写入到 satp 寄存器。

## U.4.0 ChildTask
组件：axtask
目标：
1. 创建子任务，建立多任务基本框架。
2. 任务、运行队列。

### 数据结构
- entry：任务逻辑入口
- state：任务状态
- kstack：栈空间，ArceOS 任务相当于线程。
- ctx：任务调度上下文
- task_ext：扩展属性，用于宏内核和 Hypervisor 扩展。

### 接口
#### spawn &  spawn_raw
生成一个新任务，加入 RUN_QUEUE。

#### yield_now
让出 CPU 控制权，切换到另一个已就绪任务。

#### sleep & sleep_until
睡眠指定时间。

#### exit
退出任务。

### 框架
#### 初始化
运行队列初始化和定时器初始化。
初始两个任务，main是主线程任务，idle 是用于所有任务阻塞时执行的任务。

## U.5.0 MsgQueue
组件：axsync
目标：
1. 任务切换机制，协作式调度算法。
2. 同步的方式，Mutex 的机制。

### 任务切换原理
保存当前任务上下文->切换->恢复下个任务上下文。上下文一般包含如下寄存器：
- ra：函数返回地址寄存器。
- sp：栈指针寄存器。
- s0-s11：函数调用相关寄存器。

### 算法
协作式调度算法 FIFO
较简单，略。

### 同步原语
#### 自旋锁
单 CPU 只需关中断+关抢占。多 CPU 需要相互可见内存变量进行原子互斥操作。

#### 互斥锁
自旋锁+等待队列

### 内存分配算法
TLSF，Buddy，Slab 算法。较复杂，可单独了解，略 。

### U.6.0 FairSched
组件：timer
目标：
1. 抢占式调度，CFS 调度策略
2. 时钟中断机制

### 抢占时机
1. 内部条件：时间片耗尽
2. 外部条件：启用抢占
内外条件都满足时，才发生抢占。

### 抢占式调度算法 ROUND_ROBIN
定时器递减当前任务的时间片，耗尽时允许调度。

### 抢占式调度算法 CFS
vruntime= init_vruntime + (delta / weight(nice))。

vruntime 最小的任务就是优先权最高的任务，即当前任务。

新任务 vruntime = min_runtime，设置优先级即设置 nice 值。

队列基于 BTreeMap，排序基于 vruntime，队首是 vruntime 最小的任务。

## U.7.0 ReadBlock
组件：axdriver、drv_block、drv_virtio
目标：
1. 从磁盘块设备读数据，替换 PFlash
2. 发现设备关联驱动、块设备、VirtIO 设备

axruntime::rust_main -> axdriver::init_drivers -> AllDevices::probe -> probe_bus_devices

axruntime 在启动后期，调用 axdriver。axdriver 负责发现设备和初始化，核心结构是 AllDevices。probe 基于总线发现设备，逐个匹配驱动并初始化。

按照平台有两种总线：
1. PCI 总线，基于 PCI 总线协议。
2. MMIO 总线，一般基于 FDT 解析，目前采用两级循环探测。

Virtio 驱动和 virtio 设备交互：
1. Vring 环形队列，本质上是连续 page 页面。
2. 中断响应通道，主要用于等待读取大块数据。

## U.8.0 LoadApp
组件：fatfs、axfs_vfs
目标：
1. 从文件系统加载应用和数据
2. 文件系统初始化和文件操作

文件系统 mount 的意义：把易于存储的扁平化结构目录树转为易于搜索遍历的立体化形态目录树。

