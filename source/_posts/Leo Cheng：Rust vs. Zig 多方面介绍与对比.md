---
title: 'Leo Cheng: Rust & Zig 多方面介绍与对比'
date: 2026-05-01 21:43:45
categories: [Leo Cheng, Rust, Zig, Programming Languages, Beginner]
tags:
    - author:heke1228
    - repo:https://cnb.cool/heke_learning/Rustlings
---


<!-- more -->

> **Zig / Rust 对于 C/C++**：两门都自称 "更好的 C/C++"（C/C++ plus），都不要 GC、都讲究"安全 × 可控"，但走了两条岔路：**Rust 用编译期的"强制"换安全；Zig 用"显式 + 简单"换可控**。本文全维度横扫，每条都给 Rust 写法 + Zig 写法 + 取舍（基于 **Zig `0.17.0-dev`、Rust `1.94`**）。C 只在该出现时点一句。
>
> 我（Leo）当初被 Zig 吸引，是因为它**对"函数染色（function coloring）"问题的态度**——这条单开一节（§9）讲。

---

## 1. 设计哲学：两种"更好的 C"

Rust 和 Zig 都想取代 C/C++，但信条不同：

| \ | Rust | Zig |
|:--:|:--:|:--:|
| 一句话 | **安全优先**，零成本抽象 | **简单 × 显式**，无隐藏 |
| 安全模型 | 编译期**强制**（借用检查器当警察）| 运行期**可选**检查 + 程序员自律 |
| 抽象 | trait / 泛型 / 生命周期，层层零成本 | 几乎不抽象，"所见即所得" |
| 心智 | "按我的规则写，我保证你安全" | "给你工具，炸了算你的" |
| 成熟度 | 1.0 稳定（2015），承诺不破坏 | 0.x，**频繁破坏式更新**（见 §16）|

Zig 的设计写死了**五条"无隐藏"原则**（这是理解 Zig 一切语法的钥匙）：

| Zig 五原则 | 含义 |
|:--:|:--:|
| **无隐藏控制流** | 没有运算符重载、没有析构函数、没有异常——`a + b` 就是加法，不会偷偷调函数 |
| **无隐藏内存分配** | 标准库**绝不偷偷分配堆**；要分配？把 `allocator` 显式传进来 |
| **无隐藏的"编译期 vs 运行期"** | `comptime` 是第一公民，编译期和运行期**用同一套语法** |
| **错误是值** | `error.Foo` 是枚举值，`!T` 是"错误联合"类型，不是异常 |
| **C 互操作一等公民** | `@cImport` 直接吃 C 头，零成本 ABI 兼容 |

> 对 Rust 老用户：Zig 几乎是"把 Rust 的安全保证拿掉、把元编程统一成一个 `comptime`、把 FFI 做到极致"的另一种取舍。下面逐条看。

---

## 2. 第一印象：Hello 与语法风格

```zig
// Zig
const std = @import("std");
pub fn main() !void {                       // !void = 可能返回错误
    std.debug.print("Hello, {s}!\n", .{"Zig"});  // .{...} 是匿名元组（参数列表）
}
```
```rust
// Rust
fn main() {
    println!("Hello, {}!", "Rust");          // println! 是宏
}
```

几个一眼可见的差异：`@import`/`@xxx` 是 Zig 的**内置函数**（编译器保留，用户不能新增）；`.{...}` 既是匿名结构体也是元组；Rust 的 `println!` 是**宏**，Zig 没有宏（用 comptime + 格式串）。

---

## 3. 类型系统

### 3.1 基础类型——Zig 的"任意位宽整数"

```zig
const a: u8 = 0xFF;
const b: u7 = 127;          // 任意位宽:u1..u65535 都行
const c: u3 = 0b101;        // 寄存器位段神器
const w = a +% 1;           // +% 回绕  +| 饱和(溢出运算符)
```
Rust 只有固定 `u8/u16/u32/u64/u128`；要 3 位字段得手动位运算或用 `bitflags` crate。Zig 的 `u3`/`packed struct(u8)` 让寄存器/协议位段**类型安全且零开销**。

### 3.2 Optional 与 错误联合——两个"一等公民"

| | Rust | Zig |
|:--:|:--:|:--:|
| 可空 | `Option<T>` = `Some/None` 枚举 | `?T`（`?*T` 用空指针表示，零开销）|
| 解包 | `match` / `if let` / `?` / `unwrap()` | `if (x) \|v\|` / `orelse 默认` / `.?` |
| 错误 | `Result<T,E>` 枚举 | `E!T` 错误联合（见 §5）|

```zig
var opt: ?u32 = null;
const v = opt orelse 0;        // 默认值
const f = opt.?;               // 断言非 null（null 则 panic）
if (opt) |val| { _ = val; }    // 解包
```
```rust
let opt: Option<u32> = None;
let v = opt.unwrap_or(0);
let f = opt.unwrap();          // None 则 panic
if let Some(val) = opt { let _ = val; }
```

### 3.3 struct / enum / union——Zig 的 tagged union 是内建语法

