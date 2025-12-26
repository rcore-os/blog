---
title: 24秋冬训练营三阶段总结-yukariyuko
date: 2020-07-15 16:40:28
categories:
    - report
tags:
    - author:yukariyuko
    - repo:https://github.com/yukariyuko/oscamp24fall
    - arceos
    - 24fall
---

# 总结

通过第三阶段的学习，了解了组件化操作系统内核的思想，这告诉我们可以基于组件构造内核的方法，增量地构造出应对不同场景的各种模式内核。从而能够：
1. 提高内核开发效率
2. 降低内核维护难度
3. 开展基于组件的功能复用和开发协作
具体来讲：

## 第一周

- 配置好了项目环境
- 通过模拟需求的不断增加的场景，增量地认识了unikernel形态下的Arceos
- 了解了如何根据需求变更，从最开始一个极为简单的内核逐步扩展出一个拥有文件系统等功能模块的unikernel
- 了解了如何通过转义字符使终端打印彩色字符
- 实现了简单的Hashmap
- 实现了一种简单的内存分配算法

## 第二周

- 见识到了如何根据组件化的思想，仅通过增加少量组件，将unikernel形态下的内核扩展为Monolithic kernel
- 了解了一点riscv硬件架构的知识
- 学习了Arceos中TCB的设计思路
- 编写了一个函数处理缺页异常
- 实现了一些简单的unix应用（mv，rename）
- 了解了mmap函数

## 第三周

- 了解了虚拟化的思想和一些基本概念
- 了解了是如何通过增加模块将Arceos进行虚拟化的
