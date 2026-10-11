---
title: 'Leo Cheng: LIBC 文件网络外设驱动 系统裁剪发行版 板卡级适配 以及运行时 - 穿越系统之后'
date: 2026-05-05 21:43:45
categories:
    - Leo Cheng
tags:
    - author:LeoHeco
    - repo:https://github.com/Kunik-OS/
    - stdlib
    - libc
    - baselibc
    - libcxx
    - musl
    - picolibc
    - relibc
    - uclibc-ng
    - HAL
    - polyhal
    - Filesystem
    - easyfs
    - ext2-rs
    - ext4_rs
    - fatfs
    - fuse-ext2
    - libfuse
    - linux-fs
    - littlefs
    - lwext4_rust
    - Network
    - lwip
    - rustls
    - smoltcp
    - User
    - compiler-builtins
    - Distro
    - YoctoPoky
    - openRuyi
    - openwrt
    - Rootfs
    - buildroot
    - busybox
    - syscall
    - OS API
    - ABI
---

> AI4OSE 期间，我们与 Agent 协作学习各项知识，并且 Agent 出题 讲解 以及 苏格拉底式 的阶梯式学习法。所以最后也有 Agent 自动插入笔记的问题和自己的回答，如果答案不充分，则我的作答还会有 Agent 协调补充的内容。相关提示词：如果我有疏漏，给我补充，且讲解充分后继续向我提问查缺补漏，最后一同沉淀到我们的笔记中！

<!-- more -->

内核接管硬件之后，用户程序要在它上面运行，中间还有很多层系统软件：最贴近硬件的板级适配与硬件抽象层，驱动各类设备的子系统，文件系统和网络协议栈，内核向用户态提供的系统调用，封装系统调用的 C 运行时和标准库，把源码变成机器码的编译器和即时编译，跨操作系统运行程序的兼容层，隔离整个系统的虚拟化和容器，以及把这些裁剪、打包成可发布系统的发行版构建。

下面从离硬件最近的一层开始往上，每一层都说明它是什么、为什么这样设计、源码里怎样实现，以及怎样仿写一个同类实现。系统调用一节列出 Linux 的全部系统调用及其功能和实现；标准库一节列出各 libc 实现的头文件和函数，以及 Rust 的 `core`、`alloc`、`std`。内容很细，既可以通读，也可以随时回来查。

## 板级适配与 HAL

最贴近硬件的一层是硬件抽象层（HAL）。「HAL」这个词用在两个层级上，抽象的对象完全不同：

| | OS 级 HAL（polyhal） | MCU 级 HAL trait（embedded-hal） |
|:--:|:--:|:--:|
| 抽象对象 | CPU 特权机制：MMU/页表、trap/中断、定时器、多核启动、percpu | 板上外设总线：GPIO/I2C/SPI/PWM/延时 |
| 跨什么 | 跨指令集（rv/x86/aa/la），同一份内核代码 | 跨芯片厂商的 PAC（STM32/nRF/RP2040 等），同一指令集 |
| 谁实现 | HAL crate 自己用 `cfg(target_arch)` 分文件实现 | 各芯片的 HAL crate（如 stm32f4xx-hal）实现 trait |
| 谁使用 | 内核（arceos/StarryOS 风格的 Unikernel 或宏内核） | 驱动 crate（设备驱动、传感器驱动） |
| 形式 | 一组具体的 struct 和函数 | 一组 trait（`OutputPin`/`I2c`/`SpiBus`） |
| 对应 Linux | `arch/` 加 `asm/` | `drivers/` 各子系统的 bus_type 抽象 |

polyhal 让同一份内核代码运行在 rv/x86/aa/la 四种 CPU 上，embedded-hal 让同一份驱动代码运行在多种 MCU 上。两者互不冲突，可以一起用：rv SoC 上的内核可以用 polyhal 抽象 CPU，在驱动层用 embedded-hal trait 抽象外设。

### polyhal

polyhal（Byte-OS，v0.4.0）是一个 cargo workspace，包含五个 crate：`polyhal`（核心，arch/components/pagetable/mem）、`polyhal-boot`（启动汇编 `_start`，percpu、页表、MMU 初始化，`define_entry!`）、`polyhal-trap`（trap 向量、TrapFrame、TrapType）、`polyhal-macro`（过程宏）、`example`（四种架构通用的示例内核）。

**统一的内容。** `components/mod.rs` 列出八个跨架构组件，每个用 `define_arch_mods!()` 按 `target_arch` 分文件实现：common（注入页分配器的 `PageAlloc` 和 `get_cpu_num()`）、mem（内存屏障和从 FDT 发现内存区域）、instruction（`shutdown()`、`ebreak()`）、irq（中断开关和 `IRQVector`）、kcontext（内核线程上下文 `KContext` 和 `context_switch`）、timer（`current_time()` 和 `set_next_timer`）、multicore（`boot_core` 启动从核）、percpu（每个核的私有数据）；另外还有 pagetable（统一的 MMU 操作）和 debug_console（rv 用 `sbi_rt::legacy::console_putchar`）。

**三种统一手段。** 一是 `define_arch_mods!()` 宏（`polyhal-macro/src/lib.rs:64`），对每个组件目录生成四个 `#[cfg(target_arch="…")] mod xxx; pub use xxx::*;`，编译时只编入当前架构那一份，是**编译时单态**而不是 trait object，运行时没有分发开销。二是 `pub_use_arch!`，把架构私有的符号以统一名字重新导出。三是 `cfg_if!`，在同一个函数体里按架构写不同指令（读 thread pointer：x86 `rdmsr(IA32_GS_BASE)`，rv `mv gp`，aa `mrs TPIDR_EL1`，la `move $r21`）。

**MMU 与页表**（`pagetable/mod.rs`）：对外提供 `PageTable` 和 RAII 的 `PageTableWrapper`（Drop 时 `release()` 并 `frame_dealloc`），统一操作是 `map_page`、`map_kernel`、`unmap_page`、`translate`、`release`。架构差异放在常量里：`PAGE_LEVEL`（Sv39 是 3 级，x86 是 4 级），`map_page` 用 `if Self::PAGE_LEVEL == 4` 多走一级；`pn_index(n) = (raw>>(12+9*n)) & 0x1ff` 是 rv Sv39/Sv48 通用的索引公式。`MappingFlags` 是与架构无关的语义位（P/U/R/W/X/A/D/G/Device/Cache 及组合），各架构用 `From<MappingFlags> for PTEFlags` 转换成硬件位。启动页表 `init_boot_page_table` 直接建立 1 GB 大页的恒等映射，加上带全局位的高半区映射（内核高地址 `VIRT_ADDR_START=0xffff_ffc0_0000_0000`），再写 `satp` 打开 Sv39。

**trap**（polyhal-trap）：`TrapType` 是与架构无关的语义枚举（Breakpoint、SysCall、StorePageFault、Timer 等）；用户用 `#[polyhal::arch_interrupt]` 标注一个 `fn(&mut TrapFrame, TrapType)`，宏用 `#[export_name="_interrupt_for_arch"]` 把它连接到各架构 trap 汇编的回调点，内核只写一份中断处理逻辑。`TrapFrameArgs` 用 `SEPC` 等枚举跨架构访问寄存器，`ctx.syscall_ok()` 跨架构地跳过 ecall 指令。

**启动顺序**（`ctor.rs`，BSP 启动顺序的核心）：定义七级构造函数优先级，链接段 `ph_init` 收集所有用 `ph_ctor!` 注册的初始化函数，按级别执行：主核依次执行 `Cpu`、`Platform`、`HALDriver`，（可选）启动从核，然后 `KernelService`、`Normal`，最后跳进内核。rv 的入口是 `rust_main`：`clear_bss`、`init_dtb_once`、`set_local_thread_pointer`、`init_cpu`、`ph_init_iter(Cpu)`、`parse_system_info`、`ph_init_iter(Platform/HALDriver)`、`call_real_main`。定时器就是用 `ph_ctor!(ARCH_INIT_TIMER, CtorType::Platform, init)` 加入启动顺序的，这是 BSP 三个部分中「节拍」的注册点。

**percpu**（每个核的私有数据）：`#[percpu]` 宏把静态变量放进 `percpu` 链接段，包装成 `PerCPU<T>`，运行时为每个核分配一份副本，用 `copy_nonoverlapping` 初始化，再写入架构的 thread pointer 寄存器（rv 用 `gp`，x86 通过 `gs:8` 间接访问，aa 用 `TPIDR_EL1`，la 用 `$r21`）。

**使用 polyhal**：内核用 `define_entry!` 提供入口，用 `#[arch_interrupt]` 提供中断回调，向 `common::init` 注入一个 `PageAlloc` 页分配器即可；CPU、MMU、定时器、多核都由 polyhal 按目标架构在编译时生成。用 polyhal 写内核，就是写几个与架构无关的回调，再注入一个分配器。

**没有统一的内容**（自己写 HAL 时要知道）：外设驱动都不在 polyhal 里（只有靠 SBI legacy putchar 的 `DebugConsole`，真实串口和 PCI 留给上层）；中断控制器在 rv 上是空的，`irq/riscv64.rs` 的 `irq_enable`/`irq_disable` 直接 `log::warn!("irq not implemented")`，只实现了 `int_enable=set_sie` 这种 S 态全局开关，PLIC、外部中断号管理、AIA（APLIC+IMSIC）都没有做；时钟频率 `CLOCK_FREQ=12500000` 是按 QEMU virt 写死的常量，不是运行时从 FDT 读取；大页只有 4 KB；`map_kernel` 的内核空间页表共享还标着 TODO。运行时从 FDT 发现与编译时使用板级常量（`boards/qemu.rs` 与 `boards/k210.rs`）的二选一，与 KuSBI 的两种 Platform Mode 是同一个设计思路。

### embedded-hal

embedded-hal（v1.0.0，2024 年稳定）是 Rust 嵌入式领域使用最广的 trait 集合，一个仓库包含九个 crate：`embedded-hal`（阻塞式核心 trait：delay、digital、i2c、pwm、spi）、`embedded-hal-async`（同名 trait 的 `async fn` 版本）、`embedded-hal-nb`（`nb` 的 would-block 风格）、`embedded-hal-bus`（总线共享的具体实现，唯一包含实现的 crate）、`embedded-io[-async/-adapters]`（`Read`、`Write`、`BufRead`、`Seek`，**1.0 之后 UART 串口归到这里**）、`embedded-can`。最低支持的 Rust 版本是 1.81。

**1.0 的核心 trait**（已删除 ADC 和 serial）：

- **digital**（GPIO）：`OutputPin`（`set_low`、`set_high`、`set_state(PinState)`）、`StatefulOutputPin`（`is_set_high`、`is_set_low`、`toggle`）、`InputPin`（`is_high`、`is_low`）；`PinState{Low,High}`，加上关联类型 `ErrorType` 和 `ErrorKind`。
- **i2c**：`I2c<A=SevenBitAddress>`，包含 `read`、`write`、`write_read`、`transaction(&mut [Operation])`；`Operation{Read(&mut[u8]), Write(&[u8])}`；地址 `SevenBitAddress=u8`、`TenBitAddress=u16`；`ErrorKind`（Bus、ArbitrationLoss、NoAcknowledge、Overrun、Other）。
- **spi**（1.0 把 SPI **分成 SpiBus 和 SpiDevice**）：`SpiBus<Word=u8>` 表示整条总线，提供 `read`、`write`、`transfer`、`transfer_in_place`、`flush`（不管片选）；`SpiDevice<Word=u8>` 表示总线上的一个设备，核心是 `transaction(&mut [Operation])`（自动拉低和拉高 CS，并锁住总线）；`Mode{polarity, phase}` 就是 CPOL/CPHA。
- **pwm**：`SetDutyCycle`（`max_duty_cycle()`、`set_duty_cycle(u16)`，以及默认实现的 `set_duty_cycle_percent` 等），只设置占空比，频率属于硬件配置，交给芯片 HAL。
- **delay**：`DelayNs`（核心是 `delay_ns`，默认实现 `delay_us`、`delay_ms`）。

**为什么分成 SpiBus 和 SpiDevice**：0.2 版本的 SPI 是一组 `FullDuplex`、`Write` trait，不管片选，无法安全地共享一条总线。1.0 拆成 `SpiBus`（整条总线）和新增的 `SpiDevice`（带片选的单个设备）。**驱动应当基于 `SpiDevice` 编写**，这样多个驱动可以共享一条物理 SPI 总线，各自有片选；`SpiBus` 留给独占总线的场景。`embedded-hal-bus` 负责把一条 `SpiBus` 或 `I2c` 包装成多个可以共享的设备，提供六种并发策略（`exclusive`、单线程的 `refcell`、多线程的 `mutex`、跨中断的 `critical_section`、`atomic`、`rc`），选择共享策略不影响驱动代码。基于 trait 写驱动的好处也在这里：温度传感器驱动写成 `fn new(i2c: impl I2c)`，就能在任何实现了 `I2c` 的芯片上运行。

**1.0 相对 0.2 的改动**：删除 ADC（`OneShot`、`Channel` 不实用），删除 serial/UART（改用 embedded-io 的 `Read`、`Write`），删除 `IoPin`（运行时切换输入输出，不实用），SPI 分成两个 trait，所有方法都可能失败（返回 `Result<_, Self::Error>`，配合 `ErrorType`），`DelayMs` 和 `DelayUs` 合并为 `DelayNs`，阻塞风格和 `nb` 风格分开。

### svd2rust

svd2rust（v0.37.1，rust-embedded Tools team）把芯片厂商发布的 CMSIS-SVD（XML，描述每个外设寄存器的地址、字段和位）生成为类型安全的 PAC（Peripheral Access Crate），把「裸地址加位运算」变成 `peripherals.GPIOA.odr.modify(|_, w| w.odr5().set_bit())` 这种在编译时检查的 API。

**使用**：`svd2rust -i STM32F30x.svd` 生成未格式化的 `lib.rs`，再用 `form` 工具拆分目录并 `cargo fmt`。`--target` 选择 `cortex-m`（默认）、`msp430`、`riscv`、`xtensa-lx` 或 `none`，不同 target 生成不同的中断和启动代码。cortex-m target 还会生成 `build.rs`（放置链接脚本 `device.x`）和 `device.x`（把所有中断处理函数弱别名到 `DefaultHandler`）。

**生成器内部**：`generate/device.rs` 生成顶层的 `Peripherals::take()`（单例，保证对寄存器块的唯一所有权）；`peripheral.rs` 为每个外设生成 `#[repr(C)]` 的 `RegisterBlock`（按偏移排列）；`register.rs` 为每个寄存器生成读写代理 `R`/`W` 和字段的读写器；`generic.rs` 提供与寄存器宽度无关的通用 `Reg<REG>`，以及 `.read()`、`.write()`、`.modify()`；`interrupt.rs` 生成 `enum Interrupt` 和向量表。整条链是：厂商的 SVD，经 svd2rust 生成 PAC，芯片的 HAL crate 基于 PAC 实现 embedded-hal trait，驱动 crate 使用这些 trait。svd2rust 在最底层，自动生成寄存器级的 BSP。

### cortex-m 与 riscv crate

这两个 crate 在 PAC 之下，抽象的是指令集本身（而不是某颗芯片的外设），相当于 MCU 上的 polyhal `arch/` 层。

**cortex-m**（v0.7.7）包括 `cortex-m`、`cortex-m-rt`（启动）、`cortex-m-semihosting` 等。它抽象 ARM 架构定义的核内系统外设：`nvic`（中断控制器）、`scb`（系统控制块）、`syst`（SysTick 定时器）、`mpu`（内存保护）、`sau`（TrustZone）、`dwt` 和 `itm`（调试跟踪）、`fpu`；CPU 寄存器 `control`、`primask`、`basepri`、`msp`、`psp` 等；NVIC 的 API（`request`、`mask`、`unmask`、`set_priority`、`pend`，泛型参数 `<I: InterruptNumber>`）；临界区 `interrupt::disable()`（关 PRIMASK）和 `free(|cs| …)`；裸指令 `nop`、`wfi`、`wfe`、`dsb`、`dmb`、`isb`。

**riscv**（v0.16.0，七个子 crate）包括 `riscv`（CSR 核心）、`riscv-rt`（启动）、`riscv-peripheral`（CLINT/PLIC）、`riscv-semihosting` 等。`register/` 下约六十个文件覆盖 M 态和 S 态的全部 CSR：`mstatus`、`mie`、`mtvec`、`mepc`、`mcause`、`misa`、`mhartid`、`medeleg`、`mideleg`，PMU 计数器，PMP（`pmpaddrx`、`pmpcfgx`），AIA 相关（`miselect`、`mtopi`），以及 S 态对应的 `satp`、`scause`、`stvec`、`sie`。其中 `riscv-peripheral` 正好补上 **polyhal 缺的部分**：`aclint/{mtimer,mswi,sswi}` 是 CLINT/ACLINT（机器定时器加软件中断和 IPI），`plic/{enables,pendings,priorities,claim,threshold}` 是完整的 PLIC（使能、pending、优先级、claim/complete、阈值），`hal/aclint.rs` 还把 MTIMER 包装成 embedded-hal 的 `DelayNs`，把两层 HAL 连起来。

cortex-m 的中断控制器 NVIC 在核内，紧密耦合，由硬件按优先级抢占；rv 的 PLIC 在核外，由 `riscv-peripheral` 单独抽象，再加上 CLINT 定时器；临界区前者用 PRIMASK/BASEPRI，后者用 `sstatus.SIE`/`mstatus.MIE`。这对应了 NVIC，以及 rv 从 CLINT 到 ACLINT、从 PLIC 到 APLIC+IMSIC 的演进。

### 设备树在 probe 中的角色

板级适配要解决的问题是：一块板子有几十种外设，操作系统怎样知道它们在哪、怎样使用。做法是用设备树（DT）描述硬件，驱动框架按 `compatible` 匹配后 probe。过程是：DTB 描述硬件，驱动核心扫描每个节点的 `compatible`，在已注册驱动的 `of_match_table` 里查找匹配，匹配成功就调用 `driver->probe(dev)`，probe 里 `ioremap` 寄存器、`request_irq`、注册设备文件和 sysfs。DT 节点 `compatible="vendor,foo-uart"; reg=<…>; interrupts=<…>;` 中，`reg` 给出寄存器基址，`interrupts` 给出中断号和中断控制器的 phandle。

DT 在三类 HAL 里的作用不同：polyhal 在启动时用 `init_dtb_once`/`parse_system_info` 读取内存区域，用 `get_fdt().all_nodes()` 遍历 `compatible` 发现设备，但不做驱动匹配，只把 FDT 交给上层；embedded-hal 面向的 MCU 通常没有 DT（资源固定，PAC 在编译时写好地址），对应 polyhal 使用板级常量的方式；Linux 风格的内核里 DT 是 probe 的输入，整个匹配由 `compatible` 字符串驱动（见「外设驱动」）。x86 服务器用 ACPI（AML 字节码），rv/aa 嵌入式用 DT（静态 DTB），rv 两种都有。

### BSP 的三个部分与适配清单

把一个 HAL 或内核移植到新板子，最少要适配这三部分：

| 部分 | polyhal 中的位置 | embedded-hal 中的对应 |
|:--:|:--:|:--:|
| 堆与页分配 | 注入 `PageAlloc`（`common::init`） | `linked_list_allocator` 加 `#[global_allocator]` |
| 串口与控制台 | `DebugConsole::putchar`（rv 用 SBI legacy） | 芯片 HAL 的 UART 实现 `embedded-io::Write` |
| 节拍与定时器 | `ph_ctor!(ARCH_INIT_TIMER, …)` 加 `set_next_timer`（rv 用 `sbi_rt::set_timer`） | SysTick（cortex-m）、CLINT MTIMER（riscv-peripheral） |

除此之外还要检查：时钟频率（polyhal 的 `CLOCK_FREQ` 常量，换板必改，真实 SoC 还要配置 PLL 和时钟树）；引脚复用 pinmux（polyhal 完全不管，MCU 一侧由芯片 HAL 的 `into_alternate()` 处理，DT 一侧用 `pinctrl` binding，这是 OS HAL 与 MCU HAL 的分界）；中断控制器（polyhal 在 rv 上是空的，真实板子要接 PLIC 或 APLIC+IMSIC；cortex-m 用核内的 NVIC，不用适配）；内存布局（`VIRT_ADDR_START`、链接脚本、cortex-m 的 `memory.x`）；启动常量（启动核 hart id、栈大小、SUM 位，特权架构 1.10 的 SUM 与 1.9.1 的 PUM 语义相反，ISA 版本的差异也要适配）；设备发现方式二选一（运行时读 FDT，或编译时使用板级常量）。

从下往上，MCU 这条线是：硬件，指令集抽象（cortex-m/riscv，相当于 polyhal 的 `arch/`），PAC（由 svd2rust 生成），芯片 HAL crate（实现 embedded-hal trait），驱动和应用 crate。操作系统这条线是：硬件，polyhal（跨指令集的 CPU、MMU、trap、定时器、percpu），内核。两条线在指令集抽象这一层对应。自己写 HAL 时：要跨指令集运行同一份内核，参考 polyhal 的编译时单态、语义化的标志位和构造函数启动顺序；要跨芯片运行同一份驱动，参考 embedded-hal 的 trait 和总线共享策略；PLIC、时钟树这类 polyhal 没有做的板级细节，正是 BSP 适配的主要工作。

## 外设驱动

驱动是内核和设备之间的转换层。Linux 用一套统一的模型组织驱动：device、driver、bus 三者，建立在 kobject/sysfs 对象之上，再在此基础上形成各个子系统。下面先看这套模型的源码实现，再看各子系统的结构，最后看驱动怎样跨操作系统复用。要兼容 Linux 驱动，就要复刻这些。

### device、driver、bus 与 kobject/sysfs

这套模型由三部分组成：`device`（设备实例）、`driver`（驱动）、`bus`（总线，定义匹配和探测策略），再加上按功能分类的 `class`，全部挂在 kobject 树上，并以 sysfs 的形式呈现。

`struct device` 的第一个字段是 `struct kobject kobj`，kobject 提供三样东西：sysfs 目录节点、`kref` 引用计数（`get_device`/`put_device`）、构成 `/sys/devices/...` 设备拓扑的 `parent` 指针。device 还包含 `bus`（挂在哪条总线上）、`driver`（绑定到哪个驱动，NULL 表示未绑定）、`driver_data`（用 `dev_set/get_drvdata` 存私有数据）、`mutex`（即 device_lock，串行化对 `->driver` 的操作）。

注册总线时建立三个 kset（同类 kobject 的集合加 uevent 策略）：`/sys/bus/<name>`、`/sys/bus/<name>/devices`、`/sys/bus/<name>/drivers`。`struct bus_type` 现在是**只读的外部句柄**，真正可变的内部状态在 `struct subsys_private` 里（包括这三个 kset、`klist_devices`、`klist_drivers`、`drivers_autoprobe` 开关、通知链）。`bus_to_subsys()` 把 `bus_type*` 映射到 `subsys_private*` 并增加引用计数，所有内部操作都先经过这一步。这是对早期 bus_type 直接包含可变字段的重构，目的是让外部接口成为 const，并保证引用计数安全。

绑定时建立双向的符号链接：`/sys/bus/<b>/drivers/<drv>/<dev>`（驱动管理的设备）和 `/sys/devices/.../<dev>/driver`（设备的驱动）相互指向；`module.c` 还建立 `driver/module` 链接，把驱动和它的 `.ko` 关联起来。**sysfs 不是独立的文件系统数据，而是 kobject 树的视图**；`kobject_uevent(&dev->kobj, KOBJ_ADD/BIND/UNBIND/REMOVE)` 是内核通知用户态 udev 热插拔的唯一通道。

bus 和 class 互相独立：bus 按挂在哪条物理或逻辑总线上分类（platform、pci、i2c、usb），class 按功能分类（net、block、input、tty）。一个 device 同时属于一条 bus 和（可选的）一个 class，分别出现在 `/sys/bus/*/devices/` 和 `/sys/class/*/` 下。

### probe、remove 与延迟探测

模型的核心是两个对称的入口在 bus 上汇合：**新设备查找所有驱动，新驱动查找所有设备**。

注册设备 `device_add(dev)`：分配 `dev->p`，挂入 sysfs 拓扑，建立 uevent 和 class 属性，`bus_add_device`（挂入 `klist_devices` 并建立符号链接），加入电源管理链表，`kobject_uevent(KOBJ_ADD)`，`fw_devlink_link_device`（建立供应者与使用者的依赖图），`bus_probe_device`（触发探测）。

注册驱动 `driver_register(drv)`：检查总线已注册、检查重名，`bus_add_driver`（分配 `driver_private`，初始化这个驱动的 `klist_devices`，挂到 `/sys/bus/<b>/drivers/<drv>`，如果 `drivers_autoprobe` 打开就用 `driver_attach` 扫描已有的设备），`module_add_driver` 建立 `/sys/module` 链接。

匹配只有一个入口：`driver_match_device(drv, dev) = drv->bus->match ? drv->bus->match(dev, drv) : 1`（没有 match 函数时默认匹配）。返回值：大于 0 表示匹配，0 表示不匹配，`-EPROBE_DEFER` 表示延迟，其他负值表示错误。

探测的主流程是 `driver_probe_device`、`__driver_probe_device`、`really_probe`：检查挂起期间是否全部延迟，`device_links_check_suppliers`（供应者还没准备好就返回 `-EPROBE_DEFER`），`device_set_driver`（设置 `dev->driver`），`pinctrl_bind_pins`，`dma_configure`，`driver_sysfs_add`（建立符号链接），`call_driver_probe`（**总线级的 probe 优先于驱动的 probe**：`dev->bus->probe ?: drv->probe`），`device_add_groups`，`driver_bound`。绑定成功后 `driver_bound` 把设备加入驱动管理的列表，`driver_deferred_probe_trigger`（**唤醒其他等待中的延迟设备**），`kobject_uevent(KOBJ_BIND)`。

**延迟探测（deferred probe）** 解决依赖顺序的问题：一个驱动 probe 时发现依赖的 GPIO、clk、regulator 控制器还没探测好，就返回 `-EPROBE_DEFER`，设备被放进 `deferred_probe_pending_list`；任何一次绑定成功，都会把整个 pending 列表移到 active 列表，再 `queue_work` 重试，所以依赖一满足就会依次推进。内核启动末尾在 `late_initcall` 里启用并触发两轮，超时后对仍在等待的设备报警，可以在 `/sys/kernel/debug/devices_deferred` 查看。kernel.org 文档强调：`-EPROBE_DEFER` 要尽早返回，并且**不能在已经注册了子设备之后返回**，否则会无限循环 probe。

使用时可以通过 sysfs 手动绑定：`echo <dev> > /sys/bus/<b>/drivers/<drv>/bind`（解绑对应 `unbind`）；写设备的 `driver_override` 可以强制它只匹配指定的驱动。

### platform 总线与四级匹配

platform 总线承载所有不能自我描述、靠固件描述的 SoC 片内设备，它的 `platform_match` 按四级优先级匹配：`driver_override`（最高）；OF/设备树匹配（比较设备 `of_node` 的 `compatible` 和驱动的 `of_match_table`，匹配项的 `data` 就是驱动私有的匹配数据）；ACPI 匹配（比较 `_HID`/`_CID` 和 `acpi_match_table`）；`platform_device_id` 表（按名字精确匹配）；最后是设备名等于驱动名。`MODULE_DEVICE_TABLE(of/acpi/platform, …)` 把这些表导出到模块的别名段，`depmod` 生成 `modules.alias`，udev 根据 uevent 中的 `MODALIAS=` 自动 `modprobe` 对应的 `.ko`，插上设备自动加载驱动就是这样实现的。

注册一个 platform 驱动只需要 `module_platform_driver(my_driver)` 宏（底层是用 `module_init/exit` 包装的 `__platform_driver_register`），驱动实现 `.probe(pdev)` 即可；platform 设备由 `of_platform_populate` 从 DTB 解析生成，或者用 `platform_device_register` 手动注册。

### 模块 .ko 加载

普通驱动用总线宏（`module_platform_driver`、`module_pci_driver`、`module_i2c_driver`），底层都是 `module_driver` 宏，展开成 `module_init(__driver_init)` 和 `module_exit(__driver_exit)`；编进内核（不是 `.ko`）时用 `builtin_driver` 或 `device_initcall`，没有 exit。`THIS_MODULE` 填到 `drv->owner`，提供 `try_module_get`/`module_put` 引用计数，设备绑定期间 `.ko` 不能卸载。

`.ko` 本身是可重定位的 ELF（`readelf -h` 显示 `Type: REL`），`.modinfo` 段存放 license、depends、alias、vermagic。加载过程：`finit_module(2)` 系统调用，校验 vermagic（内核 ABI 版本串，不一致就拒绝），解析 `__ksymtab`（内核用 `EXPORT_SYMBOL`/`EXPORT_SYMBOL_GPL` 导出的符号），重定位，调用 `module_init`。`_GPL` 后缀表示只对声明了 GPL 兼容许可证的模块可见，这是内核 ABI 在许可证上的边界。`drivers/base/` 里的 `driver_register`、`bus_register`、`platform_device_register` 等都是用 `EXPORT_SYMBOL_GPL` 导出的稳定入口，但只对 GPL 模块开放。

### 驱动子系统

每个子系统都分三段：核心层（定义 bus_type、匹配、统一 API、枚举算法），控制器驱动（把抽象操作对接到具体 SoC 的寄存器），设备驱动（挂在总线上的具体外设）。最重要的区别是**怎样发现设备**：

| 子系统 | 怎样发现设备 | 能否自我描述 |
|:--:|:--:|:--:|
| PCI/PCIe | 遍历 bus/dev/func 读配置空间（vendor/device/class/BAR） | 完全能 |
| USB | hub 检测端口、复位、`GET_DESCRIPTOR` 读描述符 | 完全能 |
| MMC/SD/SDIO | 按 SDIO、SD、MMC 的顺序用 CMD0/CMD8/ACMD41/CMD52 试探 | 部分能（卡能返回 CID/CSD，控制器仍需 DT） |
| I2C | 不能枚举，地址靠板级描述 | 必须 DT/ACPI（地址加 compatible） |
| SPI | 没有地址也不能枚举，靠片选加板级描述 | 必须 DT/ACPI（reg 为片选号） |
| GPIO | gpiochip 是控制器，引脚本身不能描述自己 | 必须 DT（`gpio-controller` 加 `#gpio-cells`） |
| clk | 时钟树拓扑全靠 DT | 必须 DT（`clocks` 加 `#clock-cells`） |
| dma-engine | 通道靠 DT 申请 | 必须 DT（`dmas` 加 `#dma-cells`） |
| iommu | 哪个设备由哪个 iommu 管理靠 DT | 必须 DT/ACPI（`iommus`、IVRS、DMAR） |

**PCI 和 USB 是即插即用的总线，设备自带身份信息；其余 SoC 片内总线都靠设备树描述拓扑**。所以 rv/aa 的 SoC 必须带 DTB，而 x86 的 PCI 设备可以直接枚举。

**PCI/PCIe。** 基础是配置空间（每个 function 256 字节，PCIe 扩展到 4 KB），标准头包括 Vendor、Device、Class、六个 BAR、Interrupt Line。核心层最经典的做法是 **BAR 大小探测（写全 1 再读回）**：对每个 BAR，先保存原值，写入全 1，读回（硬件把地址译码不关心的低位强制清零），再写回原值；读回值中最低的那个 1 位的权重就是这个 BAR 需要的窗口大小（`size & ~(size-1)` 取最低置位）。内核据此在物理地址空间里分配窗口，再把分到的基址写回 BAR，PCI 自动分配地址就是这样实现的。匹配只看 ID（`pci_match_id` 比较 vendor、device、subsystem、class），不需要 DT。中断用 **MSI/MSI-X**：设备不再拉 INTx 引脚，而是用 DMA 向一个特定地址（CPU 的 LAPIC 或 IMSIC 门铃）写数据，数据就是向量号；每个 function 一张 MSI-X 表，最多 2048 个向量，每个向量有独立的地址、数据和屏蔽位，是 NVMe 和网卡多队列 RSS 的基础。使用时 `pci_alloc_irq_vectors()` 一次调用，按掩码在 MSI-X、MSI、传统中断之间自动回退。rv 上 MSI-X 的目标地址是 IMSIC 的 interrupt file。

**USB。** 控制器（xHCI、EHCI、DWC3）实现 `hc_driver`，通过 `usb_add_hcd` 注册并建立 root hub，之后所有外设都是 hub 端口下的子节点。枚举是一个典型的自我描述过程：hub 检测到端口连接，`hub_port_reset` 复位并测速（USB2 设备在复位过程中用 chirp 协商高速），从地址 0 分配到唯一的 devnum（SET_ADDRESS），按速度确定 ep0 的包大小，`GET_DESCRIPTOR` 读设备、配置、接口、端点描述符，`device_add` 挂到总线上触发接口驱动的匹配，建立 `/dev` 节点供 libusb 在用户态访问。数据传输的核心是 **URB（USB Request Block）**：`usb_alloc_urb` 分配，`usb_fill_*_urb` 填充，`usb_submit_urb` 提交（检查回调和设备状态，按端点类型分流，控制传输带 8 字节的 setup 包，做 DMA 映射，交给 HCD 入队），完成后 HCD 调用 `urb->complete`；`message.c` 提供 `usb_control_msg`、`usb_bulk_msg` 这样「提交并等待完成」的同步封装。端点是设备内的单向数据通道，分控制、批量、中断、同步四类。

**I2C。** 核心层有三种匹配（DT 的 `of_match_table`、ACPI、`i2c_device_id`），但 **I2C 总线不能枚举**，扫描从设备地址也看不出设备类型，设备必须按 `i2c_board_info`（地址加名字）实例化，信息来自 DT（`reg=<0x50>` 加 compatible）。收发的核心是 `__i2c_transfer`：检查控制器实现了 `master_xfer`，仲裁失败时自动重试，原子上下文用 `master_xfer_atomic`；`struct i2c_msg` 数组承载多段传输（addr、flags、len、buf，`I2C_M_RD` 表示读）。控制器驱动只需把这些消息转换成 START、地址、数据、STOP 时序。SMBus 是 I2C 的子集协议，核心层可以用 `master_xfer` 模拟。

**SPI。** 与 I2C 类似（DT、ACPI、id 三种匹配），但**既没有地址也不能枚举**，设备由片选线区分，DT 中的 `reg=<0>` 表示第几根 CS。传输单位是 `spi_message`（包含一串 `spi_transfer`），`spi_transfer_one_message` 拉低片选后对每一段调用控制器的 `transfer_one`，DMA 映射失败时可以退回 PIO。`spi_setup` 配置 CPOL/CPHA（时钟极性和相位）、位宽、速率；SPI 是全双工的，tx_buf 和 rx_buf 同步移位。embedded-hal 1.0 把整条总线 SpiBus 和带片选的 SpiDevice 分开，正对应这里控制器和设备的关系。

**MMC/SD/SDIO。** `mmc_rescan`（热插拔和上电的入口，由工作队列触发）先检查已有的卡是否还在或查询卡是否插入，再从高到低按频率 `mmc_rescan_try_freq` 握手，**探测顺序固定为 SDIO、SD、MMC**：上电，`sdio_reset`（CMD52），`mmc_go_idle`（CMD0），`mmc_send_op_cond`（CMD8/ACMD41 探测电压），然后依次尝试 `mmc_attach_sdio`、`mmc_attach_sd`、`mmc_attach_mmc`。这样排序是因为 SDIO 卡可能对不认识的命令误响应，必须先用 CMD52/CMD5 识别出来；SD 用 ACMD41，MMC 用 CMD1，电气特性和命令集都不同。卡能返回 CID、CSD、SCR，属于部分自我描述，但控制器的寄存器基址、时钟、电源、检测引脚仍需要 DT。SD 和 eMMC 通过 `block.c` 呈现为 `/dev/mmcblkN` 块设备，SDIO function 则运行 WiFi、蓝牙模块的驱动。

**GPIO。** 现在的 GPIO 用不透明的 `struct gpio_desc`（取代旧的全局整数 GPIO 编号）。控制器填写 `struct gpio_chip`（`get`、`set`、`direction_input`、`direction_output`、`to_irq`），用 `gpiochip_add_data` 注册一组引脚。**GPIO 必须用 DT**：哪根引脚是 reset、哪根是中断，全靠 DT 的 `*-gpios` 属性和 `#gpio-cells`（通常是 2，即偏移和标志），极性（ACTIVE_LOW）也编码在标志里。使用时，`gpiod_get(dev, "reset", flags)` 通过 DT 解析 `reset-gpios = <&gpio1 5 GPIO_ACTIVE_LOW>` 得到描述符，`gpiod_set_value()` 自动按极性取反，使用者只管逻辑值。用户态通过 `/dev/gpiochipN` 字符设备的 ABI v2 访问。

