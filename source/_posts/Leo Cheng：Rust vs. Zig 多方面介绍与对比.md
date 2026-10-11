---
title: 'Leo Cheng: Rust & Zig 多方面介绍与对比'
date: 2026-05-01 21:43:45
categories:
    - Leo Cheng
tags:
    - author:heke1228
    - repo:https://cnb.cool/heke_learning/Rustlings
    - Rust
    - Zig
    - Programming Languages
    - Beginner
---

> AI4OSE 期间，我们与 Agent 协作学习各项知识，并且 Agent 出题 讲解 以及 苏格拉底式 的急速学习法。所以最后也有 Agent 自动插入笔记的问题和自己的回答，如果答案不充分，则我的作答还会有 Agent 协调补充的内容。相关提示词：如果我有疏漏，给我补充，且讲解充分后继续向我提问查缺补漏，最后一同沉淀到我们的笔记中！

<!-- more -->

{% note info %}
两门语言都想做「更好的 C」，都不要 GC，走的却是两条路：Rust 用编译期的强制规则换安全，Zig 用显式和简单换可控。文中代码以 Zig `0.17.0-dev.224`、Rust `1.94` 为准。我关注 Zig，起因是它对函数染色（function coloring）的处理特点，见「并发、异步与函数染色」。
{% endnote %}

## 设计哲学

| | Rust | Zig |
|:--:|:--:|:--:|
| 取向 | 安全优先，零成本抽象 | 简单、显式，没有隐藏行为 |
| 安全模型 | 编译期强制，借用检查器拒绝违规代码 | 运行期检查，可按构建模式关闭 |
| 抽象 | trait、泛型、生命周期，层层零成本 | 很少抽象，写什么就执行什么 |
| 对程序员的态度 | 按我的规则写，我保证安全 | 给你工具，出错由你负责 |
| 成熟度 | 2015 年 1.0，承诺向后兼容 | 0.x，版本之间经常不兼容 |

Zig 有五条「无隐藏」原则，后面的语法都由此而来：

| 原则 | 含义 |
|:--:|:--:|
| 无隐藏控制流 | 没有运算符重载、析构函数和异常，`a + b` 就是加法，不会调用别的函数 |
| 无隐藏内存分配 | 标准库不自己分配堆内存，要分配就把 `Allocator` 显式传进来 |
| 编译期与运行期同一套语法 | `comptime` 用的就是普通 Zig 代码 |
| 错误是值 | `error.Foo` 是枚举值，`!T` 是错误联合类型，没有异常 |
| 与 C 直接互通 | 与 C 的 ABI 直接兼容，C 头文件经构建系统翻译成 Zig 模块 |

从 Rust 的角度看，Zig 的取舍是：不要编译期的安全保证，元编程统一成 `comptime`，与 C 的互通做到最直接。

## 第一印象

{% tabs hello, 1 %}
<!-- tab Zig -->
```zig
const std = @import("std");

pub fn main() !void {                                 // !void：可能返回错误
    std.debug.print("Hello, {s}!\n", .{"Zig"});       // .{...} 是匿名元组，即参数列表
}
```
<!-- endtab -->
<!-- tab Rust -->
```rust
fn main() {
    println!("Hello, {}!", "Rust");                   // println! 是宏
}
```
<!-- endtab -->
{% endtabs %}

`@import` 这类 `@` 开头的是 Zig 的内建函数，由编译器提供，用户不能新增；`.{...}` 既是匿名结构体也是元组。Rust 的 `println!` 是宏，Zig 没有宏，格式串在 `comptime` 里检查。

## 类型系统

### 任意位宽的整数

```zig
const a: u8 = 0xFF;
const b: u7 = 127;          // 任意位宽：u1 到 u65535
const c: u3 = 0b101;        // 适合描述寄存器位段
const w = a +% 1;           // +% 回绕，+| 饱和
```

Rust 只有固定位宽的整数，3 位字段要手写位运算或用 `bitflags`。Zig 的 `u3` 与 `packed struct(u8)` 让寄存器和协议的位段既有类型检查，又没有额外开销。

### 可选类型与错误联合

| | Rust | Zig |
|:--:|:--:|:--:|
| 可空 | `Option<T>`，即 `Some`、`None` 枚举 | `?T`；`?*T` 用空指针表示，不占额外空间 |
| 解包 | `match`、`if let`、`?`、`unwrap()` | `if (x) \|v\|`、`orelse 默认值`、`.?` |
| 错误 | `Result<T, E>` 枚举 | `E!T` 错误联合，见「错误处理」 |

