---
title: 一阶段rustlings总结-折鸦
date: 2025-04-19 14:58:35
tags:
  - Rust
  - rCore
  - ArceOS
---

# 操作系统设计与实现中常用的 Rust 特性

oscamp 第一阶段的 rustlings 总结, 但因为去年写过一次 rustlings 了, 题目比较基础(~~除了最后的算法和数据结构实现有点麻烦~~)之前也接触过不少 Rust, 所以这次是总结一下二三阶段中特别需要的 Rust 特性

## 结构体和枚举

注意**元组结构体**

```rust
struct TupleStruct(u32, u32, u32);
let tuple_obj = TupleStruct {0, 255, 0};
assert!(tuple_obj.0, 0);

struct UnitStruct;
```

单元结构体主要是在不关心其关联的数据, 而只需要实现其关联函数或方法时存在     
其实还比较常用的, 例如对某学基本数据类型的特化, 比如 rustlings 后面的 `MinHeap`, 三阶段中也有这样的情况     

枚举这里需要比较熟悉 match 等模式匹配的手段: 

```rust
match message {
    Message::Move(p) => self.move_position(p),
    Message::Echo(s) => self.echo(s),
    Message::ChangeColor(x, y, z) => self.change_color((x, y, z)),
    Message::Quit => self.quit(),
    _ => ()
};
```

本实验中大量使用枚举来表示一些错误情况(这也是 Rust 和一些程序设计语言的常见处理方式)

二三阶段处理 Trap 时的 `Trap::Exception(...)` `Trap::Interrupt` 也都是枚举, 通过 match 模式匹配

## 模块

模块这里 rustlings 的考察比较基础, 这里补充一些 Cargo 管理工程的机制

* `module` 用于代码结构分层, 控制作用域和可见性等

    Rustlings 只介绍了内联模块 即 

    ```rust    
    mod delicious_snacks {
        pub use self::fruits::PEAR as fruit;
        pub use self::veggies::CUCUMBER as veggie;
        ...
    }
    ```

     但实际工程中还有很多创建模块的方法, 例如:

    * 拆分到一个文件中, 然后用 `mod name;` 声明告诉编译器这里有个模块. 声明后才会进入模块树.
    * 复杂模块应拆分到一个目录中, 并在这个目录下 `mod.rs` 中暴露接口和声明子模块, 这个目录下的其他文件就是这个目录的子模块, 例如 `foo/mod.rs` 中写下 `pub mod bar;`, `foo/bar.rs` 就成为了 `foo::bar` 子模块
    * `mod foo;` 会查找 `foo/mod.rs` 或 `foo.rs`

    例如三阶段 ArceOS 实验二, 需要在 `axstd` 下面创建 `collections` 子模块(创建`collections/mod.rs`), 然后再创建 `collections::hash_map` 子子模块(?)(创建 `hash_map.rs` 并在 `collections/mod.rs` 声明`pub mod hash_map`, `pub use hash_map::HashMap`)

* `crate` 是可被编译的**最小**单位, 分为 `bin` 或 `lib` 两种, 前者可被编译为可执行程序, 后者可被编译为`.rlib`, 只能提供一些接口(没有 main 函数)

    三阶段需要对 crate 有一定的理解, 因为 ArceOS 的组件化是相当依赖于 Rust 的 crate 的.

* `package` 是提供一系列功能的 `crates` 的集合, 可包含多个 bin crate 和最多一个 lib crate. 

* `workspace` 管理多个 `packages` 的编译环境工具链等的目录结构. 一般比较大型的项目会分为多个 `packages` 开发, 共享同一个 `target/`目录

    以 ArceOS 下的 `Cargo.toml` 为例:

    ```toml
    [workspace]
    resolver = "2"
    members = [
        "modules/axalloc",
         ...
     ]
    [workspace.package]
    ...
    
    [workspace.dependencies]
    axstd = { path = "ulib/axstd" }
    axlibc = { path = "ulib/axlibc" }
    ...
    ```

## `Option<T>` 与 `Result<T, E>`

在我们本次操作系统的实验中会大量使用(其实 Rust 工程都会大量使用)

ArceOS 会封装为 `AxResult` 等

## 泛型与 Trait

泛型作为一种静态分发生成代码的方式, 本次实验中没有太需要这一块, 有多态基本都是在 `dyn Trait` 用 trait 对象动态分发

trait 在本次实验中就非常重要了, 组合形式的代码复用比继承灵活了不少, 例如:

* rCore 中的"文件" `File` trait, 通过 write read 抽象地描述了一个"文件"应该具备的行为
* `ArceOS` 中的 `VfsOps` 和 `VfsNodeOps`, 描述了文件系统应该提供的功能和一个文件节点应该提供的功能, 并且通过 `Arc<dyn VfsOps>` 实现对不同文件系统和不同文件节点的支持
* 动态内存分配的接口 `unsafe trait GlobalAlloc` (这个其实是标准库的, 但是我们自己实现的内存分配器需要 `impl GlobalAlloc for OurAllocator`)

## 生命周期

想要对 lifetime 的理解炉火纯青是比较困难的, 幸运的是本次实验你只需要懂得一些基本的生命周期概念, 然后学习智能指针就行了(), 代码中大量使用 `Arc<T>` `RefCell<T>` 等.

但还要记住一句话: 任何时候保证引用有效(对这句话的理解应该还有一层: 任何引用本身存在的生命周期必须小于等于其引用内容的生命周期, 不然其内容死了之后这个引用就没有任何意义而且变得危险了)

## 迭代器

使用 `obj.iter()` 或 `obj.into_iter()`/`obj.iter_mut()` 后可以链式地进行一些操作:

* 迭代适配器: `map` `filter` `for_each`, 接收一个捕获迭代器元素的闭包, 执行某些操作, 但不会消耗迭代器返回值, 而是继续返回迭代器
* 消费适配器: `.collect()` `.sum()`, 消费其中的迭代器并返回具体类型, 注意你可能需要显示标注我们需要 `collect` 成什么类型

## 智能指针

* `Box<T>` 拥有其内部数据的所有权, 数据在堆上, 常用于解决递归类型无法计算大小的问题 (`Box` 本身是 `Sized` 的)

* `Rc<T>`/`Arc<T>`: 多个智能指针共享同一个数据的所有权

    * `let origin = Arc::new(data)` 创建一个智能指针
    * `let others = Arc::clone(&origin)` 共享 `origin` 智能指针中的数据 `data`
    * `Arc:strong_count(&original)` 有多少指针在共享这一数据, 引用计数为 0 是释放数据空间

* `Weak<T>`: 弱引用, 用于解决引用循环. 例如对于操作系统中父进程有一个 `children: Vec<Arc<TaskControlBlock>>`, 而子进程还需要得知自己父进程 `parent: Arc<TaskControlBlock>`, 这样就会导致引用计数始终不为 0, 最后数据无法被释放造成泄露, 所以需要 `parent: Weak<TaskControlBlock>`. `Weak<T>` 不需要引用计数为 0 就可以被清理, 其特性是:

    * 任何涉及弱引用的循环会在其相关的值的强引用计数为 0 时被打断
    * `Rc<T>` 维护一个 `weak_count`, 每次`Rc::downgrade` 创建 Weak 指针时增加弱引用计数
    * `weak_count` 无需计数为 0 就能使 `Rc<T>` 实例被清理, 因此使用 Weak 的数据时其数据是可能被清理掉的, 我们需要`Weak:upgrade`, 返回 `Option<Rc<T>`.

* `RefCell`: 内部可变性设计模式

    我们可以在 `RefCell<T>` 本身不被绑定为可变时修改其内部的值, 在**运行时**进行借用检查.

    `RefCell` 提供的内部可变性在二阶段 rCore 的一些控制信息结构体中常用, 例如 TCB 将不可变数据作为直接的结构体成员, 可变数据放在 inner 里 (这里 `UPSafeCell` 就是基于 `RefCell` 封装的). 

    我们显然不希望 `process`, `kstack` 这样逻辑上应为 `immutable` 的数据被改变, 所以整个 TCB 结构体应该被绑定在不可变变量上, 但是这样就导致 `inner` 也是不可变的了, 我们无法修改 `inner` 中的 `trap_cx` 上下文等, 所以我们需要依赖 `RefCell` 的运行时借用检查能力, 允许修改 inner 中的值

    根据 `RefCell` 的特性

    ```rust
    /// Task control block structure
    pub struct TaskControlBlock {
        /// immutable
        pub process: Weak<ProcessControlBlock>,
        /// Kernel stack corresponding to PID
        pub kstack: KernelStack,
        /// mutable
        inner: UPSafeCell<TaskControlBlockInner>,
    }
    
    pub struct TaskControlBlockInner {
        pub res: Option<TaskUserRes>,
        /// The physical page number of the frame where the trap context is placed
        pub trap_cx_ppn: PhysPageNum,
        /// Save task context
        pub task_cx: TaskContext,
    
        /// Maintain the execution status of the current process
        pub task_status: TaskStatus,
        /// It is set when active exit or execution error occurs
        pub exit_code: Option<i32>,
    }
    ```

    这个 `UPSafeCell` 的 `exclusive_access` 方法不能嵌套调用, 会导致 `BorrowMutError`. 

