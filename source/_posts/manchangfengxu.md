---
title: manchangfengxu
date: 2025-06-15 13:31:42
tags:
    - author:manchangfengxu
---
# rust基础的总结

## 一.基本数据类型与所有权

### 所有权系统核心规则
1. **移动语义(Move)**：
   ```rust
   let s1 = String::from("hello");  // 堆分配
   let s2 = s1;                    // 所有权转移
   // println!("{}", s1);           // 错误！s1 已失效
   ```
2. **借用规则**：
   - 任意时刻：**一个**可变引用 **或** 多个不可变引用
   - 引用必须始终有效（悬垂指针禁止）
3. **生命周期标注**：
   ```rust
   fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
       if x.len() > y.len() { x } else { y }
   }
   ```

### Slice 类型
- **无所有权引用**：
  ```rust
  let s = String::from("hello world");
  let hello: &str = &s[0..5];    // 字符串切片
  let a = [1, 2, 3, 4];
  let slice: &[i32] = &a[1..3];  // 数组切片
  ```

## 二.Crate 与模块系统

### Crate 类型
| 类型        | 文件扩展名   | 特点                     |
|-------------|-------------|--------------------------|
| 二进制 Crate | `main.rs`   | 可执行程序              |
| 库 Crate     | `lib.rs`    | 可复用代码库            |

### 模块可见性规则
```rust
mod front_of_house {
    pub mod hosting {          // pub 使模块公有
        pub fn add_to_waitlist() {}
    }
}

// 使用绝对路径访问
crate::front_of_house::hosting::add_to_waitlist();
```

### 使用外部 Crate
```toml
# Cargo.toml
[dependencies]
rand = "0.8.5"  # 语义化版本
```
```rust
// main.rs
use rand::Rng;

fn main() {
    let num = rand::thread_rng().gen_range(1..101);
}
```

## 三. Option 与错误处理

### Option<T> 枚举
```rust
enum Option<T> {
    Some(T),
    None,
}

// 安全解包
let x: Option<i32> = Some(5);
match x {
    Some(i) => println!("Value: {}", i),
    None => println!("Missing value"),
}
```

### Result<T, E> 错误处理
```rust
fn read_file(path: &str) -> Result<String, io::Error> {
    fs::read_to_string(path)
}

// 错误传播简写
fn read_config() -> Result<String, io::Error> {
    let mut file = File::open("config.toml")?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}
```

### 错误处理最佳实践
1. 优先使用 `Result` 而非 panic
2. 使用 `?` 操作符传播错误
3. 自定义错误类型实现 `std::error::Error`

## 四. Trait 与泛型

### Trait 定义与实现
```rust
trait Summary {
    fn summarize(&self) -> String;
}

struct NewsArticle {
    headline: String,
    location: String,
}

impl Summary for NewsArticle {
    fn summarize(&self) -> String {
        format!("{} ({})", self.headline, self.location)
    }
}
```

### 泛型函数
```rust
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut largest = &list[0];
    for item in list {
        if item > largest {
            largest = item;
        }
    }
    largest
}
```

### Trait Bound 语法糖
```rust
// 以下两种写法等价
fn notify<T: Display + Clone>(item: &T) {...}
fn notify(item: &(impl Display + Clone)) {...}
```

### 生命周期进阶
**生命周期标注必要性**：
1. 结构体持有引用时必须显式标注生命周期，确保引用的有效性
2. 方法实现中：
   - `&self` 参数隐含 `&'a self` 生命周期
   - 返回值关联结构体生命周期（通过生命周期消除规则第三项）
3. 遵循Rust生命周期消除三规则：
   - 每个输入引用自动获得独立生命周期
   - 单个输入引用时所有输出引用与其生命周期对齐
   - 方法签名中 `&self` 使输出引用与结构体生命周期对齐

**错误**：
```rust
fn dangling_reference() -> &str {
    let s = String::from("temporary");
    &s[..]  // 错误！返回局部变量引用
} // s离开作用域被丢弃
```

```rust
struct ImportantExcerpt<'a> {
    part: &'a str,
}

impl<'a> ImportantExcerpt<'a> {
    fn announce_and_return(&self, announcement: &str) -> &str {
        println!("Attention: {}", announcement);
        self.part
    }
}
```

## 五. 智能指针

