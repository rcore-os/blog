---
title: blog-hehepig166
date: 2024-04-25 10:19:26
tags:
    - author:hehepig166
mathjax: true
---



# 2024 春夏季训练营记录

## 说明

本文为训练营的每日实践记录索引，主要为按日期较随意地写下每天的记录与想法。

同时还包含对其他资料、笔记的索引。

更详细的记录在 github 仓库里 https://github.com/hehepig166/2024-OS-camp-notes



## 工具与资料

训练营社区 https://opencamp.cn/os2edu/camp/2024spring/

Github LearningOS https://github.com/Learningos

Open-Source OS Training Comp 2024 https://github.com/LearningOS/rust-based-os-comp2024

* Rust 学习
  * The Rust Programming Language https://doc.rust-lang.org/book/index.html
  * Rust By Example https://doc.rust-lang.org/rust-by-example/index.html
  * ChatGPT https://chat.openai.com/
  * rustlings https://github.com/rust-lang/rustlings
  * 中文视频（参考 The Rust Programming Language） https://www.bilibili.com/video/BV1hp4y1k7SV
  * 其实不妨试试在 LeetCode 上用 Rust 写题熟悉语法与性能更高的写法
  * The Little Book of Rust Macros https://veykril.github.io/tlborm/

* 实验指导书
  * https://rcore-os.cn/arceos-tutorial-book/ch01-02.html
  * https://rcore-os.cn/rCore-Tutorial-Book-v3/index.html
  * https://learningos.cn/rCore-Tutorial-Guide-2024S/0setup-devel-env.html



## 日历