```zig
const Value = union(enum) {    // tagged union:tag 自动生成
    int: i64,
    text: []const u8,
    empty,
};
switch (v) {                    // switch 必须穷尽
    .int  => |n| use(n),
    .text => |s| use(s),
    .empty => {},
}
```

对位 Rust 的 `enum Value { Int(i64), Text(String), Empty }` + `match`——**几乎一一对应**，这是两门语言最像的地方（代数数据类型 + 穷尽匹配）。差别：Zig 的 `union(enum)` 还能写裸 `union`（C 风格、无 tag、`@bitCast` 重解释），Rust 没有安全的裸 union（要 `unsafe`）。

### 3.4 切片 / 指针 / 字符串——比 Rust 多了"指针种类"

| 类型 | Zig | Rust 对位 |
|:--:|:--:|:--:|
| 切片 | `[]T` / `[]const u8` | `&mut [T]` / `&[T]` / `&str` |
| 单值指针 | `*T` / `*const T` | `&mut T` / `&T` / `*mut T` |
| 多值指针 | `[*]T`（无长度）| `*mut T`（裸）|
| C 指针 | `[*c]T`（可空、可 0）| `*mut T` + FFI |
| 哨兵终止 | `[*:0]const u8`（C 字符串）| `CStr` |

Zig **没有 `String` 类型**，字符串就是 `[]const u8`（UTF-8 字节切片）+ 字符串字面量 `[N:0]u8`。Rust 区分 `String`（拥有）/ `&str`（借用）。Zig 的指针种类更细（`*`/`[*]`/`[*c]`/`[:0]`），因为它要直接对接 C 和硬件——**没有借用检查器，靠类型把"这个指针能不能空、知不知道长度"标清楚**。

---

## 4. 内存管理：Zig 最分裂于 Rust 的地方

### 4.1 所有权 vs 显式 allocator

**Rust**：所有权 + 借用检查器，编译期决定每块内存何时释放，`drop` 自动调用。你几乎不"看见"分配器（全局 `alloc`）。

**Zig**：**没有所有权、没有借用检查器、没有自动析构**。谁要堆内存，就把 `allocator` **当参数显式传进去**：

```zig
fn process(a: std.mem.Allocator, data: []const u8) ![]u8 {
    const out = try a.alloc(u8, data.len * 2);   // 显式分配
    // ... 调用者负责 a.free(out)
    return out;
}
```

这强迫你在**架构设计时**就想清"谁负责分配/释放"，而不是像 C 那样到处隐式 `malloc`。标准库容器也一样——`ArrayList` 的每个 `append` 都要传 allocator（0.17）：

```zig
var dbg = std.heap.DebugAllocator(.{}){};        // 0.17:GPA 改名 DebugAllocator
defer _ = dbg.deinit();                           // 报告内存泄漏!
const a = dbg.allocator();
var list: std.ArrayList(u8) = .empty;             // 0.17:ArrayList 默认 unmanaged
defer list.deinit(a);
try list.append(a, 7);                            // 每次显式传 a
try list.appendSlice(a, &.{ 8, 9 });              // → { 7, 8, 9 }
```

> Zig 的显式 allocator = "no hidden allocations" 哲学的落地。**好处**：测试时换个 `FixedBufferAllocator` 就能裸机跑、`ArenaAllocator` 一次性释放、`DebugAllocator` 自动查泄漏——分配策略是**参数**而非全局。**代价**：啰嗦，且没有借用检查器兜底，use-after-free 要靠下面的机制防。

### 4.2 `defer` / `errdefer`——Zig 最香的语法糖

```zig
fn init(a: std.mem.Allocator) !*Res {
    const r = try a.create(Res);
    errdefer a.destroy(r);     // 仅当本函数"以错误返回"时执行
    try r.setup();             // 若这里出错 → errdefer 清理 r → 不泄漏
    return r;                  // 成功返回 → errdefer 不执行
}
```

- **`defer`**：作用域退出时执行（LIFO）。资源获取后紧跟 `defer x.deinit()`，**释放逻辑紧挨分配逻辑**，很难忘。
- **`errdefer`**：只在**错误返回路径**执行——这是 Rust 的 `?` + `Drop` 才能做到的"出错自动清理"，Zig 用一个关键字显式表达，**而且看得见**。

> **`defer` 跟 Go 不一样**：Zig 的 `defer` 是**块级作用域**（离开 enclosing block 就跑），Go 是**函数级**（return 才跑）。在循环里区别巨大——Zig 循环体内的 `defer` **每次迭代结束**就执行，Go 是攒到函数末尾 LIFO 一起跑。
>
> 对位 Rust：Rust 用 RAII + `Drop` trait 自动析构（更隐式、零关键字）；Zig 用 `defer` 显式（更可见、可控）。一个"自动但隐藏"，一个"手动但透明"——正是两门语言的缩影。

---

## 5. 错误处理：`!T` vs `Result<T,E>`

