---
title: 2025春夏季开源操作系统训练营第四阶段学习总结-elebirds
date: 2025-06-21 17:31:41
tags: 
    - author:elebirds
    - repo:https://github.com/elebirds/arceos
    - repo:https://github.com/elebirds/axcpu
mathjax: true
---

# 2025春夏季开源操作系统训练营第四阶段学习总结

2025春夏季我参加了开源操作系统训练营，第四阶段的任务是具体实践，以下是我在这个阶段的学习总结。

<!-- more -->

## 学习心得

第四阶段的主要工作是将ArceOS下游分支的功能合并到主线，说实话刚开始接到这个任务时心里还是有点忐忑的。整理了一下统计表，发现要处理的commit有几十个，涉及内存管理、HAL层、任务管理、文件系统等各个模块，而且很多功能之间还有复杂的依赖关系。

这个过程让我对开源项目的协作有了更深的理解。之前写代码更多是自己一个人搞，但做合并工作需要理解每个开发者的设计思路，还要协调不同功能模块之间的冲突。有时候一个看似简单的修复，可能会影响到其他几个模块的实现。

最大的收获可能是对ArceOS整体架构的理解。通过处理这些合并工作，我把ArceOS的各个组件都简单过了一遍，从底层的HAL到上层的POSIX API，从中断处理到文件系统，基本上每个模块都有涉及。这种"强迫"自己去理解全局的感觉还挺好的。

## 主要工作内容

首先我做了一些小任务：
1. 升级rust工具链2025-0520：支持starry-next的底层arceos：
​ 主要是修改workflow中的工具配置版本，调整unsafe声名。同时解决版本更新带来的导致的代码问题。

我的核心任务是将ArceOS下游分支中的各种功能改进和错误修复合并到主线分支。

首先，我对下游分支的提交进行了通读，然后分类和整理，主要分为以下几类：
- **错误修复**：修复了多个关键的bug，提升了系统稳定性
- **功能特性**：实现了新的功能特性，如新增实用函数、改进内存管理等
- **架构支持**：增强了对不同架构的支持，如RISCV、LoongArch等
- **依赖管理**：更新和统一了各个crate的版本依赖，解决了依赖冲突
- **文档更新**：完善了相关文档和注释，提升代码可读性

之后，我与谢祖钧、陈宏两位同学进行了多次讨论，确定了合并的分工。我主要负责除文件系统和内存管理外的其他模块合并工作。包括中断处理、任务管理、架构支持等。

