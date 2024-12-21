# 实验1 

这部分实验是上部分的作业暂时略过.

# LinuxApp

实验命令:
```shell
make payload
./update_disk.sh payload/hello_c/hello
make run A=tour/m_3_0 BLK=y
```

这里看`payload/hello_c/Makefile`,可以看到:
```makefile
TARGET := hello

CC := riscv64-linux-musl-gcc
STRIP := riscv64-linux-musl-strip

all: $(TARGET)

%: %.c
	$(CC) -static $< -o $@
	$(STRIP) $@

clean:
	@rm -rf ./$(TARGET)

```

可以看到我们使用的**编译器**和**信息移除工具**都是指定的版本是`linux`.

这张图有些**害人匪浅**了,

![](00%20inbox/asset/Pasted%20image%2020241203211933.png)

这个图是`linux`应用的用户栈.

但是我们从**实用的角度**来看,应用主函数的原型:
```C
int main(int argc, char *argv[], char *enp[]);
```

我们只需要在栈里边按顺序保存:
1. argc
2. arg_ptr
3. env_ptr
4. auxv

即可,只要`argc`的值是对的,`arg_ptr`和`env_ptr`指向的实例是对的即可.

> 这里有一个疑问:到底谁是对的?

在`kernel-elf-parser`里的`src/user_stack.rs`的注释和它具体的实现是一样的:
```rust
//! Initialize the user stack for the application
//!
//! The structure of the user stack is described in the following figure:
//! position            content                     size (bytes) + comment
//!   ------------------------------------------------------------------------
//! stack pointer ->  [ argc = number of args ]     8
//!                   [ argv[0] (pointer) ]         8   (program name)
//!                   [ argv[1] (pointer) ]         8
//!                   [ argv[..] (pointer) ]        8 * x
//!                   [ argv[n - 1] (pointer) ]     8
//!                   [ argv[n] (pointer) ]         8   (= NULL)
//!                   [ envp[0] (pointer) ]         8
//!                   [ envp[1] (pointer) ]         8
//!                   [ envp[..] (pointer) ]        8
//!                   [ envp[term] (pointer) ]      8   (= NULL)
//!                   [ auxv[0] (Elf32_auxv_t) ]    16
//!                   [ auxv[1] (Elf32_auxv_t) ]    16
//!                   [ auxv[..] (Elf32_auxv_t) ]   16
//!                   [ auxv[term] (Elf32_auxv_t) ] 16  (= AT_NULL vector)
//!                   [ padding ]                   0 - 16
//!                   [ argument ASCIIZ strings ]   >= 0
//!                   [ environment ASCIIZ str. ]   >= 0
//!
//! (0xbffffff8)      [ end marker ]                8   (= NULL)
//!
//! (0xc0000000)      < bottom of stack >           0   (virtual)
//!
//! More details can be found in the link: <https://articles.manugarg.com/aboutelfauxiliaryvectors.html>
```

形成的栈:

![|300](00%20inbox/asset/Pasted%20image%2020241203212752.png)

运行log:
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
log_level = info

