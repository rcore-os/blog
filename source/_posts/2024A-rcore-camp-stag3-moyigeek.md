---
title: 2024A-rcore-camp-stag3-moyigeek
date: 2024-11-13 18:52:50
tags:
    - rcore
---
### 内核组件化设计

1. 面向场景和应用需求构建内核
2. 以统一的视角看待不同规模的内核
    规模较大的内核，可以视为在规模较小的内核基础上增量构造。宏内核,hypervisor等复杂模式可以看作特殊的UniKernel

优势:
1. 提高内核开发效率
    组件时良好封装的功能单元，直接通过接口调用。
2. 降低内核维护难度
3. 开展基于组件的功能复用和开发协助

###  概念
-  内核系统
    - 运行在内核太的软件，向下与硬件交互，向上提供服务
-  内核组件
    - 用于构建内核系统的基本元素，最小可部署单元。组件可以独立构建和分发，不能独立运行
### 区别
应用与内核
UniKernel:
(1)处于同一特权级-内核态
(2)共享同一地址空间-相互可见。
(3)编译形成一个Image，一体运行
(4)Unikernel既是应用又是内核是二者合体
其他：
(1)分别在独立的相互隔离特权级运行
(2)分别在用户地址空间和内核地址空间-相互独立
(3)分别是不同的lmage，构造和运行相互独立
(4)内核和应用之间的界限分明，以系统调用等ABI为界

### 思路
{% asset_img exp_path.png 实验思路 %}
通过在unikernel中添加组件实现宏内核(用户特权级和地址空间隔离运行应用，应用和内核之间受控的通信机制)，hypervisor(多个操作系统共享硬件资源，通过虚拟化技术实现).

### 实验
**UNIKERNEL**
U.1 Hello字符终端输出信息

U.2 Collections动态内存分配

U.3 ReadPFlash地址空间重映射

U.4 ChildTask多任务与协作式调度

U.5 MsgQueue任务间互斥与通信

U.6 FairSched时钟与抢占式调度

U.7 ReadBlock块设备驱动

U.8 LoadApp文件系统

**宏内核**
1. UserPrivilege用户特权级
2. UserAspace用户地址空间
3. Process进程管理

**Hypervisor**
1. VirtualMode虚拟化
2. GuestSPace
3. Vmexit

### U.1.0 Helloworld
核心组件：裸机程序=>层次化重构=》组件化重构

基于feature选择必要组件的最小组件集合。
```
make run A=tour/u_1_0
```


### U.2.0 Collections
1. 引入动态内存分配组件，支持Rust Collections类型
2. 动态内存分配的框架和算法
```
make run A=tour/u_2_0
```
Rust Collections类型需要动态内存分配支持，内核开发时没有内存管理，只能自己实现global_alloctor适配自身的内存管理子系统


接口
Bytes Alloc 
- Rust Trait #[flobal_alloocator]
Page Alloc
- Globa Functor *global_allocator()*
框架
axalloc
算法
allocator
- TlsfByteAllocator
- BuddyByteAllocator
- SlabByteAllocator
- BitmapByteAllocator


[print_with_color]: 支持带颜色的打印输出。

要求：
1. 修改一个组件的实现
2. 执行make run A=exercises/print_with_color
预期：字符串输出带颜色。（具体颜色不做要求）
修改axstd/src/macros.rs文件中的println!宏，使其输出带颜色的字符串。
```rust
/// Prints to the standard output, with a newline.
#[macro_export]
macro_rules! println {
    () => { $crate::print!("\n") };
    ($($arg:tt)*) => {
        $crate::io::__print_impl(format_args!("\x1B[45m{}\x1B[0m\n", format_args!($($arg)*)));
    }
}
```


[support hashmap]:支持HashMap类型
要求:
1.在axstd等组件中，支持collections::HashMap
2.再次执行make run A=exercises/support_hashmap
提示:
1.报错的std其实是axstd，测试用例main.rs中有"extern crate axstd as std;"
2.在axhal中给出了一个随机数产生函数random()，可以基于它为HashMap提高随机数支持（在axhal 和 axstd 之间还有axapi层）
```rust
use arceos_api::modules::axhal::misc::random;
```
通过引入random实现randomState
```rust
pub struct RandomState {
    k0: u64,
    k1: u64,
}

impl RandomState {
    /// Constructs a new `RandomState` that is initialized with random keys.
    #[inline]
    pub fn new() -> RandomState {
        let random = random();
        RandomState {
            k0: (random >> 64) as u64,
            k1: random as u64,
        }
    }
}

impl BuildHasher for RandomState {
    type Hasher = DefaultHasher;
    #[inline]
    #[allow(deprecated)]
    fn build_hasher(&self) -> DefaultHasher {
        DefaultHasher(SipHasher13::new_with_keys(self.k0, self.k1))
    }
}
```

