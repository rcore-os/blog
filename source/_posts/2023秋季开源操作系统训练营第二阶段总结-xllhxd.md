---
title: 2023年秋季开源操作系统训练营第二阶段总结-xllhxd
date: 2023-11-04 22:19
---

# 前言

不得不承认，自己的代码量在面对这五个实验的时候显得捉襟见肘。由于在此之前我没有进行任何项目的书写，或者说我只写过单独的 `code.c` 这样的东西，这次实验对我是一个不小的挑战。再加上初次接触 Rust 一些语言特性：闭包、各种集合也让我有点吃力。但万幸最近时间比较充裕，可以花充分的时间来做这件事，整个实验花费了两周的时间，将近五个小时，很少有过的这么快的时间了。

# 实验总结

由于我对实验的整个框架的了解也不是那么清楚，我只能以写实验时候进行的猜想来对这五个实验进行总结。

## lab1

第一个实验让我实现获取进程信息。在基本的操作系统的理解下，我们应该知道进程的信息应该存储在进程控制块（process control block, PCB）中。但 task.rs 并没有向我们暴露什么可以直接访问的接口，而在 mod.rs 中，我们可以发现其实例化了一个 `TaskManager`，所以我们在这个文件中增加一个函数 `get_tcb()` 来获取当前进程的进程控制块，然后将信息传递给 `TaskInfo` 结构体即可。

## lab2

第二个实验中向外提供的接口并没有发生变化，仍然是 task/mod.rs 下实例化的 `TaskManager`。而在进行这个实验之前，我们必须知道我们为什么要重写 `sys_get_time` 和 `sys_task_info`。这是因为，我们传给系统调用的指针指向的地址为用户进程的虚拟地址空间中的虚拟地址，这是操作系统无法直接访问的，需要增加一层指针转换的过程。知道了这一点之后，重写的任务就并不困难了。

而 `sys_mmap` 和 `sys_munmap` 的实现，可能开始没有思路，但可以首先把书中所有可能出现的错误排除掉，之后我们进行映射时既可以选择虚拟地址也可以选择虚拟页号，我选择了虚拟地址。而我们进行地址空间的映射，必然需要用到 mm 这个 crate 下的内容。不难想到 mm/memeory_set.rs 是这次实验的重点。在其中我们看到了 `MemorySet` 这个结构体，而我们如何获得这个结构体呢，我们在 `TaskManager` 中找到了 `TaskControlBlock` 并且 `TaskControlBlockInner` 中有 `memory_set` 这个成员。然后我们寻找 `MemorySet` 中有哪些我们可以用到的方法。显然 `sys_mmap` 可以使用 `insert_framed_area()` 方法完成，之后我们仿照其实现 `remove_framed_area()` 方法用以实现 `sys_munmap`。这里我采用了遍历所有的虚拟地址页并释放页表的方法。而在遍历的过程中有两种选择：

- 直接使用页表号
- 使用 `VPNRange` 结构，进而使用迭代器

其中后者比较复杂，因为 `VPNRange` 没有直接暴露出来，需要改为 pub 属性并在 mod.rs 中导出，但由于后续实验中不再提供 ViruralPageNumber 的 `step()` 方法，所以有更好的兼容性。

## lab3

实验三相较于前两个实验的变化比较大，首先就是我们不再提供 task/mod.rs 中的 `TaskManager` 结构体，而是将其放到了 task/manager.rs 中。而从这个实验开始如果我们想获取当前的进程使用 `current_task()` 这个方法（这里说的并不严谨，在实验五中引入线程之后，task 应该表示线程，但在这里还是进程）。同时一个比较偷懒的地方就是这个实验并不测试 `sys_task_info` 系统调用，我们可以选择不再实现。

`sys_mmap` 和 `sys_munmap` 的实现和实验二是一样的，不多说。

`sys_spwan` 的实现开始让我有点困扰，因为最开始没有注意到 `get_app_data_by_name()` 这个方法。知道之后我们可以通过这个方法获取 ELF 文件的数据，再通过 `TaskControlBlock` 的 `new()` 方法新建进程控制块，之后我们需要设置当前进程的子进程和新创建进程的父进程，二者还是有一定不同的。之后将新建的进程加入队列即可。

