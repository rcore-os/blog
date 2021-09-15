---
title: 2021开源操作系统夏令营总结-tiny_kernel-陈乐
date: 2021-09-15 08:34:03
categories:
	- report
tags:
	- author:yuoo655
	- summerofcode2021
	- async-os
---


repo地址：[https://github.com/yuoo655/async_os](https://github.com/yuoo655/async_os)

<!-- more -->

## 设计背景

现有如下事实:

页表切换开销(进程) > 栈切换开销(线程) > 无栈切换函数调用开销(协程) > 函数调用

在双页表设计下,线程切换需要进入内核,这时需切换页表.页表切换的开销对于线程来说比较大,所以有了用户态和内核态共享一个线程调度器与执行器的想法.

具体目标:同一进程下的线程切换不需要进入内核,不同进程下的线程切换需要一个系统调用来切换到目标进程.

### 如何在内核和用户之间共享一段代码

思考:在单页表的情形下内核和用户在同一地址空间,内核在创建一个用户进程时需要把内核各段映射进用户空间.那么内核本质上是一个多线程程序,所有用户共享了内核的地址空间

仿照刚才思路,我采取把需要共享的代码当成一个单页表下的内核来写,所有进程(双页表下内核和用户都是独立的进程)共享此部分地址空间.

那么关于共享代码的部分大致过程就是:把需要共享的代码编译成一个elf文件 ==> 把elf文件加载到固定的物理地址 ==> 在内核中映射 ==> 在用户进程中映射

该elf文件的代码段在用户进程下的权限是可读可执行R||X 这样保证了用户无法修改代码.

### 用户进程如何执行调度器的代码

由于调度器被编译成了一个elf文件. 那么只用知道一个起始地址和函数在elf文件中的偏移(调度器不做改动该偏移量是固定的),就可以跳转到目标地址执行.


## 代码分析

调度器的链接脚本编写 ----- async_os/tiny_kernel/src/linker.ld

把调度器起始地址设置为0x87000000

```rust
OUTPUT_ARCH(riscv)
ENTRY(_start)
BASE_ADDRESS = 0x87000000;
SECTIONS
{
    . = BASE_ADDRESS;
    start = .;
    .text : {
        stext = .;
        *(.text.entry)
        *(.text .text.*)
        . = ALIGN(4K);
        etext = .;
    }
...(略)
}
```

加载调度器 ----- async_os/1.py

在qemu中把它加载到0x87000000(此部分可以优化,即不通过qemu加载,而是通过内核来加载)

```python
os.system("qemu-system-riscv64 \
-machine virt \
-nographic \
-bios bootloader/rustsbi-qemu.bin \
-device loader,file=os/target/riscv64gc-unknown-none-elf/release/os,addr=0x80200000 \
-device loader,file=tiny_kernel/target/riscv64gc-unknown-none-elf/release/tiny_kernel.bin,addr=0x87000000 \
-drive file=user/target/riscv64gc-unknown-none-elf/release/fs.img,if=none,format=raw,id=x0 \
-device virtio-blk-device,drive=x0,bus=virtio-mmio-bus.0 ")
```

映射进用户进程 ----- async_os\os\src\mm\memory_set.rs:270
此时可以映射任意的虚拟地址与调度器的物理地址相对应.在用户进程下只需要知道代码的相对偏移量即可
```rust
pub fn push_shared(&mut self) {
    let start_addr = 0x87000000 as usize;
    //代码段可读可执行
    for i in 0..5 {
        // println!("R||X addr:{:#x}", start_addr + PAGE_SIZE*i);
        self.page_table.map(
            VirtAddr::from(start_addr + PAGE_SIZE*i).into(),  
            PhysAddr::from(start_addr + PAGE_SIZE*i).into(),  
            PTEFlags::R | PTEFlags::X  | PTEFlags::U
        );
    }
    for i in 5..50 {
        self.page_table.map(
            VirtAddr::from(start_addr + PAGE_SIZE*i).into(),  
            PhysAddr::from(start_addr + PAGE_SIZE*i).into(),  
            PTEFlags::R |  PTEFlags::W | PTEFlags::U
        );
    }
}
```


调度器需要一个动态内存分配器,内核来初始化它(其实在用户态也可以,这么做就是为了测试下内核是否正确执行其中代码) ----- os\src\main.rs:64
```rust
println!("[kernel] init scheduler mem");
unsafe {
    llvm_asm!("auipc ra, 0");
    llvm_asm!("jalr ra, $0" :: "r"(0x87000462 as usize));
}
```


在用户进程中执行调度器的代码   ----- user\src\bin\1.rs:24
目前还没有很好的办法来解 决如何让用户程序知道函数在elf文件中的偏移量.
```rust
let add_to_thread_pool: unsafe extern "C" fn(usize, usize) = unsafe { core::mem::transmute(0x87000854 as usize) };
unsafe { add_to_thread_pool(addr, 1 as usize) };
```


## 调度器实现部分(代码共享无关)

调度的基本单位线程的数据结构.双页表的情况下应该不需要这个KernelStack.为了方便起见,还是先不动它..
```rust
pub struct Thread {
    //上下文
    pub context: Context,
    pub kstack: KernelStack,
    //由于调度器需要知道下一个要执行的线程所属的地址空间是啥,以便在不同地址空间时可以切换过去,所以需要在线程中保存当前地址空间的信息
    //这个地址空间由内核分配,类似与Tid,和satp绑定
    pub space_id: usize,
}
```

space_id与satp的相关信息  ----- os\src\mm\memory_set.rs:46 
```rust

lazy_static! {
    pub static ref SPACE_ID_SATP : Vec<usize> = {
        let mut v = Vec::new();
        
        //初始化为0  vector的index就是space_id,在里面存着satp的值 
        for i in 0..10{
            v.push(0);
        }
        v
    };
}
```


创建线程 ----- tiny_kernel\src\process\thread.rs:28

进程通过读取tp寄存器获取space_id信息,创建进程时space_id通过arg传入.对于进程来说它只能看到space_id但无法知道satp的值,该映射信息由内核掌握
```rust
pub fn new_thread(entry: usize, arg: usize) -> Thread {
    unsafe {
        let kstack_ = KernelStack::new();
        Thread {
            context: Context::new_thread_context(entry, arg, kstack_.top()),
            kstack: kstack_,
            space_id: arg
        }
    }
}
pub fn switch_to(&mut self, target: &mut Thread) {
   unsafe {
       self.context.switch(&mut target.context);
   }
}
```

把space_id传入tp寄存器 ----- os\src\trap\context.rs:18

```rust
pub struct TrapContext {
    pub x: [usize; 32],
    pub sstatus: Sstatus,
    pub sepc: usize,
    pub kernel_satp: usize,
    pub kernel_sp: usize,
    pub trap_handler: usize,
    pub tp: usize,
}

impl TrapContext {
    pub fn set_sp(&mut self, sp: usize) { self.x[2] = sp; }
    
    pub fn app_init_context(
        entry: usize,
        sp: usize,
        kernel_satp: usize,
        kernel_sp: usize,
        trap_handler: usize,
        tp: usize,
    ) -> Self {
        let mut sstatus = sstatus::read();
        // set CPU privilege to User after trapping back
        sstatus.set_spp(SPP::User);
        let mut cx = Self {
            x: [0; 32],
            sstatus,
            sepc: entry,
            kernel_satp,
            kernel_sp,
            trap_handler,
            tp,
        };
        cx.set_sp(sp);
        cx
    }
}


----- os\src\trap\trap.S中

__restore:

    csrw satp, a1
    sfence.vma
    csrw sscratch, a0
    mv sp, a0
    ld t0, 32*8(sp)
    ld t1, 33*8(sp)

    //这里把space_id传入了tp寄存器中
    ld tp, 37*8(sp)
    (略)
    sret

```



## 调度器中的线程管理器

fifo的形式   tiny_kernel\src\process\fifo.rs
```rust
pub struct ThreadManager {
    ready_queue: VecDeque<Thread>,
}

impl ThreadManager {
    pub fn new() -> Self {
        Self { ready_queue: VecDeque::new(), }
    }
    pub fn add(&mut self, thread: Thread) {
        self.ready_queue.push_back(thread);
    }
    pub fn fetch(&mut self) -> Option<Thread> {
        self.ready_queue.pop_front()
    }

    pub fn front(&mut self) -> Option<&Thread> {
        self.ready_queue.front()
    }
}

lazy_static! {
    pub static ref THREAD_MANAGER: Mutex<ThreadManager> = Mutex::new(ThreadManager::new());
}

pub fn add_thread(thread: Thread) {
    THREAD_MANAGER.lock().add(thread);
}

pub fn fetch_thread() -> Option<Thread> {
    THREAD_MANAGER.lock().fetch()
}

//获取当前线程的space_id
pub fn thread_space_id() -> usize {
    let x = THREAD_MANAGER.lock().ready_queue.front().unwrap().space_id;
    x
}
```


加入线程到调度器(ThreadManager)  tiny_kernel\src\process\mod.rs:58

```rust
pub fn add_to_thread_pool(addr: usize, space_id:usize) {
    THREAD_MANAGER.lock().add(
        {
            let thread = Thread::new_thread(addr, space_id);
            thread
        }
    );
}
```

最后就是run thread   tiny_kernel\src\process\mod.rs:49
```rust
pub fn run(target:&mut Thread){
    Thread::new_idle().switch_to(target)
}
```


当从调度器得到的线程不是当前地址空间时候需要切换到指定的地址空间

给定space_id通过一个系统调用切换到指定地址空间

通过sys_do_yield系统调用来切换, 参数就是指定的space_id

在内核中维护一个数据结构,其中给定了space_id与进程的context
```rust
pub struct SpaceidContext{
    info: Vec<usize>
}


impl SpaceidContext{
    pub fn new() -> Self {

        let mut zero_vec: Vec<usize> = Vec::with_capacity(100);
        for i in 0..100 {
            zero_vec.push(0);
        }
        Self {
            info: zero_vec
        }
    }
    pub fn push_context(&mut self,space_id:usize, value:usize) {
        self.info[space_id] = value;
    }

    pub fn get_context_ptr(&self, space_id:usize) -> usize{
        self.info[space_id]
    }
}

lazy_static! {
    pub static ref SPACE: Mutex<SpaceidContext> = Mutex::new(SpaceidContext::new());
}


pub fn sys_do_yield(space_id:usize) -> isize {
    switch_to_spaceid(space_id);
    0
}

//切换到目标进程
pub fn switch_to_spaceid(space_id:usize){

    let idle = 0 as usize;
    let target_context_ptr = SPACE.lock().get_context_ptr(space_id);
    unsafe {
        __switch(
            &idle  as *const usize,
            &target_context_ptr as *const usize,
        );
    }
}
```


## 运行演示
在async_os下run python 1.py
```rust
[rustsbi] RustSBI version 0.2.0-alpha.1
.______       __    __      _______.___________.  _______..______   __
|   _  \     |  |  |  |    /       |           | /       ||   _  \ |  |
|  |_)  |    |  |  |  |   |   (----`---|  |----`|   (----`|  |_)  ||  |
|      /     |  |  |  |    \   \       |  |      \   \    |   _  < |  |
|  |\  \----.|  `--'  |.----)   |      |  |  .----)   |   |  |_)  ||  |
| _| `._____| \______/ |_______/       |__|  |_______/    |______/ |__|