### U.3.0 ReadPFlash
make run A=tour/u_3_0
（尝试没有指定"paging"时的情况） 

1. PFlash的作用？

Qemu的PFlash模拟闪存磁盘，启动时自动从文件加载内容到固定的MMIO区域，而且对读操作不需要驱动，可以直接访问。pflash_0无法使用，pflash_1起始地址0x2200_0000
2. 为何不指定"paging"时导致读PFlash失败？

ArceOS Unikernel包括两阶段地址空间映射，
Boot阶段默认开启1G空间的恒等映射；
如果需要支持设备MMIO区间，通过指定一个feature - "paging"来实现重映射。


{% asset_img pageing.png pageing %}

早期启用分页
两步完成Paging切换：
1. 恒等映射保证虚拟空间与物理空间有一个相等范围的地址空间映射(0x80000000~0xC0000000)。切换前后地址范围不变，但地址空间已经从物理空间切换到虚拟空间。
2. 给指令指针寄存器pc，栈寄存器sp等加偏移，在图中该偏移是0xffff_ffc0_0000_0000。如此在虚拟空间执行平移后，就完成到最终目标地址的映射。

BOOT_PT_SV39使用的是LDS定义布局时，直接预留的一页，所以不用额外内存分配。
初始化根页表BOOT_PT_SV39，只有一级，即每个页表项直接映射到1G的地址空间。
1G = 230 因此pgd_idx = (VA>>30)&(512-1)
0x8000_0000 >> 30，对应pgd_idx = 2
0xffff_ffc0_8000_0000 >> 30，只保留低9位，
对应pgd_idx = 0x102

物理页帧号 = 物理地址 >> 12，故0x80000

后期重建映射
定paging feature的情况下，启动后期重建完整的空间映射。
注：paging不是决定分页是否启用，而是决定是否包含阶段2。
通过global_allocator()获取内存页来初始化页表

1) 内存分配功能
内含两类分配器，字节分配器和页分配器。
框架与算法分离，松耦合支持多种内存分配算法。

2) 分页功能
启动早期基于静态恒等映射完成分页切换，如果指定paging feature则会在启动后期重新建立范围更大，权限控制更细的映射。


### U.4.0 ChildTask
make run A=tour/u_4_0
1. 对于单CPU，多任务并发的基本原理？

多个任务(执行上下文)分时复用CPU的时间资源。
- 对单CPU，每个时刻只能运行一个任务，是并发而非并行
- 各个任务分享时间资源的比例由调度策略决定
- 在当前任务被调出时，能够完整保存它在此时的执行状态，即保存现场；确保下次被重新调入时能够完整恢复现场，任务能够无感知的从上次断点处继续执行
2. 任务调度的基本机制？

CPU当前正在执行任务与就绪队列中的某个任务进行对换。
```RUST
pub struct TaskInner {
    id: TaskId,
    name: String,
    is_idle: bool,//本身是系统任务idle
    is_init: bool,//本身是任务main(其实就是主线程)

    entry: Option<*mut dyn FnOnce()>,//实现任务逻辑函数的入口
    state: AtomicU8,//任务状态，即上页所示的四个状态

    in_wait_queue: AtomicBool,
    #[cfg(feature = "irq")]
    in_timer_list: AtomicBool,

    #[cfg(feature = "preempt")]
    need_resched: AtomicBool,
    #[cfg(feature = "preempt")]
    preempt_disable_count: AtomicUsize,

    exit_code: AtomicI32,
    wait_for_exit: WaitQueue,

    kstack: Option<TaskStack>,//ArceOS任务相当于线程，所以具有自己的栈空间
    ctx: UnsafeCell<TaskContext>,//上下文类型TaskContext，调度的核心数据结构保存恢复任务的关键
    
    task_ext: AxTaskExt,//任务的扩展属性，是面向宏内核和Hypervisor扩展的关键；    但对于Unikernel，它是空，本节略过。
    

    #[cfg(feature = "tls")]
    tls: TlsArea,
}
```

