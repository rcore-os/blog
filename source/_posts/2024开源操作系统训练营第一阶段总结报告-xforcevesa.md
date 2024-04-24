---
title: 2024开源操作系统训练营第一阶段总结-xforcevesa
date: 2024-04-24 17:58:06
tags:
    - author: xforcevesa
---

## 第一阶段 - Rust学习

### 前言小记

唠嗑一番：在此次开源操作系统集训营之前，我实际上已经参加过若干次了。最早的时候，是我对象在2022年看到了集训营的开营通知，并在GitHub的issue上回复来报名。然而，由于我之前没有留意到相关信息，错过了过去好几期的机会。这一次也算做是自己重来的机会吧。不过说起来，这个rustlings的确是我从去年一直做到了现在。今年直接新增10道数据结构题， ~~本fw直接没法也就上了亿点点unsafe，~~ 好在之前有经验，于是三天冲刺完成，就有了本文之第一阶段总结。

Rust何物者也？一个令人安如磐石的C++ Promax ~~（钟离老爷子看后点个赞）~~ ，胜任WebAssembly、普通命令行应用乃至操作系统编写。语法漂亮，match与macro非常赞。具有成体系的包管理器，安装导入新模块轻松如Python，rust-analyzer也很赞，提供比Pylance更好的高亮提示。运行效率也可以，看似充满了函数，其实llvm优化的也挺不错（

算啦，后面是正经时间，将展示本人写的代码示例和正经点的Rust学习感想，再次感谢清华大学开源操作系统集训营！

### 示例代码

#### Bellman-Ford

```rust
struct Edge {
    source: usize,
    destination: usize,
    weight: i32,
}

fn bellman_ford(edges: &Vec<Edge>, num_vertices: usize, source: usize) -> Vec<i32> {
    let mut distances = vec![i32::MAX; num_vertices];
    distances[source] = 0;

    for _ in 0..num_vertices - 1 {
        for edge in edges {
            if distances[edge.source] + edge.weight < distances[edge.destination] {
                distances[edge.destination] = distances[edge.source] + edge.weight;
            }
        }
    }

    for edge in edges {
        if distances[edge.source] + edge.weight < distances[edge.destination] {
            println!("图中包含负权重环");
            break;
        }
    }

    distances
}

fn main() {
    let num_vertices = 5;
    let edges = vec![
        Edge { source: 0, destination: 1, weight: -1 },
        Edge { source: 0, destination: 2, weight: 4 },
        Edge { source: 1, destination: 2, weight: 3 },
        Edge { source: 1, destination: 3, weight: 2 },
        Edge { source: 1, destination: 4, weight: 2 },
        Edge { source: 3, destination: 2, weight: 5 },
        Edge { source: 3, destination: 1, weight: 1 },
        Edge { source: 4, destination: 3, weight: -3 },
    ];
    let source = 0;

    let distances = bellman_ford(&edges, num_vertices, source);

    println!("顶点到源顶点的距离");
    for (i, &dist) in distances.iter().enumerate() {
        println!("{} \t\t {}", i, dist);
    }
}
```

## 学习感想

有了Rust这样一门强大而复杂的编程语言，我的学习之旅也就充满了挑战和收获。在学习Rust的过程中，我深刻体会到了其独特的设计理念和功能特性，这些特性使得Rust在系统编程领域有着独特的优势和价值。

首先，Rust的内存管理机制让我印象深刻。通过所有权（ownership）、借用（borrowing）和生命周期（lifetime）等概念，Rust实现了内存安全和线程安全，避免了常见的内存错误和数据竞争问题。虽然这些概念在开始时让我感到有些困惑，但通过不断的实践和阅读文档，我逐渐掌握了它们，并开始感受到它们带来的好处。与其他语言相比，Rust的内存管理机制让我感到更加自信，因为我知道我的程序不会因为内存错误而崩溃。

其次，Rust的模式匹配（pattern matching）和错误处理机制让我眼前一亮。模式匹配不仅可以用于解构数据结构，还可以用于控制程序的流程，使得代码更加清晰和易于理解。而错误处理方面，Rust引入了Result和Option等枚举类型，强制程序员处理可能出现的错误情况，避免了传统的异常机制带来的一些问题。学习如何利用这些特性编写健壮的代码是我学习Rust过程中的一大收获。

此外，Rust的并发编程支持也给我留下了深刻的印象。通过标准库提供的基于消息传递的并发模型，以及原子类型和同步原语等工具，Rust让并发编程变得更加安全和容易。我曾经尝试用Rust编写多线程程序，并发现在Rust的帮助下，我可以更加轻松地管理线程之间的通信和同步，避免了常见的并发错误。