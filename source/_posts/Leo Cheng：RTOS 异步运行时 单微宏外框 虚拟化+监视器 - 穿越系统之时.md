---
title: 'Leo Cheng: RTOS 异步运行时 单微宏外库框 虚拟化+监视器 - 穿越系统之时'
date: 2026-05-04 21:43:45
categories:
    - Leo Cheng
tags:
    - author:逸仙
    - repo:https://cnb.cool/heke_learning/ArceOS-Tutorial-2026S
    - RTOS
    - FreeRTOS
    - embassy
    - RTT
    - Unikernel
    - rt-thread
    - μC-OS
    - uC-OS2
    - uC-OS3
    - RVM1.5
    - axvisor
    - bao-hypervisor
    - hypocaust
    - hypocaust-2
    - kvmtool
    - rHyper
    - rcore-vmm
    - rust-hypervisor-firmware
    - rustyvisor
    - rvvm
    - tg-rcore
    - DragonOS
    - NoAxiomOS
    - StarryOS
    - Theseus
    - TornadoOS
    - Zircon
    - ArceOS
    - Asterinas
    - JOS
    - libos
    - HermitOS
    - MirageOS
    - TenonOS
    - rumprun
    - seL4
    - unikraft
    - xv6
    - zCore
    - aCore
    - rCore
    - Async Runtime
    - Bare-metal Runtime
    - Monolithic Kernel
    - Microkernel
    - Macro Kernel
    - Exokernel
    - Library OS
    - Framekernel
    - SASOS
    - Component Kernel
    - Async Kernel
    - Virtualization
    - Hypervisor
    - Type1
    - Type2
    - Type1.5
---

> AI4OSE 期间，我们与 Agent 协作学习各项知识，并且 Agent 出题 讲解 以及 苏格拉底式 的阶梯式学习法。所以最后也有 Agent 自动插入笔记的问题和自己的回答，如果答案不充分，则我的作答还会有 Agent 协调补充的内容。相关提示词：如果我有疏漏，给我补充，且讲解充分后继续向我提问查缺补漏，最后一同沉淀到我们的笔记中！

<!-- more -->

内核拿到第一条指令后，要在裸硬件上把自己运行起来，并一直运行下去：建立调度、管理内存、处理中断和异常、驱动设备、提供文件系统和进程间通信，最后运行用户程序。

做这些事的系统软件有很多种：只有几 KB 的实时内核（RTOS），把异步运行时直接当调度框架的裸机方案，结构完整的宏内核、微内核、组件化内核、外核和 Unikernel，以及在一套内核之上同时运行多套内核的虚拟化层，从简单到复杂。谁来调度、内存怎么管理、设备怎么接入、系统调用怎么进入内核、文件系统和网络栈怎么搭建，这些问题在每一类里都有不同的答案。下面按源码逐个看。

## 实时内核

先看实时内核（RTOS）。这里的「实时」不是指快，而是指确定：在规定的时间内一定完成响应，最坏情况的延迟有上界并且可以分析。为了确定性，RTOS 通常放弃通用操作系统的许多机制：没有 MMU 和多地址空间，内核与应用在同一个特权级、链接成同一个可执行文件；调度严格按优先级抢占，不追求吞吐量上的公平分时。

RTOS 结构简单，适合用来理解内核的工作方式：从 `reset`、`start.S`、`main` 到启动调度器是一条直线，没有 SBI、设备树、SMP、分页，但已经包含调度、上下文切换、进程间通信（IPC）、优先级反转处理这四件内核最核心的事。宏内核、微内核也是在同样的问题上，再加上地址空间和特权边界。

按内核之外还带多少系统设施，RTOS 分两类：

- **库式 RTOS（library RTOS）**：只提供内核本身（任务、调度、IPC、定时器），应用和内核源码一起编译成一个镜像烧录。代表是 FreeRTOS 和 μC/OS。它不是完整的操作系统，没有自带的文件系统、shell、包管理，需要自己组合或另选组件。
- **完整 RTOS（full RTOS）**：内核之外自带设备框架、文件系统、网络栈、shell、libc、包管理和大量板级支持。代表是 RT-Thread、Zephyr、RIOT，工程规模接近小型通用操作系统。

下面看 FreeRTOS（库式）、μC/OS-II 与 μC/OS-III（用于安全认证和教学）、RT-Thread（国产完整 RTOS），每个都从使用（配置、编程、移植、放进启动链）和实现（数据结构和算法，以及怎样仿写一个同类内核）两方面看。

### FreeRTOS

FreeRTOS 由 Richard Barry 于 2003 年创建，2017 年起由 AWS 维护并改用 MIT 许可，是 MCU 上用得最多的 RTOS。内核主体（`tasks.c`、`queue.c`、`list.c`、`timers.c`、`event_groups.c`、`stream_buffer.c` 和 `portable/` 移植层）约九千行 C，编译后内核约 10 KB。

#### 使用

**创建任务。** 动态创建用 `xTaskCreate`，由内核分配栈和任务控制块（TCB）：

```c
BaseType_t xTaskCreate(
    TaskFunction_t pxCode,           // 任务入口函数
    const char *pcName,              // 调试用名字
    configSTACK_DEPTH_TYPE usDepth,  // 栈深度，单位是字，不是字节
    void *pvParameters,              // 传给任务的参数
    UBaseType_t uxPriority,          // 优先级：数字越大优先级越高
    TaskHandle_t *pxCreatedTask);    // 返回任务句柄
```

两处容易错：FreeRTOS 的优先级**数字越大越高**（与 μC/OS、RT-Thread 相反），`tskIDLE_PRIORITY` 为 0；任务函数必须是 `for(;;){ … }` 死循环，**不能返回**。需要确定性、没有堆的场合用 `xTaskCreateStatic`（置 `configSUPPORT_STATIC_ALLOCATION=1`），由调用方提供 `StackType_t` 栈数组和 `StaticTask_t`，这时应用还要为空闲任务和定时器守护任务提供内存（实现 `vApplicationGetIdleTaskMemory` 和 `vApplicationGetTimerTaskMemory`）。

最小的任务加队列程序（取自官方 RISC-V QEMU virt 例程 `main_blinky.c`）：

```c
static QueueHandle_t xQueue;

static void prvTxTask(void *pv) {
    const uint32_t v = 100;
    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(200)); // 相对延时 200 ms
        xQueueSend(xQueue, &v, 0U);     // 0 表示不阻塞
    }
}

static void prvRxTask(void *pv) {
    uint32_t r;
    for (;;)
        if (xQueueReceive(xQueue, &r, portMAX_DELAY) == pdPASS) // 一直阻塞等待
            /* 处理收到的 r */ ;
}

int main(void) {
    xQueue = xQueueCreate(2, sizeof(uint32_t)); // 深度 2，元素 4 字节
    xTaskCreate(prvRxTask, "Rx", configMINIMAL_STACK_SIZE, NULL, 2, NULL);
    xTaskCreate(prvTxTask, "Tx", configMINIMAL_STACK_SIZE, NULL, 1, NULL);
    vTaskStartScheduler(); // 不返回
    for (;;);
}
```

**时间与延时。** `vTaskDelay(ticks)` 是相对延时；`vTaskDelayUntil(&xLastWake, period)` 以上次唤醒时刻为基准做绝对周期延时，不会因任务本身的执行时间累积误差，精确的周期任务必须用它。毫秒与节拍的换算用 `pdMS_TO_TICKS(ms)`。

**进程间通信。** FreeRTOS 的同步原语都建立在队列上：

- **队列** `xQueueCreate(len, itemSize)`：按值复制消息，队列满或空时发送方或接收方阻塞。
- **信号量**：计数信号量是 `itemSize=0`、长度为 N 的队列（计数就是队列中的元素数），二值信号量长度为 1。用 `xSemaphoreTake`、`xSemaphoreGive`。
- **互斥量** `xSemaphoreCreateMutex()`：二值信号量加上持有者记录和优先级继承（PIP）。互斥量不能在中断里获取，因为 PIP 需要任务上下文。
- **软件定时器**：`xTimerCreate` 创建周期或单次定时器，回调在定时器守护任务的上下文中运行，**回调里不能阻塞**。
- **事件组**：24 个事件位（`TickType_t` 为 32 位时），支持「与」「或」组合等待多个条件。
- **任务通知**：直接写 TCB 里的通知值，不需要单独的对象，在只有一个接收者时比队列和信号量更快、更省内存。

在中断服务程序（ISR）里必须用带 `FromISR` 后缀的版本，通过输出参数 `pxHigherPriorityTaskWoken` 加退出时的 `portYIELD_FROM_ISR()` 请求一次调度，这样中断唤醒高优先级任务后能立即抢占。

**配置与裁剪。** 全部由 `FreeRTOSConfig.h` 的宏决定：`configUSE_PREEMPTION`（抢占式）、`configUSE_TIME_SLICING`（同优先级时间片轮转）、`configUSE_PORT_OPTIMISED_TASK_SELECTION`（用硬件 CLZ 指令 O(1) 选出最高优先级）、`configMAX_PRIORITIES`、`configTICK_RATE_HZ`、`configTOTAL_HEAP_SIZE`、`configCHECK_FOR_STACK_OVERFLOW`（栈溢出钩子）等；`INCLUDE_xxx` 宏逐个开关 API，没用到的功能不进二进制。rv 移植还要配置三项：`configMTIME_BASE_ADDRESS` 和 `configMTIMECMP_BASE_ADDRESS`（节拍由 CLINT 的 `mtimecmp` 产生）、`configISR_STACK_SIZE_WORDS`（中断专用栈大小），让通用的 rv 移植层知道平台的 CLINT 地址。

**放进启动链。** 从构建脚本最能看出库式 RTOS 的形式：应用直接把内核的 `.c` 文件列为源文件一起编译。rv QEMU virt 例程的 `Makefile` 把 `tasks.c`、`list.c`、`queue.c`、`timers.c`、`event_groups.c`、`stream_buffer.c` 以及 `portable/MemMang/heap_4.c`、`portable/GCC/RISC-V/port.c`、`portASM.S` 全部链接进来，生成一个 ELF。启动顺序：`reset`，`start.S`（设 `gp`/`sp`，判断主 hart，复制 `.data`，清 `.bss`，跳到 `main`），`main`（先 `csrw mtvec` 设置陷阱入口），创建对象，`vTaskStartScheduler()`；后者创建空闲任务和定时器守护任务，最后由移植层的 `xPortStartScheduler()` 配置 `mtimecmp`、打开中断、用 `mret` 切到第一个最高优先级任务。

内存分配器有五种，按需选一个：`heap_1`（只分配不释放）、`heap_2`（可释放，不合并）、`heap_3`（封装 C 库的 `malloc` 并加锁）、`heap_4`（首次适配加空闲块合并，最常用）、`heap_5`（`heap_4` 加多块不连续的内存区域）。FreeRTOS-Plus 提供 TCP 网络栈、FAT 文件系统、coreMQTT、coreHTTP 等组件，是 AWS IoT 和 Matter 协议栈默认的底层。

#### 实现

**调度器。** 就绪任务按优先级组织：`pxReadyTasksLists[configMAX_PRIORITIES]` 每个优先级一条双向链表，`uxTopReadyPriority` 记录有就绪任务的最高优先级。选出最高优先级有两种实现，由 `configUSE_PORT_OPTIMISED_TASK_SELECTION` 切换：通用版从 `uxTopReadyPriority` 往下扫描，复杂度是 O(优先级数)；移植优化版用 CLZ（前导零计数）指令一条指令求出位图的最高位，O(1)，rv 和 Cortex-M3 以上都有这条指令。同优先级用链表的 `pxIndex` 游标做 FIFO 轮转，打开时间片后每个节拍轮换一次。

抢占有四个触发点：节拍中断里 `xTaskIncrementTick()` 返回需要切换；任务主动 `taskYIELD()`；任务因 `vTaskDelay` 或队列阻塞而让出；中断里 `xQueueSendFromISR` 唤醒了更高优先级的任务。切换的核心函数是 `vTaskSwitchContext()`，它选出下一个任务并更新全局指针 `pxCurrentTCB`。节拍处理函数 `xTaskIncrementTick()` 把节拍计数加一，检查按唤醒时刻排序的延时链表的第一个任务是否到期，到期就移回就绪表；节拍计数溢出时交换两张延时表。

寄存器的保存和恢复在移植层。rv 上 `portASM.S` 的陷阱处理程序把全部通用寄存器保存到当前任务的栈上，按 `mcause` 分发（机器定时器中断做节拍处理和切换，外部中断交给用户的处理函数），再从 `pxCurrentTCB->pxTopOfStack` 恢复，`mret` 返回。Cortex-M 上用最低优先级的 PendSV 异常完成切换，临界区用 `BASEPRI` 屏蔽部分中断，而不是关闭全部中断。

**内核对象都建立在一个双向链表上。** `List_t` 和 `ListItem_t`（`list.c`，约 440 行）是内核里唯一的核心数据结构：`ListItem_t` 包含排序键 `xItemValue`、前后指针、指向所属对象的 `pvOwner`（TCB）和所属链表 `pvContainer`。三个操作满足全部调度需求：`vListInsert` 按 `xItemValue` 有序插入（延时表按唤醒时刻排序，事件等待表按优先级排序），`vListInsertEnd` 在游标处 O(1) 插入（就绪表的 FIFO），`uxListRemove` O(1) 删除。

TCB 的第一个字段特意放 `pxTopOfStack`，切换上下文的汇编可以直接从 `[pxCurrentTCB]` 取栈顶。队列 `Queue_t` 是环形缓冲区加两条等待链表（等待发送、等待接收），满或空时把任务挂到等待链表上，按优先级唤醒。互斥量在二值信号量的基础上记录持有者，获取不到且持有者优先级更低时，调用 `xTaskPriorityInherit` 临时提高持有者的优先级，释放时 `xTaskPriorityDisinherit` 恢复，这就是 PIP。软件定时器由守护任务加命令队列实现：应用调用 `xTimerStart` 实际上是向命令队列发一条命令，守护任务依次处理，所以定时器表不需要加锁。

#### 特点与仿写

FreeRTOS 追求小和统一：所有同步原语都归结为队列；只实现 PIP，不实现优先级上限协议（PCP），而且 PIP 只处理一层，不处理连锁的优先级反转。它不是完整的 RTOS，文件系统和 shell 需要另配；没有 MMU 多地址空间（只有 ARMv7-M 上有基于 MPU 的 FreeRTOS-MPU）；调度器很简单，不支持 EDF、RM 这类基于截止期的算法。它的优点是小、可移植（三十多种架构）、经过大量工业使用、配套齐全、许可宽松。

仿写一个同类的库式 RTOS，步骤如下：先写 O(1) 的双向链表（尾插、有序插入、删除、轮转游标）；定义 TCB，第一个字段放栈顶指针，嵌入就绪/延时表和事件等待表两个链表节点，并预留 `uxBasePriority` 给 PIP；就绪表用「每个优先级一条链表加位图」，选最高优先级先写往下扫描的版本，再写 CLZ 版本；写移植层的三个文件（`portmacro.h` 的宏，`port.c` 伪造首次切换的初始栈帧并启动调度器，`portASM.S` 的陷阱处理），先在 QEMU virt 的 rv 上用 CLINT `mtimecmp` 产生节拍跑起来；用节拍驱动延时表和时间片；统一调度入口 `vTaskSwitchContext`；以队列作为唯一的阻塞原语，信号量和互斥量是它的特例；定时器、事件组、任务通知做成薄封装；用 `configUSE_xxx` 和 `INCLUDE_xxx` 宏在编译时裁剪。

### μC/OS-II 与 μC/OS-III

μC/OS 由 Jean J. Labrosse 创建，配有同名著作（《MicroC/OS-II: The Real-Time Kernel》），以代码可读、通过安全认证（航空 DO-178B/C、工业 IEC 61508、医疗 IEC 62304）著称。最早的 μC/OS 于 1992 年发表，μC/OS-II 于 1998 年发布，μC/OS-III 于 2009 年发布。2020 年 2 月，版权持有者 Silicon Labs（2016 年收购 Micrium）把 μC/OS 全系列以 Apache-2.0 许可开源，原 Micrium 团队成立的 Weston Embedded Solutions 成为官方维护方。从 II 到 III，可以看到一个简单的内核怎样发展成工业内核。

#### μC/OS-II

它的核心约定是**任务 ID 就是优先级**：每个优先级只能有一个任务，最多 64 个优先级（可扩展到 254 个），所以不存在同优先级的任务，也没有时间片轮转，是纯粹的优先级抢占。

使用上，`OSInit()` 初始化后用 `OSTaskCreate(task, p_arg, &Stk[STK_SIZE-1], prio)` 创建任务（栈向下增长，所以传高地址作栈顶），`OSStart()` 启动。延时用 `OSTimeDly(ticks)` 或 `OSTimeDlyHMSM(h,m,s,ms)`。同步原语共用一个**事件控制块** `OS_EVENT`：信号量 `OSSemCreate`、`OSSemPend`、`OSSemPost`，消息队列 `OSQCreate`，邮箱 `OSMboxCreate`，事件标志组 `OSFlagCreate`，都从编译时确定大小的静态数组中分配，不用 `malloc`。裁剪用 `os_cfg.h` 中取 0 或 1 的宏按模块开关。

实现上最有特点的是**不用 CLZ 指令的 O(1) 最高优先级查找**：两级位图 `OSRdyGrp`（8 位，标记哪几组有就绪任务）加 `OSRdyTbl[]`（每字节表示一组 8 个优先级），每个 TCB 预先存好 `OSTCBY=prio>>3`、`OSTCBX=prio&7` 和对应的掩码，置为就绪就是 `OSRdyGrp |= BitY; OSRdyTbl[Y] |= BitX`。查找最高优先级靠一张 256 项的常量表 `OSUnMapTbl[]`（下标是 8 位的位模式，值是最低置位的位号）：`y = OSUnMapTbl[OSRdyGrp]; prio = (y<<3) + OSUnMapTbl[OSRdyTbl[y]]`，在没有硬件 CLZ 的 8 位 MCU 上也能 O(1)。代价在节拍处理上：`OSTimeTick()` 每个节拍遍历整条 TCB 链表递减延时，开销随任务数线性增长（O(N)）。处理优先级反转时，μC/OS-II 的互斥量用 PCP，但做法是占用一个空闲的高优先级：创建互斥量时必须预留一个比所有用户任务都高、且没有被占用的优先级，供提升时使用，限制较多。

