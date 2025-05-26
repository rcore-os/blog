---
title: 2024A-stage2-rCore-Martin1847
date: 2024-11-09 13:52:11
tags:
    - author:martin1847
    - repo:https://github.com/LearningOS/2024a-rcore-martin1847/
---

## rCore 总结

这个阶段大约花了3周左右的时间，更多是对`OS概念抽象`和`risc-v`CPU架构的一些了解。跟rust的关系在我看来不算特别大。
核心的找地址、上下文切换都是c-like/asm实现的，当然这部分代码占比很小很小。这里面内存frame等等几个地方，充分利用了`RAII`机制，
大大减少了内存释放的心智负担，感觉是rust语言优于传统C的典型佐证。

这个阶段花时间较久是在`ch8银行家/死锁检测`算法上，因为概念的不熟悉，套用模型产生的死胡同。一直没有找到各个线程对于初始化资源的需求表，所以也就套不进银行家。中间放弃准备用循环图检测，发现不支持数量（权重）。最后看了一下向勇老师的在线课《[操作系统-20.4 死锁检测](https://www.xuetangx.com/learn/THU08091000267/THU08091000267/12424484/video/23273353)》，找到了灵感，按照这个思路写算法，大概又花了几个小时调试通过。

下面按照实验内容分章节进行总结。

<!-- more -->

## ch1和ch2热身

熟悉了BIOS裸机启动，以及`RustSBI`这种先进的设计，比如提供了`console_putchar`这种高级功能，便于调试。

剩下是risc-v的特权指令设计，通过`ecall`进行trap中断。

最后是`linker`相关，如何把数据打包成文件，以及对应的内存地址分配。

这样一个裸机的“内核程序”也就运行起来了。
总体就是约定好，BIOS启动后，约定一个内存地址，那里放着你的第一行代码，交接给应用程序去执行了。
然后通过`entry.asm`进行栈的分配和地址标记，就可以引导到我们的`rust_main`开始执行了。

### QEMU模拟器启动流程

`virt`平台上，物理内存的起始物理地址为 `0x80000000` ，物理内存的默认大小为 `128MiB`
最低的 8MiB 物理内存，对应的物理地址区间为 `[0x80000000,0x80800000)`
两个文件将被加载到 Qemu 的物理内存
* 0x80000000 rustsbi-qemu.bin
* 0x80200000 我们的内核镜像 os.bin
  
Qemu 模拟的启动流程则可以分为三个阶段：
* 第一个阶段由固化在 Qemu 内的一小段汇编程序负责；
Qemu CPU 的程序计数器`（PC, Program Counter）`会被初始化为 `0x1000` ，因此 Qemu 实际执行的第一条指令位于物理地址 0x1000 ，接下来它将执行寥寥数条指令并跳转到物理地址 0x80000000 对应的指令处并进入第二阶段（被固化在 Qemu 中，作为 Qemu 的使用者，我们在不触及 Qemu 源代码的情况下无法进行更改）
* 第二个阶段由 bootloader 负责；这里 `RustSBI` 则是将下一阶段的入口地址预先约定为固定的 `0x80200000`
* 第三个阶段则由内核镜像负责。需要保证内核的第一条指令位于物理地址 0x80200000 处


`Qemu不支持动态链接`，所以内核都是采用静态链接的方式进行编译。


## ch3 多道程序与分时多任务

这一章主要是熟悉了`TrapContext`的处理。加深了上下文切换的成本理解。



1. 特权级切换的核心是对`Trap的管理`。`Trap三步走`：

* 应用程序通过 ecall 进入到内核状态时，操作系统保存被打断的应用程序的 Trap 上下文；
* 操作系统根据Trap相关的`CSR寄存器`(原子指令)内容，完成系统调用服务的分发与处理；
* 操作系统完成系统调用服务后，需要恢复被打断的应用程序的Trap 上下文，并通 sret 让应用程序继续执行。


核心流程`trap.S`,三步：

`__alltraps` --> call `trap_handler`(RUST) -> `__restore`

* trap_handler(cx: &mut TrapContext) -> &mut TrapContext
* 我们只用处理rust实现的trap_handler，接受一个`用户上下文`,返回一个修改过的`用户TrapContext`，继续下一行`sepc += 4`还是中断
* `__restore`基本是`__alltraps`的反操作，基本是一个入栈，一个出栈，从内核切回`用户TrapContext`
* `__restore`还可以用来执行用户程序、返回到用户程序


```s
(lldb) breakpoint set -n __alltraps
Breakpoint 1: where = os`__alltraps, address = 0x00000000802009e4
(lldb) c
* thread #1, stop reason = instruction step into
    frame #0: 0x0000000080200a38 os`__alltraps + 84
os`__alltraps:
# 小细节： call trap_handler 伪指令被翻译了
->  0x80200a38 <+84>: auipc  ra, 0
    0x80200a3c <+88>: jalr   1074(ra)

os`__restore:
    0x80200a40 <+0>:  mv     sp, a0
    0x80200a42 <+2>:  ld     t0, 256(sp)
```

* `auipc` 是 "Add Upper Immediate to PC" 的缩写。
它将一个 20 位的立即数加到当前程序计数器（PC）的高 20 位，并将结果存储在目标寄存器中。
这个指令通常用于生成一个高 20 位的地址偏移。
* `jalr` 是 "Jump and Link Register" 的缩写
它将目标寄存器的值加上一个 12 位的立即数，并将结果作为新的 PC 值，同时将当前 PC 值加 4 存储到 ra 寄存器（返回地址寄存器）
* `auipc 和 jalr 的组合`可以处理 32 位的地址偏移。auipc 处理高 20 位，jalr 处理低 12 位。
这样可以在 32 位地址空间内进行任意地址的跳转。
使用 auipc 和 jalr 的组合可以灵活地处理不同范围的地址偏移，而不需要额外的指令。

```s
# trap_handler 内容
(lldb) breakpoint  set -n trap_handler
Breakpoint 2: where = os`trap_handler + 12 [inlined] riscv::register::scause::_read::ha581f993b7a8d8e3 at macros.rs:10:21, address = 0x0000000080200e76
(lldb) c
Process 1 resuming
Process 1 stopped
* thread #1, stop reason = breakpoint 2.1
    frame #0: 0x0000000080200e76 os`trap_handler [inlined] riscv::register::scause::_read::ha581f993b7a8d8e3 at macros.rs:10:21
   7                    #[cfg(riscv)]
   8                    () => {
   9                        let r: usize;
-> 10                       core::arch::asm!(concat!("csrrs {0}, ", stringify!($csr_number), ", x0"), out(reg) r);
   11                       r
   12         
    frame #0: 0x0000000080200e7a os`trap_handler(userCtx=<unavailable>) at mod.rs:73:17
   70   #[no_mangle]
   71   pub fn trap_handler(userCtx: &mut TrapContext) -> &mut TrapContext { 
   72       let scause = scause::read();
-> 73       let stval = stval::read();
```


```rust
//执行用户程序
// 在内核栈上压入一个 Trap 上下文，
// 其 sepc 是应用程序入口地址 0x80400000 
// 其 sp 寄存器指向用户栈
// 其 sstatus 的 SPP 字段被设置为 User
// `mv sp, a0` 切换到栈顶执行，作为第一个参数
// batch.rs/run_next_app
unsafe {
    __restore(KERNEL_STACK.push_context(
        TrapContext::app_init_context(APP_BASE_ADDRESS, USER_STACK.get_sp())
    ) as *const _ as usize);
}
```

重要的中转寄存器： 而 `sscratch CSR` 正是为此而生。
在特权级切换的时候，我们需要将 Trap 上下文保存在内核栈上，因此需要一个寄存器暂存内核栈地址，并以它作为基地址指针来依次保存 Trap 上下文的内容。但是所有的通用寄存器都不能够用作基地址指针，因为它们都需要被保存，如果覆盖掉它们，就会影响后续应用控制流的执行。
从上面的汇编代码中可以看出，在保存 Trap 上下文的时候，它起到了两个作用：首先是保存了内核栈的地址，其次它可作为一个中转站让 sp （目前指向的用户栈的地址）的值可以暂时保存在 sscratch 。这样仅需一条 csrrw  sp, sscratch, sp 指令（交换对 sp 和 sscratch 两个寄存器内容）就完成了从用户栈到内核栈的切换，这是一种极其精巧的实现。

sscratch：
“scratch” 通常指的是临时存储空间。这个术语来源于早期的计算机设计。现在一般用`Temporary`。
字面意思是“划痕”或“刮痕”，当你需要快速记下一些信息，但又不需要长期保存时，你就会用到草稿纸，做些临时标记，这就是`scratch`。

2. 切换/执行用户程序

此时 CPU 运行在 S 特权级，而它希望能够切换到 U 特权级
* 构造应用程序开始执行所需的 Trap 上下文；
* 通过 __restore 函数，从刚构造的 Trap 上下文中，恢复应用程序执行的部分寄存器；
* 设置 sepc CSR的内容为应用程序入口点 `0x80400000`；
* 切换 scratch 和 sp 寄存器，设置 sp 指向应用程序用户栈；
* 执行 sret 从 S 特权级切换到 U 特权级。


3. 操作系统怎么进入 S 态的?
和内核第一次进入用户态类似，在M态的RustSBI中初始化完毕后，将`mstatus.mpp设置为S态`，mepc设置为内核入口地址最后通过一条`mret`特权指令让CPU在S模式下执行内核代码。

## ch4 地址空间/虚拟内存/sv39页表

不论是从安全还是易用角度，虚拟地址应运而生。

操作系统要达到`地址空间抽象`(Address Space)的设计目标，需要有计算机硬件的支持，这就是计算机组成原理课上讲到的 `MMU 和 TLB` 等硬件机制。
应用能够直接看到并访问的内存就只有操作系统提供的地址空间，且它的任何一次访存使用的地址都是`虚拟地址`，无论`取指令来执行`还是`读写栈`、`堆`或是`全局数据段`都是如此。
开启分页模式后，比较有意思的是`trampoline`跳板区的处理.

上下文处理的变化：

```s
# 1. trap.S ,都放到了trampoline区域
    .section .text.trampoline
    .globl __alltraps
    .globl __restore
    .align 2

## 2. linker.ld ,调整内存布局
    . = BASE_ADDRESS;
    skernel = .;

    stext = .;
    .text : {
        *(.text.entry)
        . = ALIGN(4K);
        strampoline = .; # 对齐到代码段的一个页面中4K
        # 这段汇编代码放在一个物理页帧中，且 __alltraps 恰好位于这个物理页帧的开头
        *(.text.trampoline);
        . = ALIGN(4K);
        *(.text .text.*)
    }
```

> trampoline：蹦床（trampoline）上下弹跳，词根“tramp”意为踏或踩，结合“line”可以联想到弹跳的轨迹。
> 它类似于蹦床的作用，将控制流“弹跳”到另一个位置。

__restore 也要先处理地址空间
* a0 不变，第一个是 Trap 上下文在应用地址空间中的位置，这个对于所有的应用来说都是相同的；
* a1 第二个则是即将回到的应用的地址空间的 token ，在 a1 寄存器中传递。
```s
__restore:
    # a0: *TrapContext in user space(Constant); a1: user space token
    # switch to user space，注：Trap 上下文是保存在应用地址空间中，UserTrapCtx
    csrw satp, a1
    sfence.vma
    csrw sscratch, a0 # 将传入的 Trap 上下文位置保存在 sscratch 寄存器中
    mv sp, a0 # 将 sp 修改为 Trap 上下文的位置,最高的虚拟页面都是一个跳板，即trampoline的sp，也在用户态，后面基于它恢复各通用寄存器和 CSR
    # now sp points to TrapContext in user space, start restoring based on it
    # restore sstatus/sepc
    ld t0, 32*8(sp)
    ld t1, 33*8(sp)
    # back to user stack，跳板页的sp用完了，恢复x2寄存器，真正的用户态sp
    ld sp, 2*8(sp)
```

在开启分页模式之后，内核和应用代码都只能看到各自的虚拟地址空间，而在它们的视角中，这段汇编代码都被放在它们各自地址空间的最高虚拟页面上，由于这段汇编代码在执行的时候涉及到地址空间切换，故而被称为跳板页面。各有一份。

在产生trap前后的一小段时间内会有一个比较 极端 的情况，即刚产生trap时，CPU已经进入了内核态（即Supervisor Mode），但此时执行代码和访问数据还是在应用程序所处的用户态虚拟地址空间中，而不是我们通常理解的内核虚拟地址空间。在这段特殊的时间内，CPU指令为什么能够被连续执行呢？这里需要注意：`无论是内核还是应用的地址空间，跳板的虚拟页均位于同样位置`，且它们也将会`映射到同一个实际存放这段汇编代码的物理页帧`。也就是说，在执行 __alltraps 或 __restore 函数进行地址空间切换的时候，应用的用户态虚拟地址空间和操作系统内核的内核态虚拟地址空间对切换地址空间的指令所在页的映射方式均是相同的，这就说明了这段切换地址空间的指令控制流仍是可以连续执行的。

简单来说，这个时刻：
`用户态虚拟地址` = `os虚拟地址` = `映射的同一块物理内存地址`


## ch5 进程及进程管理

这里增加了一个`TaskContext`的概念。
为了支持抢占式（防止个别应用霸占CPU），开启了定时器中断。

```rust
//  通过将 mie 寄存器的 STIE 位（第 5 位）设为 1 开启了内核态的时钟中断。
// core::arch::asm!("csrrs x0, {1}, {0}",in(reg)bits,const 0x104), 
//  _set((1<<5));CSR 寄存器 0x104： RISC-V 架构中的 stimecmp 寄存器。这个寄存器用于设置下一个定时器中断的时间点。当系统时钟达到或超过 stimecmp 寄存器中的值时，会触发一个定时器中断。
// sie::set_stimer()
trap::enable_timer_interrupt();
// 定时器在操作系统中非常重要，用于实现时间片轮转调度、定时任务、超时处理等功能。
timer::set_next_trigger();

pub fn set_next_trigger() {
// CLOCK_FREQ 是系统的时钟频率，表示每秒钟的时钟周期数。
// TICKS_PER_SEC 是每秒钟希望触发的定时器中断次数。
// TIMEBASE = CLOCK_FREQ / TICKS_PER_SEC 计算出每个定时器中断之间的时间间隔（以时钟周期数为单位）。
// get_time() + CLOCK_FREQ / TICKS_PER_SEC 计算出下一个定时器中断的时间点。
// 调用 SBI 的 SBI_SET_TIMER 服务
// set_next_trigger 能够精确地设置下一个定时器中断的时间点，从而实现高效的时间管理。
// TIMEBASE 便是时间间隔，其数值一般约为 cpu 频率的 1% ，防止时钟中断占用过多的 cpu 资源。
// 这里TICKS_PER_SEC也是按照这个策略，100
    set_timer(get_time() + CLOCK_FREQ / TICKS_PER_SEC);
}
```

任务上下文，相比Trap上下文，有几个变化：

任务、调度切(特殊 __switch 函数): 任务上下文 (Task Context)

* 不涉及特权级切换
* 一部分是由编译器帮忙完成
* 对应用透明
* 两个不同应用在内核中的 Trap 控制流之间的切换
* `__switch` 函数和一个普通的函数之间的核心差别仅仅是它会`换栈`
* 保存 CPU 当前的某些寄存器

```rust
/// task context structure containing some registers
/// TaskContext 很像一个普通函数栈帧中的内容
/// size of TaskContext/ 14byte 112 = 14*8
pub struct TaskContext {
    /// Ret position after task switching __switch返回之后应该跳转到哪里继续执行
    ra: usize,
    /// Stack pointer
    sp: usize,
    /// s0-11 register, callee saved 被调用者保存寄存器
    /// 不用保存其它寄存器是因为：其它寄存器中，属于调用者保存的寄存器是由编译器在高级语言编写的调用函数中自动生成的代码来完成保存的；还有一些寄存器属于临时寄存器，不需要保存和恢复。
    s: [usize; 12],
}

include_str!("switch.S"));
extern "C" {
    // __switch 有两个参数，第一个参数代表它自己，第二个参数则代表即将切换到的那条 Trap 控制流。
    pub fn __switch(
        current_task_cx_ptr: *mut TaskContext,
        next_task_cx_ptr: *const TaskContext);
}
```

{% asset_img ctx_task__switch.png task_switch %}


* 阶段 [1]：在 Trap 控制流 A 调用 __switch 之前，A 的内核栈上只有 Trap 上下文和 Trap 处理函数的调用栈信息，而 B 是之前被切换出去的；
* 阶段 [2]：A 在 A 任务上下文空间在里面保存 CPU 当前的寄存器快照；
* 阶段 [3]：这一步极为关键，读取 next_task_cx_ptr 指向的 B 任务上下文，根据 B 任务上下文保存的内容来恢复 ra 寄存器、s0~s11 寄存器以及 sp 寄存器。只有这一步做完后， __switch 才能做到一个函数跨两条控制流执行，即 通过换栈也就实现了控制流的切换 。
* 阶段 [4]：上一步寄存器恢复完成后，可以看到通过恢复 sp 寄存器换到了任务 B 的内核栈上，进而实现了控制流的切换。这就是为什么 __switch 能做到一个函数跨两条控制流执行。此后，当 CPU 执行 ret 汇编伪指令完成 __switch 函数返回后，任务 B 可以从调用 __switch 的位置继续向下执行。

```s
# os/src/task/switch.S

.altmacro
.macro SAVE_SN n
    sd s\n, (\n+2)*8(a0)
.endm
.macro LOAD_SN n
    ld s\n, (\n+2)*8(a1)
.endm
    .section .text
    .globl __switch
__switch:
    # 阶段 [1]
    # __switch(
    # 分别通过寄存器 a0/a1 传入
    #     current_task_cx_ptr: *mut TaskContext,
    #     next_task_cx_ptr: *const TaskContext
    # )
    # 阶段 [2] 保存当前任务的上下文 -> TaskContext
    # save kernel stack of current task
    sd sp, 8(a0)
    # save ra & s0~s11 of current execution
    sd ra, 0(a0)
    .set n, 0
    .rept 12
        SAVE_SN %n
        .set n, n + 1
    .endr
    # 阶段 [3] 根据 next_task_cx_ptr 任务上下文保存的内容来恢复上述 CPU 状态
    # restore ra & s0~s11 of next execution
    ld ra, 0(a1)
    .set n, 0
    .rept 12
        LOAD_SN %n
        .set n, n + 1
    .endr
    # restore kernel stack of next task
    ld sp, 8(a1)
    # 阶段 [4]
    ret
```

__switch 的实现除了`换栈`之外几乎就是一个普通函数。


## ch6/ch7  文件系统/进程间通信

这里是了解了文件系统的索引结构，`DiskNode`和`INode`,实现了低配版的`link/unlink/fstat`.

1. `link`： 通过在ROOT_INODE下创建新的`DirEntry`,完成文件的`linkat`。这里会增加当前`root DiskInode`的大小。
增加一个目录项`DirEntry`总共32Byte大小（长度为 27 的文件/目录名 c风格带个\0 + 4Byte的inode）。根据当前大小，计算需要多少个512B的block，
然后计算需要用到几级索引。然后如果需要新的block就从`data_bitmap`中分配新的block。找到位置后根据offset写入。

2. `unlink`， 找到对应`DirEntry`的位置，设置为empty(全0)。

3. `fstat` ,查询文件的`inode`,同时返回`link_times`,这里遍历一遍，找相同`inode`的文件名。

## ch8 多线程并发

通过类似`银行家`的算法，进行了`死锁检测`。核心逻辑是进行预分配后，看还能否找到一个合理的序列，能够让所有线程有序退出。
从第一个可以满足并退出的线程开始，模拟回收所占据的资源，继续迭代。如果都能退出，那么系统是安全的，否则可能发生了死锁。

完成本次实验大概花了四天，一开始想通过图算法查找环路来进行，没有跑通；后面开始用银行家，发现不知道初始化需求队列，这一步如何变化卡住了一段时间。后来看了一下向勇老师《[操作系统-20.4 死锁检测](https://www.xuetangx.com/learn/THU08091000267/THU08091000267/12424484/video/23273353)》，找到了灵感，按照这个思路写算法，大概又花了几个小时调试通过。


这里比较有意思的是CAS的实现， risc-v并不支持x86的`cmpxchg`,
而是使用`SC 指令`:
```s
# 参数 a0 存放内存中的值的所在地址
# 参数 a1 存放 expected
# 参数 a2 存放 new
# 返回值 a0 略有不同：这里若比较结果相同则返回 0 ，否则返回 1
# 而不是返回 CAS 之前内存中的值
cas:
    lr.w t0, (a0) # LR 将值加载到 t0
    bne t0, a1, fail # 如果值和 a1 中的 expected 不同，跳转到 fail
    sc.w t0, a2, (a0) # SC 尝试将值修改为 a2 中的 new
    bnez t0, cas # 如果 SC 的目标寄存器 t0 不为 0 ，说明 LR/SC 中间值被修改，重试
    li a0, 0 # 成功，返回值为 0
    ret # 返回
fail:
    li a0, 1 # 失败，返回值为 1
    ret # 返回
```

SC 指令是如何判断此前一段时间该内存中的值是否被修改呢？在 RISC-V 架构下，存在一个 保留集 (Reservation Set) 的概念，这也是“加载保留”这种叫法的来源。

另外就阻塞唤醒机制。

由于上下文切换的开销是很大的，除了要`保存和恢复寄存器`之外，更重要的一点是会破坏程序的`时间和空间局部性`使得我们无法高效利用 `CPU 上的各类缓存`。
* 在 Trap 的时候需要切换地址空间，有可能需要清空 TLB 
* 在应用 Trap 到内核态的时候，缓存中原本保存着用户栈的内容，在执行内核态代码的时候可能由于缓存容量不足而需要逐步替换成内核栈的内容，而在返回用户态之后又需要逐步替换回来。整个过程中的缓存命中率将会很低。
* 即使线程只是短暂停留也有可能对整体性能产生影响

阻塞与唤醒机制相配合就可以实现精确且高效的等待。阻塞机制保证在线程等待的事件到来之前，线程不会参与调度，因此不会浪费任何时间片或产生上下文切换。
> 阻塞，暂时不参与调度，OS等条件可达时再加入活跃列表

阻塞机制：
`block_current_and_run_next`跟`suspend_current_and_run_next`
的区别，仅仅是设置线程状态为 `Blocked` 以及我们此处 不会将被阻塞的线程重新加回到就绪队列中 。

唤醒机制:
将被阻塞的线程的控制块按照它们等待的具体事件或条件分类存储,简单的将线程状态修改为就绪状态 Ready 并将线程加回到就绪队列。

## 整个rCore阶段总结

不仅加深了rust语言的学习，更重要的是对OS对各个层面的抽象，加深了理解：
* CPU抽象，进程/线程/锁/时钟中断/上下文切换/特权
* 内存抽象，虚拟地址/页表/MMU，内存布局/内存权限/空洞空间（一定程度上减小溢出的危害）
* 存储抽象，文件系统，File/Trait, 对应用很友好

最后祝清华大学开源操作系统训练营越办越好！！！