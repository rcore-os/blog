---
title: 20260621-jk-embassy_preempt移植与FFIFuture实现
date: 2026-06-20 23:44:45
categories:
    - OSTraining
tags:
    - author:SwedishDoveCooker
    - repo:embassy_preempt
    - 2026S
    - AsyncOS
    - embassy_preempt
    - async-ffi
---

我参加的 "基于协程异步机制的操作系统/驱动" 项目分为 3 个阶段, 在一阶段, 我主要阅读了 tokio-tutorial, 了解了 Rust 中的异步编程常见结构和异步执行方式, 产出了一个爬虫程序, 该爬虫主要对 进程, 线程, 协程 三种实现的并发程序进行相互比较, 进一步让我理解了协程的作用以及和进程/线程的区别。

在第二阶段, 我主要阅读了 embassy 的源码和文档, embassy 有点类似于 tokio, 区别是 embassy 是一个运行在嵌入式裸机上的异步运行时, 而 tokio 则大量使用了标准库(即操作系统)提供的一些方法。我的产出是对 mini-tokio - 一个 tokio-tutorial 里教学用的最小化异步运行时进行了优先级支持, 即每个任务拥有各自的优先级, 优先级高的任务在调度时会被优先执行。

来到了第三阶段, 我主要阅读了 embassy_preempt 的源码, 了解其执行流。 embassy_preempt 实现了协程之间的抢占, 即在定时器发出中断后保存其上下文并切换任务, 由于抢占这件事在现实中发生的次数一般较少, 我们认为这样操作带来的性能损失是可以接受的; 同时, 这也在某种程度上实现了进程和协程的统一: 协程在被抢占时退化为线程, 在再次执行并让权时自然的恢复为协程。我主要的贡献为将 embassy_preempt 从 stm32f401re 移植到 stm32f103c8 开发板上, 并为 embassy_preempt 实现了 Future 的 FFI 化, 即我们可以在手动构造一个 Future 并通过 FFI 传给 embassy_preempt 执行, 给异步任务的构造提供了新的选择。

---

在从 stm32f401re 到 stm32f103c8 的移植过程中, 我主要做了以下改动:

F103C8 仅有 20KB SRAM 和 64KB Flash,而 F401RE 拥有 96KB SRAM 和 512KB Flash。

```
MEMORY
{
RAM (xrw)      : ORIGIN = 0x20000000, LENGTH = 20K
FLASH (rx)      : ORIGIN = 0x8000000, LENGTH = 64K
}
```

`OS_ARENA_SIZE` 定义任务控制块分配器的容量。F401 设置为 10240 字节,可容纳约 80 个任务;F103 的 20KB 总 RAM 使其必须缩小至 4096 字节(约 30 个任务)。`APB_HZ` 是定时器的输入时钟频率。STM32F103 的最高系统时钟为 72MHz(F401 为 84MHz),该值直接用于计算 TIM3 的预分频器: `psc = APB_HZ / TICK_HZ - 1`。

```rust
#[cfg(feature = "stm32f401re")]
pub const OS_ARENA_SIZE: USIZE = 10240;
#[cfg(feature = "stm32f103c8")]
pub const OS_ARENA_SIZE: USIZE = 4096;

#[cfg(feature = "stm32f401re")]
pub const APB_HZ: INT64U = 84000000;
#[cfg(feature = "stm32f103c8")]
pub const APB_HZ: INT64U = 72000000;
```

```rust
#[cfg(feature = "stm32f103c8")]
pub const STACK_START: *mut u8 = 0x20001400 as *mut u8;
#[cfg(feature = "stm32f103c8")]
pub const STACK_SIZE: usize = 6 * 1024;

#[cfg(feature = "stm32f103c8")]
pub const PROGRAM_STACK_SIZE: usize = 1024;
#[cfg(feature = "stm32f103c8")]
pub const INTERRUPT_STACK_SIZE: usize = 1024;

#[cfg(feature = "stm32f103c8")]
pub const HEAP_START: *mut u8 = 0x20002C00 as *mut u8;
#[cfg(feature = "stm32f103c8")]
pub const HEAP_SIZE: usize = 2 * 1024;
```

一开始我编译运行后 BSS 段实际占用 0x20000038-0x200011EC(约 4.5KB), 而 STACK_START 设于 0x20001000,正处于 BSS 范围内。`init_stack_allocator()` 初始化时通过 `FixedSizeBlockAllocator` 在 0x20001000 处建立链表元数据, 随后 `__aeabi_memclr8` 运行 BSS 清零,将已分配的元数据结构覆盖为全零, 导致后续 `alloc_stack()` 返回空指针或访问损坏的链表, 触发 BusFault → HardFault。移至 0x20001400 后解决。

