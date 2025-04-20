---
title: <个人思考>
date: 2025-04-20 21:35:28
tags:
    - author:yjymosheng
    - repo:https://github.com/yjymosheng/blog/tree/master
---

# 一阶段

这个内容不难,看文档+坚持就行了

# 二阶段

这个内容上了些难度,主要是对内容的结构理解, 代码上问题不大

# 三阶段 6道题

## print_color

### 解题思路


1. 修改`sbi::putchar`的内容, 添加颜色信息. 

```rust
/// Writes a byte to the console.
pub fn putchar(c: u8) {
    // #[allow(deprecated)]
    // for b in b"\x1b[31m" {
    //     sbi_rt::legacy::console_putchar(*b as usize);
    // }
    #[allow(deprecated)]
    sbi_rt::legacy::console_putchar(c as usize);
    // #[allow(deprecated)]
    // for b in b"\x1b[31m" {
    //     sbi_rt::legacy::console_putchar(*b as usize);
    // }
}
```


2. 修改`marcos`的内容, 添加颜色信息. 

```rust
/// Prints to the standard output, with a newline.
#[macro_export]
macro_rules! println {
    () => { $crate::print!("\n") };
    ($($arg:tt)*) => {
        $crate::io::__print_impl(format_args!("\x1b[31m{}\x1b[0m\n", format_args!($($arg)*)));
    }
}
```




3. 修改`main.rs`的内容,直接在输出结果上添加颜色信息 .

```rust
fn main() {
    println!("\x1b[31m[WithColor]: Hello, Arceos!\x1b[0m");
}
```


## hashmap

### 解题思路

1. 修改`std`的内容,直接引入rust std hashbrown作为hashmap算法



2. 给axstd`hashmap.rs` 手动实现hahsmap的内容

```rust
pub mod hashmap; 
pub use hashmap as collections;
```
**难点** : 

    1. 涉及一些hashmap的原理思想. 图简单,我直接设置了比较大的bucket , 冲突相关的内容也没有多管
    
    2. 需要掌握iter的内容,因为main.rs中有关于iter方法的调用

## bump_alloc

### 题目思路

非常简单, 因为只有`lib.rs`需要修改

### 题目难点

1. Byte 分配需要关注对齐 . 对齐公式 通过gpt分享得知 .具体的推导我仅仅手动算了一遍

2. Page 分配需要理解num_pages 和 align_pow2的概念 . 

    首先一个是分配的页数,这个不太困难; align_pow2,这个通过查询资料可知 是页面的对齐. 它跟Byte
    的对齐有什么区别呢? 毕竟有page_size这种天然的对齐标准. gpt提供了关于dma组建的对齐示例, 也
    就是os 可能需要对齐更大的页

3. 对AllocResult 的理解 ,需要针对不同的情况返回不同的Err值

```rust
/// The error type used for allocation.
#[derive(Debug)]
pub enum AllocError {
    /// Invalid `size` or `align_pow2`. (e.g. unaligned)
    InvalidParam,
    /// Memory added by `add_memory` overlapped with existed memory.
    MemoryOverlap,
    /// No enough memory to allocate.
    NoMemory,
    /// Deallocate an unallocated memory region.
    NotAllocated,
}

/// A [`Result`] type with [`AllocError`] as the error type.
pub type AllocResult<T = ()> = Result<T, AllocError>;
```

## rename

### 题目难点

关于这道题目,我仅仅描述一下我自己的思考

1. 首先要明白如何对文件系统（fs）进行抽象与支持。
    
    - 文件系统通常包含 Dir（目录）、File（文件）节点，以及一个统一对外的文件系统抽象框架。

2. 了解了不同节点（node）之间的关系以及它们各自的职责之后，我们需要进一步确认“名称（name）”的管理部分。
    
    - 通过查看代码可以发现，名称相关的信息主要存储在 Dir 中，通常使用如 BTreeMap 或 HashMap 等结构来维护。

3. 确定 `rename` 操作的实现思路：
    
    1. 查找并从原目录中移除 old 节点；

    2. 查看目标路径 new 的节点是否已存在；

        - 如果存在，先将其删除；

    3. 将 old 节点插入到新路径对应的目录中。
    
### 关于项目结构的理解

ArceOS 采用组件化的设计理念，通过 `define_api_type!` 与 `axfs_vfs::impl_vfs_dir_default!` 封装了具体实现与默认行为。

### 可能需要改进的地方 

当前的 rename 实现仅支持同一文件系统（或相同根节点）内的路径；当 old 和 new 不在同一根目录下时，操作会失败。

## sys_mmap 

题目难点
====

关于这道题目，我仅仅描述一下我自己的思考：

1. 首先要明确 `mmap` 的核心目标是**将文件的某一段内容直接映射到用户虚拟地址空间**，实现对文件的“内存视图”。

    - 用户可以像访问内存一样访问文件内容，不需要中间 `read/write` 的过程；
    - 需要完成虚拟地址到物理页框的映射，并填充内容。