### 常用智能指针对比
| 类型         | 所有权 | 线程安全 | 使用场景               |
|--------------|--------|----------|------------------------|
| `Box<T>`     | 单一   | 是       | 堆分配、递归类型       |
| `Rc<T>`      | 共享   | 否       | 单线程引用计数         |
| `Arc<T>`     | 共享   | 是       | 多线程引用计数         |
| `RefCell<T>` | 可变   | 否       | 运行时借用检查         |

### 使用示例
```rust
// Box 用于递归类型
enum List {
    Cons(i32, Box<List>),
    Nil,
}

// Rc 共享所有权
use std::rc::Rc;
let a = Rc::new(5);
let b = Rc::clone(&a);

// RefCell 运行时借用检查
use std::cell::RefCell;
let c = RefCell::new(42);
*c.borrow_mut() += 10;
```

## 六.迭代器与闭包

### 闭包类型推断
```rust
let add_one = |x| x + 1;         // 类型自动推导
let print = || println!("hello"); // 无参闭包
```

### 闭包捕获模式
| 捕获方式   | 关键字 | 所有权 |
|------------|--------|--------|
| 不可变借用 | `||`   | 保留   |
| 可变借用   | `|mut|`| 保留   |
| 值捕获     | `move` | 转移   |

### 迭代器适配器
```rust
let v = vec![1, 2, 3, 4];

// 链式调用
let sum: i32 = v.iter()
    .map(|x| x * 2)        // 加倍
    .filter(|x| x % 4 == 0) // 过滤4的倍数
    .sum();                 // 求和
```

### 自定义迭代器
```rust
struct Counter {
    count: u32,
}

impl Iterator for Counter {
    type Item = u32;
    
    fn next(&mut self) -> Option<Self::Item> {
        if self.count < 5 {
            self.count += 1;
            Some(self.count)
        } else {
            None
        }
    }
}
```

## 七.并发与异步编程

### 线程创建
```rust
use std::thread;

let handle = thread::spawn(|| {
    println!("From spawned thread");
});

handle.join().unwrap();
```

### 通道通信 (mpsc)
```rust
use std::sync::mpsc;

let (tx, rx) = mpsc::channel();

thread::spawn(move || {
    tx.send("Message").unwrap();
});

println!("Received: {}", rx.recv().unwrap());
```

### 共享状态 (Mutex)
```rust
use std::sync::{Arc, Mutex};

let counter = Arc::new(Mutex::new(0));

let handles: Vec<_> = (0..10).map(|_| {
    let c = Arc::clone(&counter);
    thread::spawn(move || {
        let mut num = c.lock().unwrap();
        *num += 1;
    })
}).collect();
```

### 异步编程 (async/await)
```rust
async fn fetch_data() -> Result<String, reqwest::Error> {
    reqwest::get("https://api.example.com/data")
        .await?
        .text()
        .await
}

#[tokio::main]
async fn main() {
    let data = fetch_data().await.unwrap();
    println!("Data: {}", data);
}
```

## 八.常用集合类型

### Vec<T> 动态数组
```rust
let mut v = Vec::with_capacity(10);
v.extend([1, 2, 3]);

// 安全访问
if let Some(val) = v.get(1) {
    println!("Second element: {}", val);
}

// 所有权注意事项
let first = &v[0];
// v.push(4); // 编译错误！存在不可变引用时禁止修改
```

### HashMap<K, V> 哈希表
```rust
use std::collections::HashMap;

let mut scores = HashMap::new();
scores.insert("Blue", 10);

// Entry API 安全更新
scores.entry("Yellow").or_insert(50);
scores.entry("Blue").and_modify(|e| *e += 1);
```
# 阶段二,os基础

## lab1

### 与上下文, 特权级有关的寄存器
- sstatus：包含了处理器的状态信息，包括特权级别和中断使能状态。恢复 sstatus 的值确保在返回用户态时，处理器的特权级别和中断状态与陷阱发生前一致。
- sepc：保存了中断或异常发生时的程序计数器值。恢复 sepc 的值确保在返回用户态时，处理器能够从中断或异常发生的地方继续执行。
- sscratch：保存了用户栈指针。在切换到用户态之前，将用户栈指针保存到 sscratch 寄存器中，以便在用户态下使用。
- sret根据sstatus中的SPP位指示切换为用户态。（寄存器中的一个位，0,u_mode;1_,s_mode,s_mode）
- scause: Trap原因/种类
- stvec: trap_handle地址

