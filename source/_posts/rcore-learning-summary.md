---
title: rcore learning summary
date: 2024-04-26 21:42:48
tags: 
    - author:jinqianchen637
    - rust
    - rustlings
    - rcore
---

从公众号文章中看到这次rust OS 夏令营活动， 抱着开阔眼界， 多认识同行的目的， 于是报名参加了。

第一阶段是学习rust 基本语法， 作业是使用rustlings 做110 道题。

我是两年前学习的rust 语言， 这两年也基本上在用rust 做项目，语言基础这块还是比较有信心的。但是做这些题也并没有像砍瓜切菜般，刷刷刷的一晚上搞定，花了两晚上做完100道基础题，又花了两晚上昨晚10道算法题。

主要的原因呢，是这些题目是很全面的，除了future async await 之外，关于rust 的各个方面都涉及到了。
比如 unsafe, 我可以说，写项目快两年，我没有写过一行unsafe，做题的过程也全面复习了一下rust 语言，这也算收获之一吧。

类似的， 我比较少用的方面包括， 自己实现trait， 自己实现macro,

记录一下我遇到的一些比较有趣的问题，或许对新学者有点帮助。很多是群里大家讨论的问题。
#  statge one, rustlings
## 重点和非重点（对初学者，应用层）

我学习用到的书是 << programming rust >>，现在有第二版了。

全部基于个人感受，和项目中使用的频率。非重点不代表不重要，只是说，如果你做的项目是偏向应用层的，这些内容需要理解，但很少会自己实现。如果是底层相关的，或者开发rust 库，这些可能会是重点，且常用。

重点：
    + 枚举和表达式， 我常常复习的章节， 真的很常用
    + 迭代器，不用迭代器也能实现各种各样的功能， 但是这样的C/C++ 风格不推荐。迭代器真的很有用，也很好用
    + 闭包，可能很多人第一感觉是很少会用到，但是出人意料的是，闭包还算比较常用。像迭代器一样，rust 推荐使用闭包，对闭包也有专门的性能优化
    + 错误处理，这个是rust 不同与其他很多语言的一个地方，也是很多人不理解的地方。初步处理时可以不用像库作者一样严格，结合枚举和闭包，也可以妥善处理。进阶的处理办法，需要稍微研究一下anyhow 和 thiserror 库。不要 unwrap 了之（重要的话手动乘以三遍）
    + 所有权和生命周期，老生长谈的重点，我就不说了，理解就好

非重点：
    + macro， macro 属于高级技巧， 应用层代码基本不会有自己手写macro 的需求，最多会用别人写好的。对于web 框架这种情形，很多人更喜欢函数实现的库，而非宏实现的库。对于有些不得不使用宏的场景，如DSL，再去学习研究就好了，早期没必要在这儿花很多时间
    + unsafe, 对于写OS 这种场景，unsafe 属于是必备技能了，但是对于普通的应用层，基本用不到。
    + 操作符重载， 知道就好了， 反正我没碰到过一次需要我手写操作符重载的
## Copy and Clone
    这个问题是群里大家讨论的时候提到的。Copy 是所有权转移的一种例外，实现Copy trait的类型， 赋值和传参数时， 会隐式复制。
    参考 << programming rust >> page 71, 4.3 章节, page 236， 13.4 章节。
    只说结论， Copy trait 是一种标记特型， 从代码上看 Clone trait 是其父特型，但是这并不意味着需要调用copy 方法的地方，
    内部在调用clone 方法。copy 使用的仍然是内存中的按位复制方法。这两个特型之间的关系应该是一种逻辑关系，即可copy 的对象一定都是可clone 的。
## unwrap ?
    初学者（包括我）都会简单粗暴的使用unwrap，但是写了足够多项目代码之后，才终于明白了unwrap 是啥，到底应该怎么用。
    我是在经历过上线的程序突然挂掉，集成第三方库总是莫名其妙的报错之后， debug 到怀疑人生之后， 才终于意识到这个问题的。
    + 结论就是，不要用unwrap， 除非你已经检查过了，能够完全确定这个unwrap 不会报错，然后让你的程序直接挂在这儿。
    unwrap 是程序员对rust 程序的一种承诺，我已经检查过了，程序你就大胆的往下执行吧，出错了我也不会怪编译器，不会去问rust 不是号称现代，安全的编程语言吗，为啥会莫名奇妙挂掉了。
    初学者往往会滥用unwrap, 在不知道自己已经做出了上述这些承诺的情况下。
    函数中如果使用了unwrap， 会有一个标记trait, 标记此函数为非 Infallible， 这样在集成某些第三方库时，由于第三方库接口要求，而导致我们实现的函数不满足第三方trait 的要求，从而导致编译失败。
    解决unwrap 滥用的一种常用办法是，使用watch， ? 或map_err 等方法，处理掉每一个 Result/Option 类型。
## match expresion too deep nested
    使用match 处理 Result 和 Option 类型是常见的操作，但是问题在于这种处理多嵌套了一层，
    一不小心就会陷入多重分类讨论，层层嵌套的问题，看不清代码逻辑主干。下面是我应对的一种办法：

+ 一种方式 
```
// algorithm4.rs
fn search(&self, value: T) -> bool {
    match &self.value {
        x if *x == value => { return true; },
        x if *x > value => { 
            match &self.left {
                None => false,
                Some(left) => {
                    left.search(value)
                }
            }
        },
        x => {
            match &self.right {
                None => false,
                Some(right) => {
                    right.search(value)
                }
            }
        }
    }
}
```

+ 另一种方式

```
// algorithm4.rs
fn search(&self, value: T) -> bool {
    match (&self.value, &self.left, &self.right) {
        (root_val, _, _) if *root_val == value => { true },
        (root_val, Some(left), _) if value < *root_val => { 
            left.search(value)
        },
        (root_val, _, Some(right)) if *root_val < value => {
            right.search(value)
        },
        (_,_,_) => false
    }
}
```
