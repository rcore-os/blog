---
title: dbydd的rcore学习阶段总结
date: 2023-11-02 12:04:34
tags:
	- author:姚宏伟
	- repo:https://github.com/LearningOS/2023a-rcore-dbydd
---
# 引言

我是在某 912 考研群里看到群友发了这次操作系统训练营的宣传图才进来的，事实证明，这是一次非常正确的决定，因为确实挺有趣的，一方面有了个在专业指导下实际上手折腾操作系统的机会，另一方面也确实见识到了挺多东西。

顺便，我还拉了几个朋友进来一起，可惜他们都比较忙，只是堪堪过了一阶段，在二阶段时正好与他们的考试周和大作业冲突了，于是在二阶段折戟沉沙，只能等下一次训练营时继承这次的存档继续打了（

# 感悟（正文）

操作系统训练营，那自然是以深入了解操作系统为目的的，若是要展示自己在这方面的感悟，那么我想，我可以通过使用伪代码来描述一个简单操作系统所做的事情，以此来反映我在这次训练营中所学到的。

```rust
struct SimpleSYSTEM{
    pub hardware_resources:RefMut<HardWareResource>, //作为一种特殊的软件，操作系统同时对用户的软件与硬件进行操作，在大多数场景下，用户并不会直接的操作硬件，而是要通过操作系统来交互。
    pub state:OSSTATE, //万物都是状态机啊状态机
}

enum OSSTATE{
    //首先，很显然的，泛泛而谈的来说，操作系统要么在处理自己的数据，要么在处理程序的数据
    OS_OPERATION(OS_OP_STATE),
    RUNNING_TASK,
}

enum OS_OP_STATE{
    //那么操作系统在不允许用户程序的时候会做什么事呢？
    SELECT_AND_SWITCH_STATE, //这个状态表示控制权刚刚回到操作系统手上，这是需要操作系统来决定下一步做什么。
    MANAGE_MEMORY,//由于虚拟内存的存在，一切的数据，不论在什么地方，最终都会映射到内存中，可以说操作系统做的只有两件事：操作内存与操作硬件，既然如此，操作系统也得负责管理内存
    HANDLE_INT, //中断，是硬件给予操作系统反馈的桥梁，有了它我们才能更方便的建立硬件与软件的双向链接
}

impl UseAble for SimpleSYSTEM{
    pub fn iter(&self){
        loop{
        match self.state {
            OS_OP_STATE(operation) => match operation{
                SELECT_AND_SWITCH_STATE => {
                    //首先，检查自己是如何进入基础状态的，也就是说如果发生了中断，我们需要第一时间处理，因此我们如此编排顺序：
                    if self.hardware_resources.interrupted(){
                        self.state = OS_OP_STATE(HANDLE_INT);
                        continue; // 进入下次循环，下次循环就会转到处理中断的操作。
                    }
                    if time_to_manage_mem(self.hardware_resources){ //除了被动的申请/释放内存，操作系统也需要时不时主动的去检查各个进程的内存空间以及整体的内存空间，以及时发现问题。
                        self.state = OS_OP_STATE(MANAGE_MEMORY);
                        continue;
                    }
                    self.state = RUNNING_TASK; //没有任何异常，那么是时候运行一会程序了！事实上这才是大多数时候的情况

                }
                MANAGE_MEMORY => {
                    manage(self.hardware_resources.managed_memory());//管理内存，检查错误并修正错误
                    self.state = OS_OP_STATE(SELECT_AND_SWITCH_STATE); //回到基础状态
                }
                HANDLE_INT => {
                    handle(self.hardware_resources.int_info()); // 根据硬件请求信号做出回应
                    self.state = OS_OP_STATE(SELECT_AND_SWITCH_STATE); //回到基础状态
                }
            },
            RUNNING_TASK => {
                (addition_attr,operations_collection:address) = generate_operation(self.hardware_resources.cache); //为什么是address?因为程序也存放在内存中。
                actual_operation_stream:RefCell<dyn [operation]> = setTimer(self.hardware_resources.timers,operations_collection) // 这里不一定得是字面意思上的Timer,也可以是某种约束，比如我们所约定俗成的，放置在程序栈底部的返回地址，放置一连串操作在等，都可以算是对于程序运行时间的干涉。
                self.state = OS_OP_STATE(SELECT_AND_SWITCH_STATE); //运行一段时间后操作系统提前在operations_collection/硬件计时器中埋下的操作会触发，将运行资源交还给系统，也就是说会重新进入这个大循环，因此我们可以在这里提前做好状态的设置。
                //于是经过了处理后，我们得到了真正的一串精心调整过的操作序列；
                self.hardware_resources.load_operations(actual_operation_stream); // 在这里，操作系统的工作暂时会停止，直到这段操作序列运行结束，或者运行时出现了情况，触发中断。
            }
        }
    }
    }
}

```

