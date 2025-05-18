---
title: rust & rcore blog by xiaoxiao
date: 2025-04-16 15:26:23
categories:
  - 2025 年春夏季操作系统训练营
tags:
  - author:xiaoxiao2022
  - repo:2025s-rcore-xiaoxiao2022
---

# Rust 学习笔记

## 目录

1. [基础语法](##基础语法)
2. [所有权系统](#所有权系统)
3. [结构体与枚举](##结构体与枚举)
4. [错误处理](##错误处理)
5. [并发编程](##并发编程)
6. [高级特性](##高级特性)
7. [实用工具](##实用工具)

------

## 基础语法

### 变量与可变性

```
let x = 5;          // 不可变绑定
let mut y = 10;     // 可变绑定
const PI: f64 = 3.14; // 常量
```

### 数据类型

- ‌**标量类型**‌：

  - 整数: `i32`, `u64`
  - 浮点: `f64`
  - 布尔: `bool`
  - 字符: `char` (4字节Unicode)

- ‌**复合类型**‌：

  ```
  // 元组
  let tup: (i32, f64, char) = (500, 6.4, 'A');
  
  // 数组
  let arr: [i32; 3] = [1, 2, 3];
  ```

### 控制流

```
// if表达式
let number = if condition { 5 } else { 6 };

// 循环
for i in 1..=5 {
    println!("{}", i);
}

// 模式匹配
match value {
    1 => println!("one"),
    _ => println!("other"),
}
```

------

## 所有权系统

### 三大规则

1. 每个值有且只有一个所有者
2. 值在作用域结束时自动释放
3. 所有权可通过移动(move)转移

### 示例

```
let s1 = String::from("hello");
let s2 = s1;  // s1的所有权转移到s2
// println!("{}", s1); // 错误！s1已失效
```

### 借用规则

- 同一时间，要么：
  - 只能有一个可变引用(`&mut T`)
  - 或多个不可变引用(`&T`)
- 引用必须总是有效的

```
fn calculate_length(s: &String) -> usize {
    s.len()
}
```

------

## 结构体与枚举

### 结构体

```
struct User {
    username: String,
    email: String,
    sign_in_count: u64,
}

impl User {
    // 关联函数
    fn new(name: String, email: String) -> Self {
        User {
            username: name,
            email,
            sign_in_count: 1,
        }
    }
    
    // 方法
    fn greet(&self) {
        println!("Hello, {}!", self.username);
    }
}
```

### 枚举与模式匹配

```
enum IpAddr {
    V4(u8, u8, u8, u8),
    V6(String),
}

let home = IpAddr::V4(127, 0, 0, 1);

match home {
    IpAddr::V4(a, b, c, d) => println!("IPv4: {}.{}.{}.{}", a, b, c, d),
    IpAddr::V6(s) => println!("IPv6: {}", s),
}
```

------

## 错误处理

### Result类型

```
use std::fs::File;

let f = File::open("hello.txt");

let f = match f {
    Ok(file) => file,
    Err(error) => panic!("打开文件失败: {:?}", error),
};
```

### ?运算符

```
use std::io;
use std::io::Read;

fn read_username_from_file() -> Result<String, io::Error> {
    let mut s = String::new();
    File::open("hello.txt")?.read_to_string(&mut s)?;
    Ok(s)
}
```

------

## 并发编程

### 线程

```
use std::thread;

let handle = thread::spawn(|| {
    println!("来自线程的消息");
});

handle.join().unwrap();
```

### 通道

```
use std::sync::mpsc;

let (tx, rx) = mpsc::channel();

thread::spawn(move || {
    tx.send(42).unwrap();
});

let received = rx.recv().unwrap();
println!("收到: {}", received);
```

------

## 高级特性

### 生命周期

```
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

### Trait

```
trait Greet {
    fn greet(&self);
}

impl Greet for String {
    fn greet(&self) {
        println!("Hello, {}!", self);
    }
}
```

------

## 实用工具

### 常用Cargo命令

```
cargo new project_name  # 创建新项目
cargo build            # 编译项目
cargo run              # 编译并运行
cargo test             # 运行测试
cargo doc --open       # 生成文档并打开
```

### 推荐工具链

- rustup: Rust版本管理工具
- rust-analyzer: IDE插件
- clippy: 代码检查工具

------

## 学习资源

- [The Rust Book](https://doc.rust-lang.org/book/)
- [Rust by Example](https://doc.rust-lang.org/stable/rust-by-example/)
- [Rust标准库文档](https://doc.rust-lang.org/std/)
- [Crates.io](https://crates.io/) (第三方库仓库)



# rcore 学习笔记

## 目录

1. [批处理系统](##批处理系统)
2. [多道程序与分时多任务](##多道程序与分时多任务)
3. [地址空间](##地址空间)
4. [进程与进程管理](##进程与进程管理)
5. [文件系统与I/O重定向](##文件系统与I/O重定向)
6. [进程间通信](##进程间通信)
7. [并发](##并发)



## 批处理系统

#### 一、批处理系统概述

批处理系统(Batch System)是一种用于管理无需或仅需少量用户交互即可运行程序的操作系统模型‌。它能够自动安排程序的执行顺序，在资源允许的情况下高效运行多个程序‌。批处理系统的主要特点包括：

- 自动调度多个作业顺序执行
- 提高CPU和I/O设备利用率
- 减少人工干预
- 适用于计算密集型任务‌

#### 二、RISC-V特权级架构

批处理系统实现的基础是RISC-V的特权级机制‌：

1. ‌**用户模式(U-mode)**‌：应用程序运行的特权级
2. ‌**监督者模式(S-mode)**‌：操作系统内核运行的特权级
3. ‌**机器模式(M-mode)**‌：最底层硬件操作特权级

特权级机制的根本原因是确保操作系统的安全性，限制应用程序的两种行为：

- 不能访问任意的地址空间
- 不能执行某些可能危害系统的指令‌

#### 三、批处理系统实现要点

##### 3.1 应用程序设计

1. ‌**内存布局**‌：通过链接脚本调整应用程序的内存布局‌
2. ‌**系统调用**‌：应用程序通过ecall指令请求操作系统服务‌
3. ‌**二进制转换**‌：将应用程序从ELF格式转化为binary格式‌

##### 3.2 系统实现流程

1. ‌**初始化Trap机制**‌：
   - 设置stvec寄存器指向trap处理入口(__alltraps)‌
   - 定义TrapContext结构保存寄存器状态‌
2. ‌**任务调度**‌：
   - 依次加载并执行内存中的多个程序‌
   - 通过ecall指令实现特权级切换‌
3. ‌**上下文保存与恢复**‌：
   - 保存用户程序寄存器状态到TrapContext
   - 处理完成后恢复上下文继续执行‌

#### 四、关键代码分析

##### 4.1 Trap初始化代码

```
// os/src/main.rs
#[no_mangle]
pub fn rust_main() -> ! {
    clear_bss();
    println!("[kernel] Hello, world!");
    trap::init();
    ...
}

// os/trap/mod.rs
global_asm!(include_str!("trap.S"));

/// initialize CSR `stvec` as the entry of `__alltraps`
pub fn init() {
    extern "C" { fn __alltraps(); }
    unsafe {
        stvec::write(__alltraps as usize, TrapMode::Direct);
    }
}
```

##### 4.2 Trap上下文结构

```
// os/trap/context.rs
pub struct TrapContext {
    /// general regs[0..31]
    pub x: [usize; 32],
    /// CSR sstatus
    pub sstatus: Sstatus,
    /// CSR sepc
    pub sepc: usize,
}
```

#### 五、批处理系统工作流程

1. 系统启动时初始化Trap机制‌
2. 加载多个应用程序到内存‌
3. 依次执行每个应用程序：
   - 应用程序通过ecall触发系统调用‌
   - CPU切换到S模式，跳转到__alltraps‌
   - 保存应用程序上下文到TrapContext‌
   - 执行系统调用处理程序
   - 恢复上下文，返回用户程序继续执行‌
4. 当前程序执行完成后，加载并执行下一个程序‌

#### 六、与后续章节的关联

批处理系统是多道程序与分时多任务系统的基础‌。后续章节将在批处理系统基础上实现：

- 提前加载应用程序到内存减少切换开销‌
- 协作机制支持程序主动放弃处理器‌
- 抢占机制支持程序被动放弃处理器‌



## 多道程序与分时多任务

#### 一、基本概念与设计目标

多道程序设计是指允许多个程序同时进入计算机主存储器并启动计算的方法‌。分时系统是多道程序设计的延伸，通过高频率的任务切换实现用户与系统的交互‌。rCore实现这两种机制的核心目标是：

- 提高系统性能和效率
- 减少应用程序切换开销
- 通过协作机制支持程序主动放弃处理器
- 通过抢占机制保证处理器资源使用的公平性‌

#### 二、多道程序的放置与加载

##### 2.1 内存布局设计

在rCore中，每个应用程序需要按照编号被分别放置到内存中不同位置，这与第二章将所有程序复制到同一内存区域不同‌。实现方法包括：

- 通过链接脚本指定每个应用程序的起始地址
- 内核运行时正确获取地址并将应用代码放置到指定位置‌

##### 2.2 地址空间问题

每个应用程序需要知道自己运行时在内存中的位置，这给编写带来麻烦。操作系统也需要知道每个程序的位置，不能任意移动应用程序所在的内存空间‌。这种限制导致：

- 无法在运行时根据内存空闲情况动态调整程序位置
- 可能影响后续对内存碎片空间的利用‌

#### 三、任务切换机制

##### 3.1 基本概念

- ‌**任务**‌：应用程序的一个计算阶段的执行过程‌
- ‌**任务切换**‌：从一个程序的任务切换到另一个程序的任务‌
- ‌**任务上下文**‌：任务切换和恢复时相关的寄存器集合‌

##### 3.2 切换流程

任务切换通过内核栈上的task_context压入和弹出实现‌，具体分为五个阶段：

1. Trap执行流A调用__switch前，A内核栈只有Trap上下文和调用栈信息
2. A在内核栈分配任务上下文空间保存寄存器快照，更新task_cx_ptr
3. 读取B的task_cx_ptr获取B内核栈栈顶位置，切换sp寄存器实现执行流切换
4. CPU从B内核栈取出任务上下文恢复寄存器状态
5. B从调用__switch位置继续执行‌

#### 四、关键数据结构与实现

##### 4.1 TrapContext结构

```
#[repr(C)]
pub struct TrapContext {
    pub x: [usize; 32],    // 通用寄存器
    pub sstatus: Sstatus,  // 状态寄存器
    pub sepc: usize,       // 异常程序计数器
}
```

该结构用于保存和恢复任务状态，在os/src/trap/context.rs中定义‌。

##### 4.2 系统调用处理

在trap_handler中对用户态环境调用(Exception::UserEnvCall)的处理：

```
Trap::Exception(Exception::UserEnvCall) => {
    cx.sepc += 4;
    cx.x = syscall(cx.x[...]);
}
```

通过修改sepc和x寄存器实现系统调用返回‌。

#### 五、分时多任务实现机制

##### 5.1 协作式调度

- 程序通过主动调用yield系统调用放弃CPU
- 提高系统执行效率但依赖程序配合‌

##### 5.2 抢占式调度

- 通过时钟中断强制任务切换
- 保证不同程序对处理器资源的公平使用
- 提高对I/O事件的响应效率‌



## 地址空间

#### 一、地址空间基本概念

##### 1.1 虚拟地址与物理地址

- ‌**虚拟地址**‌：应用程序使用的逻辑地址，由操作系统和硬件共同维护的抽象层‌
- ‌**物理地址**‌：实际内存硬件使用的地址，由CPU地址线直接访问‌
- ‌**转换机制**‌：通过MMU(Memory Management Unit)硬件单元实现虚拟地址到物理地址的转换‌

##### 1.2 地址空间定义

地址空间是指程序在运行时用于访问内存的逻辑地址集合，包含：

- 用户地址空间：每个应用程序独占的虚拟地址范围‌
- 内核地址空间：操作系统内核使用的虚拟地址范围‌

#### 二、地址空间实现原理

##### 2.1 SV39分页机制

RISC-V采用SV39分页方案，主要特点包括：

- 39位虚拟地址空间，支持512GB寻址‌
- 三级页表结构（页全局目录、页中间目录、页表）‌
- 页大小为4KB，作为基本映射单位‌

##### 2.2 页表管理

- ‌satp寄存器：控制分页模式，存储根页表物理地址‌
  - MODE字段：设置为8表示启用SV39分页‌
  - PPN字段：存储一级页表物理页号‌
- ‌**页表项结构**‌：包含物理页号、访问权限等控制位‌

#### 三、地址空间隔离与保护

##### 3.1 隔离机制

- ‌**应用间隔离**‌：每个应用有独立的页表，V标记位控制有效访问范围‌
- ‌**内核保护**‌：页表项U位控制用户态访问权限‌
- ‌**空分复用**‌：不同应用可使用相同虚拟地址映射到不同物理页‌

##### 3.2 内存安全

通过地址空间机制实现：

- 防止应用随意访问其他应用或内核数据‌
- 避免物理内存布局冲突，简化应用开发‌
- 增强系统整体安全性和稳定性‌

#### 四、关键数据结构与实现

##### 4.1 页表相关结构

```
// 页表项定义
struct PageTableEntry {
    bits: usize,  // 存储物理页号和标志位
}

impl PageTableEntry {
    fn ppn(&self) -> PhysPageNum { /*...*/ }
    fn flags(&self) -> PTEFlags { /*...*/ }
    fn is_valid(&self) -> bool { /*...*/ }
}
```

##### 4.2 地址空间管理

- ‌MemorySet结构：管理应用的地址空间‌
  - 包含页表、内存区域映射等信息
  - 实现地址映射的建立与销毁

#### 五、地址空间工作流程

1. ‌**初始化阶段**‌：
   - 创建内核地址空间‌
   - 设置satp寄存器启用分页‌
2. ‌**应用加载**‌：
   - 为应用创建独立地址空间‌
   - 建立代码段、数据段等内存映射‌
3. ‌**运行时**‌：
   - MMU自动完成地址转换‌
   - 页错误异常处理‌



## 进程与进程管理

#### 一、进程基本概念

##### 1.1 进程定义

进程是正在运行并使用计算机资源的程序，是操作系统资源分配的基本单位‌。在rCore中，进程由以下部分组成：

- 程序代码和数据段
- 虚拟内存空间
- 进程控制块(PCB)‌

##### 1.2 进程与程序区别

- ‌**程序**‌：静态的可执行文件
- ‌**进程**‌：动态的执行实体，具有生命周期‌

##### 1.3 进程控制块(PCB)

PCB是进程存在的唯一标志，包含：

- 进程标识符(PID)
- 处理机状态(寄存器值等)
- 进程调度信息
- 进程控制信息‌

#### 二、rCore进程管理实现

##### 2.1 进程相关系统调用

rCore实现了以下关键进程管理系统调用：

- `fork()`：创建与当前进程相同的子进程‌
- `wait_pid()`：父进程等待子进程结束‌
- `exec()`：用新程序替换当前进程‌

##### 2.2 进程创建流程

1. 系统启动时加载初始进程(initproc)‌
2. initproc通过fork创建shell进程‌
3. shell根据用户输入创建其他进程‌

##### 2.3 进程调度

rCore采用以下调度策略：

- 协作式调度：进程主动放弃CPU
- 抢占式调度：通过时钟中断强制切换‌

#### 三、关键数据结构

##### 3.1 进程控制块实现

```
// 进程状态定义
pub enum TaskStatus {
    Ready,
    Running,
    Blocked,
}

// 进程控制块结构
pub struct TaskControlBlock {
    pub pid: usize,          // 进程ID
    pub status: TaskStatus,  // 进程状态
    pub context: TaskContext,// 进程上下文
    pub memory_set: MemorySet, // 地址空间
    // 其他字段...
}
```

##### 3.2 进程上下文

```
#[repr(C)]
pub struct TaskContext {
    pub ra: usize,       // 返回地址
    pub sp: usize,       // 栈指针
    pub s: [usize; 12], // 保存的寄存器
}
```

#### 四、进程生命周期管理

##### 4.1 进程创建

- 分配新的PID
- 创建地址空间
- 初始化进程上下文‌

##### 4.2 进程切换

1. 保存当前进程上下文
2. 选择下一个要运行的进程
3. 恢复新进程上下文‌

##### 4.3 进程终止

- 释放占用的资源
- 通知父进程
- 从进程表中移除‌

#### 五、进程间通信

##### 5.1 共享内存

通过地址空间机制实现进程间数据共享‌

##### 5.2 信号量

提供同步原语，协调进程执行顺序‌



## 文件系统与I/O重定向

#### 一、文件系统基础概念

##### 1.1 文件系统作用

文件系统是操作系统用于持久存储数据的关键组件，主要解决内存易失性与外存持久性之间的矛盾‌。rCore文件系统实现了：

- 数据持久化存储
- 文件命名与组织
- 访问控制与权限管理‌

##### 1.2 存储设备分类

UNIX系统将I/O设备分为三类：

1. ‌**块设备**‌：如磁盘，以固定大小块(512B-32KB)为单位传输‌
2. ‌**字符设备**‌：如键盘/串口，以字符流为单位传输‌
3. ‌**网络设备**‌：面向报文传输，BSD引入socket接口处理‌

#### 二、文件系统核心结构

##### 2.1 磁盘布局

rCore文件系统采用类UNIX布局：

- ‌**超级块**‌：记录文件系统元信息
- ‌**inode区**‌：文件索引节点存储
- ‌**数据块区**‌：实际文件内容存储‌

##### 2.2 关键数据结构

```
// 文件系统超级块
struct SuperBlock {
    magic: u32,          // 文件系统魔数
    blocks: u32,         // 总块数
    inode_bitmap: u32,   // inode位图起始块
    data_bitmap: u32,    // 数据块位图起始块
    inode_area: u32,     // inode区域起始块
    data_area: u32,      // 数据区域起始块
}
```

#### 三、文件操作接口

##### 3.1 系统调用接口

rCore实现以下核心文件操作：

- `open()`：打开/创建文件‌
- `read()/write()`：文件读写‌
- `lseek()`：调整文件指针位置‌
- `close()`：关闭文件描述符‌

##### 3.2 文件描述符

每个进程维护文件描述符表：

- 0：标准输入(stdin)
- 1：标准输出(stdout)
- 2：标准错误(stderr)
- ≥3：用户打开的文件‌

#### 四、I/O重定向机制

##### 4.1 重定向类型

- ‌**输入重定向**‌：`<` 将文件内容作为程序输入‌
- ‌**输出重定向**‌：`>` 覆盖写入文件，`>>` 追加写入‌
- ‌**错误重定向**‌：`2>` 重定向stderr‌

##### 4.2 实现原理

通过修改进程文件描述符表实现：

1. 打开目标文件获取新fd
2. 关闭原标准流fd(0/1/2)
3. 复制新fd到标准流位置‌

#### 五、管道通信机制

##### 5.1 管道特点

- 半双工通信，包含读端和写端‌
- 基于队列的有限缓冲区‌
- 读空/写满时阻塞等待‌

##### 5.2 使用示例

```
// 创建管道
let mut pipe_fd = [0usize; 2];
pipe(&mut pipe_fd);

// 子进程读管道
if fork() == 0 {
    close(pipe_fd); // 关闭写端
    read(pipe_fd, &mut buffer);
}
```

#### 六、设备驱动实现

##### 6.1 virtio驱动

rCore通过virtio协议访问块设备：

- 设备树信息由OpenSBI提供‌
- 使用DMA提高传输效率‌
- 实现磁盘块缓存优化性能‌

##### 6.2 三种I/O方式

1. ‌**PIO**‌：CPU直接控制I/O‌
2. ‌**中断驱动**‌：设备就绪后通知CPU‌
3. ‌**DMA**‌：设备直接访问内存‌



## 并发

#### 一、并发基础概念

##### 1.1 并发与并行区别

- ‌**并发**‌：多个任务交替执行，宏观上"同时"运行‌
- ‌**并行**‌：多个任务真正同时执行，需要多核硬件支持‌

##### 1.2 并发实现方式

rCore主要采用以下并发模型：

- 多道程序：通过任务切换实现并发‌
- 分时多任务：基于时间片轮转调度‌
- 多线程：轻量级执行单元共享地址空间‌

#### 二、任务调度机制

##### 2.1 任务控制块(TCB)

```
struct TaskControlBlock {
    task_cx: TaskContext,  // 任务上下文
    task_status: TaskStatus, // 任务状态
    // 其他调度相关信息...
}
```

##### 2.2 调度策略

rCore实现了两种基本调度方式：

1. ‌**协作式调度**‌：任务主动yield让出CPU‌
2. ‌**抢占式调度**‌：通过时钟中断强制任务切换‌

#### 三、同步原语实现

##### 3.1 自旋锁

```
pub struct SpinLock<T> {
    locked: AtomicBool,
    data: UnsafeCell<T>,
}
```

- 基于原子操作实现‌
- 获取锁时忙等待‌

##### 3.2 信号量

```
pub struct Semaphore {
    count: isize,
    wait_queue: VecDeque<TaskControlBlock>,
}
```

- 维护计数器+等待队列‌
- 提供P/V操作接口‌

#### 四、中断与异常处理

##### 4.1 中断处理流程

1. 保存当前任务上下文‌
2. 执行中断服务例程(ISR)‌
3. 恢复或切换任务上下文‌

##### 4.2 特权级切换

- 用户态(U-Mode)通过ecall进入内核态(S-Mode)‌
- 内核通过sret返回用户态‌

#### 五、并发编程实践

##### 5.1 线程创建

```
fn thread_create(entry: fn()) -> Tid {
    // 分配线程栈
    // 初始化线程上下文
    // 加入调度队列
}
```

##### 5.2 互斥访问示例

```
let lock = SpinLock::new(shared_data);
{
    let mut guard = lock.lock();
    *guard += 1; // 临界区操作
} // 自动释放锁
```

#### 六、性能优化技术

##### 6.1 无锁数据结构

- 基于原子操作实现‌
- 适用于高并发场景‌

##### 6.2 读写锁

```
pub struct RwLock<T> {
    state: AtomicIsize,
    data: UnsafeCell<T>,
}
```

- 区分读写访问‌
- 提高读多写少场景性能‌
