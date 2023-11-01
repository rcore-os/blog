---
title: sunny_rust_rcore  
date: 2023-10-31 19:16:52  
categories:
    - 2023a-rcore  
tags:
- author:SUNNYsyy2005
    - repo:https://github.com/SUNNYsyy2005/rust/blob/main/README.md
---

#rcore学习总结报告


**总述** 

两周学完rust，两周了解rcore操作系统对于我这个大一的学生来说过程十分艰辛，虽说没有通宵打代码，但确确实实是花了几乎所有非学习睡觉时间完成的。  
这里非常非常感谢举办这个训练营的所有老师和负责人，资料准备的很全，几乎不需要再找其他资料；热心负责，经常在群里答疑，课上讲得很精炼。  

**lab1**
在这个实验中我实现了一个TaskInfo函数，该函数可以查询某个Task的运行时间、写入次数、挂起次数、退出次数和查询info次数。
fn sys_task_info(ti: *mut TaskInfo) -> isize  
我通过在TaskInner结构体中加入积累响应信息的值，并在调用这些系统函数的时候维护这些值。  
ps:一开始真的没想到还可以修改源代码部分，以为只是完成函数，哭  

**lab2**
在这个实验中我重新写了sys_get_time 和 sys_task_info函数，因为这两个函数传入的虚拟地址可能被分在了不同的页  
同时我实现了mmap 和 munmap两个函数，分别让用户可以申请虚拟地址空间和取消申请虚拟空间  
我在重写sys_get_time 和 sys_task_info函数的时候受讲课老师引导，学习详细白皮书的sys_write的写法，知道了如何获取到用户的实际存储内存地址  
在实现mmap和munmap函数中，我先判断用户输入是否合法，然后把用户给的地址取整，按每个页申请和取消空间。  
ps:用户空间由TaskInner中memory_set变量控制，不能自己新建memoryset变量！！！  

**lab3**
在这个实验中这次我实现了spawn函数的调用，它能新建一个子进程，并执行该子进程  
我参考了给出的fork函数和exec函数的实现过程，在把两者结合，实现利用fork新建子进程，再利用类exec函数启动子进程  
ps:fork()+exec()≠spawn()

