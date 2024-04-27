---
title: 2024春夏季开源操作系统训练营第一阶段总结报告-DirckYHP
date: 2024-04-26 15:45:52
categories:
    - 2024春夏季开源操作系统训练营
tags:
    - author:Dirck-YHP
    - repo:https://github.com/Dirck-YHP/Blog-For-ThuOS
---

# 2024春开源操作系统训练营
## 第一阶段总结
### 引言
    很早之前就听说过rust，但是一直没有机会专门去学习（其实是懒哈哈哈），通过朋友了解到thu的这个开源os训练营项目是基于rust的，一下子就来了兴趣，正好最近在学习操作系统的知识，干脆就一起学了吧！就当是给自己的一个鞭策啦！虽然做的比较慢，但是很庆幸自己还是把rust的基础语法过了一遍，但是一些细节可能需要在实践中深入学习掌握。下面简单介绍一下学习的过程。

[小白的日常记录](https://github.com/Dirck-YHP/LearningOS) 比较简略了哈哈哈
### 参考资料
群里有很多人已经给出了学习的参考资料，这里推荐一下我用到的：
- [Rust程序设计语言](https://www.rustwiki.org.cn/zh-CN/book/)
课程就是按照这个进度来讲的，rustlings也基本是这个顺序，所以我主要看的就是这个
- [Rust语言圣经](https://course.rs/about-book.html)
很火的Rust语言学习资料
- [通过例子学Ruts](https://rustwiki.org/zh-CN/rust-by-example/index.html)
demo比较多，注释也很详细
- 大语言模型(ChatGPT, Kimi, ...)
4202年了，相信AI能帮你在入门阶段解决很多问题！

### 学习总结
有其他的高级语言的基础，Rust的基础语法学起来其实挺快，本人平时使用C/CPP和Python较多，所以在学习Rust的时候下意识会对比类比这些语言的特性来学习。
Rust总体给我的感觉还是比较惊喜的，它确实省去了程序员的很多心思。C/CPP是那种给予了程序员足够的自由，什么都让程序员自己来管，但出了事也得是自己哼哧哼哧debug，比如我指针乱指都能编译通过(点头哈哈哈)，自由但费神；而rust直接在编译阶段就给我喊停了，程序员必须符合它的要求来code，语法上做了限制，但是同样的，也就意味着更安全。

- Cargo是rust的一个比较大的特色，比起cpp中使用cmake来进行包管理，cargo在我看来要更轻松一些。
- 内存安全：Borrow和所有权系统
- 并发：std::thread和std::sync::mpsc，避免了常见的并发bug
- 模式匹配：match、if let和while let
- 错误处理：Result和Option
- 生命周期：表达引用的有效范围
- 宏系统和各种类型：像枚举和各种trait

anyway，总之我觉得rust是个蛮不错的现代语言，来日方长，一步一步接触学习。