```zig
const MyError = error{ TooHot, TooCold };   // 错误集 = 一组扁平标签
fn readTemp() MyError!i32 {                  // !T = 错误联合
    return error.TooHot;                     // 只能返回"信号",不带数据
}
const t = readTemp() catch |e| blk: {        // catch 捕获
    std.debug.print("err: {}\n", .{e});
    break :blk 0;
};
const t2 = try readTemp();                    // try = 出错就向上传播
```
```rust
enum ReadError { TooHot(i32), TooCold(i32) }  // E 可带任意 payload
fn read_temp() -> Result<i32, ReadError> { Err(ReadError::TooHot(42)) }
let t = read_temp()?;                          // ? 向上传播
```

**最大区别**：

| | Rust `Result<T,E>` | Zig `E!T` |
|:--:|:--:|:--:|
| 错误能否带数据 | **能**，`E` 是任意类型（带上下文）| **不能**，error 只是全局扁平标签 |
| 体积 | 取决于 `E`，可能很大（带 padding/布局开销）| **极小**：tag + T |
| 传播 | `?` | `try` |
| 出错清理 | `Drop`（隐式）| `errdefer`（显式）|

**体积**：`@sizeOf(anyerror)=2`（一个 u16 错误号）、`@sizeOf(MyError!i32)=8`（i32 的 4 + tag 2 + padding）。底层就是**整数比较 + 一个 `if (err) return err`**，无 `Box`、无 `match` 嵌套、无堆分配。

> Zig 的 error 更像**类型安全版 `errno`**——适合底层系统编程，错误只需"知道发生了什么"。需要带上下文？**自己设计一个 struct 当返回值**，别硬塞进 error union。这是"简单 × 零成本"对"表达力"的取舍。

---

## 6. `comptime`：Zig 的灵魂——一个机制替掉「宏 + 泛型 + const fn + 反射」

这是 Zig 最独特的地方。

**Rust 的元编程是四套互不打通的机制**：声明宏（token 流转换）、过程宏（编译期跑 Rust 但隔离）、泛型（单态化）、`const fn`（常量求值）。

**Zig 只有一个 `comptime`**：它不是"模板"也不是"宏"，而是 **在编译期直接执行普通 Zig 代码，执行结果作为 AST 插入当前位置**。编译器解析到 `comptime` 表达式，就用内置解释器跑它，结果替换原节点。所以同一套语法、同一门语言，既写运行期也写编译期。

```zig
// 编译期算查找表，运行期直接查（零运行时开销）
const upper = comptime blk: {
    var t: [256]u8 = undefined;
    for (&t, 0..) |*c, i| c.* = if (i >= 'a' and i <= 'z') @intCast(i - 32) else @intCast(i);
    break :blk t;
};
```

它**一个顶四个**：

| 你在 Rust 里用 | 在 Zig 里就是 |
|:--:|:--:|
| 泛型 `fn f<T>()` | `comptime T: type` 参数（见 §7）|
| 声明/过程宏 | comptime 函数返回类型/代码 |
| `const fn` | comptime 块/函数 |
| 反射（serde/proc-macro）| `@typeInfo(T)` 编译期类型反射 |

**编译期反射**（Rust 要靠过程宏 + serde 才能做的，Zig 内建）：

```zig
fn dumpFields(comptime T: type) void {
    inline for (@typeInfo(T).@"struct".fields) |f| {   // 0.17:字段全小写 .@"struct"
        std.debug.print("{s}: {s}\n", .{ f.name, @typeName(f.type) });
    }
}
```

**版本坑（0.17-dev）**：类型反射字段名 **全小写**（`.int` / `.@"struct"` / `.@"fn"`，不是旧的 `.Int`）；动态构造类型用 **`@Int(.unsigned, 32)`**——旧的 **`@Type(...)` 在 0.17 已删**（报 `invalid builtin function: '@Type'`）。这正是 Zig 破坏式更新的缩影（§16）。

> comptime 看起来比 Rust 啰嗦（要写工厂函数），但**极其透明**——你清清楚楚知道编译期发生了什么，没有宏的"token 黑魔法"。这是 "simple × explicit" 哲学最闪光的体现。

---

## 7. 泛型 / 多态：工厂函数 + 鸭子类型 vs trait + 生命周期

Zig 没有 `trait`、没有生命周期标注、没有泛型尖括号。它用 comptime 实现泛型，两条路：

**① 类型工厂**（显式造一个类型）：

```zig
fn Stack(comptime T: type) type {        // 传类型进去,返回一个新 struct 类型
    return struct {
        items: std.ArrayList(T) = .empty,
        pub fn push(s: *@This(), a: std.mem.Allocator, v: T) !void {
            try s.items.append(a, v);
        }
    };
}
const IntStack = Stack(i32);             // 显式实例化
```
```rust
struct Stack<T> { items: Vec<T> }        // Rust:隐式单态化,编译器推 T
impl<T> Stack<T> { fn push(&mut self, v: T) { self.items.push(v) } }
```

**② `anytype` 鸭子类型**（编译期推参数类型）：

```zig
fn add(a: anytype, b: anytype) @TypeOf(a) { return a + b; }  // 谁传进来算谁
```

两条路都**单态化**（每个具体类型生成一份代码，和 Rust 泛型一样零成本）。

**关键差异**：