[  1.746356 0 axruntime:130] Logging is enabled.
[  1.856119 0 axruntime:131] Primary CPU 0 started, dtb = 0x87000000.
[  1.905723 0 axruntime:133] Found physcial memory regions:
[  1.962960 0 axruntime:135]   [PA:0x80200000, PA:0x80232000) .text (READ | EXECUTE | RESERVED)
[  2.026512 0 axruntime:135]   [PA:0x80232000, PA:0x80241000) .rodata (READ | RESERVED)
[  2.073912 0 axruntime:135]   [PA:0x80241000, PA:0x80244000) .data .tdata .tbss .percpu (READ | WRITE | RESERVED)
[  2.124278 0 axruntime:135]   [PA:0x80244000, PA:0x80284000) boot stack (READ | WRITE | RESERVED)
[  2.168556 0 axruntime:135]   [PA:0x80284000, PA:0x802ad000) .bss (READ | WRITE | RESERVED)
[  2.212764 0 axruntime:135]   [PA:0x802ad000, PA:0x88000000) free memory (READ | WRITE | FREE)
[  2.261680 0 axruntime:135]   [PA:0x101000, PA:0x102000) mmio (READ | WRITE | DEVICE | RESERVED)
[  2.305544 0 axruntime:135]   [PA:0xc000000, PA:0xc210000) mmio (READ | WRITE | DEVICE | RESERVED)
[  2.349843 0 axruntime:135]   [PA:0x10000000, PA:0x10001000) mmio (READ | WRITE | DEVICE | RESERVED)
[  2.394978 0 axruntime:135]   [PA:0x10001000, PA:0x10009000) mmio (READ | WRITE | DEVICE | RESERVED)
[  2.440055 0 axruntime:135]   [PA:0x22000000, PA:0x24000000) mmio (READ | WRITE | DEVICE | RESERVED)
[  2.485718 0 axruntime:135]   [PA:0x30000000, PA:0x40000000) mmio (READ | WRITE | DEVICE | RESERVED)
[  2.530990 0 axruntime:135]   [PA:0x40000000, PA:0x80000000) mmio (READ | WRITE | DEVICE | RESERVED)
[  2.583846 0 axruntime:208] Initialize global memory allocator...
[  2.621634 0 axruntime:209]   use TLSF allocator.
[  2.816195 0 axmm:81] Initialize virtual memory management...
[  3.188863 0 axruntime:150] Initialize platform devices...
[  3.249907 0 axtask::api:68] Initialize scheduling...
[  3.436552 0 axtask::api:74]   use Completely Fair scheduler.
[  3.474966 0 axdriver:152] Initialize device drivers...
[  3.510394 0 axdriver:153]   device model: static
[  3.664938 0 virtio_drivers::device::blk:59] config: 0xffffffc040006000
[  3.721121 0 virtio_drivers::device::blk:64] found a block device of size 65536KB
[  3.787426 0 axdriver::bus::pci:104] registered a new Block device at 00:01.0: "virtio-blk"
[ 21.285217 0 axfs:41] Initialize filesystems...
[ 21.329601 0 axfs:44]   use block device 0: "virtio-blk"
[ 22.099152 0 fatfs::dir:139] Is a directory
[ 22.277106 0 fatfs::dir:139] Is a directory
[ 22.556181 0 fatfs::dir:139] Is a directory
[ 22.683443 0 fatfs::dir:139] Is a directory
[ 22.770783 0 axruntime:176] Initialize interrupt handlers...
[ 22.932112 0 axruntime:186] Primary CPU 0 init OK.
[ 23.210370 0:2 m_3_0::loader:58] e_entry: 0x50E
phdr: offset: 0x0=>0x0 size: 0x17CC=>0x17CC
VA:0x0 - VA:0x2000
phdr: offset: 0x1E70=>0x2E70 size: 0x338=>0x9A8
VA:0x2000 - VA:0x4000
entry: 0x50e
Mapping user stack: VA:0x3fffff0000 -> VA:0x4000000000
New user address space: AddrSpace {
    va_range: VA:0x0..VA:0x4000000000,
    page_table_root: PA:0x8064e000,
}
[ 23.946790 0:4 m_3_0::task:56] Enter user space: entry=0x50e, ustack=0x3fffffffc0, kstack=VA:0xffffffc0806a7010
handle_syscall [96] ...
handle_syscall [29] ...
Unimplemented syscall: SYS_IOCTL
handle_syscall [66] ...
Hello, UserApp!
handle_syscall [66] ...

