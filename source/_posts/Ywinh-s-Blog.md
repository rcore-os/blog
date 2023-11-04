---
title: Ywinh's Blog
date: 2023-11-04 11:50:51
tags:
    - author:Ywinh
    - repo:https://github.com/LearningOS/2023a-rcore-Ywinh
    - rustos
---

# 实验总结

## lab1

目的就是实现三个信息的统计

### status: TaskStatus

- 按照提示直接设置为running

### [syscall_times: [u32; MAX_SYSCALL_NUM\]

- 第一次尝试直接在sys_task_info来加载，发现好像不行，因为不知道传入的ti: *mut TaskInfo，这个参数到底在哪里被初始化的，而且每个任务都需要有一个syscall_times数组
- 由此我在`TaskControBlock`中维护一个`pub task_syscall_times: [u32; MAX_SYSCALL_NUM]`数组，这样通过全局遍历TASK_MANAGER可以很好的在每次系统调用时更新
- 更新位置在`trap_handler`进入`syscall之前`，读取x17寄存器为syscall id

### time: usize

- 需要得到的是从第一次运行到现在的时间，现在的时间可以通过`get_time_ms`直接获得

- 第一次运行开始的时间，需要在应用第一次变成Running态的时候记载，因此我们为每个

  ```
  TaskControBlock
  ```

  中维护

  - `pub task_start: usize,` 记录任务第一次开始的时间
  - `pub task_flag: bool,` 标志是否为第一次，如果是就是false，然后我们更新`task_start`，并且将该变量置为false，保证只记录一次start time

## lab2

直接<<12直接这样会报错overflow，但是那个函数确实就是干了这个事情，只是我帮他弄了一把，很奇怪，还是最后用函数了

taskInfo报错，按照群里大佬这样修改，但不知道为什么这样修改

```
//原
pub fn get_time_us() -> usize {
    time::read() / (CLOCK_FREQ / MICRO_PER_SEC)
}
//修改为
pub fn get_time_us() -> usize {
    time::read() * MICRO_PER_SEC / CLOCK_FREQ
}
```

### 疑问

1. `vpn_end`计算有问题，len需要/8吗：不需要，因为VA就是取最低39位，不会左移右移啥的
2. 上取整，如果已经对齐的情况下还会上取整吗：回答，不会的

### bug与问题

1. 对于判断是否mapped过，只考虑了`find_pte`不能为`None`，没有考虑`find_pte`存在，但是`pte.is_valid()`不合法这件事，卡了很久，也不好调试
2. MapPermission不好进行零初始化，那么就用match，但是match要解决穷尽匹配，我们先把不合法的删去，然后最后一个_只代表`6`的情况
3. 对题意理解有问题，在mmap中，我以为如果start和end之间有已经被映射的页，我们还是需要分配len这么长，也就是不error，映射一段不连续的虚拟内存，写了比较复杂，后面才知道直接error
4. 这章很难debug，看样子甚至是多线程跑测试，所以花费很多时间



## lab3

### 继承上一章修改

今天上下午一直在移植代码，尝试了`git cherry-pick`试了很久，重置过去重置过来，问了gpt，看了b站，csdn都无果，就是没有合并，只显示reports文件夹有冲突，主要的os没有，遂还是采用`git diff`打patch的笨方法，冲突太多了，合并了小一个小时。

### 修理waitpid

移植好之后，`make run`确实能跑了，但是随便输一个就报错，说`waitpid`清除僵尸进程的引用计数有错，本来应该是1，结果是2，多了一个，debug找不出来，println也没看出来在哪里。仔细想想，找了跟`Arc`有关的所有代码，可以肯定一件事，模板代码一定没问题，那问题就出在我自己移植过来的代码，最后一个个注释排除法，找到了原来是我自己用了一个Arc没有drop，我以为drop了inner的RefMut就可以了，没想到这个也要drop。为啥这个不会自动drop呢？

目前还有usertest卡住的问题，再看看。

### spawn

通过注释发现卡住的原因是spawn的实现有问题，重点在维护父子关系，注意`drop`的位置

* spawn就是新建一个进程而已，不要想着用fork+exec，之前直接调用fork()和exec()会出问题，也不好调试，于是自己仿照fork内容与exec自己实现

### stride

stride感觉倒是很简单，根据提示BIG_STRIDE需要大一点，于是把BIG_STRIDE设置为了0x100000，然后每次调度的时候，都要fetch_task，于是在这里找出最小的stride返回，pass的维护在set_piro里面实现，因为prio只会在这里修改



## lab4

这章我真的心累了，调试了两天，目前还是有一个神奇的bug，我觉得不是我代码的问题

在`ch6_file2`里面：我做了如下修改，//后的就是新加入的

```rust
    let test_str = "Hello, world!";
    let fname = "fname2\0";
    let (lname0, lname1, lname2) = ("linkname0\0", "linkname1\0", "linkname2\0");
    let fd = open(fname, OpenFlags::CREATE | OpenFlags::WRONLY) as usize;
	//
    let fd1 = open(lname0, OpenFlags::CREATE | OpenFlags::WRONLY) as usize;
	//
    println!("ok1");
    //此处传入的lname0是0x0，为什么
    link(fname, lname0);
	//
    println!("ok2");
	...
```

发现在 link(fname, lname0);   //此处传入的lname0是**0x0**，为什么，看运行结果(在open系统调用和link加入了println!打印传入str的地址)，部分结果如下

```
open:path  is 0x42cd
open:path  is 0x42d4
ok1
link:old name addr is 0x42cd
link:new name addr is0x0
old_name is6 ,new_name is45 
[kernel] Panicked at /root/2023a-rcore-Ywinh/easy-fs/src/layout.rs:419 range end index 45 out of range for slice of length 28
```

可以看到`lname`对应的`new name`在open里面的地址是`0x42d4`,但是在link里面是`0x0`，就是这个bug让我以为我的`link`出错了，改了一整天，后面copy别人的代码也不行，真的心累了。。请教了群里的一位大佬，还没回我，希望能解决...



**自己对于rust的理解还是不够，还是要在实践中多用，但很感谢能通过这个机会锻炼自己~~**