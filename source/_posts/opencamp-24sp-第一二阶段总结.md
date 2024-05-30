---
title: opencamp-24sp-第一二阶段总结
date: 2024-05-30 22:27:58
categories:
    - 2024春夏季开源操作系统训练营
tags:
    - author:achintski
    - repo:https://github.com/LearningOS/2024s-rcore-achintski
---
# DAY0-DAY?
## 0 前言
本篇内容为`基础阶段 - Rust编程`的总结，分为`环境配置`及`语言学习`两个板块。

因为语言学习涉及内容较为零散，故将DAY0-DAY?汇聚成一篇。

## 1 环境配置
### 1.0 前言
环境配置部分主要流程就是根据教程内容一步步安装，同时需要注意以下几点：
* 学会分析报错内容
* 学会利用搜索引擎/gpt解决报错问题
### 1.1 wsl+ubuntu22.04+vscode
之前在完成pintos时配置过，故省略

### 1.2 配置rust环境
按照LearningOS仓库中readme指定的[教程](https://rcore-os.cn/arceos-tutorial-book/ch01-02.html)一步步操作即可

注意没有`curl`需要先通过如下命令安装（其他同理）：
```bash
sudo apt install curl
```

### 1.3 配置git+github ssh并clone代码
之前配置过，故省略

注意：配置ssh后，git push到github时若仍然提示输入密码，可修改.git/config文件中的url，从HTTPS https://github.com/achintski/opencamp-24sp-daily.git 更新为SSH git@github.com:achintski/opencamp-24sp-daily.git

## 2 rust语法学习及rustlings
### 2.0 前言

* 初学一门新语言，通常可以采用孟岩老师提倡的“快速掌握一个语言最常用的50%”方法，快速入门
* 但注意到rust语言的特殊性以及接下来rCore的开发的复杂性，我们必须还要通过阅读系统而权威的大部头书籍来全面深入地学习
* 同时，一些特别细节的点在入门资料和书籍中未必涉及，需要我们查阅[官方文档](https://doc.rust-lang.org/stable/std/all.html)

因此我穿插查阅/参考了如下资料：
* 快速入门：
    * [菜鸟教程](https://www.runoob.com/rust/rust-tutorial.html)
    * [《Rust语言圣经》](https://course.rs/about-book.html)(最推荐，整合了很多其他的经典资料)
* 官方文档：
    * [The Rust Standard Library](https://doc.rust-lang.org/stable/std/index.html)
    * [《The Rust Reference》](https://doc.rust-lang.org/stable/reference/)
    * [《Rust By Example》](https://doc.rust-lang.org/rust-by-example/index.html)
* Slides:
    * [thu 程序设计训练（Rust）](https://lab.cs.tsinghua.edu.cn/rust/)
    * [2024春夏季训练营课程资料](https://opencamp.cn/os2edu/camp/2024spring/stage/1)
* Books：
    * [《The Rust Programming Language, 2nd Edition》](https://www.amazon.com/Rust-Programming-Language-2nd-dp-1718503105/dp/1718503105/ref=dp_ob_title_bk)

并通过穿插完成`rustlings`作业进行巩固练习

### 2.1 rust语法
#### 2.1.0 前言
注意：第一次学一个概念时一定要打好基础，不要为了追求进度而忽略质量
#### 2.1.1 常见内容
* HelloWorld
* 类型
    *原生类型
        * 布尔 bool：两个值 true/false。
        * 字符 char：用单引号，例如 'R'、'计'，是 Unicode 的。
        * 数值：分为整数和浮点数，有不同的大小和符号属性。
            * i8、i16、i32、i64、i128、isize
            * u8、u16、u32、u64、u128、usize
            * f32、f64
            * 其中 isize 和 usize 是指针大小的整数，因此它们的大小与机器架构相关。
            * 字面值 (literals) 写为 10i8、10u16、10.0f32、10usize 等。
            * 字面值如果不指定类型，则默认整数为 i32，浮点数为 f64。
        * 数组 (arrays)、切片 (slices)、str 字符串 (strings)、元组 (tuples)
        * 指针 & 引用
        * 函数
        * 闭包
    * 组合类型
        * 结构体（逻辑与）
        * 标签联合（逻辑或）
* 条件
* 循环
* 结构化数据
* IO
#### 2.1.2 特殊内容
Q：任何行为背后都有动机，Rust特性这样设计的动机是什么呢？

* 变量绑定--`let`
* 不可变变量 vs 常量
* 语句 vs 表达式
* 所有权 & 生命周期
    * 高级语言 `Python/Java` 等往往会弱化堆栈的概念，但是要用好 `C/C++/Rust`，就必须对堆栈有深入的了解，原因是两者的内存管理方式不同：前者有 `GC` 垃圾回收机制，因此无需你去关心内存的细节。
    * 在所有权模型下：堆内存的生命周期，和创建它的栈内存的生命周期保持一致
    * `copy` / `move`
    * `borrow`（借用）
        * 借用`&`与可变借用`&mut`
        * 借用规则
    * 函数的参数和返回值与变量绑定的规则相同


### 2.2 rustlings
大致步骤：终端输入命令`rustlings watch`、修改代码、删掉注释并自动跳转下一题
注意：后两个资料中概念介绍顺序和习题涉及概念顺序一致
技巧：学会分析编译器提示，有的题目是语法错误，有的是考虑不周导致测试过不去
* vec2
* enums3
* strings3&strings4
    * `into()`
* hashmaps2
    * `HashMap`的`get()`方法只能返回值的引用
    * 解引用操作`*`也需要转移所有权
* quiz2
    * match中模式绑定的值，如：`Command::Append(n) => {}` 中的n是&usize类型，可以使用`for i in 0..*n`完成遍历
    * 对于`不可变引用的string`，要想修改需要先将其`clone`给一个可变变量
* options1
    * 可用`match`，也可以用`if`
* options2
    * 注意`Options枚举`的本质目的：解决`Rust`中变量是否有值的问题，因此第二个任务中需要两层嵌套的`Some`
    * `if let` / `while let`本质上是`match`
    * `match`中匹配后的绑定
* options3
    * 在 `Some(p) => println!("Co-ordinates are {},{} ", p.x, p.y)` 处，value partially moved here；而在最后返回值`y`处，value used here after partial move
    * 因此需要：borrow this binding in the pattern to avoid moving the value
    * 区分`ref`和`&`
* errors2
    * 对于返回结果是`Result`的函数，一定要显式进行处理
    * `?`操作符（本质是宏，同时可以链式调用）
        * 作用：提前传播错误
        * 场合：返回值是 Result 或者 Option 函数中
        * 对于 Result 类型，
            * 如果是 Err 则提前返回，当前函数立即返回该错误。
            * 否则，从 Ok 中取出返回值作为 ? 操作符的结果。
        * 对于 Option 类型，
            * 如果是 None 则提前返回，当前函数立即返回 None。
            * 否则，从 Some 中取出返回值作为 ? 操作符的结果。
    * 本题既可以使用`?`操作符，也可以使用`match`
* errors3
    * `?`操作符只能在返回值为`Result` / `Option` 的函数中使用
    * 需要修改三处：
        * `use std::error::Error;`
        * 给`main`函数增加返回值 ` -> Result<(), Box<dyn Error>>`
        * 末尾返回 `Ok(())`
    * 也可以用`match` / `if else`
* errors4
    * 法一：利用`match guard`
    * 法二：`if` & `else`
* errors6
    * impl
        * rust中**对象定义和方法定义是分开的**
        * 一个/多个`impl`模块
        * `self`、`&self`和`&mut self`及所有权
            * `self`表示`实现方法的结构体类型的实例`的所有权转移到该方法中，这种形式用的较少
            * `&self`表示该方法对`实现方法的结构体类型的实例`的不可变借用
            * `&mut self`表示可变借用
    * 闭包
        * 可以看做匿名函数
        * ||中间放参数
    * map_err()
        * 用来处理Err类型的变量
        * 参数是函数/闭包
    * `PositiveNonzeroInteger::new(x).map_err(ParsePosNonzeroError::from_creation)`仅可以用来处理x<=0的情况，而x非数字的情况无法处理
        * `?`操作符：`Err` / `None` 类型直接立即结束，提前返回；否则从`Ok` / `Some` 中取出返回值作为`?`操作符的结果
        * 或者用match平替
* generics1
    * `&str` vs `String`
    * 也可以用`_`来让编译器自动推断
* generics2
    * 泛型可以类比多态
    * 结构体中的泛型 & 方法中使用泛型
    * 例如（from Rust Course）：
        ```rust
        struct Point<T> {
            x: T,
            y: T,
        }

        impl<T> Point<T> {
            fn x(&self) -> &T {
                &self.x
            }
        }

        fn main() {
            let p = Point { x: 5, y: 10 };
            println!("p.x = {}", p.x());
        }
        ```
        * 使用泛型参数前，依然需要提前声明：`impl<T>`
        * 上述代码中，`Point<T>`不再是泛型声明，而是一个完整的结构体类型，因为我们定义的结构体就是 `Point<T>`而不再是`Point`
        * 除了结构体中的泛型参数，我们还能在该结构体的方法中定义额外的泛型参数，就跟泛型函数一样
        * 对于`Point<T>`类型，你不仅能定义基于`T`的方法，还能针对特定的具体类型，进行方法定义
* *trait(特征)*
    * `impl Trait for Type`：为Type类型实现Trait特征
    * 特征定义与实现的位置(孤儿规则)
    * 方法的默认实现 vs 重载
    * `impl Trait`
        * 作为函数参数
            * `impl Trait`此时为语法糖,可用`特征约束`写出完整版
            * `多重约束`：`impl T1 + T2`
        * 作为函数返回值（只能返回某一种类型）
* quiz3
    * restricting type parameter `T`：`impl<T: std::fmt::Display> ReportCard<T> {...}`（根据编译器help提示）
* lifetims1
    * 标记的生命周期只是为了取悦编译器，告诉编译器多个引用之间的关系，当不满足此约束条件时，就拒绝编译通过；并不会改变任何引用的实际作用域
    * 和泛型一样，使用生命周期参数，需要先声明 `<'a>`
    * 本题中：把具体的引用传给`longest`时，那生命周期`'a`的大小就是`x`和`y`的作用域的重合部分，换句话说，`'a`的大小将等于`x`和`y`中较小的那个
    * 编译器提示：
    ```bash
        help: consider introducing a named lifetime parameter
        |
    13  | fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
        |           ++++     ++          ++          ++
    ```
* lifetimes2
    * 在`longest`函数中，`string2`的生命周期也是`'a`，由此说明`string2`也必须活到 println! 处，可是`string2`在代码中实际上只能活到内部语句块的花括号处`}`，小于它应该具备的生命周期`'a`，因此编译出错（编译器没法知道返回值没有用到`string2`）
    * hint：
    Remember that the generic lifetime 'a will get the concrete lifetime that is equal to the smaller of the lifetimes of x and y. 
    You can take at least two paths to achieve the desired result while keeping the inner block:
        1. Move the string2 declaration to make it live as long as string1 (how is result declared?)
        2. Move println! into the inner block
* lifetimes3
    * 结构体中生命周期标注：
        * 对结构体本身类似泛型：`<'a>`
        * 对结构体成员：`&'a`
    * 结构体成员引用的生命周期要大于等于结构体
* lifetime others
    * 输入生命周期 & 输出生命周期
    * 生命周期的消除
    * 方法中的生命周期（类似泛型参数语法）
        * `impl`中必须使用结构体的完整名称，包括`<'a>`，因为生命周期标注也是结构体类型的一部分！
        * 方法签名中，往往不需要标注生命周期，得益于生命周期消除的第一和第三规则
    * 静态生命周期
* tests4
    * `#[should_panic]`：The test passes if the code inside the function panics; the test fails if the code inside the function doesn’t panic.
<!-- * tests5（自动进行时这个被跳过了，直接到了迭代器）
    * unsafe函数：
        * 使用`unsafe fn`来进行定义
        * 这种定义方式是为了告诉调用者：当调用此函数时，你需要注意它的相关需求，因为Rust无法担保调用者在使用该函数时能满足它所需的一切需求
        * 因此在使用`unsafe`声明的函数时，一定要看看相关的文档，确定自己没有遗漏什么 -->
* iterators1
    * Rust的迭代器是指实现了`Iterator trait`的类型
    * 最主要的一个方法：`next()`
        * 对迭代器的遍历是消耗性的
        * 返回的是`Option<Item>`类型，当有值时返回`Some(Item)`，无值时返回`None`
        * 手动迭代必须将迭代器声明为`mut`可变，因为调用`next`会改变迭代器其中的状态数据（当前遍历的位置等），而`for`循环去迭代则无需标注`mut`，因为它会帮我们自动完成
* iterators2
    * `iter()`
        * `Iterator adapters`（*迭代器适配器*）
            * Adapters operate on an iterator and return a new iterator
            * 是*惰性接口*：iterators are lazy and do nothing unless consumed
            * 常见的有：`map()`、`filter()`、`take()`、`zip()`、`rev()`
            * 需要一个*消费器*来收尾，例如：`collect()`、`sum()`、`any()`
        * 注：如果集合里的类型是非`Copy`类型，消费者在取得每个值后，在迭代器被清除后，集合里的元素也会被清除。集合会只剩“空壳”，当然剩下的“空壳”也会被清除
        * 迭代器是*可组合的*
    * 一个例子：
        ```rust
        let v1: Vec<i32> = vec![1, 2, 3];
        v1.iter().map(|x| x + 1);
        ```
        map 函数的闭包并没有获得迭代器的所有权。具体解释如下：
        * `v1.iter()`创建了一个针对`v1`中元素的迭代器。这个迭代器是对`v1`的不可变引用，也就是说，它拥有对`v1`中元素的借用权，但并不拥有所有权。
        * `map(|x| x + 1)`是对上述迭代器应用的一个闭包。闭包内部的`|x| x + 1`表示对迭代器产生的每个元素`x`加上 1。在这个过程中，闭包接收的是`x`的不可变引用，同样没有获取`x`或迭代器的所有权。

        综上所述，闭包并未获得迭代器的所有权。它只是在`map`函数执行期间，对迭代器提供的每个元素借用并进行计算。一旦`map`函数结束，闭包对元素的借用也随之结束，不会影响到`v1`或其迭代器的所有权状态。
        ...
        如果您想让闭包返回的新值形成一个新的集合（如 Vec<i32>），您需要调用 collect() 方法来完成这一过程：
        ```rust
        let incremented_values: Vec<i32> = v1.iter().map(|x| x + 1).collect();
        ```
        在这里，`collect()`方法会消费`map`返回的迭代器，并将其内容收集到一个新的`Vec<i32>`中。然而，即使如此，闭包本身仍然没有获得迭代器的所有权，而是`collect()`函数在处理过程中获取了所有权并完成了数据的转移。
* iterators3
    * 从容器创造出迭代器一般有三种方法：
        * `iter()` takes elements by reference.
        * `iter_mut()` takes mutable reference to elements.
        * `into_iter()` takes ownership of the values and consumes the actual type once iterated completely. The original collection can no longer be accessed.
    * `collect()`会根据函数返回值自动调整格式
* iterators4
    * 这不让用那不让用，那自然是得用自带的工具咯
    * (1..=num).product()
* iterators5
    * 一点思考：
        ```rust
        fn count_for(map: &HashMap<String, Progress>, value: Progress) -> usize {
            let mut count = 0;
            for val in map.values() {
                // 此处为什么不是*val == value呢？
                // 下面这中方式中，实际上是在比较两者对应的实体是否相同
                if val == &value {
                    count += 1;
                }
            }
            count
        }
        ```
    * *扁平化（Flatten）*
        ```rust
        fn count_collection_iterator(collection: &[HashMap<String, Progress>], value: Progress) -> usize {
            collection.iter() // Iterate over the slice of hashmaps
                .flat_map(|map| map.values()) // Flatten the values of each hashmap into a single iterator
                .filter(|val| **val == value) // Filter values equal to the target value
                .count() // Count the filtered values
        }
        ```
    * 在上述实现中：
        * 首先使用 `collection.iter()` 创建一个迭代器，它遍历 `collection` 中的每一个 `HashMap` 引用。
        * 然后对每个 `HashMap` 应用 `flat_map(|map| map.values())`，将每个 `HashMap` 的值迭代器扁平化为单个包含所有 `HashMap` 值的迭代器。
        接着使用 `filter(|val| *val == value)`，筛选出与目标 `value` 相同的 `Progress` 枚举值。
        * 最后，通过 `count()` 方法计算筛选后的元素数量，即符合条件的 `Progress` 枚举值的总数，返回这个计数值作为函数结果。
* smart_pointers（*智能指针*）
    * 前言
        * 相比其它语言，Rust 堆上对象还有一个特殊之处---它们都拥有一个所有者，因此受所有权规则的限制：当赋值时，发生的是所有权的转移（只需浅拷贝栈上的引用或智能指针即可）
        * 例如以下代码：
            ```rust
            fn main() {
                let b = foo("world");
                println!("{}", b);
            }

            fn foo(x: &str) -> String {
                let a = "Hello, ".to_string() + x;
                a
            }
            ```
        * 在 `foo` 函数中，`a` 是 `String` 类型，它其实是一个智能指针结构体，该智能指针存储在函数栈中，指向堆上的字符串数据。当被从 `foo` 函数转移给 `main` 中的 `b` 变量时，栈上的智能指针被复制一份赋予给 `b`，而底层数据无需发生改变，这样就完成了所有权从 `foo` 函数内部到 `b` 的转移。
    * 在 `Rust` 中，凡是需要做资源回收的数据结构，且实现了 `Deref`/`DerefMut`/`Drop`，都是`智能指针`
* arc1
    * 使用 `let shared_numbers = Arc::new(numbers);` ：将 `numbers` 向量封装在一个 `Arc<Vec<u32>>` 中。
    * `Arc` 允许多个线程同时拥有对同一数据的访问权，且其内部的引用计数机制确保数据在所有持有者都不再需要时会被正确释放。这样，`numbers` 可以在多个线程间共享而无需复制整个向量，既节省了内存，又保证了线程安全性
    * 使用 `let child_numbers = Arc::clone(&shared_numbers);` ：创建 `shared_numbers` 的克隆（实际上是增加其引用计数）。每个线程都获得一个指向相同底层数据的独立 `Arc` 
    * `thread::spawn`创建一个线程
    * `move`关键字：指示闭包在捕获外部变量时采取“所有权转移”策略，而非默认的借用策略
    * `join()` 方法会阻塞当前线程，直到指定的线程完成其任务。`unwrap()` 处理 `join()` 返回的 `Result`，在没有错误时提取出结果（这里没有错误处理，因为假设所有线程都能成功完成）。这样，`main()` 函数会等待所有子线程计算完毕后再继续执行
* cow1
* threads1
    * 如果你想创建新线程，可以使用`thread::spawn`函数并传递一个闭包，在闭包中包含要在新线程 执行的代码。
    * 默认情况下，当主线程执行结束，所有子线程也会立即结束，且不管子线程中的代码是否执行完毕。极端情况下，如果主线程在创建子线程后就立即结束，子线程可能根本没机会开始执行。
    * 为避免上述情况的发生，我们可以通过阻塞主线程来等待子线程执行完毕。这里所说的阻塞线程，是指阻止该线程工作或退出。
    * `Rust`标准库提供的`thread::JoinHandle`结构体的`join`方法，可用于把子线程加入主线程等待队列，这样主线程会等待子线程执行完毕后退出。
    * `unwrap()`
* threads2
    * Mutex确保在某一时刻只有一个thread可以更新jobs_completed
    * thread闭包中，使用lock()上锁
    * 注意：
        ```rust
        println!("jobs completed {}", status.lock().unwrap().jobs_completed);
        ```
        如果放到循环内，就是输出10次`jobs completed x`，`x`的值有时候全是10，有时候有一部分是10；放到循环外就是一次`jobs completed 10`
* threads3
    * 报错内容：
        ```bash
           |
        29 | fn send_tx(q: Queue, tx: mpsc::Sender<u32>) -> () {
           |                      -- move occurs because `tx` has type `Sender<u32>`, which does not implement the `Copy` trait
        ...
        34 |     thread::spawn(move || {
           |                   ------- value moved into closure here
        ...
        37 |             tx.send(*val).unwrap();
           |             -- variable moved due to use in closure
        ...
        42 |     thread::spawn(move || {
           |                   ^^^^^^^ value used here after move
        ...
        45 |             tx.send(*val).unwrap();
           |             -- use occurs due to use in closure
        error: aborting due to 1 previous error
        ```
    * 分析：`tx`变量`move`到第一个闭包后，已经无法在该闭包外获取了，而在第二次进程创建仍然尝试`move`。通过为每个变量创建`tx`的`clone`，我们确保了每个闭包都拥有其独立的`sender`，从而避免了`use after move`错误
* macros4
    * 每个macro规则后面加;
* clippy1
    * 根据编译器提示修改
    * const PI: f32 = std::f32::consts::PI;
* clippy3
    * 已经通过 `is_none()` 检查确保了 `my_option` 是 `None`，因此接下来不应该再尝试调用 `unwrap()`
    * `Vec::resize` 方法用于改变已有向量的长度，如果新的长度大于当前长度，则填充指定的默认值。
        * 但是，你的用法存在一些问题。首先，你试图创建一个空向量（通过将大小更改为0），但直接使用 `resize(0, 5)` 并不是正确做法，因为这会让人们以为你要填充默认值5到一个空向量中，而实际上你是从一个非空向量开始的。
        * 如果你想从 `vec![1, 2, 3, 4, 5]` 起始，然后得到一个空向量，你应该直接使用 `clear` 方法，而不是 `resize`。
* as_ref_mut
    * 根据注释完成
* using_as
    * 报错内容：
        ```bash
           --> exercises/conversions/using_as.rs:17:11
           |
        17 |     total / values.len()
           |           ^ no implementation for `f64 / usize`
           |
           = help: the trait `Div<usize>` is not implemented for `f64`
           = help: the following other types implement trait `Div<Rhs>`:
                       <&'a f64 as Div<f64>>
                       <&f64 as Div<&f64>>
                       <f64 as Div<&f64>>
                       <f64 as Div>
        ```
    * 分析：错误提示指出 `f64` 类型没有实现 `Div<usize>` trait，因此无法执行除法操作。为了解决这个问题，我们可以将 `values.len()` 转换为 `f64` 类型，以便进行除法运算。
    在修改后的代码中，我们使用 `values.len() as f64` 将 `values.len()` 的结果转换为 `f64` 类型，以便与 `total` 执行除法操作。
* from_into
    * 为`Person`结构实现`From<&str>` trait
* from_str
    * 需要实现`FromStr` trait 来将字符串解析为 `Person` 结构体，并返回相应的错误类型 `ParsePersonError`

* tests5
    * 这段代码中，`modify_by_address` 函数使用了 `unsafe` 关键字来标记它的不安全性。根据注释，我们需要在函数的文档注释中提供有关函数行为和约定的描述。

    * 以下是修改后的代码：
        ```rust
        /// # Safety
        ///
        /// The `address` must be a valid memory address that points to a mutable `u32` value.
        ///
        /// It is the caller's responsibility to ensure that the `address` is a valid memory address
        /// and that it points to a mutable `u32` value. Failing to meet these requirements may lead
        /// to undefined behavior, such as memory corruption or crashes.
        unsafe fn modify_by_address(address: usize) {
            // SAFETY: The caller must ensure that `address` is a valid memory address
            // and that it points to a mutable `u32` value.
            let value_ptr = address as *mut u32;
            let value = &mut *value_ptr;
            *value = 0xAABBCCDD;
        }
        ```

    * 在函数的(文档)注释中，我们明确了对 `address` 参数的要求，即它必须是一个有效的内存地址，并指向一个可变的 `u32` 值。我们还提醒调用者必须满足这些要求，并在不满足要求时可能会导致的未定义行为。

    * 在函数内部，我们使用了 `address` 参数将其转换为一个可变的 `u32` 指针 `value_ptr`，然后通过解引用该指针获取可变引用 `value`。最后，我们将 `value` 设置为 `0xAABBCCDD`。

* test6
    * 这段代码中，我们需要实现一个 `raw_pointer_to_box` 函数，它将一个原始指针转换为一个拥有所有权的 `Box<Foo>`。我们需要根据给定的指针重新构建一个 `Box<Foo>` 对象。

* test7&test8
    * 在 `tests7` 部分，我们设置了一个名为 `TEST_FOO` 的环境变量，并使用 `rustc-env` 指令将其传递给Cargo。
    * 在 `tests8` 部分，我们使用 `rustc-cfg` 指令启用了名为 `pass` 的特性。
* test9
* algorithm1
    * Note that we use the `Ord` and `Clone` traits for the generic type `T` to enable value comparisons and cloning, respectively.
* algorithm2
    1. 定义两个指针 `current` 和 `prev`，分别指向当前节点和上一个节点。初始时 `current` 指向链表的头节点，`prev` 为 `None`。

    2. 进入循环，在每次迭代中:
        - 获取当前节点的可变引用 `node`。
        - 将 `current` 移动到下一个节点。
        - 将当前节点的 `next` 指针指向上一个节点 `prev`。
        - 如果 `prev` 不为 `None`，则更新上一个节点的 `prev` 指针指向当前节点。
        - 如果 `prev` 为 `None`，说明当前节点是新的尾节点，更新 `self.end` 为当前节点。
        - 将 `prev` 更新为当前节点。

    3. 循环结束后，将 `self.start` 更新为最后一个节点，即反转后的新头节点。

* algorithm9
    * 注意：在`next`中，对`vec`的处理除了要把最后一个元素拷贝到下标为`1`处，还需要把尾部元素用`pop()`删除。可以合起来写（后面加一个`?`），也可以分开。
        ```rust
        fn next(&mut self) -> Option<T> {
            //TODO
            if self.is_empty() {
                return None;
            }
            let result = self.items[1].clone();
            self.items[1] = self.items.pop().clone()?;
            self.count -= 1;
            self.heapify_down(1);
            Some(result)
        }
        ```
* 本地通过但autograde没通过：可以在actions-GitHub Classroon Workflow-最新的记录-Autograding complete的第二个日志中查看

# rCore-Tutorial-Guide-2024S通关札记

## 前言
之前在学习操作系统的文件系统部分时，被国内的部分课本深深“恶心”到了，有幸阅读OSTEP以及一些其他的国外著作（如Unix Internals）并走了许多弯路后我发现一个问题：对于初学者来说，操作系统这种非常“工程类”的学科，（入门/初级阶段）应该采取的正确学习思路是用“增量法”，具体来说：就是从一个具有最基础功能的操作系统出发，不断分析现有问题、解决问题从而实现功能上的完善（即增量），这也是符合操作系统发展的历史脉络的。好巧不巧的是，rcore采取的正是这种教学策略：
![Alt text](image-5.png)
要是能早点遇到该多好☹…

## 文档
rcore的文档非常之详细（对比xv6/pintos等），初学者很容易陷入到细节中去，因此在阅读文档/代码前建议先看一下每章的引言（相当于论文的abstract），明确每章要干什么以及代码的大致框架

## 环境配置
我自己采用的是（之前别的实验就配置好的）wsl2+ubuntu18.04+vscode+git，具体操作步骤文档内容写的很详细，网上也有很多相关教程

### 18.04安装qemu7.0.0
根据文档一步步操作至：出现报错
![Alt text](image.png)
![Alt text](image-1.png)
 
sudo apt-get install ninja-build
随后继续按照文档操作
最终：
![Alt text](image-2.png)
在bashrc文件中配置路径：
![Alt text](image-3.png)
![Alt text](image-4.png)

### 其余部分根据指导书操作即可

## rust语言
不建议花费太多时间，个人感觉比较靠谱的策略就是“迅速掌握一门语言的50%”，剩下的内容现学现用（按需调用）
重点：所有权和生命周期、类型系统
推荐资料：rust语言圣经、清华rust课程ppt

## ci-user本地测试
在确定好思路后一定要看一下测试代码再动手coding，有些测试并没有覆盖所有情况，因此一些特别繁琐的情况可以忽略掉（不是本次实验的重点）

## 技能点
锻炼自己快速上手工程类代码的能力

## ch3-lab1
``` rust
struct TaskInfo {
    status: TaskStatus,
    syscall_times: [u32; MAX_SYSCALL_NUM],
    time: usize
}
```
任务：新增系统调用sys_task_info

分析：sys_task_info本质上是对参数中用户程序传入的指针指向的结构体赋值，因此本次实验的核心围绕这些值展开，需要思考的点就是：这些值要存放在什么地方？什么时候初始化？什么时候更新？为了获取这些值需要设计几个函数，这些函数哪些只能内部使用哪些是开放接口？

具体思维过程：
1. 只存储最原始的数据，也就是在`tcb`中存储`syscall_times`以及进程首次被调度的时间`start_time`，在需要时再将他们拼装成`TaskInfo`
2. 变量初始化时机：`tcb`初始化
3. 变量更新时机：所有系统调用中，更新对应的`syscall_times[syscall_id]`用户程序（及`first task`）对应的tcb第一次被调用时，更新`start_time`（这就需要思考：负责进行任务调度的功能在哪里实现？怎么判断是否为第一次？）
4. 函数：
    * 将重复多次的操作封装成函数
    * 将私有变量/函数的操作封装成pub接口暴露给其他模块
5. 其他细节：空指针

## ch4-lab2
任务：重写`sys_get_time`和`sys_task_info`，增加`sys_mma`p和`sys_munmap`

分析：因为引入了虚拟内存机制，因此`sys_get_time`和`sys_task_info`系统调用传入的参数中，指针指向的地址是属于用户地址空间的，无法直接在内核地址空间中使用，需要进行转换。`sys_mmap`和`sys_munmap`手册里描述的有点模糊，实际上通过阅读样例可知，该系统调用的功能就是以页为单位进行分配/回收，而且不会出现复杂的情况（比如跨越`area`，部分可回收部分不可…），关键点就是边界条件、`port`以及每次分配/回收都要同时操作`pagetable`和`areas`，需要注意的点就是接口的设计问题（没有暴露出来的内容，需要用接口传参数进去在本地处理）

具体思维过程：
1. sys_get_time和sys_task_info可以参考：
![Alt text](image-6.png)
我们平常编写用户程序的代码时，对指向某一类型变量的指针（虚拟地址）使用解引用，可以获得对应类型的变量，这是因为mmu自动帮我们完成了地址转换功能

## ch5-lab3
### 需要移植（兼容lab1/2）的地方：
* start_time和syscall_times：tcb中添加，new中初始化，run_task切换进程中更新时间，各个系统调用（位于process.rs和fs.rs）中更新次数
* task_info：new定义，更新
* mmap和munmap：
* 系统调用次数更新：update_syscall_times
* page_table.rs和memory_set.rs和frame_allocator.rs中：一些用于检查的函数

* 注：
    * 第2-4都位于processor.rs（用于处理当前进程相关的内容）中
    * 注意实现细节的变化
    * 注意crate管理
    * 注意注释标出新增功能，以及impl需要文档注释

### 需要新增的功能：
* sys_spawn：
    1. 分析参数路径是否合法（参考exec）
    2. 返回值是pid/-1
    3. tcb impl中，实现spawn
    4. spawn中：（参考new+fork+exec）核心就是分配并初始化tcb，然后更新父进程内容，最后切换
        * tcb及其字段的分配参考new（除了tcbinner的parent）
        * 父进程更新父子关系、状态、最后加入taskmanager
        * 修改processor中的current
        * 销毁exclusive变量并进行__switch
* stride：（注意stride scheduling论文中的pass和stride的含义和本实验中相反，这里我们采用的是论文中的定义）
    * 变量：
        * tcb中新增stride、prio、pass
        * 全局变量新增BIG_STRIDE
    * 变量初始化：
        * prio初始16，pass初始0，stride初始BIG_STRIDE/16
    * 变量更新：
        * 每次调度后，更新pass+= stride（在run_task中）
        * 每次set_prio后，更新stride= BIG_STRIDE/new_prio

### 一些提交时未考虑到的细节：
* 切换前更新task_inner.start_time
* syscall_read没有更新syscall_times
* sys_spawn的trace中not implement忘记删除

## ch6-lab4
框架分析：思考读一个文件时发生了什么？

**easy-fs/src**

easyfs 文件系统的整体架构自下而上可分为五层：
1. 磁盘块设备接口层：/block_dev.rs
* 归根结底是在块设备上以块为单位读写，
* 读写磁盘块设备的trait接口-- BlockDevice trait（仅需read_block 和 write_block）
2. 块缓存层：/block_cache.rs
* 缓冲区是块设备的上一层，以块为单位管理对应的块缓存
* BlockCache：创建时会触发read_block
* BlockManager：以类似FIFO方式管理BlockCache，被换出时可能触发write_block
* get_block_cache 接口：通过block_id和block_dev参数，在BlockManager中查询对应的BlockCache，如果存在则直接使用，否则加载（核心是new中的block_device.read_block函数，将编号为 block_id 的块从磁盘读入内存中的缓冲区 buf）进BlockManger
3. 磁盘数据结构层：/layout.rs /bitmap.rs
* 典型unix布局：超级块+inode位图+data位图+inode分区+data分区
* 表示磁盘文件系统的数据结构：SuperBlock、Bitmap、BlockInode、DirEntry、DataBlock
* 注意：
    * 一个BlockCache块缓存对应一个块512B，而一个块中有4个BlockInode
    * 对BlockInode添加新的元数据字段需要修改一级索引的长度，以保证总大小为128B
    * DiskInode 方法：
    * get_block_id：数据块索引功能
    * read_at：将dkinode对应的文件从offset字节开始读到buf中（需要先通过get_block_id及索引定位到块号，然后用get_block_cache读入到内存中）
4. 磁盘块管理器层：/efs.rs
* 管理磁盘数据结构的控制逻辑
* EasyFileSystem
* 注意从这一层开始，所有的数据结构就都放在内存上了
* 重要方法：
    * get_disk_inode_pos
    * get_data_block_id
5. 索引节点层：/vfs.rs
* 对单个文件的管理和读写的控制逻辑
* Inode（why/how对应DiskInode）：通过用efs的get_disk_inode_pos方法和BlockInode的inode_id可以算出该BlockInode所在block的block_id以及磁盘内偏移block_offset，而用get_block_cache接口和block_id以及block_device可以获得对应Block的BlockCache，使用BlockCache的read/modify方法就可以读/写Inode对应BlockInode对应的块缓存中的区域。因此，总的来说定位一个BlockInode需要block_id、block_offset、block_device、fs四个要素，这也正是vfs Inode的组成
* 重要方法：
    * read/modify_disk_inode：读/写Inode对应的DiskInode对应的BlockCache区域

**easy-fs-fuse**

在（linux上的文件模拟出来的）一个虚拟块设备上创建并初始化文件系统

**操作系统中对接easy-fs文件系统的各种结构**

1. 块设备驱动层

    将平台上的块设备驱动起来并实现 easy-fs 所需的 BlockDevice Trait
2. easy-fs层

    借助一个块设备BlockDevice，打开EasyFileSystem文件系统，进而获取Inode数据结构，从而进行各种操作
3. 内核索引节点层
* 将 easy-fs 提供的 Inode 进一步封装成 OSInode
* OSInode 中要维护一些额外的信息
4. 文件描述符层

* 常规文件对应的 OSInode 是文件的内核内部表示
* 需要为它实现 File Trait
5. 系统调用层



## ch8-lab5
任务：sys_enable_deadlock_detect

分析：银行家算法（即通过对已知数据的计算完成死锁判断）很好实现，关键是在何时/以什么形式记录/更新数据

具体思维过程：
1. 把银行家算法涉及的所有数组封装成结构体，把相关的操作封装成对应的impl中的函数，并放到os/src/sync下一个新建的rs文件中
2. 注意到测试数据中仅考虑了单个用户程序中的死锁问题，并不需要（实际上也无法，因为没有跨用户程序的接口实现锁/信号量/条件变量）考虑用户程序间的死锁，因此我们要以用户程序即pcb为单位进行死锁检测。为此我们要为pcb新增一个字段来容纳死锁检测结构体实例（如果是所有用户程序之间也需要检测，我们可以用`lazy_static`来实现），这涉及了初始化及更新的问题。对于数组的下标，我们用`task_id`和`sem_id/mutex_id`来区分即可保证唯一性
3. 死锁检测结构体初始化需要在`impl`中实现一个`new`函数，把数组初始化为0/1，并在`tcb`初始化时调用；每次检测后（检测前也可以），我们需要将`finish`和`work`数组单独初始化一次
4. 更新主要围绕`available`、`allocation`和`need`数组，其中回收时（`sem_up/mutex_unlock`）`available+1`、`allocation-1`，分配时（`sem_down/mutex_lock`），若不能分配，则`need+1`，若能分配则`available-1`、`allocation-=1`。所有情况都需要考虑死锁检测，若检测成功则继续，若检测不成功则返回-0xdead（这里我们的实现不够优雅，需要在检测不成功时对数组恢复，实际上优雅的做法是把数组操作放在检测之后进行）。我们必须在最底层函数（`sem_up/mutex_unlock/sem_down/mutex_lock`）中实现，因为一但检测失败我们需要停止后续操作并立即返回。
5. 一些细节：比如`sem_id/mutex_id`需要用参数传递进去，以及为此需要修改`trait`…