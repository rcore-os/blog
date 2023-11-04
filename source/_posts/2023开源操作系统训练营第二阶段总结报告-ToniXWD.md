---
title: 2023开源操作系统训练营第二阶段总结报告-ToniXWD
date: 2023-11-04 03:31:08
tags:
---
# 1 整体总结
在完成`Rustlings`后，终于能亲自上手把玩操作系统了。rCore的每一个`branch`实际上可以看做是对一个初具框架项目的不断更新和迭代。`ch1`是在裸机上部署一个`hello world`, `ch2`是引入了特权级, `ch3`实现分时多任务系统, `ch4`引入了虚拟内存和页表, `ch5`引入了进程的概念并提供了相关系统调用和调度算法支持, `ch6`添加了简易文件系统, `ch7`添加了管道这一古老的`ipc`方法, `ch8`引入了线程的概念并加入了与线程同步相关的资源:锁, 信号量和条件变量。

这样的渐进式布置, 有助于理解操作系统设计的思路，对于我个人而言， 前2章将用户程序链接到内核反而是最困难的，也是平时学习中不容易注意到的知识点。

`lab`的难度整体上不算太高, 但需要注意细节, 另外兼容前一个章节的代码确实会带来一些压力, 比如`lab5`时, 我卡住了很久, 最后才发现需要重新实现`sys_get_time`, 希望老师们能在以后的课程中考虑到这个问题

# 2 lab 通关记录
## 2.1 ch0-环境配置
按照指导书进行环境配置对于基础的代码运行是没有问题，但我发现自己按照指导书操作后无法进行`gdb`调试, 经过总结后在此处给出我的2种解决方案:
### 方案1: 安装完整的 `riscv-gnu-toolchain`
安装完整的`riscv-gnu-toolchain`流程如下, 次方法费时较长, 且占据空间较大, 更推荐第二种方法。
1. 安装依赖
    ```bash
    $ sudo apt-get install autoconf automake autotools-dev curl libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev
    ```
2. 克隆`riscv-gnu-toolchain`
    ```bash
    $ git clone --recursive https://github.com/riscv/riscv-gnu-toolchain
    ```
3. 编译安装
    ```bash
    $ cd riscv-gnu-toolchain
    $ ./configure --prefix=/usr/local
    $ sudo make
    ```
### 方案2: 编译安装 `riscv64-unknown-elf-gdb`
1. 安装依赖
    ```bash
    $ sudo apt-get install libncurses5-dev python2 python2-dev texinfo libreadline-dev
    ```
2. 下载`gdb`源码
此处我选择gdb-13.1, 该版本在`wsl2 Ubuntu22.04`上使用正常。
    ```bash
    # 推荐清华源下载
    wget https://mirrors.tuna.tsinghua.edu.cn/gnu/gdb/gdb-13.1.tar.xz
    # 解压
    tar -xvf gdb-13.1.tar.x
    ```
3. 编译安装
只需要指定编译安装`riscv64-unknown-elf`并配置相关参数。
    ```bash
    $ cd gdb-13.1
    $ mkdir build && cd build
    $ ../configure --prefix=/your_path --target=riscv64-unknown-elf --enable-tui=yes
    $ make -j$(nproc)
    $ sudo make install
    ```

## 2.2 ch3-lab1  
本次作业需要实现`sys_task_info`这一系统调用以统计`task`信息。
### 总体思路
1. 在`task.rs`中的`TaskControlBlock`结构体增加了`sys_call_times`数组, 用于记录当前`task`中各个系统调用的次数, 以及`sys_call_begin`,记录任务创建的起始时间
   ```Rust
    pub struct TaskControlBlockInner {
        ...
        /// syscall time count
        pub sys_call_times: [u32; MAX_SYSCALL_NUM],
        /// begen time
        pub sys_call_begin: usize,
        ...
    }
    ```