| | Rust | Zig |
|:--:|:--:|:--:|
| 泛型 | `fn f<T: Trait>`，编译器**隐式**推导 + trait 约束 | `Foo(comptime T: type)` **显式**工厂 / `anytype` |
| 约束 | trait bound（编译期接口契约）| `@hasDecl`/`@compileError` 手动检查（鸭子）|
| 生命周期 | `<'a>` 标注，借用检查器验证 | **没有**——指针有效性靠程序员 |
| 报错 | 约束不满足 → 清晰的 trait 错误 | 鸭子类型 → 报错可能在模板深处 |

Rust 的 trait 是"先声明契约、再实现"；Zig 是"直接用，编译期发现缺方法才报错"。Rust 更**结构化/可读**，Zig 更**灵活/啰嗦**——又一次"强制 vs 自由"。

---

## 8. 安全：编译期警察 vs 运行期可关检查

**Rust**：借用检查器 + `Send`/`Sync` 在**编译期强制**内存安全和数据竞争自由——违规直接编译不过。`unsafe` 块才能逃逸。

**Zig**：**没有借用检查器**。内存安全靠**运行期检查**，且**按编译模式可关**（4 个 build mode）：

| 模式 | 命令 | 安全检查 | 速度/体积 |
|:--:|:--:|:--:|:--:|
| `Debug` | 默认 | 全开（越界/溢出/UAF/null）+ `undefined` 填 0xAA | 最慢 |
| `ReleaseSafe` | `-Doptimize=ReleaseSafe` | **仍开**安全检查 | 优化但带检查 |
| `ReleaseFast` | `-Doptimize=ReleaseFast` | **全关** | 最快（裸奔，和 C 一样）|
| `ReleaseSmall` | `-Doptimize=ReleaseSmall` | 全关 | 最小（裸机首选）|

外加 `DebugAllocator`（旧名 GPA）在 Debug 下自动抓**内存泄漏 / double-free / use-after-free**。

> **Rust 的 borrow checker 是"警察"，编译期强行拦下所有违规；Zig 是"交通规则写在纸上，但车可以随时飙到 300 码"**（`ReleaseFast` 关掉检查）。Zig 承认"我管不了编译期那么多，让你在 Debug 抓到它，生产要性能就关检查"。对系统编程，有时**"我知道我在干什么，别拦我" 比 "绝对安全" 更重要**——这就是两门语言最根本的价值观分歧。

---

## 9. 并发 / 异步 / 函数染色（我的初心）

> 这是当初把我（Leo）领进 Zig 的那扇门。

### 9.1 什么是函数染色（Function Coloring）

Bob Nystrom 2015《What Color is Your Function?》：一门语言引入 `async`/`await` 后，函数被隐式分成两色——**普通函数（红）** 和 **async 函数（蓝）**。蓝函数只能被蓝函数调用，**传染整条调用链**：底层一个 `async`，上面全得 `async`。

| 语言 | 方案 | 染色？ |
|:--:|:--:|:--:|
| Python / JS / **Rust** | `async`/`await` 关键字 | **有**，传染 |
| Go / Java 虚拟线程 | goroutine / 阻塞自动挂起 | **无** |
| **老 Zig（≤0.14）** | `async fn` 关键字 | **有**（同 Rust）|
| **新 Zig（0.15+）** | 砍掉关键字 + `Io` 参数注入 | **设计上无** |

### 9.2 Zig 的答案：釜底抽薪——把 `async` 关键字砍了

**0.17-dev**：
```zig
pub fn main() void { var fr = async foo(); }
// → error: expected ';' after statement   ← async 根本不是关键字了!
```

Zig 在 **0.15 移除了 `async`/`await`/`suspend`/`resume` 全部关键字**（旧实现编译器复杂度爆炸、无法真零成本、与 comptime 交互困难）。**没有颜色关键字 = 没有染色**。取而代之（0.16+ 设计中）：协程能力通过 **`Io` 接口当参数注入**，函数本身是中性的：

```zig
fn fetch(io: std.Io, url: []const u8) ![]u8 {   // 普通函数,只是多收个 io 参数
    return io.http.get(url);                      // io 决定同步还是异步,函数不知道
}
// 同一个 fetch:单线程 Io → 顺序; 线程池 Io → 并发; io_uring Io → 异步 I/O
```

### 9.3 犀利吐槽

> **本质还是没摆脱染色问题，只是把染色问题"推迟到调用方"**——决定用哪种 `Io` 后端的那一刻，颜色就定了。

旧设计把"是否异步"编码在**函数类型**里（染色传染）；新设计把"如何调度"编码在**参数**里（注入）。函数中性了，但**调用链仍要一路把 `io` 传下去**——这何尝不是另一种形式的"传染"？只是从"类型传染"变成"参数传染"，从编译期强制变成约定。Zig 没有"消灭"染色，而是**换了个更可控、更显式的形态**。

> 截至 `0.17.0-dev`，语言里**没有** `async`/`await`；新的 `Io` 协程模型仍在落地，API 会变。想在 Zig 里写并发，当下用：**手工状态机**（裸机/no_std 永远有效）、**`std.Thread`**（有 OS）、或社区库 **libxev**（事件循环）/ **zigcoro**（有栈协程，汇编 context_switch，支持 RISC-V）。

