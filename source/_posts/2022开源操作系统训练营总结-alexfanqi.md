---
title: 2022开源操作系统训练营总结-alexfanqi
date: 2022-08-01 15:37:50
categories:
    - report
tags: 
    - author:alexfanqi
    - summerofcode2022
    - rcore-lab
---
## 总体学习感想
参加了rcore暑假第一阶段的学习，觉得用rust写操作系统体验很棒很有趣，相比c/c++代码rust写起来舒服不少，没有了类真的舒爽很多。
<!-- more -->

因为之前有过用rust写些算法程序的经验，这次并没有陷入和rust编译器斗智斗勇抓狂的境地。反而rust的运行时检查借用规则及时bail out，让我发现自己犯的各种zz错误。rust编译器的warning也非常有帮助，cargo和crate赛高。另一方面，由于os本身的要求，很多地方不可避免地绕过rust的借用与生命周期规则，比如要用到raw pointer，处理内存时用到static生命域的引用buffer，各种内核服务作为全局变量通过智能指针提供，rust的设计感觉造成的障碍多于安全保证，听别人说zig体验更好一点？，不过对于这点还是应该训练自己合理使用这些特性并善用抽象封装它们。

lab设计方面，感觉各个实验设计的很清晰恰当，前置知识给的充足又不冗余，示例代码可以很好的作为作业的参照，使得我能够通过实践学到了如raw pointer，global_asm,arc+refcell, cow等等不好仅仅看文章学懂的知识与技巧。印象最深刻的是，lab3我注意到两个未提及的问题：使用RefCell造成task模块过于耦合，以及用户传来的普通类型指针也有可能跨多个页。自己思考了一段时间并尝试实现，到了lab4就立刻给出了这两个的问题的解决方法，感觉这样的实验安排很有帮助。或许也是学过计算机系统的缘故，完全没有第一次用c写os课的时候的无所适从。虽然听说教程由于使用git分支管理章节，给助教维护和更新带来困难，但在学生的角度，没有感觉太多不便，也促使我学会了合并patch。感觉唯一缺少的是自带配置好codespace上vscode的rust analyzer语言拓展，默认设置会有点弯路，不过还有群友提示设置好部分参数，然而我开始比较懒惰没有配置，到lab5都还是人肉linting。

当然非常想感谢组织者和各位助教的帮助，给我打开了rust系统编程新世界的大门，计划在之后更多参与到zcore社区和rust开发中。

## 具体收获

### rust
做rust习题时，了解了各种语言细节和坑（比c++正常多了），包括
- macro的展开细节，
- HRTB\(Higher Rank Trait Bounds\)
- 自动解引用的具体顺序
- 栈上大数组初始化的问题
- MaybeUninit来解决就地初始化，规避rust变量初始化语法的限制
- slice类型\[T\]的语义  

学会了活用rust丰富又尽力保证安全的语言特性到实际项目中
- impl Drop来利用RAII，保证资源回收
- arc/refcell安全地共享全局服务/资源，利用arc解耦各部分代码
- `global_asm!`,`no_mangle`, `C_REPR`提供汇编接口
- 基于trait的多态

### 操作系统
地址空间的管理
- 建立堆栈，以及全局变量，静态变量区域
- 基于虚地址和分页的内存管理与隔离，了解了linux的PTI和Kaiser[^1]
- 应用trap进内核时要保证trampoline部分的地址连续性

多任务管理和隔离
- 最简单的将应用和内核放在一起加载到内存，回忆到在前看过确实虚拟化的项目这样做的
- user call陷入内核和应用切换的不同，上下文切换。
- riscv的priviledged指令的规范和设计，trap和exception处理
- 利用与idle context的上下文切换，实现灵活的cpu调度

简单的文件系统
- 硬件->驱动->内核的多层抽象
- 简单的索引和数据管理
- 文件和目录的实现
- 计算各个数据结构的大小

调试
- println！大法好，backtrace也很有用（尤其是要带符号）
- 记录充分log信息，非常关键

[^1] (https://www.kernel.org/doc/html/v5.9/x86/pti.html)
