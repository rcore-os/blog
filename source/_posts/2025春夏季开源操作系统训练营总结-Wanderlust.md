---
title: 2025春夏季开源操作系统训练营总结-Wanderlust
date: 2025-04-21 04:58:45
tags:
    - author:Wanderlust
    - repo:https://github.com/879650736/blog/tree/master
---
## 第一阶段
第一阶段主要是看了 ``rust权威指南`` 和b站杨旭的``rust编程语言入门``， 以及参考rust的官方文档

## 第二阶段
### 总结
第二阶段主要是参考``rCore-Tutorial-Book 第三版``的文档，以及每个ch都详细通过gdb观察函数调用关系，最后整理出完整的函数调用步骤，方便更好的理解内核态和用户态的交互
### ch1
通过在switch和syscall函数打断点，读取寄存器的数据，更好的理解了内核态到用户态的跳转步骤，以及上下文切换的具体步骤
### ch2
通过正确的对齐操作，和虚拟地址与物理地址的转换，进行map,并进行正确的错误处理：包括overlap以及传参错误的处理。
### ch3
通过``source breakpoint.txt``快速发现函数调用路径和调用关系。
```bash
break run_tasks
break src/task/processor.rs:62
break trap_handler
break __switch
break syscall::syscall
break __restore
break __switch
break trap_return
break src/task/processor.rs:99
break exit_current_and_run_next
break suspend_current_and_run_next
```
通过对照fork与exec对spawn进行实现。

### ch4
通过使用UPSafeCell块与VEC新建了一个全局``LINK_VEC``，记录已经链接的变量的inode与链接计数。并修改Inode中的create函数，实现创建链接。最后实现fstat获取文件状态。
### ch5
通过类银行家算法实现检测死锁。

## 第三阶段
### print_with_color
```rust
$crate::io::__print_impl(format_args!("\x1b[36m{}\x1b[0m\n", format_args!($($arg)*)));
```
通过传入颜色文本格式进行println打印

### support_hashmap
通过两种方法实现了hashmap
1. 通过直接``use hashbrown::HashMap as InnerMap;``导入hashmap
2. 使用``use axhal::misc::random;``和vec自己构建了一个简单的hashmap

### alt_alloc
使用``bytes_pos``和``pages_pos``构建了简单的``EarlyAllocator``。
通过正确的``align_up``和``check is_valid_range``,进行alloc和dealloc。
### ramfs_rename
通过在``btreemap``中获取值并insert到其children中，进行rename。
### sys_map
通过``#[register_trap_handler(PAGE_FAULT)]``进行注册PAGE_FAULT的trap_handler。
通过``find_free_area``，寻找一块可以放置对齐后的uspace的区域。
实现正确的给权限操作后，进行``map_alloc``。
再获取对应fd的file,读取值写入buf中，再写入刚``map_alloc``的空间。
### simple_hv
进行A0和A1寄存器的正确设置，并正确调整sepc的偏移量。