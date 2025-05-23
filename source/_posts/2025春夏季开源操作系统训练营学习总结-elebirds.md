---
title: 2025春夏季开源操作系统训练营学习总结-elebirds
date: 2025-05-22 13:31:41
tags: 
    - author:elebirds
    - repo:https://github.com/LearningOS/2025s-rcore-elebirds.git
mathjax: true
---

# 2025春夏季开源操作系统训练营学习总结

2025春夏季我参加了开源操作系统训练营，前三阶段主要是学习了rust语言，并在其两个项目rCore和arceOS中进行实践，下面是我的学习总结。

<!-- more -->

## 基础阶段 - rustling

这一部分主要是rust语言的学习，rustling是一个rust语言的学习项目，包含了rust语言的基本语法、内存管理、并发编程等内容。

总结下来，印象深刻的主要是这几个方面：
### 内存管理

rust使用所有权、借用和生命周期来管理内存，避免了传统语言中的内存泄漏和悬垂指针问题。

所有权是rust中最重要的概念之一，每个值都有一个所有者，所有者在离开作用域时会自动释放内存。

借用是指在不转移所有权的情况下，允许其他变量访问值。借用分为可变借用和不可变借用，前者只能有一个，后者可以有多个。

生命周期是rust中用于描述引用的有效范围的概念，编译器会根据生命周期来检查引用的有效性。

但是，rust的内存管理机制也有一些不足之处，比如在使用引用时需要显式地指定生命周期，这在某些情况下会导致代码变得冗长和复杂，比如：
```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() {
        x
    } else {
        y
    }
}
```
在这个例子中，我们需要显式地指定生命周期参数`'a`，因为编译器无法推断出返回值的生命周期到底是哪个引用的生命周期，自然也就无法进行内存安全检查。

再比如由内存管理引出的字符串`String`和字符串切片`&str`的区别，前者是拥有所有权的可变字符串，而后者仅仅是对字面量字符串的引用，不能修改。
- str 是字符串切片，动态大小类型；
- &str 是字符串切片引用，是对str的不可变引用；
- String 是堆分配字符串，封装了底层的str；
- &String 是堆分配字符串的引用。

这个机制使得rust在内存管理上有了更高的安全性和性能，但也增加了语言复杂性和学习成本。

### 指针
与C/C++等语言不同，rust中并不允许使用裸指针，所有的指针都是安全的引用，编译器会自动检查引用的有效性。
- `&T`：不可变引用，允许读取值，但不允许修改。
- `&mut T`：可变引用，允许读取和修改值，但只能有一个可变引用。
- `Box<T>`：堆分配的值，拥有所有权，可以在堆上分配内存。
- `Rc<T>`：引用计数的值，允许多个所有者，可以在多个地方共享同一个值。
- `Arc<T>`：原子引用计数的值，允许多个所有者，可以在多个线程中共享同一个值。
- `RefCell<T>`：内部可变性，允许在不可变引用中修改值，但需要在运行时检查借用规则。

但在某些时候（底层/性能要求）我们还是需要使用裸指针，这时可以使用`*const T`和`*mut T`来表示不可变和可变的裸指针。
- `*const T`：不可变裸指针，允许读取值，但不允许修改。
- `*mut T`：可变裸指针，允许读取和修改值，但只能有一个可变裸指针。
都需要使用`unsafe`关键字来表示不安全的代码块，编译器不会检查引用的有效性，需要手动保证引用的有效性。（与其说是`unsafe`，不如说是`stfu`...）

### 返回值Option和Result
这个部分我认为是rust语言设计的一个亮点，使用Option和Result类型来表示函数的返回值，并且提供了丰富的API来处理这些类型。

- Option类型表示一个值可能存在也可能不存在。
  - 使用`Some`和`None`来表示。以此来避免使用空指针的问题。
  - 其他语言中使用空指针来表示一个值不存在，这在某些情况下会导致程序崩溃或者出现未定义行为。这是最典中典的`Null Pointer Exception`。
  - Kotlin等语言引入了`?`类型来减少空指针异常的发生，但由于要跟Java兼容，所以还是有很多空指针异常的情况。
- Result类型表示一个操作可能成功也可能失败。
  - 使用`Ok`和`Err`来表示。以此来避免使用异常处理机制的问题。
  - 其他语言中大多使用`try-catch`来处理异常，这会使得代码变得复杂，且控制流不清晰。

