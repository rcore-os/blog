---
title: 罗子健的blog
date: 2022-08-05 08:54:25
categories:
    - report
tags:
    - author:YXLZJ
    - summerofcode2022
    - rcore-lab
---

# 罗子健的blog
### Rust预览部分
1.完成了rustlings，之前学过rust，但是一直没有用它。这次算得上是实际运用了。rustlang与其他语言的不同之处，主要在于它独特的特权机制，提供了除gc和手动管理内存之外的第三种方案。

<!-- more -->

### lab0-1
这一章主要实在裸机上运行程序，运用编译工具链
```
target = riscv64gc-unknown-none-elf
```
作为裸机程序，我们必须移除标准库和增加语言项并且移除main函数
```
// os/src/lang_items.rs
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}
```
增加入口函数
```
// os/src/main.rs
#[no_mangle]
extern "C" fn _start() {
    loop{};
}
```
执行环境缺乏退出机制
```
const SYSCALL_EXIT: usize = 93;

fn syscall(id: usize, args: [usize; 3]) -> isize {
    let mut ret;
    unsafe {
        core::arch::asm!(
            "ecall",
            inlateout("x10") args[0] => ret,
            in("x11") args[1],
            in("x12") args[2],
            in("x17") id,
        );
    }
    ret
}

pub fn sys_exit(xstate: i32) -> isize {
    syscall(SYSCALL_EXIT, [xstate as usize, 0, 0])
}
```
在这一章中，我们也完成了Write Trait使其可以进行输出字符
这样一个最小化的内核程序就能被启动起来了
```
// os/src/main.rs

#[no_mangle]
extern "C" fn _start() {
    print!("Hello, "");
    println!("world!");
    sys_exit(9);
}
```
效果如：
```
$ qemu-riscv64 target/riscv64gc-unknown-none-elf/debug/os; echo $?
  Hello, world!
  9
```
### lab0-2
qemu开机时：
qemu-system-riscv64 软件，就意味给这台虚拟的 RISC-V64 计算机加电了。 此时，CPU 的其它通用寄存器清零，而 PC 会指向 0x1000 的位置，这里有固化在硬件中的一小段引导代码， 它会很快跳转到 0x80000000 的 RustSBI 处。 RustSBI完成硬件初始化后，会跳转到 $(KERNEL_BIN) 所在内存位置 0x80200000 处， 执行操作系统的第一条指令。
![tupian](罗子健的blog/chap1-intro.png)
然后实现关机功能
```
// os/src/sbi.rs
fn sbi_call(which: usize, arg0: usize, arg1: usize, arg2: usize) -> usize {
 let mut ret;
  unsafe {
      core::arch::asm!(
          "ecall",
...

const SBI_SHUTDOWN: usize = 8;

pub fn shutdown() -> ! {
    sbi_call(SBI_SHUTDOWN, 0, 0, 0);
    panic!("It should shutdown!");
}

// os/src/main.rs
#[no_mangle]
extern "C" fn _start() {
    shutdown();
}
```
应用程序访问操作系统提供的系统调用的指令是 ecall ，操作系统访问 RustSBI提供的SBI调用的指令也是 ecall ， 虽然指令一样，但它们所在的特权级是不一样的。 简单地说，应用程序位于最弱的用户特权级（User Mode）， 操作系统位于内核特权级（Supervisor Mode）， RustSBI位于机器特权级（Machine Mode）。 
此后我们需要通过连接脚本调整连接器的行为，使内存布局符合预计
用另一段汇编代码初始化栈空间：
```
# os/src/entry.asm
    .section .text.entry
     .globl _start
_start:
    la sp, boot_stack_top
    call rust_main
    .section .bss.stack
    .globl boot_stack
boot_stack:
    .space 4096 * 16
    .globl boot_stack_top
boot_stack_top:
```
最后清空.bss段

