---
title: arceos-summary-Blankke
date: 2025-11-02 15:05:13
categories: 
    - handnote 
tags:
    - author: Blankke
    - repo : https://github.com/LearningOS/2025a-arceos-Blankke
    - email: 1169809321@qq.com

---
<!-- more -->

# 学习总结 - Blankke
rcore与arceOS可以理解成两种不同思路编写而来的内核，而内核基本原理上估计是不会有太大区别的。
抱着这样的想法，三阶段只给了3周的时间，我就直接上了。
因为内核赛的时候基本上是整个内核都写了一遍，除了文件系统是调ext4库了没有太管里面怎么实现的，其他的原理明白了做起来还是挺快的。
我不知道有什么荣誉准则要求，这话说起来其实挺不好的，但是我的准则是不管copy还是llm生成，只要我觉得下一次遇到一样的问题我能一眼看出来用这个方法解决，那我就觉得这个学习是有效的。
所以这次的arceOS学习我也是抱着这样的态度去做的，并且内核的学习实际上最重要的部分可能更是在于解决问题，也就是在针对特定问题的排查思路上。
# rcore
rcore部分我本身没有记录很多，只记了一些学习rust的时候的笔记，毕竟rcore的代码量实在是太大了，想要全部理解需要花费大量时间。然后在完成练习的时候我还不知道要写blog，所以只有一点点感悟和笔记。
## ch3
### 为什么在 TaskManager 中添加方法而不是直接返回 TaskControlBlock
这确实是 Rust 所有权系统的限制，与 C++ 有本质区别：
**Rust 所有权问题：**
```rust
// 这样的设计在 Rust 中是不可能的：
pub fn get_current_task_mut(&self) -> &mut TaskControlBlock {
    let mut inner = self.inner.exclusive_access();
    let current = inner.current_task;
    &mut inner.tasks[current]  // ❌ 编译错误！
}
```
- inner 是一个临时变量，当函数返回时会被销毁
- 返回的 `&mut TaskControlBlock` 引用了inner的内容
- Rust 编译器检测到"悬垂引用"（dangling reference）问题
**C++ vs Rust**
```cpp
// C++ 可以这样做（自己管理）
TaskControlBlock& TaskManager::getCurrentTask() {
    auto lock = inner.lock();
    return tasks[current_task];  // 返回引用，但锁可能已释放
}
```
```rust
// Rust 强制我们使用更安全的封装方法
impl TaskManager {
    pub fn increment_current_syscall_count(&self, syscall_id: usize) {
        let mut inner = self.inner.exclusive_access();  // 获取锁
        let current = inner.current_task;
        inner.tasks[current].increment_syscall_count(syscall_id);
        // 锁在这里自动释放
    }
}
```

### Clone trait 和 new 方法的关系
- **Copy**：浅拷贝，按位复制，用于简单类型（如整数）
- **Clone**：深拷贝，可能涉及堆内存分配，用于复杂类型
但添加 Vec<(usize, usize)> 后：
```rust
pub struct TaskControlBlock {
    pub syscall_counts: Vec<(usize, usize)>,  // Vec 不能实现 Copy
}
let vec1 = vec![1, 2, 3];  // 在堆上分配内存
let vec2 = vec1;           // 如果是 Copy，会有两个指针指向同一块内存
// 当 vec1 和 vec2 都被销毁时，会导致 double free！
```
原来的初始化方式不再适用：
```rust
// 旧代码 - 数组字面量初始化
let tasks = [TaskControlBlock {
    task_cx: TaskContext::zero_init(),
    task_status: TaskStatus::UnInit,
}; MAX_APP_NUM];  // ❌ 需要 Copy trait
```
新的初始化方式：
```rust
// 新代码 - 使用 core::array::from_fn
let tasks: [TaskControlBlock; MAX_APP_NUM] = core::array::from_fn(|_| {
    TaskControlBlock::new(TaskContext::zero_init(), TaskStatus::UnInit)
});
```