{% tabs optional, 1 %}
<!-- tab Zig -->
```zig
var opt: ?u32 = null;
const v = opt orelse 0;        // 默认值
const f = opt.?;               // 断言非空，为空则 panic
if (opt) |val| { _ = val; }    // 解包
```
<!-- endtab -->
<!-- tab Rust -->
```rust
let opt: Option<u32> = None;
let v = opt.unwrap_or(0);
let f = opt.unwrap();          // 为 None 则 panic
if let Some(val) = opt { let _ = val; }
```
<!-- endtab -->
{% endtabs %}

### struct、enum、union

```zig
const Value = union(enum) {    // 带标签的联合，标签自动生成
    int: i64,
    text: []const u8,
    empty,
};

switch (v) {                   // switch 必须覆盖所有情况
    .int => |n| use(n),
    .text => |s| use(s),
    .empty => {},
}
```

对应 Rust 的 `enum Value { Int(i64), Text(String), Empty }` 加 `match`，几乎一一对应，这是两门语言最像的地方：代数数据类型加穷尽匹配。区别在于 Zig 还能写不带标签的 C 风格 `union`，用 `@bitCast` 重新解释；Rust 的裸 `union` 要 `unsafe`。

### 切片、指针与字符串

| 类型 | Zig | Rust 中对应的写法 |
|:--:|:--:|:--:|
| 切片 | `[]T`、`[]const u8` | `&mut [T]`、`&[T]`、`&str` |
| 单值指针 | `*T`、`*const T` | `&mut T`、`&T`、`*mut T` |
| 多值指针 | `[*]T`，不带长度 | `*mut T` |
| C 指针 | `[*c]T`，可为空、可为 0 | `*mut T` 加 FFI |
| 哨兵结尾 | `[*:0]const u8`，即 C 字符串 | `CStr` |

Zig 没有 `String` 类型，字符串就是 `[]const u8`，字面量是 `[N:0]u8`；Rust 区分拥有所有权的 `String` 与借用的 `&str`。Zig 的指针种类分得更细，因为它要直接对接 C 与硬件，又没有借用检查器，只能靠类型写清「能不能为空、知不知道长度」。

## 内存管理

### 所有权与显式分配器

Rust 用所有权和借用检查器在编译期决定每块内存何时释放，`drop` 自动调用，分配器一般看不见。

Zig 没有所有权、借用检查器和自动析构。谁要堆内存，就把分配器当参数传进去：

```zig
fn process(a: std.mem.Allocator, data: []const u8) ![]u8 {
    const out = try a.alloc(u8, data.len * 2);   // 显式分配
    // 调用者负责 a.free(out)
    return out;
}
```

这样在设计时就得想清楚谁分配、谁释放。标准库容器也一样，0.15 起 `ArrayList` 不再保存分配器，每次修改都要传：

```zig
var dbg = std.heap.DebugAllocator(.{}){};       // 旧名 GeneralPurposeAllocator 已删
defer _ = dbg.deinit();                         // 退出时报告内存泄漏
const a = dbg.allocator();
var list: std.ArrayList(u8) = .empty;           // 不保存分配器
defer list.deinit(a);
try list.append(a, 7);                          // 每次显式传 a
try list.appendSlice(a, &.{ 8, 9 });            // 结果 { 7, 8, 9 }
```

分配策略因此成了参数：测试时换 `FixedBufferAllocator` 就能在裸机上跑，`ArenaAllocator` 一次性释放，`DebugAllocator` 自动查泄漏。代价是写起来啰嗦，而且没有借用检查器把关，释放后再用要靠下面的机制防。

### `defer` 与 `errdefer`

```zig
fn init(a: std.mem.Allocator) !*Res {
    const r = try a.create(Res);
    errdefer a.destroy(r);     // 只在本函数以错误返回时执行
    try r.setup();             // 这里出错就清理 r，不泄漏
    return r;                  // 成功返回，errdefer 不执行
}
```

- `defer`：离开作用域时执行，后进先出。获取资源后紧跟一行 `defer x.deinit()`，释放与分配写在一起，不容易漏。
- `errdefer`：只在错误返回的路径上执行。Rust 要靠 `?` 加 `Drop` 才有的「出错自动清理」，Zig 用一个关键字显式写出来。

Zig 的 `defer` 是块级的，离开所在的块就执行；Go 的 `defer` 是函数级的，函数返回时才执行。在循环里差别很大：Zig 每轮循环结束就执行，Go 攒到函数末尾一起执行。Rust 用 RAII 与 `Drop` 自动析构，不用写关键字；Zig 用 `defer` 显式写出。一个自动但看不见，一个手写但看得见，两门语言的差别大体如此。

## 错误处理

