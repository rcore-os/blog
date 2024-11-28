#### 总结
一直以来对OS非常感兴趣，通过本次的“代码调试”，熟悉了整个项目架构，并对OS有了进一步的深刻认识。在调试过程中不仅熟悉了OS，还对Rust语言有了更深入的认识。
本次实现的功能是打印任务信息：系统调用及调用次数，运行时间。
整体思路：在syscall入口处调用set_task_info方法。每调用一次系统调用，更新一次syscall_times和time。
踩的坑：需要注意Rust结构体与C结构体的区别，Rust编译器会对Rust中的字段进行重排序，以达到优化存储的目的。在OS中的结构体和user中的结构体字段要保持一致，否则会蛋疼:(
另外附图一张，表示我曾用心学习:)

![笔记](./基础知识.png)


#### 第一题
应用分别出现：
- PageFault in application, bad addr = 0x0 bad instruction = 0x804003a4 , kernel killed it.
- IllegalInstruction in application, kernel killed it.
使用的sbi版本是：RustSBI version 0.3.0-alpha.2 


#### 第二题

1.刚进入__restore时，a0代表kernel stack pointer ， restore的两种使用场景：a.trap 恢复 b.创建新任务

2.处理了sstatus sepc sscratch。sstatus用于指定返回的特权级(SPP字段)；sepc用于指定返回后执行哪条指令；sscratch存储着用户栈地址，U态程序要执行必须正确找到U态的栈地址。

3.application不会使用x4;x2已经被交换到了sscratch代表着用户栈指针

4.sp指向user stack , sscratch 指向kernel stack


5.__restore总状态切换在csrw sstatus,t0这行指令，sstatus中的SPP字段记录了陷入前的特权级，csrw sstatus,t0执行后，恢复到用户特权级。最后的指令sret ，指令返回用户程序，原因是该指令会从sepc中读取指令地址，并赋予pc寄存器，而U态的栈等已恢复好，sret临门一脚，步入U世界。

6.指令之前sp -> user stack , sscratch -> kernel stack ;指令后sp -> kernel stack, sscratch -> user stack。指令进入内核运行。并且用sscratch保存着U态的栈地址，从内核态返回即可用sscratch恢复用户态栈指针。

7. csrrw sp,sccratch, sp是程序从U态进入S态的关键指令，sp指向内核栈。



#### 荣誉准则

1. 在完成本次实验的过程（含此前学习的过程）中，我曾分别与 以下各位 就（与本次实验相关的）以下方面做过交流，还在代码中对应的位置以注释形式记录了具体的交流对象及内容：
   无

2. 此外，我也参考了 以下资料 ，还在代码中对应的位置以注释形式记录了具体的参考来源及内容：

   我的参考资料：rCore-Tutorial-Book-v3

3. 我独立完成了本次实验除以上方面之外的所有工作，包括代码与文档。 我清楚地知道，从以上方面获得的信息在一定程度上降低了实验难度，可能会影响起评分。

4. 我从未使用过他人的代码，不管是原封不动地复制，还是经过了某些等价转换。 我未曾也不会向他人（含此后各届同学）复制或公开我的实验代码，我有义务妥善保管好它们。 我提交至本实验的评测系统的代码，均无意于破坏或妨碍任何计算机系统的正常运转。 我清楚地知道，以上情况均为本课程纪律所禁止，若违反，对应的实验成绩将按“-100”分计。
