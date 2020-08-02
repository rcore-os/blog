---
title: Report of OS Tutorial
date: 2020-07-26 20:07:40
categories:
	- report
tags:
	- author:SKTT1Ryze
	- summerofcode2020
---

## 前言
2020年6月30日，在年级群看到了一位同学发的 OS Tutorial Summer of Code 链接，拍拍脑袋，决定利用这个暑假参加这次活动。  
原因要追溯到上个学期，也就是大二上学期，的末尾，第一次在我的笔记本电脑上装了 Linux 双系统，从此就喜欢上了 Linux，一发不可收拾，这种兴趣逐渐使我萌生了动手写 OS 的想法，但一直以来都没有一个完整的知识体系和现成框架，这让我无从下手。  
从那天开始，这个活动带我进入了一个新的世界，一个关于 Rust 语言，RISC-V体系结构，和新时代操作系统的新世界。  
<!-- more -->
## Rust 初体验
Rust 给我的第一印象就是：对 Linux 用户十分友好。  
我学习 Rust 是先从环境配置开始，根据 [Rust 中文文档安装指南](https://kaisery.github.io/trpl-zh-cn/ch01-01-installation.html)中所说一步步走，我几乎没遇到什么障碍就完成了环境的配置。为什么说对 Linux 用户十分友好呢。像我这样的 Linux 用户崇尚着“命令行至上”的理念，想在命令行界面上完成所有对计算机的操作而不是 UI 界面，正所谓“一台电脑一把键盘足矣”。而 Rust 的所有环境配置操作都在命令行界面上可以很方便的完成。另外，很明显的是 Rust 在 Unix 端的环境配置比在 Windows 端要方便许多。  
第二印象就是：难。  
曾经有人吐槽过“Rust 反人类”。一开始学习 Rust 的时候，确实会有这样的感受。所有权，生命周期，trait 等概念，确实很令人费解。我觉得这有一部分原因是由于我们对 C/C++ 比较熟悉，这导致了我们在面对 Rust 中与我们编程思维不一致的特性的时候不易理解。另外一部分原因我觉得是因为 Rust 确实门槛比较高，初学者不易入门。但这些都不能掩盖 Rust 发光之处：内存安全和线程安全。所有权避免了内存二次释放，生命周期机制避免了裸指针的出现。  
所有权和生命周期机制在保证了内存安全的同时，也给我们的编程带来了较大的麻烦，安全与效率往往不可兼得，如果在写操作系统或者其他项目的开发过程中完全使用 Rust ，那无疑是一个量十分庞大的工作。为了折中，Rust 语言支持 unsafe 代码，在这部分代码中，编译器选择相信人类的判断。下面来自网友们的一段话十分形象地描述了 Rust 语言这部分的特性：  
> C++ 选择相信人类，它要求人类把自己 new 出来的东西给 delete 掉。
> C++：“这点小事我相信你可以的！“
> 人类：”没问题！包在我身上！“
> 然后内存泄漏，二次释放，野指针满世界飘...
> Java选择不相信人类，它自己替人类把事情办好。
> Java：”别动，让我来，我有 gc ！“
> 人类：”你怎么做事这么慢呀？你怎么还 stop the world 了呀？你是不是不想干了呀？“
> Java：”......“
> Rust 知道唯一的办法就是既不相信人类，也不惯着人类。
> Rust：”按我说的做！不然就不编译！“
> 人类：”你反人类！“
> Rust：”你管我！”
> 

Rust之所以反人类，是因为人类在编程这件事上，既愚蠢又自大，破事还贼多......  
对 Rust 的最后一点印象就是：社区庞大。  
虽然 Rust 社区还在建设中，但数量规模已经相当可观，其中不乏代码能力十分高强的人物，就好像武林世界一样，盘龙卧虎，各路大侠八仙过海，不断完善 Rust 的不足，目的就是为了推翻当前编程语言界的统治势力：C/C++。我国现在 Rust 社区起步较晚，目前还在萌芽状态，我作为一名计算机专业大二学生，有意推进国内 Rust 社区的进步和发展。  
另外 Rust 语言开发的模块化做得比较优秀。开发者们写的代码作为一个个的 crate ，可以很方便地被调用。  
虽说 Rust 学习成本较高，但也并不是什么洪水猛兽，只要多加练习，还是能逐渐地掌握这门新时代的系统语言的。  
## 初识 RISC-V
对很多人来说 RISC-V 是一个陌生的词，简单来说，这是一个区别于 x86, Arm 的计算机体系架构。  
具体地说，RISC-V 是一个基于精简指令集（RISC）原则的开源指令集架构（ISA）。它起源于2010年加州大学伯克利分校的一个项目，贡献者是许多志愿者和行业工作者。  
可以说我参加这个 OS 实习的最大收获就在这个 RISC-V 体系结构之上。在这之前，我一直局限于 x86 ，Arm 架构之中，RISC-V 给我带来了另一种可能性。  
我学习 RISC-V 首先是看了浙江大学的计算机组成原理课，这个课程是基于 RISC-V 进行授课的。然后看了[RISC-V手册](http://crva.ict.ac.cn/documents/RISC-V-Reader-Chinese-v2p1.pdf)和[RISC-V特权指令级规范](https://riscv.org/specifications/privileged-isa/)，内容挺多的，看了挺久。  
RISC-V 为操作系统提供了三种权限模式：机器模式（machine mode），监管者模式（supervisor mode）和用户模式（user mode）。默认情况下，发生所有异常的时候，控制权都会被移交到机器模式的异常处理程序，但是 Unix 系统中的大多数例外都应该进行监管者模式下的系统调用。机器模式的异常处理程序可以将异常重新导向监管者模式，但是这些额外的操作会减慢大多数异常的处理速度，因此 RISC-V 提供了一种异常委托机制，可以选择性地将中断和同步异常交给监管者模式处理。  
目前国内已经有不少产商或者高校或者研究所开始对 RISC-V CPU 内核进行研发了，据我所知的有国科大，他们正在写一个 RISC-V CPU 的内核，并且打算开源。目前这个领域还是很有潜力的。  
RISC-V 的学习道阻且长，而且现在 RISC-V 还在一直制定标准的过程中，相信将来，RISC-V 会取代当前 x86 的地位，成为新一代 CPU 的首选。  
## 理解 OS
首先来谈一下什么是操作系统吧。  
我的回答是：并没有一个明确的定义。  
然后我的理解是：操作系统是一个软件，这个软件功能比较强大，强大到所有其他的软件都调用它的库或者利用它提供的系统调用服务。打个比方，整个计算机系统就像一个森林，操作系统就是这片森林之下的土壤，而这之上的植物就好比软件，操作系统就为它们提供各种服务。  
操作系统为用户程序搭建了一个平台，为用户程序提供服务，使得用户程序在操作系统之上兴风作浪。这些服务主要是系统调用。  
操作系统还做的一件事就是帮助我们充分利用 CPU 资源。操作系统对线程，进程进行调度，通过某种调度算法合理分配 CPU 资源，使得我们的用户程序可以在操作系统上并发执行。这是操作系统对资源在时间上的管理。  
操作系统还对资源在空间上进行管理。这就是内存管理。操作系统通过页表机制将虚拟地址映射到物理地址上，而进程则运行在虚拟地址上。这样的机制既使得进程之间能够很好地隔离，又能充分利用内存资源，还能让进程的重定位十分方便地进行。另外操作系统上的文件系统能让用户方便地存取数据，文件，就像一个仓库，有理有条地存放着物品。  
操作系统还与外设进行通讯，它通过中断或者其他某种技术传递从外设传来的请求，并转到中断处理程序中处理。  
总而言之，操作系统像是计算机系统中的上帝，他掌管着一切，洞悉着一切。  
他又像一个仆人，为用户提供各种各样的服务，惯着用户，永远为用户着想。  
## 动手写操作系统
看着学长编写的 rCore Tutorial ，一步步地做着实验，一步步地打开写 OS 的大门。  
到现在已经做完了所有实验和大部分实验题，感受最深的就是：前人种树，后人乘凉。  
与其说我是在写 OS，不如说我是在学长们写好的框架上照葫芦画瓢，最后索性说学长们教我怎么写 OS。这种感觉就好像建楼房，人家已经把地基打好了，水泥柱子建好了，连困难点的装饰都弄好了，你需要做的就是往上面粘瓷砖，刷墙壁。惊讶于学长们学识的渊博，知识面之广，从 Makefile 到 Qemu 配置，从 Rust 到 SBI，涉及领域不够广是不可能构建出这样的框架来的。不由得对学长们感到敬佩。  
虽说如此，我还是从中学到不少的东西，学到这个框架本身感觉就是一笔很丰厚的财富了。经过这一轮的实验过程，我对操作系统的理解大大加深，对计算机体系结构的掌握大大提高，写 Rust 的能力大大加强，最重要的是，我更深刻地明白了“学海无涯苦作舟”的道理。  
Lab0：搭建实验环境，Qemu 运行起来的那一刻着实有点高兴。  
Lab1：中断，尝试实现了中断描述符表，Linux 爱好者的倔强。  
Lab2：内存分配，被模块之间的调用关系弄得晕头转向，好久才弄明白。  
Lab3：实现页表机制，页表建立起来的时候总觉得不太靠谱，直到内核成功重定向。  
Lab4：实现线程和进程，回头恶补了一下有关知识，感觉跑来跑去的线程虚无飘渺。  
Lab5：实现设备树和文件系统，看的时候信心满满，做的时候都是不懂。  
Lab6：实现系统调用，能在写好的内核上跑用户程序了，有点小开心。  
实验题：就像王润基学长所说，写 OS 的 bug 总是来得莫名其妙，debug 的时候总是很痛苦，但是做完的那一瞬间，还是感到有点自豪。  
## 一个月的成果
学习了一个月，努力了一个月，收获的成果可能不是很多，但也值得我骄傲一番了：  
+ 动手复现了 Lab0～Lab6 的所有代码：[Lab Code](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/)
+ 基于线段树的物理页面分配算法：[Segment Tree Allocator](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/Lab6/os/src/algorithm/src/allocator/segment_tree_allocator.rs)
+ 使用伙伴系统实现` VectorAllocator `trait：[Buddy System Allocator](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/Lab6/os/src/algorithm/src/allocator/buddy_system_vector_allocator.rs)
+ 实现操作系统捕获 Ctrl + C 并结束当前运行的线程：[Kill Current Thread](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/Lab6/os/src/interrupt/handle_function.rs)
+ 实现进程的` fork() `：[Fork Current Thread](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/Lab6/os/src/process/thread.rs)
+ 实现` Stride Scheduling `调度算法：[Stride Scheduler](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/Lab6/os/src/algorithm/src/scheduler/stride_scheduler.rs)
+ ` sys_get_id `系统调用：[sys_get_id](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/Lab6/os/src/kernel/process.rs)
+ ` sys_fork `系统调用：[sys_fork](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/Lab6/os/src/kernel/process.rs)
+ ` sys_open `系统调用：[sys_open](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/Lab6/os/src/kernel/fs.rs)
+ ` free list `分配算法[free_list](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/Lab6/os/src/algorithm/src/allocator/free_list_allocator.rs)
+ 在` interrupt `部分添加了中断描述符表` IDT `的实现：[IDT](https://github.com/SKTT1Ryze/OS_Tutorial_Summer_of_Code/blob/master/rCore_Labs/Lab6/os/src/interrupt/idt.rs)  

另外，我买了个` k210 `的开发板，并在上面成功跑通了` rCore-Tutorial `，这要得益于吴一凡学长做的工作。  
目前能力有限，没能在这上面更进一步的研究，在后面的学习中，我有兴趣继续进行` k210 `开发板的移植工作。  
## 感受
我很早之前就开始探索以后科研或发展的方向。曾经因为机器学习和深度学习领域的大热，我进行过一段在 AI 领域的探索，看了李航老师的《统计学习方法》，学了 tensorflow 深度学习框架，做过几个实验，看过几篇论文。一开始热情还挺高，后来觉得这个领域的数学理论占比太高，而我比较喜欢写代码，做实验，渐渐地就不那么感兴趣了。  
后面就广泛涉及各种各样的东西，想过学计算机图形学以后做游戏，也想过学嵌入式等等。不知不觉陷入了一个怪圈，不知所措。  
这次参加这个 OS 实习，那扇门好像要打开了。Rust 语言对于喜欢编程的我来说是一个新的事物，RSIC-V 带给我的惊喜不亚于 Rust 语言，而写 OS，则是我早就想干的一件事情了。契机应该是上个学期也就是大二第一学期末尾，我在我的笔记本电脑上装了 Linux 双系统，从此打开命令行世界的大门，一发不可收拾。从那开始，我就萌生了想要写 OS 的念头，奈何不知道如何入手。现在，我有着这么一个平台，这么一个框架，这么好的一个社区。我想，是时候大展拳脚了。  
谢谢陈渝老师和清华大学和深圳鹏城实验室举办的这个活动，我从中学到很多东西，无论是学术上的还是其他方面上的。也谢谢在会议上带给我们精彩演讲的国科大的老师和鹏城实验室的老师，丰富了我的知识视野。  
我收益这么多，那么自然，我应该给出点贡献，即使丁点大小。我会尽我的努力，为 rCore 社区贡献出我的一份力量，也会在后面的学习中不断探索未来的操作系统应该是什么样子的。我会为此而努力。  