{% tabs errors, 1 %}
<!-- tab Zig -->
```zig
const MyError = error{ TooHot, TooCold };     // 错误集：一组扁平的标签

fn readTemp() MyError!i32 {                   // !T：错误联合
    return error.TooHot;                      // 只返回标签，不带数据
}

pub fn main() !void {
    const t = readTemp() catch |e| blk: {     // catch 捕获
        std.debug.print("err: {}\n", .{e});
        break :blk 0;
    };
    const t2 = try readTemp();                // try：出错就向上传播
    _ = .{ t, t2 };
}
```
<!-- endtab -->
<!-- tab Rust -->
```rust
enum ReadError { TooHot(i32), TooCold(i32) }  // E 可以带任意数据

fn read_temp() -> Result<i32, ReadError> {
    Err(ReadError::TooHot(42))
}

fn main() -> Result<(), ReadError> {
    let t = read_temp()?;                     // ? 向上传播
    let _ = t;
    Ok(())
}
```
<!-- endtab -->
{% endtabs %}

| | Rust `Result<T, E>` | Zig `E!T` |
|:--:|:--:|:--:|
| 错误能否带数据 | 能，`E` 是任意类型 | 不能，错误只是全局的扁平标签 |
| 体积 | 取决于 `E`，可能很大 | 很小：标签加 `T` |
| 传播 | `?` | `try` |
| 出错时清理 | `Drop`，自动 | `errdefer`，显式 |

`@sizeOf(anyerror)` 是 2（一个 `u16` 错误号），`@sizeOf(MyError!i32)` 是 8：`i32` 的 4 字节加标签的 2 字节，再补齐。底层就是一次整数比较加一次返回，没有堆分配。

Zig 的错误更像有类型的 `errno`，适合只需知道「出了什么错」的系统代码。要带上下文，就自己设计一个结构体作为返回值，不要放进错误联合。

## `comptime`

Rust 的元编程是四套互不相通的机制：声明宏（改写 token）、过程宏（编译期运行、相互隔离的 Rust 代码）、泛型（单态化）与 `const fn`（常量求值）。

Zig 只有 `comptime`：编译器在语义分析阶段直接执行这段普通的 Zig 代码，结果作为常量或类型用在原处。同一门语言、同一套语法，既写运行期也写编译期。

```zig
// 编译期算好查找表，运行期直接查。文件作用域的常量本来就在编译期求值。
const upper = blk: {
    var t: [256]u8 = undefined;
    for (&t, 0..) |*c, i| c.* = if (i >= 'a' and i <= 'z') @intCast(i - 32) else @intCast(i);
    break :blk t;
};
```

对应 Rust 的四套机制：

| Rust | Zig |
|:--:|:--:|
| 泛型 `fn f<T>()` | `comptime T: type` 参数，见「泛型与多态」 |
| 声明宏、过程宏 | 返回类型或值的 `comptime` 函数 |
| `const fn` | `comptime` 块或函数 |
| 反射（serde、过程宏） | `@typeInfo(T)` 编译期类型反射 |

编译期反射在 Rust 里要靠过程宏，Zig 内建：

```zig
fn dumpFields(comptime T: type) void {
    inline for (@typeInfo(T).@"struct".fields) |f| {      // 字段名全小写：.@"struct"
        std.debug.print("{s}: {s}\n", .{ f.name, @typeName(f.type) });
    }
}
```

版本差异：类型反射的字段名全小写（`.int`、`.@"struct"`、`.@"fn"`，不是旧的 `.Int`）；构造类型用 `@Int(.unsigned, 32)`、`@Struct` 等专用内建函数，`@Type` 在 0.16 删除，再用会报 `invalid builtin function: '@Type'`。

`comptime` 写起来比 Rust 啰嗦（要写工厂函数），但编译期做了什么一目了然，没有宏那样对 token 的改写。

## 泛型与多态

Zig 没有 `trait`、生命周期标注和泛型尖括号，泛型用 `comptime` 实现，有两种写法。

类型工厂，显式造一个类型：

{% tabs generic, 1 %}
<!-- tab Zig -->
```zig
fn Stack(comptime T: type) type {             // 传入类型，返回一个新的结构体类型
    return struct {
        items: std.ArrayList(T) = .empty,
        pub fn push(s: *@This(), a: std.mem.Allocator, v: T) !void {
            try s.items.append(a, v);
        }
    };
}

const IntStack = Stack(i32);                  // 显式实例化
```
<!-- endtab -->
<!-- tab Rust -->
```rust
struct Stack<T> { items: Vec<T> }             // 编译器推断 T，隐式单态化

impl<T> Stack<T> {
    fn push(&mut self, v: T) { self.items.push(v) }
}
```
<!-- endtab -->
{% endtabs %}