#### μC/OS-III

它取消了「每个优先级一个任务」的限制，支持同优先级多个任务和同优先级时间片轮转。`OSTaskCreate` 扩展为 13 个参数，TCB 由调用方静态提供（不再用内部池）。实现上有三处主要改进：

- **就绪表改用硬件 CLZ 加每个优先级一条双向链表**：`OS_PrioGetHighest()` 用 `CPU_CntLeadZeros` 一条指令找到最高位，位图按 CPU 字宽分段，支持任意数量的优先级；`OSRdyList[]` 每个优先级一条双向链表，支持同优先级多任务和轮转。
- **节拍处理接近 O(1)**：μC/OS-III V3.08 用一条按增量编码的有序链表 `OSTickList`，每个 TCB 的 `TickRemain` 只存与前一个节点的差值，每个节拍只需递减链表头并取出到期的头部节点，不再遍历全部 TCB。这个版本用的不是多桶时间轮，这一点常被说错。
- **真正的优先级继承**：获取不到互斥量时调用 `OS_TaskChangePrio`，把持有者在就绪或等待结构中正确移动以提高优先级，释放时根据它还持有的其他互斥量逐级恢复，不再依赖预留的优先级。

此外，μC/OS-III 把所有阻塞操作统一成 `OS_Pend` 和 `OS_Post`（基于公共的 `OS_PEND_OBJ` 和按优先级排序的等待链表），信号量、互斥量、队列、事件标志组共用一套代码；消息体统一从全局的 `OS_MSG` 池借用和归还，与任务分开；还提供任务内置的信号量和队列、CPU 时间戳，以及可选的无节拍（tickless）低功耗模式。

#### 移植与仿写

FreeRTOS 的移植层放在内核目录里，μC/OS 的移植层则单独放在 `Ports/<arch>/<toolchain>/` 下，共三个文件：`os_cpu.h`（类型、临界区方法、`OS_TASK_SW` 宏、栈增长方向），`os_cpu_a.S`（汇编的 `OSStartHighRdy`、`OSCtxSw`、`OSIntCtxSw`），`os_cpu_c.c`（`OSTaskStkInit` 伪造初始栈帧和各种钩子）。内核的 `.c` 文件与架构完全无关，移植到新的处理器只改这三个文件。rv 上有一个常用的做法：`OSCtxSw` 不直接切换，而是写 CLINT 或 PRCI 的 `MSIP` 寄存器触发一次软件中断，在 `Software_IRQHandler` 里完成保存和恢复，相当于 Cortex-M 上的 PendSV。

仿写时，调度数据结构二选一：在没有 CLZ 的小 MCU 上运行、每个优先级只有一个任务时，用 μC/OS-II 的两级位图加 256 项常量表；要支持同优先级多任务和轮转、处理器有 CLZ 时，用 μC/OS-III 按字宽分段的位图加每个优先级一条双向链表。处理优先级反转应选 μC/OS-III 的真正 PIP，而不是 μC/OS-II 预留优先级的做法。

### RT-Thread

RT-Thread 由熊谱翔（Bernard Xiong）于 2006 年发起，由上海睿赛德和社区共同维护，Apache-2.0 许可，当前版本 v5.x。它是完整 RTOS 的代表：内核（`src`，约两万行）之外，自带设备框架、DFS 文件系统、lwIP 网络栈、SAL 套接字抽象、finsh/msh shell、libc 和 pthread 子集、四百多个软件包、上百个板级支持包和十九种架构的移植。设计上大量参考 Linux：用对象基类实现面向对象的继承，设备模型仿照 Linux 设备模型，DFS 仿照 VFS，分级自动初始化仿照 Linux 的 initcall，slab 分配器仿照 Linux 的 SLAB。

#### 使用

**线程。** 动态创建用 `rt_thread_create(name, entry, param, stack_size, priority, tick)`，静态创建用 `rt_thread_init`（栈和 TCB 由用户提供）。优先级**数字越小越高**；`tick` 是同优先级的时间片，必须不为零。线程创建后处于挂起状态，必须调用 `rt_thread_startup(tid)` 才进入就绪队列。

**六类 IPC。** 信号量 `rt_sem_*`；互斥量 `rt_mutex_*`（自带 PIP，并通过 `rt_mutex_setprioceiling` 提供 PCP 的上限）；消息队列 `rt_mq_*`（按值复制）；邮箱 `rt_mb_*`（只传一个机器字，常用来传指针，比消息队列轻）；事件集 `rt_event_*`（32 位标志的与、或组合）；软件定时器 `rt_timer_*`（硬定时器在节拍中断上下文里执行回调，软定时器在定时器线程上下文里执行，可以阻塞）。创建时 `flag` 选 `RT_IPC_FLAG_FIFO` 或 `RT_IPC_FLAG_PRIO`，决定等待者的唤醒顺序。

**设备框架。** 统一的五个 I/O 接口，用法接近 Linux 的 `/dev`：`rt_device_find("uart0")` 找到设备，`rt_device_open`，`rt_device_read`、`rt_device_write`、`rt_device_control`，`rt_device_close`；异步收发用 `rt_device_set_rx_indicate` 注册回调。串口、I2C、SPI、引脚、RTC、SDIO、CAN 等外设都通过这套接口访问。

**finsh/msh shell 与自动初始化。** 两者都靠链接段加宏注册实现：

- 在任意 `.c` 文件里写一个函数，再用 `MSH_CMD_EXPORT(func, "desc")`，宏把命令描述放进名为 `FSymTab` 的链接段，shell 启动时遍历这个段查表执行。新增命令不用改 shell 本身。
- 组件的初始化函数用分级宏 `INIT_BOARD_EXPORT`、`INIT_DEVICE_EXPORT`、`INIT_COMPONENT_EXPORT`、`INIT_APP_EXPORT` 注册到链接段，启动时按级别依次调用，不用手改 `main`。shell 本身就是通过 `INIT_APP_EXPORT(finsh_system_init)` 自动启动的。

**配置与移植。** 用 `menuconfig`（Kconfig）裁剪并生成 `rtconfig.h`，主要开关有 `RT_THREAD_PRIORITY_MAX`（8、32 或 256，超过 32 时用二级位图）、各类 IPC 的独立开关、三种内存分配器（small、memheap、slab）、`RT_USING_SMP` 多核、`RT_USING_DFS` 文件系统、`RT_USING_SMART`（lwp 用户态）。移植一块新板子要准备 `libcpu`（已有 rv、aa、x86 等十九种）、在 `board.c` 里写三件事（堆初始化、串口、节拍）、把串口驱动注册成设备、写链接脚本（包含 `FSymTab` 等特殊段）。rv 的 `bsp/qemu-virt64-riscv/` 是完整的模板。

#### 实现

RT-Thread 的面向对象风格来自对象基类 `rt_object`：线程、信号量、互斥量、消息队列、设备都嵌入一个 `rt_object parent`（包含名字、类型、链入对象容器的节点），所以能统一 `find`、`list` 和管理生命周期，比 FreeRTOS 各自独立的句柄更有条理。

调度器分成三个文件：`scheduler_up.c`（单核）、`scheduler_mp.c`（SMP 多核）、`scheduler_comm.c`（单核和多核共用的部分），编译时由 `RT_USING_SMP` 选择。就绪表是 `rt_thread_priority_table[]`（每个优先级一条 FIFO 双向链表）加 `rt_thread_ready_priority_group` 位图，用 `__rt_ffs(group)` 找最低置位位，O(1) 选出最高优先级，超过 32 个优先级时再加一张二级表。抢占只有一个入口 `rt_schedule()`：关中断，检查调度锁，选出最高优先级的就绪线程，与当前线程比较（优先级更高，或者同级且当前线程已让出，才切换），需要切换就把旧线程放回就绪表、取出新线程，调用 `rt_hw_context_switch`。

三者中 RT-Thread 的优先级反转处理最完整：互斥量同时实现 PIP 和 PCP，并支持**逐级传递**，`_thread_update_priority` 在被阻塞的线程又在等另一个互斥量时，沿持有者链递归提高优先级，解决嵌套的优先级反转。软件定时器用跳表（skip list）加快有序插入。rv 的上下文切换在 `libcpu/risc-v/common64/context_gcc.S`：首次启动的 `rt_hw_context_switch_to` 只恢复不保存，普通的 `rt_hw_context_switch` 先保存旧线程的上下文和栈指针，再加载新线程；新线程的初始栈帧由 `rt_hw_stack_init` 预先构造，`ra` 指向统一的入口，首次切入和普通切换走同一条恢复路径。

#### 特点与仿写

完整 RTOS 的代价是规模和复杂度，好处是拿来就能用、工程配套齐全（Kconfig 裁剪、scons 构建、包管理）。RT-Thread 的 RT-Smart（lwp）还可以启用基于 MMU 的用户态多地址空间，介于纯 RTOS 和宏内核之间。仿写完整 RTOS 与库式 RTOS 的不同在于：要先建立对象模型（统一的对象基类，用来统一管理所有内核对象），再在调度器之上加设备框架（统一 ops 表的 `find/open/read/write`）、基于链接段的自动初始化和 shell 命令注册。「链接段加分级宏」这套做法，是教学内核和能支撑大量 BSP 与组件的工程化内核之间的关键区别。

### 优先级反转的三种对策

优先级反转是 RTOS 必须解决的正确性问题：高优先级任务 H 需要一把被低优先级任务 L 持有的锁而等待，这时中优先级任务 M 就绪并抢占了 L，L 迟迟不能释放锁，H 被 M 间接地无限期阻塞。1997 年火星探路者号着陆后反复重启，原因就是优先级反转。对策有三种：

- **优先级继承（PIP，Priority Inheritance Protocol）**：H 等待 L 持有的锁时，临时把 L 的优先级提高到 H，M 就不能抢占 L，L 尽快释放锁后恢复原优先级。实现简单，只在需要时触发。
- **优先级上限（PCP，Priority Ceiling Protocol）**：每把锁预先设定一个上限优先级（等于所有可能使用它的任务中的最高优先级），任务一持有锁，优先级就升到上限。可以防止死锁，响应时间波动小，但需要事先静态分析出上限，不够灵活。
- **逐级传递**：被阻塞的持有者自己又在等另一把锁时，沿持有者链递归提高优先级，解决多层嵌套的反转。

| 内核 | PIP | PCP | 逐级传递 | 实现方式 |
|:--:|:--:|:--:|:--:|:--:|
| FreeRTOS | √ | × | × | 互斥量自带 PIP，只处理一层 |
| μC/OS-II | ! | √ | × | PCP，但要预留一个空闲的高优先级 |
| μC/OS-III | √ | × | √ | 真正的 PIP（`OS_TaskChangePrio`），释放时逐级恢复 |
| RT-Thread | √ | √ | √ | 三者中最完整，PCP 通过 `rt_mutex_setprioceiling` 提供给应用 |

是否实现优先级继承，是工业级 RTOS 与教学内核的一个关键区别。RIOT 明确选择不做 PIP，靠「互斥的临界区足够短」这一设计约束来避免，见「ariel-os 与 RIOT」。

### 三者对比与仿写步骤

| | FreeRTOS | μC/OS-II / III | RT-Thread |
|:--:|:--:|:--:|:--:|
| 起源 | 2003，Richard Barry / AWS | 1998 / 2009，Jean Labrosse | 2006，熊谱翔 |
| 许可 | MIT | Apache-2.0 | Apache-2.0 |
| 类型 | 库式（约 9K 行） | 库式，可认证（7.5K / 10.5K 行） | 完整 RTOS（内核约 20K 行加组件） |
| 优先级方向 | 数字越大越高 | 数字越小越高 | 数字越小越高 |
| 选最高优先级 | 位图加 CLZ，O(1) | II：8×8 位图加常量表；III：CLZ | 位图加 `ffs`，O(1) |
| 同优先级 | FIFO / 时间片 | II：没有（每级一个任务）；III：轮转 | FIFO / 时间片 |
| 节拍处理 | 两张有序延时表 | II：O(N) 遍历；III：增量链表，接近 O(1) | 跳表加每个线程内置的超时 |
| 优先级反转 | PIP | II：预留优先级的 PCP；III：真正的 PIP 加逐级传递 | PIP、PCP 和逐级传递 |
| IPC 设计 | 全部归结为队列 | II 统一用 ECB，III 统一用 `OS_Pend` | 六类原语统一基于 `rt_ipc_object` |
| 移植层 | 放在内核目录里 | 独立的 `Ports/` 三个文件 | 独立的 `libcpu/` 加 BSP 三件事 |
| 配套组件 | FreeRTOS-Plus | Micrium 组件 | 自带 DFS、lwIP、finsh、软件包 |
| rv 上的切换方式 | 在陷阱处理里直接切换 | `MSIP` 软件中断 | `context_gcc.S` 直接切换 |

综合三者，仿写 RTOS 的步骤是：**对象与数据结构，就绪表与选优先级，移植层与上下文切换，节拍与时间片，统一的调度入口，IPC 抽象，优先级反转，上层对象，编译时裁剪**。库式内核可以不要对象基类，直接用句柄；完整 RTOS 应先建立统一的对象模型，再在上面加设备框架、文件系统和 shell 的链接段注册机制。这套步骤对其他内核同样适用：异步运行时把上下文切换换成轮询 Future，宏内核在统一调度入口之上加地址空间，结构不变。

## 用异步运行时调度：embassy

RTOS 用「每个任务一个栈加抢占切换」实现并发。另一种做法是把异步运行时（async runtime）直接当作内核的调度框架，用协作式的 Future 代替抢占式的线程。协程与 `async`/`await` 的语言机制（状态机生成、`Future`/`Waker`、`Pin`、无栈协程）这里不展开，只看异步运行时作为裸机上的内核时，调度、内核对象、移植这些问题的答案有什么不同。embassy 是这方面最成熟的项目。

embassy 由 Dario Nieuwenhuis（Dirbaio）于 2020 年发起，是第一个可用于生产的嵌入式异步 Rust 运行时，自带一整套 HAL，MIT/Apache 双许可，核心 `embassy-executor` 只有约两千行。官方的说法是它「不需要传统 RTOS 内核的上下文切换，比 RTOS 更快、更小」。

#### 使用

**入口与任务。** 一个最小的 embassy 程序：

```rust
#[embassy_executor::main]
async fn main(spawner: Spawner) {
    let p = embassy_stm32::init(Default::default());
    spawner.spawn(blink(p.PB7.into())).unwrap(); // 创建一个任务
    let mut led = Output::new(p.PB14, Level::High, Speed::Low);
    loop {
        led.set_high();
        Timer::after_millis(300).await; // 唯一的让出点
        led.set_low();
        Timer::after_millis(300).await;
    }
}

#[embassy_executor::task]
async fn blink(pin: Peri<'static, AnyPin>) {
    let mut led = Output::new(pin, Level::High, Speed::Low);
    loop {
        led.toggle();
        Timer::after_millis(500).await;
    }
}
```

`#[embassy_executor::main]` 宏把 `main` 本身也包装成一个任务，展开为「创建 `Executor`，再 `executor.run(|spawner| spawner.spawn(__main(spawner)))`」，`main` 只是第一个被创建的任务。标注了 `#[embassy_executor::task]` 的 async 函数在编译时要满足一组约束：必须是 async，不能是泛型，不能有 `where` 约束，参数不能借用非 `'static` 的引用（任务可能一直存在，参数也必须一直有效）。默认每个任务定义同时只能有一个实例，再次 `spawn` 返回 `SpawnError::Busy`；要同时运行多个实例须写 `#[task(pool_size = 4)]`，代价是预留 4 份静态任务存储。

`Spawner` 不是 `Send`，只能在本执行器所在的线程里创建任务（包括 `!Send` 的任务）；跨线程或在中断里创建要用 `SendSpawner`（`spawner.make_send()`），这时任务参数必须是 `Send`。`Spawner` 是 `Copy`，通常作为参数逐层传给各个任务。

**时间。** `Timer::after_millis(300).await` 把当前任务挂起到指定时间；`Ticker::every(Duration::from_secs(1))` 加 `ticker.next().await` 做不漂移的周期任务；`fut.with_timeout(d).await` 给任意 Future 加超时。这需要在 `Cargo.toml` 里选择 `embassy-time` 的节拍频率特性，并由芯片 HAL 提供时间驱动。

**同步原语。** embassy-sync 的对象都声明为 `static`，等待时都只挂起当前任务，不阻塞执行器：

```rust
static SIG: Signal<CriticalSectionRawMutex, Cmd> = Signal::new();      // 单槽信号，新值覆盖旧值
static CH: Channel<CriticalSectionRawMutex, u32, 8> = Channel::new(); // 有界多生产者多消费者队列
static M: Mutex<NoopRawMutex, State> = Mutex::new(State::new());      // 异步互斥锁
```

对应的操作是 `SIG.signal(v)` / `SIG.wait().await`、`CH.sender().send(v).await` / `CH.receiver().receive().await`、`M.lock().await`。关键是选对 `RawMutex`：要在中断里访问用 `CriticalSectionRawMutex`，同一个执行器内的任务之间用开销更小的 `NoopRawMutex`。

**外设与中断。** `embassy_xxx::init()` 返回外设单例，每个外设是只能移动的 `Peri<'static, _>`，靠所有权在编译时防止同一个外设被两处使用。中断驱动的外设要用 `bind_interrupts!` 宏把中断向量绑定到 HAL 的处理程序，宏生成一个 `extern "C"` 的中断入口，调用 `Handler::on_interrupt()`。

