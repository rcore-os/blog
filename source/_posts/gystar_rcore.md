---
title: rCoreTutorial总结报告
date: 2020-07-26 18:23:00
categories:
	- report
tags:
	- author:gystar
	- summerofcode2020
mathjax: true
---
<!-- more -->
从8月初开始，我从0开始学习了一周的rust语言，完成了相关练习。学习rust的公开repo为：

https://github.com/gystar/HelloRust

之后开始跟着rCoreTutorial的实验指导完成了lab0-lab6，从简单的中断到内存管理，再到进程的创建和调度，最后是系统调用和设备树，将一个小型os内核用rust语言一步步的构建出来，还是挺有成就感的。对于os的原理有了比教科书要深刻得多的理解，感觉从中获益良多，感谢各位老师和助教。学习rCore的公开repo为：

https://github.com/gystar/rCoreTutorial

并且我完成了所有的实验题目。其中，我感觉比较难写的是伙伴分配算法，难点在于:

- 完成传统的伙伴分配算法
- 分配的地址有对齐要求，因此可能要检查空闲表的多个链表的多个结点
- 由于此算法是用于动态内存分配，所以一开始不能直接使用动态分配内存的数据结构，如linkedlist，否则陷入互相new的死锁。但是此算法本身是基于链表实现的，因此我实现了一种新的链表：一开始分配一个静态结点，之后的结点在堆上动态分配的链表。伙伴算法，最开始每个链表最多一个结点，因此这个链表是刚好满足要求的。