通用调度框架
支持协作式和抢占式调度的通用框架。接口公开的是runqueue的对应方法

1) spawn&spawn_raw
产生一个新任务，加入runqueue，处于Ready
2) yield_now (协作式调度的关键)
主动让出CPU执行权
3) sleep&sleep_until
睡眠固定的时间后醒来
在timers定时器列表中注册，等待唤醒
4) exit
当前任务退出，标记状态，等待GC回收

任务间切换如何实现？
任务上下文Context: 保存任务状态的最小的寄存器状态集合。
下面是理解上下文切换的两个角度：
物理上每个CPU只存在一套寄存器，其中部分寄存器与任务状态直接相关，它们决定当前是哪个任务在运行。任务切入就是对应保存的上次寄存器状态载入；切出时，保存以备下次再次载入。
任务切换涉及两个任务，通过特殊函数context_switch完成。特殊之处：
某任务作为函数调用者进入函数后，状态保存后被挂起；函数返回后，执行权被交给另一个任务。

上下文Context包含寄存器:

ra: 函数返回地址寄存器，这个切换实现了任务执行指令流的切换。
sp: 任务即线程，这个是线程栈
s0~s11：按照riscv规范，callee不能改这组寄存器的信息，所以需要保存。


[alt_alloc]: 为内存分配器实现新的内存算法bump。
预备： 
1. 如果没有exercises/alt_alloc，回到main分支执行git pull 更新工程，再新建分支做如下练习
2. 执行make A=exercises/alt_alloc/ run
要求：
1. 只能修改modules/bump_allocator组件的实现，支持bump内存分配算法。不能改其它部分。
2. 再次执行make A=exercises/alt_alloc/ run
提示：
1. 可以参考现有的页分配器和字节分配器来实现相应的Trait。
2. 这个bump_allocator既是字节分配器，又是页分配器。所以必须同时实现BaseAllocator，ByteAllocator和PageAllocator三个Trait。这一点与现有的参考不同。

bump 分配器背后的想法是通过增加（“bumping”）下一个变量来线性分配内存，该变量指向未使用内存的开始。在开始时，next 等于堆的起始地址。在每次分配中，next 都会增加分配大小，以便它始终指向已用内存和未使用内存之间的边界：

下一个指针仅沿单个方向移动，因此永远不会两次分配相同的内存区域。当它到达堆的末尾时，无法分配更多内存，从而导致在下一次分配时出现内存不足错误。
bump 分配器通常使用分配计数器实现，该计数器在每次 alloc 调用时增加 1，在每次 dealloc 调用时减少 1。当分配计数器达到零时，这意味着堆上的所有分配都已解除分配。在这种情况下，可以将下一个指针重置为堆的起始地址，以便完整的堆内存可用于再次分配。
next 字段的目的是始终指向堆的第一个未使用的字节，即下一个分配的起始地址。它在 init 函数中设置为 heap_start，因为在开始时，整个堆都未使用。在每次分配时，此字段将增加分配大小（“bumped”），以确保我们不会两次返回相同的内存区域。