### 闭包
闭包是一个函数，可以捕获其所在环境中的变量。在rust中有三种闭包Trait：
- `Fn`：不可变借用闭包，捕获变量的不可变引用。
- `FnMut`：可变借用闭包，捕获变量的可变引用。
- `FnOnce`：获取所有权闭包，捕获变量的所有权。只能调用一次，因为所有权已经转移。

闭包的语法非常简洁，可以使用`|x| x + 1`来表示一个闭包，捕获变量的方式也很灵活，可以使用`move`关键字来获取变量的所有权。
- `let add = |x| x + 1;`：一个简单的闭包，捕获变量x的不可变引用。
- `let add = |x: i32| -> i32 { x + 1 };`：一个带参数和返回值类型的闭包。
- `let add = move |x| x + 1;`：一个获取所有权的闭包，捕获变量x的所有权。

单个闭包并不一定仅实现单个Trait：
- 所有的闭包都自动实现了 FnOnce 特征，因此任何一个闭包都至少可以被调用一次
- 没有移出所捕获变量的所有权的闭包自动实现了 FnMut 特征
- 不需要对捕获变量进行改变的闭包自动实现了 Fn 特征

## 专业阶段 - rCore

rCore是一个较为传统的操作系统的rust简易实现。八个章节分别实现了操作系统的基本功能，包括批处理、分时、虚存管理、进程管理、文件系统、进程间通信、并发等。
### Ch1. 基本实现

这一部分讲解了如何移除rust的标准库并构建一个裸机程序。

#### 有趣的宏
- 使用`#![no_std]`来移除标准库。
- 使用`#![no_main]`来移除main函数。
- 使用`#[no_mangle]`来移除函数名的修饰。
- 使用`#[macro_use]`来引入宏。
- 使用`#[inline(always)]`来强制内联函数。
- 使用`#[global_asm]`来引入汇编代码。
- 使用`#[panic_handler]`来处理panic。

#### 链接脚本

此外链接脚本`linker.ld`也很重要，主要是定义了内存布局和入口函数，并且定义了若干个符号：`skernel`、`stext`、`etext`、`srodata`、`erodata`、`sdata`、`edata`、`sbss`、`ebss`、`ekernel`，这些符号在rust中可以使用`extern "C"`来引用。

```rust
/* 使用extern "C"声明的函数导入了由链接器提供的外部符号。
这些函数本质上只是一个地址，所以通过`as usize`可以直接获取地址的值。
通过这种方式获取各段的起始地址和结束地址，避免了麻烦的指针解引用操作。
 */
extern "C" {
    fn stext(); // begin addr of text segment
    fn etext(); // end addr of text segment
    fn srodata(); // start addr of Read-Only data segment
    fn erodata(); // end addr of Read-Only data ssegment
    fn sdata(); // start addr of data segment
    fn edata(); // end addr of data segment
    fn sbss(); // start addr of BSS segment
    fn ebss(); // end addr of BSS segment
    fn boot_stack_lower_bound(); // stack lower bound
    fn boot_stack_top(); // stack top
}
```

以此，可以轻松地清空.bss段：
```rust
(sbss as usize..ebss as usize).for_each(|a| unsafe { (a as *mut u8).write_volatile(0) });
```
#### 入口函数
```assembly
    .section .text.entry
    .globl _start
_start:
    la sp, boot_stack_top
    call rust_main

    .section .bss.stack
    .globl boot_stack_lower_bound
boot_stack_lower_bound:
    .space 4096 * 16
    .globl boot_stack_top
boot_stack_top:
```
在链接脚本中定义了一个`_start`函数作为入口函数，使用`la sp, boot_stack_top`来设置栈顶指针，然后调用`rust_main`函数。
#### sbi调用
rCore使用了SBI（Supervisor Binary Interface）来与硬件进行交互，使用`ecall`指令来进行系统调用。

```rust
// 先将对应的参数放入寄存器，再调用li x16, 0; ecall，最终将x10的值保存到ret中
asm!(
    "li x16, 0",
    "ecall",
    inlateout("x10") arg0 => ret,
    in("x11") arg1,
    in("x12") arg2,
    in("x17") which,
);
/* 实际上类似于于：
asm!(
    "ecall",
    inout("x10") arg0 => ret,
    in("x11") arg1,
    in("x12") arg2,
    in("x16") 0,
    in("x17") which,
);
li x16, 0的作用其实也就是将x16寄存器清零，本身只是ecall指令预先传参罢了，和其他的inout/in/没有什么区别
*/
```
### Ch2. 批处理
这一部分引入了应用程序，预先在`link_app.S`中定义好各APP的起始、结束地址，并引入bin文件。