**裁剪与移植。** `embassy-executor` 必须选一个 `arch-*` 特性（`cortex-m`、`riscv32`、`std`、`wasm` 等）和执行器模式（线程模式 `executor-thread`，中断模式 `executor-interrupt`，后者只支持 Cortex-M，RV32 上编译时禁用）。移植到新平台只需做两件事：一是执行器的平台支持，提供 `__pender` 函数通知运行时重新轮询（Cortex-M 用 `sev` 或 NVIC pend，rv 设一个原子布尔量）；二是时间驱动，实现 `embassy_time_driver::Driver`（`now()` 和 `schedule_wake()`）。芯片的 HAL crate 就是把这两部分和各外设的异步封装打包在一起。

#### 实现

embassy 把传统内核的几乎每个部件都换掉了。

**执行器就是调度器，没有单独的调度线程。** 核心循环是 `run()`：`loop { self.poll(); wfi(); }`（Cortex-M 用 `wfe`，rv 用 `wfi`）。没有时钟节拍抢占，没有上下文切换，没有按优先级排序的就绪表，调度就是把就绪队列里的 Future 各轮询（poll）一遍。

**就绪队列是无锁的多生产者单消费者单链表栈，不是优先级表。** 入队用 CAS 把任务接到链表头；出队用一次原子操作取走整条链表，再逐个轮询。一批跑完才处理下一批，所以任务唤醒自己也不会饿死其他任务。轮询的主体 `SyncExecutor::poll` 取出整批任务，对每个任务调用 spawn 时写入的 `poll_fn`，后者构造 `Waker` 并调用 `future.poll(cx)`；返回 `Ready` 就丢弃 Future，把 `poll_fn` 改成退出状态并注销任务。

**唤醒就是中断驱动的调度。** `Waker` 的数据字段直接存任务指针（只占一个机器字），它的 `wake` 实现 `wake_task` 原子地设置「已入队」位，如果之前没设置，就把任务放进所属执行器的就绪队列；队列由空变为非空时，调用平台钩子 `pender.pend()` 唤醒运行时。`pender` 最终调用移植者实现的 `__pender`：Cortex-M 线程模式用 `sev` 让 `wfe` 退出休眠，rv 设置一个原子布尔量配合 `wfi`，中断模式则用软件触发一个 IRQ。典型过程是：外设中断，调用任务的 waker，`wake_task`，入队，`pend`，执行器醒来轮询。

**抢占靠多个执行器加中断优先级，不靠内核抢占。** 单个执行器内是协作式的，`.await` 是唯一的让出点。一个长时间不 `await` 的 CPU 密集任务会独占执行器，饿死同一执行器里的其他任务，这是协作式调度本身的代价。要真正的抢占就运行多个执行器：线程模式的执行器在最低优先级，`InterruptExecutor` 绑定到一个空闲的 IRQ，高优先级 IRQ 上的执行器自然能抢占低优先级的，能有几层抢占取决于中断优先级的位数。默认按入队顺序轮询，打开 `scheduler-priority` 或 `scheduler-deadline` 特性后，改用有序链表按优先级或截止期出队，相当于单个执行器内的软优先级。

**切换任务就是函数返回。** 传统 RTOS 切换任务要保存约十八个寄存器并切换栈指针，大约一百个周期；embassy 的切换就是 `future.poll` 返回 `Pending`，不到十个周期，不保存寄存器，不切栈。所有任务共用一个栈，栈的深度等于所有 `await` 链中最深的一条；任务状态保存在编译时生成的 Future 状态机里（在静态任务存储中），不在栈上。所以它比 RTOS 小：不必为每个任务预留独立的栈。

**内核对象是 Future 加任务头，不是 TCB 加栈。** 任务存储 `TaskStorage<F>` 是 `#[repr(C)]` 的「任务头加 Future」，任务头在偏移 0，任务头指针和存储指针可以安全互相转换。任务头包含一个只有两位的原子状态字（已创建 SPAWNED、已入队 RUN_QUEUED）、就绪链表节点、执行器指针、`poll_fn` 和定时器节点。这两位状态用 `fetch_or`/`fetch_and` 保证一个任务同时只在队列里出现一次，不需要锁。embassy 没有单独的队列、信号量、互斥量内核对象，它们都在 embassy-sync 里用 `Future` 加 `Waker` 实现：一把阻塞锁保护内部状态和保存的 `Waker`，轮询时检查条件，不满足就保存 `cx.waker().clone()` 并返回 `Pending`，另一方改变状态后调用 `waker.wake()`。异步互斥锁底层的阻塞锁只在修改标志的一瞬间持有，不在整个临界区持有，所以异步锁不阻塞执行器，只挂起当前任务。定时器节点直接放在任务头里（不需要额外分配），整个系统共用一条定时器队列。

**仿写一个最小的异步运行时**，核心抽象与 RTOS 完全不同：不要 TCB 和栈，而是「放在静态存储里的 Future、一个就绪队列、一个轮询循环和 `Waker`」，约一千行就能运行。步骤：定义 `#[repr(C)]` 的「任务头加 Future」存储，擦除类型后用裸任务指针表示；写两位的原子状态（已创建、已入队），保证不重复入队；写无锁的就绪队列（CAS 入队，原子地取走整批），没有原子指针的小核改用临界区保护普通的栈；写 `Waker`，数据字段放任务指针，`wake` 就是入队加通知；写平台钩子 `__pender`，把运行时和硬件唤醒分开，主循环 `poll` 之后 `wfe`/`wfi` 省电；用过程宏把 async 函数变成返回 spawn 令牌的函数（检查约束、声明静态任务池、直接在存储里构造 Future，避免栈上复制）；定时器用 trait 加链接时注入，而不是泛型，保证全局只有一个时间基准，时刻可以比较；同步原语都用 `Future` 加 `Waker`，不做内核对象，`RawMutex` 做成泛型参数；抢占用多个执行器加中断优先级，可选用有序链表做软优先级或 EDF。

#### ariel-os 与 RIOT

embassy 是运行时，不是完整的操作系统，没有文件系统、shell、包管理。有两个相关项目补上了这部分，一个在异步之上加传统抢占，一个是纯传统抢占：

**ariel-os**（2024，前身 RIOT-rs，柏林自由大学与 Inria，MIT/Apache）建立在 embassy、esp-hal、defmt、probe-rs 之上：复用 `embassy_executor::Executor` 的异步部分，再加上基于 `ariel-os-threads` 的抢占式多线程调度器、可移植的外设 API、网络与安全、laze 构建系统。`#[ariel_os::main]` 启动异步任务，`#[ariel_os::thread(autostart, priority=2)]` 声明真正的抢占式线程，两者共存：异步任务处理 IO 密集的逻辑，抢占式线程处理硬实时或 CPU 密集的逻辑。它的抢占调度器是 RIOT 经典 bitcache 调度器用 Rust 常量泛型重写的版本：位图加每个优先级一条环形链表，用 `ffs` 选出最高优先级，优先级数和线程数由编译时的常量泛型决定，比 C 的宏更类型安全。可以说 ariel-os 是同一批人用 Rust 重做的 RIOT。

**RIOT**（2013，柏林自由大学与 Inria，LGPLv2.1）是学术界主导的成熟 IoT RTOS，走传统的抢占式路线：真正的 TCB 加每个线程一个栈，真正的上下文切换。它是唯一同时支持 8 位、16 位、32 位处理器的 RTOS（五十多个 CPU 系列、近三百块板子）。内核很小（约两千行 C），其余都在系统库、驱动和外部包里（总共近两百万行）。调度器 `sched_run()` 用 `bitarithm_msb`（一条 CLZ）从位图中找出最高优先级的就绪队列，寄存器的保存和切栈在各架构的 `thread_arch.c` 里（rv 用 `mret` 加保存寄存器，Cortex-M 用 PendSV）。它的 IPC 原则是消息优先于互斥，首选 `msg_send`/`msg_receive` 这套类似 RPC 的消息传递；它的互斥量故意不实现 PIP，靠「临界区足够短」这一设计约束来避免优先级反转，与「优先级反转的三种对策」里三个工业 RTOS 的选择不同。RIOT 自己开发的 GNRC 网络栈是 6LoWPAN、RPL、CoAP、OSCORE、SUIT 等 IETF 协议的开源参考实现，常被 IETF 草案引用。

| | embassy | RIOT | ariel-os |
|:--:|:--:|:--:|:--:|
| 语言 | Rust | C | Rust |
| 并发模型 | 协作式异步（Future） | 抢占式多线程 | 异步与抢占式多线程结合 |
| 任务的形式 | Future 状态机（共用栈） | TCB 加每线程独立的栈 | 两者都有 |
| 切换开销 | 函数返回（不到 10 个周期） | 保存寄存器加切栈（约 100 个周期） | 取决于任务类型 |
| 调度点 | `.await` | 节拍抢占或主动让出 | 异步协作加线程抢占 |
| 选最高优先级 | 默认不分优先级（可选有序链表） | CLZ 位图 | `ffs` 位图（常量泛型） |
| 完整程度 | 运行时加 HAL（没有文件系统和 shell） | 完整 RTOS 加 GNRC 网络栈 | 集成的操作系统 |
| 起源 | 2020，Dirbaio | 2013，柏林自由大学与 Inria | 2024，与 RIOT 同一团队 |

#### 异步运行时与传统 RTOS 怎么选

异步运行时省内存（不需要 N 份栈，任务状态紧凑地存在静态存储里）、功耗低（自动 `wfe`/`wfi`）、适合 IO 密集的并发（一个任务写一条 TCP、USB 或 BLE 连接的 `await` 链），还能借 Rust 的所有权在编译时防止外设被两处占用和 `!Send` 的误用；代价是单个执行器内没有真正的抢占，CPU 密集任务会饿死同伴，配套组件不如传统 RTOS 完整，RV32 暂不支持中断执行器。传统的抢占式 RTOS 在硬实时的确定性、CPU 密集和混合负载、成熟的配套上更可靠。两者可以结合：ariel-os 用异步执行器运行 IO 密集的任务，用抢占式线程运行硬实时和 CPU 密集的任务。

## 各类内核的源码

RTOS 和异步运行时之后是结构完整的内核：宏内核、微内核、组件化内核与框内核、外核与 Unikernel、异步内核。对这些内核，重点不在怎么使用，而在读源码，弄清它们有什么、为什么这样设计、怎样实现，目的是能自己写出一个同类甚至更好的内核。

先看所有内核共有的启动过程：从上电到运行用户程序，都是 `_start` 汇编（清 BSS、设栈、建初始页表），主入口（一串 init 调用），创建第一个用户进程，进入调度主循环。各类内核的区别落在几个方面：语言、是否兼容 Linux ABI、调度算法、HAL 的厚薄、组件是自己写还是复用、特权边界划在哪里。下面逐类看，最后在「内核结构的分类与衍生」里归入「单微宏外库框」的分类。

### 宏内核

宏内核（monolithic kernel）把调度、内存、文件系统、网络栈、驱动都放在同一个内核地址空间、同一个特权级里，子系统之间直接函数调用。Linux 和传统 Unix 都是宏内核，性能好（没有跨域开销），代价是任何一处缺陷都可能导致整个内核崩溃。下面六个宏内核从教学一直排到工业。

**xv6。** MIT 6.828 的教学内核，约 6500 行 C，全部放在顶层目录、不分子目录，21 个系统调用，每个文件对应教材的一个概念。它把内核的工作方式展示得最直接：启动序列 `main.c:18` 依次调用十四个 init；调度器 `proc.c:323` 是每个 CPU 一个 `for(;;)`，遍历全局进程表找到 RUNNABLE 的进程再 `swtch` 过去，是最简单的轮转。整个内核最值得单独读的是 `swtch.S` 的十来行：保存四个被调用者保存寄存器，`movl %esp,(%eax)` 保存旧栈，`movl %edx,%esp` 换成新栈，`ret`。**线程切换就是两组寄存器的保存与加载，中间夹一个 `ret`**。物理页分配器 `kalloc.c` 没有额外开销：空闲链表的节点就是空闲页本身，`next` 指针直接写在页的开头。文件系统分六层（fd、路径、目录、inode、日志、缓冲区、磁盘），其中 `log.c` 的崩溃恢复日志是理解 ext4 jbd2、xfs log 的入门例子。xv6 没有 HAL（只支持一种架构），一个文件一个驱动、没有统一框架，自定义 21 个系统调用、不兼容 Linux，适合作为后面各个内核的对照。

**tg-rcore：用 Rust 重写 xv6，逐章增加功能。** 来自清华的 rCore-Tutorial，约一万四千行 Rust，按两个方向组织：章节方向（ch1 到 ch8 各是一个可以独立运行的 cargo crate，每章增加功能）和组件方向（sbi、console、syscall、kernel-vm、easy-fs 等共用的 crate）。它的调度主循环用 Rust 枚举匹配陷阱原因：`match scause::read().cause()` 区分 `SupervisorTimer`（时钟中断，切换任务）和 `UserEnvCall`（处理系统调用），比 C 的 `switch(scause)` 类型安全。最值得借鉴的是**一个 crate 提供系统调用的两端**：同一个 crate 用 cargo feature 切换，编进用户程序时提供调用号和内联 `ecall`，编进内核时提供 `trait` 由内核实现，并用 `compile_error!` 保证两个 feature 不能同时打开。用户态和内核态共用同一份编号定义，编号不会不一致。

**DragonOS：兼容 Linux ABI 的工业宏内核。** 国产，约十九万行 Rust 加六万行 C，兼容约四分之一的 Linux 系统调用，目标是在生产环境替代 Linux，是六个例子里唯一包含 BPF、cgroup、namespace、overlayfs、KVM 的非教学内核。它的复杂度可以和 Linux 本身对照：启动函数 `init/init.rs:56 do_start_kernel()` 有十九段以上的 init（xv6 是十四段，tg-rcore 是五段）；进程控制块 `process/mod.rs:1132 ProcessControlBlock` 直接对应 Linux 的 `task_struct`，包含 tgid（线程组）、nsproxy（命名空间代理）、pid_links，`process/` 目录下二十五个文件实现了 `clone()`、`wait4()`、`setns()`、`unshare()` 的完整语义；调度器 `sched/` 完整复刻了 Linux 的 CFS，连 `pelt.rs`（Per-Entity Load Tracking）都有；系统调用 `syscall/mod.rs` 分两层（先查动态注册的系统调用表，再查原来的 match），编号与 Linux 相同；驱动 `driver/base/` 完整复刻了 Linux 的 kobject、kset、bus、class、device 设备模型。要写一个兼容 Linux 的内核，DragonOS 是首选的参考。

**StarryOS：基于 ArceOS 的薄宏内核。** 本身只有约一万四千行 Rust，因为内存、驱动、调度、HAL 都在 ArceOS 的 crate 里。它结合了宏内核和组件化，是 ArceOS 宏内核形态的一个实例。它的 `Cargo.toml` 把 axalloc、axfs、axhal、axmm、axsync、axtask 都列为依赖，进程模型直接用外部的 `starry-process` crate，自己只写 fork、exec、系统调用、fd 这一层宏内核语义。用户任务的主循环是核心：`uctx.run()` 进入用户态，返回一个 `ReturnReason` 枚举，用 `match` 分发系统调用、缺页、中断、异常。ArceOS 把「进入用户态」抽象成「返回一个 `ReturnReason`」，与 tg-rcore 的「执行后匹配 scause」是同一种做法，但更简单。系统调用用 `syscalls` crate 的 `Sysno` 枚举，编号与 Linux 一致，这是它能直接运行 busybox 和 musl 程序的关键。StarryOS 是用组件拼装宏内核的例子，它和 ArceOS 的关系见「内核结构的分类与衍生」。

**NoAxiomOS：用异步无栈协程的宏内核。** 杭州电子科技大学团队的作品（2025 年全国大学生计算机系统能力大赛操作系统内核实现赛道一等奖），约四万行 Rust，自己实现了 RV64 和 la64 两套 HAL。它最大的特点是**系统调用本身是 `async fn`**：`syscall/syscall.rs` 的 `async fn syscall_inner` 里写 `SYS_READ => self.sys_read(...).await`，整个系统调用处理是一个 Future，遇到 I/O 阻塞就 `.await` 让出当前任务；内核里运行一个 Future 执行器（`sched/runtime.rs` 的 `RUNTIME`），某个系统调用的 Future 阻塞时就调度下一个任务。传统宏内核的系统调用同步阻塞，让整个线程睡眠等待；NoAxiomOS 用无栈协程实现了不阻塞的内核，效果相当于内核态的 io_uring 或 epoll，但用 Rust async 编写。它可以和「异步内核」里的另外两种做法对照。

**biscuit：用带垃圾回收的高级语言写的内核。** 下面根据 OSDI'18 论文《The benefits and costs of writing a POSIX kernel in a high-level language》整理，源码在 mit-pdos/biscuit。它约两万八千行 Go，加上改造过的 Go 运行时，证明了带垃圾回收（GC）的高级语言也能写出可用的操作系统内核：内核对象由 Go 的 GC 管理（GC 暂停要控制在一百微秒以内），每个用户进程对应一个 goroutine，用 channel 和 select 代替信号量和等待队列。最难的是 Go 运行时默认依赖宿主操作系统的 mmap、futex、sigaction，biscuit 要把这些全部换成内核内部的实现。论文测得它比 Linux 慢约 5% 到 15%，开销主要来自 GC 和运行时。它可以和 Rust 内核对照：Rust 用借用检查和编译时管理提供安全性，没有 GC 暂停；biscuit 用有栈的 M:N goroutine，而不是 NoAxiomOS 那样的无栈 Future。

六个内核的区别可以归纳为几个方面：