**clk（通用时钟框架）。** 时钟硬件是一棵有向树：晶振、PLL、分频器和选择器、门控、外设，CCF 用 `struct clk_core` 表示每个节点并记录父节点。基础组件是 `clk-gate`、`clk-divider`、`clk-mux`、`clk-fixed-rate`、`clk-composite`，控制器实例化这些节点，填写 `clk_ops`（`recalc_rate`、`set_rate`、`round_rate`、`enable`、`set_parent`），注册为 DT 的时钟提供者。**频率传播**：`clk_set_rate` 递归计算最优的分频和时钟源，可以一直上溯到根。**prepare 和 enable 分两步**：`clk_prepare`（可以睡眠，用于 PLL 锁定等慢操作）和 `clk_enable`（原子操作，打开门控）。**clk 必须用 DT**：整棵树的拓扑和使用者用哪个时钟，全靠 `clocks = <&ccu CLK_FOO>`、`clock-names` 和提供者的 `#clock-cells`。使用时 `clk_get`、`clk_prepare_enable`、`clk_set_rate`。

**dma-engine。** 控制器填写 `struct dma_device`，实现 `device_prep_dma_*`（生成描述符）、`device_issue_pending`、`device_tx_status`。外设驱动作为客户端，用 `dma_request_chan`（按 DT 的 `dmas=<&dma 0>` 和 `dma-names` 查找通道）获得通道，在内存和外设之间搬运数据。描述符的流程：`device_prep_dma_memcpy/slave_sg/cyclic` 生成 `dma_async_tx_descriptor`，设置回调后 `tx_submit` 入队并得到 cookie，`device_issue_pending` 启动硬件，完成后调用回调，`dma_run_dependencies` 触发依赖链（async_tx 框架，用于 RAID）。**dma 必须用 DT**：哪个外设接到 DMA 控制器的哪条请求线是 SoC 内部的硬连线，只能用 `dmas` 和 `#dma-cells` 描述。

**iommu（横跨各子系统）。** 它在设备的 DMA 路径上加一层 MMU：设备发出 IOVA（IO 虚拟地址），iommu 硬件查页表翻译成物理地址，实现设备隔离，让 32 位设备访问高端内存，支持虚拟机直通。`domain` 是一组共享同一地址空间的设备；`iommu_attach_device` 把设备绑定到 domain（写设备的 stream table 或 context entry）；`iommu_map` 建立 IOVA 到物理地址的映射（填写页表并刷新硬件 TLB，失败时回滚），unmap 按 `pgsize_bitmap` 中最小的页大小对齐，逐页拆除。控制器（Intel VT-d、AMD-Vi、ARM SMMU、RISC-V IOMMU）实现 `iommu_ops` 和 `iommu_domain_ops`。**iommu 必须用 DT 或固件表**：哪个设备由哪个 iommu 管理、用哪个 stream-id，靠 DT 的 `iommus=<&smmu 0x100>` 和 `#iommu-cells`，或 ACPI 的 IVRS、DMAR、IORT。使用者是 DMA 子系统和 VFIO/iommufd（把设备直通给虚拟机）。

以上与权威资料一致：LDD3 和内核文档对 PCI 枚举和「写全 1 读 BAR 大小」的描述与实现相符；USB 2.0 规范的复位时序、ep0 包大小、标准描述符与 hub 的实现一一对应；SD/SDIO 规范的 CMD0/CMD8/ACMD41/CMD52 握手说明了 SDIO、SD、MMC 的探测顺序；设备树规范定义的 `#gpio-cells`、`#clock-cells`、`#dma-cells`、`#iommu-cells` 对应各子系统对 DT 的解析。

### Rust for Linux

Rust for Linux 用一套绑定让上面的 C 模型变得安全。`module_platform_driver!` 宏对应 `module_init/exit`；`platform::Adapter<T: Driver>` 对接 C 的 `platform_driver`；驱动只需实现 `Driver` trait 的 `probe(dev: &Device<Core>, id_info) -> impl PinInit<Self, Error>`，驱动的私有数据**直接在目标位置构造**，要么完整构造，要么返回 `Err`，避免了 C 里「分配、初始化一半、失败时回滚」这种容易出错的写法。

有两处设计最值得学。一是 **`Registration` 用 RAII 注销**：`Registration` 存在就表示驱动已注册，它被 drop（模块卸载）时自动调用 `platform_driver_unregister`，C 里「init 注册了、exit 忘了注销」这一类 bug 就不会出现；它还把一个 `post_unbind_rust` 回调写进 `device_driver` 里一个 Rust 专用的字段，C 侧在 `device_unbind_cleanup` 里调用它，在 remove 和所有 devres 回调完成后再 drop 驱动私有数据，C 和 Rust 在清理顺序上配合准确。二是 **Device 的类型状态（type-state）**：`Device<Ctx>` 用零大小的类型参数表示设备当前所处的上下文：`Normal`（默认，只读）、`Core`（在 probe 等总线回调的作用域内）、`Bound`（保证在绑定到驱动的整个期间有效）。访问 MMIO、IRQ、DMA 资源的方法（`io_request_*`、`irq_*`）只在 `impl Device<Bound>` 里存在，所以「在没有绑定的设备上 ioremap 或申请 IRQ」这种 C 里的运行时 bug，在 Rust 里编译就通不过。类型状态把设备状态机中哪些操作合法变成了类型约束。

### 跨操作系统的驱动兼容

驱动复用有五种做法，代价依次增加：一是 **ABI 级**（直接加载二进制驱动），ReactOS 是 Windows NT 的净室重新实现，重写 `ntoskrnl`、`hal`、IO 管理器，让 `DriverEntry`、`IRP_MJ_*`、`IoCallDriver` 等 NT 内核 ABI 保持一致，从而直接加载未修改的 Windows `.sys`，代价是必须逐字节复刻 NT 内核的结构和未公开的行为，好处是能使用第三方闭源驱动（Windows `.sys` 有二十五年的向后兼容）；二是**源码级**（用兼容头文件重新编译驱动源码），FreeBSD 的 LinuxKPI 在 `sys/compat/linuxkpi/` 下提供数百个 Linux 内核头文件的 FreeBSD 实现，不加载 `.ko`，而是在 FreeBSD 上重新编译 Linux 驱动源码（DRM/amdgpu、iwlwifi），关键的衔接字段 `device_t bsddev` 把 Linux 驱动的语义转换到 FreeBSD 的 newbus；illumos 的 SPL 原理相同，方向相反（让 illumos 支持 Linux 风格的 API）；三是**运行时转换**（如 ndiswrapper）；四是**按 API 重写**（按规范重新实现，大多数原生驱动是这样）；五是 **VFIO 直通**（直通给用户态或虚拟机，需要 IOMMU）。Fuchsia DFv2 是另一种做法：驱动作为**用户态**组件运行，驱动之间用 driver runtime 加 FIDL 通信，好处是故障隔离、升级驱动不用重启内核；但根据 fuchsia.dev 的说明，稳定 ABI 是**设计目标，尚未实现**（"aims to provide a stable ABI … has not achieved ABI stability yet"）。

ABI 稳定性是这里的核心矛盾：Linux 的 `.ko` 故意不保持 ABI 稳定（内核 ABI 随版本变化，靠重新编译保证一致），换来内核演进的自由；Windows 的 `.sys` 保持稳定，换来闭源驱动的生态。要兼容 Linux 驱动，现实的做法是源码级（LinuxKPI、DragonOS 的做法）或按 API 重写，而不是 ABI 级，后者要复刻整套内核结构，成本极高。

## 文件系统

文件系统在块设备之上、系统调用之下，把扇区组成的线性数组抽象成目录树和文件。Linux 用 VFS（虚拟文件系统）把五十多种文件系统统一成同一套接口。下面先看 VFS 本身，再看六个具体文件系统的实现（寻址、分配、掉电一致性各不相同），最后看页缓存、日志，以及绕开 VFS 的两种做法（FUSE 在用户态实现文件系统，SPDK 在用户态轮询设备）。

### VFS 的四种对象与操作表

VFS 用「对象加函数指针表」实现多态：每种对象挂一组 `*_operations`，具体文件系统填写这张表，VFS 的通用代码只调用 `obj->op->method()`。四种对象各管一部分：`super_block`（一个已挂载文件系统实例的全局信息），`inode`（一个文件的元数据和索引，与路径名无关），`dentry`（路径树的节点，也是从名字到 inode 的缓存项，即 dcache），`file`（进程打开文件的句柄，包含位置、标志、凭证）。它们的关系是 `file`、`dentry`、`inode`、`super_block` 依次指向，`inode.i_mapping` 指向 `address_space`（页缓存）；一个 inode 可以被多个 dentry 指向（硬链接），一个 dentry 可以被多个 file 打开。

四张操作表作用在不同层面：`file_operations` 作用在打开的文件上（`read_iter`、`write_iter`、`mmap`、`open`、`release`、`fsync`、`splice_*`、`copy_file_range`、`uring_cmd` 等，现在的文件系统只填 `read_iter`/`write_iter`，旧的 `read`/`write` 留空，走 `new_sync_read`）；`inode_operations` 作用在元数据和命名空间上（`lookup` 是路径解析的核心回调，还有 `create`、`link`、`unlink`、`mkdir`、`rename`、`getattr`、`setattr`、`listxattr`、`atomic_open`、`tmpfile`，新内核里这些都带 `mnt_idmap *` 参数，用于 idmapped mount 的 UID 映射）；`super_operations` 作用在整个文件系统实例上（`alloc_inode`、`write_inode`、`evict_inode`、`sync_fs`、`statfs`、`freeze_fs`、shrinker 回收）；`address_space_operations` 连接页缓存和磁盘（已经全部改用 folio：`read_folio`、`readahead`、`writepages`、`dirty_folio`、`write_begin`、`write_end`、`direct_IO`、`bmap`、`migrate_folio`、`swap_*`）。对比来看，xv6 没有操作表（只有写死的 `readi`/`writei`），FreeBSD 用 `vop_vector`，macOS XNU 用 `vnop_*`。Linux 分成四张表，是为了把不变的 VFS 通用逻辑和各文件系统的实现完全分开，Rust 内核（如 arceos 的 `VfsOps`/`VfsNodeOps` trait）也照搬了这个设计。

### 路径解析与 dcache 的两种模式

把 `/a/b/c` 解析成 inode 的过程叫 namei，主流程是 `open`、`path_openat`、`path_init`（设置起点）、`link_path_walk`（逐个分量处理）、`walk_component`、`lookup_fast` 或 `lookup_slow`、`step_into`（处理挂载点和符号链接）、`open_last_lookups`、`do_open`、`complete_walk`。它的关键是**两种模式并存，先试 RCU-walk，失败再用 REF-walk**：

| | RCU-walk | REF-walk |
|:--:|:--:|:--:|
| 并发控制 | 采样 `d_seq` seqlock，`rcu_read_lock` 防止释放 | 引用计数 `d_lockref` 加自旋锁 |
| 是否取引用 | 不取（不写共享缓存行） | 每个 dentry 和 mount 都 `lockref_get` |
| 速度 | 很快（没有原子操作，没有锁竞争） | 慢（每个分量一次原子加减） |
| 适用场景 | 频繁读取、路径全部命中缓存 | 需要睡眠（IO、权限检查）、automount、revalidate |

RCU 查找 `__d_lookup_rcu` 在哈希桶里用 RCU 遍历，不取引用，靠 `d_seq` seqlock 逐级校验（采样旧 dentry 的序号，前进一步，再用 `read_seqcount_retry` 确认没有变化）。RCU-walk 遇到必须睡眠的操作（缺页 IO、需要睡眠的权限检查、网络文件系统的 `d_revalidate`）时，`try_to_unlazy` 对当前路径上的每个指针补取引用，并确认 seqlock 没有变化，成功就转为 REF-walk，失败就返回 `-ECHILD`，由上层从头用 REF-walk 重来。负 dentry（`d_inode == NULL`）缓存「这个名字不存在」，加快重复失败的查找（例如编译器在 include 路径里查找头文件）。read/write 在 VFS 中的分派：`vfs_read` 先检查 `FMODE_READ`、`access_ok`、`rw_verify_area`，再调用 `file->f_op->read ?: new_sync_read`（把同步读包装成 `kiocb` 加 `iov_iter`，调用 `read_iter`），成功后发出 inotify 通知并做统计。fd 表（`fs/file.c`）用可以 RCU 替换的 fdtable 加位图管理：`alloc_fd` 找空位，`fd_install` 放入 `struct file*`，`fget` 用 RCU 读取并检查 `f_count`。

### 挂载、命名空间与挂载传播

一个 mount 由源 dentry、挂载点、super_block 三部分组成；`d_mountpoint(dentry)` 标记某个 dentry 是挂载点，路径解析时由 `handle_mounts` 跨过去。每个进程有自己的 `mnt_ns`（一棵独立的挂载树），`clone(CLONE_NEWNS)` 或 `unshare --mount` 复制出新的命名空间，容器就是靠挂载命名空间加 `pivot_root` 把根文件系统换成镜像层的（见「虚拟化与容器」）。挂载传播（mount propagation）有四种：`MS_SHARED`（挂载和卸载事件在 peer group 内双向传播），`MS_PRIVATE`（不传播，容器常用来隔离），`MS_SLAVE`（单向，只接收不发送），`MS_UNBINDABLE`（不能 bind，防止递归 bind 时数量暴增）。systemd 把 `/` 设为 shared，导致挂载泄漏到容器里，问题就出在这里。

### 页缓存

页缓存是 `address_space`（即 `inode->i_mapping`）下的一棵 XArray（以前是 radix tree），索引是文件页号，值是 `folio`（一个或多个连续 page 的头部）。它连接文件系统和内存子系统，有三条路径：

- **缓冲读**：`read`、`generic_file_read_iter`、`filemap_read`、`filemap_get_pages` 按页号查找 folio，命中就直接 `copy_to_user`；没有命中就分配 folio，调用 `a_ops->read_folio` 或 `readahead` 发起磁盘 IO；正在 IO 时就睡眠等待 `PG_locked`/`PG_uptodate`。
- **缓冲写分两步**：`generic_perform_write` 循环里先调用 `balance_dirty_pages_ratelimited`（脏页太多就先回写，防止脏页过多），再调用 `a_ops->write_begin`（分配或读入目标 folio），`copy_from_user`，`a_ops->write_end`（标记为脏并解锁）。
- **mmap 缺页**：`mmap` 设置好 `vm_ops` 后，缺页时走 `filemap_fault` 查页缓存（命中就建立页表映射，没有命中就分配、读盘、睡眠等待）；`filemap_map_pages` 在一次缺页时顺便把附近已经缓存的 folio 一起映射（fault-around，减少缺页次数）。

**read 和 mmap 共用同一份页缓存**，所以读过的文件再 mmap 时直接命中，不用复制。写入是「标记为脏，再异步回写」：`folio_mark_dirty` 计入每个 bdi 的脏页计数，脏页超过 `vm_dirty_ratio`（默认 20%）时 `balance_dirty_pages` 限制写入速度；每个 bdi 的 flusher 内核线程 `wb_workfn`、`wb_writeback`、`writeback_sb_inodes` 定期（默认 5 秒），或在 `fsync`、`sync`、内存紧张时，把脏 inode 的页提交成 bio。`fsync` 的核心就是 `filemap_write_and_wait_range`（发起回写并等待完成）。例外是 DAX：对 NVDIMM/pmem，文件页直接映射设备的物理内存，不经过 DRAM 页缓存，没有两次复制。

### jbd2 日志与三种数据模式

JBD2 是从 ext3 中抽出来的通用块设备日志层（ext4 和 ocfs2 共用），保证一组块的修改原子地写入磁盘：先把修改顺序写进日志区（快），写完后用一个 commit block 标记事务完整，崩溃后重放有 commit 的事务就能恢复一致，不需要全盘 fsck。日志块有四种：descriptor block（描述后面数据块最终写入的位置），commit block（标记事务完整），revoke block（防止重放旧事务中已经被覆盖的块，避免把已删除的元数据写回去），superblock。事务状态由 kjournald2 内核线程推进（`T_RUNNING`、`T_LOCKED`、`T_FLUSH`、`T_COMMIT`……`T_FINISHED`），同一时间只有一个运行中的事务（其他句柄合并进来，称为复合事务），默认每 5 秒强制提交一次。

三种数据模式（`mount -o data=`）要分清，尤其是 ordered 模式的保证常被说错：

| 模式 | 元数据 | 文件数据 | 崩溃后 | 速度 | 默认 |
|:--:|:--:|:--:|:--:|:--:|:--:|
| `data=journal` | 写入日志 | 也写入日志 | 最安全，最新数据不丢失 | 最慢（数据写两次） | |
| `data=ordered` | 写入日志 | 写到最终位置，但在元数据提交之前 | 元数据指向的数据一定已经写入（不会读到旧块或垃圾） | 中 | 是 |
| `data=writeback` | 写入日志 | 写到最终位置，与元数据没有先后顺序 | 元数据可能指向还没写入的数据块（读到旧内容或垃圾） | 最快 | |

**ordered 模式保证数据块在引用它的元数据事务提交之前写入磁盘**，所以崩溃后不会出现「元数据说文件有这一块，但块里是已删除文件的旧内容」这种安全问题；它不保证最新写入的数据一定不丢，那只有 journal 模式才能做到。ext4 中的 metadata_csum（crc32c 元数据校验）与日志是两个互相独立的特性，这正是下面 ext4_rs 与 lwext4 的关键区别。ext4 还有 fast commit：ordered 模式下只记录最小的增量（哪个 inode 的哪一段变了），让频繁 fsync 的负载更快。

### 六个文件系统的寻址与掉电一致性

下面六个文件系统按难度递增，正好覆盖寻址结构和掉电一致性两个方面。每个文件系统都先定义自己的块设备接口（文件系统与硬件的分界）。一个关键差别是**只有 littlefs 在接口中要求提供 `erase`**：NOR/NAND Flash 必须先擦后写，而且擦除的粒度远大于写入，所以 littlefs 必须用写时复制（COW），其他几个可以原地更新。这是硬件特性反过来约束文件系统设计最清楚的例子。

**easyfs（rCore 教学用，约 980 行 Rust）** 是最简单的：磁盘分五个区（超级块、inode 位图、inode 区、数据位图、数据区），`DiskInode` 包含 28 个直接块、一个一级间接块和一个二级间接块（文件最大 8 MB）。寻址函数 `get_block_id` 分直接、一级、二级三种情况。块缓存是全局 16 块的简单 LRU，`get_ref<T>` 用裸指针把块内偏移强制转换成 `#[repr(C)]` 结构体（不复制地读取结构体，是这里核心的 unsafe），`Drop` 时把脏块自动写回。位图分配器是首次适配（找到第一个不全为 1 的 u64，用 `trailing_ones` 找第一个 0 位）。**没有掉电一致性**：`block_cache_sync_all` 全部刷盘，没有日志也没有屏障，刷盘过程中掉电会留下「位图已置位但 inode 没写」的不一致。它的价值是用一千行左右读懂一个完整的可读写文件系统。

**ext2-rs（约 2550 行 Rust，只读）** 还原了 ext2 的经典布局：磁盘分成多个 block group（每组有自己的位图和 inode 表，减少寻道），超级块固定在字节偏移 1024，固定 1024 字节，用 `assert_eq!(size_of::<Superblock>(), 1024)` 这类编译时断言锁定磁盘格式，是很好的工程做法。寻址是 12 个直接块加一级、二级、三级间接块（比 easyfs 多一级），用位运算 `index >> (log_block_size+2)` 计算下标（要求块大小是 2 的幂，比除法和取模快）。目录项是变长的（`inode | rec_len | name_len | file_type | name`，按 `rec_len` 前进），不同于 easyfs 定长的 32 字节。它的写操作全是 `unimplemented!()`，目的是读懂 ext2 的布局，不是用于生产读写。

**ext4_rs（约 8160 行 Rust，生产级 ext4）** 的核心是**用 extent 树代替间接块**：extent 是「一段连续逻辑块到一段连续物理块的映射」，不是逐块的指针，大的连续文件只需要很少几个 extent。inode 里 60 字节的 `i_block` 被用作 extent 树的根（`transmute` 成 `Ext4ExtentHeader` 加几个 extent）；`find_extent` 在内部节点二分查找覆盖目标逻辑块的索引并向下，在叶子节点计算 `物理块 = 逻辑块 - extent.first_block + extent 的物理起点`；写入时用 `insert_extent`/`merge_extent`（逻辑和物理都连续才合并，以减少 extent 数量）。有一点必须说清：**ext4_rs 没有实现 JBD2 日志**，超级块里的日志字段只是为了正确解析磁盘格式而声明，整个仓库没有事务、提交、重放；它实现的是 crc32c 元数据校验（超级块、位图、块组描述符、extent 尾部、inode 都有校验和），只能检测损坏，不能保证原子性。掉电后只能靠 fsck 和校验和发现问题，不能原子恢复。它的分层（`ext4_defs/` 放纯磁盘结构，`ext4_impls/` 放算法，加 `fuse_interface`）值得大型文件系统参考。

**fatfs（ChaN 的 FatFs，约 7250 行 C，FAT12/16/32/exFAT）** 的寻址方式完全不同：FAT 是簇链表，一个以簇号为下标的数组，值是下一个簇号、链尾或空闲，一个文件就是一条簇链，块映射集中放在卷头的一张大表里，而不是每个文件一棵树。代价是**随机访问是 O(n)**（必须从头沿着链走，这是 FAT 最大的缺点）。缓存只有一个单扇区的窗口 `win[]`（非常省内存，适合嵌入式）。掉电一致性靠**两份完全相同的 FAT 表**：`sync_window` 写回主 FAT 后，如果窗口在第一个 FAT 里，就同时写 `winsect + fsize`（备份 FAT 的对应扇区）。但这不是原子操作（两次写之间掉电会让两份不一致），只是多一份副本供 fsck/chkdsk 参考，是 1980 年代的设计，远不如 ext4 的日志或 littlefs 的 COW。使用上，fatfs 提供 `f_open`、`f_read`、`f_write`、`f_mount` 这套类似 POSIX 的 API，移植只需实现 `diskio.c` 里的四个回调（`disk_read`、`disk_write`、`disk_ioctl`、`disk_status`）；加上 UEFI 要求 ESP 用 FAT32，相机和 U 盘也普遍使用，它是嵌入式和需要跨平台场景的事实标准。

**littlefs（约 6560 行 C，嵌入式，掉电安全）** 依靠元数据对和 CTZ 跳表两个结构：元数据对提供原子更新，但存储开销大；CTZ 跳表提供紧凑的 COW 数据存储，但更新开销大；两者结合，用元数据对存放指向 CTZ 跳表的引用。**元数据对**是两个互为备份的日志块：每个元数据对是两个块地址，用 revision count 序号比较哪一块更新；块没写满时直接追加新条目（旧条目不动，掉电后旧版本仍在），一次提交可以包含多个条目，共用一个 32 位 CRC（原子地更新多项元数据），块写满时压缩到另一块。**CTZ 跳表**是 COW 的文件数据结构，推导过程很有意思：正向的 COW 链表追加时要连带复制整条链（O(n) 次写，不可用）；反向链表追加只加一个新块（O(1) 次写，但顺序读是 O(n²)）；CTZ 跳表在反向链表上加多级跳转指针（第 n 块包含 `ctz(n)+1` 个指针，读任意块 O(log n)，追加仍是 O(1)，平均每块 2 个指针）。它在文件系统层做磨损均衡（revision count 反映擦写次数，分配时倾向于擦写少的块，迁移坏块，这是磁盘文件系统完全没有的一层），块分配用滑动的 lookahead 窗口，不需要磁盘上的分配表。它的掉电一致性是六者中最强的：元数据靠两块交替、revision 和提交级的 CRC，文件数据靠纯 COW 加根引用的原子切换，任何时候掉电都能回到上一次有效的提交，也不需要单独的日志区。它的 DESIGN.md 从链表的 O(n²) 推到反向链表再推到 CTZ 跳表，是设计文档的好例子。

**lwext4_rust（约 3320 行 Rust 加 C 库）** 是 lwext4（C 写的嵌入式 ext2/3/4）的 Rust 绑定：`bindings.rs` 是 bindgen 生成的 FFI，`file.rs` 全部用 `unsafe` 调用 C 的 `ext4_fopen`、`ext4_fread`，C 源码用 CMake 编译进来，no_std 环境下用 `ulibc.rs` 的 `#[linkage]` 补上 `malloc`、`free`、`qsort` 符号。与 ext4_rs 的关键区别是：**lwext4 有完整的 JBD2 日志**，`ext4_journal.c`（61 KB）有用红黑树管理的 revoke 记录、带 crc32c 的提交头、重放和恢复，挂载顺序是 `ext4_device_register`、`ext4_mount`、`ext4_recover`（重放日志）、`ext4_journal_start`、打开回写缓存。两个都叫 Rust ext4，但 ext4_rs 从零写起、没有日志，lwext4_rust 绑定成熟的 C 库、有完整的 JBD2，这是「绑定成熟 C 库还是纯 Rust 重写」这一工程取舍的实际例子（成熟的一致性机制很难从零写对）。

六者对比：寻址上，间接块（easyfs、ext2）是逐块的指针，extent（ext4、lwext4）是连续段的映射，FAT 是集中的链表（随机访问慢），CTZ 跳表（littlefs）是适合 COW 的对数跳转；掉电一致性上，easyfs 没有，ext4_rs 只能用校验和检测，fatfs 有两份副本但不是原子的，lwext4 用 JBD2 日志，littlefs 用 COW 加两块交替（后两者才是真正原子的，磁盘适合日志，Flash 适合 COW）。这些独立的文件系统 crate 的意义在于**可以替换后端**：arceos 的 axfs 用 cargo feature（如 `features=["fatfs"]`）在编译时选择具体的文件系统。

### FUSE

FUSE 让用户态进程实现文件系统。一次 `read(/mnt/fuse/file)` 的过程：内核 VFS，内核 fuse 模块构造 `fuse_in_header{opcode=FUSE_READ, nodeid, unique}` 放进 `/dev/fuse` 的请求队列，用户态守护进程 `read(/dev/fuse)` 收到请求，libfuse 按 opcode 查 `fuse_ll_ops[]` 分派表，调用文件系统的 `read` 回调得到数据，`write(/dev/fuse)` 返回 `fuse_out_header{unique, error}` 和数据，内核按 `unique` 找到对应的请求，唤醒原来的 read，把数据复制给用户。协议头里的 `nodeid` 是目标文件的 inode 标识（低层 API 用 nodeid 而不是路径），`unique` 用来匹配回复。opcode 共五十多个（`FUSE_LOOKUP=1` 是所有操作的前提，把名字转换成 nodeid；还有 `GETATTR`、`OPEN`、`READ`、`WRITE`、`READDIR`、`INIT`（握手，协商版本和能力）、`CREATE`、`COPY_FILE_RANGE`、`SETUPMAPPING`（virtiofs 的 DAX 窗口）等）。挂载时先 `open("/dev/fuse")` 得到 fd，再 `mount(source, mnt, "fuse", flags, "fd=...,rootmode=...,user_id=...")` 把 fd 交给内核，内核就把这个挂载点的所有 VFS 请求转发到这个 fd 的队列，用户态守护进程因此能处理文件操作（非特权用户通过 setuid 的 `fusermount3` 挂载）。

FUSE 有两套 API：低层 API（`fuse_lowlevel_ops`，回调拿到 nodeid，显式调用 `fuse_reply_*`，异步）直接对应内核协议；高层 API（`fuse_operations`，回调拿到路径字符串，返回即回复，同步）建立在低层之上，自动维护 nodeid 和路径的对应关系。`fuse-ext2` 就是用高层 API 写的（`getattr`、`read`、`write`、`readdir` 回调拿到路径，内部用 libext2fs 读 ext2 镜像）。现在的 libfuse 3.x 还支持 FUSE-over-io_uring（用 io_uring 的环代替 `read`/`write(/dev/fuse)` 的往返）、passthrough/backing（把某些 IO 直接转给真实的后端 fd，不经过用户态）、splice 零复制、多线程。性能上，每次 IO 至少两次用户态与内核态的切换，再加一次进程调度，FUSE 比内核态文件系统慢（小 IO 更明显），但崩溃不会拖垮内核，可以用任何语言编写（sshfs、s3fs、gocryptfs、NTFS-3G 都基于 FUSE）。

### SPDK

另一个极端是 SPDK，它把整个 NVMe 设备从内核交给用户态。做法是：通过 sysfs 把设备从内核的 `nvme` 驱动解绑，改绑到 `vfio-pci`（vfio 可以配置 IOMMU 保证内存安全，生产环境首选），把设备的 PCI BAR 用 mmap 映射到进程地址空间，在用户态直接通过 MMIO 按 NVMe 规范初始化控制器和队列对，最后**用轮询代替中断**。判断完成的关键是**相位位（phase tag）**：完成队列（CQ）是环形缓冲区，每条完成记录有一个 P 位，设备每写完一圈翻转一次相位，驱动记住「期望的相位」，`cpl->status.p == phase` 就表示这条是本圈新写入的。只靠读内存就能判断有没有完成，没有中断，也没有 MMIO。这里在不同架构上要加内存屏障：rv、la、ppc 用全屏障 `spdk_mb`，aa 用 `dmb oshld` 读屏障，x86 因为 TSO 强内存序不需要显式屏障，这是内存模型的一个实际例子。整个过程是异步的：提交 IO 后立即返回，用户主动调用 `process_completions` 时触发回调，轮询线程独占一个 CPU 核（忙轮询，用 CPU 占用换取吞吐量和低延迟）。SPDK、FUSE、io_uring 都在「减少用户态与内核态往返」和「中断还是轮询」之间做取舍：FUSE 把边界推到用户态守护进程，SPDK 让用户态完全接管设备，io_uring 在内核里做异步。

### 自己写文件系统时的取舍

从这六个实现可以总结出写文件系统的决定顺序：先定块设备接口（最少有 `read_block`/`write_block` 就能开始；目标是 Flash 的话必须把 `erase` 放进接口，这决定了用 COW 还是原地更新）；磁盘结构用 `#[repr(C)]` 加编译时大小断言锁定格式，读结构体优先用 `read_unaligned`，避免裸指针强制转换带来的对齐问题；寻址从间接块开始，要性能就用 extent 树，Flash 上用 CTZ 跳表；分配器最简单的是位图首次适配，Flash 上用 lookahead 窗口；块缓存在嵌入式上可以用单扇区窗口，通用场景用 LRU 加 Drop 回写，要写入性能就用回写缓存；**掉电一致性是最关键的区别**：成本最低的是 crc32c 校验（只能检测，不能恢复），要原子性就二选一，日志（数据写两次，靠重放恢复，适合磁盘）或 COW 加两块交替（写新块后原子切换根，不需要单独的日志区，适合 Flash）；目录用定长项最简单，大目录要用 htree 哈希索引，避免 O(n) 查找；还要注意文件系统元数据锁与块缓存锁的层次，防止死锁。成熟的一致性机制很难从零写对，绑定成熟的 C 库（lwext4 的做法）往往比纯重写（ext4_rs 缺日志）更可靠。

## 网络栈

网络栈把网卡收发字节抽象成可靠的字节流（TCP）、数据报（UDP）和加密通道（TLS）。下面四个协议栈覆盖了三种实现方式：smoltcp 和 lwip 是 L2 到 L4 的嵌入式协议栈，rustls 是 L6 的表示层（TLS），dpdk 是绕过内核的用户态数据面。TCP/IP 分层与源码的对应：应用（HTTP、DNS），TLS（rustls，在应用和 TCP 之间），L4 的 TCP/UDP（smoltcp 的 `socket/tcp.rs`，lwip 的 `core/tcp*.c`），L3 的 IP/ICMP/ARP，L2 的以太网，L1 的驱动（dpdk 的 PMD 在这一层绕过内核）。

### smoltcp

smoltcp 是 no_std、可以完全静态分配（不用堆）的协议栈，目录分为 wire（无状态的包编解码）、phy（设备抽象）、iface（收发调度）、socket（L4 状态机）、storage（环形缓冲区）。

**wire 层是无状态、不复制的访问器**：每个协议一个文件，直接在借来的字节切片上读写，不复制。字段偏移是 `Range<usize>` 常量，访问器直接在 `&[u8]` 上调用 `NetworkEndian::read_u16(&data[field::SRC_PORT])`（显式的大端网络字节序），序号用有符号的 `i32`（回绕比较自然变成有符号的环形运算）。两套类型把解析和语义分开：`Packet<&[u8]>`（薄包装，按需读取字段，检查长度）和 `Repr`（解析后的高层结构，`parse` 校验校验和，`emit` 写回），`parse` 失败返回 `Error` 而不是 panic（在裸机上安全）。

**phy 层的令牌模型是整个库的核心，也是不复制的关键。** `Device::receive` 不返回数据，而是返回一对令牌 `(RxToken, TxToken)`，真正的收发推迟到令牌被 `consume` 时：`RxToken::consume(|buf: &[u8]| …)` 的闭包拿到原地的接收缓冲区切片，处理完令牌就销毁；`TxToken::consume(len, |buf: &mut [u8]| …)` 先向驱动要一块 len 字节的发送缓冲区，闭包直接在里面构造整个以太网帧，返回时就发送，不分配堆内存，也不复制。`receive` 同时给出一个 `TxToken`，是为了能根据收到的包直接构造回复（如 ICMP echo 应答），不必为回复再分配。`DeviceCapabilities` 声明 MTU、突发大小，以及网卡硬件是否已经计算了 TCP/IP 校验和（软件就可以跳过）。

**iface 层是单线程的 poll 事件循环**：`poll` 把从设备接收（`socket_ingress`：`device.receive()` 拿到令牌对，在闭包里解析帧并分发给 IP/ARP，需要回复就用配对的 `tx_token`）和向设备发送（`socket_egress`：遍历 socket，把待发数据通过 `device.transmit()` 写出）结合在一起；发送 IP 包前先做邻居发现（ARP/NDISC，没有命中就发送请求并暂存这个包）。**没有内核线程，没有中断回调，也没有锁**，整个栈是一个纯状态机：输入时间戳，输出要发送的包，由宿主决定什么时候 poll，所以异步内核可以直接把它嵌进去。

**TCP 状态机**（一个文件，九千行）严格对应 RFC 793 的十一种状态（Closed、Listen、SynSent、SynReceived、Established、FinWait1、FinWait2、CloseWait、Closing、LastAck、TimeWait）。三次握手：主动打开时 `connect` 进入 SynSent 并发送 SYN，收到 SYN|ACK 后检查 `ack == local_seq_no + 1`（否则回 RST），进入 Established；被动打开时 `listen`，收到 SYN 进入 SynReceived，收到最后的 ACK 进入 Established。四次挥手由 `close` 根据当前状态决定（Established 进入 FinWait1 并发送 FIN，CloseWait 进入 LastAck），收到 FIN 时按 `Established→CloseWait`、`FinWait1→FinWait2/Closing/TimeWait`、`FinWait2→TimeWait` 等转换。`accepts()` 是没有副作用的预判断，用四元组判断「这个包是不是我的」，`challenge_ack_reply` 实现 RFC 5961 的 challenge ACK，防止盲注 RST。

它的超时重传（RTO）逐行实现了 RFC 6298（已与 RFC 核对一致）：第一次测量时 `srtt = R; rttvar = R/2`，之后 `rttvar = (1-1/4)·rttvar + 1/4·|srtt-R'|`（β=1/4），`srtt = (1-1/8)·srtt + 1/8·R'`（α=1/8），`RTO = SRTT + max(G, 4·RTTVAR)`，限制在 1 秒到 60 秒之间；重传后 RTO 加倍（指数退避），连续退避三次后清除测量值重新初始化，并用 Karn 算法在重传时丢弃当前的采样（避免重传造成的歧义影响 RTT）。快速重传在恰好收到第三个重复 ACK 时触发（不等 RTO，判断条件是载荷为空、ack 号重复、不是窗口更新）。拥塞控制做成 `Controller` trait 加 `AnyController` 枚举（None、Reno、Cubic，可以在运行时切换）：Reno 是慢启动时指数增长（`cwnd < ssthresh` 时 `cwnd += len`）、拥塞避免时线性增长、丢包时 `ssthresh` 减半；CUBIC（RFC 8312，`BETA=0.7`、`C=0.4`）用三次曲线 `W(t) = C(t-K)³ + W_max`，因为 no_std 下没有 `cbrt`，自己用牛顿迭代实现了立方根。发送窗口取 `min(对端通告的窗口, cwnd)`。