handle_syscall [94] ...
[SYS_EXIT_GROUP]: system is exiting ..
monolithic kernel exit [Some(0)] normally!
[ 24.504671 0:2 axhal::platform::riscv64_qemu_virt::misc:3] Shutting down...
```


可以看到运行过程中还调用了:`SYS_IOCTL`和`SYS_SET_TID_ADDRESS`两个系统调用.

这是因为:"示例m_3_0基于musl工具链以静态方式编译，工具链为应用附加的部分也会调用syscall。"

![](00%20inbox/asset/Pasted%20image%2020241204001716.png)

就是添加的这个`_start`和`_exit`的系统调用.

> `set_tid_address`会设置`clear_child_tid`的值,在进程创建和释放的时候会用到.
> `set_tid_address`在父线程创建一个子线程的时候会把自己的`tid`写到这个`address`的区域里.
> `clear_child_tid`在释放自己线程或者锁和其它资源的时候,会把返回的值里写入到`address`里.

>`ioctl`是用来设置对外输出终端属性的.
>现在用的是`sbi`的`putchar`,因此可以直接跳过.

> 对于不同的体系结构，系统调用号不同。示例是基于riscv64的系统调用号规范。

最后总结就是我们设置好合理的`syscall`,把系统调用号设置好,那么就可以实现一定程度上的兼容.

![](00%20inbox/asset/Pasted%20image%2020241204002546.png)

像这个APP只需要提供`syscall`的兼容层就行了.

其余的兼容层根据APP不同也需要实现.

## 对Linux常用文件系统的支持

> arceOS是通过`axfs_ramfs`对`procfs`和`sysfs`提供兼容.通过`axfs_devfs`提供`devfs`的兼容.
> 目前用`ramfs`进行兼容是一个临时的方法.
> 也就是使用内存文件系统.访问的时候相当于访问了一个基于内存的节点,里边有一些基于内存的数据,这些数据是其它子系统填充过来的数据.
> 正常的Linux是你访问这个`proc`之类的文件的时候实际上是调用了一个回调函数去获取系统状态.

# 实现mmap系统调用

实现方法:
1. 通过`sys_read`方法读取到文件里的内容. 
2. 读取当前的任务的`user space`.
3. 寻找空闲的映射空间的虚拟地址
4. 构造`flag`.
5. 创建一块`frame`,并且把虚拟地址映射到`frame`.
6. 把文件内容拷贝到内存中去

```rust
#[allow(unused_variables)]
fn sys_mmap(
    addr: *mut usize,
    length: usize,
    prot: i32,
    flags: i32,
    fd: i32,
    _offset: isize,
) -> isize {
    const MAX_MMAP_SIZE: usize = 64;
    let mut buf: [u8; 64] = [0u8;MAX_MMAP_SIZE];
    unsafe {
        let buf_ptr = &mut buf as *mut _ as *mut c_void;
        sys_read(fd, buf_ptr, length+_offset as usize);
    }
    let mut buf = &buf[_offset as usize..length+_offset as usize];

    let binding = current();
    let mut uspace = &mut binding.task_ext().aspace.lock();

    let free_va = if addr.is_null() {
        uspace.find_free_area(
            (addr as usize).into(), 
            length, 
            VirtAddrRange::new(
                uspace.base(),
                uspace.end()))
            .unwrap_or_else(|| panic!("No free area for mmap"))
    }else{
        (addr as usize).into()
    };

    // 把prot转换成MappingFlags
    let mut flags = MappingFlags::from(MmapProt::from_bits_truncate(prot));
    flags.set(MappingFlags::USER, true);

    uspace.map_alloc(
        free_va, 
        PAGE_SIZE_4K, 
        flags, 
        true)
        .unwrap();
    let (paddr, _, _) = uspace
        .page_table()
        .query(free_va)
        .unwrap_or_else(|_| panic!("Mapping failed for segment"));
    unsafe {
        core::ptr::copy_nonoverlapping(
            buf.as_ptr(),
            phys_to_virt(paddr).as_mut_ptr(),
            PAGE_SIZE_4K,
        );
    }
    free_va.as_usize() as isize
}
```

> 这里`flags`的处理还是很不到位,需要后续增加.