| 一                         | 二              | 三              | 四              | 五              | 六              | 日                     |
| :------------------------- | --------------- | --------------- | --------------- | --------------- | --------------- | ---------------------- |
| 04-01                      | 04-02           | 04-03           | 04-04           | 04-05           | 04-06           | [04-07](#04-07) (开营) |
| [04-08](#04-08) (第一阶段) | [04-09](#04-09) | [04-10](#04-10) | [04-11](#04-11) | [04-12](#04-12) | [04-13](#04-13) | [04-14](#04-14)        |
| 04-15                      | [04-16](#04-16) | [04-17](#04-17) | 04-18           | 04-19           | 04-20           | [04-21](#04-21)        |
| [04-22](#04-22)            | [04-23](#04-23) |                 |                 |                 |                 |                        |
|                            |                 |                 |                 |                 |                 |                        |
|                            |                 |                 |                 |                 |                 |                        |
|                            |                 |                 |                 |                 |                 |                        |
|                            |                 |                 |                 |                 |                 |                        |
|                            |                 |                 |                 |                 |                 |                        |



## 04-07

>群公告
>欢迎大家加入春夏季操作系统训练营！
>4月7日正式开营，已报名的同学请及时学习导学视频内容！
>网址:https://opencamp.cn/os2edu/camp/2024spring/stage/0?tab=video
>
>在训练营常见问题Q&A文档https://docs.qq.com/doc/DY3VMc0tOc29KTWZ5 中，对于本期训练营有一些基本问题的介绍，也可以在群里询问
>
>2024春夏季训练营启动仪式回放
>录制文件：https://meeting.tencent.com/v2/cloud-record/share?id=95ecb9c0-64f2-4934-a671-78474f735af2&from=3&record_type=2
>密码：0407

* 开营仪式

  * rustlings -> Rust 学习

  * rcore -> Rust 重写内核实验

  * ArceOS -> 组件化 OS 项目

之前几周已经开始学习 Rust，做了 rust-lang 下的 rustlings

rust-lang::rustlings https://github.com/rust-lang/rustlings

我的解答与极其简陋随性的学习日志 https://github.com/hehepig166/my-solution-to-rustlings

（主要是 Rust 资料实在是太多了，我就只写一点关键词提一下记忆即可）

配置了一下 wsl



## 04-08

>@所有人  各位同学，第一阶段“Rust编程语言 & Rustlings答疑”第一次课程将于今晚8点开始，今晚的主要内容为Rustlings练习入门、基本数据类型，slice类型，所有权等，总共一个课时，请大家预留时间，按时进入课堂！！
>
>上课方式：点击 https://opencamp.cn/os2edu/camp/2024spring/stage/1 链接，签到并进入课堂进行直播上课

https://learningos.cn/rust-rustlings-2024-spring-ranking/

https://github.com/LearningOS/rust-rustlings-2024-spring-hehepig166

使用 ssh 链接 clone，用 ssh 鉴权

wsl2 /mnt/ 下 rustlings 更新编译可能会出问题，开发最好不要在 /mnt 目录下操作

* 第一阶段
  * [2024春夏季OS训练营--rustling训练]
    * 要求：**必须完成** 。（大部分其实和 rust-lang 里的 rustlings 一样，多了 algorithm 章节以及 test 章节中的一些练习）
  * （Option）[32 Rust Quizes](https://dtolnay.github.io/rust-quiz/1)
    * 要求：小练习全部通过。（**非必须完成**）
  * （Option）[exercisms.io 快速练习(88+道题目的中文详细描述)](http://llever.com/exercism-rust-zh/index.html)
    * 要求：大部分练习会做或能读懂。（**非必须完成**）
    * https://exercism.org/

module 的 pub 关键字只往上 pub 一层

```rust
mod delicious_snacks {
    // TODO: Fix these use statements
    pub use self::fruits::PEAR as fruit;
    pub use self::veggies::CUCUMBER as veggie;

    mod fruits {
        pub const PEAR: &'static str = "Pear";
        pub const APPLE: &'static str = "Apple";
    }

    mod veggies {
        pub const CUCUMBER: &'static str = "Cucumber";
        pub const CARROT: &'static str = "Carrot";
    }
}

fn main() {
    println!(
        "favorite snacks: {} and {}",
        delicious_snacks::fruit,
        delicious_snacks::veggie
    );

    // let a = delicious_snacks::fruits::PEAR;     // 无法访问
    let b = delicious_snacks::fruit;               // 可以访问
}
```



## 04-09

`std::f64::NAN`

Rust 中两个 `NAN` 是不相等的，要判断一个浮点数是不是 `NAN`，可以用 `.is_nan()` 函数来判断。

完成了 rust-lang 里的 rustlings。

>在 Rust 中，`?` 是一个简便的错误处理操作符，通常用于简化对 `Result` 或 `Option` 类型的值进行处理的代码。它的作用是在操作成功时返回成功的结果，如果遇到错误则将错误提早返回。
>
>在函数中使用 `?` 时，该函数的返回类型必须是 `Result` 或 `Option`。如果表达式的结果是 `Ok`（对于 `Result` 类型）或 `Some`（对于 `Option` 类型），则 `?` 会将其中的值提取出来并返回；如果结果是 `Err` 或 `None`，则整个函数会提前返回并将 `Err` 或 `None` 作为整个函数的返回值。



## 04-10

>@所有人 各位同学，第一阶段“Rust编程语言 & Rustlings答疑”第二次课程将于今晚8点开始，今晚的主要内容为Rustlings答疑，总共一个课时，请大家预留时间，按时进入课堂！！
>
>上课方式：点击 https://opencamp.cn/os2edu/camp/2024spring/stage/1 链接，签到并进入课堂进行直播上课。
>
>如果同学们有什么问题也可以在问题收集页面https://docs.qq.com/doc/DSXFzRkdodExxQUVO给老师提一下哦～

rustlings test 章节

* 条件编译

`#[cfg()]`

>`cfg()` 可以接受一些不同的条件，用于控制编译时的行为。这些条件可以是 Rust 编译器理解的一些特定标识符，也可以是自定义的条件。下面是一些常见的 `cfg()` 条件：
>
>- `target_os`: 目标操作系统，如 `"windows"`, `"linux"`, `"macos"` 等。
>- `target_arch`: 目标架构，如 `"x86"`, `"x86_64"`, `"arm"` 等。
>- `target_env`: 目标环境，如 `"gnu"`, `"msvc"`, `"musl"` 等。
>- `target_pointer_width`: 目标指针宽度，如 `"32"`, `"64"` 等。
>- `feature`: 启用的特性，如 `"myfeature"`。
>- `any()`: 如果任一条件为真则为真，语法为 `cfg(any(condition1, condition2, ...))`。
>- `all()`: 如果所有条件为真则为真，语法为 `cfg(all(condition1, condition2, ...))`。
>- `not()`: 取反，语法为 `cfg(not(condition))`。
>- 自定义条件：你可以在 `build.rs` 或者 `Cargo.toml` 中定义自己的条件，然后在 `cfg()` 中使用。
>
>这些条件可以根据实际需要组合使用，以便根据不同的情况编译不同的代码。

* 外部链接 FFI(Foreign Function Interface)

`extern`

这段代码指定 `my_demo_function` 与 `my_demo_function_alias` 从符号表中找名字为`my_demo_function`的函数链接。

而在 `Foo::my_demo_function` 中又指定了 `#[no_mangle]` ，即在编译后的目标文件中的符号名称可见并保持不变，被上面两个 extern 找到并使用。

注意这里利用这个东西，使这个函数的的 private 属性失效了。 FFI

```rust
// tests9.rs


extern "Rust" {

    #[link_name = "my_demo_function"]
    fn my_demo_function(a: u32) -> u32;

    #[link_name = "my_demo_function"]
    fn my_demo_function_alias(a: u32) -> u32;
}

mod Foo {
    // No `extern` equals `extern "Rust"`.
    #[no_mangle]
    fn my_demo_function(a: u32) -> u32 {
        a
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_success() {
        // The externally imported functions are UNSAFE by default
        // because of untrusted source of other languages. You may
        // wrap them in safe Rust APIs to ease the burden of callers.
        //
        // SAFETY: We know those functions are aliases of a safe
        // Rust function.
        unsafe {
            my_demo_function(123);
            my_demo_function_alias(456);
        }
    }
}

```

* 分析 traits 

 parse() 返回一个 Result<i64, xxxErr> 类型的东西，然后 ? 操作符对它进行处理，要是是 i64，就传给 x 然后正常继续，要是是 Err 就提前结束当前 main() ，调用 from 方法把 Err 自动转成 Box 作为 main 的返回结果？

traits 类似 C++ 中的虚基类和虚函数

```rust
fn main() -> Result<(), Box<dyn error::Error>> {
    let pretend_user_input = "42";
    let x: i64 = pretend_user_input.parse()?;
    println!("output={:?}", PositiveNonzeroInteger::new(x)?);
    Ok(())
}
```

* algorithm

区别 `ref mut root` 和 `mut &root`



## 04-11

rustlings algorithm5 bfs, algorithm6 dfs

"闭包"



## 04-12

>@所有人 各位同学，第一阶段“Rust编程语言 & Rustlings答疑”第三次课程将于今晚8点开始，今晚的主要内容为crate，option，trait和泛型及生命周期，总共一个课时，请大家预留时间，按时进入课堂！！
>
>上课方式：点击 https://opencamp.cn/os2edu/camp/2024spring/stage/1 链接，签到并进入课堂进行直播上课。
>
>如果同学们有什么问题也可以在问题收集页面https://docs.qq.com/doc/DSXFzRkdodExxQUVO给老师提一下哦

rustlings algorithm7,8 stack, algorithm9 heap, algorithm10 graph

rustlings 完成了

继续学习rust生命周期

表达式 vs. 语句

super::

泛型, trait, 生命周期

trait 作为参数，可以指定多个trait

```rust
// 以下两个代码作用相同

pub fn notify(item: &impl Summary) {	// item 为包含了Summary trait的一个引用
    println!("Breaking news! {}", item.summarize());
}

pub fn notify<T: Summary>(item: T) {	// item 为包含了Summary trait的一个引用
    println!("Breaking news! {}", item.summarize());
}

// 多个 trait
pub fn notify(item: &(impl Summary + Display));
pub fn notify<T: Summary + Display>(item: &T);

// where
// 以下两个代码效果相同
fn fun<T: Display + Clone, U: Clone + Debug>(t: &U, u: &U) -> i32 {}

fn fun<T, U>(t: &T, u: &U) -> i32
where
	T:Display + Clone,
	U: Clone + Debug,
{
    
}
```

引用的生命周期

做一做 rust quiz



## 04-13

使用工具 rustfmt 可以自动将代码格式化。有助于分析代码。

代码分析

```rust
macro_rules! m {
    ($($s:stmt)*) => {
        $(
            { stringify!($s); 1 }
        )<<*
    };
}

fn main() {
    print!(
        "{}{}{}",
        m! { return || true },
        m! { (return) || true },
        m! { {return} || true },
    );
}
```

这个是纯秀语法，没实际意义。

上面定义了一个宏规则 `m`。

 `$()*` 代表匹配一个或多个。

`$s:stmt `代表 s 是一个 statement。

` => {}` 表示匹配到模式后要展开成的代码块规则。

`$()<<*` 表示对每个 statement 得到的代码块用 `<<` 连接。

关键在于分析三行代码中各自有几个 statement。

第一个 `return || true`，是一个返回闭包 `|| true` 的 return 语句。

第二个 `(return) || true`，是一个逻辑或语句。（虽然过不了编译，但是后面是转成字符串所以没事）。

第三个 `{return} || true` 是两个语句，一个是 `{return}` 语句块，另一个是 `|| true` 闭包。

展开后，我的理解是这样：

```rust
fn main() {
    print!(
        "{}{}{}",
        { "return || true"; 1 },
        { "(return) || true"; 1 },
        { "{return}"; 1 }<<{ "|| true"; 1 },
    )
}
```





## 04-14

继续看看 rust quiz



## 04-16

去看了吉卜力展



## 04-17

rust quiz

rcore 实验一

学习：Rust 生命周期

* 无界生命周期 unsafe

* 生命周期约束 HRTB

  * `'a: 'b` 表示 `'a` 至少活得跟 `'b` 一样久

  * `T: 'a` 类型 `T` 必须比 `'a` 活得久

* 生命周期与子类型

  * 子类型至少比父类型大

* 引用的生命周期：从借用处开始，直到最后一次使用的地方

* reborrow

  * ```rust
    let mut p = Point {x: 0, y: 0};
    let r = &mut p;
    let rr: &Point = &*r;
    ```

  * 




## 04-21

rCore ch1 应用程序与基本执行环境

https://learningos.cn/rCore-Tutorial-Guide-2024S/chapter1/0intro.html

* 一些工具

  * file

  * rust-readobj

  * rust-objdump

* RustSBI

  * >SBI 是 RISC-V 的一种底层规范，RustSBI 是它的一种实现。 操作系统内核与 RustSBI 的关系有点像应用与操作系统内核的关系，后者向前者提供一定的服务。只是SBI提供的服务很少， 比如关机，显示字符串等。

* rust 语法

  *  println 宏



## 04-22

rCore ch2 批处理系统

https://learningos.cn/rCore-Tutorial-Guide-2024S/chapter2/index.html

* 内存布局

  * 起始物理地址 `0x80400000`

* 系统调用

  * write, exit

* 批处理系统

  * 应用程序链接到内核

  * 找到、加载应用程序二进制文件

  * `AppManager`

    * `load_app()`

    * ```rust
          unsafe fn load_app(&self, app_id: usize) {
              if app_id >= self.num_app {
                  println!("All applications completed!");
                  use crate::board::QEMUExit;
                  crate::board::QEMU_EXIT_HANDLE.exit_success();
              }
              println!("[kernel] Loading app_{}", app_id);
              // clear app area
              core::slice::from_raw_parts_mut(APP_BASE_ADDRESS as *mut u8, APP_SIZE_LIMIT).fill(0);
              let app_src = core::slice::from_raw_parts(
                  self.app_start[app_id] as *const u8,
                  self.app_start[app_id + 1] - self.app_start[app_id],
              );
              let app_dst = core::slice::from_raw_parts_mut(APP_BASE_ADDRESS as *mut u8, app_src.len());
              app_dst.copy_from_slice(app_src);
              // Memory fence about fetching the instruction memory
              // It is guaranteed that a subsequent instruction fetch must
              // observes all previous writes to the instruction memory.
              // Therefore, fence.i must be executed after we have loaded
              // the code of the next app into the instruction memory.
              // See also: riscv non-priv spec chapter 3, 'Zifencei' extension.
              asm!("fence.i");
          }
      ```

    * >清空内存前，我们插入了一条奇怪的汇编指令 `fence.i` ，它是用来清理 i-cache 的。 我们知道， 缓存又分成 **数据缓存** (d-cache) 和 **指令缓存** (i-cache) 两部分，分别在 CPU 访存和取指的时候使用。 通常情况下， CPU 会认为程序的代码段不会发生变化，因此 i-cache 是一种只读缓存。 但在这里，我们会修改会被 CPU 取指的内存区域，使得 i-cache 中含有与内存不一致的内容， 必须使用 `fence.i` 指令手动清空 i-cache ，让里面所有的内容全部失效， 才能够保证程序执行正确性。

* 特权级切换

  * 硬件机制
    * U/S 特权级
    * 相关 CSR
      * sstatus
      * spec
      * scause
      * stval
      * stvec
  * 用户栈、内核栈
  * trap 管理



* 荣誉准则

>1. 在完成本次实验的过程（含此前学习的过程）中，我曾分别与 **以下各位** 就（与本次实验相关的）以下方面做过交流，还在代码中对应的位置以注释形式记录了具体的交流对象及内容：
>
>  > *《你交流的对象说明》*
>
>2. 此外，我也参考了 **以下资料** ，还在代码中对应的位置以注释形式记录了具体的参考来源及内容：
>
>  > *《你参考的资料说明》*
>
>3. 我独立完成了本次实验除以上方面之外的所有工作，包括代码与文档。 我清楚地知道，从以上方面获得的信息在一定程度上降低了实验难度，可能会影响起评分。
>
>4. 我从未使用过他人的代码，不管是原封不动地复制，还是经过了某些等价转换。 我未曾也不会向他人（含此后各届同学）复制或公开我的实验代码，我有义务妥善保管好它们。 我提交至本实验的评测系统的代码，均无意于破坏或妨碍任何计算机系统的正常运转。 我清楚地知道，以上情况均为本课程纪律所禁止，若违反，对应的实验成绩将按“-100”分计。



## 04-23

Rust 学习

* 闭包（匿名函数）

  * 本质：拥有可能关联上下文的匿名函数体

  * 允许捕获被定义时所在作用域中的值（不像函数，必须显式传参）

  * ```rust
    fn add_one_v1     (x: u32) -> u32 { x+1 }
    let add_one_v2 =  |x: u32| -> u32 { x+1 };
    let add_one_v3 =  |x|             { x+1 };
    let add_one_v4 =  |x|               x+1  ;
    ```

    后面两个要编译必须使用。

  * 使用 move 强制获取所有权

  * Fn trait

    * FnOnce
    * FnMut
    * Fn

* 智能指针

  * Box    -> 将值放在堆上而非栈上
    * 针对编译时位置大小的类型
    * 有大量数据并确保数据不被拷贝的情况下转移所有权时
    * 拥有一个值并只关心它的类型是否实现了特定trait而非具体类型时
    * Deref trait
  * Rc       -> 引用计数
    * 图
    * clone
    * 克隆 `Rc<T>` 会增加其引用计数
    * 不可变引用
  * RefCell  -> 内部可变性指针
    * Interior mutability
      * 该数据结构中使用了 unsafe 代码来模糊 Rust 通常的可变性和借用规则
    * 任意时刻，只能拥有一个可变引用或任意数量的不可变引用之一
    * 引用必须总是有效的

* async