---
title: 2023开源操作系统训练营第三阶段总结报告-ChenDe
date: 2023-11-30 10:25:00
categories:
    - oscamp 2023fall arceos unikernel
tags:
    - author:chiiydd 
    - 2023秋冬季开源操作系统训练营
    - 第三阶段总结报告
---



# 总结报告

很高兴参加第三阶段ArceOS Unikernel的课程学习与训练，
经过第三阶段的学习，让我对rust、unikernel、linux等都有了更深入的理解。经过这些实验与练习，提升了我对rust语言的理解，感受到rust的条件编译的强大。学习了ArceOS的层次结构、模块化设计理念，让我对Unikernel的概念有了更具象化的理解。十分感谢石磊老师的细心讲解、助教老师孙应娥的热心帮忙以及群里的同学们的讨论指导。

下面是逐个练习的总结与反思。
## 第一周练习
### 练习 1 &2
>练习1
>
>支持彩色打印println!。以apps/helloworld为测试应用。
>要求：不能在helloworld程序本身改，要在下面的库或更深层次的组件修改
>
>练习2(附加题)
>
>支持HashMap数据类型。以apps/memtest为测试应用。
>要求：在ulib/axstd中支持HashMap类型
>
>预期输出：执行 make A=apps/memtest ARCH=riscv64 run

思路：练习1就是在println!宏的实现上添加带颜色的格式控制就可以了。
练习2根据提示是参考rust官方的hash表实现，但是官方实现内容太多了，错综复杂的依赖不好解决。根据老师在群里的提示，只需要实现测试用到的函数(new、iter、insert等)就好了，然后就顺利解决了。

我在参考官方库的时候，发现官方库实际是在 用hashbrown::hash_map，进行二次封装的。所以这个练习有一个偷懒的做法
```
use hashbrown::hash_map as HashMap;
```
### 练习3
>练习3
>
>为内存分配器实现新的内存算法early，禁用其它算法。early分配算法以apps/memtest为测试应用。

这题是我卡的最久的一个练习，我一开始以为需要涉及底层内存的分配(实际上是分配好底层的内存了)，实际上为了简化练习，底层内存已经分配固定了，只是需要给应用分配地址。
因此我一开始走了很多弯路，我的原本的想法是将byteAllocator和pageAllocator进行结合，或者是使用byteAllocator和BitAlloc结合。导致这样的想法是为以为BitAlloc是会控制底层的内存分配(不得不说实在太蠢了)。

尝试了各种方法后，请教了王格格同学，知道了正确的做法:维护byte_pos和page_pos来进行内存分配就好了。

实际的细节中要注意内存地址的对齐，为在练习5中发现了在练习3中的问题。即内存地址的大小和地址都要进行对齐。

>练习4
>
>解析dtb(FDT的二进制格式)，打印物理内存范围和所有的virtio_mmio范围。以apps/memtest为测试应
>用。
>当ArceOS启动时，上一级SBI向我们传递了dtb的指针，一直会传递到axruntime，我们就在
axruntime中执行解析并打印。

思路：需要查阅相关资料，了解DTB，了解FDT相关的内容。感谢群里的郝淼同学分享的hermit-dtb库，解析dtb很方便。在解析的过程中需要注意的点是内存地址和大小的字段在reg字段中，需要将reg一分为二。

### 练习5
>练习5
>
>把协作式调度算法fifo改造为抢占式调度算法。让测试应用通过

难点：主要是要理解arcos中的调度模块的代码，启用preemt的feature。
## 第二周练习
###  练习1&2

> 练习 1：
> 
> main 函数中，固定设置 app_size = 32，这个显然是不合理甚至危险的。
> 请为 image 设计一个头结构，包含应用的长度信息，loader 在加载应用时获取它的实际大小。执行通过。
>
> 练习 2：
>
>在练习 1 的基础上，扩展 image 头结构，让 image 可以包含两个应用。
>第二个应用包含唯一的汇编代码是 ebreak 。
>如实验 1 的方式，打印出每一个应用的二进制代码

练习1和练习2是关系紧密的，都是要给image添加文件头，可以直接做练习2。

我们需要知道应用的数量，以及每个应用的字节长度，所以很自然地可以想到，首先文件头第一个字段应该是 **应用数量**，然后接着是每个应用的**应用大小**,最后是每个应用的**应用二进制内容**。
 
因此我设计的文件格式如下
| field| length|
| ----------- | ----------- |
| app_amount| 2 bytes|
| app0_size | 2 bytes|
| app1_size | 2 bytes|
| ......    | 2 bytes|
| appn_size | 2 bytes|
| app0_bin  | app0_size bytes|
| app1_bin  | app1_size bytes|
| .......   |  .......|
| appn_bin  | appn_size bytes|

应用数量和应用大小字段长度都是2个字节,因此我用rust写了个小程序将文件头写入文件。
```
    //参数是 需要合并的app文件名称
    let mut args =env::args();
    args.next();
    let files_number:u16=args.len() as u16;

    let mut output_file: File =File::create("new_apps.bin").expect("open fails");
    output_file.write(&files_number.to_be_bytes()).expect("write file numbers fails");
    
    for file in args{
        let length:u16= fs::metadata(file.clone()).expect("open file fails").len() as u16;
        println!("APP:{}:{}",file,length);
        output_file.write(&length.to_be_bytes()).expect("writing file length fails");

    }
    args=env::args();
    args.next();
    for file in args{
        let mut source_file=File::open(file).expect("Opening file fails");
        let mut buffer=Vec::new();
        source_file.read_to_end(&mut buffer).expect("reading file fails.");
        output_file.write_all(&buffer).expect("writing file fails.");
    }
```