### 9.4 原子操作（两门都直面内存序）

```zig
var ctr = std.atomic.Value(u64).init(0);
_ = ctr.fetchAdd(1, .monotonic);              // .monotonic/.acquire/.release/.acq_rel/.seq_cst
const ok = ctr.cmpxchgWeak(0, 1, .acq_rel, .monotonic) == null;  // CAS
```
```rust
use std::sync::atomic::{AtomicU64, Ordering};
let ctr = AtomicU64::new(0);
ctr.fetch_add(1, Ordering::Relaxed);          // Relaxed/Acquire/Release/AcqRel/SeqCst
```
内存序模型几乎一致（都是 C++11 那套）：Zig `.monotonic` = Rust `Relaxed`，其余同名。这层两门语言高度趋同。

---

## 10. 标准库：显式、不偷偷分配

Zig `std` 的设计跟它的哲学一脉相承：**不默认分配堆**、**错误是返回值**、**无全局状态**。

| 能力 | Rust | Zig（0.17）|
|:--:|:--:|:--:|
| 动态数组 | `Vec<T>`（自带全局分配）| `std.ArrayList(T) = .empty` + `append(a, x)` |
| 哈希表 | `HashMap<K,V>` | `std.AutoHashMap` / `std.StringHashMap`（`.init(a)`）|
| 通用分配器 | 全局 `alloc`（隐式）| `DebugAllocator`（查泄漏）/ `Arena` / `FixedBuffer` / `smp_allocator` |
| 格式化 | `format!` / `println!`（宏）| `std.fmt` + `std.debug.print`（comptime 格式串）|
| 排序 | `slice.sort()` | `std.mem.sort(T, s, ctx, less)` |

**I/O 正在大改（Writergate）**：旧的 `std.io.getStdOut().writer()` 在 0.15+ 被重构为新的 `Writer` 接口模型，0.17-dev 仍在流变（连"标准输出怎么写"在 0.17-dev 都还会报错）。例子里安全的输出用 `std.debug.print`（稳定）。这又是 Zig 不稳定的一个活样本。

对位 Rust：`Vec`/`HashMap`/`String` 自带全局分配器、用起来"无脑"；Zig 把分配器摊开给你，**省心 vs 可控**的又一次取舍。

### 10.1 常用标准库对照（速查）

| 用途 | Rust `std` | Zig `std`（0.17）|
|:--:|:--:|:--:|
| 动态数组 | `Vec<T>`：`push`/`pop`/`len` | `std.ArrayList(T)`（`.empty`）：`append(a, x)`/`pop`/`items.len` |
| 哈希表 | `HashMap<K,V>` / `BTreeMap` | `std.AutoHashMap(K,V)` / `std.StringHashMap(V)`（`.init(a)`）|
| 集合 | `HashSet` / `BTreeSet` | 无独立 Set，用 `AutoHashMap(K, void)` 顶 |
| 字符串 | `String`（拥有）/ `&str`（借用），**保证 UTF-8** | `[]const u8`（裸字节切片，**编码自负**）；拼接用 `ArrayList(u8)` 或 `std.fmt.allocPrint` |
| 可空 | `Option<T>`：`unwrap_or`/`map`/`?` | `?T`：`orelse`/`.?`/`if (x) \|v\|` |
| 错误 | `Result<T,E>`：`?` | `E!T`：`try`/`catch` |
| 格式化成串 | `format!("{}", x)` | `std.fmt.allocPrint(a, "{}", .{x})`（要 allocator）|
| 打印 | `println!` / `print!` | `std.debug.print("{}\n", .{x})` |
| 排序 / 二分 | `slice.sort()` / `binary_search` | `std.mem.sort(T, s, ctx, less)` / `std.sort.binarySearch` |
| 遍历 | `Iterator` trait + `map`/`filter`/`collect` 适配器链 | **无 Iterator trait**：手写 `for`/`while`，或容器自带 `iterator()` |
| 随机 | `rand`（crate）| `std.Random`（std 内建）|
| JSON | `serde_json`（crate）| `std.json`（std 内建）|
| 文件 / IO | `std::fs` / `std::io` | `std.fs` / `std.Io`（0.17-dev 正重构：`std.fs` 部分搬进 `std.Io`、`Writer` 接口重做）|
| 时间 | `std::time::{Instant, Duration}` | `std.time`（0.17-dev 在变）|
| 命令行 / env | `std::env::{args, var}` | `std.process`（args/env API 0.17-dev 在变）|

两条总纲：① **"要分配就传 allocator"贯穿整个 Zig std**（`ArrayList.append(a, x)`、`allocPrint(a, …)`、`HashMap.init(a)`），Rust 用全局分配器把这层藏起来。② **Zig 没有 `Iterator` trait**——没有 `map`/`filter`/`collect` 惰性链，遍历靠 `for`/`while` 或容器自带的 `iterator()`。

