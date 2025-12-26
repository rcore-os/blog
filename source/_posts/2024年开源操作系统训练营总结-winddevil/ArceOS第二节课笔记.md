---
title: ArceOS第二节课笔记
date: 2024-12-21 18:19:26
categories:
    - note
tags:
    - author:Winddevil
---

# 学习内容

介绍地址空间和页表相关的内容.任务调度下次课说.

1. 如何在一个主任务的基础上启用一个子任务,让他完成一系列的工作
2. 启用一个单任务的基础上能够开两个任务,然后完成两个任务之间的通信

# makefile的原理

调用是这样实现的:

首先是`Makefile`里的:
```makefile
run: build justrun
```

它需要有`build`和`justrun`这两个**虚拟文件**.

再去看`build`:
```makefile
build: $(OUT_DIR) $(OUT_BIN)
```

需要的是`OUT_DIR`和`OUT_BIN`这两个**实体文件**.

创建它们两个的文件在`scripts/make/build.mk`:
```makefile
$(OUT_DIR):
	$(call run_cmd,mkdir,-p $@)

$(OUT_BIN): _cargo_build $(OUT_ELF)
	$(call run_cmd,$(OBJCOPY),$(OUT_ELF) --strip-all -O binary $@)
```

这里调用的`run_cmd`在`scripts/make/utils.mk`:
```makefile
GREEN_C := \033[92;1m
CYAN_C := \033[96;1m
YELLOW_C := \033[93;1m
GRAY_C := \033[90m
WHITE_C := \033[37m
END_C := \033[0m

define run_cmd
  @printf '$(WHITE_C)$(1)$(END_C) $(GRAY_C)$(2)$(END_C)\n'
  @$(1) $(2)
endef
```

这里`$(1)`和`$(2)`表示接受的是**两个参数**.

这个是两个操作,
1. 通过**颜色参数**把要执行的命令输出出来(第一行)
2. 第二行相当于执行接受的两个参数
3. `$@`是代表这个**虚拟文件**本身

其实这一套操作下来就是创建这个`OUT_DIR`这个名字的文件夹.

在`Makefile`中:
```makefile
A ?= tour/u_1_0
APP ?= $(A)
... ...

# Paths
OUT_DIR ?= $(APP)
```

这时候把目光转回`OUT_BIN`.它在`scripts/make/build.mk`中:
```makefile
$(OUT_BIN): _cargo_build $(OUT_ELF)
	$(call run_cmd,$(OBJCOPY),$(OUT_ELF) --strip-all -O binary $@)
```

那么它的构建需要**虚拟文件**`_cargo_build`和实体文件`OUT_ELF`.

那么`_cargo_build`的功能也是先**进行输出**,随后调用`cargo_build`:
```makefile
_cargo_build:
	@printf "    $(GREEN_C)Building$(END_C) App: $(APP_NAME), Arch: $(ARCH), Platform: $(PLATFORM_NAME), App type: $(APP_TYPE)\n"
ifeq ($(APP_TYPE), rust)
	$(call cargo_build,$(APP),$(AX_FEAT) $(LIB_FEAT) $(APP_FEAT))
	@cp $(rust_elf) $(OUT_ELF)
else ifeq ($(APP_TYPE), c)
	$(call cargo_build,ulib/axlibc,$(AX_FEAT) $(LIB_FEAT))
endif
```

那么`cargo_build`在`scripts/make/cargo.mk`里:
```makefile
define cargo_build
  $(call run_cmd,cargo -C $(1) build,$(build_args) --features "$(strip $(2))")
endef
```

由于我们知道`run_cmd`是什么套路了,因此这边就是执行`cargo`来构建一个`elf`文件.

回到`OUT_BIN`这边,得到两个所需文件之后,通过`OBJCOPY ?= rust-objcopy --binary-architecture=$(ARCH)`(在`Makefile`)中定义,把`elf`多余的信息头去掉,只留下**可执行二进制文件**:
```makefile
$(OUT_BIN): _cargo_build $(OUT_ELF)
	$(call run_cmd,$(OBJCOPY),$(OUT_ELF) --strip-all -O binary $@)
```