`anytype`，按传入的参数推断类型：

```zig
fn add(a: anytype, b: anytype) @TypeOf(a) {
    return a + b;
}
```

两种写法都会单态化，每个具体类型生成一份代码，和 Rust 泛型一样没有运行期开销。

| | Rust | Zig |
|:--:|:--:|:--:|
| 泛型 | `fn f<T: Trait>`，编译器隐式推导，trait 约束 | `Foo(comptime T: type)` 显式工厂，或 `anytype` |
| 约束 | trait bound，编译期的接口契约 | `@hasDecl` 加 `@compileError` 手动检查 |
| 生命周期 | `<'a>` 标注，借用检查器验证 | 没有，指针是否有效靠程序员 |
| 报错 | 约束不满足时报清晰的 trait 错误 | 报错可能出现在实例化的深处 |

Rust 先声明契约再实现，结构清楚、好读；Zig 直接用，编译期发现缺方法才报错，更灵活也更啰嗦。

## 安全检查

Rust 的借用检查器与 `Send`、`Sync` 在编译期保证内存安全、没有数据竞争，违规代码编译不过，只有 `unsafe` 块能绕开。

Zig 没有借用检查器，内存安全靠运行期检查，并且可以按构建模式关掉：

| 模式 | 命令 | 安全检查 | 速度与体积 |
|:--:|:--:|:--:|:--:|
| `Debug` | 默认 | 全开（越界、溢出、释放后使用、空值），`undefined` 填 `0xAA` | 最慢 |
| `ReleaseSafe` | `-Doptimize=ReleaseSafe` | 仍然开着 | 优化，带检查 |
| `ReleaseFast` | `-Doptimize=ReleaseFast` | 全关 | 最快，和 C 一样不做检查 |
| `ReleaseSmall` | `-Doptimize=ReleaseSmall` | 全关 | 体积最小，裸机常用 |

另外 `DebugAllocator` 在 Debug 模式下自动查内存泄漏、重复释放与释放后使用。

Rust 在编译期拦下所有违规；Zig 把检查放到运行期，在 Debug 下抓问题，要性能时关掉。系统编程有时更需要「不被拦下」而不是「绝对安全」，这是两门语言最根本的分歧。

## 并发、异步与函数染色

### 什么是函数染色

Bob Nystrom 在 2015 年的《What Color is Your Function?》里指出：语言引入 `async`、`await` 之后，函数分成两色，普通函数（红）与异步函数（蓝）。蓝函数只能被蓝函数调用，并沿调用链往上传染：底层一个 `async`，上面全得 `async`。

| 语言 | 做法 | 是否染色 |
|:--:|:--:|:--:|
| Python、JavaScript、Rust | `async`、`await` 关键字 | 有，会传染 |
| Go、Java 虚拟线程 | goroutine，阻塞时自动挂起 | 无 |
| Zig 0.10 及以前 | stage1 编译器的 `async`、`await` | 有，同 Rust |
| Zig 0.11 至 0.14 | 自举编译器没有实现 async，关键字保留但不能用 | 不可用 |
| Zig 0.15 起 | 删掉 `async`、`await`，0.16 起异步能力经 `std.Io` 参数传入 | 设计上无 |

### Zig 的做法

```zig
pub fn main() void {
    var fr = async foo();
}
// error: expected ';' after statement  （async 已经不是关键字）
```

Zig 在 0.15 删除了 `async`、`await` 关键字（`suspend`、`resume` 还能通过语法检查，编译时报 async 未在自举编译器中实现）：旧实现让编译器过于复杂，做不到真正的零开销，与 `comptime` 的配合也困难。没有标记颜色的关键字，函数也就不分颜色。

0.16 起，异步能力通过 `std.Io` 接口作为参数传入，函数本身不分颜色：

```zig
fn double(x: u32) u32 {
    return x * 2;
}

fn run(io: std.Io) u32 {
    var a = io.async(double, .{20});      // 交给 io 调度，返回 Future
    var b = io.async(double, .{1});
    return a.await(io) + b.await(io);     // 42
}
```

同一个 `run`，传入什么 `Io` 实现就怎么调度：0.16 里完整可用的是线程池版 `Io.Threaded`，基于用户态栈切换的 `Io.Evented` 与基于 io_uring 的 `Io.Uring` 还在实验阶段。

### 评价

染色并没有消失，只是推迟到了调用方：选定 `Io` 实现的那一刻，颜色就定了。

