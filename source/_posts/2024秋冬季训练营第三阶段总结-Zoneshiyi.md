# ArceOS

## 2024.11.09

### Rust 相关

#### 关键字sym

在Rust中，`sym` 关键字用于引用函数或符号名称，通常出现在 `asm!` 宏的内联汇编代码中。sym 允许在汇编代码中引用Rust中的函数或全局变量，以便编译器能正确地将这些引用转换为相应的内存地址或符号。

#### 原始字符串

在Rust中，字符串前`r#"str"`表示原始字符串字面量（raw string literal）。使用r前缀的字符串可以避免转义字符的干扰，直接包含特殊字符，如反斜杠`\`或双引号`"`。

```Rust
let json = r#"{"name": "John", "age": 30}"#;
```

#### option_env!宏

在Rust中，`option_env!` 宏用于在**编译时**获取环境变量的值，并将其作为 `Option<&'static str>` 返回。

#### Rust条件编译

Rust 中的条件编译允许根据特定条件编译或排除某些代码片段。作用范围通常为其紧邻的代码块或声明项。对于较大的代码片段或模块内容，可以将 `#[cfg(...)]` 等属性放在模块或块的开头，实现更大范围的条件编译。

- `#[cfg(...)]` 属性
- `#[cfg_attr(...)]` 属性
  有条件地应用属性。适合在某些条件下添加其他属性。
- `cfg!` 宏
  用于在**运行时**检查条件编译状态，并返回布尔值。

## 2024.11.10

### ArceOS 部分目录结构

```
.
├── api/                        // 用户调用系统的接口
├── modules/                    // 操作系统模块
├── platforms/                  // 硬件平台相关配置
└── ulib/                       // 用户lib
```

### ArceOS Makefile

如果设置了PLATFORM变量，会覆盖ARCH变量。

```Makefile
# ./Makefile
PFLASH ?= y
PFLASH_IMG ?= pflash.img  # 并行闪存（Parallel Flash）
DISK_IMG ?= disk.img  # FAT32文件系统，/mnt/sbin是./target/riscv64gc-unknown-none-elf/release/origin
```

主要编译过程见`./scripts/make/build.mk`

### QEMU相关

`qemu-system-riscv64 -m 128M -smp 1 -machine virt -bios default -kernel tour/u_1_0/u_1_0_riscv64-qemu-virt.bin -drive if=pflash,file=/home/zone/Code/Rust/oscamp/arceos/pflash.img,format=raw,unit=1 -nographic -D qemu.log -d in_asm,int,mmu,pcall,cpu_reset,guest_errors`

- `-m 128M`：分配128MB的内存给虚拟机。
- `-smp 1`：指定虚拟机使用1个CPU。
- `-machine virt`：指定使用虚拟化的机器类型。
- `-bios default`：使用默认的BIOS。
- `-kernel tour/u_1_0/u_1_0_riscv64-qemu-virt.bin`：指定要加载的内核镜像文件。
- `-drive if=pflash,file=/home/zone/Code/Rust/oscamp/arceos/pflash.img,format=raw,unit=1`：指定一个闪存驱动器，使用原始格式的镜像文件 
- `-nographic`：禁用图形输出，使用纯文本模式。
- `-D qemu.log`：将QEMU的日志输出到qemu.log
- `-d in_asm,int,mmu,pcall,cpu_reset,guest_errors`：启用详细的调试信息，包括指令、中断、内存管理单元、过程调用、CPU重置和来宾错误。

### Rust相关

#### `build.rs`

用于编译第三方的非Rust代码，只需在根目录下添加一个build.rs文件，Cargo会优先编译和执行该构建脚本，然后再构建整个项目。

#### Workspace

一个工作空间是由多个 package 组成的集合，它们共享同一个 Cargo.lock 文件、输出目录和一些设置(例如 profiles : 编译器设置和优化)。组成工作空间的 packages 被称之为工作空间的成员。