| | xv6 | tg-rcore | DragonOS | StarryOS | NoAxiomOS | biscuit |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 语言 | C | Rust | Rust+C | Rust | Rust | Go（带 GC） |
| 主入口 | `main.c:18` | 各章的 `rust_main` | `init.rs:42` | `entry.rs:20` | `init.rs:69` | `main.go` |
| 物理页分配 | 空闲链表（页本身作节点） | 自己的 crate | buddy 加 slab | ArceOS axalloc | 帧分配器 | Go 的 GC 堆 |
| 调度 | 轮转 | 轮转 | 类 CFS 加 PELT | ArceOS axtask | Future 执行器 | Go 运行时 |
| 系统调用 | 函数指针表（21 个） | 两端共用的 crate 加 trait | 两层表加 match | `Sysno` 枚举 | `async fn`（`.await`） | 运行时拦截 |
| Linux ABI | ×（自定义 21 个） | ×（自定义约 50 个） | √（约 25%） | √（`Sysno` 与 Linux 一致） | √ | POSIX 子集 |
| HAL | 无 | 无 | 厚 | ArceOS axhal | 厚（自研两种架构） | 无 |
| 复用 | 全部自己写 | 自己的 13 个 crate | 以自研为主 | 大量复用 ArceOS | 全部自己写 | 全部自己写 |

写宏内核要先定下这几件事：语言（C 贴近硬件，Rust 有所有权保证安全，Go 验证带 GC 的语言是否可行），是否兼容 Linux ABI（教学内核和工业内核的关键区别，决定能否直接运行 busybox 和 musl 程序），调度算法，HAL 的厚薄（厚的容易移植到多种架构，但启动代码难读），组件是自己写还是复用。这五件事定下来，内核的样子就基本定了。

### 组件化内核与框内核

组件化（componentized）**不是第六种内核结构**，而是一种与宏内核、微内核、外核、库 OS、框内核都可以组合的实现方式：用 cargo crate 划分模块边界，用 cargo features 控制组装，用 Rust trait 定义接口，再由一个顶层的组装 crate 按依赖顺序拼起来。所以有组件化的宏内核和 Unikernel（arceos），组件化的框内核（asterinas），组件化的单地址空间内核（Theseus）。

它与微内核的区别：微内核是**运行时分离**，子系统拆成多个进程，靠 IPC 通信，用性能换可靠性；组件化是**编译时分离**，子系统拆成多个 crate 编进同一个二进制，运行时共享地址空间，保留宏内核的性能，靠 Rust 类型系统在编译时保证可靠性。前者把隔离放在运行时，后者放在编译时。

**arceos：一套模块，三种形态。** 清华 rcore-os 团队把 rCore Tutorial 组件化重构的结果，参考了 Unikraft。它的组件化体现得最直接：启动入口 `axruntime/src/lib.rs` 的 `rust_main` 就是一串 `#[cfg(feature=…)]` 块，`init_allocator`（`alloc`）、`init_memory_management`（`paging`）、`init_scheduler`（`multitask`）、`init_drivers`/`init_filesystems`（`fs`/`net`/`display`）按 feature 在编译时增减，最小的 Unikernel 只有约 80 KB。最关键的文件是 `api/axfeat/Cargo.toml`：它把 cargo features 当作物料清单，每个 feature 右边是一组下游 feature 的并集，feature 之间的依赖（如 `net = ["alloc","paging",…]`）在编译时排除不合理的组合。同一套 `modules/` 靠 features 组合出三种形态：默认是 Unikernel（应用和内核在同一特权级、同一个 ELF）；打开 `uspace`，axcpu 提供 `UserContext::run()` 和陷阱原因枚举，成为带用户态进程边界的宏内核基础；再加上 axvm、axvcpu 等 crate，启动后进入 H 模式（rv）、EL2（aa）或 root 模式（x86），成为 Hypervisor。

arceos 最值得学的是**衍生出新系统不需要 fork 源码**，StarryOS 和 AxVisor 都是这样做的。它提供四种扩展点，下游不改 arceos 源码就能做出新的操作系统：`uspace` feature 把单地址空间的 Unikernel 变成宏内核的基础（StarryOS 在此之上加系统调用和 Linux ABI，运行 musl 程序）；`TaskExtRef<T>`（task_ext）让下游把自己的每任务数据（进程、线程、fd 表、信号）挂到 arceos 的 `TaskInner` 上，arceos 不需要知道扩展的内容，调度器属于 arceos，业务数据属于下游；`crate_interface` 提供反向回调，下层模块声明 trait 接口、上层提供实现，突破 Rust 中上层依赖下层的单向限制（例如 axlog 可以回调上层获取当前任务号）；axns 命名空间为多进程隔离预留了全局和线程局部两种命名空间。衍生靠编译时组合加 trait 扩展点，而不是复制一份源码，这是组件化在工程上最有价值的地方。

tg-arceos 是 arceos 的教学示例集（约二十个独立的 crate），按形态的难度递增：Unikernel 组（helloworld、集合类型、直接访问 MMIO、多线程、协作调度、CFS 抢占、virtio-blk、读 FAT 文件）、宏内核组（用户特权级、按需缺页、运行真实的 musl ELF）、Hypervisor 组（最简单的虚拟机、二级缺页、虚拟设备、在虚拟机里运行完整的 arceos）。做完一遍就接触了 arceos 的三种形态，是理解 cargo features 怎样影响二进制和形态边界的好材料。

**asterinas：框内核（framekernel）。** 框内核由蚂蚁集团操作系统实验室提出，论文是 USENIX ATC'25 的《Asterinas: A Linux ABI-Compatible, Rust-Based Framekernel OS with a Small and Sound TCB》（arXiv 2506.03876），相关的还有 SOSP'25 论文 CortenMM。根据论文和官方的 Asterinas Book，框内核的定义是：整个操作系统在**单一地址空间**（与宏内核一样，没有跨域 IPC 的开销），全部用 Rust 编写，但逻辑上分成两部分：

- **OS Framework（即 OSTD）**：可以使用 `unsafe` Rust，把底层的不安全操作封装成安全的高层 API，代码量小，是整个内核唯一的可信计算基（TCB）。论文测得这部分只占代码量的约 14%。
- **OS Services（即 `kernel/`）**：**禁止 `unsafe`**，用纯 safe Rust 实现所有具体功能（文件系统、进程、网络、两百多个系统调用），代码量大。

「框」指的就是这层很小、可以审计、只有它能用 `unsafe` 的框架，其余服务都是建立在它上面的安全代码。源码里能直接看到：`kernel/src/lib.rs:8` 一行 `#![deny(unsafe_code)]`，让整个 aster-kernel（包括一百七十多个系统调用文件、文件系统、进程、网络）在编译时禁用 `unsafe`。这是框内核与普通组件化宏内核在工程上的区别：arceos 所有模块都允许 `unsafe`，靠开发者自觉；框内核把内存安全的 TCB 强制限制在 OSTD 这一小块。框架必须满足四个要求：健全（没有 unsound 的接口）、表达力足够（用 safe Rust 能写驱动）、最小（TCB 越小越好）、高效（零开销）。

实现上，OSTD 把内核原语封装成安全的类型：`ostd/src/mm/mod.rs` 把底层内存模块都标成 `pub(crate)`，外部的 `kernel/` 拿不到原始的物理地址，只能通过 `FrameAllocOptions`、`VmSpace`、`VmReader`/`VmWriter` 这些类型操作内存；连读用户态地址都由 `VmReader`/`VmWriter` 封装成安全操作（内部做边界检查，出现缺页异常时回滚），系统调用的实现里没有裸指针。组件系统是框内核的另一部分：用 `inventory`（链接段注册）加 `Components.toml` 白名单，每个标注了 `#[init_component]` 的函数自动登记，`init_all(stage)` 按 Bootstrap、Kthread、Process 三个阶段依次初始化；不在白名单里的 crate 即使作为 cargo 依赖引入，也会被插件报错（组件可访问性约束）。它的系统调用有一百七十二个 Rust 文件（一个文件一个调用），包括完整的 Linux `epoll`（不是用 BSD select 包装的），文件系统是 Linux 式的 VFS 加 ext2、fat32、procfs、sysfs、devfs、tmpfs 等后端，面向数据中心和自动驾驶的工业生产。

**Theseus：把隔离从硬件交给语言。** 美国莱斯大学 Kevin Boos 的博士项目（OSDI'20），试验了一种激进的结构。它的原则是 PHIS（Performance in Hardware, Isolation in Software，性能靠硬件，隔离靠软件）：**完全放弃硬件特权级和多地址空间**，所有代码（内核、驱动、库、应用）运行在同一个特权级、同一份页表上（单地址空间、单特权级，SAS-SPL），进程由线程级的 task 代替，隔离不依赖 MMU，而依赖 Rust 的类型系统。放弃硬件隔离有两个理由：Spectre 和 Meltdown 说明硬件隔离并不可靠，而类型安全的语言在编译时就能保证隔离，还省掉了特权切换和 TLB 刷新的开销。它的核心做法叫 intralingual design：把操作系统的资源管理放到语言层面，交给借用检查、生命周期、RAII 和 Drop，例如 `MappedPages` 在 Drop 时自动解除物理页映射，不会忘记释放。

实现上，Theseus 把模块单位叫作 cell（类比生物细胞：有作为公开接口的「膜」、可以重组、可以单独替换，所以它称自己为 cytokernel）。cell 与 crate 一一对应，编译后是一个 `.o` 文件，但**运行时是动态加载并链接进内存的 `LoadedCrate` 结构**，不是静态链接进一个二进制，所以每个 cell 都能在运行时单独替换和升级。连负责启动的模块也可以替换：`nano_core` 只做引导和最简单的虚拟内存，然后把控制权交给动态加载的 `captain`；运行时替换由 `crate_swap` 的 `swap_crates` 完成，支持在线演进和故障恢复。它甚至把内核的形态做成了一等对象：`simd_personality` 创建多个 `CrateNamespace`，同时运行两份代码；arceos 的形态则由编译时的 features 决定，运行时不能更换。

四者对比，组件化在两个方面有不同的取舍：

| | arceos | tg-arceos | asterinas | Theseus |
|:--:|:--:|:--:|:--:|:--:|
| 组装方式 | cargo features（axfeat） | 传递 axstd 的 features | inventory 加白名单 | features、cfg 加运行时动态加载 |
| 隔离 | MMU 加特权级 | 与 arceos 相同 | MMU 加 safe Rust 封装 | 只靠 safe Rust 类型（没有 MMU 和特权级） |
| unsafe 的范围 | 整个内核（靠自觉） | 整个内核 | 只有 OSTD（`deny(unsafe_code)` 强制） | 整个内核，但全部是 safe 代码 |
| 形态 | 3 种（编译时） | 与 arceos 相同 | 1 种（兼容 Linux） | 1 种，加运行时的 personality |
| 模块替换时机 | 编译时 | 编译时 | 编译时 | 运行时（cell 热替换） |
| 定位 | 教学与实验 | 教学 | 工业生产 | 学术原型 |

一是**组装方式**（feature、inventory、cfg 加运行时加载）；二是**隔离方式**：MMU（arceos），MMU 加 safe Rust 封装（asterinas），只靠类型隔离（Theseus），越往后运行时开销越小，对编译器和语言的依赖越大。自己写内核可以直接用的三条经验：用 cargo features 作物料清单，在编译时去掉不用的代码；用 trait 定义接口，支持多种后端；用扩展点（task_ext、crate_interface、inventory）让下游不改源码就能扩展。TCB 的范围也可以在工程上强制限制：asterinas 用 `#![deny(unsafe_code)]`、用 `pub(crate)` 封住危险的 API、再加类型封装，就是把这个框架固定下来的具体办法。

### 微内核

微内核（microkernel）与组件化相反，把隔离放在运行时。内核只保留最少的机制（地址空间、线程调度、进程间通信），驱动、文件系统、网络栈都作为用户态进程运行，相互之间靠 IPC 通信。好处是可靠（一个驱动崩溃不会拖垮内核）和可以验证（内核足够小），代价是跨域 IPC 的开销。1990 年代「微内核慢」的看法，已经被 Liedtke 的 L4 用重新设计的快速 IPC 推翻（SOSP'93）；seL4 属于 L4 家族，继承并改进了这条快速路径，又加上了形式化验证。下面三个例子是一条演进线：seL4（形式化验证、极小）、Zircon（Google Fuchsia 的工程化 C++ 实现）、zCore（清华用 Rust 重写的 Zircon）。

**系统调用数量差别很大。** 微内核与宏内核最直观的差别是系统调用表的大小。seL4 只有八个核心系统调用（Call、ReplyRecv、Send、NBSend、Recv、Reply、Yield、NBRecv，定义在 `libsel4/include/api/syscall.xml`；MCS 模式扩展到十一个），Zircon 约有一百四十三个 `sys_` 实现，zCore 对应有一百二十八条分发分支。seL4 八个就够用，是因为所有对能力的具体操作（CNode_Copy、TCB_Configure、Untyped_Retype 等约六十个 invocation）**都不是系统调用**，它们都通过 Send/Call 发给目标能力，再由内核的 `decodeInvocation()` 按能力类型解析执行。内核机制只有八条路径，用户接口有六十多个 invocation，两者完全分开。Zircon 则相反：每个功能直接做成一个系统调用，用起来方便，但接口表很大。

**IPC 快速路径决定微内核的性能。** seL4 的同步 IPC 可以做到一微秒以内（ARMv7 上论文测得几百个周期，比 Mach 早年的约一百微秒快了几个数量级）。它的 `fastpath.c` 中 `fastpath_call` 是一串检查，任何一项不满足就退回 `slowpath`：解出消息信息，确认没有错误，查找端点能力（能力树深度不超过一时是 O(1)），确认是可以发送的端点能力，确认接收方正在等待；全部通过后，取出目标线程的地址空间，切换页表，用寄存器复制消息，直接返回目标的用户态。它快在五个设计上：**跳过调度器**（同步 IPC 直接把 CPU 交给目标线程，不进就绪队列），**用寄存器传消息**（短消息走 a0 到 a3，不访问内存），**手工内联**（函数几乎全部内联，没有栈帧），**统一的异常出口**（快速路径本身不处理任何异常，有异常就退回慢路径，热路径没有多余分支），**尽量少切换页表**（只切 ASID/SATP，靠 ASID 复用避免刷新 TLB）。Zircon 和 zCore 没有这种快速路径，走的是异步 channel 加消息队列（读就是从队列 `pop_front`），性能在 1 到 3 微秒；zCore 进一步把等待变成 async Future 的 `.await`，省掉阻塞线程的栈，但写 channel 仍是向队列 push。三者底层的抽象其实相同：seL4 的端点线程队列、Zircon 的 `ChannelDispatcher.messages_`、zCore 的 `Channel.recv_queue`（一个 `VecDeque`）是同一种东西，只是工程上的取舍不同。

**三种能力（capability）系统。** 能力是微内核安全的基础：一个不可伪造的对象引用，带有一组权限位，权限只能减少不能增加。三者的实现不同：

- **seL4 用类型化能力、能力空间树和派生树**。能力是 128 位的位域，固定位置的 `capType` 字段加权限位（端点能力有可发送、可接收、可授予等位）加指向内核物理内存的指针。不可伪造靠两点：类型字段位置固定，类型不符就拒绝；能力只在内核的能力空间里传递，用户永远拿不到指针。能力空间是每个线程一棵 N 叉树，能力指针是树中的「路径加索引」。最有特点的是映射数据库（mdb）这棵派生树：A 把一份能力 mint 给 B 之后，对 A 执行 `cteRevoke` 可以递归撤销整棵派生子树，资源可以被原子地收回，这是它完整性证明的关键。所有对象都由 untyped 内存 retype 得到。
- **Zircon 用每进程的句柄表加 32 位权限**。`zx_handle_t` 是每个进程句柄表的下标（用户可见的 32 位），对应内核内部的句柄指针，每个句柄带 32 位权限，复制时只能减少权限。它是一张平表，没有 seL4 那样的多层授权和整树撤销。
- **zCore 用 `Arc<dyn KernelObject>` 加 bitflags 权限（Rust）**。句柄是「对象的 `Arc` 引用加 `Rights` 位标志」，所有对象都实现 `KernelObject` trait（由宏生成），用 `Arc`/`Weak` 的自动引用计数代替 C++ 手动的 RefPtr。

能力与 UNIX 文件描述符的区别：fd 是每个进程的整数下标，只有读、写、执行三位权限，转移靠 `SCM_RIGHTS`，关闭只影响自己，整数可以随便构造，靠内核检查拦住；能力是类型化的令牌（指针、类型和几十个权限位），mint、复制、移动都是基本操作，撤销时内核自动作用到所有派生副本，用户态拿不到指针，所以无法伪造。

**形式化验证是 seL4 独有的做法。** 这里只说与内核相关的部分。证明仓库 l4v 最初约二十万行 Isabelle（功能正确性版本，包括证明框架），之后随着新的成果累积到一百万行以上，做三层精化（refinement）：抽象规约（Isabelle/HOL，约 5K 行），可执行规约（Haskell，约 5K 行），C 实现（关键路径约 9K 行），再到编译后的二进制，每一层证明「实现层可观察的行为是规约层行为的子集」。主要成果：2009 年功能正确性（SOSP 最佳论文），2011 年完整性，2013 年机密性（信息流控制），二进制级验证，2018 年 MCS，2020 年 RV64；多核（SMP）的形式化验证仍在进行。已证明的性质包括没有缓冲区溢出、空指针解引用、除零，状态转移符合规约，没有能力就不能修改资源（完整性），没有读能力就不能读取（机密性）；编译器、汇编、bootloader、硬件 MMU/TLB 模型是假设，没有证明，时间侧信道也不在证明范围内。工程代价是证明与代码约三十比一，每加一行 C 都要重新证明，所以四十万行 C++ 的 Zircon 不做形式化验证，改用 fuzzing 加 sanitizer。要记住一个限制：验证只覆盖 `kernel.elf`，用户态的根服务器和驱动如果有 bug，系统照样会被攻破。

**调度与启动。** seL4 的调度器严格只提供机制：domain 和 priority 两级（domain 是编译时固定的分时片段，是机密性的基础；priority 在 domain 内轮转），不做公平调度，不做抢占检测，不处理优先级反转，这些策略都交给用户态通过操作 TCB 实现。启动时三者都有一个唯一的信任起点：seL4 的根服务器拥有系统中的全部能力（剩余的物理内存全部打包成 untyped 能力交给它），由它 retype 出整个用户态系统；Zircon 加载 `userboot.so`；zCore 用 cargo features 选择形态（`linux` 从 rootfs 运行 musl ELF，`zircon` 运行 ZBI）。第一个用户态进程的 bug 等同于内核 bug，所以应尽快派生出能力，让它变回普通进程。