## lab2

### SV39
- virtual page 39位, 38-12为虚拟页号
- 页表项PTE: Reserver: 10, PPN2: 26, PPN1: 9, PPN0: 9, RSW: 2, DAGUXWRV

### 分页
- MMU地址转换
- kernel address space最高位为 "跳板", app ks, guard page
- app address space, 最高位为跳板, TrapContext, UserStack, GP, Framed
#### 跳板意义: 
satp, 切换后,地址映射不同, 例如:上下文切换的restore, 在更改satp指令后, 保证下一条指令在不同的地址映射下能被正确寻址,保证指令的连续执行

### TrapContext新增字段
在进行特权级转换时, 需要相应的sp以及satp的token
- pub kernel_satp: usize, 内核地址空间的 token
- pub kernel_sp: usize, 当前应用在内核地址空间中的内核栈栈顶的虚拟地址
- pub trap_handler: usize, 内核中 trap handler 入口点的虚拟地址

## lab3

### fork
- 获得父进程的地址空间
- sepc + 4
- a0返回参数更改,父子进程不相同
- 维护父子进程关系
- fd, 死锁检测等

### 功能实现
- stride算法:
    * 为TCB加上schedule块(struct), 同时预留了pass设置的接口
    * 为sys_set_priority加入了对priority的设置 
    * 将TaskManager块改为了用binaryheap存储, 并为TCB分配了Ord特性,每次选取都会取stride最小的调度

- 向前兼容
    * 重写mmap和munmap(用到了remove_area_with_start_vpn)
    * 重写了sys_get_time,用到了translate_va

## lab4

### 文件系统
文件系统本质上是一堆块上的抽象, 在内存中有缓存块对其进行映射.

进程维护一个文件描述符表,可映射到对应的缓存块
```rust
pub struct BlockCache {
    cache: [u8; BLOCK_SZ],
    block_id: usize,
    block_device: Arc<dyn BlockDevice>,
    modified: bool,
}

//提供对应的接口调用
```

### easy-fs磁盘布局
- 超级块 (Super Block)，用于定位其他连续区域的位置，检查文件系统合法性。

- 索引节点位图，长度为若干个块。它记录了索引节点区域中有哪些索引节点已经被分配出去使用了。

- 索引节点区域，长度为若干个块。其中的每个块都存储了若干个索引节点。
```rust
#[repr(C)]
pub struct DiskInode {
    pub size: u32,
    pub direct: [u32; INODE_DIRECT_COUNT],
    pub indirect1: u32,
    pub indirect2: u32,
    type_: DiskInodeType,
}
```

- 数据块位图，长度为若干个块。它记录了后面的数据块区域中有哪些已经被分配出去使用了。

- 数据块区域，其中的每个被分配出去的块保存了文件或目录的具体内容。

## lab5
在引入线程后, 调度机制本质上是在线程块上进行切换. 会区分主线程和子线程
- 创建线程不需要要建立新的地址空间
- 能够访问到进程所拥有的代码段， 堆和其他数据段
- 专有的用户态栈

### 实现功能
- 在ProcessControlBlockInner加入了对mutex和sem的死锁检查块(all[], ava[], need[])
- 检测前对相应资源的need[] + 1
- 实现is_safe检测函数, 对finish==false和need <= work的块, 回收allocation和finish=true,对标记flag=true, 当finish没有任何改变, 即本次循环flag==false时退出loop, 利用闭包all,检测finish所有线程是否全是true
- 若为unsafe, 则回退need, 返回-0xdead
- 若为safe, 则在down和lock之前drop(process_inner),防止线程堵塞无法释放资源, 在down和lock之后同时更新检查块中的矩阵
- 为up和unlock加上检查块的更新

### Mutex实现问题
- Mutex1的lock里,会一直尝试获取锁, 具体逻辑为当无法获得锁时,直接阻塞,让出cpu,直到被唤醒, 再重新尝试获得锁, unlock中释放锁,并且唤醒一个线程去竞争这个锁.
- Mutex的lock,在无法获得锁时,直接堵塞,在unlock时,只有等待队列为空才释放锁.
        - 这里的unlock本质是锁资源的转移, A不释放锁, 而是唤醒一个直接使用这个资源的B线程(它醒来后直接运行临界区后的代码)

