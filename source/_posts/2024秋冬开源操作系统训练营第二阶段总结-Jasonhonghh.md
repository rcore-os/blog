---
title: 2024秋冬开源操作系统训练营第二阶段总结-Jasonhonghh
date: 2024-11-08 10:58:18
tags:
    - author:jasonhonghh
---
# Rustlings

**这是我第一次刷Rustlings，还是很有收获的。最后新增的一些算法题也很有意思，不过整体来说还是适合有Rust语法知识基础的人学习。最后几个算法题刷的很慢，我的数据结构和算法学的不是很好，在这里有学到很多。不过我也参考了许多资料。如果有人看的话，也算一点收获叭。整体来说Rust写起来很爽！**

# 参考资料

## Rust语法基础

**初学者应该主要从三个方面了解Rust：Rust语法基础，Cargo以及Rust的标准库和官方文档。**

[Rust 程序设计语言 - Rust 程序设计语言 简体中文版](https://kaisery.github.io/trpl-zh-cn/)

**这是社区推荐的的**[The Rust Programming Language](https://doc.rust-lang.org/stable/book/#the-rust-programming-language)的中文翻译版本。主要讲Rust语法基础，国内有开源作者撰写了[Rust语言圣经](https://course.rs/about-book.html)两本书的内容比较相似，后者语言比较生动，内容也比较丰富，前者的话语言精炼一些，个人比较推荐去读前者，读不懂的时候再去看Rust语言圣经的版本，会有新的收获。

## The Cargo Book

[Introduction - The Cargo Book](https://doc.rust-lang.org/stable/cargo/)

**The Cargo Book是关于Cargo的一本书，初学者可能只会使用到Cargo的一少部分命令和参数，但实际上，Rust受到广泛关注的一个原因，就来自于强大的构建和包管理工具Cargo，值得注意的是这本书的中文翻译版本最后的更新时间是2019年，相关的内容和英文最新版差别比较大，最好读英文版本。**

## Rust标准库文档

[List of all items in this crate](https://doc.rust-lang.org/std/all.html)

**Rust的标准库文档涵盖了基础阶段大部分的内容，结构体、宏、智能指针等等都在标准库文档中有详细的说明，Rust程序相比其他许多语言确实比较在学习和编写上难度更大 ，但是Rust设计者们也在极力减少开发者的心智负担，对于一些数据类型和结构，标准库中定义了一些好用的方法和属性，方便大家学习和使用。另外，标准库中也定义了一些基本的API接口，方便开发。总之Rust标准库是一座宝库。**

## Rust

[crates.io: Rust Package Registry](https://crates.io/)

**crate.io是提供了诸多Rust开发者开发的库，可以直接在cargo.toml里面配置库名和版本就能使用，很方便，基础阶段Rust标准库文档是小宝库，在后续进阶开发阶段，crate.io就是名副其实的大宝库。言下之意是，基础阶段暂时不用看这个。**

## Youtube

[Rustlings 5.0 | Intro | Learn Rust Interactively](https://www.youtube.com/watch?v=ogCvZC-o0ms&list=PLNZe95GmIRd_lrbSdcjCT2V7uG4pVhn0S)

**目前国内的Rust学习资源还在初级阶段，B站上暂时没有很完善的教程，推荐一个油管博主的视频，讲到比较陌生不好理解的地方，博主会把Rust基础教程和标准库文档贴出来，对着讲解，还是很有收获的，还能教你怎么快速找到自己需要查的知识点。但是这个博主是之前录的视频，没有训练营版本Rustlings最后一些练习的讲解。
