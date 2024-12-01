---
title: 2024秋冬季开源操作系统训练营第一阶段总结-hbuxiaofei
date: 2024-11-07 19:21:30
tags:
---

## Rust之路

与Rust的邂逅，应该是大概2020年的某个白天，在TIOBE编程语言排行榜中突然看到了一个陌生的语言Rust。它的名字引起了我的好奇心，这个语言的出现，似乎暗示着某种新趋势，毕竟在那个时候，Python、Java和C这些传统大牌仍然占据着榜单的前列。

我当时并没有立刻去深入了解它，而是简单地在网上搜了一些资料。初步了解之后，我发现Rust似乎是一门致力于解决内存安全和并发问题的系统级语言，它通过所有权、借用和生命周期的概念，确保了内存的管理比C/C++更加安全，却又不牺牲性能。这个点吸引了我，因为作为一名从事系统开发的工程师，我深知内存安全问题的复杂性和严重性。

随着时间的推移，我开始在工作中接触到更多关于Rust的讨论，特别是在一些性能优化和系统底层开发的项目中。于是，我决定亲自试试Rust，看看它是否真如资料中所说的那样，能在保持高性能的同时，还能提供更高的安全性。

刚开始学习Rust时，我对它的独特设计感到既惊讶又困惑。尤其是Rust的所有权模型，它要求程序员明确控制内存的使用，这与我之前接触过的语言截然不同。比如，在Rust中，每个值都有一个所有者，并且只能有一个所有者，这样就避免了传统语言中的内存泄漏和悬垂指针等问题。起初我觉得这些概念过于复杂。每当编译器抛出错误，我常常需要花费大量时间去解读错误信息，理解这些错误背后的内存模型。

后面学习了几个rust视频，前后入门了好多回，才算弄懂了rust中一些基本的概念。学习过的视频里边最值得学习的当属[Rust编程语言入门教程](https://www.bilibili.com/video/BV1hp4y1k7SV)，这个视频的作者是微软的MVP开发者，讲解rust思路非常清晰，从不拖泥带水，并且视频做了后期处理，应该跳过的地方做了加速处理。

2024年初，通过rust中文社区微信公众号得知了opencamp训练营，由于所从事的行业跟操作系统打交道比较多，自己有比较喜欢rust，于是参加了cicv第一届中期训练营，这次也是抱着试试的心态，因为之前的初级训练营都没有参加，自从这次训练，通过rustlings的练习及课程中老师们对rust的讲解，以及最后的实践项目，rust进步了很多。

这次秋冬季开源操作系统训练营，很早之前就预览了往期的一些课程，看了往期的课程更是喜欢不已，很早就盯着开课的日程，终于在开课的第一时间就参加报名了，课上除了巩固了rust的很多基本知识，也学习到了一些新的有趣的特性，随着学习的不断进行突然又觉得自己只是学了个皮毛，rust还有大量的内容需要去摸索去学习。

总结起来，我与Rust的邂逅虽充满曲折，但最终成就了我作为开发者的一次重要转变。Rust教会了我如何更加精细地思考代码的内存管理和并发处理，如何通过语言本身的设计，去实现更高效、更安全的系统编程。在这段学习旅程中，我深深感受到它带给我的不仅是技术上的提升，更是思维方式的转变。


## Rust学习资源

[crates.io](https://crates.io/)
[docs](https://docs.rs/)
[Rust Language Cheat Sheet](https://cheats.rs/)
[rust std](https://doc.rust-lang.org/std/index.html)
[The Rust Programming Language](https://doc.rust-lang.org/stable/book/)
[Rust 程序设计语言 简体中文版](https://kaisery.github.io/trpl-zh-cn/title-page.html)
[Rust By Example](https://doc.rust-lang.org/stable/rust-by-example/)
[通过例子学 Rust](https://llever.com/rust-by-example-cn/index.html)
[exercisms.io 快速练习](https://llever.com/exercism-rust-zh/index.html)
[Learn Rust With Entirely Too Many Linked Lists](https://rust-unofficial.github.io/too-many-lists/index.html)
[leetcode for rust](https://docs.rs/leetcode_for_rust/0.1.37/leetcode_for_rust/)
[Command line utilities](https://lib.rs/command-line-utilities)
[Rust标准库分析 inside-rust-std-library](https://github.com/Warrenren/inside-rust-std-library/tree/main)
[Rust Playground](https://play.rust-lang.org/)
[rustexplorer](https://www.rustexplorer.com/)
[Rust编程语言入门教程](https://www.bilibili.com/video/BV1hp4y1k7SV)


## Rust个人小项目

[基于wasm的四六级英语学习项目](https://github.com/rayylee/keypress)
[vnc的rust接口封装项目](https://github.com/rayylee/libvnc-rs)
[kubevirt客户端工具](https://github.com/hbuxiaofei/kube-virsh)
[虚拟机加压工具](https://github.com/hbuxiaofei/virt-tools)