表里最后三行（fs/io、time、process）在 `0.17-dev` 正经历重构（`std.fs` 往 `std.Io` 搬、`Writer` 接口重做、args/env 改形）——今天的精确函数名下个版本未必还在。稳的是"显式分配 + 错误是值"这套哲学，变的是具体签名。

---

## 11. C / C++ 互操作：Zig 甩 Rust 一个街区

**Rust 调 C**：写 `bindgen` 构建脚本 → 生成一堆 `extern "C"` + `unsafe fn` → 处理 `#[link]`/库路径 → C 宏调不了只能硬编码常量 → `size_t`↔`usize` 来回转、指针满天飞用 `std::ptr`。**两套类型世界观**（`int*` vs `*mut i32`）来回搬。

**Zig 调 C**：
```zig
const c = @cImport({
    @cInclude("stdio.h");
    @cInclude("SDL2/SDL.h");
});
c.printf("Hello from Zig!\n");          // 直接用,无 unsafe 块
c.SDL_Init(c.SDL_INIT_VIDEO);
```

这背后是质变：

| | Rust | Zig |
|:--:|:--:|:--:|
| 绑定生成 | `bindgen`（独立工具 + build.rs）| **`@cImport` 内建 Clang，编译期解析头文件** |
| C 宏 | 调不了 | `@cImport` 部分翻译宏；`@cDefine` 还能反向传宏 |
| `unsafe` | FFI 全要 `unsafe` 块 | **无 `unsafe` 关键字**，直接调 |
| 指针 | `*mut i32` ↔ `int*` 两套 | `@cImport` 直接生成 `[*c]i32`，无缝 |
| 交叉编译 C | 要装目标工具链 | **`zig cc -target riscv64-linux` 自带 libc/sysroot，零工具链** |

> 写 Zig 有 C 的自由感，但又多受一部分约束（传入分配器参数）、多了 `defer` 和编译期计算、少了宏的繁杂。**它不是 Rust 的替代品，是 C 的进化版。** 渐进式替换很爽：先把 Zig 当"增强版 C 预处理器 + 构建系统"用（`zig cc` 是个能跨平台的 drop-in C 编译器），再慢慢用 Zig 重写模块。唯一代价：`@cImport` 编译期要起 Clang 解析头文件，略慢——但比 Rust 的 `bindgen` + 两步编译，体验好太多。

---

## 12. 构建系统 / 包管理：`zig build` vs Cargo

| | Rust（Cargo）| Zig |
|:--:|:--:|:--:|
| 构建脚本 | `Cargo.toml`（声明式 TOML）+ `build.rs` | **`build.zig`（用 Zig 写的命令式构建图）** |
| 包清单 | `Cargo.toml` | `build.zig.zon`（ZON = Zig 对象记法）|
| 注册中心 | crates.io（中心化）| **无官方中心**，靠 URL + hash 或本地路径 |
| 加依赖 | `cargo add foo` | `zig fetch --save <url>` |
| 跨平台构建 | 需对应 target 工具链 | `-Dtarget=riscv64-freestanding-none` **内建跨编译** |

> Zig 没有 crates.io 那样的中央仓库，"收录"全靠社区索引站：在 GitHub 及其他各大代码平台上，公开仓库**打上 `zig-package` 的 topic 标签**就能被自动识别、聚合进"Zig 包"列表——门槛极低，质量也因此良莠不齐。

```zig
// build.zig:构建脚本就是普通 Zig 代码,你能用 if/for/comptime 编排
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const exe = b.addExecutable(.{ .name = "app", .root_source_file = b.path("src/main.zig"), .target = target });
    b.installArtifact(exe);
}
```

> 取舍：Cargo 生态成熟（crates.io 几十万包、版本解析强）、声明式好读；`zig build` 是**图灵完备的命令式构建**（能跨编译、能编 C、能跑任意步骤），但**没有中心化注册表**、生态小。Rust **生态赢**，Zig **构建灵活性 + 跨编译赢**。

---

## 13. 裸机 / 嵌入式 / RISC-V：两门都能 no-runtime

这是 RISC-V 全栈最关心的一层。Rust `#![no_std]`，Zig `freestanding` target——都能脱离 OS/libc 跑在裸机。

| 能力 | Rust（no_std）| Zig（freestanding）|
|:--:|:--:|:--:|
| 脱 OS | `#![no_std]` + `#![no_main]` | `-target riscv64-freestanding-none` |
| 入口 | `#[no_mangle] extern "C" fn _start` | `export fn _start() callconv(.naked)` |
| 裸函数 | `#[naked]`（需 nightly/外部 crate）| `callconv(.naked)`（内建）|
| 内联汇编 | `core::arch::asm!` | `asm volatile (...)` |
| MMIO | `read_volatile`/`write_volatile` | `*volatile T` + `@ptrFromInt` |
| panic | `#[panic_handler]` | `pub fn panic(...)` |
| 链接脚本 | `build.rs` + `.cargo/config` | `exe.setLinkerScriptPath(...)`（build.zig 内建）|