```rust
#![no_std]

use core::alloc::Layout;
use allocator::{AllocError, BaseAllocator, ByteAllocator, PageAllocator};

/// Early memory allocator
/// Use it before formal bytes-allocator and pages-allocator can work!
/// This is a double-end memory range:
/// - Alloc bytes forward
/// - Alloc pages backward
///
/// [ bytes-used | avail-area | pages-used ]
/// |            | -->    <-- |            |
/// start       b_pos        p_pos       end
///
/// For bytes area, 'count' records number of allocations.
/// When it goes down to ZERO, free bytes-used area.
/// For pages area, it will never be freed!
///
pub struct EarlyAllocator<const PAGE_SIZE: usize> {
    start: usize,
    end: usize,
    b_pos: usize,
    p_pos: usize,
    count: usize,
}

impl<const PAGE_SIZE: usize> EarlyAllocator<PAGE_SIZE> {
    pub const fn new() -> Self {
        Self {
            start: 0,
            end: 0,
            b_pos: 0,
            p_pos: 0,
            count: 0,
        }
    }
}

impl<const PAGE_SIZE: usize> BaseAllocator for EarlyAllocator<PAGE_SIZE> {
    fn init(&mut self, start_vaddr: usize, size: usize) {
        self.start = start_vaddr;
        self.end = start_vaddr + size;
        self.b_pos = start_vaddr;
        self.p_pos = self.end;
        self.count = 0;
    }

    fn add_memory(&mut self, _start_vaddr: usize, _size: usize) -> Result<(), AllocError> {
        Err(AllocError::NoMemory)
    }
}

impl<const PAGE_SIZE: usize> ByteAllocator for EarlyAllocator<PAGE_SIZE> {
    fn alloc(&mut self, layout: Layout) -> Result<core::ptr::NonNull<u8>, AllocError> {
        let size = layout.size();
        let align = layout.align();
        let align_mask = align - 1;
        let new_pos = (self.b_pos + align_mask) & !align_mask;
        let new_end = new_pos + size;
        if new_end <= self.p_pos {
            self.b_pos = new_end;
            self.count += 1;
            Ok(unsafe { core::ptr::NonNull::new_unchecked(new_pos as *mut u8) })
        } else {
            Err(AllocError::NoMemory)
        }
    }

    fn dealloc(&mut self, _pos: core::ptr::NonNull<u8>, _layout: Layout) {
        // Do nothing for now
    }

    fn total_bytes(&self) -> usize {
        self.end - self.start
    }

    fn used_bytes(&self) -> usize {
        (self.b_pos - self.start) + (self.end - self.p_pos)
    }

    fn available_bytes(&self) -> usize {
        self.p_pos - self.b_pos
    }
}

impl<const PAGE_SIZE: usize> PageAllocator for EarlyAllocator<PAGE_SIZE> {
    const PAGE_SIZE: usize = PAGE_SIZE;

    fn alloc_pages(&mut self, num_pages: usize, align_pow2: usize) -> Result<usize, AllocError> {
        let size = num_pages * PAGE_SIZE;
        let align = align_pow2;
        let align_mask = align - 1;
        let new_end = (self.p_pos - align_mask) & !align_mask;
        let new_pos = new_end - size;
        if new_pos >= self.b_pos {
            self.p_pos = new_pos;
            Ok(new_pos)
        } else {
            Err(AllocError::NoMemory)
        }
    }

    fn dealloc_pages(&mut self, _pos: usize, _num_pages: usize) {
        // Do nothing for now
    }

    fn total_pages(&self) -> usize {
        (self.end - self.start) / PAGE_SIZE
    }

    fn used_pages(&self) -> usize {
        ((self.end - self.p_pos) + PAGE_SIZE - 1) / PAGE_SIZE
    }

    fn available_pages(&self) -> usize {
        (self.p_pos - self.b_pos) / PAGE_SIZE
    }
}
```
```shell
Running bump tests...
Bump tests run OK!
```

### U.5.0 MsgQueue
make run A=tour/u_5_0
任务：被调度的对象，具有独立工作逻辑。

调度：资源相对于使用者通常是不足的，调度就是用来协调每个请求对资源的使用的方法。

任务调度：协调可执行任务对 CPU资源 的使用。

协作式调度：任务之间通过“友好”协作方式分享CPU资源。具体的，当前任务是否让出和何时让出CPU控制权完全由当前任务自己决定。
协作式FIFO机制：
任务按照先入先出的顺序被CPU执行
当前任务一旦获得执行权，就会一直执行。
只有两种情况下，其它任务才能获得执行机会：
3.1) 当前任务执行完成后退出
3.2) 当前任务主动调用yield_now让出执行权

同步原语 - 自旋锁
对于单CPU，加锁时只需要关中断 + 关抢占。无须额外的临界区互斥操作。

对于SMP，才需要基于相互可见的内存变量进行原子互斥操作。

同步原语 - 互斥锁(睡眠)
等待队列是针对某种资源，任务之间进行协调。至多只能有一个任务持有资源，多于一个的任务进入睡眠状态，转入等待队列；直至被唤醒。

### U.6.0 FairSched
make run A=tour/u_6_0

抢占式调度：调度器依据策略，可以打断当前任务的执行，移交CPU执行权给当前“更”有资格 的任务。
抢占机制的根本保障是系统定时器。所以抢占针对的主要操作目标就是current task当前任务。

机制与时机：不是*无条件的抢占*，要两个条件都具备
一是任务内部达到了某种条件，例如时间片耗尽；
二是外部条件与时机，在preempt从disable到enable的那个状态切换点触发抢占。