最后回到`justrun`,它调用了`run_qemu`(在`scripts/make/qemu.mk`),
```makefile
define run_qemu
  @printf "    $(CYAN_C)Running$(END_C) on qemu...\n"
  $(call run_cmd,$(QEMU),$(qemu_args-y))
endef
```

这里调用了`QEMU`,是依赖于`ARCH ?= riscv64`(在`Makefile`):
```makefile
QEMU := qemu-system-$(ARCH)
```

这里调用了`qemu_args-y`,同样是依赖于`ARCH`的这里不赘述:
```makefile
qemu_args-x86_64 := \
  -machine q35 \
  -kernel $(OUT_ELF)

qemu_args-riscv64 := \
  -machine virt \
  -bios default \
  -kernel $(OUT_BIN)

qemu_args-aarch64 := \
  -cpu cortex-a72 \
  -machine virt \
  -kernel $(OUT_BIN)
  
qemu_args-y := -m 128M -smp $(SMP) $(qemu_args-$(ARCH))
```


# ReadPFlash

本节目标：
1. 引入页表管理组件，通过地址空间重映射，支持设备MMIO
2. 地址空间概念，重映射的意义，页表机制

希望能从`PFlash`把应用的数据加载进来,以为运行后边的程序做基础.

## 实验没有`paging`时的情况

### 正常运行

```shell
OpenSBI v0.9
   ____                    _____ ____ _____
  / __ \                  / ____|  _ \_   _|
 | |  | |_ __   ___ _ __ | (___ | |_) || |
 | |  | | '_ \ / _ \ '_ \ \___ \|  _ < | |
 | |__| | |_) |  __/ | | |____) | |_) || |_
  \____/| .__/ \___|_| |_|_____/|____/_____|
        | |
        |_|

Platform Name             : riscv-virtio,qemu
Platform Features         : timer,mfdeleg
Platform HART Count       : 1
Firmware Base             : 0x80000000
Firmware Size             : 100 KB
Runtime SBI Version       : 0.2

Domain0 Name              : root
Domain0 Boot HART         : 0
Domain0 HARTs             : 0*
Domain0 Region00          : 0x0000000080000000-0x000000008001ffff ()
Domain0 Region01          : 0x0000000000000000-0xffffffffffffffff (R,W,X)
Domain0 Next Address      : 0x0000000080200000
Domain0 Next Arg1         : 0x0000000087000000
Domain0 Next Mode         : S-mode
Domain0 SysReset          : yes

Boot HART ID              : 0
Boot HART Domain          : root
Boot HART ISA             : rv64imafdcsu
Boot HART Features        : scounteren,mcounteren,time
Boot HART PMP Count       : 16
Boot HART PMP Granularity : 4
Boot HART PMP Address Bits: 54
Boot HART MHPM Count      : 0
Boot HART MHPM Count      : 0
Boot HART MIDELEG         : 0x0000000000000222
Boot HART MEDELEG         : 0x000000000000b109

       d8888                            .d88888b.   .d8888b.
      d88888                           d88P" "Y88b d88P  Y88b
     d88P888                           888     888 Y88b.
    d88P 888 888d888  .d8888b  .d88b.  888     888  "Y888b.
   d88P  888 888P"   d88P"    d8P  Y8b 888     888     "Y88b.
  d88P   888 888     888      88888888 888     888       "888
 d8888888888 888     Y88b.    Y8b.     Y88b. .d88P Y88b  d88P
d88P     888 888      "Y8888P  "Y8888   "Y88888P"   "Y8888P"

arch = riscv64
platform = riscv64-qemu-virt
target = riscv64gc-unknown-none-elf
smp = 1
build_mode = release
log_level = warn

Try to access dev region [0xFFFFFFC022000000], got 0x646C6670
Got pflash magic: pfld
```

> `pfld`在哪?

在`scripts/make/utils.mk`中,在`pflash`中写入了`pfld`:

```makefile
define mk_pflash
  @RUSTFLAGS="" cargo build -p origin  --target riscv64gc-unknown-none-elf --release
  @rust-objcopy --binary-architecture=riscv64 --strip-all -O binary ./target/riscv64gc-unknown-none-elf/release/origin /tmp/origin.bin
  @printf "pfld\00\00\00\01" > /tmp/prefix.bin
  @printf "%08x" `stat -c "%s" /tmp/origin.bin` | xxd -r -ps > /tmp/size.bin
  @cat /tmp/prefix.bin /tmp/size.bin > /tmp/head.bin
  @dd if=/dev/zero of=./$(1) bs=1M count=32
  @dd if=/tmp/head.bin of=./$(1) conv=notrunc
  @dd if=/tmp/origin.bin of=./$(1) seek=16 obs=1 conv=notrunc
endef
```

那么这个在哪里调用呢?答案是**没有调用**.

我们是直接`pull`下来的,如果调用`make pflash_img`就会**重新生成**它.

在`scripts/make/qemu.mk`里:
```makefile
qemu_args-y := -m 128M -smp $(SMP) $(qemu_args-$(ARCH))

qemu_args-$(PFLASH) += \
  -drive if=pflash,file=$(CURDIR)/$(PFLASH_IMG),format=raw,unit=1
... ...

define run_qemu
  @printf "    $(CYAN_C)Running$(END_C) on qemu...\n"
  $(call run_cmd,$(QEMU),$(qemu_args-y))
endef
```

而在`Makefile`里`PFLASH`被指定为`y`.这样就会在运行`qemu`的时候加上`pflash.img`这个文件.

### 没有指定`paging`的情况

代码:
```rust
#![cfg_attr(feature = "axstd", no_std)]
#![cfg_attr(feature = "axstd", no_main)]

#[macro_use]
#[cfg(feature = "axstd")]
extern crate axstd as std;

use core::{mem, str};
use std::os::arceos::modules::axhal::mem::phys_to_virt;

/// Physical address for pflash#1
const PFLASH_START: usize = 0x2200_0000;

#[cfg_attr(feature = "axstd", no_mangle)]
fn main() {
    // Makesure that we can access pflash region.
    let va = phys_to_virt(PFLASH_START.into()).as_usize();
    let ptr = va as *const u32;
    unsafe {
        println!("Try to access dev region [{:#X}], got {:#X}", va, *ptr);
        let magic = mem::transmute::<u32, [u8; 4]>(*ptr);
        println!("Got pflash magic: {}", str::from_utf8(&magic).unwrap());
    }
}

```

这里需要看下一节关于`PFlash`的部分,因为这时候需要访问外设,在没有`remap`的时候是`1G`的**恒等映射**,外设没有映射到地址空间中,因此报错.

一开始只映射了物理空间的`0x8000_0000`到`0xC000_0000`.

这里访问的物理地址是`0x2200_0000`,本来就不属于刚刚提到的物理空间,因此通过恒等映射平移也得不到恒等映射之后的虚拟地址.

产生的log:

```shell
OpenSBI v0.9
   ____                    _____ ____ _____
  / __ \                  / ____|  _ \_   _|
 | |  | |_ __   ___ _ __ | (___ | |_) || |
 | |  | | '_ \ / _ \ '_ \ \___ \|  _ < | |
 | |__| | |_) |  __/ | | |____) | |_) || |_
  \____/| .__/ \___|_| |_|_____/|____/_____|
        | |
        |_|

Platform Name             : riscv-virtio,qemu
Platform Features         : timer,mfdeleg
Platform HART Count       : 1
Firmware Base             : 0x80000000
Firmware Size             : 100 KB
Runtime SBI Version       : 0.2

Domain0 Name              : root
Domain0 Boot HART         : 0
Domain0 HARTs             : 0*
Domain0 Region00          : 0x0000000080000000-0x000000008001ffff ()
Domain0 Region01          : 0x0000000000000000-0xffffffffffffffff (R,W,X)
Domain0 Next Address      : 0x0000000080200000
Domain0 Next Arg1         : 0x0000000087000000
Domain0 Next Mode         : S-mode
Domain0 SysReset          : yes

Boot HART ID              : 0
Boot HART Domain          : root
Boot HART ISA             : rv64imafdcsu
Boot HART Features        : scounteren,mcounteren,time
Boot HART PMP Count       : 16
Boot HART PMP Granularity : 4
Boot HART PMP Address Bits: 54
Boot HART MHPM Count      : 0
Boot HART MHPM Count      : 0
Boot HART MIDELEG         : 0x0000000000000222
Boot HART MEDELEG         : 0x000000000000b109

       d8888                            .d88888b.   .d8888b.
      d88888                           d88P" "Y88b d88P  Y88b
     d88P888                           888     888 Y88b.
    d88P 888 888d888  .d8888b  .d88b.  888     888  "Y888b.
   d88P  888 888P"   d88P"    d8P  Y8b 888     888     "Y88b.
  d88P   888 888     888      88888888 888     888       "888
 d8888888888 888     Y88b.    Y8b.     Y88b. .d88P Y88b  d88P
d88P     888 888      "Y8888P  "Y8888   "Y88888P"   "Y8888P"

arch = riscv64
platform = riscv64-qemu-virt
target = riscv64gc-unknown-none-elf
smp = 1
build_mode = release
log_level = warn

Try to access dev region [0xFFFFFFC022000000], got [  2.002842 0 axruntime::lang_items:5] panicked at modules/axhal/src/arch/riscv/trap.rs:55:13:
Unhandled trap Exception(LoadFault) @ 0xffffffc080203fa6:
TrapFrame {
    regs: GeneralRegisters {
        ra: 0xffffffc08020376c,
        sp: 0xffffffc0802499f0,
        gp: 0x0,
        tp: 0x0,
        t0: 0x3f,
        t1: 0x23,
        t2: 0x5,
        s0: 0xffffffc080249a80,
        s1: 0xffffffc080249c60,
        a0: 0xffffffc022000000,
        a1: 0xffffffc080249a80,
        a2: 0x0,
        a3: 0xffffffc080203f9e,
        a4: 0x2,
        a5: 0xffffffc080202b76,
        a6: 0xa,
        a7: 0x1,
        s2: 0x2,
        s3: 0xffffffc080249bc0,
        s4: 0xffffffc080249bf0,
        s5: 0x38,
        s6: 0xffffffc080205098,
        s7: 0x2,
        s8: 0x1,
        s9: 0x24000,
        s10: 0x2,
        s11: 0xffffffc08026e000,
        t3: 0x23,
        t4: 0x3a,
        t5: 0x5000,
        t6: 0x55555555,
    },
    sepc: 0xffffffc080203fa6,
    sstatus: 0x8000000000006100,
}
```

> 分支名称:`tour_u_3_0_no_paging`

## MAP和REMAP

ArceOS Unikernel包括两阶段地址空间映射，
Boot阶段默认开启1G空间的恒等映射；
如果需要支持设备MMIO区间，通过指定一个feature - "paging"来实现重映射。

上一节说了启动之后需要`remap`,这样才可以实现重映射.

那么就需要打开`paging`.

### 初始化的线性页表

其实是创建了两个映射,相当于拿前一个恒等映射做了跳板,因为要求开启MMU之后仍然可以以原来的物理地址正常访问.

`#TODO`

### 后续创建多级页表

`#TODO`

## PFlash

是一个模拟闪存磁盘.`QEMU`启动的时候会自动从内存中加载内容到固定的`MMIO`区域.

读操作是不需要驱动的,但是写是需要驱动的.

**目前我们只需要读**,只要加载成功即可.

## 物理地址空间

![](00%20inbox/asset/Pasted%20image%2020241117165919.png)

外设被**映射**到一个物理地址空间里边.

> 注意:linker_riscv64-qemu-virt.lds,段布局都是听的它的.

## 分页

类似于`rCore`的三级页表,我们实验中用的也是`SV39`.