而关于 stride 调度算法，整个算法没有什么难度，但我最开始没有想清楚这里的调度是指的就绪态的进程的调度，而纠结到底在 task/task.rs、task/processos.rs、task/manager.rs 中哪里实现。在看了 [chapter 5 : 进程管理](https://github.com/xushanpu123/xsp-daily-work/blob/master/%E6%9A%91%E6%9C%9Frcore%E5%AE%9E%E9%AA%8C%E7%AC%94%E8%AE%B0/chapter5%EF%BC%9A%E8%BF%9B%E7%A8%8B%E7%AE%A1%E7%90%86.md) 后发现应在 manager.rs 中实现。这里只需要每次选择 stride 值最小的加入就绪队列即可，这里需要在 `TaskControlBlock` 中加入相应的内容。

`sys_set_priority` 比较简单，不多赘述。

## lab4

这个实验不再检查 `sys_task_info` 和 调度算法，可以不用实现。

`sys_mamp` 和 `sys_munmap` 是一样的，不再赘述。

`sys_spwan` 变得不太一样了，因为我们有文件系统的出现，所以此时如果想要获取 ELF 的所有数据则要先获得其 inode，之后再进行，而我们调用 `open_file()` 函数来完成这件事情。

这个实验卡了我很长时间，主要是向外提供的 `DiskInode`、`Inode`、`OSInode`虽然比较清楚，但还是很难确定什么时候用哪个，而且有些时候需要和 block_id 以及 block_offset 打交道还是比较麻烦的。然后有一点就是实例化了一个 `ROOT_INODE` 来惯例所有的内容，这里我开始很不理解为什么其他的文件需要用根目录的 inode 来进行管理，后来才发现需要在这里完成 `DirEntry` 的更新。我们首先根据 inode 获得文件的 block_id 和 block_offset，然后获取缓存并加锁，然后更新链接数目，之后再更新 `DirEntry`。

而 `sys_unlinkat` 我的实现并不完整，但通过了测试。因为考虑到可能删除最后一个链接之后，我们需要清空 `DirEntry`，我选择了遍历现在的目录项，并将所有我们不 unlink 的目录项放到一个向量中，之后释放所有的目录项，将向量中的内容写入到目录项。而我所说的不完整，则是我没有实现如果 unlink 之后链接数不为零，需要将其写回目录项，我没有想太清楚如何实现这个事情。

## lab5

首先我的实现稍显臃肿，因为 mutex 的思索检测可以不使用银行家算法来完成。而在这里我的整体思路则是通过修改 sync/mutex.rs 和 sync/semaphore.rs 中的结构体的内容，获得可以银行家算法中的三个向量。而在 `mutex_lock` 和 `down` 中更新三个向量，之后的思路如下面的代码：

```Rust
let mut if_finish = vec![false; task_count];

loop {
    let mut task_id: isize = -1;

    for i in 0..task_count {
        let mut task_id_can_run = true;

        for j in 0..mutex_count {
            if if_finish[i] || need[i][j] > available[j] {
                task_id_can_run = false;
                break;
            }
        }

        if task_id_can_run {
            task_id = i as isize;
            break;
        }
    }

    if task_id == -1 as isize {
        break;
    }

    // 释放可以运行的线程的资源
    for i in 0..mutex_count {
        available[i] += allocated[task_id as usize][i];
        if_finish[task_id as usize] = true;
    }
}

for i in 0..task_count {
    if !if_finish[i] {
        return -0xdead;
    } 
}
```

如果找到不能运行的线程则发生死锁。

# 后记

这次的实验过程还是比较艰难的，而且最开始得知只有两周的时间，加之自己 Rust 基础并不好，所以最开始写的很是急躁，但后来平复一下，开始慢慢自己猜整体框架的思路，以及找一些自己可以用到 API，有点没想到自己可以完成这五个实验。在这个过程中参考了：

- [暑期 rcore 实验笔记](https://github.com/xushanpu123/xsp-daily-work/tree/master/%E6%9A%91%E6%9C%9Frcore%E5%AE%9E%E9%AA%8C%E7%AC%94%E8%AE%B0)
- [HangX-Ma](https://hangx-ma.github.io/)

非常感谢大家讲解自己的思路，也感谢上课的老师以及群友。