旧设计把「是否异步」写进函数类型，沿类型传染；新设计把「怎么调度」放进参数，函数本身不分颜色，但调用链仍要一路把 `io` 传下去，只是从「类型传染」变成了「参数传染」，从编译期强制变成了约定。Zig 没有消灭染色，而是换成了更可控、更显式的形式。

除了 `std.Io`，Zig 里写并发还可以用手工状态机（裸机与 `no_std` 始终可用）、`std.Thread`（有操作系统时），或社区库 libxev（事件循环）、zigcoro（有栈协程，用汇编切换上下文，支持 RISC-V）。

### 原子操作

{% tabs atomic, 1 %}
<!-- tab Zig -->
```zig
var ctr = std.atomic.Value(u64).init(0);
_ = ctr.fetchAdd(1, .monotonic);                                   // .monotonic、.acquire、.release、.acq_rel、.seq_cst
const ok = ctr.cmpxchgWeak(0, 1, .acq_rel, .monotonic) == null;    // CAS，成功时返回 null
```
<!-- endtab -->
<!-- tab Rust -->
```rust
use std::sync::atomic::{AtomicU64, Ordering};
let ctr = AtomicU64::new(0);
ctr.fetch_add(1, Ordering::Relaxed);                               // Relaxed、Acquire、Release、AcqRel、SeqCst
```
<!-- endtab -->
{% endtabs %}

两门语言的内存序都沿用 C++11 的模型：Zig 的 `.monotonic` 对应 Rust 的 `Relaxed`，其余同名。

## 标准库

Zig 的 `std` 与它的设计取向一致：不默认分配堆内存，错误是返回值，没有全局状态。

| 用途 | Rust `std` | Zig `std` |
|:--:|:--:|:--:|
| 动态数组 | `Vec<T>`：`push`、`pop`、`len` | `std.ArrayList(T)`（`.empty`）：`append(a, x)`、`pop`、`items.len` |
| 哈希表 | `HashMap<K, V>`、`BTreeMap` | `std.AutoHashMap(K, V)`、`std.StringHashMap(V)`（`.init(a)`） |
| 集合 | `HashSet`、`BTreeSet` | 没有单独的 Set，用 `AutoHashMap(K, void)` |
| 字符串 | `String` 与 `&str`，保证 UTF-8 | `[]const u8`，编码自己负责；拼接用 `ArrayList(u8)` 或 `std.fmt.allocPrint` |
| 可空 | `Option<T>`：`unwrap_or`、`map`、`?` | `?T`：`orelse`、`.?`、`if (x) \|v\|` |
| 错误 | `Result<T, E>`：`?` | `E!T`：`try`、`catch` |
| 格式化成字符串 | `format!("{}", x)` | `std.fmt.allocPrint(a, "{}", .{x})`，要传分配器 |
| 打印 | `println!`、`print!` | `std.debug.print("{}\n", .{x})` |
| 排序与二分 | `slice.sort()`、`binary_search` | `std.mem.sort(T, s, ctx, less)`、`std.sort.binarySearch` |
| 遍历 | `Iterator` trait 加 `map`、`filter`、`collect` | 没有 `Iterator` trait，手写 `for`、`while`，或用容器自带的 `iterator()` |
| 随机数 | `rand`（第三方库） | `std.Random`，标准库自带 |
| JSON | `serde_json`（第三方库） | `std.json`，标准库自带 |
| 文件与 I/O | `std::fs`、`std::io` | `std.Io`，0.16 起所有 I/O 都要传 `io` |
| 时间 | `std::time::{Instant, Duration}` | `std.time` |
| 命令行与环境变量 | `std::env::{args, var}` | 0.16 起 `main` 可以接收 `std.process.Init`，参数与环境变量从这里取 |

两点贯穿全表：要分配就传分配器（`append(a, x)`、`allocPrint(a, ...)`、`init(a)`），Rust 用全局分配器把这一层藏了起来；Zig 没有 `Iterator` trait，没有惰性的 `map`、`filter`、`collect` 链。

I/O 在 0.15 重做了 `Writer` 接口，0.16 又改成所有 I/O 都经 `Io`，文件、时间、进程这几行变化最大，函数名以所用版本的标准库为准；文中示例的输出统一用 `std.debug.print`。

## C 互操作

Rust 调 C：写 `bindgen` 构建脚本，生成一批 `extern "C"` 与 `unsafe fn`，处理 `#[link]` 与库路径；常量宏能翻译，函数式宏要手工改写；`size_t` 与 `usize`、`int*` 与 `*mut i32` 两套类型来回转换。

Zig 调 C：0.16 起由构建系统翻译 C 头文件（之前是语言内建的 `@cImport`，0.16 弃用，0.17 已删除）。