**zCore 是 Zircon 的 Rust 重写。** 它完整展示了 C++ 内核怎样用 Rust 重做：内存安全从手动的 RefPtr 变成 `Arc`/`Weak` 自动管理（编译时排除释放后使用、数据竞争、溢出）；等待从阻塞线程的 `wait_one` 变成 async 的 `.await`（每个 Future 几十字节，而每个内核栈 16 KB）；完全兼容 Zircon ABI（能运行 Fuchsia 的 userboot）；一套对象层同时支持 zircon 和 linux 两种形态；既能在裸机上运行，也能作为 LibOS 在 Linux 上作为普通进程运行，方便调试。剩下的 `unsafe` 集中在内核硬件抽象层的物理内存和页表写入、启动早期的 GDT/IDT、调用 SBI 的 FFI，以及创建 channel 时的双向链接，需要审计的范围比整个内核小得多。自己写微内核可以借鉴的几点：机制与策略分离有两个极端，seL4 全部交给用户态，Zircon 在内核里保留方便的 dispatcher，这是设计内核时最根本的取舍；快速路径决定性能；要细粒度的安全授权选树状能力，要简单选带权限的平表；形式化验证的证明代码约为三十比一，只适合很小的内核。

### 外核、单地址空间内核与 Unikernel

宏内核做加法，微内核做拆分，外核（exokernel）一系做的是减法：把内核能做的事尽量拿走，交给应用。这一系有两个极端和一种工业化的形式。外核（jos）把内核减到只提供原始资源和保护检查，操作系统抽象全部交给用户态的 LibOS，但仍保留多地址空间和 MMU 隔离；单地址空间内核（SASOS，BareMetal）更进一步，连用户态和内核态的特权切换都取消，所有代码在同一个地址空间、同一个特权级；Unikernel（unikraft、HermitOS、MirageOS、TenonOS、rumprun）是外核与 LibOS 思想在工业上的简化：单个应用加单一地址空间，把操作系统库链接进应用，编成一个可启动的镜像。这三者在概念上的区别放到「内核结构的分类与衍生」里说，这里只看实现。

**jos：外核的教学例子。** MIT 6.828 曾经用的外核实验，2018 年后 MIT 改回了 xv6。它的原则是「内核只提供资源，不提供抽象」：完整版提供 `sys_page_alloc`、`map`、`unmap`（应用直接操作页表）、`sys_exofork`（只建一个空的地址空间，不复制内存）、`sys_env_set_pgfault_upcall`（用户态处理缺页），**不提供** fork、exec、open、socket。所以 fork 在用户态实现：用 `sys_page_map` 把页按写时复制（COW）映射给子进程，COW 的逻辑对应用完全可见；Linux 则在内核的 `kernel/fork.c` 里实现，应用看不到。文件系统和网络也是用户态进程，通过 IPC 提供服务。它还把页表、PageInfo 数组、Env 数组只读地映射到用户空间，应用可以直接读自己的页表，这正是外核提供资源的体现。数据结构也很少：`struct Env` 约十二个字段（Linux 的 `task_struct` 有一千五百多个），`struct PageInfo` 只有两个字段。

**BareMetal：用汇编写的单地址空间内核。** Return Infinity 团队用约 4355 行 NASM x86_64 汇编写了整个操作系统。它的系统调用方式很有参考价值：内核镜像头部有一张函数指针表（`b_input`、`b_output`、`b_net_tx` 等，每项八字节），应用调用就是 `call *0x00100018` 这样直接跳过去，**没有 `syscall` 指令，没有特权切换，没有内核与用户的区分，应用就运行在内核态**，约 5 纳秒，传统系统调用约 250 纳秒。地址空间是恒等映射（物理地址等于虚拟地址），从不切换页表，TLB 也不用失效。调度器没有 TCB 和队列，只有「函数指针加 CPU 编号」，唤醒任务就是 `call rax` 跳到任务函数；任何异常都打印信息后停住（因为没有进程可以杀）。它把外核「直接提供资源」做到了极端：应用甚至可以直接访问内核的网卡接口表、调用驱动的发送函数指针，不经过任何检查。优点是没有运行时开销、启动不到一百微秒、内核小于 32 KB、一周就能读完每条指令；代价是与 x86_64 绑定，没有结构体抽象（对象靠手工计算偏移），没有隔离，不能多租户。它更像一件手工作品，不是工业产品。

**unikraft：最完整的工业 Unikernel SDK。** 用 C 写成的八十八个微库，每个功能（malloc、sched、vfs、netdev、posix-* 等）单独放在 `lib/<name>/`，带 Kconfig 选项和 Makefile，由 `.config` 决定哪些库进入最终镜像，这是它和教学操作系统最大的区别。有两个做法可以直接借用：一是**弱符号 main**，`weak_main.c` 定义一个弱的 `int main()` 作为后备，应用定义了 `main` 时链接器就用应用的，这样操作系统镜像和应用 ELF 就连在一起了，应用写的是普通的 C `main`，只是链接的不是 glibc 而是 unikraft；二是**用代码生成兼容 Linux ABI**，`syscall_shim/` 用十七个 awk 脚本扫描 `UK_SYSCALL_DEFINE` 宏，构建时生成从系统调用号到函数指针的跳转表，所以 musl 编出的 Linux ELF 可以直接运行。它复用 Linux/buildroot 的 Kconfig 和 Make，没有自己做构建系统；目前支持的架构还不包括 RV64。

**HermitOS：用 Rust 写的 LibOS/Unikernel。** 由亚琛工业大学开发，定位是编译成静态库 `libhermit.a`，由应用链接组成 Unikernel，2015 年的 C 版 HermitCore 后来全部改用 Rust。它在 rv 上启动时用 Rust 解析 FDT（x86 和 aa 用 ACPI），内核内置一个 async 执行器用来写驱动，应用通过外部符号 `runtime_entry`（Rust 应用）或 `main`（C 应用）接入，与 unikraft 的弱符号 main 是同一个思路。编译时用 Cargo feature 裁剪，与 crate 体系自然结合；十四个系统调用模块组成 POSIX 子集，约两千三百行，足以运行 Rust 标准库的示例。支持 x86_64、aa、riscv64 三种架构。

**MirageOS：最早的 OCaml Unikernel。** 由剑桥大学开发。mirage 仓库本身只是配置工具和 DSL（functoria 引擎），真正的 LibOS（TCP/IP、DNS、文件系统）分布在几十个外部 opam 包里。它最大的特点是用 **functor（以模块为参数的函数）做类型驱动的配置**，代替 Kconfig：网络栈以 functor 作参数，可以直接替换 TCP4 和 TCP6、Unix socket 和 Xen netback，比 Rust 的 trait 加 dyn 更彻底（参数化的是整个模块，包括类型成员）。操作系统的配置用 OCaml 写在 `config.ml` 里，`mirage configure -t <target>` 生成构建文件，应用入口是 OCaml 的 `start ()`，运行在 Lwt 协作式轻量线程上。OCaml 编译成原生代码，性能接近 C。

**TenonOS：国产 LibOS。** 从 unikraft fork 而来，直接继承 `uk-*` 库，新增的部分在 `tn-*`：`tnschedprio`（抢占式优先级调度，代替 unikraft 的协作式调度，转向 RTOS）、`tnsystick`、`tntimer` 正好是 RTOS 的三个标准组件，另外还有 `tnpaging`。它还带一个叫 mortise 的嵌入式 hypervisor（基于 Bao，用 TenonOS 的微库机制重写），面向混合关键性场景（Linux 与 RTOS 同时运行），支持芯驰、瑞芯微等国产车规 SoC，只支持 aa。它已经不是云上的 Unikernel，更接近「国产 RTOS 加 LibOS 加 hypervisor」的嵌入式平台。

**rumprun：复用现成内核的 Unikernel。** 它不从零开始写，而是直接用 NetBSD 三十年的生产代码。基础是 anykernel 思想（Antti Kantee 的博士论文）：NetBSD 的驱动、文件系统、网络栈本来就比较独立，重构成可以分离的组件，加上约五十个函数的 `rumpuser` 抽象层，内核组件就能在 hypervisor、用户态、裸机等任意环境中运行。启动时一行 `rump_init()` 就把整个 NetBSD 内核（文件系统、网络、调度器）启动起来，接着就能挂载 tmpfs；应用入口用 `RUNMAIN(1..8)` 弱符号，支持把多个程序打包成一个 Unikernel。它直接得到了 NetBSD 的六十多种文件系统和三十年的 TCP/IP，rumprun-packages 里有现成的 nginx、redis、Python、OpenJDK 镜像，代价是要跟着 NetBSD 一起演进。这个思路后来延续到 Linux 的 LKL（kernel as library）。还有更极端的 tamago（改造 Go 运行时，直接在裸机 aa/rv 上运行，连 hypervisor 都不用，用于 HSM 和隔离钱包），这里只提一下。

七个项目的对比：

| 项目 | 语言 | 类型 | 应用入口 | 编译时裁剪 | 地址空间 | 系统调用方式 |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| jos | C | 外核（多地址空间） | `sys_exofork` 加用户态 LibOS | 手写 | 多个（MMU 隔离） | `int 0x30` 软中断 |
| BareMetal | NASM | 单地址空间内核 | 任务就是函数指针 | nasm include | 一个（恒等映射） | 函数指针表 `call` |
| unikraft | C | Unikernel SDK | 弱符号 `main` | Kconfig 加 Make | 一个 | awk 生成 Linux ABI 表 |
| HermitOS | Rust | LibOS/Unikernel | 外部符号 `runtime_entry` | Cargo feature | 一个 | 14 个模块分发 |
| MirageOS | OCaml | Unikernel | `register` 加 functor | functor 类型驱动 | 一个 | 自己的 API（非 POSIX） |
| TenonOS | C | Unikernel（fork 自 unikraft） | 继承弱符号 main | Kconfig 加 Make | 一个 | 继承 unikraft |
| rumprun | C | Unikernel（复用 NetBSD） | `RUNMAIN(1..8)` | 构建脚本 | 一个 | `rump_init()` 启动整个内核 |

自己写内核可以借鉴的几点：应用入口有四种成熟的做法（弱符号 main 最简单，外部符号约定，多个 main 打包进一个镜像，DSL register），弱符号 main 是把操作系统库和应用 ELF 分开的最省事的办法；兼容 Linux ABI 要尽早规划，unikraft 用代码生成器扫描宏生成跳转表，比手写更容易扩展；复用现成内核（rumprun、anykernel）与从零写库（unikraft、Hermit）是两条不同的路线；外核最重要的启示是，内核不一定要提供 fork、文件系统、socket，也可以只负责分配资源，Linux 里大量代码（缓冲缓存、调度器、文件系统、TCP）其实可以由应用代替，所以 io_uring、eBPF、DPDK 能在 Linux 里做外核式的优化。

### 异步内核

embassy 把异步运行时当作裸机的调度框架，用在 MCU 上做轻量并发。把同样的思路放进结构完整的通用内核，问题就变成了异步怎样进入内核，有四种做法：一是把异步作为 I/O 接口（Linux io_uring，用户态与内核共享环形缓冲区，内核本身仍以线程执行）；二是把系统调用写成异步函数（系统调用处理函数是 `async fn`，编译时生成 Future，如前面宏内核一节的 NoAxiomOS）；三是把调度器放到内核外（TornadoOS，调度器单独编译成裸机二进制，放在固定物理地址，多个地址空间共用）；四是在线程内核里用 Future 表达等待（ArceOS 的 `axtask::future`，调度单位仍是线程，阻塞等待写成 Future，由 `block_on` 驱动）。

AsyncOS 的设计文档把 I/O 接口分成五级：同步阻塞，同步非阻塞，多路复用（epoll），异步（token），循环队列（io_uring 或硬件）。核心观点是：**请求的状态与执行的状态分得越开，并行度和性能越高，但越难用**。异步内核就是把这条路走到底的尝试。TornadoOS、rCore-N、ReL4、embassy_preempt 正好是这个研究方向上前后相连的几个项目。

**TornadoOS：最早把调度器放到内核外的项目。** 它的核心是 SHARED_RAW_TABLE 这个跨地址空间的 ABI：调度器把一个七元组静态变量放在 `.meta` 段的最前面（字段包括编译时的基址、初始化函数、调度器实例指针，以及 add、peek、delete、set_state 四个 `extern "C"` 函数指针），只用裸函数指针和 `NonNull<()>`，不用 Rust 的 trait object 胖指针，以保证跨地址空间时的安全。内核这边手写了一段动态链接：读出七元组后，对每个指针做基址重定位（减去编译时的基址，加上实际加载的基址），相当于一个极简的 `ld.so`（没有 GOT、PLT、符号表，只有七个固定入口），是「模块化内核加动态加载」最小的可用例子。它的调度算法 `RingFifoScheduler` 是最简单的环形 FIFO（没有优先级、公平性、工作窃取），复杂的部分都在跨地址空间共享上，不在算法本身。最值得借鉴的是一处分工：`shared_peek_task` 把是否切换地址空间的判断交给调用它的执行器（调度器不知道当前是哪个地址空间），调度器只给出提示，由执行器决定怎么做；调度器只认 `usize` 类型的任务句柄，知道身份但不知道内容，只有创建任务的地址空间能把它转换回真正的任务结构。它的瓶颈也很明显：内核执行器用一把全局自旋锁保护整个调度器，多个 hart 共享时只能串行。

**rCore-N：用 vDSO 共享调度器。** 它把 TornadoOS 的「固定物理地址加手写重定位」改成了更工程化的 vDSO：用过程宏为每个共享函数自动生成三样东西，放在 `.vdso.<name>` 段里的函数指针槽、只在内核侧编译的用于填写指针的 `init_<name>(ptr)`、一个调用桩。内核启动时填好这些槽，之后用户态和内核态调用 `spawn`、`poll_*` 都通过同一份指针进入同一个调度器实例，更接近 Linux vDSO 的做法。它的执行器也比 RingFifo 强：用「优先级位图加每个优先级一条队列」O(1) 取出最高优先级，支持运行时修改优先级。更重要的是它建立在 rv 的用户态中断（N 扩展）上：硬件事件可以不陷入内核，直接在 U 态处理（有待处理的中断时直接置 `uip`，`SRET` 后跳到 `utvec`；或者先存进进程控制块，等调度时注入），这是异步系统调用、异步 IPC、用户态信号的硬件基础，与 io_uring 纯靠共享内存轮询不同。

**ReL4：seL4 的 Rust 重写。** 要说明一点：ReL4 目前公开的代码是一个与 C 版 seL4 保持 ABI 兼容的**同步** capability 微内核（源码里没有 `async fn`、`.await`、`Future`），保留了 seL4 的 IPC 快速路径，用一组 `#[no_mangle]` 函数与 C 代码衔接（部分路径已经迁到 Rust crate，C 侧不再调用）。异步优化（异步 IPC、notification）是 ReL4 项目的研究方向，不是现有代码的状态，引用时不能把它当成已经实现的异步微内核。它与 rCore-N 来自同一个研究团队，都在用 Rust 异步重构经典的内核结构。

**embassy_preempt：给协程加上真正的抢占。** 它在 STM32（Cortex-M）上把 μC/OS-II 和 embassy 结合起来，解决一个实际问题：embassy 的协程共用栈、省内存，但协程之间不能抢占、没有优先级，实时性差；μC/OS-II 每个任务有自己的栈，实时性好，但浪费栈空间。它的做法是两种调度方式并存：当前任务**主动让出时走 embassy 的路径**（无栈协程，共用栈，不保存现场），**被中断抢占时走 μC/OS-II 的路径**（分配栈，保存现场）。关键在 PendSV 的上下文切换里用一个布尔量 `is_in_thread_poll` 区分这两种情况：主动让出就丢掉旧栈（复用），被抢占才把 PSP 存进任务控制块（保存）。栈用 RAII 管理（`OS_STK_REF` 在 Drop 时自动归还）。它是四者中唯一面向 MCU 裸机（没有 MMU、不切换地址空间）的异步内核，与需要切换 satp/ASID 的 TornadoOS 正好是有地址空间和没有地址空间的两端。

| | TornadoOS | rCore-N | ReL4 | embassy_preempt |
|:--:|:--:|:--:|:--:|:--:|
| 做法 | 调度器放到内核外 | 通过 vDSO 共享协程调度器 | 微内核（异步是研究方向） | RTOS 协程加抢占 |
| 调度器的形式 | 独立二进制，固定物理地址 | 独立的库加 vDSO 指针表 | 内核里的 capability 机制 | 内核里的全局执行器 |
| 跨特权级共享 | 七元组加手写重定位 | 过程宏生成 vDSO 槽 | C ABI 函数衔接 | 单地址空间，不跨特权级 |
| 调度算法 | RingFifo（没有优先级） | 位图加每个优先级一条队列 | seL4 优先级加快速路径 | μC/OS-II 位图加抢占 |
| 抢占 | 协作式 | 协作式，加用户态中断注入 | 微内核抢占 | PendSV 真正的抢占 |
| 用户态中断 | 无 | 有（rv N 扩展） | 无 | 无（Cortex-M PendSV） |
| 地址空间 | 多个（切换 satp） | 多个 | 多个 | 一个（MCU 没有 MMU） |

自己写异步内核可以借鉴的几点：跨特权级共享调度器有两种做法，「固定物理地址加手写重定位」最简单但不稳，「vDSO 段加过程宏自动生成指针表」更工程化，更值得参考；调度器给提示、执行器做决定，是跨地址空间调度时把两者分开的关键；按优先级调度用「位图加每个优先级一条队列」比环形 FIFO 好，取最高优先级是 O(1)；「主动让出时复用栈，被抢占时才分配栈」是 MCU 上兼顾内存和实时性的主要技巧。这个方向还在往硬件延伸：任务感知中断控制器（TAIC）、rv 用户态中断（uintr）把调度和中断响应交给硬件，是异步内核下一步的方向。