如上，这就是在我脑海中操作系统所做的事情，当然，这只是个泛泛而谈的框架，其中每个分支中所进行的操作都包含着值得深入学习的问题，比如 MANAGE_MEMORY 的情况下，我们可能需要进行进程资源的检查，以发现死锁/僵尸进程的情况等，学习这些内容就是参加训练营的目的；

## 日程

- 第一阶段：rust 入门 & rustling: https://github.com/LearningOS/rust-rustlings-2023-autumn-dbydd

  由于我在此之前就自学过 rust，因此第一阶段对于我来说比较轻松，每天抽点时间刷一下 rustling 就能愉快的完成任务了，事实上我在第三天时就已经把 rustlings 刷完了。因此这个阶段实在是没什么好说的...
- 第二阶段：rcore 实操训练：https://github.com/LearningOS/2023a-rcore-dbydd

  在我的印象中,rcore 是 ucore 的后辈,两个操作系统都是由清华大学的师生开发出来作为操作系统课的教学工具的;这不正巧,由于下定决心明年要冲 912,我在暑假的时候就先刷了一遍清华的网课,其中就包括了陈老师的操作系统课程,刷完后也瞄了两眼 ucore 的实验部分,由于脑中的知识很新,因此对于实验到还算是得心应手,反而大部分时间都是在与 rust 的语法做斗争.但是不巧的是也遇到了考试周,此外还要准备校内计算机社团的讲课工作与数学建模的备赛,就算是我也感到了分身乏术,进度也就这样被拖慢了下来,直到我写下这段文字时(11.1),也只是将实验推进到了 ch6,好在后续又有通知,这次的二阶段只要完成前三个实验就能进入三阶段,剩下的两个实验在三阶段补齐就行.这样一来或许我也有机会一命通关?整挺好.

  - 二阶段开始-2023.10.25 做完了 ch3

  由于是第一个实验，难度并不是很高，只需要给进程附加上一些信息记录，修改很少的代码就能完成。全过程思路如下：首先是要对进程做操作，因此应当去进程相关的代码下做修改。TaskInner 记录的是进程的运行时的程序部分，在这里添加自己的信息不是很合适，于是只剩下了一个可选项：在 TaskControlBlock 中塞东西。

  - 2023.10.25-2023.10.31，做完了 ch4

  ch4 主要是关于内存的管理，这部分可以说是一个操作系统的 1/2 个核心部分，在我看来最精简的操作系统，其实就是一个工作在内存上的输入输出机：输入当前的内存，输出特定长度的操作序列至某一片连续内存，并将当前 cpu 的 pc 指向哪个内存的首地址。当那一片连续内存执行完后就回到内核态(也就是继续由操作系统进行一次输出)，如此反复...

  总之，我们只要实现一个虚拟内存的申请和释放就可以了，这部分主要的难点就是可能会一次申请/释放一大片内存，从而需要在多个页表项上进行操作，不过实际实现起来只需要稍加思索就能写出很自然的代码。

  - 2023.10.31-2023.11.1 做完了 ch5

  ch5 主要是对进程的管理，自很久以前时分复用的概念被提出开始，任何操作系统都会支持多进程的操作，这甚至不是一件需要特意提及的事情。问题在于：我们要如何设计一个合理的进程系统，并不出差错且用得顺手？

  实验部分有两个，一个是实现 spawn 方法，实验指导文档上给出了标准的 posix_spawn 方法的参考链接。一言以概括之：spawn 方法就是创建子进程用的，那么既然知道了要做什么，怎么做也就非常的显而易见了。

  另一个任务是实现一个简单的进程调度算法：stride 算法，这个算法的想法很自然：给进程加上动态变化的权值，如果一个进程刚刚被执行过，那么它应当不会在短期内被连续执行，除非他的优先值很高，能让他进行连续的执行。

  \*未完待续