2. 每次执行系统调用时, 将全局变量`TASK_MANAGER`中当前任务`current_task`对应的`TaskControlBlock`结构体的系统调用记录自增
3. 如果调度任务时发现`sys_call_begin = 0`, 说明这个`task`是第一次被调用, 需要将`sys_call_begin`设置为当前时间
4. 为`TaskManager`实现`get_sys_call_times`方法, 获取当前任务`current_task`对应的`TaskControlBlock`结构体的系统调用数组的拷贝
5. 完成`process.rs`的`sys_task_info`, 调用`get_sys_call_times`和`get_time_ms`获取`TaskInfo`结构体的`syscall_times`和`time`部分, `status`部分设为`Running`

## 2.3 ch4-lab2
### 2.3.1 重新实现 `sys_get_time` 和 `sys_task_info`
   相比于之前的实现, 唯一的变化就是系统调用函数中传递的指针不能直接使用, 因为内核页表与用户页表是不同的。
   
   #### 思路
   通过软件的实现来转换地址

    > 参考`translated_byte_buffer`实现`translated_struct_ptr`
    `translated_byte_buffer`将一个指向`u8`数组的指针按照指定的页表获取其物理地址, 我们不需要获取数组的长度, 只需要通过指定的泛型告知`PhysAddr`的`get_mut`方法需要转化的类型即可。

### 2.3.2  `mmap` 和 `munmap` 匿名映射
   本项目中, 这两个系统调用仅用于申请内存。在实际上, `mmap` 系统调用是用来将一个文件或者其他对象映射进调用进程的地址空间的。它通常映射到进程的用户空间，使得进程能够像访问普通内存一样访问文件的内容, 减少IO次数。
#### `mmap` 实现思路：
  1. 选择一个地址空间进行映射, 由前文介绍可知, 需要映射到当前`task`的内存地址空间
 可以用`TaskManagerInner`的`current_task`找到当前的`task`序号, 再在`tasks`中找到对应的`memory_set`
  1. 在找到的`memory_set`上申请内存
 需要注意的是, 分配内存页需要调用`frame_alloc`, 为了内存页的自动回收, 还需要将其加入一个集合类型中, 这里我为`MemorySet`新增了成员`map_tree: BTreeMap<VirtPageNum, FrameTracker>`用以接受`mmap`新分配的`FrameTracker`:
     ```Rust
     pub struct MemorySet {
     page_table: PageTable,
     areas: Vec<MapArea>,
     map_tree: BTreeMap<VirtPageNum, FrameTracker>,
     }
     ```

#### `munmap` 实现思路

思路和`mmap`类似
 1. 调用`page_table`的`unmap`方法删除映射
 2. 调用`map_tree`的`remove`方法移除`FrameTracker`使其能被`FRAME_ALLOCATOR`回收

#### 易错点
1. 需要通过`PageTableEntry`的`is_valid`方法判断转换后页表项的有效性
2. `mmap`使要判断地址是否对齐
3. 判断权限

## 2.4 ch5-lab3
### 2.4.1 实现`sys_spawn`系统调用
`sys_spawn`系统调用从效果上就是`fork`+`exec`, 区别在于既然马上要`exec`, 就没有必要负责父进程的地址空间了, 毕竟马上就要被覆盖掉, 因此, 思路如下:
1. 和`exec`一样, 将地址通过`task`处获取的页表进行转化得到有效的字符串
2. 调用`get_app_data_by_name`直接获取文件的`u8`数组表示的`elf`数据
3. 将得到的`elf`数据传入`TaskControlBlock::new`获取一个新的任务控制块
4. 设置新的任务控制块和当前任务控制块的父子关系
5. 将心的`task`加入任务列表
### 2.4.2 实现`stride` 调度算法
`stride`本质上就是综合了任务优先级程序后的任务运行时间的反映, 每次选择`stride`值最低的任务运行,一定程度上实现了公平的调度。
#### 实现思路
1. 在`config.rs`中添加常量`BigStride`
2. 在`TaskControlBlockInner`中新增如下成员:
    ```Rust
    pub struct TaskControlBlockInner {
        ...
        /// 当前 stride
        pub cur_stride: usize,
        /// 优先级等级
        pub pro_lev: usize,
        ...
    }
    ```