![](00%20inbox/asset/Pasted%20image%2020241117170157.png)

## 分页阶段1-恒等映射+偏移

我们希望`sbi`和`kernel`都保存在高地址空间.

1. 开局的时候把虚拟空间内的地址和物理空间内的地址完全对应上.
2. 给指针寄存器`pc`栈寄存器`sp`加偏移,这里的偏移是`0xffff_ffc0_0000_0000`.

> `sbi`还是放在`0x8000_0000`,`kernel`还是放在`0x8020_0000`.

那么在这个情况下其实已经是物理地址了,就是一个**线性偏移**的操作实现虚拟地址和物理地址的映射.

>如果不需要访问物理设备,现在就可以完成了.

## 分页阶段2-重建映射

重映射的时候干脆在虚拟地址空间里把`sbi`去掉,因为不应该继续访问`sbi`了.

不同的数据段的权限不一样,比如`READ`,`WRITE`,`EXECUTE`不一样.比如代码段就只能读和运行不能写.在重建的时候就不需要给它这些权限.

这样设备的地址空间也可以被映射进来,权限粒度也更细.

![](00%20inbox/asset/Pasted%20image%2020241117204636.png)


> 这里似乎仍然是**线性映射**.

# 多任务

需求:启用多任务,开一个子任务,让子任务替主任务完成一些具体工作,然后回到主任务.

> **并发**是多个任务同时在等待使用CPU而不是同时运行.**并行**是真的需要同时运行.

>调度的一个很好的描述:一个是**保存现场**,一个是**任务无感知**.

## 实验多任务

`make run A=tour/u_4_0`

任务代码解析:
```rust
#![cfg_attr(feature = "axstd", no_std)]
#![cfg_attr(feature = "axstd", no_main)]

#[macro_use]
#[cfg(feature = "axstd")]
extern crate axstd as std;

use core::{mem, str};
use std::thread;
use std::os::arceos::modules::axhal::mem::phys_to_virt;

/// Physical address for pflash#1
const PFLASH_START: usize = 0x2200_0000;

#[cfg_attr(feature = "axstd", no_mangle)]
fn main() {
    println!("Multi-task is starting ...");

    let worker = thread::spawn(move || {
        println!("Spawned-thread ...");

        // Makesure that we can access pflash region.
        let va = phys_to_virt(PFLASH_START.into()).as_usize();
        let ptr = va as *const u32;
        let magic = unsafe {
            mem::transmute::<u32, [u8; 4]>(*ptr)
        };
        if let Ok(s) = str::from_utf8(&magic) {
            println!("Got pflash magic: {s}");
            0
        } else {
            -1
        }
    });

    let ret = worker.join();
    // Makesure that worker has finished its work.
    assert_eq!(ret, Ok(0));

    println!("Multi-task OK!");
}
```

和上一节的内容一样,同样是访问了我们预导入的`pflash.img`的前几个字符`pfld`.

只不过用了`spawn`的方法生成,并且用`join`的方法等待.

## 任务的数据结构

![](00%20inbox/asset/Pasted%20image%2020241117205945.png)

> 有一个关键点在于`task_ext`,是任务的拓展属性,是面向**宏内核**和**Hypervisor**的关键.

## 通用调度框架


![](00%20inbox/asset/Pasted%20image%2020241117210345.png)

分层,并且实现同样的接口,这样就可以自己决定是什么样的调度机制.

## 系统默认内置任务

- GC: 除main之外的任务(线程)退出后，由gc负责回收清理。
- IDLE: 当其它所有任务都阻塞时，执行它。对某些arch，wait_for_irqs对应非忙等指令.比如等待中断什么的,而不是忙等,如果发生新的"`event`"(自己取的名)那么就会马上响应.

# MsgQueue

本节目标：
1. 任务的切换机制，协作式调度算法
2. 同步的方式，Mutex的机制

# 运行实验

执行`make run A=tour/u_5_0`:

```shell
OpenSBI v0.9
   ____                    _____ ____ _____
  / __ \                  / ____|  _ \_   _|
 | |  | |_ __   ___ _ __ | (___ | |_) || |
 | |  | | '_ \ / _ \ '_ \ \___ \|  _ < | |
 | |__| | |_) |  __/ | | |____) | |_) || |_
  \____/| .__/ \___|_| |_|_____/|____/_____|
        | |
        |_|

Platform Name             : riscv-virtio,qemu
Platform Features         : timer,mfdeleg
Platform HART Count       : 1
Firmware Base             : 0x80000000
Firmware Size             : 100 KB
Runtime SBI Version       : 0.2

Domain0 Name              : root
Domain0 Boot HART         : 0
Domain0 HARTs             : 0*
Domain0 Region00          : 0x0000000080000000-0x000000008001ffff ()
Domain0 Region01          : 0x0000000000000000-0xffffffffffffffff (R,W,X)
Domain0 Next Address      : 0x0000000080200000
Domain0 Next Arg1         : 0x0000000087000000
Domain0 Next Mode         : S-mode
Domain0 SysReset          : yes

Boot HART ID              : 0
Boot HART Domain          : root
Boot HART ISA             : rv64imafdcsu
Boot HART Features        : scounteren,mcounteren,time
Boot HART PMP Count       : 16
Boot HART PMP Granularity : 4
Boot HART PMP Address Bits: 54
Boot HART MHPM Count      : 0
Boot HART MHPM Count      : 0
Boot HART MIDELEG         : 0x0000000000000222
Boot HART MEDELEG         : 0x000000000000b109

       d8888                            .d88888b.   .d8888b.
      d88888                           d88P" "Y88b d88P  Y88b
     d88P888                           888     888 Y88b.
    d88P 888 888d888  .d8888b  .d88b.  888     888  "Y888b.
   d88P  888 888P"   d88P"    d8P  Y8b 888     888     "Y88b.
  d88P   888 888     888      88888888 888     888       "888
 d8888888888 888     Y88b.    Y8b.     Y88b. .d88P Y88b  d88P
d88P     888 888      "Y8888P  "Y8888   "Y88888P"   "Y8888P"

arch = riscv64
platform = riscv64-qemu-virt
target = riscv64gc-unknown-none-elf
smp = 1
build_mode = release
log_level = warn

Multi-task is starting ...
Wait for workers to exit ...
worker1 ...
worker1 [0]
worker2 ...
worker2 [0]
worker2: nothing to do!
worker1 [1]
worker2 [1]
worker2: nothing to do!
worker1 [2]
worker2 [2]
worker2: nothing to do!
worker1 [3]
worker2 [3]
worker2: nothing to do!
worker1 [4]
worker2 [4]
worker2: nothing to do!
worker1 [5]
worker2 [5]
worker2: nothing to do!
worker1 [6]
worker2 [6]
worker2: nothing to do!
worker1 [7]
worker2 [7]
worker2: nothing to do!
worker1 [8]
worker2 [8]
worker2: nothing to do!
worker1 [9]
worker2 [9]
worker2: nothing to do!
worker1 [10]
worker2 [10]
worker2: nothing to do!
worker1 [11]
worker2 [11]
worker2: nothing to do!
worker1 [12]
worker2 [12]
worker2: nothing to do!
worker1 [13]
worker2 [13]
worker2: nothing to do!
worker1 [14]
worker2 [14]
worker2: nothing to do!
worker1 [15]
worker2 [15]
worker2: nothing to do!
worker1 [16]
worker2 [16]
worker2: nothing to do!
worker1 [17]
worker2 [17]
worker2: nothing to do!
worker1 [18]
worker2 [18]
worker2: nothing to do!
worker1 [19]
worker2 [19]
worker2: nothing to do!
worker1 [20]
worker2 [20]
worker2: nothing to do!
worker1 [21]
worker2 [21]
worker2: nothing to do!
worker1 [22]
worker2 [22]
worker2: nothing to do!
worker1 [23]
worker2 [23]
worker2: nothing to do!
worker1 [24]
worker2 [24]
worker2: nothing to do!
worker1 [25]
worker2 [25]
worker2: nothing to do!
worker1 [26]
worker2 [26]
worker2: nothing to do!
worker1 [27]
worker2 [27]
worker2: nothing to do!
worker1 [28]
worker2 [28]
worker2: nothing to do!
worker1 [29]
worker2 [29]
worker2: nothing to do!
worker1 [30]
worker2 [30]
worker2: nothing to do!
worker1 [31]
worker2 [31]
worker2: nothing to do!
worker1 [32]
worker2 [32]
worker2: nothing to do!
worker1 [33]
worker2 [33]
worker2: nothing to do!
worker1 [34]
worker2 [34]
worker2: nothing to do!
worker1 [35]
worker2 [35]
worker2: nothing to do!
worker1 [36]
worker2 [36]
worker2: nothing to do!
worker1 [37]
worker2 [37]
worker2: nothing to do!
worker1 [38]
worker2 [38]
worker2: nothing to do!
worker1 [39]
worker2 [39]
worker2: nothing to do!
worker1 [40]
worker2 [40]
worker2: nothing to do!
worker1 [41]
worker2 [41]
worker2: nothing to do!
worker1 [42]
worker2 [42]
worker2: nothing to do!
worker1 [43]
worker2 [43]
worker2: nothing to do!
worker1 [44]
worker2 [44]
worker2: nothing to do!
worker1 [45]
worker2 [45]
worker2: nothing to do!
worker1 [46]
worker2 [46]
worker2: nothing to do!
worker1 [47]
worker2 [47]
worker2: nothing to do!
worker1 [48]
worker2 [48]
worker2: nothing to do!
worker1 [49]
worker2 [49]
worker2: nothing to do!
worker1 [50]
worker2 [50]
worker2: nothing to do!
worker1 [51]
worker2 [51]
worker2: nothing to do!
worker1 [52]
worker2 [52]
worker2: nothing to do!
worker1 [53]
worker2 [53]
worker2: nothing to do!
worker1 [54]
worker2 [54]
worker2: nothing to do!
worker1 [55]
worker2 [55]
worker2: nothing to do!
worker1 [56]
worker2 [56]
worker2: nothing to do!
worker1 [57]
worker2 [57]
worker2: nothing to do!
worker1 [58]
worker2 [58]
worker2: nothing to do!
worker1 [59]
worker2 [59]
worker2: nothing to do!
worker1 [60]
worker2 [60]
worker2: nothing to do!
worker1 [61]
worker2 [61]
worker2: nothing to do!
worker1 [62]
worker2 [62]
worker2: nothing to do!
worker1 [63]
worker2 [63]
worker2: nothing to do!
worker1 [64]
worker2 [64]
worker2 ok!
worker1 ok!
Multi-task OK!
```

分析代码,`worker1`是尝试获取`Arc`中的这个**双端队列**,然后尝试在队列的最后放东西.

由于是协作式调度,`worker1`每次放入的之后都会`yield`,因此`worker2`就会接手,然后尝试把队列里**所有的内容**都打出来,如果队列为空就报告`worker2: nothing to do!`,然后再由`worker1`接手CPU.

## 协作式调度

与`rCore`不同,现在使用的是`List`而不是一个数组,原理上就不设置任务的个数了.

## 互斥锁和自旋锁

自旋锁可能是我们脑子中的那个锁,每次访问资源需要访问这个锁,如果没办法访问那你这个任务要处理这种情况.

互斥锁则是自己加了一个等待队列,如果有任务在等待这个资源,那么这个任务被加入等待队列之后**不会参与调度**,这样就节省了很多任务切换时的资源.

![](00%20inbox/asset/Pasted%20image%2020241117212636.png)

# bump内存分配算法

`#TODO`

# 挑战性作业

initialize global allocator at: [0xffffffc08026f000, 0xffffffc088000000)

5376*2

align是8的是有关于Vec的内存的分配

131,665,920

1048576

524288+8000

`#TODO`