五类内核看完了。它们分别回答了特权边界划在哪里、隔离靠硬件还是语言、调度是同步还是异步。下面换一个角度，不按内核分，而按子系统分，看同一个组件（调度器、内存、系统调用、驱动、文件系统、IPC、网络）在不同内核里是怎样实现的。

## 子系统对比：调度器

下面按子系统看同一个组件在不同内核里的位置、用什么库、怎么实现，以 xv6、tg-rcore、arceos、StarryOS、DragonOS、seL4 六个内核为例。

调度器只回答一个问题：从一组就绪任务里选出下一个运行的。各家的做法从简单到工业：

- **xv6** 是最简单的轮转：一个全局进程表数组，每个 CPU 一个 scheduler 协程，在 `for(;;)` 里线性扫描，找到 RUNNABLE 的就切换过去，没有优先级，没有负载均衡，进程数有固定上限。内核内部是协作式的（进程主动让出），时钟中断里调用 `yield()` 实现了用户态的时间片抢占。
- **tg-rcore** 用 trait 把存储和调度分开：`Schedule` trait 只有 add 和 fetch 两个方法，具体策略用 `VecDeque` 实现 FIFO/RR，任务对象存在 `BTreeMap` 里，队列只存 ID。换调度算法（如 stride）只需换 `Schedule` 的实现。队列只存 ID 不存对象，避免了所有权上的麻烦，在教学上很清楚。
- **arceos** 的调度算法可以在编译时更换：用 cargo feature 在 `FifoScheduler`、`RRScheduler`、`CFScheduler` 中选一个，算法本身在外部的 axsched crate 里，run_queue 只调用 `BaseScheduler` trait（init、add、remove、pick_next、task_tick、set_priority），不知道具体算法。每个 CPU 一个 run_queue，带轮转式负载均衡、cpumask 亲和性和任务迁移；抢占本身也是一个 feature，关掉就变成协作式。任务结构很简单（id、状态、上下文、栈，加一个 `task_ext` 扩展字段）。
- **StarryOS** 直接复用 arceos 的调度器（选抢占式 RR），通过 `task_ext` 挂上 Linux 的 `Thread`（tid、信号、进程数据），自己不写调度算法，精力都放在兼容 Linux（clone、futex、signal、timer）上。
- **DragonOS** 移植了整套 Linux CFS：`Scheduler` trait 加 `SchedPolicy`（CFS、FIFO、RT、IDLE），每个 CPU 一个运行队列，CFS 本身用红黑树按 `vruntime` 排序，配有 PELT 负载跟踪和 NICE 权重的定点计算，与 Linux 源码基本一一对应，工业上可信，但规模大。
- **seL4** 是固定优先级抢占加 domain 时间分区：每个优先级一条就绪队列，用两级位图 O(1) 选出最高优先级；domain 在安全域之间按时间片轮转，隔离信息流（优先保证确定性，而不是吞吐量）；MCS 模式下，调度上下文带有预算补充，把时间也做成了一种能力。

从复杂度看，xv6 的轮转最简单，其次是 tg-rcore 的 FIFO/RR（可换成 stride）、arceos 的三选一、seL4 的固定优先级加 MCS，DragonOS 的 Linux CFS 最复杂；从抢占程度看，xv6 和 tg-rcore 只有用户态时间片，arceos 的抢占可以关闭，StarryOS、DragonOS、seL4 是完全抢占的。自己写内核最值得借鉴的是 tg-rcore 和 arceos 都做了的「存储与调度分开」：把调度策略抽象成 trait，不改调度框架就能换算法。

## 子系统对比：内存管理

内存管理分两层：物理页分配器（管理物理内存）和地址空间抽象（管理虚拟内存映射）。

物理页分配器：xv6 是最简单的空闲链表（空闲页本身作为链表节点，从头部插入和取出，粒度固定 4 KB），没有 buddy 和 slab；tg-rcore 用现成的 buddy crate 注册为全局分配器；arceos 有两级，按需扩展：字节分配器（slab、buddy、tlsf 三选一）在位图页分配器之上，字节级不够时才向页级申请 2 的幂个页来扩大堆；DragonOS 与 Linux 一样分四层（早期 bump 分配，buddy 管理页帧，slab 实现 kmalloc，顶层的全局分配器），完整对应 Linux mm；StarryOS 用 arceos 的；seL4 不同，**内核从不动态分配内存**，所有内存以 untyped 能力交给用户态，由用户调用 Retype 切出 TCB、CNode、页表、frame，所以可以证明资源没有泄漏，这是形式化验证的前提。

地址空间抽象：xv6 是直接操作两级页表（手写 walkpgdir、mappages），立即映射，没有懒分配和 COW；tg-rcore 用 page_table crate 封装 Sv39；arceos 和 StarryOS 用 `MemorySet` 加 `Backend` 的模型：一个地址空间由若干区域（area）组成，每个区域绑定一个 backend，决定映射方式（线性映射、可懒分配的 alloc），缺页时找到区域交给 backend 处理。StarryOS 在此基础上把 backend 扩展为 cow、file、shared、linear 四种，支持文件映射、fork 写时复制和共享内存，是 arceos 发展成宏内核时内存部分的例子；DragonOS 是 Linux 的 VMA/ucontext 加 `handle_mm_fault`（返回 COMPLETED、SIGSEGV、OOM），基本上是用 Rust 重写的 Linux mm；seL4 把页表本身也作为由能力管理的对象，map 和 unmap 都通过能力调用完成。懒映射和 COW 只有 arceos、StarryOS、DragonOS 三家有，xv6 和 tg-rcore 是立即映射。

值得借鉴的是 arceos 的 `MemorySet` 加 `Backend`：把映射方式从地址空间结构中抽出来，做成可以替换的 backend，同一套地址空间机制既能支持 Unikernel 的线性映射，也能在 StarryOS 里扩展出 COW 和文件映射，不必改地址空间的核心代码。

## 子系统对比：陷入与系统调用

陷入（trap）有一个通用的过程：硬件原子地保存 PC 和特权模式，切换模式和栈，跳到向量；软件接管后保存通用寄存器、分发、恢复，再用 `sret`/`iret`/`eret` 返回。区别在软件接管这一段怎么写。这里的 xv6 是 i386 版，用 IDT 和 `int 0x40`；其余五个内核的主要路径都是 rv，用 `ecall`，系统调用号在 a7，用 `sscratch` 取得内核栈。

- **xv6** 是 i386 的 IDT 加 alltraps：硬件通过中断门进入 alltraps，压入全部通用寄存器构成陷阱帧，然后 `call trap`；`trap` 里判断是系统调用就调用 `syscall()`，调用号在 eax，查函数指针表调用，返回值写回 eax，是 CISC 风格的对照例子。
- **tg-rcore** 把陷入入口和上下文切换合在一起：一段 `execute_naked` 汇编先把调度器的上下文压到内核栈上，设好陷入后的返回点，再从 `sscratch` 取出线程上下文、切栈、恢复，然后 `sret` 进入线程；线程发生陷入时回到那个返回点，保存线程上下文，切回调度器的栈，`ret`。陷入和任务切换是同一段汇编，少了一层，是 rCore 教学中的经典写法。
- **arceos** 把陷入入口放在外部的 axcpu crate，处理函数用 linkme 注册到陷入槽（IRQ、PAGE_FAULT、SYSCALL）：架构相关的入口调用槽，处理函数由上层提供，入口和处理完全分开。Unikernel 默认没有用户态和系统调用，中断走 IRQ 槽；打开 `uspace` feature 后才由 axcpu 提供 `UserContext`。
- **StarryOS** 把用户任务做成运行循环的内核线程：任务体是 `while 未退出 { let reason = uctx.run(); match reason { Syscall => 处理系统调用; PageFault => 处理缺页; Exception => 转换成信号; … } }`。`uctx.run()` 由 axcpu 提供，进入用户态，陷入回来后返回一个 `ReturnReason`，陷入的解码放在 HAL 里，内核这边写成简洁的 Rust match。
- **DragonOS** 移植了 Linux rv 的 `entry.S`：用 `csrrw tp, sscratch` 判断陷入来自用户态还是内核态，保存完整的陷阱帧，再按 scause 的异常码查 `do_trap_*` 函数表（与 Linux 异常向量表的布局一致），系统调用号取 a7。结构与 Linux 相同，迁移 Linux 概念的成本最低。
- **seL4** 按 scause 分流，`seL4_Call` 和 `ReplyRecv` 走手写汇编的 IPC 快速路径，其余走慢路径；它的系统调用约十个，全部与 IPC 和 Yield 有关，没有 read、write、mmap，文件、驱动、网络都由用户态服务通过 IPC 提供。

系统调用的数量差别很大：seL4 约十个（都是 IPC），xv6 二十一个，tg-rcore 约三十个，arceos 没有（Unikernel），StarryOS 和 DragonOS 有两三百个（兼容 Linux）。入口的写法从 IDT（xv6）、陷入与切换合一（tg-rcore）、注册槽（arceos）、高层的运行循环（StarryOS）、移植 Linux 的 entry.S（DragonOS）到快速路径分流（seL4），分别对应它们在教学、工程、验证上的定位。

## 子系统对比：驱动模型

驱动模型回答内核怎样发现设备，怎样把设备的读写统一成抽象接口。各内核的做法有几种：

- **最简单：函数指针表。** xv6 没有驱动框架，只有一张从主设备号到 read/write 函数指针的全局表 `devsw[]`，约三十行就是全部的设备抽象，没有总线、probe 和设备树。这是驱动模型的最低限度。
- **组件化：trait object 加外部驱动 crate。** arceos 把探测到的设备放进一个 `AllDevices` 结构，提供静态和动态两种模型：静态模型下设备类型在编译时由 cargo feature 决定，没有动态分发，但每类只能有一个实例；动态模型用 `Box<dyn NetDriverOps>` 支持多个实例。驱动 trait（`NetDriverOps` 等）放在外部单独发版本的 driver crate 里，不在主仓库。探测支持 MMIO（设备树）和 PCI 总线。
- **兼容 Linux：完整复刻设备模型。** DragonOS 逐一实现了 Linux 的 kobject、kset、bus、class、device、driver，设备和驱动都是 kobject，真的建出 `/sys/dev`、`/sys/devices` 等 sysfs 目录，设备与驱动的绑定对应 Linux 的 `drivers/base/dd.c`，设备分类（acpi、pci、virtio、block、char、net、input、tty、serial、rtc 等）齐全。目标是在 ABI 和源码层面兼容 Linux 驱动，代价是规模大。
- **中间做法：以设备树为准探测。** NoAxiomOS 用 `DeviceTreeInfo` trait 在编译时把驱动绑定到设备树的 compatible 字符串，设备分成 Block、Net、Display、Interrupt、Char、Power 六类，运行时按 compatible 匹配，介于 xv6（不探测）和 DragonOS（完整设备模型）之间。

另外两种做法：Theseus 把每个驱动（e1000、ixgbe、ata、pci，甚至网卡缓冲区、队列、初始化）都拆成独立的 crate（cell），驱动可以在运行时替换；asterinas 把驱动做成组件，`unsafe` 都限制在 OSTD 里，组件本身是安全的 Rust。微内核（seL4、Zircon/zCore）则把驱动整个放到用户态，内核里除了调试串口没有任何设备驱动，驱动是用户态进程，通过能力获得 MMIO 和 IRQ。

## 子系统对比：文件系统与进程间通信

### 文件系统

文件系统很大，这里只看它在内核里以什么抽象存在、各家用什么。xv6 没有 VFS 层，`struct file` 直接用 union 放 pipe 和 inode 两种后端，read/write 用分支区分，只支持自己的 inode 文件系统，它的价值在于清楚地展示了 file、inode、pipe 的关系（管道也是一个 file）。arceos 的 axfs 用 Rust trait（`VfsOps`、`VfsNodeOps`）代替 C 的函数指针表，用 cargo feature 选择具体的文件系统，`root` 和 `mounts` 管理挂载，是用 Rust 重新设计 VFS 的例子，StarryOS 直接复用。DragonOS 是最接近 Linux VFS 的 Rust 实现，在核心抽象之外有 ext4、fat、fuse、overlayfs、devfs、procfs、sysfs、tmpfs、ramfs 等多个文件系统，配有页缓存、epoll、eventfd 和伪文件系统，与它兼容 Linux 的目标一致。用 Rust trait 代替 C 函数指针表来做 VFS 已经是共识，pipe、socket、伪文件系统都能挂进同一套 VFS，「一切皆文件」在 Rust 里同样成立。

### 进程间通信

**管道。** 管道就是「一段环形内存，加上条件变量的语义，包装成两个文件描述符」。xv6 最清楚：一个带锁的环形缓冲区，满了就 `sleep`，写完就 `wakeup`，分配时创建一读一写两个 `struct file`。要兼容 Linux 就要多一层抽象，DragonOS 把管道实现成挂在 VFS 上的伪文件系统（PipeFS），支持 splice、tee、FIFO 等完整的 Linux 语义。

**信号量、互斥锁、条件变量。** tg-rcore 的实现在教学上很清楚：信号量的计数为非负时表示可用资源数，为负时其绝对值是等待的线程数；`down` 减少计数，为负就把线程 ID 放进等待队列并返回「需要阻塞」，`up` 增加计数，取出一个线程 ID 交给调度器唤醒。**原语本身不直接阻塞线程，而是返回线程 ID 交给调度器处理**，所以原语可以单独测试，也可以换调度器（只限单核）。

**信号。** xv6 只有一个 `killed` 标志，进程在陷入时自己检查；DragonOS 是完整的 Linux 信号模型（pending、blocked、sigaction、实时信号、signalfd），注释里直接引用 Linux `kernel/signal.c` 的函数名；tg-rcore 把信号拆成三个 crate，逐步讲解。

**共享内存与消息。** DragonOS 实现了 SysV 共享内存（shmget、shmat 的语义，key 到 id 用两个 HashMap）和 eventfd；Theseus 有一个很特别的无锁通道：用一个 `AtomicU16`（高八位放一字节消息，最低位是满标志），发送用 CAS，体现了它用「共享内存加原子操作」而不是「陷入系统调用」做 IPC 的思路。

**微内核的 IPC。** 在微内核里，IPC 是内核唯一的服务通道。seL4 的 IPC 只有两种：Endpoint（同步消息传递，消息放在消息寄存器里，可以附带能力转移）和 Notification（异步通知，类似带 badge 的二值信号量，有三种状态）；Zircon 和 zCore 提供 channel、fifo、socket 三种对象化的 IPC，比 seL4 的原语更丰富。走微内核路线时，消息寄存器快速路径的性能要放在第一位。

## 子系统对比：网络协议栈

网络栈的情况很清楚：**Rust 内核几乎都用 smoltcp，C 内核和嵌入式内核用 lwip**。

**smoltcp 是 Rust 内核的事实标准。** 它是为裸机实时系统设计、不依赖堆的 no_std TCP/IP 栈，使用 `#![deny(unsafe_code)]`。分五层：wire 层每个协议一个解析器（arp、ethernet、ipv4、ipv6、tcp、udp、icmp、dhcp、dns 等），设计原则是「让非法的状态无法表示」；phy 层是内核对接驱动的关键接口，`trait Device` 加 `RxToken`/`TxToken`，`receive()` 返回收发两个 token，`transmit()` 返回发送 token，token 的 `consume(闭包)` 把缓冲区交给闭包，所以没有复制、不需要堆；iface 层管理接口、邻居（ARP）、路由、分片和套接字集合；socket 层是 TCP、UDP、ICMP、raw、dhcp、dns，加上 async 唤醒；storage 层是不需要堆的环形缓冲区和重组器。它采用轮询模型，没有内部线程，由调用方定期调用 `iface.poll()` 推进。

各内核对接 smoltcp 的方式相同：**把自己的网卡驱动包装成 `phy::Device`**。arceos 是标准做法：`receive` 从网卡驱动取得缓冲区指针，包装成 RxToken，`transmit` 返回 TxToken；在 token 的 `consume` 里，接收时把驱动的缓冲区交给 smoltcp 后回收，发送时申请缓冲区、填好后发出，中间没有复制；它还自己实现了 smoltcp 没有的监听队列，向上提供 TcpSocket 和 UdpSocket。Theseus 也是定义一个 `NetworkDevice` trait 再对接 smoltcp。DragonOS 在网卡设备（也是 kobject 设备）上移植了 Linux NAPI（带预算的轮询收包），用 smoltcp 处理 inet 族的 TCP/IP，但向上提供完整的 Linux socket 层（inet、unix、netlink、packet、vsock 五个协议族和全套 BSD 套接字系统调用），smoltcp 只负责 TCP/IP，套接字抽象、系统调用和其他协议族由 DragonOS 自己写。

asterinas 是唯一没有直接使用 smoltcp 全部协议栈的内核，对自己写网络栈最有参考价值：它的 bigtcp **只取 smoltcp 的 TCP 实现，以太网和 IP 分发层自己写**，理由是 smoltcp 为嵌入式设计，套接字数量少，通用操作系统需要更灵活高效的包分发。由此可以判断：嵌入式或轻量内核直接包装 smoltcp；通用操作系统要支持大量并发套接字时，应像 bigtcp 那样保留 TCP、重写分发层。

**lwip 是 C 内核的选择。** 它约占 80 到 100 KB ROM、几十 KB RAM，支持 IPv4、IPv6、TCP、UDP、PPP、6LoWPAN，以及 DHCP、DNS、SNMP。它有三套 API：raw/callback API（单线程、回调驱动，没有操作系统时首选，最省资源）、netconn API（顺序式，需要操作系统的线程和邮箱）、socket API（兼容 BSD，建立在 netconn 上）。把它放进内核要做两件事：实现 sys_arch 移植层（向 lwip 提供信号量、邮箱、互斥锁、线程、临界区），以及 netif 驱动（发送以太帧的 `linkoutput`，收包时调用 `netif->input`）。ReactOS 是标准的例子：把 lwip 源码整份放进仓库，再写一个把 lwip 原语映射到 ReactOS 内核原语的 sys_arch 移植层和 netif 驱动。