[rustsbi] Platform: QEMU (Version 0.2.0)
[rustsbi] misa: RV64ACDFIMSU
[rustsbi] mideleg: 0x222
[rustsbi] medeleg: 0xb1ab
[rustsbi-dtb] Hart count: cluster0 with 1 cores
[rustsbi] Kernel entry: 0x80200000
[kernel] Hello, world!
last 31696 Physical Frames.
.text [0x80200000, 0x80218000)
.rodata [0x80218000, 0x8021e000)
.data [0x8021e000, 0x8021f000)
.bss [0x8021f000, 0x80430000)
ekernel  MEMORY_END [0x80430000, 0x88000000)
mapping .text section
mapping .rodata section
mapping .data section
mapping .bss section
mapping physical memory
mapping memory-mapped registers
remap_test passed!
loader list app
/**** APPS ****
1
2
initproc
usertests
user_shell
**************/
[kernel] init scheduler mem
[user1] Hello world from user mode program!
[user1] add thread to scheduler  entry addr 0x1d0 space_id 0x1
[user2] Hello world from user mode program!
[user2] add thread to scheduler  entry addr 0x1d0 space_id 0x2
hello world! from --------------------- user1
hello world! from --------------------- user2
```


## 参考资料

1. 飓风内核:[https://github.com/HUST-OS/tornado-os](https://github.com/HUST-OS/tornado-os)
2. 异步操作系统设计方案: [https://github.com/async-kernel/documents/blob/main/design/design.md](https://github.com/async-kernel/documents/blob/main/design/design.md)