工作空间有两种类型：
- root package。若一个 package 的 Cargo.toml 包含了 `[package]` 的同时又包含了 `[workspace]` 部分，则该 package 被称为工作空间的根 package。
- 虚拟清单（virtual manifest）。若一个 Cargo.toml 有 `[workspace]` 但是没有 `[package]` 部分，则它是虚拟清单类型的工作空间。

特性：
- 所有package共享同一个位于根目录的Cargo.lock
- 所有package共享同一个输出目录，默认是位于根目录下的target目录
- 只有根目录的Cargo.toml才能包含 `[patch]`, `[replace]` 和 `[profile.*]`，而成员的 Cargo.toml 中的相应部分将被自动忽略

```toml
[workspace]
resolver = "2"
members = [
    "modules/axalloc",
    "modules/axconfig",
    # ...
]
```

## 2024.11.11

### ArceOS在riscv64-qemu-virt中的部分启动流程

- 下层的SBI初始化完成后将跳转到`modules/axhal/src/platform/qemu_virt_riscv/boot.rs::_start()`
  - 设置boot_stack
  - 设置初始page_table
  - 开启SV39分页，清除地址映射缓存
  - sp += phys_virt_offset
- 跳转到`modules/axhal/src/platform/qemu_virt_riscv/mod.rs::rust_entry()`
  - 清零bss段
  - 设置CPU_ID和IS_BSP
  - 设置trap向量表
  - 设置系统启动时间
- 跳转到`modules/axruntime/src/lib.rs::rust_main()`
  - enable Logging
  - 初始化全局堆内存分配器
  - 冲映射kernel各个段的地址空间
  - platform相关的初始化
  - 初始化调度器
  - 设备与驱动初始化
  - 如果有启动其他CPU
  - 初始化中断
  - 等待所有CPU启动
  - 执行用户程序
  - 清理然后退出

### axalloc

**接口**

- Rust Trait `#[global_allocator]`:`static GLOBAL_ALLOCATOR: GlobalAllocator`
  ```Rust
  pub struct GlobalAllocator {
    balloc: SpinNoIrq<DefaultByteAllocator>,
    palloc: SpinNoIrq<BitmapPageAllocator<PAGE_SIZE>>,
  }
  // 必须为GlobalAllocator实现GlobalAlloc Trait
  // 全部内存先交给palloc管理
  // 然后给balloc预先分配一小块内存作为堆空间
  // 当调用balloc.alloc遇到堆空间不够用时，向palloc请求更多的内存
  ```
  GlobalAllocator提供`alloc_pages(&self, num_pages: usize, align_pow2: usize)`和`dealloc_pages(&self, pos: usize, num_pages: usize)`函数用于页的分配和回收
- 供外部调用的函数：
  - `global_allocator() -> &'static GlobalAllocator`
  - `global_init(start_vaddr: usize, size: usize)`
  - `global_add_memory(start_vaddr: usize, size: usize) -> AllocResult`

**算法**

1. TLSF (Two-Level Segregated Fit)
通过将内存块分成多个大小类别（segregated fit）来实现快速分配。TLSF 的主要特点包括：
快速分配和释放：分配和释放操作的时间复杂度接近 O(1)。
低碎片率：通过精细的大小类别划分，减少内存碎片。
适用于实时系统：由于其高效性和确定性，TLSF 常用于实时系统。

2. Slab Allocator
通过预先分配一组称为“slab”的内存块来管理对象。Slab 分配器的主要特点包括：
高效的对象分配：适用于频繁分配和释放固定大小对象的场景。
减少碎片：通过预先分配和重用内存块，减少内存碎片。
缓存对象：可以缓存已分配的对象，减少分配和释放的开销。

3. Buddy Allocator
通过将内存块递归地分割成两部分来管理内存。Buddy 分配器的主要特点包括：
快速分配和释放：分配和释放操作的时间复杂度为 O(log n)。
合并相邻块：当两个相邻的内存块都空闲时，可以合并成一个更大的块，减少碎片。
适用于大块内存分配：适合需要分配和释放大块内存的场景。

