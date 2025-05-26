---
title: 2025s-os-camp-note-welkin-y
date: 2025-05-03 22:18:22
tags:
  - author:Welkin-Y
  - repo:https://github.com/LearningOS/2025s-rcore-Welkin-Y
---

## Rust warm-up

- April 4th to April 6th
- Pattern match 和 Functional programming 好文明, 梦回 compiler。
- Result<T,E> 很好封装
- ~~后面忘了~~

## rCore-OS

- April 13th to April 20th

### Lab 1 Time sharing multitasking

- 按说明实现scheduling即可

### Lab 2 virtual memory

- 核心在于VA, VPN, PA, PPN之间转换，不要混淆

### Lab 3 process

- 结合`exec`和`fork`实现`spawn`

### Lab 4 file system

- `OSInode`, `Inode`,  `DiskInode`三层封装
- 实现 `fstat`和 `hardlink`补充完成对应调用即可

### Lab 5 thread

- 死锁检测，按要求实现 Banker's algorithm

## ArceOS

- April 22nd to April 29th

### Lab 1 color print

- DIY过bashrc的懂得都懂
- pseudocode:

```
print_with_color(str):
  if print with color:
    print('\x1b[31m'+ str + '\x1b[0m')
  else
    print(str)
```

也可以换用别的颜色

### Lab 2 hashmap

- 照葫芦画瓢`std::collections::HashMap`

### Lab 3 bump allocator

- ~~没印象了~~

### Lab 4 file rename

- 更改parent dir中的name, 且本题只有一个rootdir

### Lab 5 mmap

- 因为测例也没有多次分配所以直接没写找freed memory的步骤，总体和rCore的sys_mmap思路一致，需要注意转换VA.

### Lab 6 hypervisor

- 改asm, 但我真不会汇编