`STACK_SIZE` 影响系统可支持的最大并发抢占数, PROGRAM_STACK(1KB) + INTERRUPT_STACK(1KB) 固定消耗 2KB, 剩余 (STACK_SIZE - 2KB) / TASK_STACK_SIZE 为最大同时被抢占的任务数。以 6KB 栈池和 1KB 每任务计算,可支持 4 个任务同时处于被抢占状态。preempt_test 需要 3 个抢占栈,最初的 4KB 设置仅余 2KB(2 个栈), 在分配第 3 个时栈池返回空指针导致 panic, 需扩容至 6KB。

HEAP_START 和 HEAP_SIZE 需紧随 STACK 末尾,避免中间产生间隙浪费 SRAM。2KB 足以满足 `lazy_static` 和 arena 之外的零星 `alloc` 需求。

F103 与 F401 的 RCC 外设属于完全不同的两代设计, F401 将 PLL 配置置于独立寄存器 `RCC.pllcfgr()`,包含 PLLM/PLLN/PLLP/PLLQ 四个分频系数,源自 F4 系列为 USB/SDIO/I2S 等多种外设提供独立时钟的需求。F103 的 PLL 参数直接集成在 `RCC.cfgr()` 中,仅有一个倍频系数 `PLLMUL`, 因为 F1 系列只需为 CPU 和简单外设提供时钟。此外 F401 拥有 PLLI2S 和 PLLSAI 且需在启动时显式禁用, F103 则完全没有这些外设。Flash 等待周期也不同: F401 使用 `set_prften()` 使能预取缓冲, F103 对应方法名为 `set_prftbe()`。

TIM3 定时器在两种芯片上使用了相同的 `timer_v1.rs` PAC 模块和 `TIM_GP16` 类型,因此 `enable_Timer()` 及所有定时器操作代码无需修改。

```rust
#[cfg(feature = "stm32f103c8")]
fn rcc_init() {
    use stm32_metapac::rcc::vals::{Pllmul, Pllsrc, Pllxtpre};

    // 启用 HSE (8MHz 外部晶振)
    RCC.cr().modify(|v| { v.set_hseon(true); });
    while !RCC.cr().read().hserdy() {}

    // 配置 PLL, 源=HSE, 倍频=9 -> 72MHz
    RCC.cfgr().modify(|v| {
        v.set_pllsrc(Pllsrc::HSE_DIV_PREDIV);
        v.set_pllxtpre(Pllxtpre::DIV1);
        v.set_pllmul(Pllmul::MUL9);
    });

    // 设置 Flash 等待周期, 72MHz 需要 2 个等待周期
    FLASH.acr().modify(|v| {
        v.set_latency(Latency::WS2);
        v.set_prftbe(true);
    });

    // 启用 PLL
    RCC.cr().modify(|v| { v.set_pllon(true); });
    while !RCC.cr().read().pllrdy() {}

    // 配置总线分频, AHB=72MHz, APB1=36MHz, APB2=72MHz
    RCC.cfgr().modify(|v| {
        v.set_hpre(Hpre::DIV1);
        v.set_ppre1(Ppre::DIV2);
        v.set_ppre2(Ppre::DIV1);
    });

    // 切换系统时钟到 PLL
    RCC.cfgr().modify(|v| v.set_sw(Sw::PLL1_P));
    while RCC.cfgr().read().sws() != Sw::PLL1_P {}
}
```

F401 和 F103 的 GPIO 是两代完全不同的外设设计。F401 使用 4 个独立寄存器分别配置每个引脚的模式 MODER、输出类型 OTYPER、速度 OSPEEDR和上下拉 PUPDR, 每个寄存器为 16 个引脚各分配 2 位。F103 将所有配置压缩在 CRL/CRH 两个寄存器中: 每个引脚占 4 位, 低 2 位为 MODE(输入/2MHz/10MHz/50MHz), 高 2 位为 CNF(推挽/开漏/复用功能)。CRL 管理引脚 0-7, CRH 管理引脚 8-15。

此外, 时钟总线也不同: F401 的 GPIO 挂在 AHB1 总线上(`RCC.ahb1enr()`), F103 的 GPIO 挂在 APB2 上(`RCC.apb2enr()`)。

F103 实现使用 `core::ptr::write_volatile` 直接操作硬件地址而非 PAC 抽象, 原因之一是调试 LED 问题时需要绕过 PAC 逐层验证寄存器写入是否生效, 二是在两个芯片的 PAC 类型系统不兼容的情况下, 直接内存访问反而更清晰。

LED 极性也值得注意: Blue Pill 板载 LED 连接 PC13 且为低电平有效(输出 LOW=灯亮,HIGH=灯灭)。Embassy 官方 blinky 示例使用 `Output::new(p.PC13, Level::High, Speed::Low)` 将初始电平设为 HIGH(灯灭),与我们的 `LED_OFF()` 逻辑一致。

