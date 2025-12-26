---
title: ArceOS第四节课笔记
date: 2024-12-21 18:19:26
categories:
    - note
tags:
    - author:Winddevil
---

# 回顾与展望

之前就是做了一系列的实验建立了unikernel的框架.

通过unikernel的形式通过增加一些组件来跨过这个边界,来实现一个宏内核.

# 从Unikernel到宏内核

通过跨越模式边界,弄一个简单的系统调用的操作.

> 增加用户特权级和特权级上下文切换是变成宏内核的关键.

## 实验1

> `rust-analyzer`不能正常解析代码的原因,需要在`.vscode/settings.json`里加入`"rust-analyzer.cargo.target": "riscv64gc-unknown-none-elf"`

实验命令行:
```shell
make payload
./update_disk.sh ./payload/origin/origin
make run A=tour/m_1_0 BLK=y
```

> 如果不能执行`payload`说明代码版本太老了,需要先`git fetch origin`然后再`git merge origin`到当前的分支

> 这里注意如果`make payload`报错`Error`,那么一定是因为没有配置好`musl`的环境变量,注意看一下`~/.bashrc`,记得更新完`~/.bashrc`要进行狠狠的`source ~/.bashrc`

对于`./update_disk.sh ./payload/origin/origin`的操作对于我这种没操作过的人来说是非常神奇的操作.这一步实际上是把`disk.img`挂载在linux的文件系统里,然后在直接用linux的指令直接往里边拷贝应用文件的数据.

然后`make run A=tour/m_1_0 BLK=y`就和上一节课的实验一样了.

跑出来的结果是:
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

[ 21.794824 0 fatfs::dir:139] Is a directory
[ 22.065035 0 fatfs::dir:139] Is a directory
[ 22.359963 0 fatfs::dir:139] Is a directory
[ 22.490439 0 fatfs::dir:139] Is a directory
app: /sbin/origin
paddr: PA:0x80642000
Mapping user stack: VA:0x3fffff0000 -> VA:0x4000000000
New user address space: AddrSpace {
    va_range: VA:0x0..VA:0x4000000000,
    page_table_root: PA:0x80641000,
}
Enter user space: entry=0x1000, ustack=0x4000000000, kstack=VA:0xffffffc080697010
handle_syscall ...
[SYS_EXIT]: process is exiting ..
monolithic kernel exit [Some(0)] normally!
```

让我们看一下`orgin`的app内容:
```rust
#[no_mangle]
unsafe extern "C" fn _start() -> ! {
    core::arch::asm!(
        "addi sp, sp, -4",
        "sw a0, (sp)",
        "li a7, 93",
        "ecall",
        options(noreturn)
    )
}
```

很容易懂的,就是调用了第`93`号`syscall`.

# 课后练习

> 主要是要理解`AddrSpace`在`map_alloc`的时候的`populating`选项.

根据在`rCore`中学到的经验,去查看源码,我们的结构是这样的.

![|800](00%20inbox/asset/Pasted%20image%2020241202104723.png)

就是在创建`MemoryArea`的时候要传入一个泛型`Backend`.

应该就是和这边页的懒加载有关的内容.

调用到最后调用的是`modules/axmm/src/backend/alloc.rs`这个文件里的`map_alloc`,因为层层抽象,这里各个参数都还原成了最开始`tour/m_1_0/src/main.rs`里的变量名称.

![|800](00%20inbox/asset/Pasted%20image%2020241202211802.png)

然后关键代码是:
```rust
        if populate {
            // allocate all possible physical frames for populated mapping.
            for addr in PageIter4K::new(start, start + size).unwrap() {
                if let Some(frame) = alloc_frame(true) {
                    if let Ok(tlb) = pt.map(addr, frame, PageSize::Size4K, flags) {
                        tlb.ignore(); // TLB flush on map is unnecessary, as there are no outdated mappings.
                    } else {
                        return false;
                    }
                }
            }
            true
        } else {
            // Map to a empty entry for on-demand mapping.
            let flags = MappingFlags::empty();
            pt.map_region(start, |_| 0.into(), size, flags, false, false)
                .map(|tlb| tlb.ignore())
                .is_ok()
        }