### lwip

lwip 与 smoltcp 定位相同，但设计很不一样。它不复制的关键是 **pbuf 链式缓冲区加分层预留头部空间**：pbuf 分四类（`PBUF_RAM` 在堆上一次分配结构体和数据，`PBUF_ROM` 引用只读常量，`PBUF_REF` 引用外部可变内存，`PBUF_POOL` 来自固定大小的池，可以链式地分散聚集）。最巧妙的是分层预留：`pbuf_alloc(layer, len, type)` 中 `layer` 枚举的数值就是要在数据前预留的字节数（`PBUF_TRANSPORT` 预留以太网、IP、TCP 头的空间），应用在传输层分配后，TCP、IP、以太网各层往下传时用 `pbuf_add_header` 把数据指针向前移，直接写自己的头部，全程不复制、不重新分配（与 smoltcp 的令牌原地构造、dpdk 的 mbuf headroom 是同一个思路）。

**lwip 与 smoltcp 的关键区别是有三套 API**（同一个核心，三种封装）：Raw/callback API（`tcp_new`，`tcp_bind`/`listen`/`connect`，注册 `tcp_recv`/`tcp_sent`/`tcp_accept` 回调，`tcp_write` 加 `tcp_output`；不需要操作系统，不复制，回调驱动，性能最高）；netconn API（顺序阻塞，跨线程时通过邮箱把每次调用打包成 `api_msg` 交给协议线程执行，避免应用线程直接访问协议核心）；socket API（在 netconn 上实现 BSD 兼容、fd 表、errno，用户缓冲区与 pbuf 之间全部复制，最重，但能直接运行 BSD socket 程序）。所有协议核心代码只在一个 `tcpip_thread` 里运行，这是 lwip 的并发模型：不用细粒度的锁，而是把所有操作放到一个线程里依次执行。可移植性靠 **sys_arch 移植层**（`sys.h` 定义操作系统需要提供的 `sys_sem_t`、`sys_mbox_t`、`sys_mutex_t`、`sys_thread`、`sys_now`，FreeRTOS、裸机、Linux 各写一份；`NO_SYS=1` 时这些是空宏，只能用 raw API），相当于 smoltcp 把时间戳和 poll 交给宿主。网卡抽象是 `struct netif` 的三个函数指针：`input`（收到包后向上交付）、`output`（IP 层调用，做 ARP 后转给 linkoutput）、`linkoutput`（真正把以太网帧写进网卡）。TCP 实现中的慢启动用 RFC 3465 的 ABC（按确认的字节数而不是 ACK 个数增加窗口，抵抗 ACK division 攻击），RTO 用 Jacobson/Karels 的定点形式 `(sa>>3)+sv`（`sa=8·SRTT`，`sv=4·RTTVAR`，用移位避免浮点），快速重传也是三个重复 ACK 触发，发送窗口同样取流量控制窗口和拥塞窗口中较小的一个。

### rustls

rustls 是 L6 的 TLS 1.2/1.3 库，有三处设计最值得学。一是**用类型状态表示握手状态机**：握手被建模成「一个状态处理输入，得到下一个状态」，客户端是 `ClientState` 枚举（`ServerHello`、`Tls12`、`Tls13` 等），每个状态是一个 `struct ExpectXxx`，它的 `handle` 校验收到的握手消息、推进密钥计算、返回下一个状态（消耗 `self`，转移成下一个类型）。非法的状态转移在编译时就写不出来：拿着 `ExpectServerHello` 只能处理 ServerHello，不能在握手完成前发送应用数据，因为类型上没有这条路径（smoltcp 和 lwip 是在运行时 `match state`）。二是**可替换的密码学后端 `CryptoProvider`**：它包含密码套件表、密钥交换组、安全随机数源，两个官方后端是 rustls-ring（默认，纯 Rust 加汇编，轻量）和 rustls-aws-lc-rs（通过 FIPS 140-3 认证），换后端只需改一行 `with_crypto_provider`，rustls 本身不依赖具体的密码库。三是**用见证类型表示证书校验结果**：`ServerVerifier::verify_server_cert` 返回 `ServerCertVerified`（零大小的见证类型，只有校验器能构造），调用方必须真的通过校验才能拿到这个证明，默认实现 `WebPkiServerVerifier` 基于 webpki 和 `RootCertStore`。

最关键的是 **sans-IO**：rustls 不碰 socket，把 IO 分成搬运密文和推进状态两步。`read_tls(rd)` 把宿主从 TCP 读到的密文放进内部缓冲区（不解密也不解析），`write_tls(wr)` 把准备好的待发密文写给宿主的 socket，`process_new_packets()` 才真正解密、推进状态机、产生明文，`wants_read`/`wants_write` 告诉宿主该读还是该写（配合 epoll 或 io_uring 做事件循环）。所以同一份 rustls 可以运行在阻塞的 std::net、tokio 异步、no_std 裸机和 QUIC 上，因为它对怎样收发字节没有任何假设，与 smoltcp（宿主决定何时 poll）、lwip 的 raw API（回调）一样，都把控制权交给调用方。使用 rustls 也很简单：网络栈只需把密文交给 `read_tls`、从 `write_tls` 取出，不用自己实现 TLS。

### dpdk

dpdk 不是协议栈（没有 TCP），而是收发包的基础设施：把网卡的 DMA 队列直接映射到用户态，CPU 不停地轮询。收包入口 `rte_eth_rx_burst` 是强制内联的 `static inline` 函数，核心是 `p->rx_pkt_burst(qd, rx_pkts, nb_pkts)` 这个**函数指针**：具体网卡的 PMD（Poll Mode Driver，在 `drivers/net/`）注册自己的向量化收包实现（AVX2、AVX512、NEON），一次调用从硬件的接收描述符环里取出一批 mbuf 指针，没有系统调用，也没有中断（只有链路状态变化时用中断），返回 0 就再次轮询，用 CPU 100% 忙等换取极低的延迟。标准的结构是 run-to-completion：同一个逻辑核在 `for(;;)` 里收一批包、处理、发出，全程不跨核、不入队、不切换线程，每个接收队列只由一个核轮询（不需要锁）。报文缓冲区 `rte_mbuf` 分两部分，不复制：`data_off` 是缓冲区内的 headroom（默认 128 字节，预留头部空间，让各层直接在前面加头部而不复制），mbuf 同时包含元数据和指向数据的指针，网卡 DMA 直接写进 mbuf 的数据区，应用全程只操作指针。内存的基础是 `rte_mempool`（固定大小的对象池，底层是无锁的 ring），加上每个核的本地缓存（避免每次分配都对共享 ring 做原子操作），以及 hugepage（用 2 MB 或 1 GB 的大页代替 4 KB 页，大幅减少 TLB 未命中，物理连续也方便网卡 DMA）。整个过程是：网卡把包 DMA 到 hugepage 里的 mbuf，PMD 轮询接收环，`rte_eth_rx_burst` 返回一批 mbuf 指针，应用处理，tx_burst，网卡 DMA 发出，完全绕过内核。

### 四个协议栈对比

smoltcp（Rust，单线程 poll，不需要锁，令牌借用切片、不复制，可以完全静态分配），lwip（C，单线程 tcpip_thread 依次执行，pbuf 链加分层预留，三套 API），rustls（Rust，sans-IO 由宿主控制 IO，用类型状态保证协议安全），dpdk（C，每个逻辑核轮询、不需要锁，mbuf 由 DMA 直接写入，hugepage）。建立一条 TCP 连接时各家的写法：smoltcp 是 `SocketSet::add(tcp::Socket::new(rx,tx))`，加 `socket.listen(port)` 或 `connect(cx, remote, local)`，再加 `recv(|buf| …)`（借用切片）或 `send_slice(data)`，事件靠宿主调用 `iface.poll()` 后检查 socket；lwip 的 socket API 是熟悉的 `lwip_socket`、`lwip_bind`、`lwip_connect`、`lwip_recv`（复制到用户缓冲区）、`lwip_send`，事件靠 `select`；lwip 的 raw API 是 `tcp_new`，`tcp_bind` 加 `tcp_listen` 或 `tcp_connect`，`tcp_recv` 回调（给出 pbuf），`tcp_write` 加 `tcp_output`，事件靠回调；POSIX 内核 socket 是 `socket`、`bind`、`listen`、`connect`、`recv`、`send`，配合 epoll 或 io_uring（见「Linux 系统调用与专有接口」）。它们在 BSD socket 全复制、阻塞的语义和不复制、事件驱动之间各取一个位置。

自己写网络栈可以这样做：设备抽象参考 smoltcp 的令牌模型（`Device::receive` 返回令牌对，在闭包里原地收发，适合 no_std 和异步内核）；wire 层照搬它的无状态访问器（`Packet`/`Repr` 两层，`parse` 返回 `Result`，序号用有符号环形运算）；TCP 状态机直接移植它的十一状态 match、RFC 6298 的 RttEstimator，以及可以切换的 Reno/Cubic；并发模型先用单线程 poll（不需要锁，最简单）；TLS 直接用 rustls（sans-IO，把密文交进交出即可，可以换成 ring 或国密后端）；以后需要高吞吐再参考 dpdk 的 PMD 函数指针、每核 mempool、hugepage 和 run-to-completion；移植层参考 lwip 的 sys_arch（定义宿主要提供的信号量、邮箱、时间等原语，一套接口多个平台实现）；握手和校验用类型状态，让非法状态在编译时就不能出现。**传输层不必从零写，用 smoltcp 包一层即可；TLS 不必自己实现，用 rustls 即可；确实需要极高吞吐时，再用 dpdk 那套用户态数据面**。

## 系统调用机制与架构 ABI

系统调用是内核向用户态提供的唯一合法接口（vDSO 除外）。一次 `write(1, "hi", 2)` 从 C 到内核的过程：libc 的 `write`，`__syscall3(SYS_write, 1, buf, 2)` 宏分发到架构相关的内联汇编，`ecall`/`syscall`/`svc` 陷入指令切换到内核态，内核的 `sys_write()`，返回值（成功是字节数，失败是 `-errno`）放回 a0/rax/x0，`__syscall_ret` 把 `-errno` 转换成「设置 errno 并返回 -1」。有三点始终不变：陷入指令是唯一的入口，寄存器约定固定了调用号和参数的位置，错误用负的返回值传递（errno 是 libc 在用户态加工出来的，内核里没有 errno 变量）。

### 系统调用与函数调用的区别

普通函数调用（`call`/`bl`/`jal`）只改 PC，仍在同一特权级、同一地址空间、同一个栈上。系统调用必须跨特权级（从用户态到内核态），所以不能用 call，必须用专门的陷入指令。CPU 执行这条指令时原子地完成一组动作（以 rv 为例）：保存返回地址（`sepc ← pc`，返回时加 4 跳过 ecall），保存状态（`sstatus.SPP` 记录原来的模式和中断使能），记录原因（`scause ← 8` 表示 U 态 ecall），跳转（`pc ← stvec`，内核预先设置的陷入向量），切换到 S 态。**通用寄存器不会自动保存**（与 x86 中断门压栈不同），内核陷入入口的第一件事就是把用户寄存器存进 trapframe，返回前再恢复，所以 ABI 必须固定每个寄存器放什么。

### 八种架构的调用约定

| 架构 | 陷入指令 | 调用号 | 参数寄存器 | 返回 | 错误传递 |
|:--:|:--:|:--:|:--:|:--:|:--:|
| rv（rv32/64） | `ecall` | a7 | a0 a1 a2 a3 a4 a5 | a0 | 负返回值 |
| aa（arm64） | `svc 0` | x8 | x0 x1 x2 x3 x4 x5 | x0 | 负返回值 |
| x86-64 | `syscall` | rax | rdi rsi rdx **r10** r8 r9 | rax | 负返回值 |
| i386 | `int 0x80` / `call gs:16` | eax | ebx ecx edx esi edi ebp | eax | 负返回值 |
| ARM(32) | `svc 0` | r7 | r0 r1 r2 r3 r4 r5 | r0 | 负返回值 |
| la64 | `syscall 0` | a7 | a0 a1 a2 a3 a4 a5 | a0 | 负返回值 |
| MIPS(o32) | `syscall` | v0 | a0 a1 a2 a3 加栈 | v0 | **单独的标志 a3** |
| ppc64 | `sc` | r0 | r3 r4 r5 r6 r7 r8 | r3 | **CR0.SO 位** |

现代 RISC（rv、aa、la64）的约定几乎一样：调用号放在编号较大的参数寄存器（a7、x8、a7），参数用 a0 到 a5，返回值复用 a0，这是重新设计、没有历史负担的好处。有三处特殊情况：

- **x86-64 的第四个参数用 r10 而不是 rcx**：`syscall` 指令的硬件行为是 `rcx ← rip`（返回地址）、`r11 ← rflags`，rcx 和 r11 被 CPU 占用，不能传参，所以把 System V 函数调用约定中放第四个参数的 rcx 换成 r10，clobber 列表显式列出 rcx 和 r11。内核一侧通过 MSR 配置入口（`LSTAR` 是入口地址，`STAR` 是段选择子，`FMASK` 是进入内核时清除哪些 rflags 位），返回用 `sysret`。它之前是 i386 的 `int 0x80`（软中断，慢）和 Intel 的 `sysenter`（用法繁琐），64 位模式统一用 AMD 的 `syscall`。
- **i386 的寄存器不够用**：调用号用 eax，参数用 ebx、ecx、edx、esi、edi、ebp 六个，全部用满；但 ebx 同时是位置无关代码的 GOT 基址寄存器，所以 PIC 下要在调用前后用 `xchg ebx, edx` 交换，第五、六个参数甚至要 push/pop ebp 走栈，这是 32 位寄存器少和 PIC 冲突留下的问题。它还把本机最优的系统调用指令的入口放在 TLS 偏移 16 处（`call *gs:16`），老 CPU 用 int 0x80，新 CPU 用 sysenter，运行时选择，这是 vDSO 用于选择指令的典型例子。
- **MIPS 和 ppc 不用负返回值**：MIPS o32 用单独的标志寄存器 a3（`a3 ≠ 0` 表示出错，这时 v0 是正的 errno），ppc 用条件寄存器的 CR0.SO 位（出错时置位）。musl 在内联汇编里手动把它们统一成负返回值的内部约定（MIPS 是 `a3 && v0>0 ? -v0 : v0`，ppc 是 `bns+; neg`）。

使用时，发起原始系统调用就是 `syscall(SYS_xxx, args...)` 或 musl 的 `__syscall(...)`；ARM 的 Thumb 模式下 r7 是帧指针，要临时换出再换回；32 位系统上 64 位的参数（如 `off_t`）要拆成两个寄存器，并按奇偶对齐。这些细节都由 libc 处理。

### musl 的 syscall 宏

musl 的分发方式很巧：用户写 `__syscall(SYS_write, 1, buf, 2)`，宏 `__SYSCALL_NARGS` 数出有三个参数，`__SYSCALL_DISP` 拼成 `__syscall3`，最后落到架构相关的内联汇编；`__scc` 把所有参数统一强制转换成 `long`（避免指针和整数混传的警告）。两个出口要分清：`__syscall(...)` 返回**原始值**（包括 `-errno`，内部使用），`syscall(...)` 经过 `__syscall_ret` 设置 errno（给应用使用）。阻塞类调用（read、write、wait）还有可取消的版本 `__syscall_cp`（多一层检查 pthread_cancel 取消标志的逻辑）。老架构（i386、老内核上的 arm）没有独立的 socket 系统调用，统一通过 `SYS_socketcall` 多路复用，新架构（rv、aa）才有独立的调用号，musl 用 `__alt_socketcall` 先试独立调用号，返回 `-ENOSYS` 再退回 socketcall。各架构内联汇编的写法不同：rv 在宏里直接 return，aa 和 arm 用 `do{}while(0)` 包裹以避免语句问题，x86_64、mips、la、ppc 因为约束各不相同，每个 `__syscallN` 都单独写完整的汇编。

### errno

常被误解的一点是：**errno 不是内核的概念，是 libc 加的**。内核没有全局的 errno 变量，而是把错误编码进返回值：返回 0 或正数表示成功，返回 `[-4095, -1]` 表示出错，取反就是 errno（4095 是内核的 `MAX_ERRNO`）。把它转换成 POSIX 的「设置 errno 并返回 -1」约定，集中在 `__syscall_ret` 一处：

```c
long __syscall_ret(unsigned long r) {
    if (r > -4096UL) { // [-4095,-1] 按无符号数都大于 -4096UL
        errno = -r;
        return -1;
    }
    return r;
}
```

`-4096UL` 这个界限很巧：合法的返回值最大是 mmap 返回的高地址指针（按无符号数也小于 `-4096UL`），而 `[-4095, -1]` 这 4095 个值留给 errno，一次无符号比较就能区分合法的大值和表示错误的负值，没有额外分支。errno 还是**线程局部**的：`errno` 宏实际上是 `(*__errno_location())`，`__errno_location` 返回当前线程 pthread 结构里的 `errno_val`（通过线程指针寄存器取得当前线程控制块，rv 是 tp，x86_64 是 fs base，aa 是 TPIDR_EL0），所以多个线程同时做系统调用不会互相覆盖 errno。完整过程是：内核 `return -EINVAL(-22)`，a0 = -22，`__syscall3` 原样带回，`syscall()` 经过 `__syscall_ret`，因为 `-22 > -4096UL` 成立，所以 `errno = 22, return -1`，应用调用 `perror` 打印 "Invalid argument"。

### vDSO

vDSO（virtual Dynamic Shared Object）是内核映射到每个进程地址空间里的一小段只读代码和数据页。有些只读、不涉及权限的系统调用（取时间、取 CPU 编号），如果每次都陷入内核，特权切换和 TLB、流水线的开销远大于实际工作；vDSO 让这些调用在用户态直接读取内核维护的共享数据页并返回，不用陷入。走 vDSO 的主要是 `clock_gettime`、`gettimeofday`、`getcpu`，各架构支持 vDSO 时间的时间不同（x86 最早，rv64 较晚，la64 最晚）。musl 查找 vDSO 实际上是**在用户态手写了一个很小的动态链接器**：从 auxv 的 `AT_SYSINFO_EHDR` 拿到 vDSO 的 ELF 头地址（内核启动进程时通过 auxv 传入），解析 program header 得到装载基址，解析 `PT_DYNAMIC` 得到符号表和版本表，按名字和版本找到 `__vdso_clock_gettime` 的地址；之后 `clock_gettime` 优先调用这个函数指针，失败才退回真正的系统调用。性能相差一个数量级（vDSO 的 clock_gettime 约几纳秒，真正的系统调用约几百纳秒）。不是所有调用都能走 vDSO，要求没有副作用、不修改内核状态、数据可以安全地只读公开。

### ABI 稳定性的五条规则

Linux 的原始系统调用 ABI 永久稳定，这是它和 Windows、macOS 的根本区别（见「跨操作系统的 API 与运行」）：内核保证 1990 年代直接用 `int 0x80` 的静态二进制今天仍能运行。代价是调用号只增不减，结构体字段只能追加。有五条规则：一是**系统调用号永不复用**（老二进制写死了调用号，复用等于让老程序调用到新功能，废弃的号只留空位，绝不回收）；二是**寄存器约定永不改变**（a7、x8、rax 放调用号是约定，改了所有现有二进制都会出错，新增只能开新号）；三是**结构体只在末尾加字段，不删除、不调整顺序**（例如从 `stat` 到 `statx`：不改旧结构，有新需求就开新调用和新结构）；四是**errno 列表只追加**（已经分配的值含义永远不变，范围固定在 1 到 4095）；五是**要改变约定只能用新调用号**（语义需要变化时，如 64 位 `time_t`，就新开 `clock_gettime64`、`statx`，旧调用号的语义不动）。这五条就是 Linux 系统调用只增不减、到 2026 年已有四百多个调用号的原因。

## Linux 系统调用与专有接口

下面逐个列出 Linux 的全部系统调用（功能、关键标志、内核实现、属于 POSIX 还是 Linux 专有），再深入几组 Linux 专有的接口（io_uring、epoll、futex、eventfd、inotify、seccomp、eBPF、splice）。编号以 `asm-generic/unistd.h` 为准，这是 rv64、aa64、la64 三个现代架构**共用**的一张表（x86_64 因为历史原因另有一张表，编号完全不同，下面并列对照）。

看表前先了解三点。一是**编号宏**：内核源码用 `__SC_3264(nr, sys_x32, sys_x64)`，32 位架构取 `*32` 的旧 large-file 版本，64 位架构取第二个（所以 rv64 上 `__NR3264_fstat` 就是 `sys_newfstat`，`__NR3264_lseek` 就是 `sys_lseek`，没有带 `*64` 后缀的混乱）；用 time32/time64 分裂宏包起来的项（clock_*、timer_*、futex、nanosleep 等）在 64 位架构上一律绑定 time64 的实现（不受 2038 年问题影响）。二是**现代架构以 `*at` 系列为主**：通用表删除了所有隐含当前目录的旧形式（没有单独的 `open`、`stat`、`mkdir`、`dup2`、`pipe`、`poll`、`select`，只有 `openat`、`fstatat`、`mkdirat`、`dup3`、`pipe2`、`ppoll`、`pselect6`），旧接口由 libc 展开成带 `AT_FDCWD` 的调用；x86_64 为了兼容保留了这些编号较小的旧接口。三是**归属**：POSIX（IEEE 1003.1 标准，包括 POSIX.1b 实时扩展中的 timer、clock、sched，以及 POSIX.1-2008 的 `*at` 系列）、Linux（专有，没有 POSIX 对应或语义不同）、非 POSIX 的 Unix 接口（来自 BSD 或 SVr4，但从未进入 POSIX 核心，如 chroot、flock、ptrace、ioctl）。

### 系统调用号 0–130

这一段包括异步 IO、扩展属性、文件描述符与事件通知、`*at` 路径系列、基本 IO 与零复制、stat/sync、定时器、capability、进程生命周期、futex、POSIX 定时器与时钟、调度、信号。

| 号(gen) | x86_64 | 名 | 功能 | 关键标志/常量 | 归属 |
|:--:|:--:|:--|:--|:--|:--:|
| 0–4 | 206–210 | io_setup/destroy/submit/cancel/getevents | 内核原生异步 IO（libaio）：建上下文、提交 iocb、收割完成事件 | IOCB_CMD_PREAD/PWRITE/FSYNC/POLL | Linux |
| 5–16 | 188–199 | {,l,f}setxattr/getxattr/listxattr/removexattr | 扩展属性读写列删（path/符号链接/fd 三套）；ACL、SELinux、capabilities 靠它落盘 | XATTR_CREATE/REPLACE；user./trusted./security. 命名空间 | Linux |
| 17 | 79 | getcwd | 取当前工作目录绝对路径（dcache 逆向走 dentry 树） | 太小返回 ERANGE | POSIX |
| 18 | 212 | lookup_dcookie | （已移除）oprofile 用，现绑 `sys_ni_syscall` 返回 -ENOSYS | — | Linux |
| 19 | 290 | eventfd2 | 创建事件计数 fd（线程间唤醒、集成进 event loop） | EFD_CLOEXEC/NONBLOCK/SEMAPHORE | Linux |
| 20–22 | 291/233/281 | epoll_create1/epoll_ctl/epoll_pwait | 可扩展 IO 就绪通知：建实例、增删改监视、等事件（附原子信号屏蔽） | EPOLL_CTL_ADD/MOD/DEL；EPOLLIN/OUT/ET/ONESHOT | Linux |
| 23/24 | 32/292 | dup/dup3 | 复制 fd（取最小可用号 / 复制到指定号） | dup3: O_CLOEXEC | POSIX/Linux |
| 25 | 72 | fcntl | fd 万能控制 | F_DUPFD/GETFD/SETFD/GETFL/SETFL/GETLK/SETLK/SETLKW/SETOWN/SETPIPE_SZ | POSIX |
| 26–28 | 294/254/255 | inotify_init1/add_watch/rm_watch | 文件系统事件监视（增删监视项） | IN_ACCESS/MODIFY/CREATE/DELETE/MOVED_FROM/MOVED_TO | Linux |
| 29 | 16 | ioctl | 设备/文件系统特殊控制（每驱动自定义 cmd 的万能后门） | cmd 由 _IOR/_IOW/_IOWR(type,nr,size) 编码 | Unix |
| 30/31 | 251/252 | ioprio_set/get | 设/取线程的 I/O 调度优先级 | IOPRIO_WHO_PROCESS/PGRP/USER；RT/BE/IDLE 类 | Linux |
| 32 | 73 | flock | BSD 风格整文件咨询锁 | LOCK_SH/EX/UN/NB | Unix(BSD) |
| 33–38 | 259/258/263/266/265/264 | mknodat/mkdirat/unlinkat/symlinkat/linkat/renameat | 命名空间增删的 `*at` 族（dirfd 相对路径） | AT_REMOVEDIR/AT_SYMLINK_FOLLOW；renameat 仅 aa/la 有、rv 无 | POSIX.1-2008 |
| 39/40/41 | 166/165/155 | umount2/mount/pivot_root | 卸载/挂载文件系统、在挂载命名空间内换根（容器用） | MS_RDONLY/NOSUID/NODEV/NOEXEC/BIND/MOVE/REMOUNT/REC；MNT_FORCE/DETACH | Linux |
| 42 | 180 | nfsservctl | （已移除，Linux 3.1 起 stub）`sys_ni_syscall` | — | Linux |
| 43/44 | 137/138 | statfs/fstatfs | 取文件系统整体统计（POSIX 用 statvfs） | — | Linux |
| 45/46 | 76/77 | truncate/ftruncate | 截断/扩展文件（path/fd） | — | POSIX |
| 47 | 285 | fallocate | 预分配/打洞文件区间 | FALLOC_FL_KEEP_SIZE/PUNCH_HOLE/ZERO_RANGE/COLLAPSE/INSERT_RANGE | Linux |
| 48 | 269 | faccessat | 检查可访问性（dirfd 相对） | R_OK/W_OK/X_OK/F_OK | POSIX.1-2008 |
| 49/50 | 80/81 | chdir/fchdir | 改当前工作目录（path/fd） | — | POSIX |
| 51 | 161 | chroot | 改进程根目录（需 CAP_SYS_CHROOT） | — | Unix |
| 52/53 | 91/268 | fchmod/fchmodat | 改权限（fd / dirfd+path） | S_ISUID/S_ISGID/S_ISVTX + rwx | POSIX |
| 54/55 | 260/93 | fchownat/fchown | 改属主（dirfd+path / fd） | AT_SYMLINK_NOFOLLOW/AT_EMPTY_PATH | POSIX |
| 56 | 257 | openat | 打开/创建文件（唯一 open 入口，dirfd 相对） | O_RDONLY/WRONLY/RDWR/CREAT/EXCL/TRUNC/APPEND/NONBLOCK/CLOEXEC/DIRECTORY/PATH/TMPFILE；AT_FDCWD | POSIX.1-2008 |
| 57 | 3 | close | 关闭 fd | — | POSIX |
| 58 | 153 | vhangup | 虚拟挂断当前 tty（登录前清理终端） | 需 CAP_SYS_TTY_CONFIG | Linux |
| 59 | 293 | pipe2 | 创建匿名管道（返回读写两端） | O_CLOEXEC/NONBLOCK/DIRECT | Linux |
| 60 | 179 | quotactl | 磁盘配额管理 | Q_QUOTAON/GETQUOTA/SETQUOTA；USR/GRP/PRJ QUOTA | Linux |
| 61 | 217 | getdents64 | 读目录项（64 位 inode） | d_type: DT_REG/DIR/LNK/CHR/BLK/FIFO/SOCK | Linux |
| 62 | 8 | lseek | 移动 fd 偏移指针 | SEEK_SET/CUR/END/DATA/HOLE | POSIX |
| 63/64 | 0/1 | read/write | 从/向 fd 读写 | — | POSIX |
| 65/66 | 19/20 | readv/writev | 散布读/聚集写到 iovec 数组 | — | POSIX |
| 67/68 | 17/18 | pread64/pwrite64 | 偏移读写（不动 fd 指针） | — | POSIX |
| 69/70 | 295/296 | preadv/pwritev | 偏移 + 向量读写 | — | Unix(BSD) |
| 71 | 40 | sendfile | fd 到 fd 的内核内零拷贝 | in_fd 须可 mmap | Linux |
| 72/73 | 270/271 | pselect6/ppoll | select/poll + 原子信号屏蔽 + 纳秒超时 | POLLIN/OUT/ERR/HUP/PRI | POSIX/Linux |
| 74 | 289 | signalfd4 | 把信号转成 fd 可读事件（与 epoll 整合） | SFD_CLOEXEC/NONBLOCK | Linux |
| 75/76/77 | 278/275/276 | vmsplice/splice/tee | 零拷贝：用户页拼进 pipe / pipe 在 fd 间搬运 / pipe 到 pipe 复制 | SPLICE_F_GIFT/MOVE/NONBLOCK/MORE | Linux |
| 78 | 267 | readlinkat | 读符号链接目标（不补 NUL） | — | POSIX.1-2008 |
| 79/80 | 262/5 | fstatat/fstat | 取文件元数据（dirfd+path / fd） | AT_SYMLINK_NOFOLLOW/AT_EMPTY_PATH/AT_NO_AUTOMOUNT | POSIX |
| 81/82/83 | 162/74/75 | sync/fsync/fdatasync | 触发回写（全局异步 / fd 数据+元数据 / fd 仅数据） | — | POSIX |
| 84 | 277 | sync_file_range | 范围回写（避开 inode 元数据） | SYNC_FILE_RANGE_WAIT_BEFORE/WRITE/WAIT_AFTER | Linux |
| 85–87 | 283/286/287 | timerfd_create/settime/gettime | 基于 fd 的定时器（到期 fd 可读） | CLOCK_REALTIME/MONOTONIC/BOOTTIME；TFD_TIMER_ABSTIME | Linux |
| 88 | 280 | utimensat | 设 atime/mtime（纳秒精度，dirfd+path） | UTIME_NOW/UTIME_OMIT；AT_SYMLINK_NOFOLLOW | POSIX.1-2008 |
| 89 | 163 | acct | 开/关进程统计 | name=NULL 关闭 | Unix |
| 90/91 | 125/126 | capget/capset | 取/设线程 capabilities 三集 | CAP_NET_ADMIN/SYS_ADMIN…；effective/permitted/inheritable | Linux |
| 92 | 135 | personality | 设执行域（模拟其他 Unix / 关 ASLR） | ADDR_NO_RANDOMIZE/READ_IMPLIES_EXEC/PER_LINUX32 | Linux |
| 93/94 | 60/231 | exit/exit_group | 退出当前线程 / 退出进程所有线程 | libc `exit(3)` 实际调 exit_group | POSIX/Linux |
| 95 | 247 | waitid | 精细等待子进程（siginfo_t） | P_PID/P_PGID/P_ALL/P_PIDFD；WEXITED/STOPPED/CONTINUED/NOHANG/NOWAIT | POSIX |
| 96 | 218 | set_tid_address | 设线程退出时清零并 futex 唤醒的地址（pthread_join 基础） | 配 CLONE_CHILD_CLEARTID | Linux |
| 97 | 272 | unshare | 解除与其他进程共享的上下文/命名空间 | CLONE_FILES/FS/NEWNS/NEWUTS/NEWIPC/NEWNET/NEWPID/NEWUSER/NEWCGROUP | Linux |
| 98 | 202 | futex | 用户态快速互斥的内核辅助（NPTL 全部锁的基础） | FUTEX_WAIT/WAKE/REQUEUE/CMP_REQUEUE/WAKE_OP/LOCK_PI/WAIT_BITSET；PRIVATE_FLAG | Linux |
| 99/100 | 273/274 | set/get_robust_list | 健壮 futex 链表（线程崩溃自动释锁） | — | Linux |
| 101 | 35 | nanosleep | 高精度睡眠（被信号打断回填剩余） | — | POSIX |
| 102/103 | 36/38 | getitimer/setitimer | 间隔定时器（到期发 SIGALRM/SIGVTALRM/SIGPROF） | ITIMER_REAL/VIRTUAL/PROF | POSIX(过时) |
| 104 | 246 | kexec_load | 装载新内核镜像供 reboot 直跳（跳过固件） | KEXEC_ON_CRASH/PRESERVE_CONTEXT | Linux |
| 105/106 | 175/176 | init_module/delete_module | 加载/卸载内核模块 | — | Linux |
| 107–111 | 222/224/225/223/226 | timer_create/gettime/getoverrun/settime/delete | POSIX 每进程定时器（关联 sigevent） | SIGEV_SIGNAL/THREAD/NONE；TIMER_ABSTIME | POSIX.1b |
| 112–115 | 227/228/229/230 | clock_settime/gettime/getres/nanosleep | POSIX 时钟操作（clock_gettime 是 vDSO 热路径） | CLOCK_REALTIME/MONOTONIC/BOOTTIME/PROCESS_CPUTIME_ID/THREAD_CPUTIME_ID | POSIX.1b |
| 116 | 103 | syslog | 内核日志环缓冲操作（dmesg；非 libc syslog(3)） | SYSLOG_ACTION_READ/READ_CLEAR/CLEAR/CONSOLE_LEVEL | Linux |
| 117 | 101 | ptrace | 进程追踪（调试器 attach/单步/读写寄存器内存） | PTRACE_TRACEME/ATTACH/SEIZE/CONT/SINGLESTEP/PEEK/POKE/GETREGSET/SYSCALL | Unix |
| 118–121 | 142/144/145/143 | sched_setparam/setscheduler/getscheduler/getparam | 设/取调度策略与参数 | SCHED_NORMAL/FIFO/RR/BATCH/IDLE/DEADLINE；RESET_ON_FORK | POSIX.1b |
| 122/123 | 203/204 | sched_set/getaffinity | 设/取线程 CPU 亲和位图 | cpu_set_t | Linux |
| 124 | 24 | sched_yield | 主动让出 CPU | — | POSIX |
| 125/126/127 | 146/147/148 | sched_get_priority_max/min、sched_rr_get_interval | 取某策略优先级界 / SCHED_RR 时间片 | — | POSIX.1b |
| 128 | 219 | restart_syscall | 重启被信号打断的可重启调用（内核自插，用户态不直调） | restart_block 机制 | Linux |
| 129/130 | 62/200 | kill/tkill | 给进程(组)发信号 / 给指定 tid 发信号（tkill 已弃用，用 tgkill） | pid>0 单进程/=0 同组/=-1 全部/<-1 进程组 | POSIX/Linux |

一个 musl 的 hello world 最先用到的几个调用都在这一段：`set_tid_address`(96) 和 `set_robust_list`(99) 是线程初始化最先发出的两个，再加上 `openat`、`read`、`write`、`close`、`exit_group` 就能运行一个静态程序（其余的 `mmap`、`brk`、`getrandom`、`prlimit64`、`uname` 在下一段）。

### 系统调用号 131–280

这一段包括实时信号、调度优先级、凭证与身份（uid、gid、组、会话）、系统标识与资源限制、prctl、POSIX 消息队列、SysV IPC（msg、sem、shm）、全部 socket 调用、内存管理（brk、mmap、mprotect、mlock、NUMA）、密钥环、进程创建（clone、execve）、命名空间、性能与安全（perf、seccomp、bpf）。

