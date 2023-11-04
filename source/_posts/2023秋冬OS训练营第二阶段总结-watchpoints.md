---
title: 2023秋冬OS训练营第二阶段总结-watchpoints
date: 2023-11-04 14:15:53
categories:
	- report
tags:
  - author: watchpoints
  - repo: https://github.com/LearningOS/2023a-rcore-watchpoints
---

## 写在前面

作为上班族，每天下班很晚了，本来没有多余时间，并且之前没有接触过Rust

看到 从零开始用 **Rust** 语言写一个基于 **RISC-V** 架构的 类 Unix 内核这样标题 

直接打退堂鼓。

> 转你一想 这就是自己本来期望形式，参与开源方向，操作系统 作为软件工程师 基本功，不管结果如何必须参与。



## 一阶段总结

- 选择看什么资料，根据看c++经验，一定选择英文原版 代替看中文翻译，很多翻译遗漏很多信息。我直接选择 rustlings-100exercises README.md 

- 因为时间有限，没有采取全部看完book，然后做题，

  采取看一章节，做题 顺序

  https://github.com/LearningOS/rustlings-100exercises-template/blob/main/exercises/README.md 

  rustlings 设计 很合理 提供  README和章节练习。为我节省大量时间

-  选择在线开发环境

  群里分享了：rustlings流程web版.pdf 然后5分钟搭建好了环境，更适合上班 环境 和家里环境随时切换。

- 遇到不懂怎么办？
  
  学习Rust出现新名词 ：借用  让你莫不这头脑，我没有从概念理解 这些概念，
  
  并按照文字提示 翻译
  
  用c++设计进行类比：常量指针，指针常量， 类 深度拷贝 移动构造 ，move语义
  
  拷贝构造，还有STL 
  
  
  
  ### 小结：
  
  为了节省时间，我采用云环境（5分钟搭建完成）
  
  做题顺序按照README.md 推荐方式  README对我帮助很大
  
  

## 二阶段总结

###  ch1 & ch2

- 存在问题：

一个hello，world 例子是怎么运行的,代码从编译到产生可执行程序，然后加载到内存，程序入口是哪里 尤其是linker.ld entry.asm这2个文件。

尤其汇报指令。需要加强。之前看程序自我修养，

还有csapp 感觉看懂到，现在看来根本不懂，用了不少时间。

尤其看到别人满分了，担心着急，我还没真正投入开始呢。

- 解决方式：

为了方便反复运行程序 我搭建vmare+本地环境。

rcore提供框架，让这些知识变成例子，

最后不依赖系统库运行在起来。这个演示例子非常好。

### 小结 ：hello，world 例子

1. 项目中 每个模块都个mod.rs文件 ，这一般是模块提供对提供功能。

2. 程序入口地址




## chapter3 练习

题目要求：

ch3 中，我们的系统已经能够支持多个任务分时轮流运行，我们希望引入一个新的系统调用 `sys_task_info` 以获取当前任务的信息，定义如下：

```rust
fn sys_task_info(ti: *mut TaskInfo) -> isize
```



#### 思路

1. 从单元测试  ch3_taskinfo.rs 了解到 ，直接创建了task，该task 可能执行很多系统调用系统调用最终都是通过 sys_call 进行，在该函数增加 add_syscall_count。

2. 数据结构：TaskManagerInner 记录了正在运行的任务 current_task 和任务列表tasks，全局变量 只有一个。

3. main.rs 函数启动时候  加载任务 并且运行第一任务

    loader::load_apps();

   task::run_first_task();

   

#### 小结：系统调用

ch1 和ch2 是ch3 基础，下面这段代码 需要后面花费更多时间学习

~~~
pub fn rust_main() -> ! {
    clear_bss();
    kernel_log_info();
    heap_alloc::init_heap();
    trap::init();
    loader::load_apps();
    trap::enable_timer_interrupt();
    timer::set_next_trigger();
    task::run_first_task();
    panic!("Unreachable in rust_main!");
}

~~~

## chapter4练习

### 实验要求

### 重写 sys_get_time 和 sys_task_info

引入虚存机制后，原来内核的 sys_get_time 和 sys_task_info 函数实现就无效了。请你重写这个函数，恢复其正常功能。

### mmap 和 munmap 匿名映射

