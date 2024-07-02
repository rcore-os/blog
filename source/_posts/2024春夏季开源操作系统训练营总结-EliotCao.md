---
title: 2024春季开源操作系统训练营一阶段总结
date: 2024-04-26 03:01:44
categories:
    - report
tags:
    - author:EliotCao
    - repo:<rcore-os-repo_you_worked_on>
    - Rust
    - rCore-OS
    - ...
---

# 第一阶段 Rustlings 总结

第一阶段做的事就是 70-80% 刷 rustlings，剩余时间复习Rust语法知识，翻看Std Doc 和复习了算法知识/(ㄒoㄒ)/~~，总是会忘记细节😂  
其中
## 参考资料
- Rust 程序设计语言-中文版： https://kaisery.github.io/trpl-zh-cn/
- Rust By Example-中文版： https://rustwiki.org/zh-CN/rust-by-example/index.html
- 官方文档： https://doc.rust-lang.org/std/index.html

###### 做题中值得注意的点有以下方面：
* String主题的练习中，&str和String类型的互相转换
* Iterator中许多方法使得代码更加简洁,如fold， map, map_of, filter等，官方文档续多看
* 智能指针这块也值得注意，RC, Aec RefCell等
* 除了以上基础语法方面的内容外，通过手动实现链表, 双向链表, 堆栈, 深度优先和广度优先算法, 排序算法等增进对Rust的进一步理解


# 第二阶段 rCore

第二阶段从操作系统的发展历史的循序渐进的讲解操作系统的开发，并逐渐加入文件系统、进程。

在这几章的学习内容中，本阶段较为不熟悉的是文件系统这快内容，通过不断研究文档，熟悉代码，研读V3文档，逐渐对rCore加深了认识。

想起一句流传甚广的话"源码面前了无秘密"。

共勉！！！


# 第三阶段 R4L驱动和跨内核驱动框架设计与实现
本阶段主要时熟悉了R4L, 并在此基础上实现了Print模块、Misc设备驱动模块、树莓派GPIO驱动模块等的开发。
对Rust在Linux体系的驱动开发加深了进一步的认识。
在此基础上熟悉了跨内核驱动框架的设计与实现。
值得说明的是以上皆基于Qemu进行操作。