```rust
// F401
#[cfg(feature = "stm32f401re")]
pub fn LED_Init() {
    RCC.ahb1enr().modify(|v| v.set_gpioaen(true));      // AHB1 总线
    GPIOA.moder().modify(|v| v.set_moder(5, vals::Moder::OUTPUT));
    GPIOA.otyper().modify(|v| v.set_ot(5, vals::Ot::PUSHPULL));
    GPIOA.ospeedr().modify(|v| v.set_ospeedr(5, vals::Ospeedr::HIGHSPEED));
    GPIOA.pupdr().modify(|v| v.set_pupdr(5, vals::Pupdr::FLOATING));
}

// F103
#[cfg(feature = "stm32f103c8")]
pub fn LED_Init() {
    unsafe {
        // GPIO 时钟在 APB2 上(F401 在 AHB1)
        let r = core::ptr::read_volatile(0x40021018 as *const u32);
        core::ptr::write_volatile(0x40021018 as *mut u32, r | (1 << 4));
        asm!("dsb"); asm!("isb");

        // F103 使用 CRH 寄存器,每 4 位编码一个引脚的全部属性
        let crh = core::ptr::read_volatile(0x40011004 as *const u32);
        core::ptr::write_volatile(0x40011004 as *mut u32,
            (crh & !(0xF << 20)) | (0x2 << 20));
        // bits[23:20] = 0b0010 → CNF=00(推挽), MODE=10(2MHz)
    }
}
```

`bottom_driver` 模块是一个按键中断驱动,用于测试外部中断触发的任务抢占。它操作 F401 的 `SYSCFG` 外设来选择 EXTI 线的映射引脚。F103 没有 SYSCFG 外设,替代方案是 `AFIO`(Alternate Function I/O), 但两者寄存器布局、字段名称、使能位全部不同。该驱动不是 RTOS 核心调度功能的前提——任务的创建、定时器、优先级调度、PendSV 上下文切换均不依赖它, 因此直接对 F103 禁用。测试中使用 `bottom_driver` 的 bin(如 `bottom_test`, `time_performance` 等)在 F103 上无法编译, 这是预期行为。

```rust
// port/mod.rs
#[cfg(feature = "stm32f401re")]
pub mod bottom_driver;   // F401-only,使用 SYSCFG 外设

// os_core.rs
#[cfg(feature = "stm32f401re")]
use bottom_driver::BOT_DRIVER;

#[cfg(feature = "stm32f401re")]
BOT_DRIVER.init();
```

---

而对于第二个任务, 一个 `dyn Trait` 显然无法通过 FFI 传递, 需要做以下修改: 

`FfiWaker` 用 C 函数指针作为 `vtable`,把 Rust 的 `Waker` 包装成 C 可以克隆/唤醒/销毁的指针。`FfiContext` 把这个指针重新包装回 `Rust` 的 `Context`,让 C 侧能通过它唤醒任务。

标准库的 `Poll` 没有 #[repr(C)],不能跨 FFI 边界传递。所以我们需要另一个 `Poll`
``` rust
#[repr(C, u8)]
pub enum FfiPoll<T> {
    Ready(T),
    Pending,
}
```

C 侧的对应类型
``` c
typedef struct {
    uint8_t _tag;      // 0=Ready, 1=Pending
    uint8_t _pad[3];   // 对齐到 4 字节
    uint32_t value;    // 仅 Ready 时有效
} FfiPoll_u32;
```

内存布局
```
Ready(42):   00 00 00 00  2a 00 00 00
             ^tag=0       ^value=42
             
Pending:     01 00 00 00  00 00 00 00
             ^tag=1       ^未使用
```

