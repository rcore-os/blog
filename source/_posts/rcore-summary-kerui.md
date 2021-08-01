---
title: rcore-summary-kerui
date: 2021-07-26 21:35:48
categories:
	- report
tags:
	- author:kerui
	- summerofcode2021
	- rcore-lab
---


## rCore第一阶段总结

<!-- more -->

当初是从 QQ 群里听说有这么个 Rust 开发操作系统的项目。我一直对 Rust 很感兴趣，无 GC 又不用担心内存错误而且还有一个很强的类型系统。在闲暇时间自己自学过 Rust，可是没有参与 Rust 项目的机会。所以听到 rCore 有提供这个活动立刻就去报名了。

但是当时已经有点晚了，超出了报名的截至时间，不过所幸报名问卷还没关闭，成功的报上了名。

### 过程

第一阶段的活动时间是 7 月 1 日～7 月 25 日。国内的话这个时候正是暑假，时间很合适，而我在读国外大学，这个时候刚好是期末月，实验室和期末的事情挤在一起，基本没有多少时间做第一阶段这些任务，参与得很是艰难。


#### Week 1 - 7.5 ~ 7.11

这周有好几门课结课，还有 lab 内的发表，基本就没什么时间做了。不过还好之前有学过 Rust，可以跳过 step 0。

**step 0 自学 rust 编程（大约 7~14 天）**

睡觉前还是抽了点时间复习了一下 Rust，用 Rust 刷了一下 LeetCode，顺便练习了一下算法。

做了做 32 Rust Quizes，里面有些问题还挺有趣的，有好些容易忽视的问题。

#### Week 2 - 7.12 ~ 7.18

这周只有一个一门课结课，发表也在下周，时间终于多了点。

**step 1 自学 risc-v 系统结构（大约 7 天）**

把 Privileged Spec 的 machine/supervisor 部分全部看了。Unprivileged Spec 挑着几章看了，比如 Introduction 和 Assembly Programmer's Handbook 部分。

然后把 The RISC-V Reader: An Open Architecture Atlas 看完了，最开始没注意到这本，很是后悔为什么没先看这本再去看 Privileged Spec。

**step 2 开发操作系统 -- based on qemu （大约 14~31 天）**

看 rCore book，做 lab 的任务

添加多核支持的时候有遇到一些代码上的问题，在 github issues 上提问了，很快的得到了回答。
- 比如我之前一直以为屏蔽中断会造成严重的后果，比如彻底漏掉某些中断的处理之类的。

也有遇到一些很诡异的问题，在 github issues 上和微信群内提问了，但是好像不知道怎么解决，只能想办法绕过去。
- 比如明明目标是 riscv64gc，却不能使用 mul 指令
- 比如在我确定 sp 正确设置，且没有栈溢出的情况下，传参会出现丢失的情况（更神奇的是如果我用 gdb 单步执行就不会出错

#### Week 3 - 7.19 ~ 7.25

这周又要忙期末的事，还还要忙 lab 内的发表，只能抽空搞搞活动。

继续看 rCore book，做 lab 的任务。

印象比较深的是 Rust 将 file systems 等的实现提取到单独的 crate 中 <br />
以及 Rust 如何用 trait 体现 Unix 的一切皆文件的抽象。在以前做 xv6 的实验的时候，这种事情只能依赖于约定，而在 Rust 的类型系统的加持下，编译器会为我们保证这些。


### 感想

Rust 不愧它说过的系统级编程语言的宣言，提供了计算机最底层的操作，而同时又允许我们在内核开发的时候使用高级的抽象。

[rcore-tutorial-book](https://rcore-os.github.io/rCore-Tutorial-Book-v3/chapter0/index.html) 里面各个章节讲解得无比细节，一边对照着书一边看代码非常有助于理解。如果有什么需要提高的话，希望测试的体验能够更好吧，比如像 6.S081 那样一键测试。

