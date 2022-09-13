---
title: Yakkhini's rCore 2022 report
date: 2022-08-01 22:11:06
categories:
    - report
tags:
    - author:Yakkhini
    - summerofcode2022
    - rcore-lab
---

# 2022 年开源操作系统训练营 - Yakkhini

在这个训练营中，我会深入学习操作系统原理，**从零开始** 用 **Rust** 语言写一个基于 **RISC-V** 架构的 **类 Unix 内核。**

<!-- more -->

## 环境配置

### 远程仓库

需要注意的是，所有远程仓库可见性应设置为 Public 公开状态，否则 GitHub Action 中的自动评分可能无权开始，或者需付费才能使用。

### 本地

我计划在本地开发，目前使用的是 Manjaro 系统。我将所有实验会用到的文件和仓库都存放在了 `/diske/Rust/zCore/` 路径中。`/diske` 是我挂载的 Windows 系统的 E 盘。

本文档也使用软链接进来了。

```bash
> ln -s ~/Documents/YeChaNvCinema/docs/computerSci/20220706-zcore.md /diske/Rust/zCore/diary.md
```

## 学习 Rust 编程 (July 06 - July 08)

由于我之前使用 Rust 开发过一个完整的游戏项目（见 [Planting Pong](https://github.com/Yakkhini/PongPlanting)），所以系统地学习过 Rust 语言。但是我仍然想跟着训练营再过一下 Rust，因为我之前的开发比较面向业务逻辑，而操作系统的编写肯定还需要更高的要求，如错误处理、多线程并发之类的高级用法也可能会用到。

[**Classroom** - *LearningOS / learn_rust_rustlings-Yakkhini*](https://github.com/LearningOS/learn_rust_rustlings-Yakkhini)

配置 GitHub Classroom:

```bash
> make setupclassroom
```

### Rustlings 安装及使用

训练营的 Rust 习题实验是由 `rustlings` 工具驱动的。虽然 AUR 中可以安装，但是为了方便和易于管理我将它安装在了 `$HOME/.cargo/bin` 中。

```bash
> curl -L https://raw.githubusercontent.com/rust-lang/rustlings/main/install.sh | bash
```

使用：

```bash
~/.cargo/bin/rustlings watch

```

### 重点题目汇总

在学习过程中，我发现我的担心是正确的。由于我之前的开发比较侧重于业务逻辑，所以前 40 道题的内容完成速度很快，对其中的概念也比较熟悉；但是后三十道题的完成比较艰难。其中，主要耗费时间的题目类型有 **错误处理、泛型、宏、迭代器、智能指针、线程。**我在这里列举出一些重点题目，并附出解决办法中应注意的部分。

<!-- tabs:start -->

#### **Index**

* 错误处理：error6，advanced_errs1
* 泛型：generics2
* 宏：quiz4
* 迭代器：iterators4，iterators5
* 智能指针：box1
* 线程：arc1

#### **error6**

```rust
// errors6.rs

// Using catch-all error types like `Box<dyn error::Error>` isn't recommended
// for library code, where callers might want to make decisions based on the
// error content, instead of printing it out or propagating it further. Here,
// we define a custom error type to make it possible for callers to decide
// what to do next when our function returns an error.

// Make these tests pass! Execute `rustlings hint errors6` for hints :)

use std::num::ParseIntError;

// This is a custom error type that we will be using in `parse_pos_nonzero()`.
#[derive(PartialEq, Debug)]
enum ParsePosNonzeroError {
    Creation(CreationError),
    ParseInt(ParseIntError),
}

impl ParsePosNonzeroError {
    // TODO: add another error conversion function here.
    fn from_creation(x: CreationError) -> ParsePosNonzeroError {
        match x {
            CreationError::Negative => ParsePosNonzeroError::Creation(CreationError::Negative),
            CreationError::Zero => ParsePosNonzeroError::Creation(CreationError::Zero),
        }
    }
}

fn parse_pos_nonzero(s: &str) -> Result<PositiveNonzeroInteger, ParsePosNonzeroError> {
    // TODO: change this to return an appropriate error instead of panicking
    // when `parse()` returns an error.
    let x = s.parse();

    match x {
        Ok(x) => PositiveNonzeroInteger::new(x).map_err(ParsePosNonzeroError::from_creation),
        Err(e) => {Err(ParsePosNonzeroError::ParseInt(e))},
    }
}

// Don't change anything below this line.

#[derive(PartialEq, Debug)]
struct PositiveNonzeroInteger(u64);

#[derive(PartialEq, Debug)]
enum CreationError {
    Negative,
    Zero,
}

impl PositiveNonzeroInteger {
    fn new(value: i64) -> Result<PositiveNonzeroInteger, CreationError> {
        match value {
            x if x < 0 => Err(CreationError::Negative),
            x if x == 0 => Err(CreationError::Zero),
            x => Ok(PositiveNonzeroInteger(x as u64)),
        }
    }
}
```

#### **generics2**

```rust
// This powerful wrapper provides the ability to store a positive integer value.
// Rewrite it using generics so that it supports wrapping ANY type.

// Execute `rustlings hint generics2` for hints!

struct Wrapper<T> {
    value: T,
}

impl<T> Wrapper<T> {
    pub fn new(value: T) -> Self {
        Wrapper { value }
    }
}
```

#### **iterators4**

```rust
// iterators4.rs

pub fn factorial(num: u64) -> u64 {
    // Complete this function to return the factorial of num
    // Do not use:
    // - return
    // Try not to use:
    // - imperative style loops (for, while)
    // - additional variables
    // For an extra challenge, don't use:
    // - recursion
    // Execute `rustlings hint iterators4` for hints.

    (1..num + 1).product()
}
```

#### **iterators5**

```rust
// iterators5.rs
// Let's define a simple model to track Rustlings exercise progress. Progress
// will be modelled using a hash map. The name of the exercise is the key and
// the progress is the value. Two counting functions were created to count the
// number of exercises with a given progress. These counting functions use
// imperative style for loops. Recreate this counting functionality using
// iterators. Only the two iterator methods (count_iterator and
// count_collection_iterator) need to be modified.
// Execute `rustlings hint iterators5` for hints.
//
// Make the code compile and the tests pass.

use std::collections::HashMap;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Progress {
    None,
    Some,
    Complete,
}

...

fn count_iterator(map: &HashMap<String, Progress>, value: Progress) -> usize {
    // map is a hashmap with String keys and Progress values.
    // map = { "variables1": Complete, "from_str": None, ... }

    map.values().filter(|val| **val == value).count()
}

...

fn count_collection_iterator(collection: &[HashMap<String, Progress>], value: Progress) -> usize {
    // collection is a slice of hashmaps.
    // collection = [{ "variables1": Complete, "from_str": None, ... },
    //     { "variables2": Complete, ... }, ... ]

    collection
        .iter()
        .map(|submap| submap.values().filter(|val| **val == value).count())
        .sum()
}

```

#### **box1**

```rust
// box1.rs
//
// At compile time, Rust needs to know how much space a type takes up. This becomes problematic
// for recursive types, where a value can have as part of itself another value of the same type.
// To get around the issue, we can use a `Box` - a smart pointer used to store data on the heap,
// which also allows us to wrap a recursive type.
//
// The recursive type we're implementing in this exercise is the `cons list` - a data structure
// frequently found in functional programming languages. Each item in a cons list contains two
// elements: the value of the current item and the next item. The last item is a value called `Nil`.
//
// Step 1: use a `Box` in the enum definition to make the code compile
// Step 2: create both empty and non-empty cons lists by replacing `unimplemented!()`
//
// Note: the tests should not be changed
//
// Execute `rustlings hint box1` for hints :)

#[derive(PartialEq, Debug)]
pub enum List {
    Cons(i32, Box<List>),
    Nil,
}

fn main() {
    println!("This is an empty cons list: {:?}", create_empty_list());
    println!(
        "This is a non-empty cons list: {:?}",
        create_non_empty_list()
    );
}

pub fn create_empty_list() -> List {
    List::Nil
}

pub fn create_non_empty_list() -> List {
    List::Cons(1, Box::new(List::Nil))
}

```

#### **arc1**

```rust
/ arc1.rs
// In this exercise, we are given a Vec of u32 called "numbers" with values ranging
// from 0 to 99 -- [ 0, 1, 2, ..., 98, 99 ]
// We would like to use this set of numbers within 8 different threads simultaneously.
// Each thread is going to get the sum of every eighth value, with an offset.
// The first thread (offset 0), will sum 0, 8, 16, ...
// The second thread (offset 1), will sum 1, 9, 17, ...
// The third thread (offset 2), will sum 2, 10, 18, ...
// ...
// The eighth thread (offset 7), will sum 7, 15, 23, ...

// Because we are using threads, our values need to be thread-safe.  Therefore,
// we are using Arc.  We need to make a change in each of the two TODOs.

// Make this code compile by filling in a value for `shared_numbers` where the
// first TODO comment is, and create an initial binding for `child_numbers`
// where the second TODO comment is. Try not to create any copies of the `numbers` Vec!
// Execute `rustlings hint arc1` for hints :)

#![forbid(unused_imports)] // Do not change this, (or the next) line.
use std::sync::Arc;
use std::thread;

fn main() {
    let numbers: Vec<_> = (0..100u32).collect();
    let shared_numbers = Arc::new(numbers); // TODO
    let mut joinhandles = Vec::new();

    for offset in 0..8 {
        let child_numbers = Arc::clone(&shared_numbers); // TODO
        joinhandles.push(thread::spawn(move || {
            let sum: u32 = child_numbers.iter().filter(|n| *n % 8 == offset).sum();
            println!("Sum of offset {} is {}", offset, sum);
        }));
    }
    for handle in joinhandles.into_iter() {
        handle.join().unwrap();
    }
}

```

#### **quiz4**

```rust
#[macro_export]
macro_rules! my_macro {
    ($val:expr) => {
        "Hello ".to_owned() + $val
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_my_macro_world() {
        assert_eq!(my_macro!("world!"), "Hello world!");
    }

    #[test]
    fn test_my_macro_goodbye() {
        assert_eq!(my_macro!("goodbye!"), "Hello goodbye!");
    }
}

```

#### **advanced_errs1**

```rust
// advanced_errs1.rs

// Remember back in errors6, we had multiple mapping functions so that we
// could translate lower-level errors into our custom error type using
// `map_err()`? What if we could use the `?` operator directly instead?

// Make this code compile! Execute `rustlings hint advanced_errs1` for
// hints :)

use std::num::ParseIntError;
use std::str::FromStr;

// This is a custom error type that we will be using in the `FromStr`
// implementation.
#[derive(PartialEq, Debug)]
enum ParsePosNonzeroError {
    Creation(CreationError),
    ParseInt(ParseIntError),
}

impl From<CreationError> for ParsePosNonzeroError {
    fn from(e: CreationError) -> Self {
        // TODO: complete this implementation so that the `?` operator will
        // work for `CreationError`

        ParsePosNonzeroError::Creation(e)
    }
}

// TODO: implement another instance of the `From` trait here so that the
// `?` operator will work in the other place in the `FromStr`
// implementation below.

impl From<ParseIntError> for ParsePosNonzeroError {
    fn from(e: ParseIntError) -> Self {
        ParsePosNonzeroError::ParseInt(e)
    }
}

// Don't change anything below this line.

impl FromStr for PositiveNonzeroInteger {
    type Err = ParsePosNonzeroError;
    fn from_str(s: &str) -> Result<PositiveNonzeroInteger, Self::Err> {
        let x: i64 = s.parse()?;
        Ok(PositiveNonzeroInteger::new(x)?)
    }
}

#[derive(PartialEq, Debug)]
struct PositiveNonzeroInteger(u64);

#[derive(PartialEq, Debug)]
enum CreationError {
    Negative,
    Zero,
}

impl PositiveNonzeroInteger {
    fn new(value: i64) -> Result<PositiveNonzeroInteger, CreationError> {
        match value {
            x if x < 0 => Err(CreationError::Negative),
            x if x == 0 => Err(CreationError::Zero),
            x => Ok(PositiveNonzeroInteger(x as u64)),
        }
    }
}

```

<!-- tabs:end -->

### 完成

每道题的具体完成情况可以在 GitHub Commit 记录中查到。

Quiz2 及之前题目：[Finish: Before quiz2(include quiz2). · LearningOS/learn_rust_rustlings-Yakkhini@e67dea3](https://github.com/LearningOS/learn_rust_rustlings-Yakkhini/commit/e67dea32e9a5b03114d544276c0e4cef82238d52)

Quiz2 之后所有题目：[Finish: All Done. · LearningOS/learn_rust_rustlings-Yakkhini@a079df7](https://github.com/LearningOS/learn_rust_rustlings-Yakkhini/commit/a079df7a058b67ee67cd9e385df90995a9a4fe38)

```bash

🎉 All exercises completed! 🎉

+----------------------------------------------------+
|          You made it to the Fe-nish line!          |
+--------------------------  ------------------------+
                          \\/
     ▒▒          ▒▒▒▒▒▒▒▒      ▒▒▒▒▒▒▒▒          ▒▒
   ▒▒▒▒  ▒▒    ▒▒        ▒▒  ▒▒        ▒▒    ▒▒  ▒▒▒▒
   ▒▒▒▒  ▒▒  ▒▒            ▒▒            ▒▒  ▒▒  ▒▒▒▒
 ░░▒▒▒▒░░▒▒  ▒▒            ▒▒            ▒▒  ▒▒░░▒▒▒▒
   ▓▓▓▓▓▓▓▓  ▓▓      ▓▓██  ▓▓  ▓▓██      ▓▓  ▓▓▓▓▓▓▓▓
     ▒▒▒▒    ▒▒      ████  ▒▒  ████      ▒▒░░  ▒▒▒▒
       ▒▒  ▒▒▒▒▒▒        ▒▒▒▒▒▒        ▒▒▒▒▒▒  ▒▒
         ▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▒▒▒▒▒▒▒▒▓▓▒▒▓▓▒▒▒▒▒▒▒▒
           ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
             ▒▒▒▒▒▒▒▒▒▒██▒▒▒▒▒▒██▒▒▒▒▒▒▒▒▒▒
           ▒▒  ▒▒▒▒▒▒▒▒▒▒██████▒▒▒▒▒▒▒▒▒▒  ▒▒
         ▒▒    ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ▒▒
       ▒▒    ▒▒    ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ▒▒    ▒▒
       ▒▒  ▒▒    ▒▒                  ▒▒    ▒▒  ▒▒
           ▒▒  ▒▒                      ▒▒  ▒▒

We hope you enjoyed learning about the various aspects of Rust!
If you noticed any issues, please don't hesitate to report them to our repo.
You can also contribute your own exercises to help the greater community!

Before reporting an issue or contributing, please read our guidelines:
https://github.com/rust-lang/rustlings/blob/main/CONTRIBUTING.md

```

## 第零章：实验环境配置 - lab0-0 (July 08)

在本章中，我们会完成环境配置并成功运行 **rCore-Tutorial**。

[**Classroom** - *LearningOS / lab0-0-setup-env-run-os1-Yakkhini*](https://github.com/LearningOS/lab0-0-setup-env-run-os1-Yakkhini)

### 安装 Qemu

我计划采用本地开发。Qemu 相关软件包在 Arch 的 `extra/` 仓库中可以找到，打包质量有保证。

```bash
> yay -S qemu qemu-system-riscv qemu-user
> qemu-system-riscv64 --version; qemu-riscv64 --version;
```

**Output：**

```
QEMU emulator version 7.0.0
Copyright (c) 2003-2022 Fabrice Bellard and the QEMU Project developers
qemu-riscv64 version 7.0.0
Copyright (c) 2003-2022 Fabrice Bellard and the QEMU Project developers
```

### 试运行 rCore-Tutorial

裸机操作系统 `os1` 不需要处理用户代码，可以直接运行来检查本地环境是否正确配置。

```bash
> cd os1; LOG=DEBUG make run;
```

**Output：**

```
(rustup target list | grep "riscv64gc-unknown-none-elf (installed)") || rustup target add riscv64gc-unknown-none-elf
riscv64gc-unknown-none-elf (installed)
cargo install cargo-binutils --vers ~0.2
    Updating crates.io index
     Ignored package `cargo-binutils v0.2.0` is already installed, use --force to override
rustup component add rust-src
info: component 'rust-src' is up to date
rustup component add llvm-tools-preview
info: component 'llvm-tools-preview' for target 'x86_64-unknown-linux-gnu' is up to date
    Finished release [optimized] target(s) in 0.01s
make: rust-objcopy: No such file or directory
make: *** [Makefile:22: target/riscv64gc-unknown-none-elf/release/os.bin] Error 127
```

可以看到直接运行出现了错误 `make: rust-objcopy: No such file or directory`。根据实验说明，这个命令会安装一些本地可能没有的依赖。我在运行过程中没有收到 `root` 提权申请，根据项目的工具链，我推测是 `Cargo` 安装在 `~/.cargo/bin/` 目录中的可执行文件不在环境变量路径中。

```bash
> ls ~/.cargo/bin
```

**Output:**

```
cargo-nm       cargo-objdump   cargo-readobj  cargo-strip  rust-ld    rust-lld  rust-objcopy  rust-profdata  rust-size
cargo-objcopy  cargo-profdata  cargo-size     rust-ar      rustlings  rust-nm   rust-objdump  rust-readobj   rust-strip
```

果然，`rust-objcopy` 就在其中。肯定是程序直接使用命令 `rust-objcopy` 调用它失败了，现在的正确命令应该是 `~/.cargo/bin/rust-objcopy`。但是我不想把这个路径纳入环境变量（怕和 Pacman 打架），也不能修改 Makefile，因为有可能会影响评分程序执行。所以还是每次调用前先临时改一下 `PATH` 变量好了。

```bash
export PATH="${PATH}:${HOME}/.cargo/bin"
LOG=DEBUG make run
```

**Output:**

```
(rustup target list | grep "riscv64gc-unknown-none-elf (installed)") || rustup target add riscv64gc-unknown-none-elf
riscv64gc-unknown-none-elf (installed)
cargo install cargo-binutils --vers ~0.2
    Updating crates.io index
     Ignored package `cargo-binutils v0.2.0` is already installed, use --force to override
rustup component add rust-src
info: component 'rust-src' is up to date
rustup component add llvm-tools-preview
info: component 'llvm-tools-preview' for target 'x86_64-unknown-linux-gnu' is up to date
    Finished release [optimized] target(s) in 0.01s
[rustsbi] RustSBI version 0.2.2, adapting to RISC-V SBI v1.0.0
.______       __    __      _______.___________.  _______..______   __
|   _  \     |  |  |  |    /       |           | /       ||   _  \ |  |
|  |_)  |    |  |  |  |   |   (----`---|  |----`|   (----`|  |_)  ||  |
|      /     |  |  |  |    \   \       |  |      \   \    |   _  < |  |
|  |\  \----.|  `--'  |.----)   |      |  |  .----)   |   |  |_)  ||  |
| _| `._____| \______/ |_______/       |__|  |_______/    |______/ |__|
[rustsbi] Implementation     : RustSBI-QEMU Version 0.1.1
[rustsbi] Platform Name      : riscv-virtio,qemu
[rustsbi] Platform SMP       : 1
[rustsbi] Platform Memory    : 0x80000000..0x88000000
[rustsbi] Boot HART          : 0
[rustsbi] Device Tree Region : 0x87000000..0x87000ef2
[rustsbi] Firmware Address   : 0x80000000
[rustsbi] Supervisor Address : 0x80200000
[rustsbi] pmp01: 0x00000000..0x80000000 (-wr)
[rustsbi] pmp02: 0x80000000..0x80200000 (---)
[rustsbi] pmp03: 0x80200000..0x88000000 (xwr)
Hello, world!
[DEBUG] .rodata [0x80203000, 0x80205000)
[ INFO] .data [0x80205000, 0x80206000)
[ WARN] boot_stack [0x80206000, 0x80216000)
[ERROR] .bss [0x80216000, 0x80217000)
Panicked at src/main.rs:48 Shutdown machine!
```

实验成功。

## 第一章：应用程序与基本执行环境 - lab0-0 (July 08 - July 09)

在本章中，我们会打造一个能打印 `Hello, world!` 的 OS，深入理解应用程序及其执行环境。

[**Classroom** - *LearningOS / lab0-0-setup-env-run-os1-Yakkhini*](https://github.com/LearningOS/lab0-0-setup-env-run-os1-Yakkhini)

### 应用程序执行环境

一个应用程序的执行大概会通过四层路径，自顶向下：程序函数（`main.rs/main()/println!`） -> 标准库（`std, GUN Libc`） -> 内核与操作系统的指令集（`Linux kernel 5.15/x86_64`） -> 硬件（`cpu`）。

#### 目标三原组

除程序函数外，运行时库、指令集架构、操作系统类型共同构成了程序运行的平台。这三者也被叫做 **目标三元组**。如上述 `hello world` 程序，其平台就为 `x86_64` 指令集，`Linux` 操作系统，`GNU Libc` 运行时库。

#### 程序是怎样被执行的

##### 内存

源代码被编译成可执行文件后，其内部的字节大概可以分为 **代码** 和 **数据** 两部分。代码会被 CPU 解析并执行，而数据部分则指示了代码中读写数据的操作应该发生在内存的哪部分空间中。

不过，由于我们知道在程序运行的过程中会出现很多不同类型、生命周期、容量、功能的数据结构，如果将它们全部放在一起的话会让空间管理难以进行。所以我们进一步地分了很多 **段** 来存放数据。不同的段依照一定规则放在内存的不同位置上，构成程序的 **内存布局。**如：

{% asset_img zcore-MemoryLayout.png 一种典型的内存布局 %}

从这个布局中我们看到，存放的数据大概被分成了代码内容和数据内容两个部分。

* `.text` 部分存放编译出的汇编代码。
* `.rodata` 存放只读的全局数据，`.data` 存放可读写的全局数据。这两者共同构成 **已初始化数据段。**
* `.bss` 则存放程序未初始化的全局数据，由加载者初始化。其中的数据初始化后就会存放在已初始化数据段中。所以，一般来说，`.bss` 数据段会在程序运行过程中逐步缩小。
* `heap` **堆** 存放程序运行时动态分配的数据（如不定长可扩展的数组和向量），由低地址向高地址增长。
* `stack` **栈** 用作 **调用上下文的保存与恢复，**以及存放一些局部变量，由高地址向低地址增长。

##### 编译

编译流程大概包括三道工序，经过三个组件，它们分别是 **编译器、汇编器、链接器。** 编译器将我们 ASCLL 码的 Rust 源代码文件 `*.rs` 转为汇编语言，而汇编器再将汇编语言转为机器可读取的二进制码。

那么链接器是做什么的呢？我们在写程序的时候，定义变量、常量都使用了高级语言的语法。但是在程序运行中，程序想要使用一个数据只能去寻址访问，找到所需数据在内存中存放的地址来进行读写操作。这一步翻译工作会在汇编和机器码层面做出来。

但是这就出现了一个问题：**各个原文件是由编译器、汇编器单独编译的，那么它们就无从得知彼此所需数据的位置，更无法协调内存布局。**如果直接执行，很有可能会彼此冲突，造成严重的错误。链接器就是做这件事的：将各个源文件汇编的布局，按段拆分，再重新组合：

{% asset_img zcore-link-sections.png 链接器工作图示 %}

如图所示，如果直接将 `1.O`，`2.O` 拿去运行，那 CPU 在读取 `2.O` 的 `.rodata` 位置 `0x1000` 时可能就会读到 `1.O` 的 `.text` 段。实际上，这样两个冲突的内存布局可能都无法正常开始运行，更没有读取操作了。而在组合成 `output.O` 后，内存布局不再矛盾，程序正常运行。

### 代码实现

#### 代码组织

我发现需要将 `riscv64gc-unknown-none-elf` target 安装到本地：

```bash
> rustup target add riscv64gc-unknown-none-elf
```

在下一步的学习中，我发现我由于对操作系统理解不够，因而许多实验书中的概念都不了解。对于操作系统零基础的同学，我建议大家去看未精简的原书 [**rCore-Tutorial-Book 第三版**](https://rcore-os.github.io/rCore-Tutorial-Book-v3/index.html) 参考学习。

#### 移除标准库依赖

我们要写操作系统，所以除指令集已定义 `riscv64gc` ，我们均无法使用其他操作系统及内置的运行时库。而 Rust 标准库 `std` 也无法使用。所以应仅依赖 Rust 无需操作系统支持的 `core` 核心库。

```rust
// os/src/main.rs

#![no_std]

fn main() {
}
```

我们移除了 `println!` 宏，因为这是一个由 `std` 提供的宏。

#### 汇编和链接器

正常情况下，我们在写 Rust 程序时不用管编译结果是怎样链接的，因为我们最终写的软件运行在操作系统上，而操作系统会通过虚拟地址等机制来给程序分配一个简洁透明的地址空间，供其随意分配使用。这就代表着，只要一个 Rust 项目在编译时链接器的主要工作就是组合各个文件编译的组合，让其不冲突，而不用考虑内存安排是否会与其他程序冲突，以及和内存硬件相适合。

但是，我们做操作系统开发，就不会有另一层系统来接管地址的分配和使用了。这代表着我们必须手写每个地址段在物理硬件（也就是 QEMU 给的虚拟硬件空间）内存中的布局。这需要汇编和链接器语言的支持：

<!-- tabs:start -->
##### **汇编**
```asm
# os/src/entry.asm
     .section .text.entry
     .globl _start
 _start:
     li x1, 100
```
可以看到，RISC-V 运行所需的 `_start` 汇编存放在了 `.text` 段中。之后需要把这段汇编嵌入到 Rust 代码中作为程序入口。

##### **嵌入**
```rust
// os/src/main.rs

#![no_std]
#![no_main]

mod lang_item;

use core::arch::global_asm;
global_asm!(include_str!("entry.asm"));
```

##### **链接**
再将整个程序的内存布局写出，与 QEMU 对接：
```linker
OUTPUT_ARCH(riscv)
ENTRY(_start)
BASE_ADDRESS = 0x80200000;

SECTIONS
{
    . = BASE_ADDRESS;
    skernel = .;

    stext = .;
    .text : {
        *(.text.entry)
        *(.text .text.*)
    }

    . = ALIGN(4K);
    etext = .;
    srodata = .;
    .rodata : {
        *(.rodata .rodata.*)
        *(.srodata .srodata.*)
    }

    . = ALIGN(4K);
    erodata = .;
    sdata = .;
    .data : {
        *(.data .data.*)
        *(.sdata .sdata.*)
    }

    . = ALIGN(4K);
    edata = .;
    .bss : {
        *(.bss.stack)
        sbss = .;
        *(.bss .bss.*)
        *(.sbss .sbss.*)
    }

    . = ALIGN(4K);
    ebss = .;
    ekernel = .;

    /DISCARD/ : {
        *(.eh_frame)
    }
}
```

可以看到，我们将各个地址段的存放设定为计划中 QEMU 给到的地址空间中可用的部分。

<!-- tabs:end -->

## 第二章：批处理系统 - lab0-1 (July 09 - July 10)

**批处理系统** 指的是在这样一个系统中可以一次性运行多个任务，当上一个任务结束后，下一个任务就会自动开始，而不用人工切换。其中 **批量** 的意思就是指人在下达操作命令时一次下达多个任务。需要注意的是，我们这里任务的运行仍是顺序的，而没有出现任务切换、调度、多道并行的状态。

那么，想要实现这样一个操作系统，主要做两件事：**多个任务的内存布局，**以及 **任务间的切换调度。**

本章在上一章的基础上，让我们的 OS 内核能以批处理的形式一次运行多个应用程序，同时利用特权级机制，令 OS 不因出错的用户态程序而崩溃。

[**Classroom** - *LearningOS / lab0-1-run-os2-Yakkhini*](https://github.com/LearningOS/lab0-1-run-os2-Yakkhini)

### CI 自动评分系统内置的 riscv 依赖出错

在运行中，我发现内置的 RISC-V 依赖有错误，所有的 `asm!` 没有声明导致无法编译。于是提了一个 **Pull request：**[Fix: Used but undeclared macro 'asm!'. by Yakkhini · Pull Request #59 · LearningOS/rust-based-os-comp2022](https://github.com/LearningOS/rust-based-os-comp2022/pull/59)

由于修补好了内置的依赖，所以新生成的实验仓库在 CI 中不会出问题了。如果是已经生成的仓库，也可以参考 **QA7** 修改。

### 特权级

分析上一章的操作系统实现，我们很容易发现一个问题：我如果在操作系统中编入一个任务，那么任务本身虽然可以经过链接器处理后正常运行，但是对于程序具体的实现（如对内存的操作）却不设防。这就带来了安全隐患：我完全可以写一个恶意程序，读写操作系统本身在内存中的数据，或者调用本该由操作系统才能运行的指令，对计算机进行破坏。

那么，这就需要权级体系的介入了。如果对那些我们想压入操作系统去计算的任务，我们应当使其没有调用会对系统破坏的那些指令的权限，而这样的权限应该分配给操作系统内核。

好在 RISC-V 架构中定义了一个特权级体系供我们使用：

| 级别  | 编码  |        名称         |
| :---: | :---: | :-----------------: |
|   0   |  00   | U, User/Application |
|   1   |  01   |    S, Supervisor    |
|   2   |  10   |    H, Hypervisor    |
|   3   |  11   |     M, Machine      |

那么我们就可以借用这个特权级体系来写操作系统。如 Bootloader 就以 M 特权级运行，并给出 SBI（系统二进制接口）来与运行在 S 特权级上的操作系统内核交互；操作系统上再做一层 ABI（应用二进制接口），供运行在 U 特权上的具体程序来与操作系统交互。我们只需要控制 SBI 和 ABI 的支持范围，就可以控制每一层软件使用提权指令的范围。

也就是说，我们现在的代码实现了内核和用户程序的权属隔离。以专业的角度来讲，我们是开始做区分 **内核态** 和 **用户态** 的工作了。

?> 不过，我们现在的工作其实只做了一半。虽然内核和用户的权属被隔离了，但用户程序依然能随意访问到操作系统和其他应用程序的内存数据。

### 内存布局

用户态的程序代码存放在 `user/` 目录。其中也包括了汇编的入口点和链接器脚本，这里不再多讲。需要注意的一点时链接器中应用程序的起始物理地址是 `0x80400000`，这与整个操作系统的内存布局设计有关。

将应用程序链接到内核，则需要专门写一个 `link_app.S` 汇编代码来处理。

```asm
# os/src/link_app.S

    .align 3
    .section .data
    .global _num_app
_num_app:
    .quad 5
    .quad app_0_start
    .quad app_1_start
    .quad app_2_start
    .quad app_3_start
    .quad app_4_start
    .quad app_4_end

    .section .data
    .global app_0_start
    .global app_0_end
app_0_start:
    .incbin "../user/target/riscv64gc-unknown-none-elf/release/00hello_world.bin"
app_0_end:

    .section .data
    .global app_1_start
    .global app_1_end
app_1_start:
    .incbin "../user/target/riscv64gc-unknown-none-elf/release/01store_fault.bin"
app_1_end:

    .section .data
    .global app_2_start
    .global app_2_end
app_2_start:
    .incbin "../user/target/riscv64gc-unknown-none-elf/release/02power.bin"
app_2_end:

    .section .data
    .global app_3_start
    .global app_3_end
app_3_start:
    .incbin "../user/target/riscv64gc-unknown-none-elf/release/03priv_inst.bin"
app_3_end:

    .section .data
    .global app_4_start
    .global app_4_end
app_4_start:
    .incbin "../user/target/riscv64gc-unknown-none-elf/release/04priv_csr.bin"
app_4_end:
```

可以看到，几个应用的二进制 ELF 数据顺序放置在内核的 `.data` 字段中，随取随用。在运行结束完后再清除 `0x80400000` 后的内容，加载下一个程序。

### 任务的调度切换

要实现任务的切换，就需要一个持久的数据结构来维护任务的运行信息。而 Rust 中的变量往往会因为寿命周期而被回收。如果使用常量，但常量中的数据无法在运行时改变；如果使用 `'static` 生命周期声明，常量中的数据也无法在一开始就初始化。所以我们使用 `lazy_static` 依赖提供的宏，来声明 `AppManager` 结构体。

那么，为什么不使用 `'static mut` 来初始化这个结构呢？因为在 Rust 中，全局可变变量是一种 unsafe 行为。其实在这里使用还算是比较安全的——因为全局可变变量的风险来源往往是多线程。但一来 Rust 编译器无法检测到这个全局可变变量有没有经过多线程，二来我们在之后的操作系统设计中还需要引入多线程。除此之外，全局可变变量并不算得上是一种良好的设计。你如果滥用它，就会给你增加极大的心智负担和代码风险，这当然也是 Rust 不愿意看到的。当然，我们在这里使用它，是因为我们的确需要它。

具体情况我在 [Reddit 上的一篇帖文](https://www.reddit.com/r/rust/comments/bkw00l/why_is_static_mut_bad_to_use/) 中找到了更详细的说明：

> *“The problem is that it breaks Rust's most important safety principle: Aliasing + Mutation should never happen at the same time unless the mutation is synchronized.”*
> 
> —— @CryZe92 · 3 yr. ago

可以猜测，Rust 编译器的一些激进优化策略可能会由于无力检查，而使得全局可变变量编译出错。

所以说，我们在 `AppManager` 中给需要可变的条目做一层 `RefCell`，在保证整个结构体是不可变全局变量的同时可以通过获取可变引用的方式来动态维护那些需要改变数据的条目信息。这就是 **内部可变性** 的设计模式。根据上述，我们还需要为其实现一个 `UPSafeCell`，通过限制获取变量者数目始终只有一个的方式来保证代码安全。如果你读完最后一章，这一实现很像一个 **互斥锁！**是的，它们做的基本是一样的事情。甚至，使用互斥锁而不用 `UPSafeCell` 也可以满足 `Sync` trait。

重点说明 `AppManager` 的实现，是因为我们在之后还要使用很多 Managers。至于针对其中结构体的方法，就是比较常规的业务逻辑了。

## 第三章：多道程序与分时多任务 - lab1 (July 10 - July 11)

本章的目标是实现分时多任务系统，它能 **并发** 地执行多个用户程序，并调度这些程序。

与前一章不同的是，并发执行程序不再执行完一个程序，再自动执行下一个；而是多个程序同时进行，在不同任务间切换以达到更高效利用计算资源的结果。

[**Classroom** - *LearningOS / lab1-os3-Yakkhini*](https://github.com/LearningOS/lab1-os3-Yakkhini)

### 原理

#### 应用程序内存布局

在本章中，各个应用需要在运行过程中彼此切换，所以不能像上一章一样运行完一个程序后，清除用户态内存，再运行下一个。每一个程序的代码段在 `0x80400000` 位置后的 `.text` 段顺序排列，供操作系统在运行中取用。

#### 控制流

其实在上一章中，**控制流** 的概念就被提到了，我们使用了一些 `trap` 来协助程序的切换、内核态与用户态的切换。但是我认为真正较为复杂的控制流是由于多道程序的实现需求而被使用的，所以放在这一章节记录。

要比较详细地了解控制流及原理，应该去看原书第一章节的 [操作系统抽象](http://rcore-os.cn/rCore-Tutorial-Book-v3/chapter0/3os-hw-abstract.html) 一节帮助了解。

正常情况下，操作系统会逐行阅读 `.text` 中的汇编指令并运算。这就是 **普通控制流**。但我们也想在运行中切换不同的程序执行，或者切换内核与用户态的汇编指令执行。这就需要 **异常控制流** 的介入。

?> 我们知道，如 `if` `loop` 等高级语言的语法在编译成汇编语言时也会伴随着汇编指令的行间跳转。如著名的 `GOTO` 语法就是做这件事的。那么，这样的跳转和异常控制流又有什么区别？这是因为在我们编写程序，以及计算机执行程序时，需要考虑的不止有「现在在执行什么」，还包括「已经执行了什么」和「将要执行什么」。程序的执行过程也是数据的维护和更改的过程，与过去和未来的数据状态有关。这种当前的状态决定了程序执行的进度、效果、权属、功能等，不如说，是程序的 **执行环境** 被强制切换了。这种突变就是 **异常控制流**，因为它往往需要可控的中断或异常来达到效果。

异常控制流有三种，分别是 **中断**、**异常**、**陷入**。中断来自于外部事件，与程序的执行状况无关；异常是指程序执行出现问题，交给操作系统执行命令，决定其恢复或者终止；陷入则是程序在执行中由于权级不够或者特殊需求，有意地切换到其他程序或者内核态来执行特定功能的代码。这三者中，只有异常可能是意外或错误导致的，并可能引起程序终止。

我们在本章的任务中，当程序有意调用内核命令接口，或者主动切换其他程序，那么就应当使用 **陷入**。而分时调度程序时，由外部的时钟决定定期暂停当前执行程序去执行其他程序，当然就是一种 **中断** 了。

除此之外，我们之前讲过程序的执行就是维护一组数据的状态。如果在任务切换中，任务程序的状态丢失，那就会导致程序执行出错，出现不可预期的结果。所以我们要保存每一个未执行完程序的这种状态，或者说，保存每一个未执行完程序的 **上下文**。

### 代码

在本章内容中，我们需要重点实现的就是 `TaskManager` 和分时调度系统。`TaskManager` 也使用了内部可变性的设计思想，而分时调度则是调用了 RISC-V 中的时钟定时中断功能来做的。

#### TaskInfo 获取

本章的编程任务是设计一个 TaskInfo 获取当前程序的信息。字段有运行状态、运行时间以及所有程序使用的系统调用次数。

对于运行状态来说，每一个发起询问的任务其运行状态必然是正在运行的，所以可以写死为 `TaskStatus::Running`。至于运行时间和系统调用次数，则应当写入 `TaskManager` 的可变引用中。

### 报告

本章中的操作系统实现了多道程序，一个内部可变设计的任务管理器。通过对任务管理器中的信息维护，实现了对任务信息的查询。在分时设计和任务切换中，使用了 RISC-V 提供的一些中断功能，来帮助暂存程序上下文。

#### 问答

1. 越权问题

```bash
LOG=ERROR make run
```

**Output：**

```
[ERROR] [kernel] PageFault in application, bad addr = 0x0, bad instruction = 0x80400408, core dumped.
[ERROR] [kernel] IllegalInstruction in application, core dumped.
[ERROR] [kernel] IllegalInstruction in application, core dumped.
```

这说明程序访问了非法的路径和指令，被 sbi 拒绝了。

```rust
...
Trap::Exception(Exception::StoreFault) | Trap::Exception(Exception::StorePageFault) => {
            error!("[kernel] PageFault in application, bad addr = {:#x}, bad instruction = {:#x}, core dumped.", stval, cx.sepc);
            exit_current_and_run_next();
        }
Trap::Exception(Exception::IllegalInstruction) => {
            error!("[kernel] IllegalInstruction in application, core dumped.");
            exit_current_and_run_next();
        }
...
```

2. 深入 `trap.S`
   1. `__restore`

    刚进入 `__restore` 中时，`a0` 指向的是内核栈的栈顶。我们要通过 `sp` 来寻找需恢复的数据，一般情况下在 `trap_handler` 之后 `sp` 的位置正确，所以不需要调整。例外是如第二章批处理程序中，在运行下一个程序后一个新的上下文被压入内核栈，此时 `sp` 的位置不正确，所以需要重新调整。那么这也代表着 `__restore` 的两种使用情况：在 Trap 特权切换并发出系统调用后切换回程序时上下文的恢复，以及在运行一个新程序时恢复新程序的上下文到寄存器。

    2. 特殊处理的寄存器

    这几行代码从之前保存的特殊寄存器数据重新读入临时寄存器，并写入特殊寄存器。`sstatus` 表示特权级信息，`sepc` 则记录了 Trap 处理完成后的下一条指令地址。`sscratch` 用于记录用户栈顶的位置，用于之后与 `sp` 交换。

    3. `x2`，`x4` 寄存器

    因为 `x4` 寄存器除非手动的话就不会被用到，所以无需保存；`x2` 寄存器就是 `sp` 需要单独去处理。

    4. `__restore` 中 `sp` 和 `sscratch` 伪指令操作

    在这一指令之后 `sp` 重新指向用户栈栈顶，`sscratch` 保存内核栈栈顶以备下一次 Trap 处理。

    5. 状态切换的指令

    在 `sret` 指令之后发生了状态切换。因为这一指令实际上处理了 `x1` 通用寄存器，做了写 0 操作，完成了 `__restore` 的返回。除此之外，这一条指令中 CPU 还会按 `sstatus` 中的字段设置特权级，以及跳转到 `sepc` 中指向的指令。

    6. `__alltraps` 中 `sp` 和 `sscratch` 伪指令操作

    在这一指令之后 `sp` 指向内核栈栈顶，`sscratch` 保存用户栈栈顶以备回到用户态的恢复操作。

    7. 状态何时切换

    在用户态中调用 `ecall` 返回后，CPU 将特权级调为 S 级。在 `__alltraps` 中，`sp` 指向内核栈顶，代表着进入了内核栈内存空间。在备份各个寄存器后，进入 `trap_handler` 中，执行内核态指令。

## 第四章：地址空间 - lab2 (July 11 - July 16)

在本章中，我们将更深入地了解程序运行与内存的关系，并以 **页表** 这一工具来隔离每一个程序，令操作系统更方便、更安全。

[**Classroom** - *LearningOS / lab2-os4-Yakkhini*](https://github.com/LearningOS/lab2-os4-Yakkhini)

> *July 11 注：今天正式去工地实习入职了，第一次上班。昨晚没睡着很困，实在没精力和 Rust 编译器搏斗了。*

### 物理空间和虚拟地址空间

我们在程序运行过程中，数据主要是在内存中维护的。我们看待内存的方式可以把它想象成一个大数组。那么，在本章之前，我们程序和操作系统的数据在内存中的存储方式就相当于在这个大数组中独自占用一部分空间，来存放所需的数据。至于哪段空间属于哪个程序、怎样申请内存、各个程序之间怎样不冲突，全靠它们自己来维护。

#### 物理空间的缺陷和解决办法

这无疑是一种坏的设计。从安全角度来看，各个程序之间的内存读写互不设防，那么当操作系统中出现一个恶意程序或者错误程序时，它可以在内存层次上轻易地把其他程序搞得一团糟。从使用友好度来看，每一个编写程序的人都要考虑自己的程序的内存布局是否与其他程序冲突，或者装载程序的人需要动手链接每一个程序的内存段，来保证所有程序都可以正常运行。这会增加繁重的心智负担。

那么，可不可以为每一个程序做一层虚拟的包装，让它们觉得自己是整部计算机中 **唯一的程序** 来运行，然后做一个组件来统一管理它们呢？这种想法的产物就是 **虚拟地址空间。**

#### 透明的巨大虚拟地址空间

这种做法是，对于每一个程序，它们尽可以随意申请自己的内存，只要不和自己冲突就好。因为在程序的视角看，它们会认为自己处在一块巨大的内存块中，而无法感知到其他程序的存在。也就是说，虚拟地址空间对程序是 **透明** 的。

虽然允许程序使用的地址范围很宽，但并不是真的会记录每一个地址的信息。否则，程序就无法享受看起来巨大的地址空间了。只有程序在申请一段内存、操作内存时，那块内存才会真的被映射在实际的物理内存上。实现这一特性，因为我们在页表及节点中采用了 **树结构。**

### 页表

维护虚拟地址信息有很多办法，广为使用的一种是 **页表**。这是基于 **分页内存管理** 所建立的地址转换机制。我们按内存的 **地址** 来访问内存中特定位置的数据，就如同 **循秩访问** 列表和向量中的数据一样。一组固定长度的、连续的地址组成一个虚拟页面，或者物理页帧，这就是虚拟地址与物理地址中映射的最小单位。我们给每一个页面、页帧都取了编号，即 **页号，**在页表中成对记录，表示映射关系。

{% asset_img zcore-page-table.png 页表中以页号的方式存储着虚拟页面和物理页帧的映射关系 %}

#### 页表的硬件机制

页表的设计很好，但想要独立实现它难于登天。我们在上几章已经了解到了，对内存的操作行为遍布程序执行的各个维度，直到汇编、机器码，程序也在和内存打交道；CPU 的寄存器也常常通过物理地址在内存上读写数据。而我们编写操作系统的角度是站在高级语言（Rust）角度上的，于是写页表转换就成了一件不可能的事情。

所以，如果有 CPU 的帮助，自动地将汇编语言中对内存地址的访问读写视为虚拟地址，并将这些操作转到实际的物理地址上，这种问题就迎刃而解。在 CPU 中，做这件事的组件就是 **内存管理单元**（**MMU，**Memory Management Unit）。

在 RISC-V 架构中，修改 `satp` 这一 CSR 寄存器就可以开启分页模式。

#### 多级页表

我们维护页表映射的数据结构是一颗 **字典树。**采用树结构的好处是，可以 **按需分配** 合法的映射。我们知道，数据库就是靠 B+ 树结构实现的。

### 报告

在本章中，我们实现了虚拟地址空间，使各个程序之间内存隔离。这与 RISC-V 的硬件 MMU 支持有关。在任务切换、中断上，程序的装载逻辑也重写了，以适应新的虚拟地址空间。

#### 问答

1. SV39 页表页表项

多级页表由物理页号索引、保护位以及更多的标志位组成。标志位可以控制此页表项的读写、执行权限，合法性，访问权级及访问痕迹等。

2. 缺页

Lazy 策略的好处是省去了无用的加载，按需分配内存。即使出现缺页，也可以处理后再加载或分配。

swap 则可以将使用频率低的内存映射放在硬盘中，节省更多内存用于程序执行。

3. 单页表
   1. 控制用户态
   
   修改 `U` 标志位即可。

   2. 单页表优势

    单页表无需切换页表，在内核态与用户态切换时直接备份上下文即可。

    3. 切换页表

    双页表在程序转换和权级转换时都需要切换页表，而单页表只需要在程序切换时更换页表即可。

## 第五章：进程及进程管理 - lab3 (July 16 - July 17)

在本章，我们将进一步深入操作系统中各个程序的组合方式。在之前，我们的每个程序都只能手动装载进来，如果我们的程序具有装载和启动其他程序的能力，那么操作系统又会方便很多。我们之前描述程序很模糊，会称呼它为任务、用户程序、应用，现在这些正在执行的应用有了一个新的名字：**进程。**

[**Classroom** - *LearningOS / lab3-os5-Yakkhini*](https://github.com/LearningOS/lab3-os5-Yakkhini)

### 功能

每一个正在执行的应用都是一个 **进程（process）。**想要实现预期的效果，我们为新增了三个系统调用供进程使用：

* Fork：从某一进程中分支出子进程
* Exec：在进程中执行程序，用于在子进程中运行程序
* Wait Pid：等待运行结束进程的 `pid` 用于回收资源

这使得我们可以做一个简单的 Shell 了，在 Shell 中输入程序名，就可以令 Shell 分支一个子进程并运行这个程序。在执行结束后，Pid，栈空间及映射的页表都被回收。

进程的编写，离不开上一章中页表提供的 **在程序层面动态分配回收内存资源** 的能力。

### 分时调度

现在我们的调度使用了 Stride 算法，这是一种与优先级有关的调度算法。优先级越高，则 Stride 越小，执行次数会更加频繁；同时也不会使得优先级较低的程序无法执行，而是一种比较均匀和线性的分布。

### 报告

在本章中，我们实现了应用执行从任务到进程的变迁。进程更加强大，可以生成和运行其他进程。这需要进程具有动态分配内存资源的能力；在运行中我们保留了程序分时运行的能力以高效使用计算资源，这需要操作系统具有中断程序切换程序的能力，以及一个有效的调度算法。

### Pass 溢出的影响

当 Pass 溢出后，Pass 之间的比较实际上并不是它们全部值的比较，而是 Pass 除以溢出边界（如以 `u8` 存储 Pass，这一边界就是 `255`）后的余数相比较。那这种比较就很大程度上失去了意义，也就是一个 Stride 较大的进程，无非它的（表现的）Pass 值只是从零值到溢出边界值迭代得更块而已。所以就需要堆或栈等可动态扩容的数据结构来存储 Pass。**但我的办法是** 在调度算法中，Stride 以 `u8` 存储，BigStride 值为 `u8::Max` 即 `255`，而 Pass 则以容量更大的 `usize` 格式来存储，以避免溢出问题。当然，如果是一个更复杂的操作系统、运行时间更久的程序，这种实现最终还是会溢出并使算法失效。

## 第六章：文件系统与 I/O 重定向 - lab4 (July 17 - July 20)

在本章中，我们将实现一个 **文件系统，**用于 **持久储存** 数据信息。

[**Classroom** - *LearningOS / lab4-os6-Yakkhini*](https://github.com/LearningOS/lab4-os6-Yakkhini)

### Inode

如果你有使用类 Unix 系统的经验，那你可能对 **Inode** 并不陌生。在 Linux 中，文件的目录信息与实际在硬盘中的位置信息是解耦的，这代表着我们可以轻易地通过映射来实现文件的 **软链接** 和 **硬链接。**Inode 就是对硬盘中的每一个文件通过存储其在硬盘中的位置信息而产生的一个特殊编号，每一个文件的 Inode 都不同。

### 文件目录

文件目录信息存放着每个文件的路径，通过路径来访问文件。但是常规文件和目录 **并不一定与 Inode 一一对应，**这是因为可能有多个操作系统中中的文件指向硬盘中的同一位置。

### 缓存块

我们使用了 **缓存** 技术来加强 I/O 运行效率。这是程序在运行中使用资源的特点决定的：当程序在运行时，可能会在短时间内多次处理同一文件，而在处理完成后文件访问次数就会趋于稀疏。如果每次访问都要从硬盘中读写数据，那么就会有性能浪费。所以可以把文件短时间内存在缓存中操作，再最终一次写入硬盘。不过，这可能会在并发中出现一些资源抢占或者原子化问题。

这样的处理办法有点像之前页表中的 sway 策略，不过方向相反。

### 报告

在本章中，我们接入了一个文件系统，使用 Inode 和文件目录及文件名来管理文件。我们使用了缓存技术来优化文件访问的性能开销，写了一个用于创建文件链接的系统调用。

#### Inode 根节点被破坏

Root Inode 有着帮助程序寻找其他 Inode 及文件的功能，如果 Root Inode 损坏了，那么对文件的增删改查都难以正常进行。

## 第七章：进程间通信 - July 27

在上一章中，我们令进程拥有了创建子进程的能力。但是想要各个进程间更深地交互协作，这种程度还不够。我们知道，程序之间想要协作，就需要有互相交流信息的能力，即 **通信能力。**这种进程间的通信行为是由 **管道（Pipe）** 实现的。

### 通信

现代互联网及计算机技术中，要找到电脑真正从一个「计算器」进化的节点，那必然是 **通信能力** 的逐渐强大。从网络层面上讲，一台台计算机通过网络协议相连接；在计算机内部，各个程序共享文件或内存中的信息。正是信息在计算机技术中多个维度的分发和共享，才造就了现在繁荣的赛博世界。如果计算机失去了通信能力，那它最终也只能停留在批处理阶段，无非是一个更方便的算盘而已。

### 管道和信道

如果学习过并发的知识，那我们或许会接触过 **信道（channel）**这一概念。进程想要合作维护一段数据，那么它们就有两个选择

1. 直接共享这段数据的内存，同时拥有对这段数据读写的权利；
2. 进程间通过信道来交流信息，只保留一个进程读写数据的权利。

比起共享内存，信道的方式相对更安全，因为这可能会避免一些并发中的常见问题。不过本章中并未实现信道，而是实现了 **管道。**管道是 Linux 中一种常见的命令行语法，方便地组合各个命令之间的处理流程。比起信道，管道往往只会传输和处理进程的输入与输出。

## 报告

#### 例子

比如我在处理一个 18926 行的数据文件：

{% asset_img zcore-GCP_file.png 很大的文件 %}

我想把其中 `tRNA` 的所有在 1000-2000 的字段拿出来，只需要使用管道组合命令：

```bash
awk '{if ($8>1000 && $9<2000) {print$0}}' GCF_000146045.2_R64_feature_table.txt | grep tRNA
```

**Output：**

{% asset_img zcore-pipe_output.png 管道例子输出 %}

#### 优化

我认为可以采取一种广播的方式，进程之间发送时只需传播一次让所有其他进程都听到，而进程会忽略无用的信息。

当然，也可以直接让部分进程共享资源，那么我们就要考虑处理并发问题了，也就是下一章的内容。

## 第八章：并发 - lab5 (July 20 - July 21)

我们在前几章中，做了基于 CPU 时钟中断的分时进程切换、方便动态分配内存资源的页表系统、一个简易的文件读写系统、以及具有自主运行程序能力的进程。在接下来，我们希望部分进程能以共享资源、合作处理数据的方式来运行，而不仅仅靠进程间通信。之前实现的功能都为这一目标铺垫了基础。在本章之后，我们的系统正式成为了一个原始但功能完备的内核原型。

[**Classroom** - *LearningOS / lab5-os8-Yakkhini*](https://github.com/LearningOS/lab5-os8-Yakkhini)

### 进程、线程和协程

进程建立在分时复用调度与虚拟内存隔离的基础上，进程之间地址空间隔离，由内核调度；进程中可以有多个线程，共享这一进程的地址空间但是各个线程的栈需要分离。线程可以由内核调度也可以由用户态调度，后者为绿色线程。线程中又可以有许多协程，协程的特点是不仅共享地址空间，也共享线程的栈，使开销更小。

协程一般在用户态中调度，对操作系统透明。

所以说，**区分进程、线程、协程的核心是对内存的共享程度**，而它们的调度权级并不一定不同，也不一定能或不能并发、并行。不过，从线程开始我们就需要考虑并发问题了。因为对进程来说，它们互相隔离且透明，即使并行也很难相互干扰。**当并发和资源共享都发生时，才可能出现并发问题。**

*注：我习惯采用 Rust 视角对于并发和并行的概念，即除专门讲述外，不完全区分二者。*

| 类型  |               内存特征               |
| :---: | :----------------------------------: |
| 进程  |             相互完全隔离             |
| 线程  | 同一进程内的线程共享内存，但各自用栈 |
| 协程  |   同一线程内的协程共享内存且共用栈   |

### 并发和并行

并发和并行的关系在很多地方都讲得比较模糊，有的地方讲并发和并行是两种不同的东西，有的地方则讲并行一定并发，并发不一定并行。但你深入了解这两个概念后，应该会明白 **并发与并行只是在从两个不同的角度来描述多个程序的执行状态，并发不一定并行，并行也不一定并发。**

并发指的是多个程序在同一时间开始执行（当然在学过编译原理后我们发现很多程序只是开始执行得非常接近而已，因为 CPU 在逐条执行机器码命令），而对它们是以两个不同的线程并行执行或是不停地调度切换——抑或者是两个以上的程序以这两种方式组合执行并没有约束。同样的，并行更多是在描述多个程序正在以多线程的方式同时执行而非分时复用，对于这些程序是否同时发起没有约束。当然，我们在描述多个程序并行执行时它们往往也是在同一时间点开始的，否则就可能没什么讨论的意义。这就是所谓「并行是并发的子集」说法的来源。

### 并发问题

当多个程序以线程或协程运行时，它们不仅会并行执行或者在一段时间内分时复用执行，有时也在共享内存、甚至在内存上同一位置的数据同时做操作。这就可能会带来 **并发问题。** 这是因为这些程序在运行过程中事实上存在了先后执行顺序，甚至这种顺序是无法控制的。那么，它们对同一数据的操作行为就可能彼此冲突。常见的并发问题有：

* 死锁：一个集合中的每一个线程都在等待另一个线程运行结束
* 同步缺陷：在实际上顺序不可控的并发程序中却要求一种顺序的正确
* 互斥缺陷：在并发中一个不应该被再分割的操作没有实现原子化

### 锁、信号量

想要解决这个问题，我们可以给内存资源上 **锁。**锁的本质是以一个整数来衡量资源的可用性和可用量，当整数为 0 时，就代表着这个资源不可被其他进程所访问。这其实是 **信号量** 机制的原理。而我们常见的 **互斥锁，**如 Rust 中的 `Mutex`，就是一种特殊的信号量，即这个整数的最大值只能为 `1` 代表其可被占用，被占用后就归为 `0`，代表资源不可再被二次占用，也就是上锁了。

### 银行家算法

银行家算法实际上是一种 **预防死锁** 的办法，即在分配资源前就计算分配后是否会导致后继资源不够用的结果。

那么，这种算法实际上是有不必要的性能开销的。每一次的安全性检测都需要预测之后的所有直到所有程序顺利完成的结果，这带来了庞大且不必要的计算。因为并不是不满足安全性检查的分配就一定会导致死锁。

那么，有什么优化的办法呢？

分析互斥锁 `Mutex` 的测例，我们发现死锁的来源并不是来自多个进程对多个资源的抢占，而是来自于一个进程在试图获取自己之前曾获取过的资源所有权。这种尝试被处理后，进程被切换等待，但并未取消这一次获取行为。于是当 CPU 切换回此进程时，进程会再次尝试获取资源，构成了一个无限的循环。死锁就这样产生了。

```rust
    ...
    enable_deadlock_detect(true);
    let mid = mutex_blocking_create() as usize;
    assert_eq!(mutex_lock(mid), 0); // A
    assert_eq!(mutex_lock(mid), -0xdead); // B
    mutex_unlock(mid); // A
    ...
```

这并不是一个常规意义的死锁，不过我们可以把这一进程拆分为两个线程 A 和 B，以及一个资源 Res：

* A 在开始执行时会获取资源 Res
* B 在开始执行时需要获取资源 Res
* A 释放资源的条件是 B 执行完成

这样一看，程序中存在的死锁就很明了了：当 A 先于 B 执行时，就会导致死锁。而我们知道 A 和 B 只是同一测例代码中的不同部分而已，而且没有线程区分。也就是说，A 实际上一定会先于 B 开始执行。

我们知道，银行家算法会在两种情况拒绝进程对资源的访问：一是在可用资源已不足分配时，二是在可用资源访问后无法预测出一条安全路径。此处导致应拦截的原因是第一条，所以我们不妨直接在代码中计算已用的资源和用量，当用量不足时直接使访问资源失败：

```rust
// LAB5 HINT: Return -0xDEAD if deadlock is detected
pub fn sys_mutex_lock(mutex_id: usize) -> isize {
    let process = current_process();
    let mut process_inner = process.inner_exclusive_access();
    if process_inner.available[mutex_id] == 0 && process_inner.deadlock_detect == true {
        drop(process_inner);
        return -0xDEAD;
    } else {
        process_inner.available[mutex_id] -= 1;
        let mutex = Arc::clone(process_inner.mutex_list[mutex_id].as_ref().unwrap());
        drop(process_inner);
        drop(process);
        mutex.lock();
        return 0;
    };
}

pub fn sys_mutex_unlock(mutex_id: usize) -> isize {
    let process = current_process();
    let mut process_inner = process.inner_exclusive_access();
    process_inner.available[mutex_id] += 1;
    let mutex = Arc::clone(process_inner.mutex_list[mutex_id].as_ref().unwrap());
    drop(process_inner);
    drop(process);
    mutex.unlock();
    return 0;
}

```

注意到，我们仅需要 `available[]` 数组就可以实现防止死锁的功能。

那么，既然这样就可以避免死锁，那为什么还要用更复杂的银行家算法呢？这是因为，构成死锁可能会有很多种情况。如我们有线程 `thr1` 和线程 `thr2`：

```rust
unsafe fn thr1() -> ! {
   mutex1.lock();
   mutex2.lock();
   ...
}

unsafe fn thr2() -> ! {
   mutex2.lock();
   mutex1.lock();
   ...
}
```

如果仅考虑资源限制，那么 `thr1` 访问 `mutex1` 的行为和 `thr2` 访问 `mutex2` 的行为都会被允许，接着死锁依然会出现。只有我们在对每个线程的资源用量提前检测，才可以避免。比如在 `thr1` 使用 `mutex1` 后，运行 `thr2` 线程时不止检测 `mutex2` 的可用性，也检测 `mutex1` 的可用性，才可以避免死锁。不过如测例中单资源的使用，仅使用基础的资源限制就可以完全避免死锁了。

那么，我们该如何提前得知线程将要使用的资源量？在信号量中，我们以队列的方式来维护资源访问请求，于是这个问题就迎刃而解：

```rust
pub fn sys_semaphore_up(sem_id: usize) -> isize {
    let process = current_process();
    let mut process_inner = process.inner_exclusive_access();
    process_inner.available[sem_id] += 1;
    let sem = Arc::clone(process_inner.semaphore_list[sem_id].as_ref().unwrap());
    drop(process_inner);
    sem.up();
    0
}

// LAB5 HINT: Return -0xDEAD if deadlock is detected
pub fn sys_semaphore_down(sem_id: usize) -> isize {
    let process = current_process();
    let mut process_inner = process.inner_exclusive_access();
    let sem = Arc::clone(process_inner.semaphore_list[sem_id].as_ref().unwrap());
    if process_inner.available[sem_id] - 1 <= sem.inner.exclusive_access().wait_queue.len() as i8 && process_inner.deadlock_detect == true  {
        drop(process_inner);
        return -0xDEAD;
    } else {
        process_inner.available[sem_id] -= 1;
        drop(process_inner);
        sem.down();
        return 0;
    }
}

```

注意到，我们直接在任一资源访问请求后导致无法满足所有请求时拒绝访问，以保证不会出现死锁。再以之前的双线程为例：

```rust
unsafe fn thr1() -> ! {
   mutex1.lock();
   mutex2.lock();
   ...
}

unsafe fn thr2() -> ! {
   mutex2.lock();
   mutex1.lock();
   ...
}
```

如果应用这个算法，那么 `mutex1` 所有的访问都排在队列中。在 `thr1` 的访问时，程序会预测到让其拥有 `mutex1` 会使得 `thr2` 无法再拥有 `mutex1`。这其实是比银行家算法更严苛的一种死锁检测。但是它的好处是无需像银行家算法一样不停地遍历和预测，最终形成更大的性能开销。

### 报告

在本章中，我们实现了线程，并以锁或信号量，及条件变量的方式来处理线程件因共享内存导致的并发问题。为了避免死锁，我使用了优化精简过的银行家算法，更严苛但是避免了一些性能开销。

#### 回收

需要回收的有线程的内存资源、tid，TaskControlBlock。在访问资源、线程调度中可能都会有 TaskControlBlock 的引用，不过无需专门回收，因为不会再使用这些引用了。

#### 两种实现

第一种在使用 `unlock` 后一定会解锁，再尝试切换到下一个任务；而第二种实现在找不到下一个任务后才会做解锁，但是在访问队列中寻到下一个任务后会直接安排入调度计划，而不做解锁操作。这可能会产生解锁失败的情况，使这个资源被永久地锁在了原线程中，除非额外再做解锁操作。

## 参考

[*Open-Source-OS-Training-Camp-2022 文档*](https://learningos.github.io/rust-based-os-comp2022/index.html)

[*rCore-Tutorial-Book 第三版*](https://rcore-os.github.io/rCore-Tutorial-Book-v3/index.html)

[*SCHEDULING.md*](https://github.com/LearningOS/rust-based-os-comp2022/blob/main/scheduling.md)

[*Rust 程序设计语言 - Rust 程序设计语言 简体中文版*](https://kaisery.github.io/trpl-zh-cn/title-page.html)

[*std - Rust*](https://doc.rust-lang.org/std/index.html)

[*QEMU - ArchWiki*](https://wiki.archlinux.org/title/QEMU)

[*RISC-V Assembly Programming*](https://riscv-programming.org/index.html)