4. BitmapPage Allocator
每个内存块对应一个位，位的状态表示该块是否已分配。BitmapPage 分配器的主要特点包括：
简单实现：位图结构简单，易于实现和管理。
快速查找：通过位图可以快速查找空闲块。
适用于小块内存分配：适合需要频繁分配和释放小块内存的场景。

## 2024.11.12

### Rust 相关

#### 内属性和外属性

在 Rust 中，内属性（inner attribute）和外属性（outer attribute）用于不同的上下文，它们的放置顺序需要符合特定的规则。

- 外属性（outer attribute）用在**项的外部**（如函数、模块、结构体等），以 `#[attribute]` 的形式表示。
- 内属性（inner attribute）用在**代码块的内部**，通常用于全局的配置和文件级别的作用，以 `#![attribute]` 的形式表示。

Rust 不允许在某些位置先使用外属性再使用内属性。具体来说，内属性必须在模块或文件的最开头，并且需要放在任何外属性之前。

## 2024.11.13

### axstd

#### HashMap

HashMap：数组+链表（+红黑树）。链表（或加上红黑树）针对出现hash冲突的情况

要在axstd里实现基础的HashMap功能，最简单的方法是在lib.rs里加上`pub use hashbrown::hash_map::HashMap as HashMap`

或者仿照std添加collections模块，目录结构如下：
```
ulib/axstd/src
│
└── collections
     ├── hash
     │   ├── map.rs
     │   └── mod.rs
     └── mod.rs
```

部分代码如下，主要是在RadomState的new函数中调用底层模块提供的生产随机数接口来设置keys：
```Rust
use hashbrown::hash_map::HashMap as base_hashmap;
// ...

#[derive(Clone)]
pub struct RandomState {
    k0: u64,
    k1: u64,
}

impl RandomState {
    pub fn new() -> Self {
        let random_u128 = arceos_api::misc::random();
        RandomState {
            k0: random_u128 as u64,
            k1: (random_u128 >> 64) as u64,
        }
    }
}

impl BuildHasher for RandomState {
    type Hasher = DefaultHasher;
    fn build_hasher(&self) -> DefaultHasher {
        DefaultHasher(SipHasher::new_with_keys(self.k0, self.k1))
    }
}

...

#[allow(deprecated)]
#[derive(Clone, Debug)]
pub struct DefaultHasher(SipHasher);

impl Hasher for DefaultHasher {
    //...
}

pub type HashMap<K, V, S = RandomState> = base_hashmap<K, V, S>;

```

## 2024.11.14

### QEMU相关

#### PFlash

QEMU的PFlash模拟闪存磁盘，启动时自动从文件加载内容到固定的MMIO区域，**对读操作不需要驱动**，可以直接访问。写操作仍需要驱动。


### rust-analyzer

```json
// .vscode/settings.json
{
  // 避免不必要的检查
  "rust-analyzer.check.allTargets": false,
  // 检查程序时传递给cargo的features
  "rust-analyzer.cargo.features": ["axstd"],
  "rust-analyzer.cargo.target": "riscv64gc-unknown-none-elf",
  "rust-analyzer.cargo.targetDir": "/path/to/oscamp/arceos/target",
  // "rust-analyzer.cargo.extraArgs": [
  //     "--target=riscv64gc-unknown-none-elf",
  //     "--features=axstd"
  // ],
  // "rust-analyzer.cargo.extraEnv": {
  // }
}
```

## 2024.11.17

### unwrap()调用的问题

每次调用 unwrap() 都会返回一个新的实例，而不是同一个实例。因此通过unwrap修改数值无法生效。
可以通过`if let Some(ref mut T)`获取可变引用来修改。

```Rust
#[derive(Copy, Clone, Debug)]
struct A {
    a: i32,
}

fn main() {
    let a = Some(A { a: 0 });
    println!("{}", a.unwrap().a);
    //0 
    a.unwrap().a = 1;
    println!("{}", a.unwrap().a);
    // 0
    if let Some(ref mut tmp) = a {
        tmp.a = 2;
    }
    println!("{}", a.unwrap().a);
    // 2
}
```

## 2024.11.18