| 号(gen) | x86_64 | 名 | 功能 | 关键标志/常量 | 归属 |
|:--:|:--:|:--|:--|:--|:--:|
| 131 | 234 | tgkill | 向 tgid 内指定 tid 线程发信号（解决 tid 复用竞态，取代 tkill） | sig=0 探测存活 | Linux |
| 132 | 131 | sigaltstack | 设/取替代信号栈（主栈耗尽时 handler 用，配 SA_ONSTACK） | SS_ONSTACK/DISABLE/AUTODISARM | POSIX |
| 133 | 130 | rt_sigsuspend | 临时替换信号屏蔽集并挂起到捕获信号 | sigsetsize=8 | POSIX |
| 134 | 13 | rt_sigaction | 注册信号 handler（实时信号版，sigaction 底层） | SA_RESTART/SIGINFO/NODEFER/RESETHAND/ONSTACK | POSIX |
| 135 | 14 | rt_sigprocmask | 改/取线程信号屏蔽集 | SIG_BLOCK/UNBLOCK/SETMASK | POSIX |
| 136 | 127 | rt_sigpending | 查询挂起（pending 且 blocked）信号集 | — | POSIX |
| 137 | 128 | rt_sigtimedwait | 同步等待信号集（带超时，返回 siginfo） | — | POSIX.1b |
| 138 | 129 | rt_sigqueueinfo | 发携带 siginfo 数据的实时信号（队列化、带 sigval） | SI_QUEUE | POSIX |
| 139 | 15 | rt_sigreturn | 信号 handler 返回时恢复现场（trampoline 触发，用户态不直调） | 从栈上 sigframe 取 | Linux ABI |
| 140/141 | 141/140 | setpriority/getpriority | 设/取 nice 值（-20..19）。**注意 gen 与 x86 号互换** | PRIO_PROCESS/PGRP/USER | POSIX |
| 142 | 169 | reboot | 重启/关机/启停 Ctrl-Alt-Del/load kexec | LINUX_REBOOT_MAGIC1=0xfee1dead；RESTART/POWER_OFF/HALT/KEXEC | Linux |
| 143–150 | 114/106/113/105/117/118/119/120 | setregid/setgid/setreuid/setuid/setres{uid,gid}/getres{uid,gid} | 设/取 real/effective/saved uid·gid（三 id 模型，setres* 最不易错） | -1 保持 | POSIX/Linux |
| 151/152 | 122/123 | setfsuid/setfsgid | 设文件系统 uid/gid（NFSD 残留，返回旧值） | — | Linux |
| 153 | 100 | times | 取进程 user/sys + 子进程时间（tick） | 单位 _SC_CLK_TCK | POSIX |
| 154–157 | 109/121/124/112 | setpgid/getpgid/getsid/setsid | 进程组与会话（job control 基础；setsid 新建会话脱离终端） | — | POSIX |
| 158/159 | 115/116 | getgroups/setgroups | 取/设附属组列表（setgroups 需 CAP_SETGID，容器常 deny 以固定组） | size=0 仅返回数量 | POSIX |
| 160–162 | 63/170/171 | uname/sethostname/setdomainname | 取系统标识 / 设主机名（UTS 命名空间内）/ 设 NIS 域名 | — | POSIX/Linux |
| 163–165 | 97/160/98 | getrlimit/setrlimit/getrusage | 取/设资源限制、取 CPU/maxrss/缺页/上下文切换统计 | RLIMIT_NOFILE/STACK/AS/CPU/NPROC；RUSAGE_SELF/CHILDREN/THREAD | POSIX |
| 166 | 95 | umask | 设文件创建权限掩码（返回旧值） | 八进制如 022 | POSIX |
| 167 | 157 | prctl | 进程属性万能入口 | PR_SET_NAME/PDEATHSIG/DUMPABLE/NO_NEW_PRIVS/SET_SECCOMP/CAP_AMBIENT | Linux |
| 168 | 309 | getcpu | 取当前 CPU 号与 NUMA node（多走 vDSO） | — | Linux |
| 169/170 | 96/164 | gettimeofday/settimeofday | 取/设墙钟（秒+微秒；gettimeofday 走 vDSO；建议改 clock_gettime） | tz 已废弃 | POSIX |
| 171 | 159 | adjtimex | NTP 时钟微调（频率/相位/状态） | ADJ_OFFSET/FREQUENCY/STATUS | Linux |
| 172–178 | 39/110/102/107/104/108/186 | getpid/getppid/getuid/geteuid/getgid/getegid/gettid | 取进程/父进程/线程 ID 与各 uid/gid | gettid 单线程时=pid | POSIX/Linux |
| 179 | 99 | sysinfo | 取 uptime/loads/totalram/freeram/procs | — | Linux |
| 180–185 | 240–245 | mq_open/unlink/timedsend/timedreceive/notify/getsetattr | POSIX 消息队列（名以 `/` 开头、带优先级、空→非空通知） | O_CREAT/EXCL/NONBLOCK；SIGEV_SIGNAL/THREAD | POSIX.1b |
| 186–189 | 68/71/70/69 | msgget/msgctl/msgrcv/msgsnd | SysV 消息队列（按 type 选择性接收） | IPC_CREAT/EXCL/STAT/SET/RMID；IPC_NOWAIT/MSG_NOERROR | XSI |
| 190–193 | 64/66/220/65 | semget/semctl/semtimedop/semop | SysV 信号量集（原子 P/V 操作组，带超时） | sem_op<0 减/>0 加/=0 等零；SEM_UNDO；IPC_NOWAIT | XSI |
| 194–197 | 29/31/30/67 | shmget/shmctl/shmat/shmdt | SysV 共享内存（建、控、attach/detach 到地址空间） | SHM_HUGETLB/RDONLY/RND/REMAP；IPC_RMID/SHM_LOCK | XSI |
| 198–212 | 41/53/49/50/43/42/51/52/44/45/54/55/48/46/47 | socket/socketpair/bind/listen/accept/connect/getsockname/getpeername/sendto/recvfrom/setsockopt/getsockopt/shutdown/sendmsg/recvmsg | 套接字全族（每操作独立 syscall，非 i386 的 socketcall 多路复用） | AF_INET/INET6/UNIX/NETLINK/PACKET；SOCK_STREAM/DGRAM/RAW+CLOEXEC/NONBLOCK；MSG_PEEK/WAITALL/DONTWAIT/NOSIGNAL；SCM_RIGHTS 传 fd | POSIX |
| 213 | 187 | readahead | 预读文件到页缓存（提示） | — | Linux |
| 214 | 12 | brk | 设 program break（堆顶，libc sbrk 基础） | brk(0) 取当前 | Linux |
| 215/216 | 11/25 | munmap/mremap | 解除映射 / 调整映射大小或位置（大块 realloc） | MREMAP_MAYMOVE/FIXED/DONTUNMAP | POSIX/Linux |
| 217–219 | 248/249/250 | add_key/request_key/keyctl | 内核密钥环（加密钥、按需创建、管理） | type user/keyring/logon；KEYCTL_READ/REVOKE/SETPERM/SEARCH | Linux |
| 220 | 56 | clone | 创建线程/进程（按 flags 选共享什么） | CLONE_VM/FS/FILES/SIGHAND/THREAD/PARENT/CHILD_SETTID/NEWNS/NEWPID/NEWNET + 退出信号 | Linux |
| 221 | 59 | execve | 加载并替换当前进程映像 | — | POSIX |
| 222 | 9 | mmap | 映射文件/匿名页 | PROT_READ/WRITE/EXEC；MAP_PRIVATE/SHARED/ANONYMOUS/FIXED/NORESERVE/POPULATE/HUGETLB | POSIX |
| 223 | 221 | fadvise64 | 文件访问模式提示 | POSIX_FADV_SEQUENTIAL/RANDOM/WILLNEED/DONTNEED/NOREUSE | POSIX |
| 224/225 | 167/168 | swapon/swapoff | 启用/停用交换设备或文件（需 CAP_SYS_ADMIN） | SWAP_FLAG_PREFER/DISCARD | Linux |
| 226–231 | 10/26/149/150/151/152 | mprotect/msync/mlock/munlock/mlockall/munlockall | 改保护位、回写 mmap 脏页、锁页防换出 | PROT_*；MS_SYNC/ASYNC/INVALIDATE；MCL_CURRENT/FUTURE/ONFAULT | POSIX |
| 232/233 | 27/28 | mincore/madvise | 查询页是否驻留 / 给内核访问模式提示 | MADV_WILLNEED/DONTNEED/FREE/HUGEPAGE/COLD/PAGEOUT/WIPEONFORK | Linux/POSIX |
| 234 | 216 | remap_file_pages | 非线性文件映射（已弃用，保留 ABI 模拟实现） | — | Linux |
| 235–239 | 237/239/238/256/279 | mbind/get_mempolicy/set_mempolicy/migrate_pages/move_pages | NUMA 内存策略与页迁移。**gen 与 x86 号错位，易写反** | MPOL_DEFAULT/BIND/INTERLEAVE/PREFERRED；MPOL_MF_MOVE | Linux |
| 240 | 297 | rt_tgsigqueueinfo | 向指定线程发携带 siginfo 的信号 | — | Linux |
| 241 | 298 | perf_event_open | 创建性能计数 fd（PMU/tracepoint/软件事件，perf 与 eBPF 的基础） | PERF_FLAG_FD_CLOEXEC/PID_CGROUP | Linux |
| 242/243 | 288/299 | accept4/recvmmsg | accept + 原子设 fd flag / 一次收多条消息 | SOCK_CLOEXEC/NONBLOCK；MSG_WAITFORONE | Linux |
| 258/259 | — | riscv_hwprobe/riscv_flush_icache | **rv 专属**（在 244–259 架构保留区）：探测 hwcap（V/Zbb…）/ 刷 I-cache（JIT、自修改代码后必调，rv 的 I/D cache 非一致） | SYS_RISCV_FLUSH_ICACHE_LOCAL | Linux/rv |
| 260 | 61 | wait4 | 等待子进程结束（带 rusage） | WNOHANG/WUNTRACED/WCONTINUED | BSD |
| 261 | 302 | prlimit64 | 取/设任意进程资源限制（取代 g/setrlimit） | RLIMIT_* | Linux |
| 262/263 | 300/301 | fanotify_init/mark | 文件系统级监控/访问控制（可 OPEN_PERM 拦截） | FAN_CLASS_CONTENT/REPORT_FID；FAN_MARK_ADD/REMOVE；FAN_ACCESS/MODIFY/OPEN_PERM | Linux |
| 264/265 | 303/304 | name_to_handle_at/open_by_handle_at | 取文件持久句柄 / 用句柄打开（NFS/备份；后者需 CAP_DAC_READ_SEARCH） | AT_HANDLE_FID | Linux |
| 266 | 305 | clock_adjtime | 对指定时钟做 NTP 微调 | ADJ_* | Linux |
| 267 | 306 | syncfs | 同步 fd 所属文件系统的所有脏页 | — | Linux |
| 268 | 308 | setns | 把调用线程加入 fd 指向的命名空间（容器核心，配 unshare） | CLONE_NEWNET/NEWNS/NEWPID/NEWUTS/NEWIPC/NEWUSER/NEWCGROUP；fd 可为 pidfd | Linux |
| 269 | 307 | sendmmsg | 一次发送多条消息 | MSG_DONTWAIT | Linux |
| 270/271 | 310/311 | process_vm_readv/writev | 跨进程读/写内存（gdb/strace/CRIU） | — | Linux |
| 272 | 312 | kcmp | 比较两进程是否共享内核资源（CRIU 用） | KCMP_FILE/VM/FILES/FS/SIGHAND/IO/SYSVSEM/EPOLL_TFD | Linux |
| 273 | 313 | finit_module | 从 fd 加载内核模块（替代 init_module，支持签名校验） | MODULE_INIT_IGNORE_MODVERSIONS/COMPRESSED_FILE | Linux |
| 274/275 | 314/315 | sched_setattr/getattr | 统一接口设/取调度策略与参数（含 DEADLINE） | SCHED_NORMAL/FIFO/RR/BATCH/IDLE/DEADLINE | Linux |
| 276 | 316 | renameat2 | 带 flags 重命名（rv 删 renameat 只留此） | RENAME_NOREPLACE/EXCHANGE/WHITEOUT | Linux |
| 277 | 317 | seccomp | 安装/管理 seccomp BPF 过滤器 | SET_MODE_STRICT/FILTER；FILTER_FLAG_TSYNC/LOG/NEW_LISTENER | Linux |
| 278 | 318 | getrandom | 取加密强随机字节（musl 启动初始化 canary/ASLR 必调） | GRND_RANDOM/NONBLOCK/INSECURE | Linux |
| 279 | 319 | memfd_create | 创建匿名内存支撑 fd（可 ftruncate+mmap，可经 SCM_RIGHTS 传递） | MFD_CLOEXEC/ALLOW_SEALING/HUGETLB | Linux |
| 280 | 321 | bpf | eBPF 总入口（加载程序、操作 map） | BPF_PROG_LOAD/MAP_CREATE/LOOKUP/UPDATE/BTF_LOAD/LINK_CREATE | Linux |

通用表和 x86_64 表有几处「同名但编号不同且交错」的地方要注意：setpriority 和 getpriority 在两张表里互换（通用表 140/141，x86 是 141/140），mbind、set_mempolicy、get_mempolicy 三者在两张表里错开，msg 和 shm 系列中 ctl、snd、rcv 的相对位置也不同，转换系统调用号时必须查表，不能凭感觉。选用通用编号的内核只需实现一套 64 位路径，套接字和 IPC 也都有独立的调用号，不需要 i386 那样用 socketcall 和 ipc 多路复用。

### 系统调用号 281–471

这一段是 5.x 和 6.x 内核新增的系统调用。编号结构：281 到 294 是 64 位架构连续编号段末尾的 I/O、内存、同步扩展；**295 到 402 全部空着**（留给旧架构的 time32 迁移和以后扩展）；**403 到 423 是 `*_time64` 系列，只在 32 位架构上存在**（64 位架构的 `time_t` 本来就是 64 位，不分配这些号）；从 424（pidfd_send_signal）开始新增的系统调用大量出现，而且**从 424 起 x86_64 和通用表的编号一致**（内核维护者有意统一，所以 pidfd、io_uring、landlock、futex2、LSM、mseal、xattrat 这些在四种架构上编号相同）。表大小由 `__NR_syscalls = 472` 标出。

| 号 | 名 | 功能 | 关键标志/常量 | 引入 |
|:--:|:--|:--|:--|:--:|
| 281 | execveat | execve 的 fd-relative 版（防路径 TOCTOU） | AT_EMPTY_PATH/AT_SYMLINK_NOFOLLOW | 3.19 |
| 282 | userfaultfd | 把缺页交用户态处理（CRIU/VM 热迁移/GC barrier） | UFFD_USER_MODE_ONLY | 4.3 |
| 283 | membarrier | 跨核内存屏障（替代每核 IPI 全局 fence；无锁/RCU 用户态用） | GLOBAL/PRIVATE_EXPEDITED/SYNC_CORE/RSEQ | 4.3 |
| 284 | mlock2 | mlock 升级版（可只标记不立即锁页） | MLOCK_ONFAULT | 4.4 |
| 285 | copy_file_range | 内核内文件间拷贝（可走 reflink/服务端拷贝，零用户态搬运） | 保留=0 | 4.5 |
| 286/287 | preadv2/pwritev2 | preadv/pwritev + per-call flags | RWF_HIPRI/NOWAIT/DSYNC/SYNC/APPEND | 4.6 |
| 288–290 | pkey_mprotect/alloc/free | 内存保护键（x86 PKU / arm POE 硬件） | PKEY_DISABLE_ACCESS/WRITE | 4.9 |
| 291 | statx | stat 终极版（固定 128 字节跨架构 ABI，含出生时间/mount-id/DAX/直接 IO 对齐） | STATX_BASIC_STATS/BTIME/MNT_ID/DIOALIGN | 4.11 |
| 292 | io_pgetevents | 老式 AIO getevents + 信号屏蔽 | — | 4.18 |
| 293 | rseq | Restartable Sequences（每线程注册可被抢占重启的临界区，无锁 per-CPU 数据；glibc 2.35+ malloc tcache 关键） | RSEQ_FLAG_UNREGISTER | 4.18 |
| 294 | kexec_file_load | 用 fd 加载新内核镜像（可验签，比老 kexec_load 安全） | KEXEC_FILE_ON_CRASH/NO_INITRAMFS | 3.17 |
| 295–402 | （空洞保留） | 为旧架构 time32 迁移与未来扩展预留 | — | — |
| 403–423 | `*_time64`（仅 32 位） | clock/timer/pselect6/ppoll/futex/semtimedop 等的 64 位时间变体（64 位架构无此段） | — | 5.1 |
| 424 | pidfd_send_signal | 经 pidfd 发信号（原子、无 pid 复用竞态） | — | 5.1 |
| 425–427 | io_uring_setup/enter/register | 异步 IO 接口：建 SQ/CQ 双环共享内存、提交/等待、预注册 fd/buffer | IORING_SETUP_SQPOLL/IOPOLL/SINGLE_ISSUER/DEFER_TASKRUN | 5.1 |
| 428 | open_tree | 取挂载树的 O_PATH 类 fd（新挂载 API 第一块） | OPEN_TREE_CLONE/CLOEXEC/AT_RECURSIVE | 5.2 |
| 429 | move_mount | 把分离/已有挂载移到新位置 | MOVE_MOUNT_F/T_EMPTY_PATH/BENEATH | 5.2 |
| 430–433 | fsopen/fsconfig/fsmount/fspick | 新挂载 API 核心：按类型名建 fs 配置上下文、写参数建超级块、变成可挂载 fd、对已挂载取重配上下文 | FSCONFIG_SET_FLAG/STRING/PATH/CMD_CREATE；MOUNT_ATTR_* | 5.2 |
| 434 | pidfd_open | 为进程建稳定 fd（规避 pid 复用，可 poll 进程死亡） | PIDFD_NONBLOCK/THREAD | 5.3 |
| 435 | clone3 | clone 的结构体版（易扩展新 flag，set_tid 数组）；rv/aa 删 fork/vfork 后用它模拟 | CLONE_* 全集 + CLONE_INTO_CGROUP/CLEAR_SIGHAND/NEWTIME | 5.3 |
| 436 | close_range | 一次关 [first,last] fd 区间（exec 前清 fd 神器） | CLOSE_RANGE_CLOEXEC/UNSHARE | 5.9 |
| 437 | openat2 | openat 增强（`open_how` 结构体，精细路径解析约束） | RESOLVE_NO_XDEV/NO_SYMLINKS/BENEATH/IN_ROOT/CACHED | 5.6 |
| 438 | pidfd_getfd | 从别的进程 pidfd 偷一个 fd 到自己（容器/调试器） | 需 PTRACE_MODE_ATTACH | 5.6 |
| 439 | faccessat2 | faccessat 补真 flags 入口 | AT_EACCESS/AT_SYMLINK_NOFOLLOW/AT_EMPTY_PATH | 5.8 |
| 440 | process_madvise | 对另一进程地址空间下 madvise（Android LMK/用户态回收） | MADV_COLD/PAGEOUT/WILLNEED/DONTNEED | 5.10 |
| 441 | epoll_pwait2 | epoll_pwait 的纳秒超时版 | — | 5.11 |
| 442 | mount_setattr | 原子改挂载属性，支持 idmapped mounts（容器 UID 映射） | AT_RECURSIVE；MOUNT_ATTR_RDONLY/NOSUID/IDMAP | 5.12 |
| 443 | quotactl_fd | quotactl 的 fd 版 | Q_* | 5.14 |
| 444–446 | landlock_create_ruleset/add_rule/restrict_self | 非特权沙箱：建 ruleset、加规则（路径/网络端口）、不可逆套到当前进程 | LANDLOCK_RULE_PATH_BENEATH/NET_PORT | 5.13 |
| 447 | memfd_secret | 创建连内核都不能读的秘密内存 fd（从内核直映射移除） | SECRETMEM_UNCACHED | 5.14 |
| 448 | process_mrelease | 强行释放正在死亡进程的内存（加速 OOM 回收） | — | 5.15 |
| 449 | futex_waitv | 一次等多个 futex（游戏/Wine 多对象等待，futex2 起点） | FUTEX_32/PRIVATE_FLAG；clockid | 5.16 |
| 450 | set_mempolicy_home_node | 给 VMA 区间设首选归属 NUMA node（分层内存/CXL） | 保留=0 | 5.17 |
| 451 | cachestat | 查文件区间页缓存状态（cached/dirty/writeback/evicted，比 mincore 精准） | range={off,len} | 6.5 |
| 452 | fchmodat2 | fchmodat 补真 flags 入口 | AT_SYMLINK_NOFOLLOW/AT_EMPTY_PATH | 6.6 |
| 453 | map_shadow_stack | 为 CET/影子栈分配专用映射（控制流完整性，x86 CET / rv Zicfiss / aa GCS） | SHADOW_STACK_SET_TOKEN | 6.6 |
| 454–456 | futex_wake/wait/requeue | futex2 全集（支持 U8/U16/U32/U64 尺寸 + NUMA 亲和 + mask 选择 + clockid） | FUTEX2_SIZE_*/NUMA/PRIVATE | 6.7 |
| 457/458 | statmount/listmount | 按 mount-id 查单个挂载详情 / 列子挂载（替 /proc/self/mountinfo 解析） | STATMOUNT_SB_BASIC/MNT_OPTS/FS_TYPE；LISTMOUNT_REVERSE | 6.8 |
| 459–461 | lsm_get/set_self_attr、lsm_list_modules | 统一查/设当前进程 LSM 安全属性、列激活的 LSM 模块（替 /proc/self/attr） | LSM_ATTR_CURRENT/EXEC/FSCREATE；LSM_ID_* | 6.8 |
| 462 | mseal | 内存封印（禁止对区间再 mprotect/munmap/mremap，防 ROP 改 VMA，受 OpenBSD mimmutable 启发，不可逆） | 保留=0 | 6.10 |
| 463–466 | setxattrat/getxattrat/listxattrat/removexattrat | 扩展属性的 `*at` 族（相对 dirfd、对无读权限 fd 操作，免走 /proc/pid/fd） | AT_SYMLINK_NOFOLLOW/AT_EMPTY_PATH；XATTR_CREATE/REPLACE | 6.13 |
| 467 | open_tree_attr | open_tree + 同时设挂载属性（克隆挂载并原子改 idmap/只读） | OPEN_TREE_CLONE/AT_RECURSIVE + mount_attr | 6.15 |
| 468/469 | file_getattr/setattr | inode 扩展属性的系统调用版（取代 FS_IOC_FSGETXATTR ioctl：项目配额 id/文件标志/extent size hint） | FS_XFLAG_* | 6.17 |
| 470 | listns | 枚举 namespace id（容器自省，配合 nsfs） | CLONE_NEW{NS,UTS,IPC,USER,PID,NET,CGROUP,TIME} | 6.16/6.17 |
| 471 | rseq_slice_yield | rseq 协作式让步（用户态在 rseq 时间片用尽时无副作用让出 CPU） | — | 主线最新 |

以上是 Linux 从 0 到 471 的全部系统调用（通用编号；x86_64 在 281 到 423 段的编号不同，已在前两段并列）。从中能看出现代系统调用的五种设计方式：**结构体参数加 size 字段**（clone3、openat2、statx、statmount、file_getattr，增加字段不破坏 ABI，内核用 `copy_struct_from_user` 兼容新旧大小）；**`*at` 和相对 fd 的路径**（避免路径的检查与使用之间被替换，适合沙箱和容器）；**把对象变成 fd**（如 pidfd，用稳定的句柄代替容易被复用的整数 id）；**拆分多功能的大调用**（futex2 拆分旧 futex，新的挂载 API 拆分旧的 mount）；**加强安全**（landlock 非特权沙箱、memfd_secret、mseal 内存封印、影子栈 CFI、LSM 自省）。281 号以后**全部是 Linux 专有的**，POSIX 只定义了 mlock、stat、exec 这类基础语义，所有 `*at2`、pidfd、io_uring、futex2、landlock、mseal、xattrat 都是 Linux 独有的扩展。


### Linux 专有接口

这些是 Linux 在 POSIX 之外提供的接口，要运行 nginx、Redis、tokio、systemd 和容器运行时就必须实现。理解它们有一条主线：**就绪模型（readiness）与完成模型（completion）**。同步阻塞的 `read`/`write` 是「现在就做，做不完就睡眠」；就绪模型（select、poll、epoll，加上 eventfd、timerfd、signalfd、inotify）由内核告诉你「哪个 fd 现在不会阻塞」，再由你自己去 read/write；完成模型（io_uring）由内核告诉你「做完了，结果在这里」，把提交和完成分成两个共享内存的环，可以批量处理，甚至不用系统调用。Linux 高级 I/O 的演进，就是从「问内核能不能做」变成「让内核替我做完」。

**io_uring（完成模型，5.1，2019）。** 它只有三个系统调用：`io_uring_setup`（创建实例，内核分配 SQ 环、CQ 环、SQE 数组并返回偏移）、`io_uring_enter`（提交 SQE 和/或等待 CQE）、`io_uring_register`（预先注册 fd、缓冲区等长期资源）。创建后用三个固定的 mmap 偏移把内核的环映射到用户地址空间：SQ 环存的是索引数组（多这一层间接，SQE 槽可以乱序复用），CQE 数组直接在 CQ 环里，SQE 数组在单独的区域（默认 64 字节，passthrough 用 128 字节）；生产者写 tail，消费者写 head，用 release/acquire 配对保证对方能看到环里的数据。有两个设计让不用系统调用做 I/O 成为可能：一是 **SQPOLL**（`IORING_SETUP_SQPOLL`），内核启动一个轮询线程不断读取 SQ 的 tail，应用只要写 SQE 并更新 tail（纯用户态的内存写入），完全不需要系统调用，只有轮询线程休眠后才需要一次 `io_uring_enter` 把它唤醒；二是用 `io_uring_register` 预先固定缓冲区和 fd，配合 `READ_FIXED` 和 `IOSQE_FIXED_FILE`，省掉每次 IO 时 `get_user_pages` 固定页面和 `fget/fput` 的引用计数。它的操作码包括文件 IO、网络（accept、connect、send、recv）、`POLL_ADD`（把 epoll 式的就绪等待也放进完成环，io_uring 可以完全取代 epoll）、文件管理（openat、statx、renameat）、零复制（splice、tee、provide_buffers），还有 SQE 之间的链接（`IOSQE_IO_LINK` 表示顺序依赖，`IO_DRAIN` 表示等前面全部完成）。CQE 的 `user_data` 原样返回，用来找到对应的请求；`res` 相当于对应系统调用的返回值（负数是 -errno）。使用时没人直接操作环，Jens Axboe 提供的 liburing 封装了 setup、mmap 和环操作的内存屏障（`io_uring_prep_read`、`submit`、`wait_cqe`），tokio-uring 和 Redis 都用它。它让磁盘文件也能真正异步读写（POSIX aio 只对 O_DIRECT 有效，glibc 的 aio 是用线程池模拟的），但攻击面很大，内核提权漏洞中有相当比例来自它，ChromeOS 和 Android 曾经默认禁用，需要配合 seccomp 和 `IORING_REGISTER_RESTRICTIONS` 限制。

**epoll（就绪模型的标准做法）。** 三个系统调用：`epoll_create1` 创建实例，`epoll_ctl`（ADD、MOD、DEL）增删改监视项，`epoll_wait`、`pwait`、`pwait2` 等待事件。它比 select/poll 好的两点在源码里看得很清楚：一是所有被监视的 fd 以 `epitem` 的形式挂在一棵**红黑树**（`ep->rbr`）上，fd 集合常驻内核，每次等待不用重新传入（增删查 O(log N)）；二是只有当前已经就绪的 epitem 挂在**就绪链表**（`ep->rdllist`）上，`ep_poll` 只遍历这条短链表（复杂度取决于就绪数，而不是 fd 总数）。O(1) 的事件分发靠**回调**：`epoll_ctl(ADD)` 时把 `ep_poll_callback` 挂到目标 fd 自己的等待队列上，设备就绪时（网卡收到数据，socket 变为可读）驱动调用 `wake_up` 唤醒等待队列，触发这个回调，把 epitem 加入就绪链表并唤醒阻塞在 `epoll_wait` 上的进程。不是在等待时轮询所有 fd，而是每个 fd 就绪时自己加入就绪链表。边沿触发与水平触发的区别也在这里：水平触发（LT，默认）报告给用户后仍把 epitem 留在就绪链表上（只要 fd 仍可读，每次都报告），边沿触发（ET，`EPOLLET`）报告一次后不再放回，只有下一次回调触发才重新加入（用户必须一直读到 EAGAIN，否则会漏掉事件）；`EPOLLONESHOT` 报告一次后禁用（多线程分发时防止竞争），`EPOLLEXCLUSIVE` 让监视同一个 fd 的多个 epoll 只唤醒一个（解决 accept 的惊群问题）。它最大的缺点是**对普通文件没有意义**（普通文件 poll 总是返回可读，但磁盘 read 仍会阻塞），这正是需要 io_uring 的原因。

**把内核事件变成 fd 的几种接口。** 思路是「一切皆文件描述符」：把计数器、定时器、信号、文件系统事件都变成可以 read、可以被 epoll 或 io_uring 监视的 fd，一个事件循环就能统一管理所有异步来源。`eventfd` 是最轻量的内核计数器（write 增加计数，read 取出并清零；`EFD_SEMAPHORE` 时每次减 1），内核子系统（KVM 的 irqfd、io_uring 的 `REGISTER_EVENTFD`）也用它向用户态发送完成通知。`timerfd` 把高精度定时器变成 fd（read 返回到期次数，`TFD_TIMER_CANCEL_ON_SET` 可以在系统时间被修改时取消，用于检测时间跳变）。`signalfd` 把异步信号变成可以同步 read 的事件（避免信号处理函数中只能调用 async-signal-safe 函数的限制，前提是要读的信号先用 `sigprocmask` 阻塞）。`inotify` 监视文件系统事件（`IN_CREATE`、`MODIFY`、`MOVED_FROM`、`MOVED_TO` 等，用 `cookie` 把 rename 的两端配对），但不递归，队列可能溢出。`fanotify` 比 inotify 多两点：能监视整个挂载点或文件系统，并且能**做访问权限决定**（`FAN_OPEN_PERM` 拦截后由用户写回 `FAN_ALLOW` 或 `FAN_DENY`），杀毒软件和主机入侵检测用它挂钩内核。BSD 中对应的是 kqueue 的 `EVFILT_TIMER`、`EVFILT_SIGNAL`、`EVFILT_VNODE`（kqueue 不需要把它们变成 fd），Linux 选择了 fd 的做法。

**futex（用户态锁在内核中的慢路径）。** NPTL/glibc 实现 pthread 的 mutex、cond、rwlock、semaphore，以及 Rust 的 `std::sync::Mutex`，底层只用这一个系统调用。核心是**没有竞争时完全在用户态完成**：用原子 CAS 修改 futex word（一个 4 字节对齐的用户空间 u32）就能加锁和解锁，不进内核；只有 CAS 失败（有竞争）时才用 `FUTEX_WAIT` 陷入内核睡眠，解锁方用 `FUTEX_WAKE` 陷入内核唤醒。`FUTEX_WAIT` 是原子的「比较并阻塞」（检查 `*uaddr==val` 和加入等待队列在内核里原子完成，避免在检查之后、入队之前丢失唤醒）。还有 `FUTEX_REQUEUE`（把等待者从一个 futex 批量移到另一个，是 pthread 条件变量的 signal/broadcast 避免惊群的关键）、PI 系列（用 rt_mutex 实现优先级继承，防止优先级反转），以及配套的 robust list（线程异常退出时内核自动释放它持有的 robust futex，防止死锁）。新的 `futex_waitv`（5.16）一次等待多个 futex（游戏引擎，以及 Proton 转换 Windows `WaitForMultipleObjects` 时需要）。它和 io_uring 的 SQPOLL 思路相同：快路径在用户态，慢路径才陷入内核。

**userfaultfd（把缺页交给用户态处理）。** `userfaultfd` 返回一个 fd，通过 ioctl 握手（`UFFDIO_API`）、登记 VMA（`UFFDIO_REGISTER` 的 MISSING、WP、MINOR 模式）、处理缺页（`UFFDIO_COPY` 填入数据，`ZEROPAGE` 填零，`CONTINUE` 用已有页的内容，`WRITEPROTECT` 修改写保护）。登记过的 VMA 发生缺页时，内核不自己分配页，而是构造一条 `uffd_msg`（包含出错地址和原因）放进 uffd 的消息队列，并挂起出错的线程；监控线程 `read(uffd)` 取出消息，决定填入什么页，填完后唤醒出错线程重试。它用于虚拟机热迁移的 post-copy（先启动虚拟机，访问还没传过来的页时拦截，再从源端取）、CRIU 的懒恢复、用户态 GC；uffd 本身可以被 epoll 监视，缺页也成了事件循环中的一种异步事件。

**seccomp-bpf（用 cBPF 过滤系统调用）。** `seccomp` 安装一个 classic BPF 程序，对每个系统调用做判断，过滤器的输入是 `seccomp_data`（系统调用号、架构、指令指针、六个参数；只能看寄存器里的标量，不能解引用指针，这是出于检查与使用之间被修改的安全考虑；并且必须先检查架构，防止通过另一种 ABI 绕过）。判定结果从严到宽：`KILL_PROCESS`、`KILL_THREAD`、`TRAP`（发送 SIGSYS）、`ERRNO`（直接返回指定的 errno）、`USER_NOTIF`（转给用户态监督者）、`TRACE`、`LOG`、`ALLOW`，所有过滤器执行完后取最严的结果。非特权进程安装过滤器前必须先 `prctl(PR_SET_NO_NEW_PRIVS, 1)`，防止通过 setuid 提权绕过。`SECCOMP_USER_NOTIF` 让监督进程通过一个 fd 接收被拦截的系统调用，替目标进程模拟执行（容器运行时允许容器调用 `mount`、但由运行时代为执行，就是靠它）。Docker 的默认配置、浏览器渲染进程的沙箱、systemd 的服务隔离（`SystemCallFilter=`）都基于它，也常用它封锁 io_uring 的攻击面。

**eBPF（把经过验证的程序放进内核）。** 一个系统调用 `bpf(cmd, attr, size)` 管理一切：`BPF_PROG_LOAD` 加载程序，`BPF_MAP_CREATE/LOOKUP/UPDATE` 操作 map。三种对象：map（内核、eBPF 程序、用户态共享的键值存储，类型有 HASH、ARRAY、PERF_EVENT_ARRAY、RINGBUF 等）、program（类型有 SOCKET_FILTER、KPROBE、XDP（在网卡驱动最早的收包阶段运行，用于防御 DDoS 和负载均衡）、TRACEPOINT、SCHED_CLS 等几十种）、**验证器（verifier）**。验证器是 eBPF 安全的基础，静态地证明程序一定会结束且执行安全（循环有界、检查内存访问越界、跟踪寄存器的类型和取值范围、限制栈深度），通过后用 JIT 编译成本机代码，性能接近原生。它让用户态把逻辑安全地放到内核的热路径上，与 io_uring（把 I/O 交给内核异步执行）正好相对，都是为了减少用户态与内核之间的开销；seccomp 可以看作它的前身和特例，现在的内核用同一个 `bpf_prog` 承载两者。

**零复制的管道系列。** 思路是数据在内核的页和管道缓冲区之间移动，不经过用户态缓冲区，省掉两次复制。`sendfile`（从 fd 直接传到 fd，nginx 用它零复制地发送静态文件，文件页直接交给网卡 DMA，内部实际上走 splice）；`splice`（通用的零复制，但**必须有一端是 pipe**，管道是中转站，文件到文件要经过 file 到 pipe 再到 file 两段，`SPLICE_F_MOVE` 移动页的引用而不是复制数据）；`tee`（复制 pipe 的内容，两端都是 pipe，像 shell 的 tee 一样一路存盘一路转发）；`vmsplice`（把用户内存页映射进 pipe，配合 `SPLICE_F_GIFT` 可以零复制地交出页面，但要注意页的所有权，Dirty Pipe 漏洞就与此有关）；`copy_file_range`（文件之间复制，如果两个 fd 在同一个文件系统上、且文件系统实现了 `copy_file_range` 或 `remap_file_range`，就能在服务端复制（NFS 不用把数据传回客户端）或用 reflink（Btrfs、XFS 共享 COW extent，瞬间复制大文件且不占额外空间），否则退回逐页 splice）。零复制适合与完成模型一起用，io_uring 有 `OP_SPLICE` 和 `OP_TEE`，把零复制也变成异步、批量的。下面回到用户态，看程序怎样在这套接口上运行起来。

## C 运行时启动链

`main` 不是程序真正的入口。内核 `execve` 之后到 `main` 之前，有一段由 C 运行时（CRT）负责的初始化，把裸的指令流变成可以使用 TLS 和 errno、有栈保护、全局构造函数已经执行过的环境。下面用 musl 说明这个过程，再对照 relibc 看用 Rust 重写是什么样子。

### 三个启动对象：crt1、Scrt1、rcrt1