```zig
// Zig 裸机 RISC-V 入口 + CSR + MMIO,全内建,无外部 crate
export fn _start() callconv(.naked) noreturn {
    asm volatile (
        \\csrr t0, mhartid
        \\bnez t0, .Lwait
        \\la sp, _stack_top
        \\call zigStart
        \\.Lwait: wfi
        \\ j .Lwait
        ::: "t0", "sp", "ra"
    );
}
const uart: *volatile u8 = @ptrFromInt(0x10000000);   // MMIO 寄存器
fn putc(c: u8) void { uart.* = c; }
```

> Rust 裸机生态强（`embedded-hal`/`cortex-m`/`svd2rust` 一整套 trait + PAC 自动生成），但 `#[naked]` 等一些底层能力长期要 nightly/外部 crate；Zig 把 **naked 函数、内联汇编、链接脚本、任意位宽整数 `u3`、`packed struct(u8)` 寄存器位段、`comptime` 编译期算页表常量**全做进语言核心，写裸机 SBI/bootloader **更顺手、更少魔法**。两门都远胜 C 的“全靠宏 + 链接器脚本手搓”。

---

## 14. 工具链 / 编译模型

| | Rust | Zig |
|:--:|:--:|:--:|
| 一站式 | rustup + cargo + clippy + rustfmt | **一个 `zig` 二进制**：`build`/`test`/`fmt`/`cc` 全包 |
| LSP | rust-analyzer（强）| zls（够用，社区）|
| 编译后端 | **LLVM**（唯一）| LLVM + **自研后端**（debug 构建已可绕开 LLVM，更快）|
| 编译速度 | 慢（借用检查 + 单态化 + LLVM）| 快得多（尤其 debug 自研后端）|
| 格式化 | `cargo fmt` | `zig fmt`（内建，无配置项——强制统一风格）|

Zig "一个二进制搞定一切" + 自研后端追求**快编译**，是对 Rust"编译慢"的直接回应。Rust 工具链更成熟（clippy 静态检查、rust-analyzer 体验顶级）。

---

## 15. 稳定性 / 成熟度

| | Rust | Zig |
|:--:|:--:|:--:|
| 版本 | **1.0（2015）** | **0.16 stable（2026-04），未到 1.0** |
| 兼容承诺 | 有（edition 机制，老代码永远能编）| **无**——官方下载页都没有破坏式更新政策 |
| 更新风格 | 加功能不破坏 | **频繁破坏式重构** |

**例如**：照 **0.16** 官方文档写的 Zig 笔记，到 **0.17.0-dev** **已经多处编不过**：

| 之前的笔记内的写法（v0.16）| 0.17-dev 表现 |
|:--:|:--:|
| `@Type(.{.int=...})` 构造类型 | **删了** → 必须 `@Int(.unsigned, N)` |
| `std.heap.GeneralPurposeAllocator` | **删了** → `DebugAllocator` |
| `ArrayList(T).init(a)` / `ArrayListUnmanaged` | 合并 → `ArrayList` 默认 unmanaged，`.empty` |
| `async fn` / `await` | **关键字早已移除** |
| `@typeInfo` 字段 `.Int`（部分旧章节）| 全小写 `.int` |

> 这就是 Zig 当下最大的"坑"：**官方文档教你的写法，下个 dev 版本可能就变了**。Rust 老用户对此要有心理准备——你买的是"自由 + 简单 + 快"，付的是"稳定性"。等 Zig 1.0，这条会大幅改善。

---

## 16. 适用场景 + 总评

| 你要做的 | 更推荐 | 为什么 |
|:--:|:--:|:--:|
| Web 服务 / 分布式 / 后端 | **Rust** | 生态成熟（tokio/axum）、并发安全编译期保证、大团队协作稳 |
| 安全关键 / 大型长期项目 | **Rust** | 借用检查器 + 1.0 稳定承诺，重构有底气 |
| 内核 / 驱动 / Bootloader / SBI | **Zig** | naked/内联汇编/位段/comptime 全内建，少魔法、编译快 |
| 游戏引擎 / 高性能 / 手动内存 | **Zig** | 显式 allocator、`ReleaseFast` 裸奔、无借用检查掣肘 |
| 接手/混编/渐进替换 C 项目 | **Zig** | `@cImport` + `zig cc` 无缝吃 C，甩 Rust 一条街 |
| 多版本结构体/编译期定制（如协议/固件）| **Zig** | comptime 工厂选类型，比 Rust 宏+泛型体验好 |

> **一句话总评**：
> **Rust 是"给你安全，代价是必须按我的规则写"；Zig 是"给你工具，你爱怎么造怎么造，炸了算你的"。**
> 写 Zig 有 C 的自由感，但又多受一部分约束（传入分配器参数）、多了 `defer` 和编译期计算、少了宏的繁杂——**它不是 Rust 的替代品，是 C 的进化版**。要稳、要大、要安全 → Rust；要爽、要底层、要可控、要混 C → Zig。而在**异步（colorless 哲学）、泛型、多版本结构体构建**上，Zig 的自由度和体验，我个人觉得比 Rust 更顺手。

---

## 17. 全维度速查总表