```

这里假如我们的`poplulate`是选定的`true`,那么就会立即根据`4k`一个大小的`frame`进行内存申请,然后把这个虚拟地址和刚刚申请到的`frame`在`page_table`中映射起来.

但是如果我们选定`populate`为`false`,那么直接把虚拟地址和`0`这个错误的物理地址映射起来.

那么这时候实际上就需要我们在访问到这个物理地址的时候,**再进行物理页申请**.

那么在访问到这个地址的时候会发生**缺页异常**.

这时候我们运行一下应用:
```shell
make payload
./update_disk.sh payload/origin/origin
make run A=tour/m_1_0/ BLK=y
```

这是对应的`log`:
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

[ 21.690418 0 fatfs::dir:139] Is a directory
[ 21.963457 0 fatfs::dir:139] Is a directory
[ 22.252957 0 fatfs::dir:139] Is a directory
[ 22.383790 0 fatfs::dir:139] Is a directory
app: /sbin/origin
paddr: PA:0x80642000
Mapping user stack: VA:0x3fffff0000 -> VA:0x4000000000
New user address space: AddrSpace {
    va_range: VA:0x0..VA:0x4000000000,
    page_table_root: PA:0x80641000,
}
Enter user space: entry=0x1000, ustack=0x4000000000, kstack=VA:0xffffffc080687010
[ 23.235085 0:4 axhal::arch::riscv::trap:24] No registered handler for trap PAGE_FAULT
[ 23.319751 0:4 axruntime::lang_items:5] panicked at modules/axhal/src/arch/riscv/trap.rs:25:9:
Unhandled User Page Fault @ 0x1002, fault_vaddr=VA:0x3ffffffffc (WRITE | USER):
TrapFrame {
    regs: GeneralRegisters {
        ra: 0x0,
        sp: 0x3ffffffffc,
        gp: 0x0,
        tp: 0x0,
        t0: 0x0,
        t1: 0x0,
        t2: 0x0,
        s0: 0x0,
        s1: 0x0,
        a0: 0x0,
        a1: 0x0,
        a2: 0x0,
        a3: 0x0,
        a4: 0x0,
        a5: 0x0,
        a6: 0x0,
        a7: 0x0,
        s2: 0x0,
        s3: 0x0,
        s4: 0x0,
        s5: 0x0,
        s6: 0x0,
        s7: 0x0,
        s8: 0x0,
        s9: 0x0,
        s10: 0x0,
        s11: 0x0,
        t3: 0x0,
        t4: 0x0,
        t5: 0x0,
        t6: 0x0,
    },
    sepc: 0x1002,
    sstatus: 0x40020,
}
```

实现方法`tour/m_2_0`里的实现:
```rust
#[register_trap_handler(PAGE_FAULT)]
fn handle_page_fault(vaddr: VirtAddr, access_flags: MappingFlags, is_user: bool) -> bool {
    if is_user {
        if !axtask::current()
            .task_ext()
            .aspace
            .lock()
            .handle_page_fault(vaddr, access_flags)
        {
            ax_println!("{}: segmentation fault, exit!", axtask::current().id_name());
            axtask::exit(-1);
        } else {
            ax_println!("{}: handle page fault OK!", axtask::current().id_name());
        }
        true
    } else {
        false
    }
}
```

这里主要是调用了`aspace`也即当前任务地址空间中处理缺页故障的方法.

就像我们之前在上一节分析到的`Backend`的`map`方法一样,还是调用了`Backend`的`remap`方法.

就是当即分配一个`frame`,然后把当前出问题的`va`虚拟地址重新映射到`frame`.



