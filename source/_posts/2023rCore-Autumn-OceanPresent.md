---
title: 2023rCore-Autumn-OceanPresent
date: 2023-11-02 13:26:57
categories:
    - report
tags:
    - author: OceanPresent
    - summerofcode2023
    - rcore-lab
---

# Lab1
## 编程题
### 获取任务信息

思路：题目要求查询的信息都是全局持久化的，因此需要在TaskControlBlock中添加这些信息。

task_status已经存在，不需要添加

task_syscall_times需要在sys_call函数中拦截，根据系统调用的id进行桶计数即可

task_runtime比较麻烦，有两种思路：
1. 保存任务第一次调度的时间，在sys_task_info调用时将当前时间和第一次的时间相减（我的做法）
2. 分别记录任务在用户态和系统态下的时间，在sys_task_info调用时将两者相加。(此思路源于[参考](https://hangx-ma.github.io/2023/07/01/rcore-note-ch3.html))
   1. 内核态时间.在 run_first_task 以及 mark_current_exited， mark_current_suspend 中更新信息， 另外需要在 task 退出时打印耗时。
   2. 用户态时间.用户态和内核态的分界处就是 trap， 因而在 trap_handler 的起始位置和末尾位置可分别作为 user time 的开始以及 user time 的结束。

# Lab2

## 编程题
### 重写 sys_get_time 和 sys_task_info
由于内核和应用地址空间的隔离， 系统调用 不再能够直接访问位于应用空间中的数据，而需要手动查页表才能知道那些 数据被放置在哪些物理页帧上并进行访问。

可以参考文档中sys_write的重新实现。基本原理就是使用函数`translated_byte_buffer`可以将应用地址空间中一个缓冲区转化为在内核空间中能够直接访问的形式，然后再进行操作即可。

指针的copy操作可以使用`core::ptr::copy_nonoverlapping`

在taskinfo踩了坑，同样的代码可以过ch3的测试却没法过ch4的测试，因为使用了`get_time_ms`函数，有一些精度问题，后来改成`get_time_us() / 1000` 即可

### mmap 和 munmap 匿名映射

mmap函数的作用和签名可参考
[参考一](https://www.l2h.site/p/8cc7cf15)
[参考二](https://www.cnblogs.com/fortunely/p/16212027.html)

比较麻烦的是要弄清申请页和释放页边界，统一使用左闭右开的范围。检查范围和权限是否合法 使用 基本的数值运算或位运算即可；申请空间和释放空间要求 理解memset和pagetable的api作用，合理地使用即可

在样例ch4_umap卡了很久，因为当时mmap和munmap申请内存的范围边界没有理清，注意测试样例有一个地方申请了 PAGE_SIZE + 1的空间，这个申请应该向上取整，申请2页内存

# Lab3
## 编程题
### 进程创建
实现spawn系统调用，spawn函数的作用简单来说就是创建一个子进程，并在子进程中加载执行传入的可执行文件。通过它的作用我们可以意识到它其实是fork和exec两个函数的结合，因此spawn的具体实现就可以在fork和exec函数里左借鉴右借鉴，这就是——拿来主义。

1. spawn会根据传入的文件名，解析elf文件，获取elf文件的地址空间、用户栈等。和exec类似
2. spawn会创建新的子进程，需要申请新的pid和内核栈。和fork类似
3. 根据解析exec得到的信息以及父进程的信息初始化 子进程的TCB和Trap Context。和exec、fork类似
4. 将新的进程加入队列

### stride 调度算法
这题相对比较简单，根据题目要求为TCB加入pass、priority、stride字段即可，BIG_PASS随便设置一个比较大的整数就行。
需要修改的函数就是获取下一个执行任务的函数——fetch函数，之前采用的调度策略就是先进先出。stride算法的实现根据题目要求写一个for循环寻找stride值最小的task即可。