[mmap](https://man7.org/linux/man-pages/man2/mmap.2.html) 在 Linux 中主要用于在内存中映射文件， 本次实验简化它的功能，仅用于申请内存。

请实现 mmap 和 munmap 系统调用，mmap 定义如下：

### 思路：地址空间



1. 为什么 重写 sys_get_time 和 sys_task_info ？这从地址空间说起，原文：

   **内核如何访问应用的数据？**

   应用应该不能直接访问内核的数据，但内核可以访问应用的数据，这是如何做的？由于内核要管理应用，所以它负责构建自身和其他应用的多级页表。如果内核获得了一个应用数据的虚地址，内核就可以通过查询应用的页表来把应用的虚地址转换为物理地址，内核直接访问这个地址

   ~~~rust
    let info = TaskInfo::new();  //info 这用户空间地址
    assert_eq!(0, task_info(&info));//经过系统调用后，用户空间地址
   //传递到内核空间，用户空间虚拟地址 对内核来说无法直接使用，需要转化
   ~~~

2. 疑惑地方：我看懂这个数据结构**页表项** (PTE, Page Table Entry)  是一个整数）

   里面包含了一个物理页号 + 标志位

   ~~~rust
   /// 一个物理页号 PhysPageNum 和一个页表项标志位 PTEFlags 生成一个页表项 
       pub fn new(ppn: PhysPageNum, flags: PTEFlags) -> Self {
           PageTableEntry {
               bits: ppn.0 << 10 | flags.bits as usize,
               // 最低的 8 位 [7:0] 则是标志位。
               //其中 [53:10] 这 44 位是物理页号
               // SV39 分页模式下的页表项，其中 这 位是物理页号，最低的 位 则是标志位
           }
       }
   ~~~



虚拟页号 同样也是整数，虚拟页号 和 物理页号对应起来？

经过群里讨论 和看资料，初步理解 虚拟页号当作索引，页表项是数组内容建立关系，这句话初步帮助理解。不代表真实现。



另外一个结构：PageTable

a 通过虚拟页号找到页表项(里面又物理页号)

~~~rust
/// Find PageTableEntry by VirtPageNum
/// 通过虚拟页号找到页表项(里面又物理页号)
fn find_pte(&self, vpn: VirtPageNum) -> Option<&mut PageTableEntry> 
let idxs = vpn.indexes();
https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter4/4sv39-implementation-2.html
VirtPageNum 的 indexes 可以取出虚拟页号的三级页索引，并按照从高到低的顺序返回

~~~

b 函数：translated_byte_buffer 为参考例子实现了

实现来了 从虚拟地址转化成物理地址



3  map 和 unmap 虚拟地址是一个连续内存，其中一个虚拟地址转化成物理地址，

多个虚拟地址转转化思路很清楚了，具体实现：MemorySet 新增map_range函数

这里对map封装

~~~rust
pub fn map(&mut self, page_table: &mut PageTable) {
        for vpn in self.vpn_range {
            self.map_one(page_table, vpn);
        }
    }
~~~

## 小结

最后通过下面函数封装完成ch4。

- PageTable  find_pte 

- MemorySet  map_one  unmap_one

  不然无法实现，里面细节不少。

  

## chapter5 练习

实现分支：ch5-lab

实验目录要求不变

通过所有测例

### 思路

1. 为什么重新实现 sys_task_info sys_mmap函数？

   - 引入处理器管理结构 Processor 负责从任务管理器 TaskManager 中分出去的维护 CPU 状态的职责

   - 这里注意 语法细节

       ~~~rust
       ///Get current task in moving semanteme
        pub fn take_current(&mut self) -> Option<Arc<TaskControlBlock>> {
               self.current.take()
        }
       ///Get current task in cloning semanteme
        pub fn current(&self) -> Option<Arc<TaskControlBlock>> {
               self.current.as_ref().map(Arc::clone)
       }
       ~~~

2.  sys_spawn  

~~~rust
//功能：新建子进程，使其执行目标程序。
// "ch5b_user_shell\0"
pub fn sys_spawn(_path: *const u8) -> isize 
~~~

- 细节：参考 初始进程initproc的创建 【里面有很多知识点】

  ~~~rust
  TaskControlBlock::new(get_app_data_by_name("initproc").unwrap())
  https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter5/3implement-process-mechanism.html
  
  ~~~

- 细节：参考  fn sys_exec(path: *const u8)  对_path处理 需要地址转化。

- 细节：父子进程关系设定。 parent: Option<Weak<TaskControlBlock>>

  weak指针类型

  

3.  进程优先级 

    每次需要调度时，从当前 runnable 态的进程中选择 stride 最小的进程调度 

   改写fetch函数，修改当前任务的stride 使用take 还是as_ref。

   

   

   ### 小总:进程

   - 这一章节完全是Rust语法细节 引用，借用 ，weak智能指针（避免循环引用）

   - 例如 "ch5b_user_shell\0" 后面执行过程不很清楚，我更加深入学习load实现。

     

### 未完待续