链接器按可执行文件的类型选择三个启动对象之一：`crt1.o`（静态可执行文件或非 PIE 的动态可执行文件）、`Scrt1.o`（PIE，位置无关可执行文件，现在的默认）、`rcrt1.o`（静态 PIE，没有 ld.so 但有 ASLR）。常被误解的一点是 **Scrt1 和 crt1 的源码完全相同**，`Scrt1.c` 整个文件就是 `#include "crt1.c"`，区别只在编译时加了 `-fPIC`（取 `main`、`_init` 的地址时通过 GOT 间接访问，从而位置无关），并不是 Scrt1 多了什么逻辑。rcrt1 则把 ld.so 的自举放进了 crt：静态 PIE 没有外部的 ld.so，但作为 PIE 仍需处理自身的相对重定位，rcrt1 复用 `ldso/dlstart.c` 的自重定位代码，再用一个极简的 `__dls2` 直接转到 `__libc_start_main`（不需要完整的动态链接器，因为静态 PIE 没有外部依赖）。这是在「要 ASLR」和「不依赖 ld.so」之间的折中。

### 两阶段启动

musl 的启动过程是：`_start`（汇编），`_start_c`，`__libc_start_main`，两个阶段，`main`。

**第 0 步是架构相关的 `_start` 汇编**，以 rv 为例：设置 `gp`（rv 的全局指针，小数据寻址的基址；设置 gp 本身时要用 `.option norelax` 包住，因为此时还不能用基于 gp 的 relaxation），`mv a0, sp`（a0 指向内核建好的初始栈 `[argc, argv…, envp…, auxv…]`），`lla a1, _DYNAMIC`，`andi sp, sp, -16`（栈按 16 字节对齐，psABI 的要求），`tail _start_c`。它不保存任何寄存器（内核只保证 sp 有效，其余未定义），用尾调用是因为不会返回。

**第 1 步 `_start_c` 只解析栈**：`argc = p[0]`，`argv = p+1`，调用 `__libc_start_main(main, argc, argv, _init, _fini, 0)`。

**第 2 步 `__libc_start_main` 完成真正的初始化**，分两步。`__init_libc` 是早期初始化：找到 auxv（在 envp 末尾的 NULL 之后）并解析到定长数组，取出 `AT_HWCAP`、`AT_PAGESZ`、`AT_SYSINFO_EHDR`（vDSO 基址），设置 `__progname`，初始化 TLS，初始化栈保护，做 setuid 安全检查（如果 ruid≠euid 或 AT_SECURE，检查 fd 0、1、2 是否被恶意关闭，如果是 `POLLNVAL` 就 `open("/dev/null")` 占住这个位置，防止「setuid 程序的 fd 1 被攻击者关掉，第一次 open 拿到 fd 1，之后 printf 把机密写进攻击者的管道」）。然后经过一道屏障进入 stage2：执行 `_init` 和 `.init_array`（C++ 全局构造函数、`__attribute__((constructor))`），再 `exit(main(argc, argv, envp))`。退出的过程是对称的：`exit`，atexit 和 `.fini_array`，`__stdio_exit`（刷新所有 FILE），`_Exit`，`SYS_exit_group`（结束进程的所有线程）。

TLS 初始化：rv 的线程指针就是硬件寄存器 `tp`（x4），`__set_thread_area` 只有 `mv tp, a0; ret`，**rv 设置 TLS 不用进内核**（x86 要 `arch_prctl`），直接写寄存器；rv 使用 variant I 布局（TLS 在线程指针之上），DTV 项有 0x800 的偏移。栈保护的 canary 从 `AT_RANDOM` 取 16 字节，64 位下还把 canary 的第 2 个字节设成 NUL，牺牲 8 位熵，让 `strcpy`、`gets` 这类遇到 NUL 就停止的字符串函数无法完整地泄露或覆盖 canary；NUL 放在第 2 个字节而不是第 1 个，是为了让差一字节的溢出仍能被检测到。

### 用四种手段固定初始化顺序

这是 musl 启动代码里最细致的设计：编译器的内联、寄存器提升、把取地址当作链接时常量折叠，都可能破坏「先初始化 TLS、SSP、重定位，再运行用户代码」这一严格顺序。musl 不依赖编译器对全局初始化顺序的判断，用四种手段逐一固定。一是 `__init_libc` 强制 `__noinline__` 并使用外部链接：如果它被内联进 `__libc_start_main`，它的大栈帧（auxv 数组、poll fd 数组）会和 `main` 在同一帧里，在进程的整个生命周期都占着这块栈；强制不内联，初始化的栈帧用完就释放。二是进入 stage2 前一条不生成指令的 `__asm__("" : "+r"(stage2) : : "memory")`：`__init_ssp` 和 `__init_tls` 刚刚写好 canary 和线程指针，如果编译器把 stage2 中读 canary 或读 tp/errno 的指令提前到 `__init_libc` 之前，就会读到未初始化的值；`"memory"` clobber 告诉编译器这里可能读写任意内存，`+r(stage2)` 让 stage2 指针经过这条 asm，强制它的副作用排在 `__init_libc` 之后。三是在 ld.so 中**用运行时的符号查找作为屏障**：`errno` 和 `tp` 的读取被编译器视为 pure/const（可以随意提前），直接用 C 调用下一阶段时，读取 `&errno` 的指令可能被提前到 TLS 建立之前，所以 musl 用 `find_sym` 查找 `__dls2b` 的地址再间接调用，编译器无法跨过这个运行时才知道的地址重新排序。四是自举时 `GETFUNCSYM` 用 `volatile asm` 加静态内存指针：下一阶段函数的地址如果被编译成 PC 相对地址或链接时常量，可能还没被重定位，所以把地址存进一个已经过相对重定位修正的 `static` 指针，用带 `"+m"` 的 volatile asm 强制从内存读取，而不是内联计算。这四种手段是解决「自举时不能依赖尚未完成的重定位和初始化」这一问题的经典办法。

### 编译器隐式调用的运行时例程

还有一层代码和 libc 一起链接进每个程序，但不属于 libc：编译器遇到硬件不支持的操作（64 位除法、软浮点、`memcpy` 整块复制、rv 没有 M 扩展时的乘除法）时，会调用一组约定好的符号。GCC 用 libgcc，Clang 和 Rust 用 compiler-rt（C 和汇编）或 compiler-builtins（Rust 重写），三者 ABI 兼容（名字和语义相同，命名有编码规则，如 `__udivdi3` 表示无符号除法、di 即 64 位、第 3 种形式）。`memcpy`、`memset`、`memmove` 是这一层的核心，所以**裸机 Rust 也必须提供这几个符号**（`core` 的切片复制、`Vec`、格式化最终都会调用它们）。目标 CPU 有硬件除法时（RV64GC 的 M 扩展），编译器直接生成指令；只有 RV64I（没有 M）或 128 位运算才会调用 `__udivdi3` 的软件长除法、`__mulxi3` 的移位加法乘法。

rv 有一个特有的代码大小优化——**millicode `__riscv_save_N`/`__riscv_restore_N`**（`-msave-restore`）：不在每个函数的序言里内联「压栈保存 s0 到 s11 和 ra」、在尾声里内联「出栈恢复」，而是调用一段公共的库例程，序言变成一条 `call t0, __riscv_save_N`，尾声变成 `tail __riscv_restore_N`。有几处细节：**用 t0 作链接寄存器**（调用 save 时返回地址放在 t0 而不是 ra，因为 save 要保存 ra，不能覆盖它，save 结尾用 `jr t0` 返回）；**多个入口依次落下执行**（`__riscv_save_4` 直接落到 `_3_2`，按函数实际使用的 callee-saved 寄存器数量选择入口）；rv64 两个一组、rv32 四个一组，以保持 16 字节栈对齐；**必须静态地放进每个共享库**（save/restore 用 t0，而 PLT 头也会改写 t0，不能通过 PLT 间接调用）。收益是每个函数的序言和尾声从约 N×4 字节缩小到约 8 字节，嵌入式代码明显变小，代价是多两次跳转。Rust 的 compiler-builtins 是 compiler-rt 的 no_std Rust 移植（作为 Rust sysroot 的一部分发布），整数除法用了比普通长除法更快的分情况算法（按位宽和硬件选择 trifecta、binary_long、delegate、asymmetric），还为 ARM EABI 提供 `__aeabi_uidiv` 别名。

`crti.o` 和 `crtn.o` 在 musl 和 relibc 里**都是空的**：现在只用 `.init_array` 和 `.fini_array`，不再拼接旧的 `.init`/`.fini` 段，保留它们只是为了给链接器提供占位（relibc 在注释里写了原因："we don't support _init/_fini functions, only init/fini arrays"）。errno 也在这里处理：内核返回 `-errno`，libc 的 `__syscall_ret` 把大于 `-4096UL` 的返回值转换成「设置 errno 并返回 -1」（见「errno」），errno 本身是线程局部的（`errno` 宏就是 `(*__errno_location())`，指向当前线程 pthread 结构里的 `errno_val`）。

### relibc：用 Rust 重写启动链

relibc 是 Redox OS 的 Rust libc（同时支持 redox 和 linux），是用 Rust 重写 libc 的直接参考。它每种架构用 `global_asm!` 写 `_start`（rv 同样 `mv a0, sp` 传递栈指针，但用普通调用 `jalr ra` 而不是 `tail`，因为入口函数返回 `!`，不会返回；x86 版还要初始化 SSE 和 x87 的控制字），`relibc_start_v1` 相当于 `__libc_start_main`（标注 `#[inline(never)]`，相当于 musl 的 noinline 屏障）。它的初始化顺序里有和 musl 相同的顾虑：`alloc_init()` 设置 Rust 全局分配器（dlmalloc-rs）之前，注释写着 "if any rust memory allocation happen before this step we are doomed"，与 musl「TLS 和 SSP 先于一切」一样，对初始化顺序非常谨慎。errno 用 `#[thread_local]` 的 `Cell`，错误码转换用类型化的 `Errno(c_int)` 加 `or_minus_one_errno`（把 `Result<T, Errno>` 转换成「成功返回值，失败设置 errno 并返回 -1」），是 musl 用 `-4096` 判断的类型安全版本，更不容易漏设 errno。它的 crti、crtn 也故意是空的。这说明用 Rust 或 Zig 写 libc 时，启动链、错误码、TLS 都能用类型系统重新表达，不必照搬 C 的魔数和隐式约定。

## libc 与标准库

到这里运行环境已经建好，接下来是每个 C 和 Rust 程序都离不开的标准库。C 这边列出六个 C 库的头文件、函数，以及哪些函数会调用系统调用；Rust 这边列出 core、alloc、std 三层的模块。**libc 实现的是「ISO C 标准函数加 POSIX 扩展」的语义，是用户态与内核 ABI 之间的桥梁**：同一个 `printf`，在用户这一侧语义相同，落到内核的方式却因实现而不同。

### 六个 C 库与系统调用的方式

六个 C 库的区别主要在两点：实现了多少（完整 POSIX 还是子集），以及怎样与内核交互（直接 `ecall` 还是调用桩函数）。版本和定位：

<div align="center">

| 实现 | 版本 | 语言 | 定位 |
|:--:|:--:|:--:|:--:|
| musl | 1.2.6 | C | Linux 静态链接的首选，约 80K 行，一个函数一个文件，方便查找 |
| newlib | 4.6.0 | C | 经典的嵌入式 libc，系统调用通过桩函数（操作系统适配层）实现 |
| picolibc | 1.8.11 | C | newlib 与 AVR-libc 结合的精简版，面向 32/64 位 MCU，使用 tinystdio |
| uclibc-ng | 1.0.54 | C | 嵌入式 Linux，用 Kconfig 按模块裁剪 |
| baselibc | git | C | 裸机最小实现，只有 string、stdio、stdlib、malloc 子集 |
| relibc | git | Rust | Redox 的 Rust libc，支持 Redox 和 Linux 两种后端 |

</div>

怎样落到系统调用是这六个 C 库最根本的区别。musl 直接用内联汇编 `ecall`：每个函数在 `src/<分类>/<fn>.c` 里调用 `__syscall(SYS_xxx,…)`，`arch/<arch>/syscall_arch.h` 把参数放进 a0 到 a5、调用号放进 a7，执行 `ecall`。newlib 用桩函数：libc 上层调用 `_read`、`_write`、`_sbrk`、`_close`、`_fstat`、`_exit` 等十七到三十个弱符号的系统调用桩，由 BSP、libgloss 或 RTOS 提供。`libgloss/riscv/` 里就有两套实现（`sys_*.c` 模拟 Linux，真的执行 `ecall`；`semihost-sys_*.c` 是半主机调试，通过 `EBREAK` 交给调试器），换掉这一层就能移植到任意裸机，这是 newlib 可移植性的核心。picolibc 也用桩函数，但更少（tinystdio 只需要 `read`、`write`）。uclibc-ng 和 musl 一样直接调用系统调用，再加上 Kconfig 裁剪。baselibc 没有系统调用的概念，只有纯计算、静态堆上的 malloc，stdio 通过用户提供的字符设备回调输出（可以直接写 UART 的 MMIO）。relibc 用 Rust 的 `Pal` trait 抽象两种后端，Linux 后端用 `syscall!` 宏直接发起系统调用。

同一个 `printf`：musl 里 `vfprintf` 把输出积累在 `FILE` 缓冲区，刷新时调用 `writev`；newlib 里依次是 `_vfprintf_r`、`_write_r`，最后是 BSP 提供的 `_write` 桩；baselibc 里逐个字符调用 `FILE` 的 `put` 函数指针（可能直接写 UART 寄存器）。**名字和语义相同，落到底层的方式完全不同**，这就是「libc 是 ABI 的桥梁」。

### 标准头文件

使用 libc 先要知道有哪些头文件、各自负责什么、目标实现是否提供。下面按 ISO C、POSIX、`sys/*` 子系统、网络四组列出（√ 表示提供，~ 表示部分提供或被裁剪，✗ 表示不提供；newlib 一列包括 picolibc）。

ISO C 标准头文件（C89 到 C23），是任何独立运行环境都应该有的最小集合：

<div align="center">

| 头文件 | 职责 | musl | newlib/pico | uclibc-ng | baselibc | relibc |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `assert.h` | `assert` 宏 + `static_assert` | √ | √ | √ | √ | √ |
| `ctype.h` | 字符分类/转换 | √ | √ | √ | √ | √ |
| `errno.h` | `errno` + `E*` 错误码 | √ | √ | √ | ✗ | √ |
| `float.h` | 浮点极限 `FLT_*`/`DBL_*` | 编译器 | √ | √ | ✗ | √ |
| `limits.h` | 整数极限 `INT_MAX`/`PATH_MAX` | √ | √ | √ | ✗ | √ |
| `locale.h` | `setlocale`/`localeconv` | √ | √ | √ | ✗ | √ |
| `math.h` | 实数数学 | √ | √ | √ | ✗ | √(openlibm) |
| `setjmp.h` | `setjmp`/`longjmp` | √ | √ | √ | ✗ | √ |
| `signal.h` | `signal`/`raise`/`sig*` | √ | √ | √ | ✗ | √ |
| `stdarg.h` | `va_list`/`va_start` | 编译器 | √ | √ | 编译器 | √ |
| `stddef.h` | `size_t`/`NULL`/`offsetof` | √ | √ | √ | √ | √ |
| `stdint.h` | 定宽整型 | √ | √ | √ | √ | √ |
| `stdio.h` | 标准 I/O | √ | √ | √ | ~ | √ |
| `stdlib.h` | 通用工具 | √ | √ | √ | ~ | √ |
| `string.h` | 串/内存 | √ | √ | √ | √ | √ |
| `time.h` | 时间 | √ | √ | √ | √ | √ |
| `wchar.h`/`wctype.h` | 宽字符 + 分类 | √ | √ | √ | ✗ | √ |
| `complex.h`/`fenv.h`/`tgmath.h` | 复数/浮点环境/泛型数学(C99) | √ | √ | √ | ✗ | ~ |
| `inttypes.h`/`stdbool.h`/`iso646.h` | C99 整型格式/布尔/运算符别名 | √ | √ | √ | √ | √ |
| `stdalign.h`/`stdnoreturn.h`/`uchar.h` | C11 对齐/不返回/char16_32 | √ | √ | ~ | ✗ | √ |
| `stdatomic.h` | C11 原子 | 编译器 | √ | ~ | ✗ | ~ |
| `threads.h` | C11 线程 `thrd_`/`mtx_`/`cnd_` | √ | ~ | √ | ✗ | √ |

</div>

POSIX/UNIX 头文件是操作系统服务的入口，baselibc 这类裸机实现几乎都不提供（它根本没有操作系统可以调用）：

<div align="center">

| 头文件 | 职责 | musl | newlib/pico | uclibc-ng | relibc |
|:--:|:--:|:--:|:--:|:--:|:--:|
| `unistd.h` | POSIX 核心 syscall 包装 read/write/fork/exec/pipe | √ | √(stub) | √ | √ |
| `fcntl.h` | `open`/`fcntl`/`O_*` | √ | √ | √ | √ |
| `dirent.h` | 目录遍历 `opendir`/`readdir` | √ | √ | √ | √ |
| `dlfcn.h` | 动态加载 `dlopen`/`dlsym` | √ | ~ | √ | √ |
| `pthread.h`/`semaphore.h`/`sched.h` | POSIX 线程/信号量/调度 | √ | ~(RTOS) | √ | √ |
| `poll.h`/`termios.h` | 多路复用/终端 | √ | ~ | √ | √ |
| `regex.h`/`glob.h`/`fnmatch.h`/`wordexp.h` | 正则/通配/词展开 | √ | √ | √ | ~ |
| `grp.h`/`pwd.h`/`shadow.h` | 用户/组/影子口令数据库 | √ | ~ | √ | √ |
| `utmp.h`/`pty.h` | 登录记录/伪终端 | √ | ✗ | √ | √ |
| `mqueue.h`/`aio.h`/`spawn.h` | 消息队列/异步 I/O/`posix_spawn` | √ | ✗ | √(librt) | √ |
| `search.h`/`getopt.h`/`libgen.h` | 容器/选项解析/路径名 | √ | √ | √ | ~ |
| `iconv.h`/`langinfo.h`/`nl_types.h`/`monetary.h` | 字符集/本地化信息/消息目录 | √ | ~ | √ | ~ |
| `netdb.h`/`ifaddrs.h`/`resolv.h` | 名字解析/网卡枚举/DNS 底层 | ~ | ~ | √ | √ |
| `syslog.h`/`ftw.h`/`ucontext.h` | 系统日志/目录树遍历/用户上下文 | √ | ~ | √ | ~ |
| `crypt.h`/`err.h`/`paths.h`/`strings.h` | 口令散列/BSD 报错/路径常量/BSD 串 | √ | ~ | √ | √ |
| `alloca.h`/`malloc.h`/`endian.h`/`byteswap.h` | 栈分配/分配扩展/字节序 | √ | √ | √ | √ |
| `elf.h`/`link.h`/`features.h` | ELF 结构/`dl_iterate_phdr`/特性宏 | √ | ~ | √ | √ |

</div>

`sys/*` 子系统头文件是 Linux/POSIX 内核服务的细分入口，musl 的 `include/sys/` 下共 70 个，主要的如下（这一层基本上有操作系统才有，所以只列用途）：

<div align="center">

| 头文件 | 职责 |
|:--:|:--:|
| `sys/types.h` | 基础类型 `pid_t`/`off_t`/`mode_t`/`ssize_t` |
| `sys/stat.h` | 文件元数据 `struct stat` + `stat`/`chmod`/`mkdir` |
| `sys/mman.h` | 内存映射 `mmap`/`mprotect`/`madvise`/`mlock`/`shm_open` |
| `sys/socket.h`/`sys/un.h` | 套接字 + UNIX 域 |
| `sys/wait.h` | 进程等待 `wait`/`waitpid`/`waitid` + `W*` 宏 |
| `sys/ioctl.h` | 设备控制 `ioctl` + 请求号 |
| `sys/time.h`/`sys/times.h`/`sys/timex.h` | 取时/进程时/NTP 微调 |
| `sys/select.h`/`sys/epoll.h` | `select`/`pselect` + epoll 三个组件 |
| `sys/uio.h` | 矢量 I/O `readv`/`writev` + `struct iovec` |
| `sys/eventfd.h`/`sys/timerfd.h`/`sys/signalfd.h` | fd 化事件源 |
| `sys/inotify.h`/`sys/fanotify.h` | 文件监控/访问通知 |
| `sys/sendfile.h` | 零拷贝 `sendfile` |
| `sys/mount.h`/`sys/statfs.h`/`sys/statvfs.h` | 挂载/文件系统统计 |
| `sys/resource.h` | 资源限制 `getrlimit`/`getrusage`/`getpriority` |
| `sys/ptrace.h`/`sys/prctl.h`/`sys/personality.h` | 进程跟踪/控制/执行域 |
| `sys/random.h`/`sys/membarrier.h` | `getrandom`/`membarrier` |
| `sys/sysinfo.h`/`sys/utsname.h`/`sys/auxv.h` | 系统信息/`uname`/`getauxval` |
| `sys/ipc.h`/`sys/msg.h`/`sys/sem.h`/`sys/shm.h` | System V IPC |
| `sys/xattr.h`/`sys/quota.h`/`sys/file.h` | 扩展属性/磁盘配额/`flock` |
| `sys/sysmacros.h` | `major()`/`minor()`/`makedev()` |
| `sys/cachectl.h` | rv/MIPS `cacheflush` |

</div>

网络协议头文件（`netinet`、`arpa`、`net`、`netpacket`、`scsi`）：`netinet/in.h`（`sockaddr_in`、`IPPROTO_*`、`htons`）、`netinet/tcp.h`（`TCP_NODELAY`）、`netinet/{ip,udp,icmp6,igmp}.h`（报头结构）、`arpa/inet.h`（`inet_pton`、`inet_ntop`、`htonl`）、`arpa/nameser.h`（DNS 报文格式）、`net/if.h`（`if_nametoindex`、`struct ifreq`）、`netpacket/packet.h`（`AF_PACKET` 原始包）、`scsi/sg.h`（SCSI 直通 ioctl）。

### 函数与系统调用

下面列出 musl 各类函数（musl 一个函数一个文件，文件名就是函数名，便于列全），并标出每类调用哪个系统调用。总的规律是：**输入输出一定调用系统调用，纯算法和查表都在用户态，同步原语是用户态快路径加 futex 慢路径，读取时间靠 vDSO 避免陷入内核**。

**字符串与内存（string.h、strings.h，src/string 下 78 个文件，全部在用户态，不调用系统调用）**：`memcpy memmove memset memcmp memchr memmem mempcpy memrchr`、`strcpy strncpy stpcpy strcat strncat strcmp strncmp strcoll strxfrm strchr strrchr strchrnul strlen strnlen strspn strcspn strpbrk strstr strtok strtok_r strsep strdup strndup strerror strerror_r strsignal strverscmp`、BSD 的 `strlcpy strlcat`、GNU 的 `strcasestr`；strings.h 的 `bcmp bcopy bzero index rindex ffs ffsl strcasecmp strncasecmp explicit_bzero swab`（`explicit_bzero` 比较特殊，防止编译器把清除敏感内存的操作优化掉）；宽字符版本 `wcscpy wcscmp wcschr wcslen wmemcpy wmemset` 等结构相同。包括 rv、x86、aa 上优化过的 `memcpy`，但仍只用普通运算指令。

**标准 I/O（stdio.h，src/stdio 下 118 个文件，缓冲在用户态，刷新和填充时调用系统调用）**：打开与缓冲 `fopen freopen fdopen fmemopen open_memstream fopencookie fclose fflush setvbuf setbuf`、格式化输出 `printf fprintf sprintf snprintf dprintf asprintf v*`、格式化输入 `scanf fscanf sscanf v*`、按字符、行、块的 I/O `fgetc getc ungetc fputc putc fgets getline getdelim fputs fread fwrite`、定位 `fseek ftell fgetpos rewind`、状态 `feof ferror clearerr`、锁 `flockfile`、文件操作 `remove rename tmpfile`、管道 `popen pclose`、`perror` 和全局的 `stdin/stdout/stderr`。对应的系统调用：

<div align="center">

| 函数族 | 落到的 syscall |
|:--:|:--:|
| `fopen`/`freopen` | `openat` |
| `fread`/`fgetc`/缓冲填充 | `read`（经 `__stdio_read`→`readv`） |
| `fwrite`/`printf`/flush | `writev`（经 `__stdout_write`） |
| `fseek`/`ftell` | `lseek` |
| `fclose` | `close` + flush |
| `rename` | `renameat2` |
| `popen`/`pclose` | `pipe2`+`clone`+`execve`+`wait4` |
| `sprintf`/`snprintf`/`sscanf`/`fmemopen` | 无 syscall（纯内存格式化） |

</div>

**通用工具（stdlib.h，src/stdlib、malloc、exit、env、prng、search）**：数值转换 `atoi atol atof strtol strtoll strtoul strtod`、整数运算 `abs labs div ldiv imaxdiv`、排序和查找 `qsort qsort_r bsearch`、伪随机数 `rand srand random drand48` 系列、内存分配 `malloc calloc realloc free reallocarray aligned_alloc posix_memalign memalign malloc_usable_size`、环境变量 `getenv secure_getenv setenv unsetenv putenv clearenv`、控制 `exit _Exit quick_exit abort atexit`、进程 `system getloadavg`、多字节 `mblen mbtowc mbstowcs`、`realpath mkstemp mkdtemp`。对应的系统调用：`malloc`、`calloc`、`realloc`、`free` 小块用 `brk`，大块用 `mmap`、`munmap`、`madvise`（mallocng）；`getenv`、`setenv` 不调用系统调用（操作进程内的 `environ` 数组）；`exit` 执行 atexit 后调用 `exit_group`；`abort` 用 `tgkill` 给自己发 SIGABRT；`system` 用 `posix_spawn` 加 `wait4`；`realpath` 用 `readlink` 和 `stat`；`mkstemp` 用 `openat(O_CREAT|O_EXCL)` 加 `getrandom`；`rand`、`qsort`、`bsearch`、`strtol`、`atoi`、`abs`、`div`、`srand48` 系列都是纯计算。

**字符分类（ctype.h、wctype.h，src/ctype 下 42 个文件，在用户态查表，不调用系统调用）**：`isalnum isalpha isdigit islower isupper isspace isprint ispunct isxdigit tolower toupper`，宽字符版本 `iswalpha iswdigit towlower towupper wctype wctrans wcwidth wcswidth`，都是查位掩码表或 Unicode 属性表。

**数学（math.h、complex.h、fenv.h，src/math 下 254 个、complex 下 68 个、fenv 下 23 个文件，基本都是浮点计算，不调用系统调用）**：三角函数 `sin cos tan asin acos atan atan2` 和双曲函数 `sinh cosh tanh`、指数和对数 `exp exp2 log log2 log10 expm1 log1p`、幂和根 `pow sqrt cbrt hypot`、取整 `ceil floor round trunc rint lrint lround`、取余和分解 `fmod remainder modf frexp ldexp scalbn`、符号和比较 `copysign signbit fabs fmax fmin fma fpclassify isnan isinf`、特殊函数 `erf tgamma lgamma` 和 Bessel 函数 `j0 j1 y0 y1`（每个都有三种精度）；复数 `cabs carg creal cimag conj cexp clog cpow csqrt`；浮点环境 `feclearexcept fetestexcept feraiseexcept fegetround fesetround feholdexcept`。都不调用系统调用：math 和 complex 用软件或硬件浮点指令，fenv 的舍入模式和异常位读写 `fcsr` CSR（是指令，不是系统调用）。

**POSIX 核心（unistd.h，src/unistd 下 84 个文件，大多数是对系统调用的一对一封装）**，最能体现 libc 是 ABI 的桥梁：I/O `read write pread pwrite readv writev`、fd `close dup dup2 dup3 pipe pipe2 lseek fsync fdatasync ftruncate isatty ttyname`、进程 `_exit fork getpid getppid getuid geteuid setuid setgid setsid setpgid getpgid nice getlogin`、文件系统 `access faccessat chdir fchdir getcwd chown link symlink readlink unlink rmdir`、其他 `alarm pause sleep usleep sync gethostname`。RV64 上的调用号（asm-generic 编号，RV64、ARM64、LA64 共用）：

<div align="center">

| 函数 | RV64 syscall 号 |
|:--:|:--:|
| `read` / `write` | 63 / 64（read 是取消点） |
| `close` / `lseek` | 57 / 62 |
| `dup3` / `pipe2` | 24 / 59（dup/pipe 用其简化形） |
| `fsync` / `ftruncate` | 82 / 46 |
| `fork` | `clone`=220（`clone(SIGCHLD,0)`，无独立 fork 号） |
| `getpid` | 172（无取消点） |
| `access` | `faccessat`=48 |
| `getcwd` | 17 |
| `unlink`/`rmdir` | `unlinkat`=35 |
| `link`/`symlink`/`readlink` | `linkat`=37/`symlinkat`=36/`readlinkat`=78 |
| `sleep`/`nanosleep` | `nanosleep`=101 |
| `isatty`/`ttyname` | `ioctl`=29(TCGETS) |

</div>

**文件元数据与目录（sys/stat.h、fcntl.h、dirent.h）**：`stat fstat lstat fstatat statvfs chmod fchmod mkdir mkdirat mkfifo mknod umask utimensat`、`open openat creat fcntl posix_fadvise posix_fallocate`、`opendir readdir closedir rewinddir seekdir scandir alphasort posix_getdents`。对应的系统调用：musl 1.2.x 中 `stat` 系列优先用 `statx`=291（不支持时退回 `fstatat`）；`open`、`creat` 用 `openat`=56；`fcntl`=25；`mkdir` 用 `mkdirat`=34；`opendir` 加 `readdir` 用 `openat` 加 `getdents64`=61（readdir 解析 dirent 缓冲区）；`scandir` 的 alphasort 排序是纯计算。

**内存映射（sys/mman.h，src/mman 下 13 个文件）**：`mmap munmap mprotect mremap msync madvise mlock munlock mlockall mincore shm_open shm_unlink memfd_create`。对应的系统调用：`mmap`=222（RV64 直接用 mmap，没有 mmap2）、`munmap`=215、`mprotect`=226、`mremap`=216；`shm_open`、`shm_unlink` 就是在 `/dev/shm/` 下 `openat`、`unlinkat`（POSIX 共享内存就是 tmpfs 上的文件）。

**进程创建与执行（src/process 下 43 个文件）**：exec 系列 `execl execlp execle execv execvp execvpe execve fexecve`（前 7 个只是整理参数后调用 `execve`，PATH 搜索是在用户态多次尝试 execve）、`fork vfork _Fork posix_spawn posix_spawnp` 以及 `posix_spawn_file_actions_*`、`posix_spawnattr_*`、`wait waitpid waitid wait3 wait4`。对应的系统调用：`execve`=221；`fork`、`_Fork` 用 `clone(SIGCHLD,0)`=220；`vfork` 用 `clone(CLONE_VM|CLONE_VFORK|SIGCHLD)`；`posix_spawn` 用 `clone`、file_actions 和 `execve`；`wait*` 用 `wait4`=260。

**线程与同步（pthread.h、threads.h、semaphore.h、sched.h，src/thread 下 148 个、sched 下 10 个文件）**：musl 用 148 个文件实现了相当于 NPTL 的全部功能，都建立在 `futex` 和 `clone` 上，是「用户态快路径加偶尔的 futex 慢路径」的典型。pthread 全部接口：`pthread_create/join/detach/exit/self/equal/cancel/kill/sigmask`、`pthread_attr_*`、互斥锁 `pthread_mutex_init/lock/trylock/timedlock/unlock` 和 `pthread_mutexattr_*`（包括 robust、protocol、pshared）、条件变量 `pthread_cond_wait/timedwait/signal/broadcast`、读写锁、屏障、自旋锁、线程局部存储 `pthread_key_create/getspecific/setspecific/once`；C11 的 `thrd_/mtx_/cnd_/tss_/call_once`；POSIX 信号量 `sem_init/wait/trywait/timedwait/post/getvalue/open/unlink`；调度 `sched_yield/setscheduler/getaffinity/setaffinity` 和 `CPU_*` 宏。对应的系统调用：

<div align="center">

| 函数 | syscall |
|:--:|:--:|
| `pthread_create`/`thrd_create` | `mmap`(栈)+`clone`=220(CLONE_VM\|FS\|FILES\|THREAD\|SIGHAND\|SETTLS)+`set_tid_address` |
| `pthread_join` | `futex`=98 等待线程退出 |
| `pthread_mutex_lock` | 无争用=纯原子 CAS（用户态）；争用慢路径=`futex(FUTEX_WAIT)` |
| `pthread_mutex_unlock` | 无等待者=纯原子；有=`futex(FUTEX_WAKE)` |
| `pthread_cond_wait`/`signal` | `futex` |
| `pthread_spin_*` | 纯自旋无 syscall |
| `pthread_getspecific`/`self`/`equal` | 无（读 TLS） |
| `sem_wait`/`sem_post` | 原子 + `futex` |
| `sched_yield` | 124 |
| `pthread_kill`/`sigmask` | `tgkill`/`rt_sigprocmask`=135 |

</div>

**信号与非局部跳转（signal.h、setjmp.h、ucontext.h，src/signal 下 56 个、setjmp 下 20 个文件）**：`signal sigaction raise kill killpg sigqueue sigprocmask sigpending sigsuspend sigwait sigtimedwait sigaltstack getitimer setitimer`、信号集的纯计算 `sigemptyset sigfillset sigaddset sigdelset sigismember`、`setjmp longjmp sigsetjmp siglongjmp`、`getcontext setcontext makecontext swapcontext`。对应的系统调用：`signal`、`sigaction` 用 `rt_sigaction`=134；`raise` 用 `tgkill`；`sigprocmask` 用 `rt_sigprocmask`=135；`setjmp`、`longjmp` 不调用系统调用（把寄存器保存到 jmp_buf 或从中恢复，纯汇编）；信号集的位运算不调用系统调用。信号处理函数**返回**时，由内核执行完处理函数后通过 `rt_sigreturn` 跳板回到被打断的位置。

**时间（time.h、sys/time.h，src/time 下 41 个文件）**分两类：日历换算是纯计算，读取系统时间要调用系统调用（大多由 vDSO 加速）。`time clock clock_gettime clock_settime clock_getres clock_nanosleep gettimeofday settimeofday`、计时器 `nanosleep getitimer setitimer timer_create timer_settime times alarm`、日历换算 `mktime timegm gmtime localtime asctime ctime difftime strftime strptime`、时区 `tzset`。对应的系统调用：`clock_gettime` 用 **vDSO 的 `__vdso_clock_gettime`**（CLOCK_MONOTONIC 和 CLOCK_REALTIME 不进内核，约 10 纳秒），其他时钟退回 `clock_gettime`=113；`time`、`gettimeofday` 也用 vDSO；`mktime`、`gmtime`、`strftime`、`difftime` 是纯历法计算（`localtime` 第一次调用时会 `openat` 加 `read` 读取 `/etc/localtime` 并解析 TZif）。

**网络（sys/socket.h、netdb.h、arpa/inet.h，src/network 下 79 个文件）**：socket 系列直接调用系统调用，地址转换是纯计算，名字解析两者都有。套接字封装 `socket socketpair bind listen accept accept4 connect shutdown getsockname getpeername getsockopt setsockopt send recv sendto recvfrom sendmsg recvmsg sendmmsg recvmmsg`、字节序转换 `htons htonl ntohs ntohl`、地址转换 `inet_addr inet_aton inet_ntoa inet_pton inet_ntop`、名字解析 `getaddrinfo getnameinfo gethostbyname getservbyname`、DNS 底层 `res_init res_query res_send dn_comp dn_expand`、接口枚举 `if_nametoindex getifaddrs`。对应的系统调用：`socket`=198、`bind`=200、`connect`=203、`sendto`=206、`recvfrom`=207；`htons`、`inet_pton`、`inet_ntop` 都是纯计算；`getaddrinfo` 读取 `/etc/hosts` 和 `/etc/resolv.conf`（`openat` 加 `read`），查不到就建一个 UDP `socket`，用 `sendto` 和 `recvfrom` 查询 DNS；`getifaddrs` 用 netlink 的 `socket` 加 `recvmsg`（RTM_GETADDR）。

