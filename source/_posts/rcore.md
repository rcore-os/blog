---
title: rcore
date: 2020-08-01 16:40:28
categories:
    - report
tags:
    - author:xy_plus
    - summerofcode2022
    - rcore-lab
---

# lab1 report

## 实现功能

修改 TaskControlBlock ，加入成员变量 TaskInfo 。

初始化时，TaskInfo.status 为 TaskStatus::Running 。由于查询的是当前任务的状态，因此 TaskStatus 一定是 Running ；TaskInfo.syscall_times 为 全 0 ；TaskStatus.time 用 get_time_us() 赋值。

每次调用 syscall 的时候，都先更新 TaskControlBlock.TaskInfo ，然后真正去调用 syscall 。

返回的 task_info.status 和 task_info.syscall_times 都是直接从 TaskControlBlock 复制；task_info.time 为 (get_time_us() - TaskControlBlock.TaskInfo.time) / 1000 ，从而体现出时间差以及时间单位换算。

<!-- more -->

## 简答作业

### 1

> [rustsbi] RustSBI version 0.2.2, adapting to RISC-V SBI v1.0.0
- ch2b_bad_address.rs
  - [ERROR] [kernel] PageFault in application, core dumped.
  - 访问错误地址
- ch2b_bad_instructions.rs
  - [ERROR] [kernel] IllegalInstruction in application, core dumped.
  - 执行非法指令
- ch2b_bad_register.rs
  - [ERROR] [kernel] IllegalInstruction in application, core dumped.
  - 执行非法指令

### 2

#### 1

__restore 是在 switch 的时候，通过设置 ra 寄存器调用的。在 switch 期间没有写过 a0 寄存器，因此 a0 在 __restore 时仍然是 switch 的第一个参数，unuse 或者 current_task_cx_ptr 。

在启用第一个进程和切换进程这两个场景下，都会需要通过 restore 来设置寄存器。

#### 2

特殊处理了 sstatus、sepc、sscratch 寄存器。

- sscratch：进入用户态时，保存内核栈地址。用户态返回内核态时，将 sp 设置为内核栈地址。
- sepc：当 Trap 是一个异常的时候，记录 Trap 发生之前执行的最后一条指令的地址
- sstatus：SPP 等字段给出 Trap 发生之前 CPU 处在哪个特权级（S/U）等信息

#### 3

x2 是 sp ，会在后面保存到 sscratch 。

x4 用户程序用不到，所以不用保存。

#### 4

sscratch 是内核栈地址，sp 是用户栈地址。

#### 5

sret 指令。

sret 的时候，CPU 会将当前的特权级按照 sstatus 的 SPP 字段设置为 U 或者 S ；CPU 会跳转到 sepc 寄存器指向的那条指令，然后继续执行。

#### 6

sp 是内核栈，sscratch 是用户栈。

#### 7

ecall

## 其它

作业题和 trap.S 的行有一些不一致。

# lab2

（刚知道不用写报告，气死我了）

## 实现功能

### fix sys_get_time && sys_task_info

通过用户态页表将用户态地址转换为物理地址。

将传入的 \*TimeVal 地址转换为内核态可用的指针，然后填充结构体。

sys_task_info 同理。

### sys_mmap

首先对输入参数做检查，非法参数返回 -1 。

然后检查将要 mmap 的地址对应的 vpn 是否已经 map ，如果已经 map 了，返回 -1 ，否则将这一页 mmap 到一个匿名 frame 。

传入的 port 需要转换成 MapPermission ，然后设置 U 位。

### sys_munmap

检查将要 unmap 的地址是否都是已经被 map ，如果 unmap 一段没有被 map 的地址会返回 -1 。

检查 vpn 是否 map 的方式，是通过 page table 获取 pte ，如果 ptr 存在且有效，就认为已经 map。所以 unmap 也是调用 page table 的 unmap 。

尝试操作 data_frames ，但是似乎有 bug ，无法正常调用 remove 函数，所以就没用。

## 问答题

### 1

![](https://learningos.github.io/rust-based-os-comp2022/_images/sv39-pte.png)

上图为 SV39 分页模式下的页表项，其中 [53:10] 这 44 位是物理页号，最低的 8 位 [7:0] 则是标志位，它们的含义如下：

仅当 V(Valid) 位为 1 时，页表项才是合法的；

R/W/X 分别控制索引到这个页表项的对应虚拟页面是否允许读/写/取指；

U 控制索引到这个页表项的对应虚拟页面是否在 CPU 处于 U 特权级的情况下是否被允许访问；

G 是 Global；

A(Accessed) 记录自从页表项上的这一位被清零之后，页表项的对应虚拟页面是否被访问过；

D(Dirty) 则记录自从页表项上的这一位被清零之后，页表项的对应虚拟页表是否被修改过。

### 2

## 其它

小语法错误。

```diff
- 一定要注意 mmap 是的页表项，注意 riscv 页表项的格式与 port 的区别。
+ 一定要注意 mmap 的是页表项，注意 riscv 页表项的格式与 port 的区别。
```

# lab3

spawn 就是抄了一下 fork 和 exec 没啥难度。stride 调度算法的测例不是很好，最后用玄学办法才勉强过了测例，很烦。建议测例改成在调度过程中 print ，然后用 python 检查 print 内容的比例。stride 是我最讨厌的 lab 。

# lab4

好难，感觉的是最难的 lab 了。学习了如何在磁盘中进行读写，如何与底层磁盘交互。

# lab5

这个感觉没啥难度，就是按照文档写完就好了，总共好像也不到五十行。
