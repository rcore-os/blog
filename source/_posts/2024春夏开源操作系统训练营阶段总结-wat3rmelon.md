
---

title: 2024春夏开源操作系统训练营阶段总结-wat3rmelon

date: 2024-04-25 16:48:00

tags:
    - author:waterm310n

---

## 第一阶段

两年前就有听说过rust了，但是只是简单的看了下the rust book，并没有实际使用rust进行编程。这次打算借着rcore进一步实践rust。

目前的感受是rust的设计给了很多的限制，同时rust似乎也和cpp一样算是多范式的语言？就比如迭代一个列表既可以写成下面的形式
```rust
for ... in something.iter() {

}
```
写可以写成
```rust
something.iter().sum();
```
这样的形式。说实话，我不是很喜欢多范式的编程语言。因为选择太多了，对于我来说阅读别人的代码就会很麻烦。所以这里我更喜欢go的设计。

此外我用rust刷了一些leetcode上的简单的算法题，感觉挺头疼的。需要关注特别多的细节，而且leetcode特别喜欢给i32类型数据，而rust中访问容器用的下标都是usize类型的。导致代码写起来一点也不美观。有特别多的`xx as usize`

此外，感觉rust的标准库看起来是提供了很多方法来代替本来可用指针操作的方法。比如vector的swap，一般情况下其它语言里可能是这样写
```python
a,b = b,a
```

rust对数据类型还特别敏感，只要有越界就会报错，必须得用饱和减法`saturating_sub`之类的方式来处理。

总之，我感觉rust的限制太多了，这让我对写好一个rust程序来说感觉心智负担很重。对于不依靠编辑器写完整程序没有信心。

希望接下来的rcore能改变我当前对rust的看法。

## 第二阶段

第二阶段的难度算是渐进式的吧。第二阶段的lab里，我印象最深的部分分别是内存的地址空间，文件系统Inode组织，死锁检测。

因此，下面我就对这三部分进行一些总结好了。

### 死锁检测

首先聊一下死锁检测吧，因为这个是最近做过的，所以印象比较深。这部分我之前一直只知道有一个银行家算法，所以一开始看到死锁检测这部分的算法跟银行家算法一样记录allocation和need的时候感觉优点懵。因为，在我原来的理解里，银行家算法应该是需要提前知道线程需要的资源的。

后来动手实现后，才发现死锁检测算法和银行家算法是有区别的，银行家算法其实是死锁避免算法。死锁检测算法感觉主要针对的就是信号量上的资源分配，然后在每一次申请的时候检查，是否分配这次资源后，能够有一个序列走得通，如果有，就算无死锁，否则算有死锁。整体上的时间复杂度应该是 $O(nm)$ 的其中 $n$ 是线程数量， $m$ 是资源数量。

平常写其它语言的时候并没有感觉到死锁检测的存在，可能就是因为这个时间复杂度随着资源数量和线程数量线性增长，所以不采用吧？

### 文件系统

下面来聊一下文件系统，这部分实验的学习中，我感觉复杂的地方主要在于存在很多的抽象。文件系统本身存储diskInode，然后虚拟文件系统上抽象了Inode，OSInode，最后到操作系统中，它使用的是File trait抽象。

抽象层数很多，因此让我挺晕的。这部分代码上面，感觉比较关键的是Inode的组织。超级快->Inode位图->数据位图->Inode区域->数据块区域。

### 地址空间

这部分我觉得是非常有收获的一部分，让我感觉算是彻底理解了多级页表，段表的区别。在此之前一直不知道页表是怎样存储的，总是想着它是存到一个特殊的内存里。现在算是明白了页表不过是存储在普通的内存里的一个结构，然后CPU依靠token来区分当前的页表。

SV39页表中，偏移为4KB，所以使用了后12位，剩余的 $39-12=27$刚刚好分成3部分，每部分占了 $27/3=9$ 位，也就是512个页表项，每个页表项占8字节，刚刚好可以将一个页存储满。

然后是操作系统内核采用恒等映射，用户程序除了跳板页，其它的采用Framed映射。这样使得操作系统访问的虚拟地址就是物理地址，而用户程序访问的是虚拟地址。这种区分使得操作系统可以访问到用户的地址，用户程序无法访问操作系统的地址。实现了空间上的隔离。

## 第三阶段

第三阶段我选择的是项目一：ArceOS单内核Unikernel。该实习项目主要分为两部分：熟悉ArceOS阶段与完成实习任务阶段。