## ch4
主要新建的函数有
```rust
/// Translate a user pointer to a mutable reference
pub fn translate_user_ptr<T>(ptr: *mut T) -> Option<&'static mut T> {
    TASK_MANAGER.translate_user_ptr(ptr)
}

/// Translate a user pointer to a reference
pub fn translate_user_ptr_readonly<T>(ptr: *const T) -> Option<&'static T> {
    TASK_MANAGER.translate_user_ptr_readonly(ptr)
}

```
内部使用页表进行翻译，获得的（可变）引用可以用unsafe的类指针操作直接修改内存。
mmap的实现与cpp的方法无异，只是对应的层级是task层，由taskmanager调用获取当前的task，当前的task使用mmap，所以mmap是task的类方法。


# ArceOS
## Unikernel
### T1 print-with-color
这个看了一下，可以在log层打印，也可以直接改std。
```bash
arch = riscv64
platform = riscv64-qemu-virt
target = riscv64gc-unknown-none-elf
smp = 1
build_mode = release
log_level = warn
```
像这种信息就是在log层里打出来的，如果修改axlog模块的lib.rs，那么这些打印信息就会变色
```rust
/// axlog/lib.rs
/// Prints to the console, with a newline.
#[macro_export]
macro_rules! ax_println {
    () => { $crate::ax_print!("\n") };
    ($($arg:tt)*) => {
        $crate::__print_impl($crate::with_color!(
            $crate::ColorCode::BrightGreen,
            "{}\n",
            format_args!($($arg)*)
        ));
    }
}
```
但是根据题目要求，我们打印的那句话其实是axstd里面的，所以我其实只在这个macro.rs里添加了色号就可以了。
```rust
/// Prints to the standard output, with a newline.
#[macro_export]
macro_rules! println {
    () => { $crate::print!("\n") };
    ($($arg:tt)*) => {
        $crate::io::__print_impl(format_args!("\u{1B}[92m{}\u{1B}[m\n", format_args!($($arg)*)));
    }
}

```
这是绿色
### T2 support-hashmap
在axstd等组件中，支持collections::HashMap
先读了一下axstd，原本的情况是这样的
```rust
pub use alloc::{boxed, collections, format, string, vec};
```
这里有一个collections，是从alloc模块过来的，那么实际上是标准库里的（我认为就是内核环境不支持标准库的哈希表），所以要替换成一个自己实现的HashMap。
上网查了一下hashbrown是一个常用的哈希表实现(hashbrown n. 薯饼)，所以添加了依赖，用这现成的模块。
```toml
axhal = { workspace = true }
hashbrown = { version = "0.14", default-features = false }
```
接下来就是在axstd/src里面添加一个collection.rs然后将对应使用过的函数都用hashbrown进行对应实现就可以了。注意new()一定需要有对应的实现否则报错找不到。
### T3 bump-allocator
这个很简单。
当时内核赛的时候瞎装了一万个分配器到自己的内核中，经过痛苦的阅读代码后了解过buddy、slab、liballocator的分配原理，这个bump分配器简单看一下原理似乎是堆分配器。然后需要实现页分配以及细粒度的字节分配，也就是多层级的分配。那就跟linux的slab&buddy的做法差不多了。
代码中todo写的很明确，每一步需要干什么，不会漏掉隐秘的细节，不像当初写内核一样自己出一堆找不到的bug在后面回来找。
### T4 rename-for-ramfs
ramfs就是一个最基础的文件系统，不需要回写，不需要驱动，基本上意思就是在内存里进行书写，关机后不会存下来，这个rename也不会再下次开机后保存下来。
学习正常的rename，以前从没看过底层的inode操作，都是直接调用`ext_rename()`就完工了，所以这次对照着加抄袭整了个版本。
明确这个操作是在ramfs模块下的就简单了，这是个结点操作，所以要在两个地方添加操作（这是我的做法），一个是impl VfsNodeOps for DirNode，一个是DirNode内部。
```rust
    /// Renames a node from `src_name` to `dst_name` in this directory.
    pub fn rename_node(&self, src_name: &str, dst_name: &str) -> VfsResult {
        let mut children = self.children.write();

        let node = children.get(src_name).ok_or(VfsError::NotFound)?.clone();

        if children.contains_key(dst_name) {
            return Err(VfsError::AlreadyExists);
        }
        
        // Remove from old name and insert with new name
        children.remove(src_name);
        children.insert(dst_name.into(), node);
        
        Ok(())
    }
```
在    `fn rename(&self, src_path: &str, dst_path: &str) -> VfsResult {`中可以照着别的函数写法形成模板，最后一步调用上面的rename就好了
## Macro
宏内核部分比较熟悉也简单，就略写了。
### T1 Page-fault
这也是老朋友了，这个提示很明显，在axhal/trap里面，很多异常的处理方法都写在其中了。
### T2 mmap
这更是老朋友，xv6就做过这个实验，rcore也是有。根据posix标准从堆内存找到空闲位置，扩大堆空间。
这里评测环境错误很久没过差点以为是我的问题，所以自己添加了一个`get_brk()`函数，结果又在本地爆了，这个实验似乎就是让我们使用`find_free_area`就可以了，并没有按照posix标准去处理那么多flag，也没有匿名映射。
后面所以我又改成了最简单的版本
```rust
        let start_addr = if addr.is_null() {
            // Use find_free_area to find a suitable address
            let hint = VirtAddr::from(0x10000000usize);
            let limit = VirtAddrRange::from_start_size(aspace.base(), aspace.size());
            aspace.find_free_area(hint, aligned_length, limit)
                .ok_or(LinuxError::ENOMEM)?
        } else {
            VirtAddr::from(addr as usize)
        };
        
        // Map memory in user address space
        aspace.map_alloc(start_addr, aligned_length, mapping_flags, true)
            .map_err(|_| LinuxError::ENOMEM)?;
```
这属于有点ltp后遗症，写了linux的标准错误号。然后后面其实也处理了fd是-1且不是MAP_ANONYMOUS的情况。
## Hypervisor
这个虚拟化有点超纲了，以前确实没见过这种虚拟机的做法。我想理解成用户进程，这样的话自己有一个cpu对象，用户进程的地址空间也是连续的，但是在内核中不连续。