| | smoltcp | lwip |
|:--:|:--:|:--:|
| 语言与模型 | Rust no_std，轮询（没有内部线程） | C，可以不用操作系统，或用线程加邮箱 |
| 内核怎样对接驱动 | 实现 `phy::Device`（Rx/TxToken 加闭包） | netif 的 `linkoutput` 与 `netif->input` |
| 内核要提供什么 | 定期调用 `poll()`，以及时钟 | sys_arch 移植层（信号量、邮箱、互斥锁、线程） |
| 套接字抽象 | 内核自己实现（监听队列、系统调用） | 自带 BSD 套接字 API |
| 改造的例子 | asterinas bigtcp（取 TCP，重写 IP 分发） | ReactOS 整份引入，加 sys_arch 衔接 |

六个子系统（调度、内存、陷入、驱动、文件系统与 IPC、网络）在各内核里的实现已经看完，写一个内核需要逐项决定的事也就清楚了。下面把前面所有内容归入「单微宏外库框」的分类。

## 内核结构的分类与衍生

### 几个互相独立的维度

常见的误解是把内核排成「宏内核、微内核、外核……从旧到新、从差到好」的一条线，这是错的。它们是在不同维度上衡量的，彼此独立，可以组合。弄清这一点，才能理解为什么会有组件化的宏内核（arceos）、异步的宏内核（NoAxiomOS）、框内核（asterinas）这样的组合。至少有三个结构上的维度，加三种独立的风格：

**维度一：内核结构，即功能放在哪里、特权边界划在哪里。** 这是「单微宏外库框」衡量的主要维度：

- **宏内核（单内核，monolithic）**：调度、内存、文件系统、网络、驱动都在同一个内核地址空间、同一个特权级，子系统之间直接函数调用。性能最好，一处缺陷影响的范围也最大。
- **微内核（micro）**：内核只保留最少的机制（IPC、调度、地址空间），文件系统、驱动、网络都作为用户态进程，靠 IPC 通信。可靠、可验证，代价是跨域 IPC 的开销。
- **外核（exo）**：更进一步，连核心抽象也交出去，内核只负责分配和保护资源，操作系统抽象由应用一侧的库操作系统（LibOS）各自实现。
- **库操作系统（library OS）**：把操作系统功能做成库直接链接进应用，与应用在同一地址空间、同一特权级，没有系统调用边界。它是一种机制，常作为外核之上的抽象层，或宿主操作系统之上的兼容层。
- **框内核（framekernel）**：单地址空间、全部用 Rust，把 `unsafe` 限制在一个很小、可以审计的特权框架（TCB）里，其余服务用安全的 Rust，靠类型系统在编译时隔离，同时有宏内核的性能和微内核那样小的 TCB，又没有硬件隔离的开销（见「组件化内核与框内核」中的 asterinas，USENIX ATC'25）。

**维度二：隔离方式，即凭什么相信一个组件不会破坏另一个。** 从硬件特权级加 MMU（传统的宏内核、微内核、外核），到语言类型系统在编译时保证（框内核、Theseus），再到不隔离、信任所有代码（单地址空间内核 SASOS）。越往后，运行时开销越小，对编译器和语言的依赖越大。

**维度三：打包与部署方式，即一个镜像里有几个程序、怎样启动。** 从传统的多进程通用操作系统，到 Unikernel（一个应用加它需要的库编成一个可启动镜像，一次只运行一个程序），再到容器和兼容层。

**三种独立的风格**不改变结构，只改变实现或调度方式：**组件化**（「组件化内核与框内核」，用 crate、features、trait 把内核拆成可组装的部分，是一种实现方式，可以用在任何结构上）、**异步**（「异步内核」，以 Future 作为调度单位，是一种调度模型）、**实时**（「实时内核」，以确定性为目标）。

### 容易混淆的术语

有了上面的分类，几个常被混用的词就可以分清了（定义依据 Wikipedia 和 ATC'25 等论文）：

- **单内核、单体内核、宏内核、monolithic kernel 是同一个意思。** 「单」指单一的大内核，整个操作系统在一个内核地址空间里，衡量的是**结构维度**。
- **单内核（monolithic）不是 Unikernel。** 两个词都带「单」，但衡量的维度不同。monolithic 说的是**内核结构**（功能都在内核空间），Unikernel 说的是**打包方式**（一个程序加它需要的库编成一个镜像，一次只运行一个程序）。一个 monolithic 内核既可以打包成传统的多进程操作系统（如 Linux），也可以裁剪成 Unikernel，两者不在同一个维度上。也没有「联内核」这个标准术语，需要区分的是 monolithic 所在的结构维度和 Unikernel 所在的打包维度。
- **微内核不是组件化内核。** 微内核是运行时分离（多进程加 IPC），组件化是编译时分离（多个 crate 编进同一个二进制，运行时共享地址空间），前者把隔离放在运行时，后者放在编译时（见「组件化内核与框内核」和「微内核」）。

### 外核、LibOS 与 Unikernel 的关系

这三个概念最容易混，它们是包含关系：**Unikernel 是 LibOS 思想的一种具体打包方式，LibOS 是更早、更宽的机制；Unikernel 一定是 LibOS，LibOS 不一定是 Unikernel。**

LibOS 是一种**机制**：把传统上在内核里的功能（调度、内存、文件系统、网络栈）实现成库，直接链接进应用，与应用在同一地址空间、同一特权级，调用操作系统服务就是普通的函数调用，没有系统调用的特权切换。这个思想来自 MIT 1990 年代的外核研究：外核只提供裸硬件并负责保护和资源复用，真正的操作系统抽象由运行在用户态的若干 LibOS 各自实现，应用因此可以定制甚至替换操作系统抽象。外核是**承载多个 LibOS 的基础**：机制（硬件复用、保护）留在内核，策略（怎样抽象硬件）交给应用一侧，一台机器上可以同时有多个 LibOS 实例。Unikernel 是一种**打包方式**：把一个应用和它用到的操作系统库一起编译、裁剪、封装成独立的单地址空间可启动镜像，运行在 hypervisor 或裸机上，一个镜像就是一个实例，目标是镜像小、启动快、攻击面小。

LibOS 的范围比 Unikernel 大，因为它还有两种 Unikernel 之外的用法：一是外核上多个 LibOS 共存（是 LibOS，但不是独占单个镜像的 Unikernel）；二是作为兼容层或隔离层运行在另一个宿主操作系统上，如 Drawbridge、WSL1 的 pico-process、Gramine-SGX，把一套操作系统接口做成库，提供 ABI 兼容或 enclave 隔离，同样是 LibOS，但不是在裸机上自己启动的镜像。

| | LibOS | Unikernel |
|:--:|:--:|:--:|
| 性质 | 机制：操作系统抽象作为库链接进应用，没有特权边界 | 打包方式：一个应用加库编成可启动镜像 |
| 起源 | 外核（MIT exokernel，1990 年代） | LibOS 在云和嵌入式上的现代应用（2010 年代） |
| 是否只有一个应用 | 不一定（外核上可以有多个 LibOS） | 是，专用 |
| 能否独立启动 | 不一定（可以运行在外核或宿主操作系统上） | 能，直接在 hypervisor 或裸机上启动 |
| 代表 | jos、Drawbridge、Gramine、WSL1 | MirageOS、unikraft、HermitOS、rumprun |

### 各项目的归类

把前面看过的项目放进这套分类，「单微宏外库框」六个字分别对应：

| 类别 | 结构特点 | 常见的隔离方式 | 代表 | 见 |
|:--:|:--:|:--:|:--:|:--:|
| 单 / 宏（monolithic） | 全部在一个内核地址空间 | 硬件 MMU 加特权级 | xv6 / tg-rcore / DragonOS / StarryOS / NoAxiomOS | 「宏内核」 |
| 微（micro） | 内核只保留 IPC、调度、地址空间，服务在用户态 | 硬件加运行时的进程隔离 | seL4 / Zircon / zCore | 「微内核」 |
| 外（exo） | 内核只提供资源和保护，抽象交给 LibOS | 硬件 MMU（多地址空间） | jos | 「外核、单地址空间内核与 Unikernel」 |
| 库（LibOS） | 操作系统就是链接库，没有特权边界 | 同一地址空间、没有边界，或依靠宿主隔离 | HermitOS / MirageOS / rumprun | 「外核、单地址空间内核与 Unikernel」 |
| 框（framekernel） | 单地址空间、全部 Rust，TCB 很小 | 内核里的 TCB 靠类型系统（用户态进程仍用 MMU） | asterinas | 「组件化内核与框内核」 |
| 单地址空间内核（SASOS） | 单地址空间、单特权级，信任所有代码 | 没有隔离，或只靠类型 | BareMetal / Theseus | 「组件化内核与框内核」、「外核、单地址空间内核与 Unikernel」 |

### 从一个内核衍生出另一个

同一个内核基础可以衍生出形态完全不同的新系统。**成功的衍生大多不靠 fork 源码改写，而靠扩展点、重写或复用**，这样上游的改进能持续传到下游。有四种做法：

- **编译时组合加扩展点（arceos 到 StarryOS、AxVisor）。** 同一套 modules，靠 `uspace` feature、`TaskExtRef` 挂每任务数据、`crate_interface` 反向回调、axns 命名空间这四个扩展点，StarryOS 不改 arceos 源码就成了兼容 Linux 的宏内核，AxVisor 成了 Type-1 hypervisor（见「axvisor：从 ArceOS 衍生」）。一份代码同时支持 Unikernel、宏内核、hypervisor 三种形态，这是工程上最有价值的衍生方式。
- **保持 ABI 的语言重写（Zircon 到 zCore，seL4 到 ReL4）。** 完全兼容上游的 ABI，换一种语言重写，获得内存安全或异步能力，还能增加新的形态（zCore 在 zircon 之外加了 linux 形态）。
- **fork 加增量（unikraft 到 TenonOS）。** 继承上游的库，在旁边增加新内容（TenonOS 加了 `tn-*` 实时调度和 mortise 嵌入式 hypervisor），代价是要跟着上游演进，持续合并。
- **复用现成内核（NetBSD 到 rumprun）。** 用 anykernel 思想把成熟内核的驱动、文件系统、网络整体做成库，一行初始化就能启动整个内核。

这四种做法和前面的分类，是自己写内核时最先要想清楚的两件事：自己处在哪几个维度上，以及打算从哪个基础、用哪种方式发展出来。

## 虚拟化的概念与硬件基础

最后一类是在一套内核之上同时运行多套内核，即虚拟化层（hypervisor）。它让多个相互隔离的客户机（guest，每个都有自己的内核和用户态）运行在同一台物理机上。

### Hypervisor、VMM、Type-1/1.5/2 与模拟器

**Hypervisor 和 VMM（Virtual Machine Monitor）是同一个意思**，指特权级比客户机更高、负责陷入并模拟（trap-and-emulate）敏感操作、做二级地址翻译和资源分区的那一层软件。按照它怎样取得特权，分三类：

- **Type-1（裸机）**：直接占用最高的虚拟化特权级（rv 的 HS、x86 的 VMX root、aa 的 EL2），本身就是最底层的软件。xen、bao、acrn、hypocaust、hypocaust-2、rustyvisor、axvisor 都是 Type-1。
- **Type-1.5（在运行中的 Linux 里接管）**：Linux 先正常启动并占用全部硬件，再把 hypervisor 作为内核模块加载，由驱动逐个 CPU 把正在运行的 Linux 降为客户机。RVM1.5 是代表。
- **Type-2（宿主上的用户态 VMM）**：作为宿主操作系统上的普通用户态进程，借助宿主内核的虚拟化接口（如 Linux KVM）运行客户机。firecracker、cloud-hypervisor、crosvm、KVM 模式下的 QEMU、rcore-vmm 都属于这一类。

**hypervisor 和模拟器（emulator）不同**：模拟器（QEMU 的 TCG、rvvm、machina）用软件解释或即时编译（JIT）翻译客户机指令，不要求客户机与宿主是同一种指令集，也不用硬件虚拟化扩展；hypervisor 让客户机指令直接在 CPU 上执行，只在敏感操作处陷入。判断的依据是：hypocaust 即使在没有 H 扩展的硬件上，也是直接执行加影子页表，而不是解释执行，所以它是 hypervisor，不是模拟器。

### rv 的 H 扩展

虚拟化要高效，靠硬件提供的虚拟化特权级。rv 的 H 扩展把 S 模式分成两个：hypervisor 运行在 HS 模式，客户机内核降到 VS 模式（虚拟化的 S 模式），客户机用户态在 VU 模式。从三个 rv 项目的源码中可以看到这些机制（与 x86 VMX、aa EL2 对应）：

- **进出 VS 模式**：设置 `hstatus.SPV`（之前的虚拟化状态）后，`sret` 返回到 VS 模式而不是 HS 模式，这就是进入客户机的开关。
- **二级地址翻译**：`hgatp` 存放从客户机物理地址到宿主物理地址的 stage-2 页表根（相当于 x86 的 EPT、aa 的 vttbr）。完整的两阶段翻译是：客户机虚拟地址经 `vsatp`（stage-1）到客户机物理地址，再经 `hgatp`（stage-2）到宿主物理地址。
- **中断与异常委托**：`hedeleg`/`hideleg` 把一部分异常和中断直接委托给 VS 处理，减少陷出（VM exit）次数。
- **虚拟中断注入**：`hvip` 让 HS 向 VS 注入虚拟的外部中断（`set_vseip`）或定时器中断（`set_vstip`）。
- **缺页信息**：客户机缺页时，`htval` 给出出错的客户机物理地址，`htinst` 给出触发的指令（`htinst` 可能为 0，这时要按二级翻译手动读取客户机内存里的指令再解码）。
- **VS 的影子 CSR**：`vsatp`、`vsstatus`、`vsie`、`vstvec`、`vsepc`、`vscause`、`vstval`、`vstimecmp` 等，由 hypervisor 替客户机管理。

工程上必须做的一件事是**检测 H 扩展**：不能假设硬件一定有 H，要先装一个临时的陷入处理函数，执行一条读 `hgatp`（CSR 地址 0x680）的指令，触发非法指令异常就说明没有 H 扩展。

下面按教学项目、组件化、Type-1.5、工业 Type-1、microVM、模拟器的顺序逐个看。

## 各虚拟化实现

### rv 上的三个教学项目

这三个项目正好展示了在不同特权级取得虚拟化能力的三种方式。

**hypocaust：在没有 H 扩展的硬件上做隔离。** 方法是影子页表（shadow page table）加陷入后模拟 CSR：没有 `hgatp` 二级翻译，只能让真实的 `satp` 使用 hypervisor 维护的影子页表，客户机修改 `satp`、修改页表、执行特权指令都会陷入 hypervisor 模拟。它把客户机的页表项设成只读以捕获写操作，用一套影子 CSR 的状态机模拟客户机看到的特权状态，上下文切换用协作式的任务切换（rCore 风格），而不是硬件的 VM entry。代价是客户机每次修改页表都要陷入并同步影子页表，性能差，但能在任何 rv 上运行。

**hypocaust-2：用 H 扩展加速。** 它是 hypocaust 的后续版本，用硬件的 `hgatp` 二级翻译代替影子页表，用 VS 模式直接运行客户机内核，只在敏感事件时陷出。它的陷出分发是核心：虚拟 SBI 调用交给 hypervisor 提供的虚拟 SBI；客户机缺页时读 `htval`/`htinst` 分析（包括模拟虚拟 PLIC）；定时器陷出时用 `hvip.set_vstip` 给客户机注入定时器中断；外部中断从宿主 PLIC claim 后用 `hvip.set_vseip` 注入。它的设计是 **vCPU 与物理核一一绑定、不调度**（没有调度器，确定性好），配合 rv IOMMU，让直通设备的 DMA 也经过二级翻译，防止越界。可以运行 rCore、RT-Thread、Linux 6.2。

**rustyvisor：一份代码包含 M、HS、VS 三级。** 它的特点是自带 M 模式固件层：读 `misa` 后写回 `misa | H` 来启用 H 扩展，设置异常和中断委托，配置 PMP，再设置 `mstatus.MPV` 并 `mret` 进入自己的 HS 模式 hypervisor，不像 hypocaust-2 那样依赖外部的 OpenSBI/RustSBI 作 M 模式固件。它给客户机提供虚拟 SBI 时直接用 `rustsbi` crate 的 VmSBI，不用自己写分发。它是教学上从 M 到 HS 再到 VS 的完整例子（目前仍在开发中，只支持单个虚拟机）。

### axvisor：从 ArceOS 衍生

axvisor 是「从一个内核衍生出另一个」里「编译时组合加扩展点」在虚拟化上的应用：它本质上是运行在 ArceOS 上的一个应用（`extern crate axstd as std`），复用 ArceOS 的入口、堆、调度器、SMP、分页、中断，自己只把虚拟化能力拆成一组独立的 crate（axvm 管虚拟机，axvcpu 管 vCPU，axaddrspace 管二级地址空间，axdevice 管设备，axhvc 管 hypercall），再用 HAL trait 把这些 crate 接到 ArceOS 的硬件抽象层上。它的 `main` 很简单：检查硬件支持，启用虚拟化，初始化并启动 VMM。跨架构（x86_64、aa、riscv64）由这些 crate 各自的架构实现完成，这就是它名字里「unified」的意思。

它与 hypocaust-2 的主要区别在 vCPU 调度：hypocaust-2 一一绑定、不调度；axvisor 把 vCPU 当作 ArceOS 的任务，用 ArceOS 的调度器调度，复用而不是自己写调度器，这是组件化最直接的好处。构建由配置驱动（板级 toml 加虚拟机 toml，`cargo xtask` 加 menuconfig）。用 axvisor 做 hypervisor，就是写 HAL 实现、选 crate、写配置，开发量小，三种架构统一，代价是与 ArceOS 绑定，依赖一长串预览版的 crate。