### 熟悉ArceOS阶段

这一阶段主要是在ArceOS仓库下，完成一些简单的任务。分了两周来实现，第一周主要是尝试为ArceOS添加一些简单的功能。第二周则是练习从外部加载应用到arceos中，通过func call的方式使得外部应用可以打印字符。

#### 第一周

- 练习1：支持彩色打印 println! 通过在输出的时候，在前后添加特殊符号，使得输出的颜色可以改变。
- 练习2：支持HashMap数据类型 这一步我参考rust的HashMap实现，调用了相同的库完成。
- 练习3：为内存分配器实现新的内存算法 这一步我主要是利用了现有的算法完成页分配与字节分配
- 练习4：解析dtb并打印 这一步我觉得主要难点是dtb的解析，因为不清楚dtb长什么样的，学习后，调用一个crate完成了该任务。
- 练习5：抢占式调度算法 这一步我记得我是参考了现有的抢占式调度算法，然后做了一个奇偶性的判断，每次出队前，如果这次出队是奇数，就放到队头，否则正常放到队尾。

#### 第二周

本周主要是我的收获主要是对qemu的启动参数有了一些了解，然后就是了解了rust中手写asm的方法。

### 实习任务阶段

#### 第一周 rt_helloworld与rt_memtest与系统调用新增   

我主要是在熟悉lkmodel，完成了原来arceos下的rt_helloworld与rt_memtest两个unikernel的实现。这一部分根据要求，必须要有axstd。因此我一开始的实现是将arceos下的axstd库直接拷贝过来，并且把它需要用到的库也进行了靠北，然后修改一些代码，使得可以编译通过。这个的结果在dev_task1_brute_force分支下。不过后来从群里得知，要尽量从lkmodel已经有的库开始，所以就重新实现了这部分，主要的方式是基于axlog2这个库，做了一些包装和宏的重新导出。

本周的问题是

- 在实现rt_memtest的时候，出现的全局分配器不存在的问题。
是为了解决这个问题，我发现是需要引用axalloc这个crate，同时还需要进行初始化。因此，出于实现方便，我在axstd文件夹下同时创建了一个axruntime crate，在其中编写了rust_main函数，在其中完成全局分配器的初始化。

- 同时在周的结尾，我遇到的问题是宏内核在我操作系统上无法成功运行btp下的测试，通过在微信群与老师交流，我得知主要的原因是glibc在不同操作系统下编译C文件的结果，使用到的系统调用是不同的。就比如init.c，在我的操作系统下编译出的结果需要使用到stat系统调用，而该系统调用在当前lkmodel中是未实现的，因此我尝试在lkmodel中添加该系统调用，主要实现在axsyscall crate中添加该系统调用的函数，然后再fileops中添加fstat函数，该函数的实现参考fstatat函数，这个函数的功能是在目录中获取文件信息。

通过对系统调用新增实现，成功让我的宏内核可以在我的操作系统中运行btp下的init.c程序。我的感受就是了解了不同指令集，linux给他们分配的系统调用号码是不一样的。同时不同操作系统版本的下的glibc生成的文件，使用的系统调用也不一样。

#### 第二、三周 rt loader

我在第二、三周完成了lkmodel下运行glibc静态编译的hello world的c应用。

这一部分我主要是参考思路3PPT的实现，首先就是对opensbi与sbi-rt的修改，这一步我是clone了opensbi代码然后按照ppt的方法进行修改。对于sbi-rt的修改则是fork其仓库，修改后提交到自己的仓库下。最后在cargo.toml中添加依赖即可。

剩下的就是修改qemu.mk脚本，向其中增加Pflash参数与bios参数。
如下所示,让其指向payload文件夹以此加载程序内容。
```makefile
qemu_args-riscv64 := \
  -machine virt \
  -drive if=pflash,file=$(CURDIR)/payload/apps.bin,format=raw,unit=1 \
  -bios ~/opensbi/build/platform/generic/firmware/fw_jump.bin  \
  -kernel $(OUT_BIN)
  # -bios default 
```

此处payload我是复制org_arceos下的payload，运行mk.sh脚本即可生成apps.bin。其中包含了两个hello world程序，不过由于我没有实现多线程，所以我只能跑一个hello world程序，跑完后发出的exit调用会导致我的程序直接退出。如果实现多线程的话就只会线程退出，然后回到rt_loader。

##### 地址空间管理问题

