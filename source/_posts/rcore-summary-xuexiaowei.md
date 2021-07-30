---
title: rcore-summary-xuexiaowei
date: 2021-07-29 17:54:21
categories:
	- report
tags:
	- author:SummerVibes
	- summerofcode2021
	- rcore-lab
---

# 阶段一总结

<!-- more -->

## 自学rust编程

rust 是参加夏令营前就学过的，看了rust权威指南，rust编程之道，也做了一些小项目。7月前半个月我其实都在实习，做的是rust后端，项目上线之后，我就果断辞职去学rcore了。实习期间我就趁下班或是周末，用rust刷刷算法题，并把rustlings做完了，还在微信群里帮助群友解决了一道 32 Rust Quizes中的题。

### rustling

这个我觉得比较简单，周末一天就弄完了，不过也遇到了不少问题，都记录在第一周的[学习记录](https://codechina.csdn.net/lean2/learnrcore/-/blob/master/weeks/%E7%AC%AC%E4%B8%80%E5%91%A8.md)中了。

### rust 刷 leetcode

rust刷leetcode总体来讲是有点麻烦的，rust安全的特点在算法题中较难体现出来。但是rust抽象度高的优点倒是能发挥地淋漓尽致。我一共刷了10道题，没有达到要求中的15道，主要是因为在实习，所以时间有点紧。挑选算法题时以数组，树，链表，字符串等类型为重，重点在于练习如何用rust操作/编写数据结构，而不是学习算法。[学习记录](https://codechina.csdn.net/lean2/learnrcore/-/blob/master/weeks/%E7%AC%AC%E4%BA%8C%E5%91%A8.md)

### rust 后端开发实习

rust用来后端开发体验很棒，基本上只要编译通过，程序就能正常运行，所以rust使我按时下班了。但是我发现还是有一些事情需要注意
1. 必须严肃处理每一个result和option，否则线程直接panic，便会被前端吐槽
2. 错误处理非常重要，使用 ？语法糖来简化错误处理也非常重要，层层的match会让程序可读性变差，代码难以维护，review时会被吐槽
3. 使用的crate的版本一定要在Cargo.toml中标明
4. 用好trait能够让我更快地开发新功能，更早下班
5. 将结构体中不变和可变属性分离，能够减少需求变动导致的代码变动量，能够让我更早下班
6. 认真写 doc 注释 和 documentation examples 能够提升同事和自己的幸福感

## RISC-V

刚开始是打算在学rCore的过程中学risc-v的，后来在ld文件和汇编文件那里吃了苦头，于是还是认真的看了risc-v汇编手册，认真背下了Sv39相关的寄存器和虚拟/物理页表结构，后面rCore中关于risc-v的内容就没什么问题了。

## rCore 学习

我的学习方式是看rCore Tutorial 然后做rCore Lab（一共六个）

做实验的过程挺艰辛的，过程一般是这样的：
下午看tutorial，一般要花3个小时左右，有时候一遍看不透，就要看多遍，然后就去熟悉lab的代码，之后拟出一个简单的方案，其实就是列出个一二三四，这是我写代码的习惯了，然后便是写代码，最后测试。

然而，很少有写完代码后一次测试直接通过的情况，往往是写完之后要反复debug，debug占据了大量时间，所以做lab那6天每天都会熬夜。许多bug一开始让我感觉莫名奇妙，甚至怀疑是不是rust或者qemu出了问题，最后无一例外都是排除了种种可能性后发现自己太蠢了，是自己对OS的理解有误造成的。

[lab代码和总结](https://codechina.csdn.net/lean2/learnrcore/-/tree/master/lab)