### Type-1.5：RVM1.5

RVM1.5 是这里唯一的 Type-1.5（Jailhouse 风格，x86 VMX/SVM），最能说明 Type-1.5 是怎样工作的：Linux 正常启动并占用全部硬件，把 RVM1.5 作为内核模块加载，由 Jailhouse 的 Linux 驱动逐个 CPU 跳进 hypervisor 入口；hypervisor 保存正在运行的 Linux 的完整 CPU 上下文（`LinuxContext::load_from(linux_sp)`），执行 `vmxon` 和 `vmlaunch`，把这个 Linux 降到 VMX non-root，作为 root cell 客户机；之后还可以随时 deactivate，让 Linux 回到裸机运行。它借用 Jailhouse 的 cell 概念做静态分区，TCB 比 Type-1 略大（需要了解一部分 Linux），但比 Type-2 小得多，最大的好处是不停机就能进出虚拟化，并复用 Linux 的全部驱动和调度。

### 工业 Type-1：xen、bao、acrn

| 项目 | 定位 | 调度 | 设备模型 | 规模 |
|:--:|:--:|:--:|:--:|:--:|
| xen | 2003 年起，最重的工业 Type-1 | 多种调度器（credit、RTDS、null、arinc653） | dom0 管理真实驱动加 qemu-dm | C，约 65 万行（hypervisor） |
| bao | 静态分区，功能安全 | 没有调度器（vCPU 与物理核一一对应） | hypervisor 内极简 | C，约 2.8 万行 |
| acrn | 嵌入式和车载，x86 | 多种方式（分区模式不调度，共享模式调度） | Service VM 用户态的设备模型 | C，只支持 x86 |

xen 是 2003 年开始的经典项目：dom0（特权域，管理真实驱动和设备模型）加 domU（客户机），三种虚拟化方式并存（PV 半虚拟化、HVM 硬件辅助、PVH 两者结合），aa/rv 上还有 Dom0less（直接从设备树启动多个客户机，不经过 dom0）。bao 是另一个极端：静态分区，启动时一次性把 CPU、内存、IO 分给固定的虚拟机，运行时不重新分配、不调度，所以实时性可预测、故障隔离、容易通过 ISO 26262 和 IEC 61508 认证，已经用在 NXP、Renesas 等车规芯片上。acrn 在两者之间：同时支持硬件分区的确定性虚拟机和共享硬件的富虚拟机，三种配置模式（partitioned 纯静态、hybrid 混合、shared 共享）让实时负载和富负载在一台机器上共存，设备模型放在 Service VM 的用户态，以隔离并复用 Linux 的驱动。三者正好代表了从静态分区不调度（确定性）到动态调度（灵活）的不同取舍。

### KVM 上的 Rust microVM：firecracker、cloud-hypervisor、crosvm

这三个是现代的 Type-2，都建立在 Linux KVM 上、用 Rust 编写；firecracker 和 cloud-hypervisor 复用 rust-vmm 的共享组件，crosvm 是这套 crate 的来源。三者的安全模型和功能方向不同：

- **firecracker（AWS，serverless）**：为 AWS Lambda 和 Fargate 设计，非常精简：只有 block、net、vsock、balloon、rng 等少数 virtio 设备，以 MMIO 传输为主，没有完整的 PCI，vCPU 的陷出循环只处理 MMIO 读写和系统事件。启动约 125 毫秒，只支持 KVM。安全靠三层：seccomp 过滤，jailer（chroot、cgroup、namespace），独立的 seccomp BPF 编译器。还有快照机制，用于秒级 fork 和预热池。
- **cloud-hypervisor（Intel/CNCF，现代云）**：功能比 firecracker 全得多：完整的 PCI、ACPI，CPU、内存、设备热插拔，vhost-user（设备后端可以在独立进程里运行），VFIO 直通，机密计算（TDX、SEV-SNP）。它最大的设计特点是**用 trait 抽象多种 hypervisor 后端**：`Hypervisor`、`Vm`、`Vcpu` 三个 trait 之下有 KVM 和 MSHV（Microsoft Hypervisor，通过 `/dev/mshv` 运行在 Linux root partition 上，如 Azure）两套后端，同一份 VMM 代码可以运行在两种底层 hypervisor 上（宿主都是 Linux）。
- **crosvm（Google ChromeOS，rust-vmm 的来源）**：运行 ChromeOS 上的 Linux（Crostini）和 Android（ARCVM），rust-vmm 的多个 crate 最初就是从它里面抽出来的。它的安全模型最严格：**每个虚拟设备 fork 成独立进程，用 minijail 加 seccomp 沙箱**，一个设备被攻破不会影响整个虚拟机；功能也最全（GPU、音频、媒体直通，面向桌面和 Android）；支持的宿主 hypervisor 后端最多（KVM、GenieZone、Gunyah、HAXM、WHPX 等）。

三者的隔离程度依次增加：firecracker（单进程多线程，加 seccomp 和 jailer），cloud-hypervisor（可选 vhost-user 进程隔离），crosvm（每个设备一个进程，加 minijail）。

### rust-vmm crates

firecracker 和 cloud-hypervisor 能各取所需，靠的是 rust-vmm：一组相互独立、可复用、各自有 CI 的 crate（crosvm 是它的来源）。它把 VMM 拆成内存模型、KVM 接口、virtio 队列、设备、启动加载、系统工具、事件循环等独立的 crate，VMM 项目只负责组装和策略（安全模型、设备集、API）。最关键的是三个：`vm-memory`（客户机物理内存的抽象，用 `GuestMemory` trait 把使用内存的一方和提供内存的一方分开，统一 GPA 到 HVA 的翻译）、`kvm-ioctls`（把 unsafe 的 KVM ioctl 封装成类型安全的 `Kvm`、`VmFd`、`VcpuFd` 三层句柄，`VcpuExit` 枚举就是各 VMM 的陷出循环要分发的事件）、`virtio-queue`（split-ring 的描述符链处理，`DescriptorChain` 迭代器是设备后端读写客户机缓冲区的统一入口）。所以 firecracker（单后端、精简）和 cloud-hypervisor（多后端、功能全）可以复用同一套基础。QEMU 的 `kvm-all.c` 里从 `MemoryListener` 到 `set_user_memory_region` 的机制，就相当于 rust-vmm 的 `vm-memory` 加 `kvm-ioctls`。

### 模拟器：rvvm、machina、qemu

最后是不占用特权级、用软件翻译指令的模拟器。它们的结构相同：解码，转成中间表示（IR），JIT 编译，翻译块（TB）缓存，设备 MMIO 分发。

- **rvvm（C，约 5.8 万行）**：rv 的 tracing JIT 模拟器，纯软件，不依赖宿主的虚拟化扩展，宿主可以是 x86、aa、rv。它的 JIT 有多个宿主后端，比 QEMU 的 TCG 快，用纯 C99 编写，很容易移植（能在 Apple M1 上运行 rv，KVM 不能跨架构做到这一点），只支持一种指令集，所以很轻。
- **machina（Rust，约 16 万行）**：用 Rust 重写的 QEMU，TCG 风格的 JIT（清晰的 IR 加活跃性分析、寄存器分配、优化、x86-64 后端），客户机支持 RV64 和 la64。它的规模可以读完，是用 Rust 写 QEMU 式全系统模拟器的例子，并用指令级 difftest（通过 GDB 远程协议与 QEMU 对照）验证，已经能启动 OpenSBI 加 Linux 到 shell。
- **qemu（C，约一百五十万到两百多万行）**：事实标准，支持三十多种客户机架构，既能用 TCG 软件模拟，也能作为 KVM、HVF、WHPX、Xen 的用户态设备模型前端。现代的 Rust VMM 和 machina、rvvm 在概念上都在对照或替换 QEMU 的「用户态设备模型、加速器抽象、陷出分发循环」。KVM 模式下的 QEMU 就是 cloud-hypervisor 那样的用户态 VMM，只是设备和架构覆盖得更广，规模也大得多。

### 小结

自己写 hypervisor 时的几个取舍：**占用哪一级特权决定类型**（自己占最高级是 Type-1，依附 KVM 在用户态运行是 Type-2，纯软件不占特权级是模拟器）；**隔离方式取决于硬件**（有 H、VMX、EL2 就用硬件二级翻译，没有就用影子页表软件模拟，性能差但可移植）；**三种取得特权的方式**（由外部 SBI 进入 HS、自带 M 模式固件启用 H、在 Linux 之上把 Linux 自己降为客户机）；**vCPU 调度二选一**（与物理核一一对应、不调度，追求确定性；或借宿主调度器把 vCPU 当任务调度，追求灵活）；**设备模型放在哪里决定隔离和复用**（hypervisor 内的极简实现、特权客户机的用户态、VMM 进程内的多线程、VMM 子进程沙箱）；**组件化把写 hypervisor 简化成写 HAL、选 crate、写配置**（axvisor），rust-vmm 把写 Type-2 VMM 简化成组装独立的 crate。虚拟 SBI 这类接口也不用自己写，直接用 `rustsbi` crate。

## 阅读顺序

动手时按从简单到复杂、每类选一个读透的顺序最省力：

1. **先读实时内核**：FreeRTOS 是库式 RTOS 最简单的例子，读懂它的位图调度、用队列实现全部同步原语、PIP，就掌握了调度、上下文切换、IPC、优先级反转四件事；想看可认证的教科书式实现，读 μC/OS-II（8×8 位图加常量表的 O(1) 查找）和 μC/OS-III（真正的 PIP、增量链表节拍）；想看完整 RTOS 怎样搭设备框架、shell、自动初始化，读 RT-Thread。
2. **再看异步**：embassy 是把异步运行时当调度框架最成熟的例子，约两千行的执行器、run_queue 和 waker 就是全部，读完会改变「任务必须有独立的栈」这个看法。
3. **通用内核从教学内核开始**：xv6 作对照（`swtch.S` 十行就说明了切换的原理），tg-rcore 用 Rust 重写，并把系统调用做成两端共用的 crate。读懂这两个，宏内核的结构就清楚了。
4. **每类选一个深入**：宏内核选 DragonOS（看怎样全面兼容 Linux）或 StarryOS（看怎样建立在 arceos 之上）；组件化和框内核读 arceos（三种形态加四个扩展点）和 asterinas（用 `#![deny(unsafe_code)]` 限制 TCB）；微内核读 seL4（快速路径、能力树、形式化验证）；外核和 Unikernel 读 jos 和 unikraft（弱符号 main 把操作系统库和应用连起来）；异步内核读 TornadoOS 或 rCore-N（把调度器放到内核外的两种做法）。
5. **最后看虚拟化**：在 rv 上从 hypocaust（没有 H，用影子页表）读到 hypocaust-2（H 扩展二级翻译），理解硬件基础；看组件化衍生读 axvisor；看工业上的取舍读 bao（静态分区）和 xen（完整调度）；看 Type-2 怎样搭建读 firecracker 和 rust-vmm。

每一类都先看它怎样回答谁来调度、内存怎么管理、怎样陷入、设备怎么接入这同一组问题，再看它特有的设计。结构相同，细节各异。

## 术语

- **RTOS（实时操作系统）**：以确定性（最坏延迟有上界）而不是吞吐量为目标的内核，分库式（FreeRTOS、μC/OS）和完整（RT-Thread）两类。
- **库式 RTOS**：只提供内核本身、与应用编成一个镜像的 RTOS。
- **PIP（优先级继承）、PCP（优先级上限）**：两种优先级反转的对策，前者临时提高持有锁的任务的优先级，后者给锁预设一个上限优先级。
- **优先级反转**：高优先级任务通过共享资源被低优先级任务间接阻塞的现象。
- **异步运行时（async runtime）**：以 Future 为调度单位、通过 `.await` 协作式让出的运行时，embassy 是嵌入式中的代表。
- **执行器（executor）**：异步运行时里轮询就绪 Future 的循环，相当于调度器。
- **Waker**：Future 挂起后用来通知「可以再次轮询」的句柄。
- **宏内核（monolithic、单内核、单体内核）**：调度、内存、文件系统、驱动都在一个内核地址空间里的结构。
- **微内核（microkernel）**：内核只保留 IPC、调度、地址空间，其余服务作为用户态进程的结构。
- **外核（exokernel）**：内核只负责分配和保护资源，操作系统抽象交给应用一侧 LibOS 的结构。
- **库操作系统（LibOS）**：把操作系统功能做成库链接进应用、没有特权边界的机制。
- **Unikernel**：把一个应用和它需要的库编成一个可启动镜像的打包方式，是 LibOS 的一种。
- **框内核（framekernel）**：单地址空间、全部用 Rust，把 `unsafe` 限制在最小的可审计框架（TCB）里，靠类型系统在编译时隔离的结构，由 asterinas 首先提出。
- **SASOS（单地址空间内核）**：单地址空间、单特权级、信任所有代码的结构，BareMetal、Theseus 属于这一类。
- **组件化**：用 crate、features、trait 把内核拆成可组装部分的实现方式，与内核结构无关。
- **异步内核**：以 Future 作为内核调度单位的内核，有把调度器放到内核外、把系统调用写成异步函数等做法。
- **TCB（可信计算基）**：系统中必须信任其正确性的最小代码集合。
- **能力（capability）**：不可伪造、自带权限位、权限只能减少的对象引用，是微内核安全的基础。
- **IPC 快速路径（fastpath）**：seL4 把同步 IPC 做到一微秒以内的手写汇编路径，任何一项检查不通过就退回慢路径。
- **形式化验证**：用数学证明实现符合规约，seL4 用三层精化，证明与代码约为三十比一。
- **VFS（虚拟文件系统）**：统一不同文件系统的抽象层，Rust 内核用 trait 代替 C 的函数指针表。
- **smoltcp、lwip**：Rust no_std 和 C 嵌入式的 TCP/IP 栈，前者通过 `phy::Device` 对接，后者通过 netif 和 sys_arch 移植层对接。
- **Hypervisor、VMM**：同一个意思，特权级比客户机高、做陷入模拟和二级地址翻译的虚拟化层。
- **Type-1、Type-1.5、Type-2**：分别是裸机、在运行中的 Linux 里接管、宿主上的用户态三类 hypervisor。
- **H 扩展**：rv 的虚拟化特权扩展，引入 HS/VS 模式、`hgatp` 二级翻译、`hvip` 中断注入等。
- **两阶段翻译**：客户机虚拟地址经 stage-1（`vsatp`）到客户机物理地址，再经 stage-2（`hgatp`）到宿主物理地址。
- **EPT、NPT、vttbr**：分别是 Intel x86、AMD x86、aa 的二级地址翻译，对应 rv 的 `hgatp`。
- **静态分区**：启动时一次性把 CPU、内存、IO 分给固定的虚拟机、运行时不调度的虚拟化方式，bao 是代表。
- **rust-vmm**：一组相互独立、可复用的 Rust crate（vm-memory、kvm-ioctls、virtio-queue 等），是 Type-2 VMM 共用的基础。
- **模拟器（emulator）**：用软件解释或 JIT 翻译指令，不要求同一种指令集，不使用硬件虚拟化扩展，QEMU、rvvm、machina 属于这一类。

## 思考题

**Q1. FreeRTOS 为什么把信号量、互斥量都实现成队列的特例，而不是各写一套？**

{% note default %}
三者的核心都是「等待者集合加唤醒」。计数信号量是元素大小为 0、长度为 N 的队列（计数就是队列中的元素数），二值信号量是长度为 1 的队列，互斥量是二值信号量加持有者记录和 PIP。归结为同一个结构后，等待、超时、按优先级唤醒的逻辑只写一份，代码少而一致，这是库式 RTOS 追求小的典型做法。
{% endnote %}

**Q2. embassy 的任务和传统 RTOS 的任务在内存上有什么根本区别？**

{% note default %}
传统 RTOS 每个任务有独立的栈（要按最坏情况预留），切换上下文要保存约十八个寄存器并切换栈。embassy 的任务是编译时生成的 Future 状态机，状态保存在静态任务存储里，不在栈上，所有任务共用一个栈（深度等于最深的 `await` 链），切换就是 `poll` 返回 Pending（不到十个周期，不保存寄存器）。所以 embassy 比 RTOS 省内存：不必为每个任务预留独立的栈。
{% endnote %}

**Q3. 组件化内核和微内核都把内核拆开，区别在哪？**

{% note default %}
微内核是运行时分离：子系统是用户态的多个进程，靠 IPC 通信，隔离由硬件特权级和地址空间在运行时保证，代价是跨域开销。组件化是编译时分离：子系统是多个 crate，编进同一个二进制，运行时共享地址空间，保留宏内核的性能，隔离由 Rust 类型系统在编译时保证（asterinas 还用 `#![deny(unsafe_code)]` 把 TCB 限制在框架里）。前者把隔离放在运行时，后者放在编译时。
{% endnote %}

**Q4. 「单内核」和「Unikernel」都带「单」，是一回事吗？**

{% note default %}
不是，它们衡量的是不同的维度。单内核（monolithic）说的是内核结构，所有功能都在一个内核地址空间里；Unikernel 说的是打包方式，一个程序加它需要的库编成一个可启动镜像，一次只运行一个程序。一个 monolithic 内核既能打包成传统的多进程操作系统（Linux），也能裁剪成 Unikernel，两者不在同一个维度上。
{% endnote %}

**Q5. 在没有 H 扩展的 rv 上做 hypervisor 可行吗？怎么做，代价是什么？**

{% note default %}
可行。hypocaust 的做法是影子页表加陷入模拟：让真实的 `satp` 使用 hypervisor 维护的影子页表，把客户机的页表项设成只读以捕获写操作，客户机修改 `satp`、修改页表、执行特权指令都陷入 hypervisor 模拟（用一套影子 CSR 状态机模拟客户机看到的特权状态）。代价是客户机每次修改页表都要陷入并同步影子页表，性能明显比有 `hgatp` 硬件二级翻译的方案差，所以 hypocaust-2 改用了 H 扩展。
{% endnote %}