### lab1

### Heap区域划分

通过分析lab1的测试样例代码可知alloc行为可以抽象为以下三种：

1. 固定大小且不回收的Vec，这些Vec的位置和大小在分配完成后就不再变化。
2. 固定大小但会回收的Vec，且回收顺序与分配顺序相反。
3. 可变大小的Vec，这些Vec主要用来临时存储前两中Vec的地址
   这一类Vec在任意时刻的数量不超过4个，且长度相对较段，因此选择在Heap区域的开头为其预留固定大小的空间（例如4KB）。

针对第一种类型，从前向后分配，针对第二种类型，从后向前分配。

### 特殊处理

为了简化实现，在系统将所有Heap空间分配给LabByteAllocator管理之前，LabByteAllocator的alloc函数都会返回分配失败。

除此之外，为了能够让Heap空间能够全部分配给LabByteAllocator而没有浪费，需要对LabByteAllocator的`total_bytes()`函数进行特殊处理，而不是返回实际的总字节数。

在axalloc中，当遇到分配器分配失败时，会将分配器的`total_bytes()`方法的返回值作为扩展的空间大小。假设Heap空间的结束地址是HEAP_END，当前分配器管理空间的结束地址是END，`让total_bytes()`返回`(HEAP_END-END)/2`就能尽可能将HEAP空间分配给LabByteAllocator。


## 2024.11.24

### Rust相关

**rust-analyzer**

在编译时makefile会有一些预处理行为，例如设置环境变量、添加cargo参数等等。为了保持rust-analyzer分析代码时的环境与实际编译时尽量保持一致，需要添加相应的配置。

``` json
{
    "rust-analyzer.check.overrideCommand": [
        "cargo",
        // 改变当前目录、
        "-C",
        "/path/to/oscamp/arceos/tour/u_7_0",
        "check",
        //添加unstable flag
        "-Z",
        "unstable-options",
        "--workspace",
        "--message-format=json-diagnostic-rendered-ansi",
        "--manifest-path",
        "/path/to/oscamp/arceos/tour/u_7_0/Cargo.toml",
        "--keep-going",
        "--release",
    ],
    // 添加需要的features
    "rust-analyzer.cargo.features": [
        "axstd/irq",
        // "axstd/rtc",
    ],
    "rust-analyzer.cargo.target": "riscv64gc-unknown-none-elf",
    "rust-analyzer.cargo.targetDir": "/path/to/oscamp/arceos/target",
    "rust-analyzer.cargo.extraEnv": {
        "AX_PLATFORM": "riscv64-qemu-virt",
    }
}
```

### RISC-V相关

#### 异常Exception和中断Interrupt

在 RISC-V 架构语境下，异常和中断都是一种Trap，但他们被触发的原因不同。
- 异常与当前CPU的指令执行是同步的，异常被触发的原因一定能追溯到某条指令的执行，会在执行下一条指令前先进入异常处理流程。
- 中断则异步与当前正在执行的指令，也就是说中断来自于哪个外设以及中断如何触发完全与处理器正在执行的当前指令无关。相比于异常，中断与特权级的联系更加紧密。
  RISC-V 的中断可以分成三类：
  - 软件中断 (Software Interrupt)：由软件控制发出的中断
  - 时钟中断 (Timer Interrupt)：由时钟电路发出的中断
  - 外部中断 (External Interrupt)：由外设发出的中断

arceos在`axhal::arch::riscv::trap::riscv_trap_handler()`中指定了异常的处理函数，然后通过全局静态变量`IRQ: [fn(usize) -> bool]`注册中断处理函数。`axhal::irq::handler_irq`用于分发IRQ对应的中断到实际的处理函数。
`axhal::irq::register_handler`用于初始化注册中断处理函数。


### ArceOS相关

#### 初始任务

在初始化阶段创建了三个任务：
- idle：持续调用`yield_now()`函数的死循环
- main：init进程
- gc：回收所有退出的任务和相应的资源


## 2024.11.26

### ArceOS相关

#### axtask

**接口**