此外，为了处理系统调用，需要实现特权级切换与上下文保存。

在Trap触发的一瞬间，换栈到内核栈，用户栈和内核栈通过`sscratch`寄存器进行切换。保存当前的上下文，然后切换到`trap_handler`函数中进行处理。

处理完毕后，进入`__restore`函数，恢复上下文，切换回用户栈，返回到用户态。

再者，当切换APP时，系统会构造一个新的上下文，直接调用`__restore`函数，恢复上下文，切换到新的APP中。

### Ch3. 分时
这一部分实现了分时调度。
使用`timer`来实现定时器中断，定时器中断会触发Trap。

此外，为了实现任务切换，也需要保存部分上下文。根据RISC-V规范，`s0-s11`寄存器是需要保存的，`a0-a7`寄存器是函数参数寄存器，`t0-t6`寄存器是临时寄存器，不需要保存。

这就是`__switch`函数的作用，然后在`__restore`函数中恢复上下文。

本次练习要求实现`sys_trace`系统调用，没什么难度，对于每个TCB维护信息即可。

### Ch4. 虚存管理
这一部分实现了虚拟内存管理，经典的段页式管理。
使用`satp`寄存器来设置页表基地址，使用`sfence.vma`指令来刷新TLB。

值得注意的是“跳板”的实现。

由于rCore的地址空间设计是全隔离的（即全部交由应用本身使用，内核不保留地址），在地址切换时会出现问题。

通过跳板页，在不同的地址空间内使用同一段虚拟地址来访问同一段物理地址，来实现上下文切换。

本次的练习要求实现`mmap`,`munmap`系统调用，并重写`sys_get_time`和`sys_trace`系统调用。

难点在于`sys_get_time`的实现，由于`TimeVal`结构体可能跨页，所以需要使用`copy_from_user`函数来进行帧址转换+拷贝。

### Ch5. 进程管理

本次练习要求迁移之前的系统调用，并且实现`sys_spawn`系统调用与stride调度算法。

无难点。

### Ch6. 文件系统

练习要求实现硬链接linkat，取消硬链接unlinkat，文件状态获取fstat。

这部分偏向工程实现，需要注意的细节很多。
```rust
    /// Link file
    pub fn link_to(&self, source: &str, target: &str) -> bool{
        if source == target {
            return false;
        }
        log::debug!("linking {} to {}", source, target);
        let real_inode = self.find(source);
        if real_inode.is_none() {
            return false;
        }
        let real_inode = real_inode.unwrap();
        log::debug!("got real inode");
        let inode_id = real_inode.get_inode_id();
        log::debug!("got real inode id");
        real_inode.increase_link();
        log::debug!("increase_link");
        let mut fs = self.fs.lock();
        self.modify_disk_inode(|disk_inode| {
            // assert it is a directory
            assert!(disk_inode.is_dir());
            // append file in the dirent
            let file_count = (disk_inode.size as usize) / DIRENT_SZ;
            let new_size = (file_count + 1) * DIRENT_SZ;
            // increase size
            self.increase_size(new_size as u32, disk_inode, &mut fs);
            // write dirent
            let dirent = DirEntry::new(target, inode_id);
            disk_inode.write_at(
                file_count * DIRENT_SZ,
                dirent.as_bytes(),
                &self.block_device,
            );
        });
        true
    }
    /// Unlink file
    pub fn unlink_at(&self, path: &str) -> bool {
        log::debug!("unlinking {}", path);
        let real_inode = self.find(path);
        if real_inode.is_none() {
            return false;
        }
        let real_inode = real_inode.unwrap();
        log::debug!("got real inode");
        let mut found = false;
        let fs = self.fs.lock();
        // 修改目录项
        self.modify_disk_inode(|dir_inode| {
            // assert it is a directory
            assert!(dir_inode.is_dir());
            let file_count = (dir_inode.size as usize) / DIRENT_SZ;
            let mut remains = Vec::new();
            let mut dirent = DirEntry::empty();
            for i in 0..file_count {
                assert_eq!(
                    dir_inode.read_at(i * DIRENT_SZ, dirent.as_bytes_mut(), &self.block_device,),
                    DIRENT_SZ,
                );
                if dirent.name() != path {
                    remains.push(dirent);
                } else {
                    found = true;
                }
            }
            if found {
                dir_inode.size = (remains.len() * DIRENT_SZ) as u32;
                for (i, entry) in remains.iter().enumerate() {
                    dir_inode.write_at(i * DIRENT_SZ, entry.as_bytes(), &self.block_device);
                }
            }
        });
        log::debug!("modified dir_inode");
        if !found {
            return false;
        }
        drop(fs);
        log::debug!("found file");
        real_inode.decrease_link();
        log::debug!("decrease_link");
        if real_inode.get_link_count() == 0 {
            log::debug!("deallocating inode");
            real_inode.clear();
        }
        true
    }
```

