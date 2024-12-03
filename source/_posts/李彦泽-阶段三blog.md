---
title: 李彦泽-阶段三blog
date: 2024-12-01 21:57:58
tags:
---

# 宏内核

到宏内核的特点就是:
1. syscall
2. app和kernel分离
	1. 特权级分离
	2. 独立空间
	3. 可以加载应用

用户空间降级方式:伪造返回现场到新任务, sret
过程:
1. 初始化用户栈
2. 创建新任务
3. 让出CPU

---

### 几个重要的点
#### 1. 任务扩展属性
将调度属性和资源属性分离,从而复用调度组件

{% asset_img 1732863170214_d.png 李彦泽-阶段三blog %}

---
#### 2. 系统调用
用的是linkme这个库
`linkme` 是一个 Rust 的库，主要用于在编译期将数据链接到程序的特定部分（如全局变量），从而实现类似插件或模块化的功能。它可以动态扩展程序的功能，而无需显式修改原始代码。以下是对 `linkme` 的详细介绍，包括其用法和原理。

##### 核心功能

`linkme` 提供了一种机制，使多个 Rust 模块中的静态变量可以被聚合到一个全局列表中。常见的使用场景包括：

1. **插件系统**：收集并注册动态功能。
2. **初始化系统**：在程序启动时执行一系列初始化函数。
3. **静态配置集合**：在不同的模块中定义配置项，并将它们汇总到一个位置。
##### 使用方法
###### 1. 添加依赖
在 `Cargo.toml` 中添加：
```
`[dependencies] linkme = "0.3"`
```
###### 2. 定义集合

使用 `#[linkme::distributed_slice]` 定义一个全局的切片，用于收集静态变量。例如：

```rust
use linkme::distributed_slice;  
#[distributed_slice] 
pub static MY_SLICE: [fn()] = [..];`
```

这里，`MY_SLICE` 是一个切片，它的类型是 `fn()`，表示可以存放多个函数指针。

###### 3. 添加元素

在其他模块中，使用 `#[distributed_slice]` 将元素插入到切片中：
```rust
use linkme::distributed_slice;

#[distributed_slice(MY_SLICE)]
static FIRST_FUNCTION: fn() = || println!("First function");

#[distributed_slice(MY_SLICE)]
static SECOND_FUNCTION: fn() = || println!("Second function");
```

###### 4. 使用切片

在程序中，你可以遍历切片的所有元素，并执行对应逻辑：
```rust
fn main() {
    for func in MY_SLICE {
        func();
    }
}
```

得到
```
First function
Second function
```
##### 原理解析

`linkme` 的实现基于 Rust 的链接器特性和目标平台的支持。以下是其工作原理：
1. **分布式切片的定义**：
    - `#[distributed_slice]` 宏定义了一个全局符号，分配了一段内存区域，专门用于存储相关的元素。
2. **分段存储**：
    - 每次使用 `#[distributed_slice]` 添加元素时，`linkme` 会将这些元素放置到编译产物的特定段（section）中。
3. **链接器聚合**：
    - 链接器在链接阶段会将所有模块中定义的元素合并到一个段中，使得这些元素在运行时可以统一访问。

### 课后题

1. 注册 PAGE_FAULT
2. 完善注册函数
	1. 获得当前的task
	2. 得到aspace
	3. 调用其handle_page_fault方法填充

{% asset_img Pasted%20image%2020241129150239.png answer  %}


## 第二节

内存管理方式:
{% asset_img 1732877291289_d.png img %}
其他的和rcore很像,最后会在backend中处理映射
- alloc(支持lazy)
- linear  (连续映射)

lazy映射:先map出虚拟地址但是没有关联物理地址,在page fault后在处理函数中多次嵌套调用handle,最后在aspace中完成关联

### 课后题

mmap的实现和page fault的处理很像,

1. 找到一个free的va(最开始这里卡了很久)
2. 读取文件内容,填充到buffer
3. map alloc出一个页
4. 用buffer填充这个页 

{% asset_img Pasted%20image%2020241129182524.png answer %}

# hypervisor

## 第一节

hypervisor和虚拟机的区别是:支撑其物理运行的体系结构和其虚拟运行的环境是否一样(**同构**). 所以hypervisor比虚拟机更加高效.

我的理解,hypervisor也是一种类似于OS软件,如果是U的指令可以直接执行,如果需要特权级就在hypervisor中捕获处理.
hypervisor的扩展指令也是为了加速这个过程

资源管理:
1. vcpu(直接绑定到一个CPU)
2. vmem(提供自己的页表转换)
3. vdevice(virtual io/ 直接映射 / 模拟)
4. vutilities(中断/总线..)

### 练习题

panic将系统shut,所以需要去掉panic改成(ax_println!),然后将sepc+4跳转到下一个指令,再设置一下a0,a1的值就可以了

![](attachment/Pasted%20image%2020241127182957.png)

## 第二节
![](attachment/1732793326547_d.png)

主要学习了两段映射
1. Guest缺页,guset os向hypervisor查找
2. hypervisor也缺页,向实际物理机申请

第二的部分有两个模式
1. 透传
2. 模拟

透传:直接把宿主物理机(即qemu)的pflash透传给虚拟机。(快 捆绑设备)
模拟:模拟一个pflash,当读取的时候传递(慢 不依赖硬件)
![](attachment/1732793674957_d.png)


**切换**
![](attachment/1732793492927_d.png)
具体的汇编:
![](attachment/1732793589062_d.png)

![](attachment/1732793630945_d.png)


### 练习题
将pflash.img写入img的/sbin/下后,在 `h_2_0/src/main.rc` 中将其read出来,然后将第一页的内容填充到buf中,aspace.write进去就可
![](attachment/Pasted%20image%2020241128181025.png)


## 第三节课
实验课正在做

### 虚拟时钟

总的思路是:通过关键的寄存器hvip中的VSTIP(时钟中断)来向hypervisor响应虚拟机的设置时钟中断,然后当时钟中断来的时候退出vm,并重新设置时钟中断hvip,回到vm处理.

### 宏内核的支持

主要是flash这种设备的处理,这个在前一个的实验中已经解决了.

虚拟设备管理:通过mmio,注册device的地址,当发生page fault的时候判断一下,如果是在mem中则正常处理,如果是在device则去对应的设备处理.