抢占发生的条件与时机
1. 只有内外条件都满足时，才发生抢占；内部条件举例任务时间片耗尽，外部条件类似定义某种临界区，控制什么时候不能抢占，本质上它基于当前任务的preempt_disable_count。
2. 只在 禁用->启用 切换的下边沿触发；下边沿通常在自旋锁解锁时产生，此时是切换时机。
3. 推动内部条件变化(例: 任务时间片消耗)和边沿触发产生(例: 自旋锁加解锁)的根本源是时钟中断。
外部条件：外部控制的抢占开关(示例)
抢占针对的目标就是当前任务，由外部控制的抢占开关是当前任务的preempt_disable_count。
作为计数：0代表开抢占，大于0则关抢占(可叠加，所以可能大于1)

抢占式调度在协作式自主yield的基础上，引入抢占控制和时钟中断，动态调整内外条件，触发优先级高的任务及时获得调用机会，避免个别任务长期不合理的占据CPU。

时钟中断与抢占式调度
通过axhal 注册时钟中断，定期触发
axtask::on_timer_tick

经由axtask::runqueue传递定时事件

触发特定调度器的task_tick，决定是否标记抢占标志，并可能进一步的导致任务队列的重排

在协作式调度FIFO的基础上，由定时器定时递减当前任务的时间片，耗尽时允许调度，一旦外部条件符合，边沿触发抢占，当前任务排到队尾，如此完成各个任务的循环排列。注：核心目标是当前任务。


 调度器队列是一个双端可操作的队列
时间片耗尽时，放到队尾，即调度出去；
否则，保存队首，即仍是当前任务。
关键：由时钟中断定时触发，每次递减；接近到0时，内部被抢占条件具备，返回true表示可以被抢占。

CFS调度算法
vruntime最小的任务就是优先权最高任务，即当前任务。
计算公式：
vruntime = init_vruntime + (delta / weight(nice))
系统初始化时，init_vruntime, delta, nice三者都是0

新增任务：
新任务的init_vruntime等于min_vruntime
即默认情况下新任务能够尽快投入运行

设置优先级set_priority：
只有CFS支持设置优先级，即nice值，会影响init_vruntime以及运行中vruntime值，该任务会比默认情况获得更多或更少的运行机会。

timersa 递增delta
只针对当前任务

### U.7.0 ReadBlock
make run A=tour/u_7_0

1) 设备管理框架
2) 设备发现与初始化
3) 中断机制与初始化

设备管理框架

AllDevices管理系统所有的设备，为上层的子系统如文件系统FS、网络协议栈NET提供访问服务。三种设备类型：
```rust
pub struct AxDeviceContainer<D>(Option<D>);
```
以静态方式对 具体设备类型 进行简单封装。
但是每种类型只能管理一个设备。效率高
```rust
pub struct AxDeviceContainer<D>(Vec<D>);
```
包含一个动态可变的Vec，因而可以为每个类型动态管理多个设备。
效率相对低

设备发现与初始化过程
主干组件axruntime在启动后期，发现设备并用相应驱动进行初始化
axdriver负责发现设备和对其初始化的过程，核心结构AllDevices
probe基于总线发现设备，逐个匹配驱动并初始化
按照平台，有两种总线：
1) PCI总线：基于PCI总线协议发现和管理设备，对应PC & Server
2) MMIO总线：通常基于FDT解析发现和管理设备(目前未实现)

基于总线发现设备- qemu平台示例
目前管理设备和驱动数量少，采用简单方式，两级循环探测发现设备：

第一级：遍历所有virtio_mmio地址范围，由平台物理内存布局决定并进行过分页映射

第二级：用for_each_drivers宏枚举设备，然后对每个virtio设备probe_mmio进行探查

for_each_drivers宏：
对所有涉及的virtio设备类型，进行枚举

下步会将这个宏及上级循环用通用方式替换:
parse FDT设备树文件的方式

virtio设备的probe过程

1) qemu模拟器基于命令行产生设备
-device virtio-blk-device,drive=disk0
-drive id=disk0,format=raw,file=disk.img

2) qemu将设备mmio地址区域映射到Guest中
qemu-virt平台默认有8个区域槽位，通常只有部分会形成映射，其它处于未映射状态，即表现为空设备

