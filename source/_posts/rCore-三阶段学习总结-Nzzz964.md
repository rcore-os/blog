---
title: rCore-三阶段学习总结-Nzzz964
date: 2025-05-24 15:20:31
categories:
tags:
    - author: Nzzz964
    - repo: https://github.com/LearningOS/2025s-rcore-Nzzz964
---

# 前言

本人没有 408 基础，之前仅仅是有过 CRUD 的经验，但是对各种底层很感兴趣，最近考试结束正好有时间参加训练营。索性接受了大佬的邀约（毕竟以后也是要做的）。

<!-- more -->

# Rust 学习总结

本阶段用时 3 天（其中耗时最久的应该是 **链表** 这道题）。

之前没有接触过 Rust，但是有 C/C++ 等语言的学习经验，对内存复制操作比较敏感，所以这个阶段还是挺简单的。主要学习所有权、生命周期等核心概念，写完代码后依靠编译器纠错然后修改，编译通过后代码基本都可以跑通。

对于 OS 开发来说，Rust 中的 `core` 模块十分关键。下面列举了一些常用的 API：

## `core::ptr`

```rust
use core::ptr;

// 安全的内存拷贝（不重叠区域）
ptr::copy_nonoverlapping(src: *const T, dst: *mut T, count: usize);

// 安全的内存拷贝（允许重叠区域）
ptr::copy(src: *const T, dst: *mut T, count: usize);

// 内存设置
ptr::write(dst: *mut T, src: T);      // 写入单个值
ptr::write_bytes(dst: *mut u8, val: u8, count: usize); // memset

// 内存读取
let value = ptr::read(src: *const T); // 读取单个值

// 指针偏移
let new_ptr = ptr.offset(count: isize);
let new_ptr = ptr.wrapping_offset(count: isize);
```

## `core::mem`

```rust
use core::mem;

mem::size_of::<T>();       // 获取类型大小
mem::align_of::<T>();      // 获取类型对齐要求
mem::replace(dest: &mut T, src: T) -> T; // 替换值
mem::swap(x: &mut T, y: &mut T);    // 交换值
```

## `core::slice`

```rust
// 从原始指针创建切片（不安全）
unsafe {
    let slice = core::slice::from_raw_parts(ptr: *const T, len: usize);
    let mut_slice = core::slice::from_raw_parts_mut(ptr: *mut T, len: usize);
}

// 切片操作
slice.as_ptr();
slice.len();
slice.get(index);  // 边界检查访问
slice.copy_from_slice(src);  // 安全拷贝
```

# rCore 学习总结

本阶段用时 50+ 小时。

rCore 主要基于 RISC-V 架构体系开发了一个单核的操作系统内核。这部分需要学习 RISC-V 的各种寄存器、机器启动引导、内核与应用的内存布局等。

由于缺少太多的前置知识，所以都是一边做 Lab，然后遇到不会的就问 AI。从一开始不知道 Trap 是什么，到最后完成最后一个小实验，感觉还是挺不错的（效率很高，不过这个过程中我很有可能接触到了很多“幻觉”知识）。所以在未来的学习中，我应该会用多个 AI 交叉验证，并结合浏览官方文档等方式进行确认。

主要收获在第五（进程管理）、六（文件系统）、八（并发控制）章节。

第六章一开始根据实验手册没有看懂具体实现，结合 OSTEP 后很快就上手了。

第八章需要实现一个 Deadlock Detection 算法。根据手册的实现，我以为是一个银行家算法（Deadlock Avoidance），所以很长一段时间都没有明白 `Need` 矩阵的作用。（但这也使我在查找资料的过程中，学习到了更多 Deadlock Detection 算法，也算是有所收获。）

# ArceOS 学习总结

本阶段用时 30+ 小时。

ArceOS 的六个实验都很简单，主要是学习 ArceOS 的各种设计（如通过 `linkme` 库、`TaskExt` 结构体解耦），以及更深入内核的高级特性（如 Hypervisor、兼容 Linux 的宏内核等），为了第四阶段做准备。

我认为将 OS 各个模块解耦的方法，以及代码的结构和设计模式等，都很值得学习。