{% tabs cinterop, 1 %}
<!-- tab build.zig -->
```zig
const c = b.addTranslateC(.{
    .root_source_file = b.path("src/c.h"),    // 里面写 #include <stdio.h>
    .target = target,
    .optimize = optimize,
});
exe.root_module.addImport("c", c.createModule());
```
<!-- endtab -->
<!-- tab src/main.zig -->
```zig
const c = @import("c");

pub fn main() void {
    _ = c.printf("Hello from Zig!\n");        // 直接调用，不需要 unsafe
}
```
<!-- endtab -->
{% endtabs %}

| | Rust | Zig |
|:--:|:--:|:--:|
| 绑定生成 | `bindgen`，独立工具加 `build.rs` | 构建系统的 translate-c，基于 Clang 解析头文件 |
| C 宏 | 常量宏可翻译，函数式宏手工改写 | translate-c 翻译常量宏与简单的函数式宏 |
| `unsafe` | FFI 调用都要 `unsafe` 块 | 没有 `unsafe` 关键字，直接调用 |
| 指针 | `*mut i32` 与 `int*` 两套 | 翻译成 `[*c]i32`，直接用 |
| 交叉编译 C | 要装目标平台的工具链 | `zig cc -target riscv64-linux` 自带 libc 与 sysroot |

Zig 更像 C 的升级：保留 C 的直接，多了 `defer`、编译期计算和显式分配器，去掉了宏。改造旧 C 项目可以分步：先把 `zig cc` 当跨平台的 C 编译器用，再逐个模块用 Zig 重写。

## 构建系统与包管理

| | Rust（Cargo） | Zig |
|:--:|:--:|:--:|
| 构建脚本 | `Cargo.toml`（声明式）加 `build.rs` | `build.zig`，用 Zig 写的构建图 |
| 包清单 | `Cargo.toml` | `build.zig.zon`（Zig 对象记法） |
| 注册中心 | crates.io，中心化 | 没有官方中心，靠 URL 加哈希或本地路径 |
| 加依赖 | `cargo add foo` | `zig fetch --save <url>` |
| 跨平台构建 | 需要目标平台的工具链 | `-Dtarget=riscv64-freestanding-none`，内建交叉编译 |

Zig 没有 crates.io 这样的中央仓库，包的收录靠社区索引站：Codeberg、GitHub 等代码平台上的公开仓库打上 `zig-package` 话题标签，就会被自动收进「Zig 包」列表，门槛很低，质量也参差不齐。

```zig
// build.zig：构建脚本就是普通 Zig 代码，可以用 if、for、comptime 编排
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const exe = b.addExecutable(.{
        .name = "app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
        }),
    });
    b.installArtifact(exe);
}
```

Cargo 生态成熟（crates.io 有几十万个包，版本解析强）、声明式好读；`build.zig` 是图灵完备的构建脚本，能交叉编译、能编 C、能跑任意步骤，但没有中心化的注册表，可用的包少。库的数量 Rust 占优，构建的灵活性与交叉编译 Zig 占优。

## 裸机、嵌入式与 RISC-V

Rust 用 `#![no_std]`，Zig 用 `freestanding` 目标，都能脱离操作系统与 libc 在裸机上跑。

| 能力 | Rust（`no_std`） | Zig（`freestanding`） |
|:--:|:--:|:--:|
| 脱离操作系统 | `#![no_std]` 加 `#![no_main]` | `-target riscv64-freestanding-none` |
| 入口 | `#[unsafe(no_mangle)] extern "C" fn _start` | `export fn _start() callconv(.naked)` |
| 裸函数 | `#[unsafe(naked)]` 加 `naked_asm!`，1.88 起稳定 | `callconv(.naked)`，内建 |
| 内联汇编 | `core::arch::asm!` | `asm volatile (...)` |
| MMIO | `read_volatile`、`write_volatile` | `*volatile T` 加 `@ptrFromInt` |
| panic | `#[panic_handler]` | `pub fn panic(...)` |
| 链接脚本 | `build.rs` 加 `.cargo/config` | `exe.setLinkerScriptPath(...)`，在 `build.zig` 里 |

```zig
// 裸机 RISC-V 入口、CSR 与 MMIO，全部用语言内建的能力
export fn _start() callconv(.naked) noreturn {
    asm volatile (
        \\csrr t0, mhartid
        \\bnez t0, .Lwait
        \\la sp, _stack_top
        \\call zigStart
        \\.Lwait: wfi
        \\ j .Lwait
        ::: .{ .t0 = true, .sp = true, .ra = true });     // 被改动的寄存器写成结构体
}

const uart: *volatile u8 = @ptrFromInt(0x10000000);       // MMIO 寄存器

fn putc(c: u8) void {
    uart.* = c;
}
```