### T1 simple-hv
这个有两个退出原因（据悉是这样）：
 IllegalInstruction (非法指令异常)和 LoadGuestPageFault (Guest 页面错误)，需要在vm_exit的时候判断这几次错误并处理。实际上操作的方法有点像写cpu，直接对epc等寄存器进行+4这样。这个错误原因估计还要下到trap模块才能判断，就是csr寄存器里会记录错误原因。
为了调试这几种原因，我先添了几句调试输出，没想到其实本来它的打印就是有输出的。
可以读到代码中期望的输出就是这两个寄存器要放正确的值，而这之前就不要有vmexit
```rust
                        let a0 = ctx.guest_regs.gprs.reg(A0);
                        let a1 = ctx.guest_regs.gprs.reg(A1);
                        ax_println!("a0 = {:#x}, a1 = {:#x}", a0, a1);
                        assert_eq!(a0, 0x6688);
                        assert_eq!(a1, 0x1234);
                        ax_println!("Shutdown vm normally!");
                        ctx.guest_regs.sepc += 4;
                        return true;
```
所以就在对应的错误处理处改0x6688和0x1234就可以，对应指令sepc+4跳过

### T2 pflash
从上面为止练习题其实就做完了。说来非常惭愧，我参加训练营有点面向做题的学习，从rcore开始都是学习的目标就是做完所有练习题就收工了，觉得解决问题才是做这个训练营的精华。这个练习也是个示例，不用我做自己就是好的。所以后面学起来有点没有动力。
分析了一下运行指令，其实是先编译了u_3_0的内核，然后把内核的bin文件写进了disk.img里，最后make一个虚拟机出来。运行之后里面也是显示了两次ArceOS（虚拟机里运行了内核），然后从guest里面试图去读host
很好看的一点是在make u_3_0的时候直接编译，而运行虚拟机h_2_0的时候可以把log开成info，这样的话就可以看到那句 Starting virtualization...，以及是如何装载虚拟机到虚拟地址的。
内核赛的时候很惊讶，因为听说第一名的Starry Mix可以在里面运行xv6，让我直接震惊了。后面了解到StarryOS就是在arceOS基础上改的，现在我才知道原来就是基于了这样的Hypervisor模式，真的长知识了。