# 第三阶段
## **一, 组件化内核基础与 Unikernel 模式**

### 组件化内核介绍

#### Unikernel 模式
- **特点**：
  - 应用与内核合一：编译为一个 Image，共享同一特权级（内核态）和地址空间。
  - 无用户态 / 内核态切换：简单高效，但安全性较低（应用可直接访问内核资源）。

#### 核心组件
| 组件名称 | 功能描述 | 在实验中的作用 |
| --- | --- | --- |
| axhal | 硬件抽象层，屏蔽不同架构差异（如 Riscv64/ARM） | 初始化串口、内存等硬件，提供底层 IO 接口 |
| axruntime | 内核运行时环境，负责引导流程、内存初始化、任务调度框架 | 执行内核启动流程，调用应用层代码 |
| axstd | 内核态标准库，提供基础数据结构和工具函数（如 println!） | 实现字符终端输出功能 |
| arceos_api | 内核公共接口，定义组件间通信协议 | 统一组件间调用规范 |

#### Unikernel 的启动链
- **硬件启动**：通过 OpenSBI（Riscv 固件）加载内核 Image 到内存。
- **引导阶段（axhal）**：
  - 初始化 CPU 寄存器、MMU 分页（早期恒等映射）。
  - 建立内核栈，为 Rust 运行时做准备。
- **运行时阶段（axruntime）**：
  - 初始化内存分配器、日志系统。
  - 调用应用层 main 函数，执行具体功能。

### 实验

#### 1. 主函数 src/main.rs
```rust
#![cfg_attr(feature = "axstd", no_main)] // 若启用 axstd，不使用标准库的 main 入口
#[cfg(feature = "axstd")] // 根据 feature 条件编译
use axstd::println; // 使用 axstd 的打印函数

#[cfg_attr(feature = "axstd", no_mangle)] // 避免符号名被修改
fn main() {
    println!("Hello, ArceOS!"); // 调用 axhal 提供的串口输出功能
}
```

#### 2. 依赖管理 Cargo.toml
```toml
[dependencies]
axstd = { workspace = true } // 引入 axstd 组件，支持标准库功能
arceos_api = { workspace = true } // 引入内核公共接口
```

#### 3. features 动态配置
- **作用**：通过编译参数控制组件的启用，实现 “按需构建”。
- **示例**：
  - axstd 组件通过 feature = "axstd" 控制是否包含。
  - 实验中默认启用 axstd，因此能使用 println!。

#### println!
通过更改ulib下axstd,macros文件中的println!
#### hashmap

```rust
#[cfg(feature = "alloc")]
pub mod collections;
```
暴露自己写的collections
```toml
[dependencies.hashbrown]
version = "0.14"
default-features = false
```
用了官方库的core版本


## **二, 内存管理与多任务基础**

#### 1. 分页的两个阶段
| 阶段 | 目标 | 实现方式 | 关键组件 |
| --- | --- | --- | --- |
| 早期启用（必须） | 快速建立基本映射，保证内核启动 | 1GB 恒等映射（虚拟地址 = 物理地址） | axhal 中的 BOOT_PT_SV39 页表 |
| 后期重映射（可选，需 paging feature） | 扩展地址空间，支持设备 MMIO | 细粒度权限控制（如只读、可执行） | axmm 中的 AddrSpace、PageTable |

#### 2. 算法
| 算法 | 原理 |
| --- | :-: |
| TLSF | 两级 Bitmap + 链表管理空闲块 |
| Buddy | 基于 2 的幂次分裂 / 合并空闲块 |
| Slab | 为特定大小对象创建缓存池 |

#### 3.
全局分配器：通过 `#[global_allocator]` 声明，实现 `GlobalAlloc` trait。
```rust
#[cfg_attr(all(target_os = "none", not(test)), global_allocator)]
static GLOBAL_ALLOCATOR: GlobalAllocator = GlobalAllocator::new();
```

#### 任务数据结构 `TaskInner`
```rust
struct TaskInner {
    id: TaskId,           // 唯一标识
    name: String,         // 任务名称（调试用）
    state: AtomicU8,      // 状态（Running/Ready/Blocked/Exited）
    kstack: Option<TaskStack>, // 任务栈（类似线程栈）
    ctx: UnsafeCell<TaskContext>, // 上下文（保存寄存器状态）
    // 其他字段：调度相关（如时间片、优先级）
}
```