### Ch8. 并发
最后一部分练习要求实现并发死锁检测，可以算是某种“伪银行家算法”。

令Mutex和Semaphore实现`Detectable` trait，使用`detect`函数来检测死锁。

```rust
/// Detectable trait
/// 
/// This trait is used to detect the deadlock of the system
pub trait Detectable {
    /// Get the available resource count
    fn get_avaliable(&self) -> usize;

    /// Get the owner of the allocated resource
    fn get_allocated(&self) -> Option<Vec<usize>>;

    /// Get the requester of the resource
    fn get_needed(&self) -> Option<Vec<usize>>; 

}
```

```rust
pub fn detect(detectables: Vec<Arc<dyn Detectable>>, num_task: usize, mut adjust: impl FnMut(&mut Vec<usize>, &mut Vec<Vec<usize>>, &mut Vec<Vec<usize>>) -> ()) -> bool
{
    debug!("kernel: detect deadlock");
    let num_resource = detectables.len();
    if num_resource == 0 { // 如果没有可检测的对象，直接true，即可用
        return true;
    }
    let mut available = vec![0; num_resource]; // 可用资源向量
    let mut allocated = vec![vec![0; num_resource]; num_task]; // 资源分配矩阵
    let mut needed = vec![vec![0; num_resource]; num_task]; // 资源需求矩阵
    for (did, detectable) in detectables.iter().enumerate() {
        available[did] = detectable.get_avaliable(); // 可用资源
        if let Some(allocated_list) = detectable.get_allocated() {
            for i in 0..allocated_list.len() {
                allocated[allocated_list[i]][did] += 1;
            }
        }
        if let Some(needed_list) = detectable.get_needed() {
            for i in 0..needed_list.len() {
                needed[needed_list[i]][did] += 1;
            }
        }
    }
    // 修正资源分配矩阵和需求矩阵(当前申请的资源需求数需要+1)
    adjust(&mut available, &mut allocated, &mut needed);
    // 调用伪银行家算法检测死锁
    !pseudo_bankers_algorithm(&mut available, &mut allocated, &mut needed)
}
```
(伪)银行家算法, 用于检测死锁。
```rust
fn pseudo_bankers_algorithm(
    available: &mut Vec<usize>,
    allocated: &mut Vec<Vec<usize>>,
    needed: &mut Vec<Vec<usize>>,
) -> bool {
    let num_resource = available.len();
    let num_task = allocated.len();
    let mut finish = vec![false; num_task];
    let mut work = available.clone();
    loop {
        let mut found = false;
        for i in 0..num_task {
            if !finish[i] && needed[i].iter().zip(work.iter()).all(|(n, w)| n <= w) {
                debug!("[bankers algorithm] task {} can finish", i);
                for j in 0..num_resource {
                    work[j] += allocated[i][j];
                }
                debug!("[bankers algorithm] now, work: {:?}", work);
                finish[i] = true;
                found = true;
            }
        }
        if !found {
            break;
        }
    }
    debug!("[bankers algorithm] finish: {:?}", finish);
    finish.iter().all(|&f| f)
}
```

## 项目基础阶段 - arceOS

相比rCore，arceOS使用了较多的现代化设计理念，以组件化的形式对操作系统的功能进行划分、解耦；使用UniKernel简化特权级切换提高性能...

自然地，arceOS的学习曲线也更陡峭一些。组件的拆分使得我们更难去在全局上把握系统的运行逻辑。

### ex1: [print_with_color]: 支持带颜色的打印输出
使用了ANSI转义序列来实现即可。
```rust
#[macro_export]
macro_rules! print {
    ($($arg:tt)*) => {
        $crate::io::__print_impl(format_args!("\x1b[34m{}\x1b[0m", format_args!($($arg)*)));
    }
}
```

### ex2: [support_hashmap]: 支持HashMap类型