### lab0-2
应用程序设计，主要是包装一个user_lib,方便应用程序进行系统调用
新增系统调用
```
fn sys_write(fd: usize, buf: *const u8, len: usize) -> isize;
fn sys_exit(xstate: usize) -> !;
```
我们要把应用程序的二进制镜像文件作为数据段链接到内核里， 内核需要知道应用程序的数量和它们的位置。
```
_num_app:
    .quad 3
    .quad app_0_start
    .quad app_1_start
    .quad app_2_start
    .quad app_2_end
    .section .data
    .global app_0_start
    .global app_0_end
app_0_start:
    .incbin "../user/target/riscv64gc-unknown-none-elf/release/hello_world.bin"
app_0_end:
```
在 os 的 batch 子模块中实现一个应用管理器 AppManager
```
struct AppManager {
    num_app: usize,
    current_app: usize,
    app_start: [usize; MAX_APP_NUM + 1],
}
```
始化 AppManager 的全局实例
```
lazy_static! {
    static ref APP_MANAGER: UPSafeCell<AppManager> = unsafe {
        UPSafeCell::new({
            extern "C" {
                fn _num_app();
            }
            let num_app_ptr = _num_app as usize as *const usize;
            let num_app = num_app_ptr.read_volatile();
            let mut app_start: [usize; MAX_APP_NUM + 1] = [0; MAX_APP_NUM + 1];
            let app_start_raw: &[usize] =
                core::slice::from_raw_parts(num_app_ptr.add(1), num_app + 1);
            app_start[..=num_app].copy_from_slice(app_start_raw);
            AppManager {
                num_app,
                current_app: 0,
                app_start,
            }
        })
    };
}
```
```
unsafe fn load_app(&self, app_id: usize) {
    if app_id >= self.num_app {
        panic!("All applications completed!");
    }
    info!("[kernel] Loading app_{}", app_id);
    // clear icache
    core::arch::asm!("fence.i");
    // clear app area
    core::slice::from_raw_parts_mut(APP_BASE_ADDRESS as *mut u8, APP_SIZE_LIMIT).fill(0);
    let app_src = core::slice::from_raw_parts(
        self.app_start[app_id] as *const u8,
        self.app_start[app_id + 1] - self.app_start[app_id],
    );
    let app_dst = core::slice::from_raw_parts_mut(APP_BASE_ADDRESS as *mut u8, app_src.len());
    app_dst.copy_from_slice(app_src);
}
```
控制程序执行
1.启动应用程序时，需要初始化应用程序的用户态上下文，并能切换到用户态执行应用程序；
2.应用程序发起系统调用后，需要切换到批处理操作系统中进行处理；
3.应用程序执行出错时，批处理操作系统要杀死该应用并加载运行下一个应用；
4.应用程序执行结束时，批处理操作系统要加载运行下一个应用。
进入 S 特权级 Trap 的相关 CSR
CSR 名
该 CSR 与 Trap 相关的功能
sstatus
SPP 等字段给出 Trap 发生之前 CPU 处在哪个特权级（S/U）等信息
sepc
当 Trap 是一个异常的时候，记录 Trap 发生之前执行的最后一条指令的地址
scause
描述 Trap 的原因
stval
给出 Trap 附加信息
stvec
控制 Trap 处理代码的入口地址
而当 CPU 完成 Trap 处理准备返回的时候，需要通过一条 S 特权级的特权指令 sret 来完成，这一条指令具体完成以下功能：
CPU 会将当前的特权级按照 sstatus 的 SPP 字段设置为 U 或者 S ；
CPU 会跳转到 sepc 寄存器指向的那条指令，然后继续执行。
用户站和内核栈
```
impl UserStack {
    fn get_sp(&self) -> usize {
        self.data.as_ptr() as usize + USER_STACK_SIZE
    }
}
```
可以看到里面包含所有的通用寄存器 x0~x31 ，还有 sstatus 和 sepc
此外还有Trap 上下文保存和恢复的汇编代码

之后我们就可以通过syscall分发进行系统调用了

### lab1-os3
多到程序，就是过个程序同时在内存中 用 -Clink-args=-Ttext=xxxx 选项指定链接时 .text 段的地址为 0x80400000 + app_id * 0x20000
实现__switch精心任务切换，并保存上下文，上下文信息保存在这个数据结构中
```
// os/src/task/context.rs
#[repr(C)]
pub struct TaskContext {
    ra: usize,
    sp: usize,
    s: [usize; 12],
}
```
管理多道程序需要实现 sys_yield 和 sys_exit
运行状态变化图：
![tupian](罗子健的blog/fsm-coop.png)
实现时间片轮转算法（RR）

