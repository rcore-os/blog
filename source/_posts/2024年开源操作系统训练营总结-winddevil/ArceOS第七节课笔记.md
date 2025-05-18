# 概念

![](00%20inbox/asset/Pasted%20image%2020241204205737.png)

关键是在于这个**虚拟化层**,我们用虚拟化层来实现对硬件抽象层的虚拟化.

![](00%20inbox/asset/Pasted%20image%2020241204210024.png)

虚拟化的效率高是因为`Hypervisor`的体系结构环境是相同的.

![](00%20inbox/asset/Pasted%20image%2020241204210409.png)

> 这里的II型是KVM这种.1.5型可能更多的是

![](00%20inbox/asset/Pasted%20image%2020241204210949.png)

物理设备只有一个CPU的时候用多任务假装是`vcpu`.

![](00%20inbox/asset/Pasted%20image%2020241204211120.png)

> 有点像虚拟内存<->物理内存.用的也是页表的方式来建立对应关系.

![](00%20inbox/asset/Pasted%20image%2020241204211208.png)

> 和`vcpu`的方式是一样的实现`vDev`.其实就是怎么把一个设备的划分成很多小的粒度,然后再分配资源给它.


最简Hypervisor执行流程：
1. 加载Guest OS内核Image到新建地址空间。
2. 准备虚拟机环境，设置特殊上下文。
3. 结合特殊上下文和指令sret切换到V模式，即VM-ENTRY。
4. OS内核只有一条指令，调用sbi-call的关机操作。
5. 在虚拟机中，sbi-call超出V模式权限，导致VM-EXIT退出虚拟机，切换回Hypervisor。
6. Hypervisor响应VM-EXIT的函数检查退出原因和参数，进行处理，由于是请求关机，清理虚拟机后，退出。


> 这里这个`V`模式一定要注意,之前我们只涉及了`U`和`S`模式.

![](00%20inbox/asset/Pasted%20image%2020241204212048.png)

> `S`变成了`HS`.
> `HS`是关键,作为联通真实世界和虚拟世界的通道.体系结构设计了双向变迁机制.
> 后边实现的很多东西都来自于`HS`这个特权级的寄存器.


![](00%20inbox/asset/Pasted%20image%2020241204212340.png)


H扩展后，S模式发送明显变化：原有s\[xxx\]寄存器组作用不变，新增hs\[xxx\]和vs\[xxx\]
hs\[xxx\]寄存器组的作用：面向Guest进行路径控制，例如异常/中断委托等
vs\[xxx\]寄存器组的作用：直接操纵Guest域中的VS，为其准备或设置状态

> 意思好像是要用`HS`里的`H`去假冒`VS`?

![](00%20inbox/asset/Pasted%20image%2020241204212641.png)

> 根据`spv`的不同决定`sret`会进入虚拟化还是进入`user`.

![](00%20inbox/asset/Pasted%20image%2020241204212840.png)

> 这里还多一个`spvp`,指示HS对V模式下地址空间是否有操作权限，1表示有权限操作，0无权限.


总结下来感觉虚拟机更像是一个进程,但是它又比进程多很多东西,需要运行自己的一套寄存器.

# 实验

运行之后是触发了一个`IllegalInstruction`的`trap`.

> 所以确实是会报错的.

> 这里要注意是`QEMU`的版本问题,如果是默认的`6.x`会导致无法正常进入`vmexit_handler`.
> 我这里安装的`QEMU`是`9.1.0`版本,可以参见我自己的博客[[rCore学习笔记 03]配置rCore开发环境 - winddevil - 博客园](https://www.cnblogs.com/chenhan-winddevil/p/18292632),下载的时候把版本改成`9.1.0`即可.

这里知道`li`指令访问了`a7`寄存器违反了不能访问`csr`的规定.

由于`li`的长度为`4`,我们做出如下修改`tf.sepc += 4;`:
```rust
// modules/axhal/src/arch/riscv/trap.rs
#[no_mangle]
fn riscv_trap_handler(tf: &mut TrapFrame, from_user: bool) {
    let scause: scause::Scause = scause::read();
    match scause.cause() {
        #[cfg(feature = "uspace")]
        Trap::Exception(E::UserEnvCall) => {
            tf.regs.a0 = crate::trap::handle_syscall(tf, tf.regs.a7) as usize;
            tf.sepc += 4;
        }
        Trap::Exception(E::LoadPageFault) => handle_page_fault(tf, MappingFlags::READ, from_user),
        Trap::Exception(E::StorePageFault) => handle_page_fault(tf, MappingFlags::WRITE, from_user),
        Trap::Exception(E::InstructionPageFault) => {
            handle_page_fault(tf, MappingFlags::EXECUTE, from_user)
        }
        Trap::Exception(E::Breakpoint) => handle_breakpoint(&mut tf.sepc),
        Trap::Interrupt(_) => {
            handle_trap!(IRQ, scause.bits());
        }
        Trap::Exception(E::IllegalInstruction) => {
            tf.sepc += 4;
            info!("Illegal Instruction");
        }
        _ => {
            panic!(
                "Unhandled trap {:?} @ {:#x}:\n{:#x?}",
                scause.cause(),
                tf.sepc,
                tf
            );
        }
    }
}
```

# 课后作业

> 注意触发缺页异常之后要调整`sepc`的值,防止再回去再触发缺页异常然后无限循环了.

因为未知原因会卡住,这题的解题思路应该和`h_1_0`是一样的.