3) virtio-mmio驱动逐个发请求区探查3这些区域槽位
对应映射设备响应请求，返回本设备的类型ID；
没有映射的槽位返回零，表示空设备。

4) virtio-mmio驱动把probe结果报告上层

virtio驱动和virtio设备交互的两条路：
(1)主要基于vring环形队列:
本质上是连续的Page页面，在Guest和Host都可见可写

(2)中断响应的通道
主要对等待读取大块数据时是有用。

### U.8.0 LoadApp
make run A=tour/u_8_0


框架负责在启动时建立类似linux文件系统，在根目录下包含普通目录与文件，及dev目录
axfs对应的是通用的目录和文件对象

VFS定义文件系统的接口层

具体的FS实现：ramfs和devfs


抽象对象：filesystem, dir和file

文件系统节点的操作流程

第一步：获得Root 目录节点
第二步：解析路径，逐级通过lookup方法找到对应节点，直至目标节点
第三步：对目标节点执行操作

MOUNT操作

mount可以理解为文件系统在内存中的展开操作（unflatten）
把易于存储的扁平化的形态转化为易于搜索遍历的立体化形态。

把一棵目录树的“根” "嫁接"到另一棵树的某个结点，两棵树就形成了一棵树。
两棵目录树基于的文件系统可以相同也可以不同。
另外，被mount的结点及其子孙结点都会被遮蔽，直至unmount。
lookup操作到达mount点时，将会发生访问目录树的切换。

[shell]: 在交互式shell的子命令集中增加对rename和mv的支持。

预备： 
执行make run A=examples/shell/ BLK=y
可以看到一个交换界面，其中有一组可用的文件操作子命令，如右图。
但是其中不包括rename和mv两个操作。


要求：
1. 可以修改examples/shell以及其它任何组件，支持rename和mv两个操作。
2. 实现后，能够在shell中能够进行如下的操作序列：

mkdir dira
rename dira dirb
echo "hello" > a.txt
rename a.txt b.txt
mv b.txt ./dirb
ls ./dirb


Unikernel模式的应用与内核：
(1) 处于同一特权级 - 内核特权级
(2) 共享同一地址空间 - 相互可见
(3) 编译形成一个Image，一体运行
(4) Unikernel既是应用又是内核，二者合体


相对于Unikernel，宏内核的特点：
(1) 增加一个权限较低的用户特权级来运行应用。
(2) 为应用创建独立的用户地址空间，与内核隔离。
(3) 内核运行时可以随时加载应用Image投入运行。
(4) 应用与内核界限分明。

如何以Unikernel为基础，构建最小化宏内核？
1. 能够创建和管理内核地址空间，为用户地址空间保留低端内存区域

2. 可以从基于块设备的文件系统中搜索和读入应用程序文件

3. 能够创建子线程任务，与主线程并发运行单独的逻辑代码

4. 能够响应异常和中断

分析从Unikernel基础到目标最小化宏内核需要完成的增量工作：
1. 用户地址空间的创建和区域映射
2. 在异常中断响应的基础上增加系统调用
3. 复用Unikernel原来的调度机制，针对宏内核扩展Task属性
4. 在内核与用户两个特权级之间的切换机制

示例m_1_0的执行逻辑：

1. 创建用户地址空间
2. 加载应用origin到地址空间
3. 在地址空间中建立用户栈
4. 伪造一个返回应用的环境上下文现场
5. 把伪造现场设置到到新任务的内核栈上
6. 启动新任务执行sret指令返回到用户态，从应用origin的entry开始执行
7. 应用origin只包含一行代码，即执行系统调用sys_exit
8. 注册在异常中断向量表中的系统调用响应函数处理sys_exit，内核退出

1. 为应用创建独立的用户地址空间涉及组件：axmm
2. 为应用创建独立的用户地址空间涉及组件：axmm
3. 初始化用户栈涉及组件：axmm
4. 创建用户任务涉及组件：axtask (with taskext)
5. 让出CPU，使得用户任务运行涉及组件：axtask，axhal