相应的在arcos中的loader程序就要先读取前两个字节，获取app数量，然后再依次读取app长度和app的内容

要注意的细节：要维持文件大小在32M,否则qemu无法加载，文件大小在Makefile文件中写死了。

### 练习3
>练习 3：
>
>批处理方式执行两个单行代码应用，第一个应用的单行代码是 nop ，第二个的是 wfi 

思路：如何把控制权重新回到arceos中，重新返回到loader中执行

### 练习4
>练习 4：
>
>本实验已经实现了1 号调用 - SYS_HELLO，2 号调用 - SYS_PUTCHAR，请实现 3 号调用 -
SYS_TERMINATE 功能调用，作用是让 ArceOS 退出，相当于 OS 关机。

思路：熟悉arceOS的代码，寻找相关的模块代码。我的想法是关机的调用实际上是应该控制硬件来进行操作的，可能跟sbi相关的，应该在硬件抽象层，所以为主要是看了axhal模块的代码。然后发现了相关的调用代码
```
/// Shutdown the whole system, including all CPUs.
pub fn terminate() -> ! {
    info!("Shutting down...");
    sbi_rt::system_reset(sbi_rt::Shutdown, sbi_rt::NoReason);
    warn!("It should shutdown!");
    loop {
        crate::arch::halt();
    }
}
```
所以只需要在loader中调用这个terminate函数就可以实现关机操作。

### 练习5 
>练习5 
>
>照如下要求改造应用 hello_app：
>1. 把三个功能调用的汇编实现封装为函数，以普通函数方式调用。例如，SYS_PUTCHAR 封装为
fn putchar(c: char) 。
>2. 基于打印字符函数 putchar 实现一个高级函数 fn puts(s: &str) ，可以支持输出字符串。
>3. 应用 hello_app 的执行顺序是：Hello 功能、打印字符串功能、退出功能。

思路：将三部分调用的内联汇编代码都封装在函数中，在入口函数中顺序调用即可。

看样子不难的程序我又卡了很久很久，跟编译器斗智斗勇了很久。
```
unsafe extern "C" fn _start(_entry:usize){
    ENTRY=_entry;
    hello();
    puts("ArceOS exercise 5.");
    terminate();
}
```
理想的执行过程是依次调用hello、puts、terminate函数后退出。但是无论怎么尝试，程序只会执行第一个调用的函数后退出。我就很疑惑:能够执行第一个调用的函数，那说明我的函数封装应该没有问题，可是为什么无论调用多少次，只会执行一次。而且调用多少次都不会改变编译生成的文件大小。然后我又生成了汇编代码进行查看。
```
_start:
	addi	sp, sp, -32
	sd	ra, 24(sp)
	sd	s0, 16(sp)
	sd	s1, 8(sp)
	sd	s2, 0(sp)
	addi	s0, sp, 32
	mv	s1, a0
.Lpcrel_hi0:
	auipc	s2, %pcrel_hi(_ZN9hello_app5ENTRY17hc4afe4ceb535dcc3E.0)
	sd	a0, %pcrel_lo(.Lpcrel_hi0)(s2)
	mv	t2, a0
	#APP

	li	t0, 1
	mv	a7, t2
	slli	t0, t0, 3
	add	t1, a7, t0
	ld	t1, 0(t1)
	jalr	t1

	#NO_APP
	ld	a0, %pcrel_lo(.Lpcrel_hi0)(s2)
	bne	a0, s1, .LBB0_2
	ld	ra, 24(sp)
	ld	s0, 16(sp)
	ld	s1, 8(sp)
	ld	s2, 0(sp)
	addi	sp, sp, 32
	ret
```
然后发现start内确实只有我第一个调用函数的汇编代码。难道是为我的代码被编译器给优化了?
然后尝试了各种方法，改成debug模式，修改优化等级，修改使用的寄存器等。比如在Cargo.toml中修改优化等级为0。
```
[profile.dev]
opt-level = 0
```
均没有任何效果。
然后为又重新审视了每个汇编代码块。
```
unsafe fn hello() {
        core::arch::asm!("
        li t0, {abi_num}
        mv a7,t2
        slli t0, t0, 3
        add t1, a7, t0
        ld t1, (t1)
        jalr t1
        ",
        abi_num = const SYS_HELLO,
        in("t2") ENTRY,
        clobber_abi("C"),     // 告诉编译器 clobber 了通用寄存器
        options(noreturn) 
        )
}
```
然后发现了问题所在:options(noreturn)是告诉编译器这段汇编代码没有返回，也就是说后面的代码永远也不会执行，因此编译器会把后面调用的函数代码全都丢掉。因此只会执行第一次函数调用。注释掉即可解决问题。

### 练习6
>练习 6：
>1. 仿照 hello_app 再实现一个应用，唯一功能是打印字符 'D'。
>2. 现在有两个应用，让它们分别有自己的地址空间。
>3. 让 loader 顺序加载、执行这两个应用。这里有个问题，第一个应用打印后，不能进行无限循环
之类的阻塞，想办法让控制权回到 loader，再由 loader 执行下一个应用。

思路:需要为每个应用分配独立的地址空间，并在跳转到app之前切换到app的地址空间，返回时再重新切换回内核空间。

因此在切换到app的地址空间之前，需要先保存当前的satp寄存器的值，执行完app后重新加载。