3. 每次切换任务时, 选择`stride`值最低的任务运行
    阅读代码可知, `run_tasks`方法每次都是调用`TaskManager::fetch`方法来获取下一个运行任务, 因此只需要修改`fetch`方法来实现我们的调度算法。
    由于`TaskManager`使用`ready_queue: VecDeque<Arc<TaskControlBlock>>`来存放`TaskControlBlock`, 每次调用`fetch`时，对`ready_queue`按照`stride`进行排序, 然后`pop_front`即可
4. 更新锁选择任务的其`stride`
    使其`cur_stride`变量自增`BIG_STRIDE / var.pro_lev`即可

## 2.5 ch6-lab4
### 2.5.1 硬链接简介
实现硬链接的系统调用: `linkat`和`unlinkat`
硬链接: 本质上就是不同的目录项指向了同一个`innode`, 因此实现`linkat`和`unlinkat`的流程如下:
- `linkat`
1. 查找要指定的目录项, 失败返回, 找到则返回其指向的`innode`号
2. 在目录下新创建一个目录项, 指向这个`innode`号
3. 将指向的`innode`的引用计数自增1

- `unlinkat`
1. 查找要指定的目录项, 失败返回, 找到则返回其指向的`innode`号
2. 在目录下删除找到的目录项
3. 将指向的`innode`的引用计数自减1
4. 如果指向的`innode`的引用计数变成0, 将其以及指向的数据块释放

### 2.5.2 实现思路
可以看到, 尽管思路清晰, 但实际的视线还是较为繁琐, 主要体现在各个数据块的查找, 判断其有效性等, 以下是具体的视线思路
- `linkat`
1. 修改`DiskInode`结构体, 添加引用计数成员`refcont`
   ```Rust
    pub struct DiskInode {
        ...
        pub direct: [u32; INODE_DIRECT_COUNT],
        pub refcont: u32, // 新增这个变量后需要将 INODE_DIRECT_COUNT - 1
        ...
    }
   ```
   需要注意的是, `DiskInode`需要匹配其在`block`中的大小, 因此我们添加了一个变量`refcont`, 需要将将 `INODE_DIRECT_COUNT` - 1以保证其在block中的大小不变
2. 通过`translated_str`获取实际的`_old_name`和`_new_name`
3. 在`ROOT_INODE`中调用`read_disk_inode`查询`old_name`的inode序号`inode_id`
4. 调用在`ROOT_INODE`中调用`modify_disk_inode`写入新的目录项
    需要注意计算新的`size`并调用`increase_size`分盘空间
5. 通过`inode_id`调用`get_disk_inode_pos`得到具体的`inode`位置, 将其引用计数自增
6. 调用`block_cache_sync_all`同步更新

- `unlinkat`
1. 通过`translated_str`获取实际的`_name`和
2. 在`ROOT_INODE`中调用`read_disk_inode`查询`_name`的inode序号`inode_id`, 注意需要判断其是否存在
3. 调用在`ROOT_INODE`中调用`modify_disk_inode`删除找到的目录项
   注意此处的删除, 我的实现思路是
   - 找到改目录项在根目录中的序号
   - 如果这个序号是最后一位, 只需要将`size`自减
   - 否则需要将最后一个目录项移动到这个位置进行覆盖, 然后再将`size`自减
4. 通过`inode_id`调用`get_disk_inode_pos`得到具体的`inode`位置, 将其引用计数自减
5. 如果硬链接对应的`innode`引用计数达到了0, 需要释放其空间
   调用`clear_size`获取其的每一个数据`block`, 并调用`EasyFileSystem::dealloc_data`进行清理