2. `mmap` 涉及的几个关键抽象：

    - **用户地址空间（AddrSpace）**：表示一个进程所拥有的虚拟内存范围，负责查找空闲地址、执行实际映射等；
    - **页表管理（PageTable）**：负责建立虚拟地址到物理地址的实际映射；
    - **文件抽象（FileLike）**：通过 file descriptor 查找到内核抽象的文件，支持 `read` 方法填充页框。

3. `mmap` 系统调用参数设计灵活但容易传错：

    - `addr` 是用户建议的映射地址，不一定被采用；
    - `length` 需页对齐；
    - `prot` 表示权限，如 `PROT_READ`；
    - `flags` 控制共享/私有等策略；
    - `fd` 是文件描述符；
    - `_offset` 是映射文件的偏移，暂未处理。

4. 着重理解`mmap` 的参数及设计思想

- addr：建议映射地址。用户可以建议映射起始地址，但系统可能忽略这个值，选择更合理的地址（比如避开冲突、留出 guard page 等）。传 NULL 表示让内核自动选择。

- length：映射的内存大小。必须是页大小的整数倍，否则需要向上对齐。映射区域大小必须足够容纳所需的文件内容。

- prot：映射内存页的访问权限，如：

  - PROT_READ: 映射的页可读；

  - PROT_WRITE: 可写；

  - PROT_EXEC: 可执行；

  - PROT_NONE: 禁止访问。

- flags：映射策略，如：

  - MAP_SHARED: 多个进程共享映射（写操作对原始文件可见）；
  
  - MAP_PRIVATE: 拷贝写（写时拷贝，不影响原始文件）；
  
  - MAP_FIXED : 强制映射到 addr 所指定的地址 ;

  - MAP_PRIVATE：私有映射（写时复制，写入不会影响原文件）；

  - MAP_SHARED：共享映射（多个进程映射同一页，写入会同步影响原文件）；

  - MAP_ANONYMOUS：匿名映射，不与任何文件关联，fd 被忽略，内容初始为零；

  - MAP_FIXED：强制映射到 addr 所指定的地址，可能覆盖已有映射，风险较高；

  - MAP_POPULATE：提前分配并加载所有页（非懒加载），避免首次访问缺页异常；

  - MAP_STACK：指定这是一个栈区域（部分系统支持，可能用于自动扩展）；

- fd：文件描述符。指向将被映射的文件。若使用 MAP_ANONYMOUS，则忽略该参数。

- offset：映射起始位置在文件中的偏移。要求是页大小的倍数，表示从文件中的哪个位置开始映射。


---

关于项目结构的理解
====

ArceOS 使用组件化与模块边界清晰的方式封装 mmap 逻辑，其核心设计涉及：

1. `sys_mmap`：系统调用入口，接收用户传参，执行空间分配、权限设定、数据写入等完整过程。

2. `AddrSpace` 结构体（位于 `axmm` 模块）：

    - 代表进程虚拟地址空间；
    - 提供 `find_free_area` 方法搜索空闲虚拟内存区域；
    - 提供 `map_alloc` 映射物理内存页；
    - 提供 `write` 将文件内容写入内存页。

3. `get_file_like`：将用户传入的 fd 映射为 `FileLike` 类型，用于后续 `read`。

4. 参数处理：

    - 映射的起始地址使用 `addr + 0x20_0000` 作为搜索 hint 避免与低地址冲突；
    - 映射长度自动对齐为页大小；
    - 文件内容读取后通过 `uspace.write()` 写入虚拟地址空间。

---

可能需要改进的地方
====

目前仅仅针对测例进行编程, 一些`mmap` 应当实现的功能还未进行

## simple_hv 

### hv 两种类型

1. 直接运行在硬件上，如 KVM、Xen

2. 运行在操作系统中，如 VirtualBox

### 题目解题思路

解决Trap的不同处理方式.

直接通过跳过指令, `sepc` + 4 的方式实现


# 三阶段挑战题

### 难点剖析

首先分析一下Rust的alloc 过程. 

alloc是通过传入的参数layout进行处理的 , layout是通过申请大小进行生成的. 这里就涉及到了layout的两个重点参数: size , align . size大小就是核心的数值, 类似malloc的空间范围. align可以用来作为对齐的要求,也可以用来反推alloc数据的类型.

默认先进行alloc, 如果在alloc的过程中返回了NoMemory,会调用pageAllocator进行page上的alloc添加新的内存空间; 如果page的空间也被分配完了进程就会keilled.

### 观察main.rs

每次会分配15个Vec ,然后释放8个, 也就是说偶数项的Vec其实只是临时存在,尽可能分开作为临时alloc空间. 

为图简洁,采用tlsfAllocator进行长期存活Vec的分配行为

### 解题思路

按对齐分类分配：

align == 8 → 使用 TlsfByteAllocator，适合长期存活数据。

其他对齐 → 自定义分配器，用 bump 分配方式管理。

自定义分配策略：

每 15 次分配中偶数位 → 从 end 向前分配（短期内存）。

其余 → 从 start 向后分配（长期内存）。

释放策略：

align == 8 → 交由 TLSF 回收。

其他只支持最近短期分配的内存释放。

目的：

模拟临时与持久内存的分离分配，提高模拟 allocator 的灵活性。

