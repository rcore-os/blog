---
title: 2023开源操作系统训练营第二阶段总结报告_baobaomaomeng
date: 2023-11-02 11:34:42
tags:
    - author:baobaomaomeng
    - repo:https://github.com/LearningOS/2023a-rcore-baobaomaomeng
---
# 2023开源操作系统训练营第二阶段总结报告-baobaomaomeng.md

## 2023rCore训练营第二阶段总结

### lab1

要求我们实现一个sys_task_info的系统调用，用于获取进程的信息。主要关键点在于如何获取task运行时间与系统调用次数。

这要求我们在TCB结构体中添加两个参数，一个记录系统调查的次数，一个记录运行时间。

运行次数在每次调用syscall时增加，所以直接根据调用syscall的id参数增加对应位置数组的值即可

运行时间要求我们记录第一次运行的时间，所以我们在切换记录时判断它是不是未被记录时间，然后记录它调用时间，当查询时候返回当前时间和起始时间差即可

### lab2

要求重写sys_get_time 和 sys_task_info两个系统调用。

由于我们引入了虚拟存储机制，所以要把数据写到任务地址空间需要根据我们的页表得到其实际物理地址再写入。mmp与munmap都已在memroy_set中帮我们实现，我们只需要简单封装一下即可，同时我们要注意访问权限的管理

### lab3

首先要迁移lab2中的实现，这一部分建议手动完成。

先讲进程调度，这个非常简单，push进队列的时候寻找位置插入即可，BIG_STRIDE设置为1e9+7

spawn，调用接口把父节点的数据拷贝即可，测试用例挺弱的