## 2.6 ch8-lab5
### 2.6.1 死锁检测算法进一步介绍
此处对任务书中的算法进行进一步补充
- `Available[m]`: 其下标对应的资源是最具体的资源, 比如具体是哪一把锁, 哪一个信号量
  可知, 进程是最基础的资源管理单位, 因此这一统计资源应该放在`ProcessControlBlockInner`中
- `Allocation[n][m]`: 每个具体资源已分配给每个线程的资源数, 具体而言就是`lock`了但还没`unlock`时需要记录资源的使用数量
  这个资源仍然可通过`ProcessControlBlockInner`来管理, 但是这样的话每个线程创建和操作相应资源时, 还需要在访问一次进程控制块, 因此可以将其托管给线程控制块`TaskControlBlockInner`
-  `Need[n][m]`: 表示每个线程还需要的各类资源数量, 具体而言, 在`lock`前需要先登记需求, 将对应的资源自增, 在`lock`后则需要撤销这次登记
  同`Allocation[n][m]`类似, 托管给线程控制块`TaskControlBlockInner`管理是更容易的实现
### 2.6.2 实现思路
1. 修改`ProcessControlBlockInner`结构体, 添加`Available[m]`
   ```Rust
    pub struct ProcessControlBlockInner {
        ...
        /// mutex的Available[m]
        pub m_available: Vec<usize>,
        /// 信号量的Available[m]
        pub s_available: Vec<usize>,
        /// 是否使用死锁检测
        pub use_dead_lock: bool,
    }
    ```
    注意这里我使用2个`Available[m]`变量`s_available`和`m_available`, 分别控制信号量和锁
2. 修改`TaskControlBlockInner`结构体, 添加`Allocation[m]`和`Need[m]`
   ```Rust
    pub struct TaskControlBlockInner {
        /// mutex的Allocation[m]
        pub m_allocation: Vec<usize>,
        /// 信号量的Allocation[m]
        pub s_allocation: Vec<usize>,
        /// mutex的Need[m]
        pub m_need: Vec<usize>,
        /// 信号量的Need[m]
        pub s_need: Vec<usize>,
    }
    ```
    由于是将其托管到`TaskControlBlockInner`管理, 因此`Allocation[m]`和`Need[m]`退化为了一维数组, 同时将信号量和锁分开管理
3. 修改创建`sys_mutex_create`和`sys_semaphore_create`
   拿到对应资源的序号`id`后, 需要更新`m_available`和`s_available`, 注意的是`m_available`只需要自增1, 而`s_available`需要自增信号量分配的具体值
4. 修改`sys_mutex_lock`和`sys_semaphore_down`
   - 这2个方法是申请对资源的使用, 因此在使用前需要进行登记: 将`s_need`或`m_need`进行自增
   - 按照任务书中的算法进行死锁检测, 此处不详细说明代码实现
   - 死锁检测通过后, 将`s_need`或`m_need`进行自减以撤销登记, 同时将`m_available`或`s_available`自减以标识资源被占用, 将`m_allocation`或`s_allocation`自增以标识自身对资源的占用
5. 修改`sys_mutex_unlock`和`sys_semaphore_up`
   - 这2个方法是归还资源, 相对简单, 只需要`s_available`或`m_available`自增以归还资源, 将`m_allocation`或`s_allocation`自减以标识自身对资源的释放

### 2.6.3 易错点
1. 每次对`m_available`统计资源进行访问时, 要同步更新所有`TaskControlBlockInner`中的`m_allocation`和`m_need`的数组长度以防止后续数组访问越界, 访问`s_available`时同理
2. 通过`inner_exclusive_access`方法获取`process_inner`或`task_inner`时, 要注意此前是否已经获取过相应资源, 尤其是在多层函数调用时, 需要手动`drop`掉以上变量
3. **测试依赖`sys_get_time`,一定要实现`sys_get_time`!!!**