使用rt_loader时，主要加载的是glibc静态编译的的elf程序，elf程序中存在两个数据段，一个是.text段，一个是.data段。程序想要运行就必须将这两个段搬运到对应的虚拟地址上去，否则程序无法运行。

因此为了完成虚拟地址映射，需要进行地址空间的管理。主要是创建SV39页表，目前lkmodel中的paging完成了这个页表的管理，因此我一开始是参照这个crate与org_arceos的实现，在其中创建一个静态变量来存储用户程序的页表。并编写了map_region。

但是这样做不太好，因为这样一次只能运行一个程序了，而且接下来我在运行程序的时候，它进行系统调用时，获取访问页表的手段是通过TCB中mm_struct来获取的。因此我对此进行了修改。

主要是在我的axstd下添加了map_region函数，它的功能是获取当前的task，然后获取一个可变引用，然后在task中我添加了一个map_region方法，这个map_region方法最终会对task的mm成员变量进行map_region操作。大致的调用关系如下

```rust
/// rt_loader中的程序调用map_region方法
vm::map_region(va, pa, num_pages << PAGE_SHIFT, flags);

/// axstd的vm模块下的map_region
pub fn map_region(va: usize, pa: usize, len: usize, flags: usize) {
    let mut task = task::current();
    // 向当前任务的mm中进行map_region
    task.as_task_mut().map_region(va, pa, len, flags)
}
/// task的map_region方法
pub fn map_region(&mut self,va: usize, pa: usize, len: usize, flags: usize) {
    self.mm.as_mut().map(|mm| {
        let locked_mm = mm.lock();
        locked_mm.map_region(va, pa, len, flags);
        use mm::VmAreaStruct;
        let vma = VmAreaStruct::new(va, va + len, 0, None, 0);
        mm.lock().vmas.insert(va, vma);
    });
}

/// mm的map_region方法
pub fn map_region(&self, va: usize, pa: usize, len: usize, _uflags: usize) -> PagingResult {
    let flags =
        MappingFlags::READ | MappingFlags::WRITE | MappingFlags::EXECUTE ; 
    self.pgd
        .lock()
        .map_region(va.into(), pa.into(), len, flags, true)
}

```

此处我实现的一个额外点在于调用map_region方法的时候，我同时会向mm struct中的vmas添加vma，也就是让程序知道这个地址空间被分段使用了。

#### task_ctx问题

在我的实现中，因为使用task记录了页表，因此我在我的axruntime库上添加了对axtask的初始化。同时我还初始化了axtrap，用于系统调用。

最后存在的一个问题是，在lkmodel的系统调用处理过程中，它经常需要访问task_ctx，从中获取当前的task，然后进行相关的操作，比如mmap，mprotect，brk系统调用等。但是因为获取task_ctx失败，所以我一直卡在此处。

听了符同学的提醒，我最终使用静态变量的方式将记录task_ctx，如下所示
```rust
pub static mut CURRENT_TASKCTX_PTR:Option<* const SchedInfo> = None;

// 然后在所有初始化task_ctx的位置
// 将 axhal::cpu::set_current_task_ptr(ptr);
// 修改为 CURRENT_TASKCTX_PTR = Some(ptr);

// 在所有获取task_ctx的位置
// 将 axhal::cpu::current_task_ptr();
// 修改为if let Some(ptr) = CURRENT_TASKCTX_PTR {...}
```

#### brk问题

解决完了上述问题后，我还遇到的问题就是系统调用分配堆空间的问题。我一开始没有设置brk，因此它总是从默认的位置0开始向后分配堆空间，而这部分空间与程序运行的代码段产生了冲突。

即代码段在0x10000-0x7e0000之间，而brk申请了0x1000-0x220000之间的空间。这导致了空间上的冲突，因此我后来在运行linux app之前，首先设置了brk的地址，将它设置为了数据段之后的位置。通过这样设置，就不会产生冲突了。

### 总结

总体来说，我完成了lkmodel下运行glibc静态编译的hello world的c应用。这让我对elf结构，qemu.log的调试，地址空间与系统调用都有了更进一步的了解。

lkmodel的组件划分让我觉得非常地棘手，因为虽然是将组件进行了分类，但是感觉想要实现特定功能的话，我依然是需要理解每个组件之间的依赖关系，有时还需要理解每个组件的内部实现。这是我认为相比rcore-os来说，主要的难点。


仓库链接是[lkmodel](https://github.com/waterm310n/lkmodel)