页表分为高低两个部分：高端作为内核空间，低端作为用户应用空间。
以初始的内核根页表为模板，为每个应用进程复制独立页表。内核空间共享，用户空间独立使用。
```rust
pub struct AddrSpace {
    pub va_range: VirtualRange,
    pub area:MemorySet<Backend>,
    pub pt: PageTable, 
}
```
用户应用构建方式：Rust工具链 + Rust嵌入式汇编
首先编译origin生成ELF格式，然后被工具链转化为二进程BIN格式。
```shell
cargo build -p origin  --target riscv64gc-unknown-none-elf --release
rust-objcopy --binary-architecture=riscv64 --strip-all -O binary [origin_elf] [origin_bin]
```
BIN格式作为exercises/m_1_0使用的用户应用image。
通过命令行make disk_img已经创建磁盘设备disk.img，并建立文件系统(fat32)。
安装用户应用就是mount该磁盘设备文件到 ./mnt目录，然后更新应用程序image。
```shell
mkdir -p ./mnt
mount $(1) ./mnt
mkdir -p ./mnt/sbin
cp /tmp/origin.bin ./mnt/sbin
umount ./mnt
```
第一步，从文件加载代码到内存缓冲区。
第二步，为用户地址空间代码区域建立映射，拷贝代码到被映射页面中。

TaskInner的扩展：
在其中增加一个ext的结构体成员，
包装与宏内核相关的各个成员。
对原始Unikenel是空结构。


[page_fault]: 处理缺页异常。
预备：把tour/m_1_0/src/main.rs的第39行，init_user_stack的第二个参数从true改为false。
执行
```shell
make payload
./update_disk.sh payload/origin/origin
make run A=tour/m_1_0/ BLK=y
```
要求：实现handle_page_fault响应函数，即实现Lazy映射。
提示：
1. handle_page_fault的注册方式参考handle_syscall的注册宏。
2. 答案就是tour/m_2_0，先不看答案，尝试自己补齐实现。


### M.2.0 UserAspace
make payload
./update_disk.sh payload/origin/origin
make run A=tour/m_2_0 BLK=y
发送缺页异常时，由aspace的handle_page_fault来完成对物理页帧的申请与映射。
方法handle_page_fault是地址空间映射功能重要触发入口，
以下以它为线索说明地址空间映射方面的功能。
AddrSpace：包含一系列有序的区域并对应一个页表。

MemorySet：对BTreeMap的简单封装，对空间下的各个MemoryArea进行有序管理。

MemoryArea：对应一个连续的虚拟地址内存区域，关联一个负责具体映射操作的后端Backend。

Backend：负责具体的映射操作，不同的区域MemoryArea可以对应不同的Backend。
目前支持两种后端类型：
Linear和Alloc。


### 异构内核
应用场景多样化推进多种内核架构形式出现

Unikernel：定制化高效内核，适合于嵌入式场景，如 Unikraft 和 ArceOS

宏内核：通用化内核场景，利用特权级完成部分安全需求，如 Linux

微内核：安全内核场景，将服务放在用户态，利用 IPC 完成不同服务的通信，如 seL4

虚拟机管理程序：又称 hypervisor，适用于虚拟化场景，如 KVM、Xen

每种架构有其重点解决的问题与局限性

未来应用场景势必更加复杂多样

智能汽车驾驶智能家居等等

总结共性：Unikernel 基座
区分特性：
宏内核：进程、地址空间等
虚拟机管理程序：模拟 CPU 状态、虚拟机抽象与接口管理
微内核：IPC 机制实现
构建共通基座，利用组件化获取定制性

方案一：在 task 中直接添加字段 
利用 feature 添加字段
用编译选项控制启动哪个架构
不会有性能影响（编译期决定）
不利于可读性和异构扩展性

方案二：利用索引指向完整扩展实现
仍然保留 Task 的机制
将扩展内容额外实现在新的结构中
两者通过某一个共通字段关联
常用 TaskID 进行联系
由于 Rust 限制，关联方式可选用 BTreeMap 等形式
保留了一定的可扩展性
但在查询索引的过程会带来性能开销

Unikernel 已经提供的系统服务，如何方便被其他架构复用？
挑战：资源隔离与共享
已有资源举例
Fd_table
Virtual memory management
API handler
资源的隔离与共享
Unikernel：全局唯一
宏内核：进程拥有资源，通过 clone 控制共享

### 虚拟化和Hypervisor概念
基于一台物理计算机系统建立一台或多台虚拟计算机系统（虚拟机），每台虚拟机拥有自己的独立的虚拟机硬件，支持一个独立的虚拟执行环境。每个虚拟机中运行的操作系统，认为自己独占该执行环境，无法区分该环境是物理机还是虚拟机。