```
// os/src/timer.rs

use riscv::register::time;

pub fn get_time() -> usize {
    time::read()
}
```
定时器
```
1// os/src/sbi.rs
 2
 3const SBI_SET_TIMER: usize = 0;
 4
 5pub fn set_timer(timer: usize) {
 6    sbi_call(SBI_SET_TIMER, timer, 0, 0);
 7}
 8
 9// os/src/timer.rs
10
11use crate::config::CLOCK_FREQ;
12const TICKS_PER_SEC: usize = 100;
13
14pub fn set_next_trigger() {
15    set_timer(get_time() + CLOCK_FREQ / TICKS_PER_SEC);
16}
```
增加系统调用
```
fn sys_get_time(ts: *mut TimeVal, _tz: usize) -> isize;
```
之后就可以实现抢占式调度
习题不难，根据要求实现接口就好

###lab2-os4
stap:
![stap](罗子健的blog/satp.png)
虚拟与物理地址格式
![va pa](罗子健的blog/sv39-va-pa.png)
用Rust类型系统进行转换
例如：
```
impl From<PhysAddr> for PhysPageNum {
    fn from(v: PhysAddr) -> Self {
        assert_eq!(v.page_offset(), 0);
        v.floor()
    }
}
```
页表项
![pte](罗子健的blog/sv39-pte.png)
访问一个地址时，先通过虚拟耶号，得到页表项，再从页表项中找到真实物理地址，再和偏移量进行拼接。对于分配的页帧，可以通过一个栈来管理，分配与回收
在任务控制块中加入MemSet,在程序看来很方便的就可以管理内存空间，同时，所有程序都可以使用同样的连接脚本
此外，我们还需要修改一些内容，以适应虚拟内存，比如SYS_WRITE系统调用（缓冲的地址改变），trap（地址改变）


### lab3-5
实现系统调用（fork，exec，waitpid）
设计和调整内核中的一些数据结构，包括：

基于应用名的应用链接/加载器
进程标识符 PidHandle 以及内核栈 KernelStack
任务控制块 TaskControlBlock
任务管理器 TaskManager
处理器管理结构 Processor

进程控制块
在内核中，每个进程的执行状态、资源控制等元数据均保存在一个被称为 进程控制块 (PCB, Process Control Block) 的结构中，它是内核对进程进行管理的单位。在内核看来，它就等价于一个进程。

TaskControlBlockInner 中包含下面这些内容：
trap_cx_ppn 指出了应用地址空间中的 Trap 上下文被放在的物理页帧的物理页号。
base_size 的含义是：应用数据仅有可能出现在应用地址空间低于 base_size 字节的区域中。借助它我们可以清楚的知道应用有多少数据驻留在内存中。
task_cx 保存任务上下文，用于任务切换。
task_status 维护当前进程的执行状态。
memory_set 表示应用地址空间。
parent 指向当前进程的父进程（如果存在的话）。注意我们使用 Weak 而非 Arc 来包裹另一个任务控制块，因此这个智能指针将不会影响父进程的引用计数。
children 则将当前进程的所有子进程的任务控制块以 Arc 智能指针的形式保存在一个向量中，这样才能够更方便的找到它们。
当进程调用 exit 系统调用主动退出或者执行出错由内核终止的时候，它的退出码 exit_code 会被内核保存在它的任务控制块中，并等待它的父进程通过 waitpid 回收它的资源的同时也收集它的 PID 以及退出码。
其余地方变化不大，主要是复用了任务控制块
进程退出时，父进程要回收子进程的资源
练习：
sys_spawn：模仿fork()进行初始化赋值工作，把复制地址空间的操作修改为把地址空间赋值为memory_set
stride 调度算法：在tcb中加入开始时间，优先级和stride
每切换一次任务更新一下stride值，然后进行插入排序
去新进程时，取出队头tcb，执行，就完成了stride 调度算法，注意还要增加ys_set_priority()系统调用，已设置优先级