其他子系统：**locale 与多字节**（src/locale 下 36 个、multibyte 下 21 个文件）`setlocale localeconv nl_langinfo gettext iconv` 和 `mblen mbtowc wctomb mbrtowc wcrtomb mbsrtowcs btowc`，多字节转换、strcoll、wcwidth 是纯 UTF-8 状态机加 Unicode 表，只有 `setlocale`（非 C locale）、`gettext`、`iconv_open` 才会 `openat` 加 `read` 读取 locale 和 .mo 文件（musl 大多只支持内置的 C/UTF-8，所以通常没有 IO）；**正则与通配**（src/regex 下 7 个文件，基于 TRE）`regcomp regexec regerror fnmatch glob wordexp`，前几个是纯计算，`glob` 会调用 `opendir`、`getdents64`、`stat`；**查找容器**（search.h）`tsearch tfind tdelete twalk`（红黑树）、`hsearch`（哈希）、`lsearch`（线性）都是纯计算；**System V IPC 与 POSIX 消息队列**（src/ipc 下 14 个、mq 下 11 个文件）`msgget msgsnd semget semop shmget shmat` 直接调用各自的系统调用（RV64 不用旧的 `ipc()` 多路复用），`mq_open mq_timedsend mq_notify` 调用 `mq_*` 系统调用，`ftok` 是纯计算；**终端**（src/termios 下 13 个文件）`tcgetattr tcsetattr tcflush tcdrain cfgetispeed cfsetspeed cfmakeraw`，`tcgetattr`、`tcsetattr` 用 `ioctl`=29（TCGETS、TCSETS），`cfmakeraw`、`cfsetspeed` 只修改结构体，不调用系统调用；**用户和组数据库**（src/passwd 下 22 个文件）`getpwnam getpwuid getgrnam getspnam getgrouplist initgroups`，都通过 `openat` 加 `read` 读取 `/etc/passwd`、`group`、`shadow`，或者访问 nscd 的 socket；**异步 I/O**（src/aio 下 3 个文件）`aio_read aio_write aio_suspend lio_listio`，musl 用线程池模拟（`pthread_create` 加普通的 `pread`/`pwrite`，不是 Linux 原生的 io_submit）；**动态链接**（dlfcn.h）`dlopen dlsym dlclose dlerror dladdr dl_iterate_phdr`，`dlopen` 用 `openat`、`mmap`、`mprotect` 并处理重定位，`dlsym`、`dladdr` 不调用系统调用（查已加载的符号哈希表）；**加密散列**（src/crypt 下 9 个文件）`crypt crypt_r`（DES、MD5、SHA-256、SHA-512、Blowfish 后端都是纯计算）；**Linux 专有扩展**（src/linux 下 68 个文件，几乎都调用系统调用）`epoll_create1 epoll_ctl epoll_wait eventfd signalfd timerfd_create inotify_init1 fanotify_init sendfile copy_file_range splice tee vmsplice getrandom memfd_create prctl setns unshare mount umount2 statx membarrier gettid setxattr renameat2 preadv2`（io_uring 的三个系统调用 musl 还没有封装，需要直接用 `syscall()` 或 liburing）；**资源与系统信息**（src/misc 下 39 个、conf 下 5 个文件）`getrlimit prlimit getrusage uname sysinfo getauxval sysconf getopt getopt_long realpath basename dirname forkpty openpty`，`prlimit`=261，`uname` 用 `SYS_uname`，`getauxval`、`getopt`、`basename` 不调用系统调用（读取缓存的 auxv，或纯字符串处理）。

### 哪些在用户态、哪些调用系统调用

把上面的内容汇总成一张表，可以快速查出 libc 中哪些是纯计算、哪些要进内核：

<div align="center">

| 类别 | 纯用户态（无 syscall） | 落 syscall |
|:--:|:--:|:--:|
| string/mem/ctype/math/complex/crypt | 全部 | — |
| stdlib 转换/算术/排序/查找/prng | `atoi strtol qsort bsearch rand div` | — |
| stdlib 分配 | — | `malloc`→`brk`/`mmap`/`munmap`/`madvise` |
| stdio 到内存 | `sprintf snprintf sscanf fmemopen` | — |
| stdio 到 fd | — | `read`/`writev`/`openat`/`lseek`/`close` |
| unistd | 极少 | 几乎全部(read/write/dup/pipe2/lseek/fork=clone/access=faccessat) |
| stat/fcntl/dirent | `alphasort` | `statx`/`openat`/`fcntl`/`getdents64`/`mkdirat`/`unlinkat` |
| mman | — | `mmap`/`munmap`/`mprotect`/`madvise`/`mlock`/`memfd_create` |
| process/exec/spawn | argv/PATH 整理 | `execve`/`clone`/`wait4`/`waitid` |
| pthread/sem/C11 thread | 无争用锁=原子；TLS/self；spinlock 自旋 | `clone`/`futex`/`set_tid_address`/`tgkill`/`rt_sigprocmask` |
| signal/setjmp | 信号集位运算；`setjmp`/`longjmp` | `rt_sigaction`/`rt_sigprocmask`/`tgkill`/`setitimer`/`rt_sigreturn` |
| time | 历法换算 `mktime`/`gmtime`/`strftime` | `clock_gettime`(vDSO优先)/`nanosleep`/`times`/`timer_*` |
| network | 字节序/`inet_pton`/地址结构 | `socket`/`bind`/`connect`/`send*`/`recv*`；`getaddrinfo` 读文件+UDP DNS |
| locale/multibyte | 多字节转换/strcoll/wcwidth | `setlocale`/`gettext`/`iconv` 读文件 |
| regex/search | `regcomp`/`regexec`/`fnmatch`/`tsearch` | `glob`→`opendir`/`getdents64`/`stat` |
| ipc/mq/termios | `ftok`/`cfmakeraw` | SysV `msgget`/`semop`/`shmat`；`mq_*`；`tcgetattr`→`ioctl` |
| pwd/grp/dlfcn/Linux 扩展 | `dlsym`/`dladdr` | 读 `/etc/passwd`；`dlopen`→`mmap`；epoll/inotify/sendfile/statx |

</div>

规律有五条：输入输出一定调用系统调用；纯算法和查表都在用户态；同步原语是用户态快路径加 futex 慢路径；读取时间靠 vDSO 避免陷入内核；错误码统一在 `__syscall_ret` 转换（内核返回值大于 `-4096UL` 就视为 `-errno`，设置 `errno=-r` 并返回 -1，见「errno」），errno 是每个线程的 TLS（`__errno_location` 返回 `__pthread_self()->errno_val`，所以线程安全，没有全局竞争）。

### 六个 C 库的差异

选择或编写 libc，要知道这六个 C 库在完整程度、stdio、malloc、线程上的取舍：

<div align="center">

| 维度 | musl | newlib | picolibc | uclibc-ng | baselibc | relibc |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 完整度 | 全 POSIX | 嵌入式子集 | 更瘦子集 | 全 POSIX(可裁) | 极小子集 | 全 POSIX(进行中) |
| syscall | 内联 ecall | 外部 stub | 外部 stub(更少) | 内联 | 无/回调 | 自带(双后端) |
| stdio | 带锁 FILE | reent FILE | tinystdio | 完整 | 回调 FILE | 完整 |
| malloc | mallocng | nano/normal | tlsf/可换 | 多种 | 静态堆 | dlmalloc-rs |
| 线程 | 内建 NPTL 等价 | RTOS 提供 | RTOS 提供 | libpthread | 无 | std 线程 |
| 典型场景 | Linux 静态 | 裸机/RTOS | MCU/Zephyr | 嵌入式 Linux | 深裸机 | Redox/Linux |

</div>

有几点值得单独说明。newlib 的桩函数模型是它能移植到任意裸机的关键：libc 与操作系统靠十七到三十个 `_xxx` 弱符号分开，换操作系统只需换这一层桩函数（`libgloss/riscv/sys_*.c` 真的执行 ecall，`semihost-sys_*.c` 走半主机，就是两套实现）。baselibc 小到 `include/` 下只有 7 个头文件（assert、ctype、inttypes、stdio、stdlib、string 和 klibc），没有 unistd、系统调用、pthread、math、locale，用于连内核都没有的场景。picolibc 的 tinystdio 用 `__file` 加 put/get 函数指针代替庞大的 FILE，`printf` 可以配置是否支持浮点，大大减小体积。relibc 每个 C 头文件对应一个 Rust 模块（`src/header/<头名>/mod.rs`，用 `#[no_mangle] extern "C"` 导出 C ABI），`src/platform/` 抽象 Linux 和 Redox 两种后端，内存分配用 dlmalloc-rs，数学库用 openlibm，说明 libc 的 ABI 约定与实现语言无关。

musl 落到系统调用的机制可以按文件逐层对照仿写：调用号定义在 `arch/riscv64/bits/syscall.h.in`（asm-generic 编号）；内联汇编在 `arch/riscv64/syscall_arch.h`（`__syscall0..6` 把调用号放进 a7、参数放进 a0 到 a5、执行 `ecall`、从 a0 取返回值）；两种入口 `__syscall`（不是取消点）和 `syscall_cp`（POSIX 取消点）；错误转换在 `src/internal/syscall_ret.c`；errno 存储在 `src/errno/__errno_location.c`。自己写 libc 或操作系统的系统调用层时，这五部分是最清楚的参考。

libc 是 C 标准库（如 glibc、musl），C++ 标准库建立在它之上：通常依赖 libc 提供内存管理、I/O 等底层功能，再在上面实现容器和算法。三者的依赖关系是：C++ 标准库实现依赖 libc，libc 依赖操作系统。STL 是 C++ 标准对容器、算法等接口的规定，下面三个是它的具体实现：

<div align="center">

| 实现 | 所属项目 | 主要配合的编译器 |
|:--:|:--:|:--:|
| libcxx（libc++） | LLVM | Clang |
| libstdc++ | GCC | GCC |
| MSVC STL | Microsoft | MSVC |

</div>

libcxx 包括 C 兼容头文件（`cstdio cstring cmath` 等，把 C 的名字放进 `std::` 命名空间，底层仍调用 C libc）、容器（`vector list map unordered_map set deque array`）、算法和工具（`algorithm numeric functional tuple optional variant memory`）、字符串和流（`string string_view sstream iostream regex`）、并发（`thread mutex condition_variable future atomic`）、数值（`complex valarray random chrono type_traits`），系统调用都通过下层的 C libc 完成：`std::fstream` 调用 `fopen`，再调用 `openat`；`std::thread` 调用 pthread，再调用 `clone`。

### Rust 标准库的三层：core、alloc、std

Rust 标准库分三层，每一层多一组前提条件，正好对应从裸机到完整操作系统的各个阶段，这是写 no_std 内核和固件的基础。

<div align="center">

| 层 | crate | 前提（你必须提供什么） | 不能做什么 | 典型场景 |
|:--:|:--:|:--:|:--:|:--:|
| core | `core` | 无（只要有 CPU + 编译器） | 不能堆分配、不能开线程、不能 I/O | 裸机固件 / 内核 / no_std MCU |
| alloc | `alloc` | 一个 `#[global_allocator]`(实现 GlobalAlloc) | 不能 I/O、不能线程、不能 OS 服务 | no_std + 堆的内核 / unikernel / bootloader |
| std | `std` | 一个完整宿主 OS(Linux/Windows/macOS/Redox/WASI) | — | 普通用户态程序 |

</div>

**`std` 把 `core` 和 `alloc` 全部重新导出**：`std::option::Option` 就是 `core::option::Option`，`std::vec::Vec` 就是 `alloc::vec::Vec`，`std::boxed::Box` 就是 `alloc::boxed::Box`。应用代码写 `std::xxx`，大部分用的其实是 core 和 alloc 的东西，`std` 自己新增的只有需要操作系统的那些模块。`#![no_std]` 的意思是不链接 std，只链接总是可用的 core，加上可选的 `extern crate alloc`，panic 处理和全局分配器要自己提供。relibc 本身就是用 `#![no_std]` 加 `extern crate alloc` 写的：它给别人提供 libc，自己只能用 core 和 alloc，因为它就是 libc，不能假设已经有 libc。

**core 没有任何依赖**。它不使用堆，也不使用操作系统，唯一与硬件有关的是 `sync::atomic` 和 `arch`（CPU 指令，不需要操作系统）。稳定的顶层模块：基础抽象 `any`（类型信息 TypeId、downcast）、`borrow`、`clone`、`cmp`（PartialEq、Ord、Ordering）、`convert`（From、Into、TryFrom、AsRef）、`default`、`marker`（Send、Sync、Sized、Copy、PhantomData）；值与内存 `mem`（size_of、align_of、swap、replace、take、transmute、MaybeUninit、ManuallyDrop、offset_of!）、`ptr`（裸指针 null、read、write、用于 MMIO 的 `read_volatile`/`write_volatile`、copy_nonoverlapping、NonNull、provenance）、`cell`（内部可变性 Cell、RefCell、UnsafeCell、OnceCell）、`pin`（Pin 固定数据的位置，是自引用和异步的前提）；数据 `option`、`result`（错误处理和 `?`）、`iter`（可组合的外部迭代器，零开销抽象的核心，适配器有 Map、Filter、Zip、Chain、Enumerate）、`slice`、`str`、`array`、`ascii`、`char`、`num`（NonZero、Wrapping、Saturating、ParseIntError）、`ops`（可重载的运算符、Range、Deref、Fn/FnMut/FnOnce、ControlFlow）、`hash`、`fmt`（Debug、Display、Formatter、format_args!）；底层 `arch`（SIMD intrinsic、`asm!`/`global_asm!`、rv64/x86_64/aarch64 子模块）、`hint`（black_box、spin_loop、unreachable_unchecked）、`ffi`（c_void、CStr、c_char 等 C 类型）、`error`（1.81 起 Error 移入 core）、`panic`（Location、PanicInfo）；异步 `future`（Future trait、poll_fn）、`task`（Context、Waker、Poll、ready!）；同步 `sync`（只有不需要操作系统的 atomic 子模块）、`time`（只有 Duration，没有时钟）、`net`（1.77 起移入 core 的地址类型 IpAddr、Ipv4Addr、SocketAddr，没有 socket）。

`core::sync::atomic` 单独说明，它是不需要操作系统的硬件原语：11 种原子类型（`AtomicBool`、`AtomicU8..U64`、`AtomicI8..I64`、`AtomicUsize`、`AtomicIsize`、`AtomicPtr`），5 种 `Ordering`（`Relaxed`、`Acquire`、`Release`、`AcqRel`、`SeqCst`，对应 RVWMO、ARM 弱序、x86 TSO 等内存模型），主要方法 `load`、`store`、`swap`、`compare_exchange`、`fetch_add`、`fetch_sub`、`fetch_or`，以及函数 `fence`（线程间屏障）和 `compiler_fence`（只约束编译器）。平台差异：32 位 PowerPC 和 MIPS 没有 `AtomicU64`，ARMv6-M 只有 load/store、没有 CAS，要用 `#[cfg(target_has_atomic="64")]` 条件编译。relibc 自己实现的 `Mutex` 和 `once` 就是用 `AtomicU32` 加 futex 写的：原子操作是硬件提供的，不需要操作系统；Mutex 那种睡眠等待才需要操作系统（futex 系统调用）。

**alloc 加上一个全局分配器**，就能使用所有堆上的容器，但仍然没有操作系统（不知道线程，也不知道文件）。稳定模块：`alloc`（分配 API：alloc、dealloc、realloc、Layout、GlobalAlloc trait、handle_alloc_error）、`boxed`（Box 最简单的堆分配，Box::leak、into_raw）、`vec`（最常用的容器 Vec，vec!、with_capacity、drain、retain）、`string`（可增长的 UTF-8 字符串 String，push_str、ToString）、`collections`（不基于哈希的有序容器 BTreeMap、BTreeSet，优先队列 BinaryHeap，环形双端队列 VecDeque，LinkedList）、`rc`（单线程引用计数 Rc、Weak、downgrade）、`sync`（线程安全的引用计数 Arc、make_mut）、`borrow`（写时复制 Cow）、`ffi`（拥有所有权的 CString）、`fmt`（format!）、`slice`、`str`、`task`（Wake trait）。Rc 和 Arc 的区别很重要：`Rc` 用普通的 `Cell<usize>` 计数（非原子，单线程，快），`Arc` 用 `AtomicUsize` 计数，增加用 `fetch_add(Relaxed)`，减少用 `fetch_sub(Release)` 加 `fence(Acquire)`（原子，可以跨线程），选错了要么慢、要么不安全。

**std 是 core 加 alloc 再加操作系统服务**。它新增或扩展的模块，每个都对应一组系统调用：

<div align="center">

| 模块 | 职责 | 底层落到的 syscall / libc |
|:--:|:--:|:--:|
| `io` | I/O trait + 缓冲 + 标准流(Read/Write/Seek/BufReader/Stdin) | `read`/`write`/`readv`/`writev`/`lseek`/`pipe2`；Error 由 errno 翻译为 ErrorKind |
| `fs` | 文件系统(File/OpenOptions/ReadDir/Metadata) | `openat`/`read`/`write`/`statx`/`mkdirat`/`unlinkat`/`renameat2`/`getdents64`/`fsync` |
| `net` | TCP/UDP(TcpStream/TcpListener/UdpSocket) | `socket`/`bind`/`listen`/`accept4`/`connect`/`sendto`/`recvfrom`；DNS 走 libc `getaddrinfo` |
| `thread` | 原生线程(spawn/JoinHandle/scope/LocalKey) | `clone` 或 `pthread_create`；park→`futex`；sleep→`clock_nanosleep`；yield→`sched_yield` |
| `sync` | OS 级同步(Mutex/RwLock/Condvar/Once/mpsc) | 1.62+ futex-based：Mutex/Condvar/RwLock→`futex`；其他平台→`pthread_mutex_*` |
| `process` | 进程管理(Command/Child/ExitStatus) | `fork`+`execve` 或 `posix_spawn`；`wait4`；exit→`exit_group` |
| `env` | 进程环境(var/args/current_dir/current_exe) | environ 全局；current_dir→`getcwd`；current_exe→读 `/proc/self/exe` |
| `time` | OS 时钟(Instant/SystemTime) | `clock_gettime`(MONOTONIC/REALTIME)，多走 vDSO |
| `path` | 跨平台路径(Path/PathBuf，纯字符串) | 无 syscall（canonicalize 在 fs 才落） |
| `collections` | 含 hash(HashMap/HashSet，SipHash 抗 HashDoS) | RandomState 种子→进程启动 `getrandom` |
| `os` | 平台扩展(os::unix/os::fd/OwnedFd/AsRawFd) | 暴露原始 fd / MetadataExt / CommandExt::pre_exec |
| `alloc` | 默认系统分配器 System | Unix→libc `malloc`/`free`/`realloc`；Windows→HeapAlloc |
| `panic` | 可 unwind 的 panic 运行时(catch_unwind/set_hook) | unwind 走 `_Unwind_RaiseException`(libunwind/libgcc_s) |

</div>

std 落到内核要经过 2024 到 2025 年重构后的几层：用户代码，std 的公开模块（`std::fs`），以功能划分的抽象层（`std::sys::fs`，跨平台的统一接口），平台封装（`std::sys::pal::unix`，FileDesc、cvt、open64），`libc` crate（`extern "C"` 绑定），glibc、musl 或 relibc，内核系统调用。重构的规则是：除了 `std::os`，std 的其他部分只依赖 `sys::feature_name`，不直接依赖 `sys::pal`。std 是否链接 libc 有两种情况：默认通过 libc（`x86_64-unknown-linux-gnu` 链接 glibc，`*-musl` 链接 musl，通过 libc crate 的 `extern "C"` 调用；不直接发起系统调用，是因为 glibc 的 NSS、`getaddrinfo`、locale、malloc 有内部状态，绕过会出问题，而且 errno、信号、TLS、pthread 由 libc 维护，ABI 稳定也依靠它）；少数地方直接发起系统调用（个别热点或 libc 不提供的功能，用 `asm!` 直接发 `svc`/`syscall`/`ecall`，例如早期的 `getrandom`，以及部分 `futex`、`clone`）。Rust 程序的启动过程是：`_start`（来自 libc 的 crt1.o），`__libc_start_main`，rustc 生成的 C ABI `main` 包装函数，`std::rt::lang_start`（设置栈溢出保护、线程 guard、sigpipe，记录 argc 和 argv），`lang_start_internal`（用 catch_unwind 包住），用户的 `fn main()`，返回值经过 `Termination::report`，最后 `exit_group`。

relibc 与这套结构相同：它和 Rust std 都是「公开 API 层，平台抽象 trait，各平台的系统调用实现」。它的 `Pal` trait（`src/platform/pal/mod.rs`）列出 `access`、`brk`、`chdir`、`close`、`clock_gettime` 等方法，对应 std 的 `sys::pal`；Linux 后端 `Sys`（`src/platform/linux/mod.rs`）用 `syscall!` 直接发起系统调用（不经过 libc，因为它本身就是 libc），Redox 后端换成 `redox_syscall`，与 std 的多后端机制一致；默认分配器是 dlmalloc-rs（Doug Lea malloc 的 Rust 移植，用一把 `Mutex<Dlmalloc>` 保护），是用 Rust 重写 malloc 的例子；错误码把系统调用返回的大于 `-4096` 的值视为 `-errno`，转换成 `Err(Errno)`（musl `__syscall_ret` 魔数判断的类型安全版本）；同步原语用原子操作加 futex 实现 Mutex、RwLock、Once、Condvar、Barrier；启动代码 crt0 是用 `global_asm!` 手写的 `_start` 加 `relibc_crt0`，结构与 std 的 `_start`、`lang_start`、`main` 相同。relibc 说明用 Rust 重写 libc 在工程上完全可行（Pal trait、多后端、dlmalloc、cbindgen），而 std 本身不能替代 libc（它在 Linux 上依赖 libc）。两者是两条路：std 是「Rust 应用，libc，内核」，relibc 是「C 应用，用 Rust 写的 libc，直接调用内核」。

这三层正好对应全栈操作系统中的固件、引导和用户态：M-mode 固件只用 core（不挂分配器，不用操作系统，只用 option/result、用 `ptr::write_volatile` 操作 MMIO、用原子操作选出启动核、用 fmt 向串口输出）；带堆的引导器或 Unikernel 用 core 加 alloc（挂一个全局分配器，可以参考 dlmalloc-rs，就能用 Vec、Box、BTreeMap 管理 FIT 镜像和页表）；用户态程序用 std（内核要提供一个 `std::sys::pal` 后端，实现与 Pal 相同的 trait，落到自己的系统调用上；relibc 的 Linux/Redox 双后端已经展示了怎样添加新后端）。core、alloc、std 分别对应固件、引导和应用，是用 Rust 写系统软件的基本框架。


## 动态链接运行时与 vDSO

「C 运行时启动链」讲的是静态链接时的启动过程。现在大多数程序是动态链接的：运行 main 之前，要先由 ld.so 把所有 `.so` 装进地址空间，把成千上万个符号引用填上真实地址。下面分析动态链接器（以 musl 的 `ldso/dynlink.c` 为主，relibc 作为 Rust 的对照），再讲 vDSO。

### ld.so 的自举与自重定位

动态可执行文件的 ELF 头里有一个 `PT_INTERP` 段，写着解释器的路径（如 `/lib/ld-musl-riscv64.so.1`）。内核 `execve` 时发现它，就先把 ld.so 用 mmap 映射到一个随机地址，跳到它的入口 `_dlstart`，而不是直接跳到主程序。这里有一个先后问题：ld.so 自己也是位置无关的（被装到随机地址），必须先处理完**自己的**重定位，才能调用任何全局函数，而处理重定位本身也是代码。musl 的 `_dlstart_c` 只用纯局部、不依赖任何全局符号的代码完成自举：从栈上解析 argc、argv、auxv，计算自身的装载基址 base（优先用 `AT_BASE`，否则用 `&_DYNAMIC` 与 program header 中 `PT_DYNAMIC` 的差值），然后依次处理三种重定位表中的 RELATIVE 类（`DT_REL` 没有 addend，是 `*addr += base`；`DT_RELA` 带 addend，是 `*addr = base + addend`；`DT_RELR` 见下），符号类的留到后面。「用四种手段固定初始化顺序」中的第四种（`GETFUNCSYM` 的 volatile 内存指针）就是为这种情况准备的：取下一阶段函数的地址时，不能依赖还没完成的重定位。

### DT_RELR 压缩相对重定位

PIE 和共享库中绝大多数重定位是 `R_*_RELATIVE`（含义是「把这个位置的值加上装载基址」），每条 `Elf64_Rela` 占 24 字节，几乎全是冗余。DT_RELR 用位图压缩，通常只占原 RELATIVE 表约 3% 的空间，整个 PIE 的虚拟内存能省 5% 到 10%。它由 Android 在 2017 年提出，2021 到 2022 年进入 glibc，musl 很早就支持，现在的链接器默认打开 `-z pack-relative-relocs`。编码方式：一串机器字交替出现两种项，地址项（最低位为 0）是一个偶数地址，直接对它做重定位，并把游标放到它后面；位图项（最低位为 1）的高 63 位（rv64）是位图，第 i 位为 1 表示「游标加 i 个字」的位置也要重定位，一个位图项覆盖 63 个连续的字，可以连续跟多个。musl 在 `ldso/dlstart.c`（自举阶段）和 `ldso/dynlink.c` 的 `do_relr_relocs`（处理依赖的 .so，开头有 `if (dso==&ldso) return`，因为 ld.so 自己的 RELR 在自举时已经处理过）两处实现，relibc 在 `src/ld_so/dso.rs` 的 `apply_relr` 用 Rust 实现，逐行对应：

<div align="center">

| 步骤 | musl C（dlstart.c） | relibc Rust（dso.rs apply_relr） |
|:--:|:--:|:--:|
| 地址项（偶数） | `relr_addr=base+rel[0]; *relr_addr++ += base` | `addr=base.add(entry); *addr+=base; addr=addr.add(1)` |
| 位图项（奇数） | `for(bitmap=rel[0]; bitmap>>=1; i++) if(bitmap&1) relr_addr[i]+=base` | `while entry!=0 { if entry&1 {*addr.add(i)+=base} entry>>=1; i+=1 }` |
| 位图之后前进 | `relr_addr += 8*sizeof(size_t)-1`（即 63） | `addr=addr.add(CHAR_BITS*size_of::<Relr>()-1)`（即 63） |

</div>

参考资料：MaskRay 2024 年的博客、glibc BZ#27924、gabi ELF 草案中的 SHT_RELR。

### 重定位类型

自举之后，ld.so 的 `reloc_all` 对每个已加载的 dso 调用 `do_relocs`，处理 `DT_JMPREL`（PLT）、`DT_REL`、`DT_RELA`、`DT_RELR`，最后对 RELRO 段 `mprotect(PROT_READ)`。`do_relocs` 的 `switch(type)` 把抽象的重定位类型对应到具体架构的 `R_RISCV_*`：

<div align="center">

| 抽象类型 | rv 重定位 | 动作 | 用途 |
|:--:|:--:|:--:|:--:|
| `REL_SYMBOLIC` | `R_RISCV_64` | `*addr = sym_val + addend` | 数据符号的绝对地址 |
| `REL_GOT`/`REL_PLT` | `R_RISCV_JUMP_SLOT` | `*addr = sym_val + addend` | GOT/PLT 槽（启动时填入真实地址） |
| `REL_RELATIVE` | `R_RISCV_RELATIVE` | `*addr = base + addend` | 内部相对地址（PIE 引用自身） |
| `REL_COPY` | `R_RISCV_COPY` | `memcpy(addr, sym_val, size)` | 主程序复制外部的全局变量 |
| `REL_DTPMOD` | `R_RISCV_TLS_DTPMOD64` | `*addr = dso->tls_id` | TLS 模块号（GD 模型） |
| `REL_DTPOFF` | `R_RISCV_TLS_DTPREL64` | `*addr = tls_val+addend-DTP_OFFSET` | TLS 块内偏移 |
| `REL_TPOFF` | `R_RISCV_TLS_TPREL64` | `*addr = tls_val+tls.offset+addend` | IE/LE 模型的直接偏移 |
| `REL_TLSDESC` | `R_RISCV_TLSDESC` | 填入 resolver 和参数 | TLSDESC 动态 TLS |

</div>

### GOT、PLT 与绑定时机

musl 和 glibc 在这里有一个重要区别。glibc 默认惰性绑定（lazy binding）：函数第一次经 PLT 跳转时，通过跳板 `_dl_runtime_resolve` 解析符号并回填 GOT，之后直接跳转；好处是启动快（按需解析），缺点是 GOT 在运行时可写，成为攻击面。musl 完全不做惰性绑定，一律在启动时全部解析：`do_relocs` 对 `REL_PLT`、`REL_GOT` 直接填入真实地址，没有跳板，整个代码库里没有 `_dl_runtime_resolve`。musl wiki 的 functional-differences-from-glibc 说明了原因：惰性绑定失败时无法报告错误，不做惰性绑定也大大减少了容易出错的、与架构相关的代码。从安全上看也更好：惰性绑定要求 GOT 可写，与 RELRO（重定位后把 GOT 设为只读）冲突，而 musl 启动时全部解析，再加上完整的 RELRO，自然能防止改写 GOT 的攻击。所以「默认惰性绑定」只对 glibc 成立，对 musl 不成立。

符号解析（`find_sym`）按依赖的加载顺序，广度优先地在各个 dso 的符号表里查找名字，用 `DT_GNU_HASH`（新，带 bloom filter 加速）或 `DT_HASH`（旧的 SysV 哈希）定位。`LD_PRELOAD` 的 dso 排在最前面，它的符号优先被找到，hook `malloc`、`open` 就是靠这一点。

### TLS 的四种模型与 TLSDESC

线程局部存储按编译时知道多少信息分为四种，越静态越快：LE（Local Exec，主程序自己的 TLS，偏移在编译时确定，最快，`R_RISCV_TLS_TPREL64`）；IE（Initial Exec，启动时就加载的 .so 的 TLS，`tp + 固定偏移`，要求 `tls_id <= static_tls_cnt`）；GD/LD（General/Local Dynamic，`dlopen` 加载的 .so，运行时通过 `__tls_get_addr(tls_id, offset)` 查 DTV）；TLSDESC（更快的动态 TLS，重定位时填入一对 `(resolver, arg)`）。rv 的 TLSDESC resolver 汇编与前面 millicode 的做法相同：`__tlsdesc_static`、`__tlsdesc_dynamic` 也**用 t0 作返回寄存器**（特殊的调用约定，不破坏 ra），动态情况下查 DTV：`dtv[modidx] + off - tp`。rv 的线程指针是硬件寄存器 tp（x4），采用 variant I 布局（TLS 在 tp 之上），DTV 项有 0x800 的偏移。

### 动态链接的三个阶段

自举完成后，musl 的动态链接分三个阶段，阶段之间用「用四种手段固定初始化顺序」中的第三种（运行时符号查找）隔开，防止编译器跨阶段重新排序：`__dls2` 建立 ld.so 自己的 `struct dso`，`decode_dyn`，用 `reloc_all(&ldso)` 完成 ld.so 的全部重定位，然后查找符号 `__dls2b`；`__dls2b` 用内置的 `builtin_tls` 建立早期的线程指针（`__init_tp(__copy_tls(builtin_tls))`），之后才能安全地使用 errno 和 TLS，再查找符号 `__dls3`；`__dls3` 加载主程序和 vdso 的 `struct dso`，递归地用 `load_deps` 加载所有依赖，`reloc_all` 处理全部重定位，执行各 .so 的 `.init_array`，最后跳到主程序的入口（`AT_ENTRY`）。relibc 的 `src/ld_so/` 用 `object` crate 解析 ELF，有 `Linker`、`Tcb` 等抽象，`apply_relr` 与 musl 逐行对应，但还有很多 TODO，不如 musl 成熟。

### vDSO 的实现

有些系统调用调用得非常频繁，进一次内核的开销都显得多余，典型的是 `clock_gettime`。vDSO（virtual dynamic shared object）是内核提供的捷径，分三层。第一层：内核启动时构造一个很小的 ELF（几 KB，包含几个常用系统调用的纯用户态实现），映射到每个进程的地址空间，基址通过 `AT_SYSINFO_EHDR` 放进 auxv（地址经过 ASLR 随机化，`cat /proc/self/maps | grep vdso` 可以看到 `[vdso]` 段）。第二层：libc 的 `__vdsosym` 像一个小 ld.so 一样解析这个 ELF 的符号表（遍历 program header 计算基址，解析 dynamic section 得到 STRTAB、SYMTAB、GNU_HASH，按类型和绑定过滤并校验版本），第一次调用时解析，然后用原子 CAS 缓存函数指针，之后的调用直接 call 这个指针，不用系统调用；三级后备是 vDSO、`clock_gettime64` 系统调用、`gettimeofday`。第三层：vDSO 函数读取内核每个 tick 更新的共享数据页（`cycle_last`、`mult`、`shift`、`mask`），再读硬件计数器（rv64 是 `csrr ..., time`），计算 `(cycles - cycle_last) * mult >> shift` 得到纳秒，加上启动偏移，写入 `*ts`，全程在用户态读取，没有特权切换。各架构导出的符号略有不同：

<div align="center">

| 架构 | 版本串 | 导出的符号 |
|:--:|:--:|:--:|
| rv | `LINUX_4.15` | `__vdso_rt_sigreturn`、`gettimeofday`、`clock_gettime`、`clock_getres`、`getcpu`、`flush_icache`（rv 特有，刷新 I-cache） |
| x86-64 | `LINUX_2.6` | `__vdso_clock_gettime`、`getcpu`、`gettimeofday`、`time` |
| aa | `LINUX_2.6.39` | `__kernel_rt_sigreturn`、`gettimeofday`、`clock_gettime`、`clock_getres`（前缀是 `__kernel_` 而不是 `__vdso_`） |

</div>

musl 的 `arch/riscv64/syscall_arch.h` 固定了 `VDSO_CGT_SYM="__vdso_clock_gettime"`、`VDSO_CGT_VER="LINUX_4.15"`，与 man7 的 vdso(7) 一致。为什么不是所有系统调用都走 vDSO：vDSO 只能放只读硬件状态、不修改内核数据结构、不需要特权的操作（时钟、CPU 编号）；`open`、`write`、`mmap`、`clone` 都要修改内核的全局表（fd 表、页表、任务列表），不可能在用户态完成。表中的 `__vdso_rt_sigreturn` 不是为了性能，而是信号返回的跳板：它必须在内核知道的固定地址上，信号处理函数执行完才能跳回来。

## 编译器后端、工具链与 JIT

前面几节讲的是二进制怎样被装载、怎样运行起来。这一节看二进制是怎样生成的：编译器后端、整条工具链，以及运行时才编译的 JIT，最后看架构本身对 JIT 和动态翻译提供了什么硬件支持，以及 rv 的 J 扩展在做什么。LLVM 的内容以 LLVM 23.0.0（2026-06-03 前后的 main 分支）源码为准，rustc 和 GCC 以官方文档和规范为准。

### LLVM

编译器自上而下分为源码、前端、高层 IR、LLVM IR、优化、后端、MC、机器码。LLVM 的核心思路（Chris Lattner，2003）是用与目标无关的 IR 加模块化的库，在中间形成一个窄接口：前端只负责降到 LLVM IR，后端只负责从 LLVM IR 生成机器码，中间的优化全部复用。这与 GCC 的整体式流水线根本不同。做成库是 LLVM 与 GCC 最大的区别：`llvm/lib/` 下每个目录都是一个可以单独链接的库（IR、Analysis、Transforms、CodeGen、Target、MC、ExecutionEngine、LTO 等），所以 Clang、lldb、JIT、MLIR、其他语言都可以按需使用这些库，而不用 fork 整个编译器。

LLVM IR 是中间的核心，有三种等价形式：内存中的对象（Module、Function、BasicBlock、Instruction）、文本 `.ll`、二进制 bitcode `.bc`。它是静态单赋值（SSA）、强类型、有无限多的虚拟寄存器、显式的 `getelementptr` 和 `phi`；`Verifier.cpp` 检查它的合法性，`DataLayout` 描述目标的字长、对齐和字节序，让与目标无关的 IR 也能正确计算结构体布局。中端优化由 Pass 和 Pass Manager 组织，Transforms 下分为：`Scalar/`（GVN、SCCP、DCE、SROA、LICM）、`InstCombine/`（窥孔式的代数化简）、`IPO/`（跨函数的 Inliner、GlobalDCE、ThinLTO）、`Vectorize/`（LoopVectorize 和 SLPVectorize 自动向量化）、`Utils/` 中的 mem2reg（把 alloca 提升为 SSA 寄存器，是所有优化的前提）、`Instrumentation/`（ASan、TSan、PGO 插桩）、`Coroutines/`（C++20 协程的降级）。