### arceOS主线PR
- [feat: POST_TRAP callback linker support](https://github.com/arceos-org/arceos/pull/266)
- [feat: introduced the check_region_access method in the AddrSpace](https://github.com/arceos-org/arceos/pull/246)
- [feat: build without axstd](https://github.com/arceos-org/arceos/pull/245)
- [fix: make AxNamespace Send + Sync](https://github.com/arceos-org/arceos/pull/244)
- [feat: save FP_STATE for RISC-V and Loongarch64](https://github.com/arceos-org/arceos/pull/242)
- [replace Mutex with lock_api in axstd](https://github.com/arceos-org/arceos/pull/241)
- [replace Mutex with lock_api](https://github.com/arceos-org/arceos/pull/238)

### axcpu cratePR
- [fix: frequent context switch leads to IRQ being silenced](https://github.com/arceos-org/axcpu/pull/9)
- [feat: POST_TRAP callback](https://github.com/arceos-org/axcpu/pull/8)
- [feat: FP/SIMD support for LoongArch64](https://github.com/arceos-org/axcpu/pull/5)
- [feat: improve context with more api](https://github.com/arceos-org/axcpu/pull/4)
- [fix: save kernel stack position when exiting from trap handler on LoongArch64](https://github.com/arceos-org/axcpu/pull/3)
- [feat: FP/SIMD support for riscv64](https://github.com/arceos-org/axcpu/pull/2)

## 遇到的挑战与解决方案

### LoongArch64架构下的浮点数支持
[feat: FP/SIMD support for LoongArch64](https://github.com/arceos-org/axcpu/pull/5)

在LoongArch64架构上，系统缺乏浮点状态(fp_state)的调度上下文保存功能，这导致在任务切换时无法正确保存和恢复浮点寄存器状态。

在原有的实现中，浮点寄存器的状态保存和恢复存在以下问题：
1. **浮点寄存器状态不一致**：在内核模式下进行日志输出时，会导致浮点寄存器发生意外变化，造成程序切换前后的浮点状态不一致。
2. **内核浮点指令污染**：当使用硬浮点平台编译时（如loongarch64-unknown-none），内核操作以及外部函数调用可能包含浮点运算，这些操作会在系统调度到上下文切换的过程中修改浮点寄存器，从而污染用户程序的浮点上下文。

> 经过一下午的调试，目前可以确认的情况如下：
> 
> 1. 对Starry-next反编译没有发现除保存/恢复FP之外的浮点指令。
> 2. 在保存FP前和恢复FP后进行日志输出均会出现FP不一致。
> 3. 若在日志输出前手动关闭FPE，输出后再次开启，不会出现Unhandled trap Exception(FloatingPointUnavailable)，且仍会有FP不一致现象。
> 4. 若对内核启用软浮点，则不会出现任何问题。
> 5. 在RISCV架构下进行日志输出不会出现FP不一致问题。
> 我认为1,3两点可以确认日志输出本身不存在浮点指令，但为什么导致这个bug，还搞不明白，仍然亟待探寻。

讨论了若干解决方案后，最终确定了采用：采用`loongarch64-unknown-none-softfloat`目标编译，确保内核不会在其他地方使用FP/SIMD指令

### RISC-V架构下的浮点数支持
[feat: FP/SIMD support for riscv64](https://github.com/arceos-org/axcpu/pull/2)
#### 问题描述

这个问题源于code reviewer的评论，指出在下游宏内核的实现中，浮点寄存器的保存实现并不优雅。其原因在于：

内核中存在两套不同用途的状态保存机制：
- **TrapFrame**：保存用户态↔内核态转换时的完整CPU状态
- **TaskContext**：保存内核态任务间切换时的callee-saved寄存器

RISC-V架构中的FS（Floating-point Status）位用于优化浮点寄存器保存。FS位有四种状态，每种都有特定的语义：
- Off (00): 浮点不可用
- Initial (01): 浮点寄存器处于初始状态
- Clean (10): 浮点寄存器已保存，与内存一致
- Dirty (11): 浮点寄存器已被修改，需要保存

但在我们的实现中，这个状态被分散在三个不同的位置：
- 硬件sstatus寄存器中的FS位
- TrapFrame结构体中保存的sstatus.FS
- TaskContext结构体中的fp_status.fs

在进程切换时，当前只能修改TaskContext中的FS状态，但无法同步修改TrapFrame中保存的sstatus值，导致状态不一致。

#### 解决方案探索

##### 1. Linux内核方案分析

通过研究Linux内核的实现，我们发现可以通过向`switch_to`函数传递TrapFrame参数来统一管理FS状态。但这种方案需要修改现有的接口设计。

```c
static inline void fstate_save(struct task_struct *task,
			       struct pt_regs *regs) {
	if ((regs->status & SR_FS) == SR_FS_DIRTY) {
		__fstate_save(task);
		__fstate_clean(regs);
	}
}

static inline void fstate_restore(struct task_struct *task,
				  struct pt_regs *regs){
	if ((regs->status & SR_FS) != SR_FS_OFF) {
		__fstate_restore(task);
		__fstate_clean(regs);
	}
}

```

##### 2. 基于栈布局的创新方案

**核心思路**：利用RISC-V的sscratch寄存器特性和内核栈布局来解决问题：
- 用户态运行时：sscratch = kernel_stack_top
- 内核态运行时：sscratch = 0
- TrapFrame位置：kernel_stack_top - sizeof(TrapFrame)

**实现策略**：
1. 在TaskContext中添加kernel_stack_top字段
2. 通过栈布局计算TrapFrame位置
3. 在switch_to中同步修改TrapFrame的FS状态

\*目前仍在研究中，尚未完全实现。

### 2. 代码冲突
在合并过程中，遇到了多个模块之间的代码冲突。

#### module独立为crate

axhal部分代码独立为了axcpu, axplat等crate，导致无法直接合并。
通过git生成patch文件，sed命令修改patch文件中的路径，重新应用到主线。

#### 分支commit冲突
在处理多个分支的合并时，可能会出现同一文件的不同提交冲突。

## 总结与展望

通过第四阶段的工作，我不仅完成了ArceOS下游向主线的大规模合并任务，更重要的是深入理解了现代操作系统的架构设计和开源项目的协作模式。这次经历让我：

1. **技术能力提升**：掌握了大规模代码集成的技能，深入理解了操作系统各个子系统的交互关系
2. **项目管理经验**：学会了如何规划和执行复杂的技术任务，协调多方资源
3. **开源贡献意识**：体会到了开源社区协作的魅力，提升了对代码质量和文档的要求

这次经历让我对大型开源项目的维护有了更直观的认识。代码质量、测试覆盖、文档完善、版本管理等等，每一个环节都很重要。也让我意识到，在开源社区中，技术能力固然重要，但沟通协调能力同样不可缺少。

感谢陈渝老师、郑友捷老师和贾越凯老师的指导，也感谢所有参与开发的同学。虽然合并工作看起来不如开发新功能那么“酷“，但这种维护性工作对项目的长期发展同样重要。希望通过我的努力，能让ArceOs的主线更加稳定和完善。

其实在第四阶段初期，我还调研过两天的vDSO（虚拟动态共享对象）相关内容，尝试将其集成到Starry-next，但由于时间有限，最终没有完成。vDSO可以让用户空间程序直接调用内核提供的系统调用接口，减少了上下文切换的开销，对性能提升有很大帮助。若暑假有机会，我会继续研究这个方向。
