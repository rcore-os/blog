---
title: kosl90-first-stage-summary
date: 2024-04-26 18:21:07
tags:
---

# 第一阶段总结

几天前在掘金上看到 rCore-Tutorial-Book-v3 这个项目相关的文章， 顺藤摸瓜发现正在进行 2024 年春季开源操作系统训练营。在确定了训练营是使用 rust 开发且没有报名限制后，出于对 rust 的兴趣便报名了此次训练营，希望能够更进一步的掌握 rust，同时也是工作多年后学习操作系统底层知识的良好载体。

训练营大约 4 月 7 日开始，已经开始了 3 周左右，因为有一定的 rust 基础，所为了赶进度，在没有看视频的情况下，加上利用上班休息时间，花了两天的时间，完成了第一部分的任务。不过由于 rust 的熟练度不足，数据结构很多细节也遗忘了，在完成任务的过程中也遇到了一些小麻烦。

## rust 相关的问题

rust 的问题主要还是熟练度的问题，包括 API 不熟练，对某些特性不够了解，例如 AsRef/AsMut/primitive pointer。这些问题在后续的 OS 相关开发中可能会成为障碍，后续需要进一步学习巩固。

## 数据结构的问题

数据结构的问题主要有两点：

1. rust 写递归数据结构相当麻烦，不仅需要多层包装，还会用到裸指针和 unsafe 相关的代码，再加上所有权和生命周期等问题，更是雪上加霜。具体多麻烦可以参考[Learn Rust With Entirely Too Many Linked Lists](https://rust-unofficial.github.io/too-many-lists/)

2. 工作多年，对数据结构本身的实现已经不够熟练了，因此重新学习一下个别数据结构。

## 第一阶段题目的问题

第一阶段的题目主要来源于 rustlings，某些题目不是很明确，所以刚上手的时候有点小困惑，不过这都是小问题，个人觉得堆的实现，可以改良一下。

### 现在的问题

现在题目的问题是直接为 `Heap` 实现 `Iterator` trait。这里的问题有两个，第一，堆这个数据结构适不适合实现迭代器，第二个，实现迭代器的方法不太好。

对于第一个问题，我个人的观点是可以，但是没必要，毕竟基本没什么场景会用到，我们主要看第二个问题。为了实现这个迭代器，只有两种方案:

1. 在 `Heap` 上直接记录迭代相关的信息，每次调用 `next` 方法后修改相关信息，这就导致只能在一个地方进行一次性的迭代。
2. 直接将 `next` 方法实现为删除堆中元素。


我在此处采用的是第二种方案，我相信应该有相当一部分同学是和我一样的，毕竟只要通过测试就可以了。

### 如何改良

以下是个人的改良建议：


第一种方案，为一个数据结构实现 `Iterator` 的正确做法应该是为其添加一个 `iter` 方法，该方法返回一个 `Iter` 结构体，然后为 `Iter` 结构体实现 `Iterator` trait。


第二种方案，不要为堆实现 `Iterator`，改为直接实现 `delete`

## 下一步规划

第一阶段可以算是紧赶慢赶的顺利完成了，接下来，在正式进入第二阶段前主要会重点在以下几个方面进行学习：

1. 学习 RISC-V 相关知识。RISC-V 是近些年的新架构，由于并非从事相关领域，对此并不了解，因此需要抓紧学习
2. 学习操作系统相关知识。工作多年，很多东西基本已经遗忘了，需要重新了解学习一番。
3. 学习巩固操作系统相关的 rust 语言特性。

## 在完成第一阶段用到的一些链接

### API 文档
- [Vec](https://doc.rust-lang.org/std/vec/struct.Vec.html)/[vec!](https://doc.rust-lang.org/std/macro.vec.html)
- [str](https://doc.rust-lang.org/std/primitive.str.html)/[string](https://doc.rust-lang.org/std/string/index.html)/[slice](https://doc.rust-lang.org/std/primitive.slice.html)
- [AsRef](https://doc.rust-lang.org/std/convert/trait.AsRef.html)/[AsMut](https://doc.rust-lang.org/std/convert/trait.AsMut.html)
- [pointer](https://doc.rust-lang.org/std/primitive.pointer.html)/[Box](https://doc.rust-lang.org/std/boxed/struct.Box.html)/[NonNull](https://doc.rust-lang.org/std/ptr/struct.NonNull.html)/[Cow](https://doc.rust-lang.org/std/borrow/enum.Cow.html)
- [HashMap](https://doc.rust-lang.org/std/collections/struct.HashMap.html#)
- [HashSet](https://doc.rust-lang.org/std/collections/struct.HashSet.html)

### 其他参考资料

- [Mutex & Channel](https://doc.rust-lang.org/book/ch16-03-shared-state.html)
- [#\[macro-export\]](https://doc.rust-lang.org/book/ch19-06-macros.html)
- [#\[should_panic\]](https://doc.rust-lang.org/rust-by-example/testing/unit_testing.html)
- [build script](https://doc.rust-lang.org/cargo/reference/build-scripts.html)
- [Clippy lints](https://rust-lang.github.io/rust-clippy/v0.0.212/index.html)
- [Binary Heap](https://en.wikipedia.org/wiki/Binary_heap)
- [min heap](https://robin-thomas.github.io/min-heap/)