#### 协作式调度
FIFO 队列：任务按 “先到先服务” 原则执行，当前任务需主动让出 CPU（调用 `yield_now()`）。

##### 组件
| 组件 | 功能 |
| --- | --- |
| axsync | 同步原语（自旋锁、互斥锁）     |
| axtask | 调度接口（spawn/yield_now 等） |

#### 实现
EarlyAllocator实现要求比较低
##### byte
- **alloc**
  - 注意每次分配内存时候的对齐
  - 预分配，检查是否与p_pos重叠
  - 为count++
    - 注意每次分配内存时候的对齐
    - 预分配,检查是否与p_pos重叠
    - 为count++
- dealloc
    - 单纯的count--
    - count==0时,就可以重置b_pos了

##### page
- **alloc**
  - 检查alignment是否有效
  - 获取分配的size进行对齐，同时检查是否越界
  - 更新数据
    - 检查alignment是否有效
    - 获取分配的size进行对齐,同时检查是否越界
    - 更新数据
- dealloc
    - 不要求实现


## **三、调度,块设备,文件系统**

### 时钟中断：

#### 代码（Riscv64 中断初始化）
```rust
// axhal/src/platform/riscv64_qemu_virt/mod.rs
axhal::irq::register_handler(TIMER_IRQ_NUM, || {
    update_timer(); // 更新系统时间
    axtask::on_timer_tick(); // 触发调度器更新
});
axhal::arch::enable_irqs(); // 开中断
```


### 块设备驱动：

#### Trait：BlockDriverOps
```rust
trait BlockDriverOps {
    fn num_blocks(&self) -> u64; // 磁盘总块数
    fn block_size(&self) -> usize; // 块大小（512 字节）
    fn read_block(&mut self, block_id: u64, buf: &mut [u8]) -> DevResult; // 读块
}
```


### 文件系统：
#### 抽象
文件系统（FileSystem）：如 FAT32、EXT4。

目录（Dir）：存储文件 / 子目录元数据。

文件（File）：存储具体数据，支持读写操作。
#### 接口
```rust
trait VfsOps {
    fn root_dir(&self) -> &DirNode; // 获取根目录
    fn lookup(&self, path: &str) -> Option<FileNode>; // 解析路径
}
```

#### 加载流程
块设备读取：通过 VirtIO Blk 驱动读取磁盘前 512 字节（引导扇区）。

解析 BPB：获取 FAT 表起始地址、簇大小等参数。

挂载文件系统：将 FAT32 的根目录挂载到 VFS 的 / 节点。
#### 应用加载示例（U.8 实验）
```rust
// 从 FAT32 文件系统加载应用程序
fn load_app(path: &str) -> Result<Vec<u8>> {
    let root = vfs.root_dir();
    let file = root.lookup(path).ok_or("文件不存在")?;
    file.read_to_end() // 读取文件内容到内存
}
```

### 实验实现
#### 寻找ing
在axfs_ramf中实现
```rust
impl VfsNodeOps for DirNode{...}
```
文件时通过封装的BTreeMap管理的, 替换相应键值对即可

#### 注意
```rust
    fn rename(&self, src_path: &str, dst_path: &str)
```
src和dst_path路径层级不一样
我使用了split_path_to_end来获取最终的文件名

## **四, 地址空间管理**

### 缺页异常处理

```rust
// 关键修改：init_user_stack的lazy参数设为false
let ustack_top = init_user_stack(&mut uspace, false).unwrap(); // 延迟映射
```

**缺页异常处理流程**
   - 异常触发：用户态访问未映射地址（如栈写入），CPU 陷入内核。
   - 处理逻辑：
     1. 通过handle_page_fault函数申请物理页帧（alloc_frame）
     2. 在页表中建立虚拟地址与物理页帧的映射（pt.remap）

```rust
fn handle_page_fault(...) -> bool {
    let frame = alloc_frame(true); // 申请物理页
    pt.remap(vaddr, frame, orig_flags); // 建立映射
    tlb.flush(); // 刷新TLB
}
```