- spawn
- yield_now:Current task gives up the CPU time voluntarily, and switches to another ready task.
- sleep
- exit

#### axdriver

**for_each_drivers!**

这个宏的作用主要是为每一种设备类型（virtio-net、ramdisk等）添加统一的处理代码，类似于for循环遍历所有的设备类型。

**PCIe ECAM**

PCI协议定义了256bytes配置空间，PCIe将配置空间扩展到了4KB。

PCI Express配置模型支持两种配置空间访问机制：
- PCI-compatible Configuration Access Mechanism
- PCI Express Enhanced Configuration Access Mechanism
CAM模式是PCI协议定义的访问方式，而ECAM则是PCIe协议定义的访问方式。

一般来说，系统地址空间会预留256MB（256bus * 32dev * 8func * 4k）空间给ECAM机制使用，当然如果系统比较差，不支持那么多bus号，也可以预留小一点。

Function是PCI设备中的独立子模块，一个设备可以包含多个功能，每个功能可以执行不同的任务。例如：一个PCI网卡可能同时具有以太网控制器（Function 0）和无线网卡（Function 1）两种功能。

#### axfs

**lookup**

在当前的`axfs::fs::fatfs::lookup`实现中，会对传入的path参数先调用open_file，如果返回Err则再调用open_dir，因此如何path传入的是一个文件夹路径，会在err信息中看到`Is a directory`报错。

### 同步

**对编译器和CPU实施的重排指令行为进行控制**

- C++ memory_order_relaxed/Rust Ordering::Relaxed：无fencing作用，cpu和编译器可以重排指令
- C++ memory_order_release/Rust Ordering::Release：前面的访存指令不能排到这条指令之后
- C++ memory_order_acquire/Rust Ordering::Acquire：后面的访存指令不能排到这条指令之前
- C++ memory_order_acq_rel/Rust Ordering::AcqRel：acquire+release
- C++ memory_order_seq_cst/Rust Ordering::SeqCst：AcqRel+所有使用SeqCst的指令严格有序
- C++ memory_order_acquire：

## 2024.11.28

### ArceOS相关

**VFS**

VFS定义文件系统的接口层，为操作系统提供统一的接口操作不同的文件系统。

文件系统节点的操作流程：
- 获取Root目录节点：`VfsOps::root_dir()`
- 解析路径，逐级通过lookup方法找到对应节点：`VfsNodeOps::lookup()`
- 对目标节点进行操作：`VfsNodeOps::op_xxx()`

**Linux常用的文件系统**

- ProcFS：用于提供进程信息的接口
- SysFS：用于向用户暴露设备信息，主要用于替代传统的devfs
- DevFS：目前主要是为了兼容性而存在

以上三种文件系统都是ramfs的实例，在运行时构建。

## 2024.11.30

### Rust相关

**声明宏与过程宏**

- 声明宏匹配对应模式然后以另一部分代码替换当前代码
- 过程宏更像函数，接收一段Rust代码，产生另一些代码作为输出。过程宏的参数为TokenSteam类型，返回值也是TokenSteam类型。

`handle_trap!`声明宏会根据`#[def_trap_handler]`声明的变量，查找对应`#[register_trap_handler(...)]`注册的处理函数。

### axmm

宏内核地址空间管理相关对象的层次构成：
```Rust
// 每个task都有一个地址空间
pub struct AddrSpace {
    va_range: VirtAddrRange,
    areas: MemorySet<Backend>,
    pt: PageTable,
}

// 对BTreeMap的简单封装，用于管理MemoryArea
pub struct MemorySet<B: MappingBackend> {
    areas: BTreeMap<B::Addr, MemoryArea<B>>,
}

// 对应一段连续的虚拟内存区域，关联一个负责实现具体映射行为的Backend
// Backend决定map、unmap、protect的行为，目前有Linear和Alloc两种，Linear对应的物理页帧必须连续
pub struct MemoryArea<B: MappingBackend> {
    va_range: AddrRange<B::Addr>,
    flags: B::Flags,
    backend: B,
}
```


## TODO

Hypervisor