斐波那契散列+链地址法，怎么简单怎么来。
```rust
const FIBONACCI_MAGIC: u64 = 1_140_071_481_932_319_848;

#[derive(Clone, Copy, Default, Hash)]
pub struct FibonacciHash(u64);

impl Hasher for FibonacciHash {
    fn finish(&self) -> u64 {
        self.0
    }

    fn write(&mut self, bytes: &[u8]) {
        for byte in bytes {
            self.0 = FIBONACCI_MAGIC.wrapping_mul(self.0).wrapping_add(*byte as u64);
        }
    }
}
```

值得一提的是，实现ex2后ex1会报错，这是因为使用了堆分配的Vector。需要加入大量的`#[cfg(feature = "alloc")]`来进行条件编译。

### ex3: [alt_alloc]: 为内存分配器实现新的内存算法bump

根据描述简易实现即可。

### ex4: [ramfs_rename]: 为文件系统增加重命名

该API存在问题，当前限制下仅支持同挂载点下的文件重命名。

文件重命名在`VfsNodeOps`中调用，代码如下：
```rust
fn rename(&self, src_path: &str, dst_path: &str) -> VfsResult {
    self.lookup_mounted_fs(src_path, |fs, rest_path| {
        if rest_path.is_empty() {
            ax_err!(PermissionDenied) // cannot rename mount points
        } else {
            fs.root_dir().rename(rest_path, dst_path)
        }
    })
}
```

可见调用了源文件挂载点根目录`VfsNodeOps`的`rename`函数，src为去除挂载点后的路径，dst为完整路径。于是存在问题，当前`VfsNodeOps`下不一定包括`dst`的信息。

但是测例中因为是同一文件夹下重命名，所以不会出现问题。

### ex5: [sys_mmap]: 实现mmap系统调用

根据Linux POSIX标准实现。
```rust
fn sys_mmap(
    addr: *mut usize,
    length: usize,
    prot: i32,
    _flags: i32,
    fd: i32,
    _offset: isize,
) -> isize {
    let curr = current();
    let mut uspace = curr.task_ext().aspace.lock();
    
    // 在当前进程的虚拟地址空间中，寻找一段空闲的满足要求的连续的虚拟地址
    // 如果 addr 为 NULL，则内核选择（页面对齐）创建映射的地址;这是最便携的创建新映射的方法。
    // 如果 addr 不是 NULL，则 kernel 将其视为放置 Map 位置的提示;
    // 在Linux，内核会选择附近的页面边界（但总是 大于或等于 /proc/sys/vm/mmap_min_addr）并尝试创建映射。
    // 如果那里已经存在另一个映射，则内核会选择 一个可能取决于也可能不取决于 hint 的新地址。
    let start = VirtAddr::from_usize(addr as usize + 0x10_0000).align_down_4k();
    let size = length.align_up_4k();
    let Some(vaddr) = uspace.find_free_area(start, size, 
        VirtAddrRange::from_start_size(uspace.base(), uspace.size())
    ) else {
        ax_println!("mmap: no free area");
        return -LinuxError::ENOMEM.code() as _;
    };

    ax_println!("expected addr: 0x{:x}, size: {}", addr as usize, length);
    ax_println!("got addr: 0x{:x}, size: {}", vaddr.as_usize(), size);

    // 分配内存空间
    let prot = MmapProt::from_bits_truncate(prot);
    if let Err(e) = uspace.map_alloc(vaddr, size, prot.into(), true) {
        ax_println!("mmap: map memory failed: {}", e);
        return -LinuxError::ENOMEM.code() as _;
    };

    // 读取文件内容到缓冲区
    let mut buf = vec![0; length];
    let Ok(file) = get_file_like(fd) else {
        ax_println!("mmap: invalid file descriptor");
        return -LinuxError::EBADF.code() as _;
    };
    if let Err(e) = file.read(&mut buf) {
        ax_println!("mmap: read file failed: {}", e);
        return -LinuxError::EIO.code() as _;
    };

    // 将缓冲区内容写入到内存区域
    if let Err(e) = uspace.write(vaddr, &buf) {
        ax_println!("mmap: write memory failed: {}", e);
        return -LinuxError::EIO.code() as _;
    };

    ax_println!("mmap: write memory success");

    vaddr.as_usize() as isize
}
```
### ex6: [simple_hv]: 实现最简单的Hypervisor，响应VM_EXIT常见情况

根据描述设置GPR和SEPC即可。