| 维度 | Rust | Zig |
|:--:|:--:|:--:|
| 哲学 | 安全优先·零成本抽象 | 简单·显式·无隐藏 |
| 内存 | 所有权 + 借用检查器 | 显式 allocator + `defer`/`errdefer` |
| 安全 | 编译期强制 | 运行期可选检查（`ReleaseFast` 裸奔）|
| 错误 | `Result<T,E>` 带 payload | `!T` 仅标签，零成本 |
| 元编程 | 宏 + 泛型 + const fn（四套）| **`comptime` 一套通吃** |
| 多态 | trait + 生命周期 | comptime 工厂 + `anytype` 鸭子 |
| 异步 | `async/await` + 染色 | 砍 async 关键字 + `Io` 参数（colorless-ish）|
| 整数 | 固定位宽 | **任意位宽 `u3`** |
| C 互操作 | bindgen + `unsafe` | **`@cImport` + `zig cc` 无缝** |
| 构建 | Cargo + crates.io | `build.zig` + `zon`，内建跨编译 |
| 工具链 | rustup 全家桶（成熟）| 一个 `zig`（快）|
| 编译速度 | 慢 | 快 |
| 稳定性 | **1.0 稳定** | **0.x 破坏式更新** |
| 生态 | 大 | 小但增长 |
| 强项 | Web/分布式/安全关键 | 内核/驱动/游戏/嵌入/混 C |

---

## 18. 思考题（附参考答案）

**Q1. Zig 砍掉 `async` 关键字"解决"了函数染色——但为什么说"只是推迟到调用方"？`Io` 参数模型和 `async` 关键字模型在"传染性"上到底是不是一回事？**
> **半是半不是。** `async` 关键字 = **类型传染**：蓝函数类型与红不兼容，编译期钉死，无法绕过。`Io` 参数 = **参数传染**：要异步能力的函数得收 `io` 参数，调用链一路往下传。相同点：都得改一整条链。不同点：`io` 是**普通参数、函数类型不变**——不需要异步的中间函数可以不收 `io`、可默认单线程后端、可运行时换后端；颜色从"编译期钉在类型上"变成"运行时由传入的 `io` 决定"。所以传染性**弱化了（可选/可换/不改类型）但没消失（`io` 仍要传）**。Leo 的"推迟到调用方"精准：染色决策从**函数定义处**挪到了**注入处**。

**Q2. 为什么 `E!i32` 体积是 8（tag+T），而 Rust 的 `Result<i32, E>` 可能更大？根因？**
> Zig 的 error 是**全局扁平整数标识符**（`anyerror`=u16=2 字节），不带数据，故 `E!i32` = 4(i32) + 2(tag) + 对齐 = 8。Rust `Result<T,E>` 是 enum，`Err` 携带任意 `E`，布局 ≈ `max(sizeof T, sizeof E)` + 判别（可能被 niche 优化省掉），`E` 大则 `Result` 大。根因：Zig 把"错误带上下文"**踢出** error union（要上下文自己设计 struct）换零成本；Rust 让错误本身就是完整数据换表达力。

**Q3. `comptime` 凭什么"一个机制"替掉 Rust 的宏+泛型+const fn？它和 Rust 过程宏的本质区别？**
> 因为 Zig **没有"宏"这个独立阶段**——编译器解析 AST 时遇到 `comptime` 就用内置解释器直接跑那段普通 Zig 代码，结果（值或类型）替换原节点。于是"编译期算值（const fn）""按类型生成代码（泛型/宏）""反射类型"全是同一件事：**编译期执行 Zig**。和 Rust 过程宏的本质区别：过程宏是**隔离的、操作 `TokenStream`**（语法层面拼 token，看不到类型语义、要自己 parse）、且是独立 crate 编译；`comptime` 直接在类型系统内、能 `@typeInfo` 看到完整类型语义、和普通代码同语言同语法、零隔离。

**Q4.（开放）Rust 老用户转 Zig，最该警惕的"舒适区陷阱"是什么？**
> ① **没有 borrow checker 兜底**——"编译过了"不等于安全，UAF/泄漏要靠 `defer`/`errdefer` 自律 + `DebugAllocator` 运行时抓，`ReleaseFast` 还会关检查。② **0.x 破坏式更新**——今天的代码下个版本可能编不过（我半年前的笔记到这个版本已失效）。③ **error 无 payload**——别指望像 Rust 那样把上下文塞进 `E`。④ **没有 trait/RAII 自动析构**——接口靠鸭子检查、释放靠手动 `defer`。

---

> **小结**：Rust 和 Zig 都是"更好的 C"，但一个用**编译期强制**买安全（borrow checker + 1.0 稳定），一个用**显式 + 简单**买可控（`comptime` 统一元编程、`@cImport` 无缝吃 C、`defer` 显式清理、`ReleaseFast` 裸奔）。对 RISC-V 全栈这种"既要底层可控、又要混 C、还要编译期定制"的场景，Zig 的自由度很迷人；对要长期维护、要安全保证、要成熟生态的场景，Rust 更稳。**而 Zig 当下最大的代价是不稳定（0.x 破坏式更新）——等 1.0，天平会再调一次。**