### ELF 格式解析
关键段：
LOAD 段：包含代码段（R E标志）和数据段（RW标志）。
BSS 段：未初始化数据，ELF 文件不存储，内核需预留空间并清零。
加载逻辑：
```rust
for segment in elf.segments {
    if segment.type == LOAD {
        let vaddr = segment.virt_addr;
        let phys_frame = alloc_frame(segment.mem_siz);
        map_virtual_to_physical(vaddr, phys_frame, segment.flags);
        if segment.has_data {
            copy_file_data(vaddr, segment.file_offset, segment.file_siz);
        } else {
            zero_memory(vaddr, segment.mem_siz); // BSS段清零
        }
    }
}
```



### 实验实现
得到aspace->分配内存->将文件信息写入
```rust
const MAP_SHARED = 1 << 0;    // 共享映射，对映射区域的修改会反映到文件中
const MAP_PRIVATE = 1 << 1;   // 私有映射，对映射区域的修改不会反映到文件中
const MAP_FIXED = 1 << 4;     // 必须使用指定的映射地址
const MAP_ANONYMOUS = 1 << 5; // 匿名映射，不与文件关联
const MAP_NORESERVE = 1 << 14; // 不保留交换空间
const MAP_STACK = 0x20000;    // 用于栈分配
```

这里只处理MAP_PRIVATE,
同时addr.is_null(),可通过aspace.find_free_area寻找内存


## **五, Hypervisor**

### Hypervisor

#### 1.1 定义
Hypervisor（虚拟机监控器）是运行在物理硬件与虚拟机之间的虚拟化层软件，允许多个虚拟机共享物理资源，每个虚拟机拥有独立的虚拟硬件环境（如vCPU、vMem、vDevice）。

#### 1.2 核心功能
- **资源虚拟化**：模拟CPU、内存、设备等硬件资源
- **隔离与调度**：确保虚拟机之间资源隔离，并高效调度物理资源
- **模式切换**：在Host（Hypervisor）与Guest（虚拟机）之间双向切换

#### 1.3 与模拟器的区别
| 维度 | Hypervisor | 模拟器(Emulator) |
|------|------------|----------------|
| ISA一致性 | 虚拟环境与物理环境ISA一致 | 可模拟不同ISA（如x86模拟ARM） |
| 指令执行 | 大部分指令直接在物理CPU执行 | 全部指令需翻译/解释执行 |
| 性能目标 | 高效（虚拟化开销低） | 侧重仿真效果，性能要求低 |

#### 1.4 虚拟化类型
1. **I型Hypervisor**：直接运行在硬件上（如Xen、KVM），性能高
2. **II型Hypervisor**：运行在宿主OS上（如VirtualBox），依赖宿主资源管理

### 二. Riscv64虚拟化扩展（H扩展）

#### 2.1 特权级扩展
新增特权级：
- **HS**(Hypervisor Supervisor)：Host域的管理级，负责虚拟化控制
- **VS**(Virtual Supervisor)：Guest域的内核级，运行Guest OS内核
- **VU**(Virtual User)：Guest域的用户级，运行Guest应用

特权级关系：
```
物理机：M（最高） > HS > U
虚拟机：VS（Guest内核） > VU（Guest用户）
```

#### 2.2 关键寄存器
- **hstatus**：控制Host与Guest的模式切换
  - SPV位：指示进入HS前的模式（0：非虚拟化模式；1：来自Guest的VS模式）
  - SPVP位：控制HS是否有权限操作Guest的地址空间
- **vs[xxx]/hs[xxx]**：分别用于Guest和Host的上下文管理
- **misa**：标识是否支持H扩展（bit7=1表示支持）

### 3. 模式切换机制

#### 3.1 从Host到Guest（run_guest函数）
```rust
// 保存Host寄存器状态
sd ra, (hyp_ra)(a0)  // 保存返回地址
// 加载Guest寄存器状态
ld sstatus, guest_sstatus(a0)
// 执行sret指令切换到VS模式
sret
```
可参考guest.s
- a0指向的guest_reg区域 与 当前reg的替换
#### 3.2 VM-Exit处理（以SBI调用为例）
```rust
match scause.cause() {
    Trap::Exception(Exception::VirtualSupervisorEnvCall) => {
        let sbi_msg = SbiMessage::from_regs(ctx.guest_regs.gpr);
        if let Some(SbiMessage::Reset(Shutdown)) = sbi_msg {
            ax_println!("Shutdown vm normally!");
            // 清理Guest资源
        }
    }
}
```

### 实现
根据结果硬编码,更改guest_reg的值