同时, 我们将 `Waker` 视为一个不透明的结构体提供给 C, 我在 Task2 里面描述过 `Waker` 的内部结构(https://gitlab.eduxiji.net/T2026106149910763/project3136859-388282/-/blob/task2/docs/waker.md), 这里不再赘述。

``` rust
#[repr(C)]
struct FfiWakerBase {
    vtable: *const FfiWakerVTable,  // 指向函数指针表
}

#[repr(C)]
struct FfiWaker {
    base: FfiWakerBase,
    waker: ManuallyDrop<Waker>,
}

#[repr(C)]
struct FfiWakerVTable {
    clone:       unsafe extern "C" fn(*const FfiWakerBase) -> *const FfiWakerBase,
    wake:        unsafe extern "C" fn(*const FfiWakerBase),
    wake_by_ref: unsafe extern "C" fn(*const FfiWakerBase),
    drop:        unsafe extern "C" fn(*const FfiWakerBase),
}
```

``` rust
static REF_VTABLE: FfiWakerVTable = {
    unsafe extern "C" fn clone(data) -> *const FfiWakerBase {
        // C 调 clone → 分配新的 FfiWaker (Owned)
        let cloned = Waker::clone(&(*w).waker);  // 从原始 Waker clone
        Box::into_raw(Box::new(FfiWaker {
            base: FfiWakerBase { vtable: &OWNED_VTABLE },  // 新的 vtable!
            waker: ManuallyDrop::new(cloned),
        }))
    }

    unsafe extern "C" fn wake(data) { unreachable!(); }
    //     ↑ wake 不应该被调用——FfiWaker 是借来的,
    //       不拥有 Waker, 不能消费它

    unsafe extern "C" fn wake_by_ref(data) {
        w.waker.wake_by_ref();  // 委托给 Rust Waker
    }

    unsafe extern "C" fn drop(data) { unreachable!(); }
    //     ↑ drop 也不允许——借来的不能释放

    FfiWakerVTable { clone, wake: unreachable, wake_by_ref, drop: unreachable }
};
```

C 端不能 `wake()` 或 `drop()`。这两个操作会消费所有权,但 `borrowed waker` 没有所有权。

``` rust
static OWNED_VTABLE: FfiWakerVTable = {
    unsafe extern "C" fn clone(data) -> *const FfiWakerBase {
        let cloned = Waker::clone(&(*w).waker);
        Box::into_raw(Box::new(FfiWaker { /* ... */ }))
    }

    unsafe extern "C" fn wake(data) {
        let b = Box::from_raw(data as *mut FfiWaker);
        ManuallyDrop::into_inner(b.waker).wake();  // 消费 Waker
        // b 被 drop, FfiWaker 内存释放
    }

    unsafe extern "C" fn drop(data) {
        let mut b = Box::from_raw(data as *mut FfiWaker);
        ManuallyDrop::drop(&mut b.waker);  // 安静释放, 不唤醒
        // b 被 drop, FfiWaker 内存释放
    }

    FfiWakerVTable { clone, wake, wake_by_ref, drop }
};
```

C 端通过 `clone()` 得到的 `waker` 是完全拥有的, 可以 `wake()`、`drop()`、或 `clone()`。

`Waker` 的上层 `Context` 同样需要处理。

``` rust
#[repr(C)]
pub struct FfiContext<'a> {
    task: OS_TCB_REF,               // TCB 指针，用于 ffi_task_delay
    waker: *const FfiWakerBase,     // waker 引用，用于 ffi_wake_by_ref
    _marker: PhantomData<&'a FfiWakerBase>,
}

```

C 的 `poll` 函数接收 `*mut FfiContext`,通过 `with_context()` 方法获取标准 `&mut Context`

``` rust
pub fn with_context<T>(&mut self, f: impl FnOnce(&mut Context) -> T) -> T {
    // RUST_VTABLE: 把 FfiWaker 包装成 RawWaker
    static RUST_VTABLE: RawWakerVTable = {
        // clone → 调用 C vtable 的 clone
        // wake  → 调用 C vtable 的 wake
        // wake_by_ref → 调用 C vtable 的 wake_by_ref
        // drop → 调用 C vtable 的 drop
    };

    let raw = RawWaker::new(self.waker.cast(), &RUST_VTABLE);
    let waker = unsafe { Waker::from_raw(raw) };
    let waker = ManuallyDrop::new(waker);

    let mut cx = Context::from_waker(&waker);
    f(&mut cx)
}
```

`Future` 同理

``` rust
#[repr(C)]
pub struct FfiFuture<T> {
    pub fut_ptr: *mut (),
    pub poll_fn: unsafe extern "C" fn(*mut (), *mut FfiContext) -> FfiPoll<T>,
    pub drop_fn: unsafe extern "C" fn(*mut ()),
}


impl<T> Future for FfiFuture<T> {
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<T> {
        let task_ref = executor::task_from_waker(cx.waker());  // 获取 TCB
        let rust_waker = cx.waker().clone();
        let ffi_waker = ManuallyDrop::new(FfiWaker {           // 包装 waker
            base: FfiWakerBase { vtable: &REF_VTABLE },
            waker: ManuallyDrop::new(rust_waker),
        });
        let mut ffi_ctx = FfiContext::new(task_ref, &*ffi_waker);
        let ret = (self.poll_fn)(self.fut_ptr, &mut ffi_ctx);  // 调用 C
        Poll::from(ret)
    }
}
```

与 `async-ffi` 的主要区别是, `async-ffi` 基于 `std` 环境, 做了一些额外的包装, 包括捕获 `unwind panic` 等问题。我在嵌入式领域做了相应的改造, 去除了一些不必要的功能, 同时可以与 `no-std` 环境适配。

---

训练营到这里就结束了, 我接下来的想法是继续沿着 "同步与异步统一" 这个问题继续走下去, 先前的 FFIFuture 也是我在这个问题上的初步尝试, 最终形成成果。