Rust 的裸机生态强（`embedded-hal`、`cortex-m`、`svd2rust` 一整套 trait 与自动生成的外设访问层），但裸函数这类底层能力进入稳定版较晚。Zig 把裸函数、内联汇编、链接脚本、任意位宽整数、`packed struct(u8)` 寄存器位段、编译期计算页表常量都做进了语言核心，写 SBI 与 bootloader 更顺手。两门语言都比 C 依赖宏和手写链接脚本的做法省事。

## 工具链与编译模型

| | Rust | Zig |
|:--:|:--:|:--:|
| 一站式 | rustup、cargo、clippy、rustfmt | 一个 `zig` 可执行文件：`build`、`test`、`fmt`、`cc` 都在里面 |
| LSP | rust-analyzer，功能强 | zls，社区维护 |
| 编译后端 | LLVM；Cranelift 后端可选，GCC 后端在开发 | LLVM 加自研后端，调试构建可以不经 LLVM |
| 编译速度 | 慢（借用检查、单态化、LLVM） | 快，调试构建尤其明显 |
| 格式化 | `cargo fmt` | `zig fmt`，没有配置项，风格统一 |

Zig 用一个可执行文件包办构建、测试、格式化与 C 编译，并用自研后端缩短调试构建的时间；Rust 的工具链更成熟，clippy 与 rust-analyzer 的体验很好。

## 稳定性与成熟度

| | Rust | Zig |
|:--:|:--:|:--:|
| 版本 | 1.0 于 2015 年发布 | 0.16 于 2026 年 4 月发布，未到 1.0 |
| 兼容承诺 | 有，edition 机制保证老代码能继续编译 | 没有 |
| 更新方式 | 加功能，不破坏旧代码 | 经常大改 |

按旧版本文档写的 Zig 代码，到 `0.17.0-dev.224` 已有多处编不过：

| 旧写法 | 现在的写法 | 哪一版改的 |
|:--:|:--:|:--:|
| `@Type(.{ .int = ... })` | `@Int(.unsigned, N)` | 0.16 删除 `@Type` |
| `std.heap.GeneralPurposeAllocator` | `std.heap.DebugAllocator` | 0.14 改名，0.17 开发版已无旧名 |
| `ArrayList(T).init(a)`，容器保存分配器 | `ArrayList(T)` 默认不存分配器，`.empty` 初始化，每次传分配器 | 0.15 |
| `async`、`await` 关键字 | 删除，异步改走 `std.Io` | 0.15 删除，0.16 加入 `std.Io` |
| `@typeInfo` 的 `.Int`、`.Struct` | `.int`、`.@"struct"` | 0.14 |
| `@cImport` | 构建系统的 `addTranslateC` | 0.16 弃用，0.17 开发版已删除 |

Zig 在 1.0 之前不保证兼容，文档里的写法随版本变；付出的是稳定性，换来的是语言还能继续大改。

## 适用场景

| 要做的事 | 推荐 | 原因 |
|:--:|:--:|:--:|
| Web 服务、分布式、后端 | Rust | 生态成熟（tokio、axum），并发安全由编译期保证，适合大团队协作 |
| 安全关键、长期维护的大项目 | Rust | 借用检查器加 1.0 的兼容承诺，重构有底气 |
| 内核、驱动、bootloader、SBI | Zig | 裸函数、内联汇编、位段、`comptime` 都是内建的，编译快 |
| 游戏引擎、高性能、手动管理内存 | Zig | 显式分配器，`ReleaseFast` 关掉检查，没有借用检查的限制 |
| 接手、混编、逐步替换 C 项目 | Zig | translate-c 加 `zig cc` 直接对接 C |
| 多版本结构体、编译期定制（协议、固件） | Zig | `comptime` 工厂按条件选类型，比宏加泛型好写 |

Rust 给你安全，代价是按它的规则写；Zig 给你工具，怎么用由你负责。要稳、要大、要安全选 Rust，要可控、要贴近硬件、要混 C 选 Zig。在异步、泛型和多版本结构体这几件事上，我更喜欢 Zig 的写法。

## 对比总表

