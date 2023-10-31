---
title: 2023开源操作系统训练营第二阶段总结报告-hercule-karuha.md
date: 2023-10-29 00:25:37
tags:
    - author:hercule-karuha
    - repo:https://github.com/LearningOS/2023a-rcore-hercule-karuha
---
# 2023rCore训练营第二阶段总结

## 起因

因为不满足于学校的课程教学，想写一些稍微硬核一些的作业，在2023年5月左右的时候在国内外各大操作系统公开课中挑选了一番，最终是选择了rCore，大概有下面这些选择的理由。

* 使用rust语言，对于当时刚学了一点rust感受到其优越性的我很有吸引力。
* RISC-V架构，能减少一些x64的繁琐带来的困扰。
* 支持国内老师对于本科课程的改革。

在暑假期间自学了一番并在秋冬季的训练营中靠着多学了两个月的优势在只有两周时间学习的同学们中获得了第一名））

下面简单来说一下rCore的各个实验。

## ch3

ch3的任务是实现获取taskinfo的syscall,总体来说还是比较简单的。
但是实现过程中遇到了一些问题，程序运行到最后卡住了无法结束，稍微有点棘手。（时间久远没有截图）
最后发现是由于内存出现了问题，直接使用桶计数的话内存会炸掉。
解决方法稍微有些投机取巧，由于ch3只有5个系统调用就分别映射到一个数组的0,1,2,3,4就好了

```
match syscall_id {
            64 => curr_task_tcb.syscall_times[0] += 1,
            93 => curr_task_tcb.syscall_times[1] += 1,
            124 => curr_task_tcb.syscall_times[2] += 1,
            169 => curr_task_tcb.syscall_times[3] += 1,
            410 => curr_task_tcb.syscall_times[4] += 1,
            _ => {}
        }
```

不过秋冬季看起来没有人和我遇到一样的问题，我自己重新再运行也没有什么问题，不知道当时是怎么回事。

## ch4

ch4也稍微有些投机取巧了，我单独在`MemorySet`中添加了一个字段用来实现mmap,像是这样：

```
pub struct MemorySet {
    page_table: PageTable,
    areas: Vec<MapArea>,
    mmap_frames: BTreeMap<VirtPageNum, FrameTracker>,
}
```

阅读代码理解SV39稍稍费了一些功夫，不过收获还是挺大的。
还有重写`sys_task_info`和`sys_get_time`，选择自己实现了一个函数来进行到物理地址的转换

```
pub fn translate_ptr(token: usize, ptr: *const T) -> *mut T
```

图简单没有使用官方提供的``translated_byte_buffer``。

## ch5

ch5感觉上还是比较简单的，好像测试用例也不是很强的样子，听说有人没有实现都能过，不过应该会在线上测试被拦下来吧。

## ch6

感觉按部就班地调用框架提供的函数就行，不算很难。

## ch8

据选择做xv6的小伙伴说这是和xv6差别最大的而一个实验，确实也让我稍微费了一番功夫。
回头去看自己写的代码真是又臭又长啊..........
ch8的作业是实现银行家算法，在lock和unlock之前判断是否会造成死锁。
值得一提的点大概就是``sys_semaphore_create``函数只会在主线程中调用，因为银行家算法需要提前获知线程总的资源申请量，我的实现里面单独处理了线程id为0的情况，其他的还是比较简单的，就是几个向量加加减减的问题。

## 调试

使用gdb调试貌似很麻烦，源代码貌似不能很好地同步显示，不过也不怎么影响做完，用打log的方式解决了。
但是这让我的代码里面多了很多类似这样的东西：

```
debug!(
        "kernel:pid[{}] tid[{}] sys_semaphore_create",
        current_task().unwrap().process.upgrade().unwrap().getpid(),
        current_task()
            .unwrap()
            .inner_exclusive_access()
            .res
            .as_ref()
            .unwrap()
            .tid
    );
```

显得很臃肿。不过能解决问题就好。

## 总体感受

rCore教程的叙事方式很有意思，从历史的角度来添加一个一个模块，看书的同时阅读源代码好像自己真的是当时的操作系统开发者，面对着一个一个的问题，提出各种解决方案。难度的曲线也比较平缓，作为一本操作系统入门的教材来说是非常非常优秀的。
缺点大概就是有点过于简单了（bushi）。在看ch5的时候还试着去看了一下rcore中关于多核的部分不过因为资料太少也搁置了（摸了）。
rcore的竞品（不知道这个词合适不合适），chcore有关于多核的部分，如果有同学看到这里并对多核感兴趣可以去看看。（虽然我摸了）。
感谢清华的老师和助教为中国计算机本科教学做出的贡献。国内外的计算机本科教育差距很大不过仍有老师和同学在努力弥补着。感谢他们做出的努力。（什么时候我们学校能引进啊）