后端 CodeGen 有两种指令选择方式。SelectionDAG（默认，成熟）把 IR 的 BasicBlock 建成 DAG，合法化（例如在 32 位机器上拆分 i64），用 TableGen 生成的指令选择表匹配成目标指令，调度后生成 MachineInstr；`-O0` 时用 FastISel，牺牲代码质量换编译速度。GlobalISel（较新，aa64 默认）分四个阶段：IRTranslator、Legalizer、RegBankSelect、InstructionSelect，作用于整个函数，可以增量处理，更省内存。两者共用与目标无关的寄存器分配（RegAllocGreedy、Basic、Fast、PBQP）、MachineScheduler、PrologEpilogInserter，最后由 AsmPrinter 输出到 MC 层（包括 DWARF 和 CodeView 调试信息）。MC 层负责汇编、反汇编和目标文件输出（ELF、MachO、COFF、Wasm 编码）。

rv 是观察 LLVM 怎样应对大量扩展的好例子：每个 target 由 TableGen 的 `.td` 描述文件加 C++ 的降级代码组成，rv 按扩展拆分 `.td`，有 `RISCVInstrInfoA.td`（原子）、`F/D/Q`（浮点）、`C`（压缩）、`M`（乘除）、`V` 和 `VPseudos`（向量 RVV）、`Zb*`（位操作）、`Zk*`（密码），以及厂商扩展 `XTHead`（平头哥）、`XSpacemiT`、`XSf`（SiFive）、`XCV`（CORE-V）、`Xwch`（沁恒）。所以 LLVM 能跟上 rv 不断增加的扩展：每个扩展就是一组 `.td` 加少量 C++。LLVM 周边的工具链组件（很多对应 GNU 的工具）：

<div align="center">

| 组件 | 作用 | 对应或取代 |
|:--:|:--:|:--:|
| Clang | C/C++/ObjC/CUDA 前端和驱动程序 | gcc/g++ 命令 |
| compiler-rt builtins | 用软件实现的 ABI 例程 | libgcc.a |
| compiler-rt sanitizers | ASan、TSan、MSan、UBSan、HWASan | |
| libc++ / libc++abi / libunwind | C++ 标准库、ABI、栈展开 | libstdc++ / libsupc++ / libgcc_eh |
| lld | 链接器（ELF、COFF、MachO、wasm） | ld.bfd、gold、link.exe |
| lldb | 调试器（用 ORC JIT 计算表达式） | gdb |
| LLVM libc | 从零实现的 C 标准库 | glibc、musl |
| MLIR | 多层 IR 框架（dialect 可插拔），用于 AI 和 HPC | 在 LLVM IR 之上 |
| flang | Fortran 前端（FIR 到 LLVM IR） | gfortran |
| BOLT | 链接后的二进制优化器（按 perf profile 重排代码布局） | |
| Polly | 多面体循环优化 | GCC Graphite |

</div>

### rustc 的多个后端

rustc 既能用 LLVM，也能用其他后端，原因在它的流水线设计：rustc 在 MIR 之前完全与后端无关，源码、AST、HIR（去掉语法糖）、类型检查和借用检查、MIR（rustc 自己的控制流图形式的 IR，借用检查、插入 drop、常量传播都在这一层）、单态化（实例化泛型）并划分 codegen unit，到这里才分到具体的后端。MIR 才是 rustc 自己的 IR，后端只负责从 MIR 到目标机器码这一段。

rustc 把从 MIR 往下降的部分抽象成一个与后端无关的 crate `rustc_codegen_ssa`，定义了一组 trait：`BuilderMethods`（生成一个基本块，定义 add、load、store、br、call 等 IR 构造）、`CodegenMethods`/`CodegenCx`（一个 codegen unit 的上下文）、`BackendTypes`（用关联类型抽象后端的 Value、BasicBlock、Type，LLVM 是 `&Value`，Cranelift 是 cranelift 的 Value，互不可见）、`CodegenBackend`（驱动整个 crate 的代码生成）。原来 27000 行的 `rustc_codegen_llvm` 被拆成 18500 行 LLVM 专用代码和 12000 行与后端无关的 ssa 代码，约 10000 行在三个后端之间复用。三个后端：

<div align="center">

| 后端 | IR 或引擎 | 状态（2026） | 定位 |
|:--:|:--:|:--:|:--:|
| `rustc_codegen_llvm` | LLVM IR | 默认，在主仓库内 | release 构建，支持所有平台，代码质量最好 |
| `rustc_codegen_cranelift` | Cranelift IR（CLIF） | 随 rustup 发布，2025 年下半年推进到可用于生产 | debug 构建时快速编译，缩短改代码到运行的时间 |
| `rustc_codegen_gcc` | GCC GIMPLE（通过 libgccjit） | 在主仓库内，实验性 | 支持 LLVM 不支持的架构（m68k、s390x、旧龙芯），以及使用 GCC 工具链的发行版 |

</div>

换后端就是一次 dlopen：nightly 的 `-Z codegen-backend=<path>` 加载一个动态库，库中导出的 `__rustc_codegen_backend()` 返回代码生成对象，不需要重新编译 rustc。rustc 既用 LLVM 又要有自己的抽象，原因有四：职责划分（类型、借用、单态化是 Rust 语义的核心，必须由 rustc 自己做；生成机器码是通用工作，复用 LLVM 即可）；不绑定在一个后端上（接入 Cranelift 去掉 C++ 依赖，接入 GCC 覆盖更多架构）；编译体验（LLVM 的优化让编译变慢，Cranelift 用于 debug，加快编译，同一个项目 debug 用 Cranelift、release 用 LLVM）；Cranelift 本身也是独立的代码生成和 JIT 库（Wasmtime 用它做 Wasm JIT），接入它也验证了非 LLVM 后端是可行的。

### GCC、Clang 与 LLVM

这三者常被混为一谈：GCC 是一整套前端、中端、后端紧密耦合的编译器套件；LLVM 是一套模块化的编译器基础库，本身不是一个编译器命令；Clang 是 LLVM 中的 C/C++/ObjC 前端和驱动程序，对应 gcc 命令。正确的比较方式是 Clang 对 gcc（都是前端和驱动程序），LLVM 对 GCC 的内部架构（都是基础设施）。

<div align="center">

| | GCC | LLVM |
|:--:|:--:|:--:|
| 中层 IR | GIMPLE（三地址码，SSA 形式，优化主要在这一层） | LLVM IR（SSA、强类型，有文本和 bitcode 形式） |
| 低层 IR | RTL（接近机器，寄存器分配在这一层） | MachineInstr/MIR 加 MC 层的 MCInst |
| IR 是否对外稳定 | GIMPLE、RTL 不对外稳定，不鼓励外部使用 | LLVM IR 有稳定的文本和 bitcode 形式，鼓励外部前端复用 |
| 指令模板 | `.md` 机器描述 | TableGen `.td` |
| 组织方式 | 整体式流水线，各阶段耦合 | 一组库，三段式，中间是窄接口 |
| 许可证 | GPLv3 加 Runtime Library Exception | Apache-2.0 with LLVM Exception（对企业友好） |
| 接入新前端 | 难（需要进入 GCC 源码树，rustc_codegen_gcc 通过 libgccjit 绕过） | 容易（降到 LLVM IR 即可） |
| JIT | libgccjit（用的人较少） | MCJIT 到 ORC（重点支持） |

</div>

本质区别不在有没有 IR：GIMPLE 和 LLVM IR 地位相同（都是优化主要所在的中层 SSA IR），RTL 和 MachineInstr 地位相同（都接近机器，做寄存器分配），区别在 IR 是否做成库、是否对外开放。实际上，GCC 的长处是成熟架构覆盖最广（包括 LLVM 没有的冷门指令集），是 Linux 内核和多数发行版的事实标准，还有 `-fanalyzer` 等；LLVM/Clang 的长处是模块化（由此产生了 rustc、swiftc、Julia、clangd、lldb、BOLT、MLIR 等一大批项目）、诊断准确（libclang、clangd 直接为 LSP 提供数据，IDE 生态由此而来）、JIT、跨语言复用、许可宽松便于商业修改。两者长期互相促进：Clang 准确的诊断推动 GCC 改进诊断，GCC 的代码质量推动 LLVM 追赶。

### JIT

JIT（运行时按热度编译）和 LLVM 的关系，是理解动态语言为什么快的关键。LLVM 的 JIT 依次经历了 Interpreter、legacy JIT、MCJIT、ORC v1、ORC v2：legacy JIT 自带指令编码器，绕过 MC 层，每个目标都要重复写编码逻辑，已被淘汰；MCJIT 复用 MC 层（从 IR 生成标准的 .o 目标文件，再用 RuntimeDyld 装载并重定位），但它是一个整体，不容易做懒编译、并发和远程执行；现在使用的 ORC v2（LLVM 7 起）是模块化、分层的 JIT。ORC v2 的核心抽象：ExecutionSession（JIT 会话，管理符号查找、并发和生命周期）、JITDylib（模拟一个动态库的符号命名空间，`addToLinkOrder` 按静态和动态链接器的规则解析符号）、MaterializationUnit（按需生成符号定义，与语言无关，LLVM IR 不被特殊对待，自定义编译器或直接写内存的桩函数走同一套机制）、可以叠加的 Layer（IRCompileLayer、IRTransformLayer、ObjectLinkingLayer，以及按函数懒编译的 CompileOnDemandLayer）、两套 JIT 链接器（新的 JITLink 取代旧的 RuntimeDyld）、现成的 `LLJIT`（立即编译）和 `LLLazyJIT`（第一次调用时才编译）。最强的功能是跨进程和跨架构：通过 `ExecutorProcessControl` 加 RPC 把 JIT 生成的代码送到另一个进程甚至另一种架构上执行（lldb 计算表达式就是这样做的）；一次符号查找同时完成返回地址、触发编译、并发同步三件事。使用 ORC 的有 Julia、Cling（C++ REPL）、Swift 解释器、PostgreSQL 的查询表达式 JIT。

各语言运行时的 JIT 分级和触发方式各有取舍：

<div align="center">

| 运行时 | JIT 引擎与分级 | 特点 |
|:--:|:--:|:--:|
| JVM HotSpot | 解释器、C1、C2 分层（Tiered 0 到 4） | 按方法调用和回边计数触发；OSR 栈上替换；激进推测，失败时去优化回到解释器 |
| V8（JS） | Ignition、Sparkplug、Maglev、TurboFan 四级 | 带反馈槽的解释器，基线编译器，按反馈特化的中间层，sea-of-nodes 的高峰层 |
| V8（Wasm） | Liftoff 基线加 TurboFan | 先快速生成代码，再重新编译热点 |
| SpiderMonkey | Baseline Interp、Baseline JIT、Ion（加 Warp） | 三级 |
| JavaScriptCore | LLInt、Baseline、DFG、FTL | FTL 早期用 LLVM 作后端，后来换成自研的 B3/Air |
| .NET CLR | RyuJIT 加分层加 AOT（R2R、Native AOT） | OSR；按 profile 分层 |
| LuaJIT | 基于 trace 的 JIT（不是按方法） | 记录热路径的线性 trace（可以跨函数）再编译 |
| PyPy | meta-tracing JIT（由 RPython 生成） | 在解释器层面做 tracing，自动得到 JIT |
| Julia | LLVM ORC JIT | 第一次调用时按具体的类型签名特化编译 |
| Wasmtime | Cranelift（也是 rustc 的后端） | 快速生成代码，加安全沙箱 |
| QEMU TCG | Tiny Code Generator（动态二进制翻译） | 客户机指令转成 TCG op，再转成宿主代码；缓存翻译块并相互链接 |

</div>

JIT 与 AOT 各有取舍：AOT 在构建时一次编译，启动快，但只能用静态信息；JIT 在运行时按热度编译，启动慢（有预热期），但能用运行时的 profile 做推测优化（多态内联、类型特化、去虚拟化），峰值性能通常更高，代价是需要去优化机制（推测失败时退回），以及可执行内存带来的安全问题（需要 W^X 切换和 icache 同步）。折中的做法有分层编译、PGO（把 JIT 的 profile 思路用到 AOT）、Native AOT，以及 Zig 的 comptime（编译时求值，另一种提前计算）。KuSBI 走的就是 Zig comptime 加 AOT 编译到 rv64 freestanding 的纯静态路线。

### 各架构对 JIT 的支持与 rv J 扩展

所有架构都能做 JIT 的代码生成，但把刚写进内存的数据当作指令执行会遇到三个硬件问题，架构对 JIT 的支持就体现在这三件事的成本上：I-cache 与 D-cache 的一致性（刚写进 D-cache 的代码，I-cache 里还是旧的）、流水线和预取队列里的旧指令、可执行内存的安全（W^X 和指针标签隔离）。第一件事可以用 `compiler-rt/lib/builtins/clear_cache.c`（编译器为 JIT 代码调用的 `__clear_cache`）各架构的实现来对比：

<div align="center">

| 架构 | `__clear_cache` 做什么 | 说明 |
|:--:|:--:|:--:|
| x86/x86-64 | 什么也不做（Linux 下甚至直接 abort，因为根本不应该被调用） | 硬件保证 I/D 一致，JIT 几乎没有额外负担 |
| aa64 | `dc cvau`、`dsb ish`、`ic ivau`、`dsb ish`、`isb sy`，读 CTR_EL0 决定能否省略 | 弱内存模型，必须由软件显式地清理、失效并加屏障 |
| ppc | `dcbf`、`sync`、`icbi`、`isync` | 与 aa 相同，显式刷新 |
| rv（Linux） | 调用系统调用 `riscv_flush_icache`=259（a2=0 表示所有 hart） | 用户态的 `fence.i` 只对本 hart 有效，多核需要内核发 IPI 让其他 hart 执行 fence.i |

</div>

rv 的 `fence.i` 属于 Zifencei 扩展，只对执行它的 hart 有效；多 hart 时，其他 hart 的 I-cache 不会被刷新，所以 Linux 把 icache 刷新做成系统调用，由内核发 IPI 让所有 hart 执行 fence.i。x86 由硬件自动完成（JIT 最省事），aa 和 ppc 由软件显式刷新并加屏障，rv 单 hart 用 fence.i、多 hart 通过内核 IPI，这正是 rv J 扩展想要改进的难点之一。如果 KuSBI 涉及远程 fence.i（RFENCE 扩展），那就是多 hart 的 icache 同步交给 M-mode 固件的地方。

rv 的 J 扩展（截至 2026-06 仍未批准）是为传统的解释型和 JIT 语言、带大型运行时或语言虚拟机的场景设立的任务组。它面向 C#、Go、Java、JavaScript、OCaml、PHP、Python、Ruby、Scala、WebAssembly 等语言共有的 GC、动态类型、动态分派、装箱（boxing）、反射，并明确把动态二进制翻译和改写系统（DynamoRIO、QEMU、ftrace）纳入范围，关注整数溢出检测、垃圾回收、指令缓存管理、指令密度。设计原则是加速 JIT 指令序列的指令都是可选的，软件在运行时检测是否存在，再决定生成哪种代码。J 系列中最成熟的是**指针掩码（Pointer Masking）**：让硬件忽略地址的高位，从而可以把标签放进指针的高位（tagged pointer、NaN-boxing、GC 颜色、内存标签）。没有硬件掩码时，每次解引用都要用软件去掉标签，开销大；有了 PM，装箱、内存标签、进程内隔离几乎没有额外开销。LLVM 已经定义了全部子扩展（`RISCVFeatures.td`）：`Ssnpm`（S 级为更低特权级提供 PM）、`Smnpm`（M 级）、`Smmpm`（M 级为 M-mode 自己）、`Sspm`/`Supm`（表示 S/U-mode 有 PM）。规范状态：QEMU 已经实现到 Zjpm v0.6.1，截至 2026 年仍是草案，社区希望它在 RVA23 profile 中得到批准，以便正式支持 HWASan，Fuchsia 也提出了 RFC 探索在用户态使用。与它相关的扩展常和 JIT、控制流安全一起出现：`Zimop`（May-Be-Operations，占位操作，为 landing pad 和标签检查预留编码空间），`Zicfilp`（landing pad）加 `Zicfiss`（影子栈）一起构成 CFI（保护 JIT 生成代码的间接跳转）。三种架构的对比：

<div align="center">

| 能力 | rv（J 系列，目前是草案） | x86-64 | aa64 |
|:--:|:--:|:--:|:--:|
| I-cache 一致性 | `fence.i`（单 hart），多 hart 通过内核 IPI；J 希望改进 | 硬件自动 | 显式的 `dc cvau`、`ic ivau`、`dsb`、`isb` |
| 指针标签与掩码 | Pointer Masking（Ssnpm、Smnpm、Smmpm、Sspm、Supm） | LAM（Intel）、UAI（AMD） | TBI（默认忽略最高字节）加 MTE（硬件内存标签） |
| CFI（保护间接跳转） | `Zicfilp` 加 `Zicfiss` 影子栈 | CET（ENDBR 加 Shadow Stack） | BTI、PAC、GCS |
| W^X 内存 | PMP/PMA 加 S-mode 页表的 X/W 位 | NX 位加 MPK | XN 位加 PXN |
| 动态二进制翻译 | J 任务组明确纳入范围（DynamoRIO、QEMU、ftrace） | 一致性由硬件保证，LAM 也有帮助 | 弱内存模型让动态二进制翻译比较麻烦，需要大量屏障 |

</div>

rv 的做法是把 x86 全部由硬件完成、aa 部分由硬件完成的能力，拆成一组可以检测、可选、按 profile 逐步批准的扩展，与前面「每个扩展就是一组 `.td`」的做法一致。代价是草案阶段软件要自己检测并生成多种代码，好处是模块化、可以按需裁剪。J 扩展还没有定稿，这里只说明草案的现状，不涉及尚未确定的指令编码。

## 虚拟化与容器

二进制怎样生成、怎样运行讲完了，接下来是怎样隔离地运行。隔离有两条根本不同的路：虚拟化（给每个负载一个独立的内核）和容器（共享宿主内核，只限制看到的范围和可用的资源）。虚拟化的分类（type 1 裸机、type 2 宿主、介于两者之间的形态，以及 microVM）这里只简单介绍，重点放在容器：容器是不用虚拟化的隔离，弄清容器也就弄清了虚拟化的边界。

### 虚拟化的分类

虚拟化按 hypervisor（VMM）所在的位置分类。type 1（裸机）直接运行在硬件上，自己就是一个管理虚拟机的小内核（Xen、VMware ESXi、Hyper-V、rv 上的 axvisor 和 bao）。type 2（宿主型）作为普通进程运行在通用操作系统上（VirtualBox、VMware Workstation、用户态的 QEMU）。Linux KVM 介于两者之间：一个通用内核加载一个内核模块，自己变成 hypervisor，但设备模拟和调度仍借助宿主 Linux。硬件支持方面，x86 靠 VT-x/AMD-V 加 EPT/NPT 二级地址翻译，aa64 靠 EL2 加 Stage-2 翻译，rv 靠 H 扩展（HS 模式、两级页表 hgatp、VS/VU 模式）。microVM（Firecracker、Cloud Hypervisor）是专为容器场景做的折中：去掉 QEMU 的全套设备模拟，只保留 virtio-net/blk 和串口，配合 KVM 硬件虚拟化，既有虚拟机的硬隔离，又有接近容器的启动速度（约 125 毫秒）和部署密度。

### 容器与虚拟机的区别

容器不是虚拟机：没有客户机内核，没有虚拟 CPU 和虚拟硬件，没有 hypervisor。容器进程就是宿主内核上的一个普通进程，只是被内核的几种隔离和限额机制限制了能看到的范围和能用的资源。它由七部分组成，全部是 Linux 内核已有的特性，容器运行时（runc 等）只是按一份 JSON（OCI `config.json`）把它们组合起来：namespace（隔离能看到什么）、cgroup（限制能用多少）、rootfs（用 pivot_root 换根，用 overlayfs 分层）、capabilities（去掉 root 的部分特权）、seccomp（过滤可用的系统调用）、LSM（SELinux/AppArmor 强制访问控制）、默认挂载（/proc、/sys、/dev/pts）。namespace 和 cgroup 互相独立：namespace 管能看到什么，cgroup 管能用多少，不能互相代替。

### namespace

到 2026 年共有八种 namespace，每种隔离一类全局资源（依据 man7 的 namespaces(7)，内核版本取常用的引入版本）：

<div align="center">

| namespace | CLONE 标志 | 隔离的全局资源 | 引入版本 | 创建时需要的 capability |
|:--:|:--:|:--:|:--:|:--:|
| mount | `CLONE_NEWNS` | 挂载点集合和传播树 | 2.4.19（2002） | CAP_SYS_ADMIN |
| uts | `CLONE_NEWUTS` | hostname 和 NIS domainname | 2.6.19（2006） | CAP_SYS_ADMIN |
| ipc | `CLONE_NEWIPC` | SysV IPC 和 POSIX 消息队列 | 2.6.19（2006） | CAP_SYS_ADMIN |
| pid | `CLONE_NEWPID` | 进程 ID 空间（容器里 PID 1 是 init） | 2.6.24（2008） | CAP_SYS_ADMIN |
| net | `CLONE_NEWNET` | 网卡、IP、路由、iptables、端口、套接字 | 2.6.29（2009） | CAP_SYS_ADMIN |
| user | `CLONE_NEWUSER` | UID/GID 映射、capabilities、keyring | 3.8（2013） | 不需要（唯一不需要特权的） |
| cgroup | `CLONE_NEWCGROUP` | `/proc/<pid>/cgroup` 看到的内容 | 4.6（2016） | CAP_SYS_ADMIN |
| time | `CLONE_NEWTIME` | CLOCK_MONOTONIC/BOOTTIME 的偏移 | 5.6（2020） | CAP_SYS_ADMIN |

</div>

最关键的是 user namespace 从 Linux 3.8 起创建时不需要任何特权：它把容器内的 UID 0（root）映射到宿主上的一个非特权 UID（如 100000），容器里看起来是 root，逃逸到宿主也只是普通用户，这是 rootless 容器（podman、lxc 非特权容器）在内核层面的基础。runc 把这一点写成了顺序约束：它的 `NamespaceTypes()` 注释说明 user namespace 永远排在第一位，不能移动（必须最先建立，之后的 namespace 才能在新 user namespace 的权限下创建）。还有两点：PID namespace 只对子进程生效，调用 `unshare(CLONE_NEWPID)` 的进程自己不进入新的 PID namespace，它 fork 出的子进程才是新 namespace 的 PID 1（这是下面 nsexec 要 fork 两次的原因）；time namespace 只偏移单调时钟和启动时钟，不偏移 CLOCK_REALTIME（主要为 CRIU 的检查点和恢复保持单调时钟连续）。

### 进出 namespace 与 nsexec 的两次 fork

`clone(2)` 创建新进程并为它新建 namespace；`setns(2)` 让调用进程加入一个已有的 namespace（`docker exec`、`nsenter` 进入运行中的容器，K8s Pod 复用 sandbox 的 netns，都用它）；`unshare(2)` 让调用进程自己离开当前 namespace，进入新建的 namespace。runc 优先用 setns：只为需要新建的 namespace（`config.json` 中 path 为空）设置 clone 标志，需要加入已有 namespace 的（path 不为空）用 setns。

runc 中最细致的部分是 namespace 引导程序 `nsexec.c`：它用 C 编写，在 Go 运行时启动之前作为构造函数执行。必须用 C 是因为 Go 运行时是多线程的，而 `setns`、`unshare`、`clone` 对线程和 user namespace 有严格的时序要求，在 Go 的多线程调度下无法安全完成。它是一个三阶段、fork 两次的状态机（stage-0 负责协调，stage-1 进入 user 等 namespace，stage-2 是进入 PID namespace 后真正的 init），fork 两次的原因正是上面说的两点：一是 user namespace 必须最先建立，但 `unshare(CLONE_NEWUSER)` 会立即失去原 namespace 的全部 capability，父进程就无法再写 uid_map（写它需要父进程在外层有 CAP_SETUID），所以先 clone 出 stage-1，由仍有特权的 stage-0 替它写 `/proc/<pid>/{setgroups,uid_map,gid_map}`；二是 PID namespace 只对子进程生效，要再 fork 一层（stage-2），才能让一个进程成为新 PID namespace 的 PID 1。引导完成后控制权交回 Go，`Init()` 执行一段与安全有关的步骤：设置 no_new_privs（防止 execve 通过 setuid 提权，是非特权 seccomp 的前提），设置 SELinux 标签，加载 seccomp（没有 no_new_privs 时加载 seccomp 需要特权，必须在丢弃 capabilities 之前加载），finalizeNamespace 丢弃多余的 capabilities 并切换用户和组，最后 execve 进入用户程序，容器的 PID 1 就是这样产生的。换根用 `pivot_root` 而不是 `chroot`（前者彻底卸掉旧的根，防止 chroot 逃逸）。

### cgroup

cgroup 管理资源限额，有 v1（旧版，每个控制器一棵独立的树）和 v2（统一版，Linux 4.5 起稳定，只有一棵统一的树）两代，差别很大：

<div align="center">

| | cgroup v1 | cgroup v2 |
|:--:|:--:|:--:|
| 层级 | 每个控制器一棵独立的树 | 一棵统一的树，每个进程只有一个位置 |
| 开关控制器 | 编译时加挂载时绑定 | 运行时 `echo "+cpu +memory" > cgroup.subtree_control` |
| CPU 控制 | `cpu.shares` 加 `cpu.cfs_quota_us`/`period` | `cpu.weight`（1 到 10000）加 `cpu.max`（quota period） |
| 内存限制 | `memory.limit_in_bytes`（硬限制） | `memory.max`（硬）、`memory.high`（软，带回收压力）、`memory.low/min`（保护） |
| 设备控制 | `devices.allow`/`deny` 白名单文件 | eBPF `BPF_PROG_TYPE_CGROUP_DEVICE` 程序 |
| PSI 压力信息 | × | √ `cpu/memory/io.pressure` |
| 委派 | × | √ `subtree_control` 委派加 `nsdelegate` |
| 内部进程约束 | 无 | no-internal-process（有控制器的非根 cgroup 不能直接包含进程） |

</div>

runc 把 cgroup 管理做成独立的模块，v2 实现中每个控制器一个文件，本质上是把 OCI 的 Resources 转换成对 cgroupfs 文件的写操作：`cpu.go` 写 `cpu.weight`/`cpu.max`，`memory.go` 写 `memory.max`/`memory.low`，`io.go` 写 `io.max` 的四类限速，`pids.go` 写 `pids.max`，`psi.go` 解析 `some`/`full` 压力数据；把进程加入 cgroup，就是把 PID 写进 `cgroup.procs` 这一个文件。v1 和 v2 实现上最大的差别是设备控制：v2 不再有 `devices.allow`/`deny` 文件，而是生成一个 eBPF 程序挂到 `BPF_CGROUP_DEVICE` 上（runc 这段代码的注释说明是从 crun 的 `ebpf.c` 移植的）。所以教学或比赛用的内核要运行 Docker，必须实现 cgroupfs 的三部分（控制器、cgroupfs、层级分组）：启动容器一定要用 cgroup，内核没有对应的控制器，runc 就会报 `failed to write cpu.max`。

### capabilities、seccomp、LSM 与 rootfs

容器里的 root 不是完整的 root，而是去掉了部分 capability 的 root。OCI 定义五个集合（effective 当前生效、bounding 上限、inheritable 跨 execve 继承、permitted 允许的范围、ambient 环境），runc 用 `prctl(PR_CAPBSET_DROP)` 逐个丢弃 bounding，用 `capset()` 设置其余四个集合，Docker 默认保留约 14 个（CAP_CHOWN、CAP_NET_BIND_SERVICE、CAP_SETUID 等），丢弃 CAP_SYS_ADMIN、CAP_SYS_MODULE 这些危险的位。seccomp 用 BPF 过滤可用的系统调用：`defaultAction`（如 `SCMP_ACT_ERRNO`、`SCMP_ACT_KILL_PROCESS`、`SCMP_ACT_ALLOW`、`SCMP_ACT_NOTIFY`）加上每条 `syscalls[]` 的 names、action、args（可以按参数值匹配），架构常量已经包括 `SCMP_ARCH_RISCV64` 和 `SCMP_ARCH_LOONGARCH64`（即 seccomp 已经支持 rv 和 la）。其中 `SCMP_ACT_NOTIFY` 把被拦截的系统调用通过 UNIX socket（用 `SCM_RIGHTS` 传递 seccompFd）交给用户态的代理处理，rootless 容器靠它模拟 mount、mknod 等需要特权的系统调用。LSM 这一层写 `apparmorProfile` 和 `selinuxLabel`；rootfs 是 overlayfs：只读的镜像层（lowerdir）叠加容器的可写层（upperdir），得到合并后的视图（merged）。与虚拟机对比：

<div align="center">

| | 容器 | 虚拟机 |
|:--:|:--:|:--:|
| 内核 | 共享宿主内核（没有客户机内核） | 每个虚拟机一个独立的客户机内核 |
| 隔离方式 | namespace、cgroup、capabilities、seccomp、LSM，靠软件隔离 | 硬件辅助虚拟化加二级地址翻译 |
| 攻击面 | 宿主内核的全部系统调用接口（大） | hypervisor 加 virtio 设备模型（小） |
| 启动 | 毫秒级（就是 fork 加 exec） | 秒级（要启动内核） |
| 部署密度 | 单机几百到几千 | 单机几十 |
| 跨内核版本 | × 必须兼容宿主内核的 ABI | √ 客户机可以是任意操作系统 |

</div>

### OCI 的三份规范

OCI（Open Container Initiative，2015，Linux 基金会）把从 Docker 拆出来的事实标准定成三份独立的规范。runtime-spec 定义怎样把一组文件作为容器运行：一个 filesystem bundle 由 `config.json`（配置）和 `rootfs/`（根目录）组成，`config.json` 中的 `linux.namespaces[]`（path 为空表示新建，不为空表示加入）、`uidMappings`/`gidMappings`、`linux.resources`（cgroup 限额）、`linux.seccomp`、`maskedPaths`/`readonlyPaths` 等字段一一对应内核机制，生命周期是 creating、created、running、stopped 的 12 步状态机（中间穿插 prestart、poststart 等 hook），runc 命令行的 create、start、run、exec、kill、delete、state、pause、checkpoint、restore 与之对应。image-spec 定义镜像的格式：按内容寻址（一切都用 sha256 digest 引用，构成 Merkle DAG），媒体类型有 Image Index（多架构的清单列表）、Image Manifest（单架构的 config 加 layers）、Image Config（运行配置加 rootfs.diff_ids）、Layer（tar 或 tar 加 gzip/zstd）。三个哈希要分清：DiffID 是单个未压缩 layer tar 的 sha256，ChainID 是层叠加后递归计算的复合哈希（与顺序有关，`ChainID(C) ≠ ChainID(A|B|C)`），ImageID 是 config JSON 本身的 digest。distribution-spec 定义镜像仓库怎样传输：以 `/v2/` 开头的 HTTP API（end-1 到 end-14 共 14 个端点），拉镜像时先 GET manifest，再逐个 GET blob 并按 digest 校验，推镜像顺序相反（先传 blob 再传 manifest），跨仓库用 `mount` 避免重复传输；OCI 1.1 新增的 referrers API（end-12）把签名、SBOM、attestation 通过 subject 关联到镜像上。

### 容器运行时

运行时分两层：高层（管理镜像、网络、存储、CRI、生命周期 API）和低层（按 config.json 实际创建容器）：

<div align="center">

| 项目 | 语言 | 层 | 定位 |
|:--:|:--:|:--:|:--:|
| runc | Go 加 C | 低层 | OCI runtime-spec 的参考实现，由 Docker 捐给 OCI，namespace 引导用 C 写的 nsexec.c |
| crun | C | 低层 | Red Hat 用 C 写的实现，比 runc 更小更快，原生支持 cgroup v2 和 eBPF |
| containerd | Go | 高层 | 工业标准的守护进程，CNCF 毕业项目，使用 Runtime v2 shim 模型 |
| CRI-O | Go | 高层 | 专为 K8s 设计的 CRI 运行时，没有多余功能，用 conmon 监管 |
| podman | Go | 高层 | 不需要守护进程，支持 rootless，兼容 Docker 命令行，原生支持 pod |
| lxc | C | 低层 | 老牌的系统容器（2008），运行完整的 init，用起来像轻量虚拟机，最早支持非特权容器 |

</div>

几个机制：containerd 的 Runtime v2 shim 模型不直接管理容器进程，而是为每个容器或 Pod 启动一个 shim 进程（`containerd-shim-runc-v2`），shim 调用 runc 创建容器，并一直持有容器的 stdio、接收退出码，所以 containerd 守护进程重启不影响正在运行的容器（CRI-O 和 podman 的 conmon 是同样思路的小监管进程）。podman 的 rootless 依靠 user namespace、`newuidmap`/`newgidmap`（subuid/subgid 映射）、fuse-overlayfs（不需要特权的 overlay）、slirp4netns/pasta（不需要特权的网络）。低层还有两种安全沙箱运行时：gVisor/runsc 用 Go 在用户态实现了一个 Linux 内核（Sentry），拦截容器的系统调用在用户态模拟，容器不直接接触宿主内核；Kata Containers 为每个容器启动一个轻量的 microVM（QEMU 或 Cloud Hypervisor），兼容 OCI，但实际上是虚拟机。两者都实现了 OCI runtime-spec，可以被 containerd 或 CRI-O 当作低层运行时直接替换 runc。再往上是 K8s 与容器之间的三个接口：CRI（kubelet 与 containerd/CRI-O 之间的 gRPC）、CNI（以插件方式配置 netns 的网络，如 bridge、Calico、Cilium）、CSI（以插件方式挂载存储卷）。

### 容器、microVM 与虚拟机的对比

按隔离强度从强到弱、开销从重到轻排列：传统虚拟机，microVM（Firecracker、Kata），gVisor，容器（runc）：

<div align="center">

| | 容器（runc） | microVM（Firecracker） | gVisor（runsc） | 传统虚拟机（QEMU/KVM） |
|:--:|:--:|:--:|:--:|:--:|
| 内核 | 共享宿主内核 | 独立的精简客户机内核 | 用户态的 Sentry | 完整独立的客户机内核 |
| 隔离强度 | 弱（共享内核 ABI） | 强（VT-x/RVH 二级翻译） | 中（拦截系统调用） | 强 |
| 攻击面 | 宿主的全部系统调用 | hypervisor 加 virtio（很小） | Sentry 加少量宿主系统调用 | hypervisor 加完整的设备模型 |
| 启动 | 毫秒 | 约 125 毫秒 | 一秒以内 | 秒级 |
| 内存开销 | 接近零 | 每个虚拟机约 5 MB | 中 | 几十到几百 MB |
| 部署密度 | 每台机器几千 | 每台机器几千 | 几百 | 几十 |

</div>

microVM 是其中最好的折中：去掉 QEMU 的全套设备模拟，只保留 virtio-net/blk 和串口，配合 KVM 硬件虚拟化，既有虚拟机的硬隔离，又有接近容器的启动速度和密度。Firecracker（AWS，用 Rust 编写）是 Lambda 和 Fargate 多租户的后端，Kata 把 microVM 包装成 OCI/CRI 接口，K8s 可以不改动就替换 runc。它和 Unikernel 定位相近（都追求轻量隔离和快速启动），区别在 Unikernel 是每个应用一个完整的小操作系统，microVM 是运行通用客户机的精简虚拟机。从源码看，两者的分界很清楚：runc 只调用 clone、setns、unshare，写 cgroupfs，执行 pivot_root、seccomp、capset，没有任何硬件虚拟化指令，这从代码上证明了容器就是被限制住的普通进程；microVM 才用到 KVM 硬件虚拟化。

## 跨操作系统的 API 与运行

前面一直以 Linux/POSIX 为准。这一节做两件事：列出 Windows 和 macOS 截至 2026 年的主要 API（功能，以及与 Linux/GNU/POSIX 的对应），说明三种系统在稳定边界上的根本区别；再讲跨操作系统运行程序：在 Linux 上运行 Windows 程序（wine），在 Windows 上运行 Linux 程序（WSL），以及承载它们的 Hyper-V 和 VMware。

### 三种系统的稳定边界

理解 Windows 和 macOS，先要知道它们与 Linux 在「哪一层是稳定的 ABI」上选择完全不同。Linux 的稳定边界是原始系统调用号（最底层）：内核保证 1990 年代直接用 `int 0x80` 的静态二进制今天仍能运行，代价是调用号只增不减、字段只能追加（语义要变就开新的调用号，例如从 `clock_gettime` 到 `clock_gettime64`、从 `fstat` 到 `statx`，旧调用号保持不变）。Windows 和 macOS 正好相反：它们的系统调用号每个版本都可能改变（不稳定），所有程序必须通过各自官方的动态库（Windows 是 `ntdll.dll`，macOS 是 `libSystem.dylib`），不允许静态链接绕过。这不是缺陷，而是有意的选择：把稳定边界放在 DLL/dylib 上，内核就可以自由地调整系统调用表。