Hypervisor即图中的虚拟化层软件：
运行在物理服务器和操作系统之间的中间软件层，允许多个操作系统和应用共享硬件。

Hypervisor与模拟器Emulator的区别

根本区别：虚拟运行环境和支撑它的物理运行环境的体系结构即ISA是否一致。
根据1974年，Popek和Goldberg对虚拟机的定义：
虚拟机可以看作是物理机的一种高效隔离的复制，蕴含三层含义：同质、高效和资源受控。
同质要求ISA的同构，高效要求虚拟化消耗可忽略，资源受控要求中间层对物理资源的完全控制。
Hypervisor必须符合上述要求，而模拟器更侧重的是仿真效果，对性能效率通常没有硬性要求。

从每个虚拟机的角度，它们的物理内存是连续的。
实际它们并不拥有实际的物理内存，只是假象。
从物理机的角度，分属各虚拟机的内存页是
不连续的，间隔零散的。

Hypervisor基于页表扩展等机制建立和维护二者之间的对应关系。

### h_1_0实验目标和需要解决的问题

最简Hypervisor执行流程：
1. 加载Guest OS内核Image到新建地址空间。
2. 准备虚拟机环境，设置特殊上下文。
3. 结合特殊上下文和指令sret切换到V模式，即VM-ENTRY。
4. OS内核只有一条指令，调用sbi-call的关机操作。
5. 在虚拟机中，sbi-call超出V模式权限，导致VM-EXIT退出虚拟机，切换回Hypervisor。
6. Hypervisor响应VM-EXIT的函数检查退出原因和参数，进行处理，由于是请求关机，清理虚拟机后，退出。

Riscv64在特权级模式的H扩展

特权级从三个扩展到五个，新增了与Host平行的Guest域

原来的S增强了对虚拟化支持的特性后，称它为HS。
M/HS/U形成Host域，用来运行I型Hypervisor或者II型的HostOS，三个特权级的作用不变。
VS/VU形成Guest域，用来运行GuestOS，这两个特权级分别对应内核态和用户态。
HS是关键，作为联通真实世界和虚拟世界的通道。体系结构设计了双向变迁机制。

H扩展后，S模式发送明显变化：原有s\[xxx]寄存器组作用不变，新增hs\[xxx]和vs\[xxx]
hs\[xxx]寄存器组的作用：面向Guest进行路径控制，例如异常/中断委托等
vs\[xxx]寄存器组的作用：直接操纵Guest域中的VS，为其准备或设置状态

为进入虚拟化模式准备的条件
ISA寄存器misa第7位代表Hypervisor扩展的启用/禁止。
对这一位写入0，可以禁止H扩展。

进入V模式路径的控制：hstatus第7位SPV记录上一次进入HS特权级前的模式，1代表来自虚拟化模式。
执行sret时，根据SPV决定是返回用户态，还是返回虚拟化模式。

SPV指示特权级模式的来源；
SPVP指示HS对V模式下地址空间是否有操作权限，1表示有权限操作，0无权限。

Hypervisor首次启动Guest的内核之前，伪造上下文作准备：
设置Guest的sstatus，让其初始特权级为Supervisor；
设置Guest的sepc为OS启动入口地址VM_ENTRY，VM_ENTRY值就是内核启动的入口地址，
对于Riscv64，其地址是0x8020_0000。

每个vCPU维护一组上下文状态，分别对应Host和Guest。
从Hypervisor切断到虚拟机时，暂存Host中部分可能被破坏的状态；加载Guest状态；
然后执行sret完成切换。封装该过程的专门函数run_guest。

执行上页从Host到Guest的逆过程，具体机制包含在run_guest之中。

[simple_hv]: 实现最简单的Hypervisor，响应VM_EXIT常见情况。
准备：（如果看不到exercises/simple_hv或skernel2，回到main分支执行git pull 更新工程）
执行如下三行，触发错误，分析原因。
make payload
./update_disk.sh payload/skernel2/skernel2
make run A=exercises/simple_hv/ BLK=y

要求：根据panic指示修改实现，使测例通过。预期输出：

提示：需要处理两个VM-Exit原因，可以对照查看payload/skernel2/中Guest OS内核的实现。注意sepc寄存器可能需要调整偏移，否则会异常卡死；另外a0和a1应当分别在处理Exit原因时设置。
