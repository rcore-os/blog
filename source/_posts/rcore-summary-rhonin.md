---
title: rcore-summary-rhonin
date: 2021-07-29 19:50:16
categories:
	- report
tags:
	- author:rhonin
	- summerofcode2021
	- rcore-lab
---

## rCore第一阶段总结

<!-- more -->

我从了解到Rust语言开始就非常喜欢这门语言，之前也用rust刷过一段时间的leetcode，但苦于没有一个项目用来练手。之后在逛Rust中文社区时，了解到这个活动后就毫不犹豫的参加了。

当初参加这个活动的主要目的是为了提高我Rust的编程能力，但是这一个月来提高的不仅仅是编程能力，还学到了很多操作系统和RISC-V的知识。第一次体会到了一个操作系统从零开始的构建过程，对操作系统的理解又加深了许多。总得来说，这一个月的收获还是颇为丰富的。

### Rust

参加活动之前我一直认为我的Rust掌握的还可以，但是经过[rustling](https://github.com/rust-lang/rustlings) 和 [Rust Quizes](https://dtolnay.github.io/rust-quiz/1) 这些练习的洗礼后我才发现我还是太年轻，太naive了。虽说这些小练习能够帮助我们巩固Rust的知识点，但是某些方面涉及的还是有点少，如宏和生命周期。要想熟悉这些内容还得去找对应的资料（《Rust编程之道》已经很详细了）。

从rcore-tutorial中的源码中也学到了不少unsafe的知识点。像在代码中非常常见的把函数名转成函数的入口地址、从指定长度的字节数组中读取指定数据。可以想象，之前从未涉及底层操作的我见到这些写法时有惊奇。



### RISC-V

在学习RISC-V的指令集前我先看了一天的《汇编语言》（王爽），这书虽然是以8086cpu为例的，但对了解寄存器的相关知识还是很有帮助的。我只看了前几张，这是我记得一些[笔记](https://codechina.csdn.net/qq_21726851/rcore-rust-rhonin/-/blob/master/doc/day13-%E6%B1%87%E7%BC%96%E8%AF%AD%E8%A8%80.md)

之后是浙大的一门在线课程 [计算机组成与设计：RISC-V](https://www.icourse163.org/course/ZJU-1452997167) 主要是前两章。看完之后再去看RISC-V的手册就更容易理解里面的内容。这里有一点我看在线课程的[笔记](https://codechina.csdn.net/qq_21726851/rcore-rust-rhonin/-/blob/master/doc/day16-RISCV%E6%8C%87%E4%BB%A4.md) ,我是看了前三章，看完后发现第三章及之后的内容和这次活动的关系不大。

[RISC-V手册](http://crva.io/documents/RISC-V-Reader-Chinese-v2p1.pdf) 的下载地址。



### Tutorial

[rcore-tutorial-book](https://rcore-os.github.io/rCore-Tutorial-Book-v3/chapter0/index.html) 里面各个章节的内容都是循序渐进，可以说是非常的贴心了。

这部分的学习最好还是不要一开始就扎进代码中，把握好了整体的框架后再去阅读代码能达到事半功倍的效果（应该说所有的项目都是这样起手）。越往后的章节，代码量越大，我经常是看了后面的会忘了前面的讲的啥。所以我都是用IDEA看代码的，因为IDEA里可以看一个文件的结构，包括结构体、方法什么的（不知道vscode有没有这个功能）。这样看完具体实现后只需关心对外提供的方法就行了。

每个chapter的基本实验我都写了一点实现思路，都在[report](https://codechina.csdn.net/qq_21726851/rcore-rust-rhonin/-/tree/master/report) 目录下（然而那些challenge完全没有思路）。

还有就是我是在进行该阶段之后再学习的RISC-V，到某一章的时候突然感觉理解起来非常吃力，所以赶紧去补充这些基础知识。



### 感想

很早就注意到了用Rust写操作系统的实验。每次想开始的时候都对会对自己说，等有时间的时候马上着手进行，但应该被我推了有一年左右了。如果不是有这次的活动，让我强行把其它事情往后推的话，或许我还能继续拖下去🤣。

项目严格来说并不是从零开始，因为其中用到了很多的第三方crate。但这些crate帮我们完成了很多细枝末节的任务，从而让我们更加专注于操作系统本身。这也反应了Rust的生态在向越来越好的方向发展，期待Rust大放异彩的哪天。