| 维度 | Rust | Zig |
|:--:|:--:|:--:|
| 设计取向 | 安全优先，零成本抽象 | 简单、显式、无隐藏 |
| 内存 | 所有权加借用检查器 | 显式分配器加 `defer`、`errdefer` |
| 安全 | 编译期强制 | 运行期检查，`ReleaseFast` 关闭 |
| 错误 | `Result<T, E>`，可带数据 | `!T`，只有标签 |
| 元编程 | 宏、泛型、`const fn` 四套 | `comptime` 一套 |
| 多态 | trait 加生命周期 | `comptime` 工厂加 `anytype` |
| 异步 | `async`、`await`，有染色 | 无关键字，`std.Io` 参数传入 |
| 整数 | 固定位宽 | 任意位宽，如 `u3` |
| C 互操作 | `bindgen` 加 `unsafe` | translate-c 加 `zig cc` |
| 构建 | Cargo 加 crates.io | `build.zig` 加 `build.zig.zon`，内建交叉编译 |
| 工具链 | rustup 全家，成熟 | 一个 `zig`，快 |
| 编译速度 | 慢 | 快 |
| 稳定性 | 1.0 稳定 | 0.x，常有不兼容更新 |
| 可用的库 | 多 | 少，在增长 |
| 擅长 | Web、分布式、安全关键 | 内核、驱动、游戏、嵌入式、混 C |

## 思考题

**Q1. Zig 删掉 `async` 关键字「解决」了函数染色，为什么说只是推迟到了调用方？`Io` 参数与 `async` 关键字在传染性上是不是一回事？**

{% note default %}
一半是，一半不是。`async` 关键字是类型传染：蓝函数的类型与红函数不兼容，编译期固定，绕不开。`Io` 参数是参数传染：需要异步能力的函数要收 `io`，调用链一路往下传。相同点是都要改一整条调用链。不同点是 `io` 是普通参数，函数类型不变：不需要异步的中间函数可以不收 `io`，可以默认用线程池实现，可以在运行时换实现；颜色从「编译期写在类型上」变成「运行时由传入的 `io` 决定」。所以传染性减弱了（可选、可换、不改类型），但没有消失（`io` 仍要传），染色的决定从函数定义处挪到了传入 `io` 的地方。
{% endnote %}

**Q2. 为什么 `E!i32` 的体积是 8（标签加 `T`），而 Rust 的 `Result<i32, E>` 可能更大？根本原因是什么？**

{% note default %}
Zig 的错误是全局的扁平整数（`anyerror` 是 `u16`，2 字节），不带数据，所以 `E!i32` 是 `i32` 的 4 字节加标签 2 字节再对齐，共 8 字节。Rust 的 `Result<T, E>` 是枚举，`Err` 携带任意的 `E`，布局约为 `max(sizeof T, sizeof E)` 加判别值（可能被 niche 优化省掉），`E` 大则 `Result` 大。根本原因：Zig 把「错误带上下文」移出了错误联合（要上下文就自己设计结构体），换来零开销；Rust 让错误本身就是完整的数据，换来表达力。
{% endnote %}

**Q3. `comptime` 凭什么用一个机制代替 Rust 的宏、泛型与 `const fn`？它和 Rust 过程宏的本质区别在哪？**

{% note default %}
Zig 没有单独的「宏」阶段：编译器在语义分析时遇到 `comptime`，就直接执行这段普通的 Zig 代码，结果（值或类型）用在原处。于是「编译期算值」「按类型生成代码」「类型反射」都是同一件事：在编译期执行 Zig。过程宏是隔离的，操作的是 `TokenStream`，只能在语法层面拼 token，看不到类型信息，要自己解析，还要单独编译成一个 crate；`comptime` 在类型系统之内，能用 `@typeInfo` 看到完整的类型信息，与普通代码同一门语言、同一套语法。
{% endnote %}

**Q4.（开放）Rust 用户转 Zig，最该警惕的习惯是什么？**

{% note default %}
其一，没有借用检查器把关，编译通过不等于安全，释放后使用与泄漏要靠 `defer`、`errdefer` 和 `DebugAllocator` 在运行期发现，`ReleaseFast` 还会关掉检查。其二，0.x 版本之间常有不兼容的修改，今天的代码下个版本可能编不过。其三，错误不能带数据，不能像 Rust 那样把上下文放进 `E`。其四，没有 trait 和 RAII 自动析构，接口靠编译期检查，释放靠手写 `defer`。
{% endnote %}

两门语言都想做更好的 C：Rust 用编译期强制换安全（借用检查器加 1.0 的兼容承诺），Zig 用显式和简单换可控（`comptime` 统一元编程、translate-c 对接 C、`defer` 显式清理、`ReleaseFast` 关掉检查）。对 RISC-V 全栈这种既要贴近硬件、又要混 C、还要编译期定制的场景，Zig 很合适；对要长期维护、要安全保证、要成熟生态的场景，Rust 更稳。Zig 眼下最大的代价是不稳定，到 1.0 之后值得再比一次。