## 线程

这个实验不需要掌握太多 Rust 线程的使用方法, ~~因为我们需要自己实现线程机制~~

但是要对线程模型和同步互斥有一定的认识, 会在 rCore Tutorial Book 的 ch8 中学习到

## 宏

在 ArceOS 中用得非常神仙, 尤其是对过程宏的运用:

* 借助 `linke_me` 利用过程宏 `#[register_trap_handler(SYSCALL)]` 等注册异常处理函数
* 由于 `axhal` 和 `axlog` 存在的循环依赖关系, `axlog` 必须以 `extern ABI` 而不是`[dependencies]` 的形式依赖 `axhal`. 但是这个不通过 Rust 编译器的检查, 所以用过程宏封装成 `trait` 的形式, 减少出错概率
* 用宏对某些特定对象生成 trait 的默认行为这些相比以上用法已经算是比较一般的了

过程宏是基于 AST 进行代码生成的, 所以灵活度非常高, 这里也不需要掌握太深入, 但是至少要能读懂过程宏, 这样在三阶段中才不会太盲人摸象

## 类型转换

主要在地址空间的支持中需要对 PA VA PPN VPN 进行转换等涉及到 `From` `Into` 之类的 trait

~~剩下的时候都在能`.into()`就`.into()`不能的话就强行`as`~~

> `↑`: 这是不负责任的喵

## 最后十道题

* 链表

    * 活用 `loop`+`match`+ 模式匹配 能写得比 for 循环迭代更清晰
    * 裸指针解引用需要 `unsafe` 套一下, `unsafe` 最好在表达式层次

* 排序: 比较简单, 和其他语言基本没什么差别. 可以用 `array.swap(idx1, idx2)` 代替 `std::mem:swap` 交换元素

* 二叉搜索树: 主要是 `Option<Box<TreeNode<T>>>` 套着比较烦, 但其实都是必要的: `Option` 用来时刻提醒你防止 NULL 的情况, `Box` 用于解决树形结构的递归类型

* 图的存储, BFS 和 BFS: `vec![vec![];n]` 创建一个 `Vec<Vec<T>>` 用来存边

    * `VecQueue` 作为 Rust 中的双端队列
    * `while let Some(cur) = q.pop_front() {}` 相比 `while(!q.empty()) { auto cur = q.front(); q.pop(); }` 高下立判了()

* 利用栈进行括号匹配: 优雅, 太优雅了

    ```rust
    fn bracket_match(bracket: &str) -> bool {
        let mut s = Stack::new();
        for c in bracket.chars() {
            match c {
                '(' | '[' | '{' => s.push(c),
                ')' | ']' | '}' => {
                    if matches!(s.peek(), Some(&res) if res == map_bracket(c)) {
                        s.pop();
                    } else {
                        return false;
                    }
                }
                _ => continue,
            }
        }
        s.is_empty()
    }
    ```

    这里 `Some(&res) if res == ...` 是 `matches!` 宏提供的守卫, 宏很神奇吧

* 用两个队列模拟栈: 每次插入时向 `q2` 插入元素, 然后把 `q1` 元素全部出队再入 `q2` 队, 最后交换 `q1` `q2`, 这样 `q1` 的出队顺序就始终保证是原始数据应当符合的出栈顺序, 用的时候直接弹就行.

* 二叉堆, 应该是最麻烦的一个, 需要注意有一个 `items: vec![T::default()]`, 这个默认的 0 号节点用于占位, 这样我们就能从 1 开始构建根节点, 因此左子树是 $2 \times i$, 右子树是 $2 \times i + 1$

    * 还是利用 `loop` `while` 寻找需要的节点并反复执行操作(如弹出时交换被弹出节点与根节点后执行的下沉操作需要找的对应位置节点)

* 邻接表存图: 注意数据类型是 `HashMap<String, Vec<(String, i32)>>`

~~以上数据结构几乎都不需要在本次实验中手动实现, 但是三阶段你要手写一个 HashMap~~