<div align="center">

| | Linux | Windows | macOS |
|:--:|:--:|:--:|:--:|
| 稳定边界 | 原始系统调用号（最底层） | Win32 DLL API（ntdll 的调用号不稳定） | libSystem 的符号（调用号不稳定） |
| 能否静态链接 libc 直接发系统调用 | 能（musl 静态链接） | 不能（必须经过 ntdll） | 不能（必须经过 libSystem） |
| 内核结构 | 宏内核 | 混合（NT 微内核风格加大量内核态子系统） | 混合（Mach 微内核加 BSD） |
| 主要的异步 I/O | io_uring（5.1 起） | IOCP（2000 年代） | kqueue 加 GCD |
| 事件多路复用 | epoll | IOCP、旧的 select | kqueue |

</div>

### Windows API 与 Linux/POSIX 的对应

Windows 的调用过程是：用户 API（Win32 的 kernel32、user32），转到 `ntdll.dll` 里的 `Nt*/Zw*` 桩函数，桩函数把 SSN（System Service Number）放进 eax，执行 `syscall`（x64）或 `svc`（aa64），内核通过 SSDT（System Service Descriptor Table）查表分发；SSN 每个版本都会变，GUI 和 GDI 走 Shadow SSDT（win32k）。功能对照（2026 年的 Win11 和 Server 2025）：

<div align="center">

| Windows API | 功能 | 与 Linux/POSIX 的对应 |
|:--:|:--:|:--:|
| `CreateFile`/`CreateFile2` | 打开或创建文件、设备、管道 | 相当于 `open`，一个 API 同时承担 open、socket、CreateNamedPipe 的工作 |
| `ReadFile`/`WriteFile` | 同步或异步读写（OVERLAPPED） | 相当于 `read`/`write`；OVERLAPPED 相当于 `O_NONBLOCK` 加 `aio` |
| `VirtualAlloc`/`VirtualAlloc2` | 保留或提交虚拟内存页 | 相当于 `mmap(MAP_ANONYMOUS)` 加 `mprotect`；先保留后提交，相当于懒分配再访问 |
| `WaitForSingleObject`/`...Multiple` | 等待内核对象就绪 | 相当于 `futex`、`poll`、`pthread_join`，统一的可等待句柄模型 |
| `CreateThread`/`CreateProcess` | 创建线程或进程 | 相当于 `clone`、`pthread_create`；CreateProcess 相当于 `fork` 加 `execve` 合在一起（没有 fork 语义） |
| IOCP（`CreateIoCompletionPort`） | 完成端口：异步 I/O 的完成事件队列 | 相当于 io_uring（完成式），比 epoll（就绪式）强得多；IOCP 是最早的完成式接口 |
| Winsock（`WSASocket`/`WSARecv`） | 网络套接字（Berkeley 的变体） | 相当于 POSIX socket，API 名字加了 `WSA` 前缀，AcceptEx/ConnectEx 用于异步 |
| `VirtualProtect`/`MapViewOfFile` | 修改页面权限、文件映射 | 相当于 `mprotect`、`mmap` 文件映射 |
| `SetThreadAffinityMask` | 绑定 CPU 核 | 相当于 `sched_setaffinity` |

</div>

### macOS API 与 Linux/POSIX 的对应

macOS 的内核 XNU 是 Mach 微内核和 BSD 的混合，有两套系统调用：BSD 系统调用和 Mach trap 共用一条陷入指令，用调用号区分。aa64 上是 `svc #0x80`，调用号在 x16，调用号的高字节是类别前缀（`0x2000000|n` 是 UNIX/BSD 类，走 `unix_syscall`；负数或 `0x1000000|n` 是 Mach trap 类，走 `mach_syscall`）。用户程序必须通过 libSystem（里面有真正执行 svc 的桩函数），Apple 不保证系统调用号稳定。功能对照（2026 年的 macOS 15 及以后，以 Apple Silicon aa64 为主）：

<div align="center">

| macOS API 或机制 | 功能 | 与 Linux/POSIX 的对应 |
|:--:|:--:|:--:|
| BSD 系统调用（`open`/`read`/`mmap`/`fork`/`execve`） | POSIX 文件、进程、内存 | 几乎与 POSIX 一一对应（XNU 的 BSD 部分直接来自 4.4BSD），调用号带 `0x2000000` 前缀 |
| `libSystem.dylib` | macOS 的 libc（包括 libc、libpthread、libm、内核桩函数） | 相当于 glibc、musl，但必须经过它（不能静态链接绕过） |
| Mach trap（`mach_msg`/`mach_port_*`/`task_*`） | 微内核 IPC、端口、任务、虚拟内存对象 | Linux 没有直接对应；`vm_allocate` 相当于匿名 `mmap` |
| kqueue（`kqueue`/`kevent`） | 统一的事件通知（fd、信号、定时器、vnode、进程） | 相当于 epoll，但更通用（一套 API 同时等待 fd、信号、定时器、文件变化），来自 FreeBSD |
| GCD/libdispatch（`dispatch_async`） | 用户态线程池加任务队列调度 | 内核没有对应；相当于 tokio、glib 的线程池，底层用 `__workq` 系列系统调用 |
| `pthread_*`（libSystem 中的 libpthread） | 线程 | 就是 POSIX threads，底层 `bsdthread_create` 结合了 Mach 和 BSD |
| `xpc_*`（XPC） | 高层的进程间通信和服务管理 | 相当于 D-Bus 或 systemd 的服务激活，底层用 Mach 消息 |

</div>

### wine、WSL、Hyper-V 与 VMware

知道了三种系统的稳定边界，就能看懂在一个操作系统上运行另一个操作系统的程序有哪几种做法。它们分在两个层面：API 转换（不需要另一个内核）和虚拟化（需要另一个内核），后者就是「虚拟化与容器」里的 hypervisor。

**wine 在 Linux 上运行 Windows 程序，靠的是 API 转换，不是虚拟化。** Wine 的名字是递归缩写「Wine Is Not an Emulator」：它不模拟 x86 CPU，也不运行 Windows 内核，而是在 Linux 上重新实现 Win32 和 ntdll 的 API，再加一个 PE/COFF 加载器，直接把 `.exe` 装进 Linux 进程的地址空间。Windows 程序调用 `CreateFile`，wine 的 `kernel32` 实现把它转换成 Linux 的 `open`；调用 `ntdll` 的 `Nt*` 桩函数，wine 把它落到对应的 Linux 系统调用上。Windows 的内核对象（事件、互斥量、进程句柄）由一个叫 `wineserver` 的用户态守护进程统一管理（相当于 NT 内核的对象管理器）。这种做法没有虚拟化开销，Windows 程序和 Linux 程序共用一个内核；但 wine 只要没实现某个 API，或者实现有偏差，程序就会出错。Valve 的 Proton 在 wine 之上加了 DXVK 和 vkd3d（把 Direct3D 转换成 Vulkan），让 Windows 游戏在 Linux 上运行，是这种做法最成功的工业应用。

**WSL 在 Windows 上运行 Linux 程序，两代用了两种做法。** WSL1 和 wine 正好相反，也是 API 转换：在 NT 内核里加一个 Linux 系统调用转换层（`lxcore`），把 Linux 程序发出的系统调用实时转换成 NT 的原生调用，没有 Linux 内核，也没有虚拟化。它的缺点和 wine 一样：系统调用覆盖不全，有些行为（尤其是文件系统语义和 `fork` 的细节）很难完全一致。所以 WSL2 换了一种完全不同的做法：在基于 Hyper-V 的轻量 utility VM 里运行一个真正的 Linux 内核，系统调用兼容性因此是 100%（因为就是真的 Linux），代价是多了一层虚拟化，以及跨虚拟机访问文件的开销。这两代的区别，正是「虚拟化与容器」里「拦截 API 还是用真正的内核」的取舍。

**Hyper-V 和 VMware 是承载这些的 hypervisor。** Hyper-V 是微软的 type 1 裸机 hypervisor：安装后它运行在 Windows 之下，Windows 自己变成一个有特权的根分区（root partition），WSL2、Windows Sandbox、Docker Desktop 的 Linux 后端都运行在它之上的 utility VM 里。VMware 两种产品都有：Workstation/Player 是 type 2 宿主型（作为普通程序运行在 Windows 或 Linux 上），ESXi 是 type 1 裸机型（在数据中心直接装在硬件上）。对应「虚拟化的分类」：wine 和 WSL1 是 API 转换（最轻，不需要内核），WSL2 和 microVM 是轻量虚拟机，Hyper-V 和 ESXi 是 type 1，VMware Workstation 是 type 2。还有跨架构的情况：Apple Silicon 上的 Rosetta 2 把 x86-64 二进制翻译成 aa64（以 AOT 为主、JIT 作后备的二进制翻译），解决的是跨指令集运行程序，与 wine、WSL 解决的跨操作系统运行程序互相独立：一个翻译指令集，一个转换 API 和系统调用，两者结合才能在 A 机器上运行 B 平台的程序。

## 系统裁剪与发行版

最后一步是把前面这些部件组装成一个能启动、能使用、能裁剪的完整系统，也就是构建 rootfs 和发行版。下面看五种构建方式：busybox（一个二进制包含整套命令）、buildroot（Make 加 Kconfig 的构建协调器）、Yocto（元数据加任务引擎）、openwrt（路由器专用的几个子系统）、openRuyi 与 ruyi-tutorials（RPM 发行版和 LFS 式的手工自举），再看启动过程和 FHS，最后对比。

### 五种构建方式

同样是从源码到镜像，五者在核心机制和增量重建上的选择不同：

<div align="center">

| 方式 | 代表 | 核心机制 | 增量重建 |
|:--:|:--:|:--:|:--:|
| 多入口的单个二进制 | busybox | applet 的 X-macro 名字表加函数指针分发 | 整体编译 |
| Make 加 Kconfig 的协调器 | buildroot/openwrt | 每个包一个 `.mk` 加 `.stamp_*` 状态机 | 弱（以 stamp 为粒度） |
| 元数据加任务引擎 | Yocto/Poky（bitbake） | recipe `.bb` 加任务 DAG 加 sstate 签名缓存 | 强（哈希不一致才重新执行） |
| 手写脚本自举 | ruyi-tutorials（LFS 式） | shell 两遍编译 gcc | 没有（按顺序执行） |
| RPM 发行版 | openRuyi | `.spec`（%build、%install、%files） | 以包为单位 |

</div>

### busybox

busybox 是一个静态二进制，包含约 350 个 applet（命令），靠 `argv[0]`（或 `busybox <applet>`）选择入口，全部打开时静态链接约 700 KB 到 1 MB。它的核心是用 X-macro 维护唯一的声明来源：`applets.src.h` 里只有一份命令清单，在 `#include` 前 `#define` 不同的展开规则，同一份清单就生成七种结果：函数原型、名字与函数的对应、帮助文本、符号链接表、suid 表、脚本表，以及核心的 `struct bb_applet applets[]` 数组。新增一个命令，只需在它自己的 `.c` 文件开头写一行 `//applet:` 注释、一段 `//config:` Kconfig 和 `//usage:` 帮助，不用改任何集中的清单。运行时的分发不直接用包含字符串指针的结构体数组（浪费内存），而是由一个宿主程序在编译时压缩成两张紧凑的表：所有名字首尾相连、用 NUL 分隔的大字符串 `applet_names[]`，以及一一对应的函数指针表 `applet_main[]`，另外还有一张把 nofork、noexec、suid、安装位置压缩成每个 applet 几个位的属性表。查找时先用一张已知偏移的采样表把线性查找的范围缩小到一段，再逐字节比较（注释里甚至给出了约 350 个 applet 时不同采样密度的周期开销），找到后执行 `applet_main[applet_no](argc, argv)` 这一次函数指针调用。极端裁剪时，如果 `.config` 只选了一个 applet，就走 `SINGLE_APPLET_MAIN`，连查找表都不链接，可以小到几十 KB。

busybox 的 init 是可以用作容器和嵌入式系统 1 号进程的最小 PID 1。它用位掩码定义动作类型（SYSINIT 系统初始化、WAIT 阻塞等待、ONCE 执行一次、RESPAWN 退出后重启、ASKFIRST 按回车后启动、CTRLALTDEL、SHUTDOWN、RESTART）。主流程很早就用 `sigprocmask` 屏蔽关机和重新读取配置的信号（防止用户在 init 刚启动时发 poweroff 导致信号丢失），检查 `getpid()==1`，用 `reboot(RB_DISABLE_CAD)` 把 Ctrl-Alt-Del 从内核直接重启改为由 init 处理，然后按 `run_actions(SYSINIT)`、WAIT、ONCE 的顺序执行，最后进入循环，运行 RESPAWN 和 ASKFIRST 动作，收到 SIGCHLD 时醒来。没有 `/etc/inittab` 时有内置的默认配置（SYSINIT 执行 `/etc/init.d/rcS`，各虚拟终端用 ASKFIRST 启动登录 shell，SHUTDOWN 时 `umount -a -r` 和 `swapoff -a`）。

### buildroot

buildroot 只用 Make 和一个 `.config`，每个包一个 `<pkg>.mk`（共 2953 个包）。每个包的 `.mk` 结尾是 `$(eval $(generic-package))`（或 autotools、cmake、cargo、python、golang 等变体），把包名展开成一组以 `.stamp_*` 空文件为目标的 Make 规则。这些 stamp 构成一个状态机，每个阶段一个 stamp（downloaded、extracted、patched、configured、built、staging_installed、target_installed、installed），Make 根据 stamp 是否存在和时间戳判断阶段是否完成，规则体统一是 `step_start`、hooks、命令、`step_end`、`touch $@`。包的描述是声明式的，一个 autotools 包就是 `XXX_VERSION`、`XXX_SITE`、`XXX_SOURCE`、`XXX_LICENSE`、`XXX_CONF_OPTS` 几个变量，加上由 Kconfig 控制的可选特性。三个目录要分清：host/ 放在构建机上运行的工具和目标工具链的 sysroot；staging/ 是带开发头文件和库的交叉 sysroot（供其他包编译时链接，不进入最终镜像）；target/ 是几乎完整的根文件系统（没有开发头文件，二进制已经 strip，是最终镜像的来源）。工具链有 internal（buildroot 自己用 binutils、两遍 gcc 和 libc 源码构建）和 external（直接使用预编译的工具链）两种。打包 rootfs 用 fakeroot：非 root 用户不能 `chown root:root` 或 `mknod`，fakeroot 用 LD_PRELOAD 拦截 stat、chown、mknod，伪装成 root，在用户态生成看起来属于 root 的镜像，其中 `mkusers` 生成 `/etc/passwd`、`shadow`、`group`，`makedevs` 按设备表生成 `/dev/*` 静态节点，最后输出 ext4、squashfs、cpio 等格式。buildroot 增量重建弱的原因也在 stamp：stamp 一旦存在，除非手工 `make <pkg>-dirclean` 或 `-rebuild`，修改源码不会自动重新构建，这是 buildroot 与 Yocto 的关键区别。

### Yocto/Poky

Yocto 是工业级的元数据加任务引擎，分三层：bitbake（用 Python 写的任务引擎，解析配置、建立任务 DAG、调度执行），元数据（recipe `.bb`、`.bbappend`、`.bbclass`、`.conf`），layer（`meta-*` 目录，按关注点分开，BSP、发行版、应用各成一层，用 `.bbappend` 叠加，而不是修改原来的 recipe）。一个 recipe 描述一个包：元数据变量（`SRC_URI`、`LICENSE`、`DEPENDS`、`PV`）加任务函数，`.bbclass` 通过 `inherit` 复用任务模板（相当于 buildroot 的 `*-package` 基础设施）。标准的任务链是 `do_fetch`、`do_unpack`、`do_patch`、`do_configure`、`do_compile`、`do_install`、`do_populate_sysroot`、`do_package`、`do_package_write_{rpm,deb,ipk}`、`do_rootfs`/`do_image`。与 busybox、buildroot 不同，每个任务是可以单独缓存的单位，任务之间靠 DAG 依赖，并且每个 recipe 有自己的 recipe-sysroot（比 buildroot 共用一个 staging 隔离得更好，不会混用头文件）。它的核心是 sstate 签名缓存：每个任务计算一个签名，等于 basehash（这个任务的变量和函数内容的哈希）加上所有依赖任务的哈希，把这个完整的输入指纹写进 stamp 的文件名，任何元数据的改动都会改变哈希，从而自动重新执行这个任务及其下游（这正是 buildroot 的 stamp 做不到的按内容判断）；任务的输出打包进 sstate 缓存，下次哈希一致就直接解包结果，跳过 do_compile（setscene 任务）。在工程上，改一行 distro.conf，buildroot 可能要全部重新构建，Yocto 只重新执行受影响的子树，这是它被认为适合工业维护的原因，代价是 recipe 语言、多层结构和签名带来的较高学习成本。

<div align="center">

| 概念 | Yocto | buildroot 中的对应 |
|:--:|:--:|:--:|
| 软件描述 | recipe `.bb` | package `.mk` |
| 任务模板 | `.bbclass` 加 `inherit` | `*-package` 基础设施 |
| 配置 | `.conf`（local、distro、machine） | `.config`（Kconfig） |
| 叠加定制 | `.bbappend`（不改原文件） | `BR2_GLOBAL_PATCH_DIR`、`_OVERRIDE_SRCDIR` |
| 板级支持 | `meta-<bsp>` 加 machine `.conf` | `board/` 加 `<board>_defconfig` |

</div>

### openwrt

openwrt 是为路由器优化的发行版，有几个自己开发的子系统。procd 是它的 PID 1 和服务管理器（取代 sysvinit），服务脚本写在 `/etc/init.d/<svc>` 的 shell 里，设置 `USE_PROCD=1`，在 `start_service()` 里调用 `procd_open_instance`、`procd_set_param command`、`procd_set_param respawn`、`procd_close_instance`，这些辅助函数把服务描述序列化成 JSON，通过 ubus 交给 procd，由它 fork、监督、重启。ubus 是 openwrt 的轻量 D-Bus：Unix socket 加 ubusd 守护进程，服务注册对象和方法，命令行用 `ubus call <obj> <method> '{json}'`，procd、netifd、rpcd 都靠它通信。uci（Unified Configuration Interface）是统一的配置：`/etc/config/<pkg>` 是纯文本（config、option、list 三个关键字），命令行用 `uci get/set/commit`，首次启动时执行 `/etc/uci-defaults/*` 后提交固定下来，LuCI 网页界面是它的图形前端。包管理上，24.10 仍用 opkg（ipkg 的分支，`.ipk` 是 ar 包），25.12.0（2026-03 发布）改用 apk（Alpine Package Keeper，主要因为 opkg 已停止维护，apk 仍在活跃开发），同一版本还把 wifi 等系统脚本改写成 ucode（类似 JavaScript 的脚本语言，直接访问 ubus 和 uci）；procd、ubus、uci 不受包管理更换的影响。

### openRuyi 与 ruyi-tutorials

openRuyi 是中国科学院软件研究所主导的 rv RPM 发行版，结构是标准的 `SPECS/<pkg>/<pkg>.spec`：许可证用 MulanPSL-2.0（木兰宽松许可证），有 `%bcond` 条件构建开关、`#!RemoteAsset: sha256:` 自定义的远程资源校验，用 systemd 作 init（对比 openwrt 的 procd、buildroot 默认的 busybox init），并用新版 RPM 的 `BuildSystem: autotools` 加 `BuildOption` 声明式构建，不用手写 `%build` 和 `%install`，遵循 REUSE 规范（每个文件都有 SPDX 头）。它是把 Fedora、openEuler 风格的 RPM 工作流移植到 rv 上。

ruyi-tutorials 是 LFS 式从零自举的教学项目，用 shell 脚本按顺序执行（prepare-env、host-tools、toolchain、opensbi、linux、busybox、sysvinit、coreutils、bash、python3、target-image）。最有教学价值的是 toolchain 这一步的两遍 gcc 自举，要两遍是因为编译 glibc 需要编译器，而完整的 gcc 又需要 glibc 提供的 libc 和启动文件。所以第一遍先配置一个 `--enable-languages=c --disable-shared --without-headers --with-newlib` 的最小 gcc（不依赖目标 libc，只能编译 C，没有线程和共享库，只够编译 glibc），用它把 linux-headers 和 glibc 装进 staging，第二遍再配置一个 `--enable-shared --enable-threads --with-sysroot=staging` 的完整 gcc。工具链外面包一层 wrapper（与 buildroot 相同，把真正的 `riscv64-gcc` 改名为 `*.br_real`，`gcc` 软链接到 wrapper，统一加上 sysroot 和安全相关的参数），ARCH/ABI 固定为 `rv64imafd_zicsr_zifencei` 和 `lp64d`。target 阶段同样用 fakeroot 生成 rootfs。

### rootfs 的启动与 FHS

镜像做好后的启动过程是：内核解压，挂载 rootfs，执行 PID 1。根文件系统有两种。现在用 initramfs：用 `cpio.gz`（或 cpio.zst）打包，内核把它解压到 tmpfs 直接作为根，执行 `/init`（PID 1），不需要挂载，也不依赖块设备（内核命令行的 `init=` 可以指定别的程序）。旧的方式是 initrd：一个 ramdisk 块设备，内核挂载后执行 `/linuxrc`，再由它 `pivot_root` 到真正的根。典型的过程是：内核，initramfs 的 `/init`（加载驱动、解密、找到真正的根），`switch_root`，真正 rootfs 上的 `/sbin/init`。无论哪种 init，PID 1 的职责都一样：系统初始化（挂载 /proc、/sys、/dev，挂载 fstab，设置主机名），启动并监督服务，收养孤儿进程并回收（避免僵尸进程），处理关机和重启信号。各种服务管理方式的对比：

<div align="center">

| | sysvinit | systemd | OpenRC | procd | busybox init |
|:--:|:--:|:--:|:--:|:--:|:--:|
| 配置 | inittab 加 init.d 中的 shell | unit 文件（声明式） | init.d 加 conf.d | init.d 中的 shell 加 ubus JSON | inittab（极简） |
| 启动方式 | 按 runlevel 的符号链接串行执行 | 按依赖图并行，支持 socket 激活 | 按依赖排序，可以并行 | 按 START= 顺序，由 procd 监督 | 按动作位掩码依次执行 |
| 监督与重启 | inittab 的 respawn | 原生的 `Restart=` | 需要 supervise-daemon | `procd_set_param respawn` | inittab 的 respawn |
| 规模 | 很小，纯 shell | 大（包括 journald、logind、networkd） | 小 | 小（路由器专用） | 最小（嵌入式） |
| 典型用户 | 老版本 RHEL、Debian | 现在的主流（Fedora、Ubuntu、openEuler） | Gentoo、Alpine | OpenWrt | 嵌入式、容器 |

</div>

根文件系统的目录布局由 FHS 3.0（Filesystem Hierarchy Standard）规定：`/bin` 基本命令，`/sbin` 系统管理命令，`/lib` 基本库和内核模块，`/etc` 本机配置（纯静态，不放可执行文件），`/dev` 设备节点，`/proc` 和 `/sys` 伪文件系统（启动时挂载），`/usr` 只读、可共享的次级层次，`/var` 可变数据，`/run` 运行时的 tmpfs，`/tmp` 临时文件，`/boot` 内核、initramfs 和引导器配置。现在的趋势是 UsrMerge（openRuyi 等新发行版把 `/bin` 软链接到 `/usr/bin`、`/lib` 软链接到 `/usr/lib`，便于把 `/usr` 设为只读和做镜像分层）；嵌入式系统（busybox）常常只保留 `/bin`（busybox 和软链接）、`/sbin`、`/etc`、`/dev`、`/proc`、`/sys`、`/tmp`、`/lib` 这几个目录。

### LFS、buildroot 与 Yocto 的对比

<div align="center">

| | LFS/ruyi-tutorials | Buildroot | Yocto/Poky |
|:--:|:--:|:--:|:--:|
| 本质 | 手写 shell 按顺序自举 | Make 加 Kconfig 的协调器 | 元数据加 bitbake 任务引擎 |
| 配置 | 没有（写在脚本里） | 一个 `.config` | 多层 `.conf` 加 recipe 变量 |
| 增量重建 | 没有（改了就要全部重来） | 弱（stamp 只记录做没做） | 强（sstate 按内容哈希判断） |
| sysroot 隔离 | 一个 STAGING_DIR | 一个 staging/ | 每个 recipe 一个 recipe-sysroot |
| 输出的包格式 | 直接进入镜像（没有包） | 直接进入 target/（没有包管理） | rpm、deb、ipk |
| 学习成本 | 低，但全部手工、慢 | 低，容易调试 | 高（recipe、多层、签名） |
| 典型 rootfs | 教学，完全可控 | 可以小到 5 MB | 工业级可裁剪，几十 MB 以上 |
| 使用者 | 学习、定制的基础 | 小项目、快速验证、产品 | Tesla、福特、NXP、SiFive 的量产产品 |

</div>

LFS 让人理解每一步为什么这样做（全部手工，理解自举），buildroot 最简单可用（Make 加 Kconfig，stamp 直观但增量弱），Yocto 适合工业维护（任务 DAG、按内容判断的 sstate 缓存、分层，代价是复杂）。三者可以配合：很多产品用 LFS 理解原理，用 buildroot 做原型，用 Yocto 量产。系统裁剪的通用做法：嵌入式通常从零开始选包，主要手段是用 busybox 代替 coreutils（一个二进制代替几十个工具），用 musl 代替 glibc（小一半以上），静态链接去掉动态加载器，strip 去掉符号，用 squashfs 压缩只读的根，用 cpio.gz 打包 initramfs，删除 `/usr/share/{man,doc}`，只保留一种 locale，只安装实际用到的驱动模块；再进一步就是只有一个 applet 的 busybox，只有几十 KB。从板级适配到这里，最终得到的是一个能在目标硬件上启动、运行用户程序、又小到能放进 Flash 的完整系统。

## 源码阅读路线

每一层都还可以深入源码（路径是各开源项目内的相对路径，clone 后可以直接找到）：

- **HAL 与驱动**（「板级适配与 HAL」「外设驱动」）：polyhal 的 `src/<arch>/`，看 `define_arch_mods!` 的编译时单态；embedded-hal 的 `digital`、`i2c`、`spi` trait 定义；Linux 驱动模型读 `drivers/base/{core.c,bus.c,dd.c}`（device、driver、bus 和 `really_probe`），PCI 看 BAR 大小探测，USB 看枚举过程。
- **文件系统与网络**（「文件系统」「网络栈」）：VFS 读 `fs/namei.c`（RCU-walk 和 REF-walk）、`fs/jbd2/`（三种模式的日志）；littlefs 看 CTZ 跳表；smoltcp 读 `src/socket/tcp.rs`（十一种状态和 RFC 6298 的 RTO）；rustls 看类型状态的状态机。
- **系统调用与运行时**（「系统调用机制与架构 ABI」到「动态链接运行时与 vDSO」）：musl 是最好的读物，`src/internal/syscall_arch.h`（内联 ecall）、`src/env/__libc_start_main.c`（两阶段启动和四种顺序约束手段）、`ldso/dlstart.c` 和 `ldso/dynlink.c`（自重定位、DT_RELR、do_relocs、三个阶段）；compiler-rt 的 `lib/builtins/riscv/{save.S,restore.S}`（millicode）和 `clear_cache.c`（三种架构的 icache 处理）；relibc 作为 Rust 的对照。
- **编译器与 JIT**（「编译器后端、工具链与 JIT」）：LLVM 的 `lib/Target/RISCV/*.td`（每个扩展一组 td）、`lib/ExecutionEngine/Orc/`（ORC v2）、`RISCVFeatures.td` 中的 Pointer Masking 子扩展；rustc 的 `rustc_codegen_ssa` trait 抽象（看官方的 dev-guide）。
- **容器与虚拟化**（「虚拟化与容器」）：runc 的 `libcontainer/nsenter/nsexec.c`（三阶段、两次 fork）、`libcontainer/standard_init_linux.go`（init 的安全步骤）、cgroup 的 `fs2/`；OCI 的 `runtime-spec`、`image-spec`、`distribution-spec` 三份规范。
- **裁剪与发行版**（「系统裁剪与发行版」）：busybox 的 `include/applets.src.h`（X-macro）、`libbb/appletlib.c`（分发）、`init/init.c`；buildroot 的 `package/pkg-generic.mk`（stamp 状态机）、`fs/common.mk`（fakeroot）；ruyi-tutorials 的两遍 gcc 脚本。

## 术语

<div align="center">

| 术语 | 含义 |
|:--:|:--:|
| HAL / BSP | 硬件抽象层、板级支持包；polyhal 是 OS 级跨架构 HAL，embedded-hal 是 MCU 的 trait 抽象 |
| PAC / svd2rust | 外设访问 crate，由 SVD 描述文件经 svd2rust 生成的类型安全寄存器映射 |
| probe / deferred probe | 驱动与设备匹配后调用 probe 初始化；依赖没准备好时延迟重试 |
| VFS 的四种对象 | super_block（挂载实例）、inode（文件元数据）、dentry（目录项）、file（打开的实例） |
| jbd2 的三种模式 | journal（数据和元数据都写日志）、ordered（默认，元数据写日志，数据先写入）、writeback |
| 就绪模型与完成模型 | 就绪模型（epoll，可以读了通知你去读）、完成模型（io_uring，读完了通知你） |
| vDSO | 内核映射到每个进程的小 ELF，让 clock_gettime 等常用系统调用在用户态完成 |
| crt1/Scrt1/rcrt1 | 三种启动对象：静态或非 PIE、PIE、静态 PIE |
| 两阶段启动 | `_start`、`__libc_start_main`（`__init_libc` 早期初始化，stage2 执行 init_array 和 main） |
| DT_RELR | 压缩的相对重定位，用位图编码，省掉 RELATIVE 表约 97% 的空间 |
| 启动时绑定与惰性绑定 | musl 启动时全部解析，glibc 按需通过 PLT 跳板解析 |
| TLS 模型 | LE、IE、GD、LD、TLSDESC，按编译时知道多少信息划分，越静态越快 |
| core/alloc/std | Rust 的三层：没有依赖，加全局分配器，加宿主操作系统，对应固件、引导、应用 |
| LLVM 的窄接口 | 前端降到 LLVM IR，后端从 IR 生成代码，中间的优化全部复用 |
| SelectionDAG 与 GlobalISel | LLVM 的两种指令选择方式，后者在 aa64 上默认使用，作用于整个函数，可以增量处理 |
| rustc_codegen_ssa | rustc 与后端无关的抽象 crate，让 LLVM、Cranelift、GCC 三个后端可以互换 |
| Pointer Masking | rv J 系列中的扩展，硬件忽略指针的高位，让带标签的指针几乎没有额外开销 |
| namespace / cgroup | 隔离能看到什么、限制能用多少，互相独立，是容器的两个基础 |
| OCI 的三份规范 | runtime-spec（怎样运行）、image-spec（镜像格式）、distribution-spec（怎样传输） |
| microVM | 去掉全套设备模拟、只保留 virtio 的精简虚拟机，有硬隔离，启动速度接近容器 |
| wine / WSL | 在 Linux 上运行 Windows 程序（API 转换）、在 Windows 上运行 Linux 程序（WSL1 转换，WSL2 在 Hyper-V 中运行真正的内核） |
| sstate | Yocto 的签名缓存，任务的输入哈希变了才重新执行，是 buildroot 的 stamp 做不到的按内容判断 |
| fakeroot | 用 LD_PRELOAD 拦截 chown、mknod 伪装成 root，让非特权用户生成属于 root 的镜像 |
| 两遍 gcc | 先编译一个最小的 gcc 来编译 glibc，再用 glibc 编译完整的 gcc |

</div>

## 思考题

**Q1. 同一个 `printf` 在 musl、newlib、baselibc 中分别怎样落到底层？这说明 libc 是什么？**

{% note default %}
musl 里 `vfprintf` 把输出积累在 FILE 缓冲区，刷新时用 `writev` 进入内核；newlib 里经过 `_write_r`，落到由 BSP 或 RTOS 提供的 `_write` 弱符号桩函数；baselibc 里逐个字符调用 FILE 的 `put` 函数指针（可能直接写 UART 寄存器）。名字和语义相同，底层完全不同，说明 libc 是 ISO C/POSIX 语义与内核或硬件接口之间的桥梁：上层的约定不变，下层的实现可以替换。
{% endnote %}

**Q2. musl 为什么用 noinline、空的 `asm("memory")`、通过符号查找间接调用这几种手段，反复固定启动时的初始化顺序？**

{% note default %}
编译器的内联、寄存器提升、把取地址当作链接时常量折叠，都可能破坏「先初始化 TLS、SSP、重定位，再运行用户代码」这一严格顺序。noinline 防止初始化用的大栈帧在整个进程生命周期中一直占着，也防止内联后被重新排序；空的 `asm("memory")` 是不生成指令的优化屏障，强制 stage2 的副作用排在初始化之后；运行时的符号查找让编译器无法跨过运行时才知道的地址，提前被视为 pure/const 的 errno 和 tp 读取。这是「自举时不能依赖尚未完成的初始化」这一问题的经典解法。
{% endnote %}

**Q3. musl 启动时全部绑定，glibc 默认惰性绑定，各有什么取舍？为什么「默认惰性绑定」不是普遍成立的？**

{% note default %}
glibc 的惰性绑定启动快（按需解析），但 GOT 在运行时可写，是攻击面，而且与完整的 RELRO 冲突；musl 在启动时全部解析，没有 `_dl_runtime_resolve` 跳板，配合完整的 RELRO，自然能防止改写 GOT，还省掉了大量容易出错的、与架构相关的代码，代价是启动时要多解析一些。所以「默认惰性绑定」只对 glibc 成立，对 musl 不成立。
{% endnote %}

**Q4. Rust 的 core、alloc、std 三层各增加了什么前提？为什么说它们正好对应全栈操作系统的固件、引导、应用三级？**

{% note default %}
core 没有依赖（只要有 CPU 和编译器，不用堆也不用操作系统）；alloc 增加一个全局分配器（可以使用堆上的容器，仍然没有操作系统）；std 增加宿主操作系统（io、fs、net、thread）。M-mode 固件只用 core（只用 `ptr::write_volatile` 操作 MMIO、用原子操作选出启动核、用 fmt 向串口输出），带堆的引导器或 Unikernel 用 core 加 alloc（挂分配器管理页表和镜像），用户态程序用 std（需要内核提供一个 `sys::pal` 后端，落到自己的系统调用上）。
{% endnote %}

**Q5. 为什么不是所有系统调用都能走 vDSO？`__vdso_rt_sigreturn` 为什么在 vDSO 里？**

{% note default %}
vDSO 只能放只读硬件状态、不修改内核数据结构、不需要特权的操作（时钟、CPU 编号）；`open`、`write`、`mmap`、`clone` 都要修改内核的全局表（fd 表、页表、任务列表），不可能在用户态完成。`__vdso_rt_sigreturn` 不是为了性能，而是信号返回的跳板：它必须在内核知道的固定地址上，信号处理函数执行完才能跳回被打断的位置。
{% endnote %}

**Q6. 容器和虚拟机的本质区别是什么？怎样从 runc 的源码证明容器不是虚拟化？**

{% note default %}
容器共享宿主内核，靠 namespace、cgroup、capabilities、seccomp、LSM 做软件隔离；虚拟机有独立的客户机内核，靠硬件辅助虚拟化和二级地址翻译。从源码看，runc 只调用 clone、setns、unshare，写 cgroupfs，执行 pivot_root、seccomp、capset，没有任何硬件虚拟化指令，容器就是被内核机制限制了能看到的范围和能用的资源的普通进程。microVM（Firecracker、Kata）才用到 KVM，是容器和虚拟机之间的折中。
{% endnote %}

**Q7. buildroot 的 stamp 状态机和 Yocto 的 sstate 签名缓存，为什么在增量重建上一个弱一个强？**

{% note default %}
buildroot 的 `.stamp_*` 只记录某个阶段做没做（空文件加时间戳），修改了源码但 stamp 已经存在，就不会自动重新构建，除非手工 dirclean 或 rebuild，这是按「是否存在」判断。Yocto 的 sstate 为每个任务计算一个签名，等于内容的 basehash 加依赖的哈希，写进 stamp 的文件名，任何元数据改动都会改变哈希，从而自动重新执行这个任务及其下游，这是按内容判断。代价是 Yocto 的概念（recipe 语言、多层、签名）比 buildroot 复杂得多。
{% endnote %}
